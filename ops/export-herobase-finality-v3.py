from __future__ import annotations

import base64
import json
import os
from pathlib import Path
import re
import subprocess
from urllib.request import Request, urlopen

REPOSITORY = os.environ["GITHUB_REPOSITORY"]
TOKEN = os.environ["GH_TOKEN"]
SOURCE_BLOB = "85635f49d822a0cf0a546ec5bc987551c99aeb19"


def github_request(url: str, *, data: bytes | None = None, method: str = "GET") -> bytes:
    request = Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "VETS-HeroBase-Finality-Exporter",
        },
    )
    with urlopen(request, timeout=60) as response:
        return response.read()


payload = json.loads(
    github_request(f"https://api.github.com/repos/{REPOSITORY}/git/blobs/{SOURCE_BLOB}")
)
if payload.get("encoding") != "base64":
    raise RuntimeError("unexpected source blob encoding")
source = base64.b64decode(payload["content"]).decode()

source = source.replace(
    'PATCH_BRANCH="${PATCH_BRANCH:-fix/dao-ownership-production-final-20260726}"',
    'PATCH_BRANCH="${PATCH_BRANCH:-fix/dao-ownership-final-20260727}"',
    1,
)

old_state = "ROOT_PM2_HAD_APP=false; NEW_PM2_STARTED=false; CANONICAL_SWAPPED=false; OLD_CANONICAL=''"
new_state = "ROOT_PM2_HAD_APP=false; NEW_PM2_STARTED=false; CANONICAL_SWAPPED=false; OLD_CANONICAL=''; SMOKE_PID=''"
if source.count(old_state) != 1:
    raise RuntimeError("state anchor mismatch")
source = source.replace(old_state, new_state, 1)

old_rollback = """    status="$?"; trap - ERR; printf 'VETS_HOST_PREP_ROLLBACK_ATTEMPTED=true\\n'
    if [ "$NEW_PM2_STARTED" = true ]; then runuser -u "$DEPLOY_USER" -- env HOME="/home/$DEPLOY_USER" pm2 delete hero-dapp >/dev/null 2>&1 || true; fi
"""
new_rollback = """    status="$?"; trap - ERR; printf 'VETS_HOST_PREP_ROLLBACK_ATTEMPTED=true\\n'
    if [ -n "${SMOKE_PID:-}" ]; then kill "$SMOKE_PID" >/dev/null 2>&1 || true; wait "$SMOKE_PID" >/dev/null 2>&1 || true; SMOKE_PID=''; fi
    if [ "$NEW_PM2_STARTED" = true ]; then runuser -u "$DEPLOY_USER" -- env HOME="/home/$DEPLOY_USER" pm2 delete hero-dapp >/dev/null 2>&1 || true; fi
"""
if source.count(old_rollback) != 1:
    raise RuntimeError("rollback anchor mismatch")
source = source.replace(old_rollback, new_rollback, 1)

backup_anchor = """  if [ -d "$LEGACY_DIR/.git" ]; then git -C "$LEGACY_DIR" rev-parse HEAD > "$BACKUP/legacy-head.txt" || true; git -C "$LEGACY_DIR" status --porcelain=v1 --untracked-files=all > "$BACKUP/legacy-status.txt" || true; fi

"""
backup_insert = """  if [ -d "$LEGACY_DIR/.git" ]; then git -C "$LEGACY_DIR" rev-parse HEAD > "$BACKUP/legacy-head.txt" || true; git -C "$LEGACY_DIR" status --porcelain=v1 --untracked-files=all > "$BACKUP/legacy-status.txt" || true; fi
  [ -f "$APP_DIR/.env" ] && install -m 600 "$APP_DIR/.env" "$BACKUP/var-www.env" || true
  [ -f "$LEGACY_DIR/.env" ] && install -m 600 "$LEGACY_DIR/.env" "$BACKUP/legacy.env" || true

"""
if source.count(backup_anchor) != 1:
    raise RuntimeError("backup anchor mismatch")
source = source.replace(backup_anchor, backup_insert, 1)

old_runtime = """  node - "$BACKUP/root-pm2-jlist.json" "/home/$DEPLOY_USER/.config/hero-dapp/runtime-env.json" <<'NODE'
const fs=require('fs');const list=JSON.parse(fs.readFileSync(process.argv[2],'utf8')||'[]');const app=list.find(x=>x.name==='hero-dapp');if(!app)process.exit(42);const src=app?.pm2_env?.env||{};const blocked=/^(PM2_|pm_|NODE_APP_INSTANCE$|PWD$|OLDPWD$|HOME$|USER$|LOGNAME$|SHELL$|SHLVL$|_$|PATH$|SSH_|XDG_)/;const env={};for(const[k,v]of Object.entries(src)){if(!blocked.test(k)&&typeof v==='string')env[k]=v}fs.writeFileSync(process.argv[3],JSON.stringify(env,null,2)+'\\n',{mode:0o600});
NODE
  chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.config/hero-dapp/runtime-env.json"; chmod 600 "/home/$DEPLOY_USER/.config/hero-dapp/runtime-env.json"
"""
new_runtime = """  python3 - "$BACKUP/root-pm2-jlist.json" "$LEGACY_DIR/.env" "$APP_DIR/.env" "/home/$DEPLOY_USER/.config/hero-dapp/runtime-env.json" "/home/$DEPLOY_USER/.config/hero-dapp/runtime.env" <<'PYENV'
from __future__ import annotations
import ast, json, os, re, sys
from pathlib import Path
pm2_path, legacy_path, canonical_path, json_out, dotenv_out = map(Path, sys.argv[1:])
name_re = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*$')
blocked = re.compile(r'^(?:PM2_|pm_|NODE_APP_INSTANCE$|PWD$|OLDPWD$|HOME$|USER$|LOGNAME$|SHELL$|SHLVL$|_$|PATH$|SSH_|XDG_|HERO_RELEASE_SHA$|PORT$)')
values = {}

def store(key, value):
    if not name_re.fullmatch(key) or blocked.match(key) or value is None:
        return
    if isinstance(value, (str, int, float, bool)):
        values[key] = str(value)

def parse_dotenv(path):
    if not path.is_file():
        return
    for raw_line in path.read_text(errors='strict').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, raw = line.split('=', 1)
        key = key.strip().removeprefix('export ').strip()
        raw = raw.strip()
        if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in {'\\"', "'"}:
            try:
                value = ast.literal_eval(raw)
            except Exception:
                value = raw[1:-1]
        else:
            value = raw.split(' #', 1)[0].rstrip()
        store(key, value)

if pm2_path.is_file():
    processes = json.loads(pm2_path.read_text() or '[]')
    app = next((item for item in processes if item.get('name') == 'hero-dapp'), None)
    if app:
        for key, value in (app.get('pm2_env', {}).get('env', {}) or {}).items():
            store(key, value)
parse_dotenv(legacy_path)
parse_dotenv(canonical_path)
values['NODE_ENV'] = 'production'
if len(values.get('JWT_SECRET', '')) < 32:
    raise SystemExit('BLOCKED: merged JWT_SECRET is absent or shorter than 32 characters')
if not values.get('DATABASE_URL', '').strip():
    raise SystemExit('BLOCKED: merged DATABASE_URL is absent')
Path(json_out).write_text(json.dumps(values, indent=2, sort_keys=True) + '\\n')
Path(dotenv_out).write_text(''.join(f'{key}={json.dumps(value)}\\n' for key, value in sorted(values.items())))
os.chmod(json_out, 0o600)
os.chmod(dotenv_out, 0o600)
print(f'VETS_RUNTIME_ENV_VALIDATED=true keys={len(values)}')
PYENV
  chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.config/hero-dapp/runtime-env.json" "/home/$DEPLOY_USER/.config/hero-dapp/runtime.env"
  chmod 600 "/home/$DEPLOY_USER/.config/hero-dapp/runtime-env.json" "/home/$DEPLOY_USER/.config/hero-dapp/runtime.env"
"""
if source.count(old_runtime) != 1:
    raise RuntimeError("runtime environment anchor mismatch")
source = source.replace(old_runtime, new_runtime, 1)

checkout_anchor = """  runuser -u "$DEPLOY_USER" -- env HOME="/home/$DEPLOY_USER" git -C "$STAGE" checkout -B main "$TARGET_SHA"
  test "$(git -C "$STAGE" rev-parse HEAD)" = "$TARGET_SHA"; test -z "$(git -C "$STAGE" status --porcelain=v1 --untracked-files=all)"
"""
checkout_insert = """  runuser -u "$DEPLOY_USER" -- env HOME="/home/$DEPLOY_USER" git -C "$STAGE" checkout -B main "$TARGET_SHA"
  test "$(git -C "$STAGE" rev-parse HEAD)" = "$TARGET_SHA"; test -z "$(git -C "$STAGE" status --porcelain=v1 --untracked-files=all)"
  install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.config/hero-dapp/runtime.env" "$STAGE/.env"
  test -z "$(git -C "$STAGE" status --porcelain=v1 --untracked-files=all)"
"""
if source.count(checkout_anchor) != 1:
    raise RuntimeError("checkout anchor mismatch")
source = source.replace(checkout_anchor, checkout_insert, 1)

build_anchor = """  runuser -u "$DEPLOY_USER" -- env HOME="/home/$DEPLOY_USER" bash -c "cd '$STAGE' && corepack enable && corepack prepare pnpm@10.34.4 --activate && pnpm install --frozen-lockfile && rm -rf dist && pnpm build"
  test -f "$STAGE/dist/index.js"
"""
build_insert = """  runuser -u "$DEPLOY_USER" -- env HOME="/home/$DEPLOY_USER" bash -c "cd '$STAGE' && corepack enable && corepack prepare pnpm@10.34.4 --activate && pnpm install --frozen-lockfile && rm -rf dist && pnpm build"
  test -f "$STAGE/dist/index.js"
  SMOKE_PORT="$(python3 - <<'PYPORT'
import socket
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    print(sock.getsockname()[1])
PYPORT
)"
  [[ "$SMOKE_PORT" =~ ^[0-9]+$ ]]
  smoke_url="http://127.0.0.1:$SMOKE_PORT/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D"
  runuser -u "$DEPLOY_USER" -- env HOME="/home/$DEPLOY_USER" NODE_ENV=production PORT="$SMOKE_PORT" HERO_RELEASE_SHA="$TARGET_SHA" node "$STAGE/dist/index.js" > "$BACKUP/smoke-start.log" 2>&1 &
  SMOKE_PID="$!"
  health_ok "$smoke_url"
  kill "$SMOKE_PID" >/dev/null 2>&1 || true
  wait "$SMOKE_PID" >/dev/null 2>&1 || true
  SMOKE_PID=''
  printf 'VETS_PRE_SWAP_SMOKE=PASS\\n'
"""
if source.count(build_anchor) != 1:
    raise RuntimeError("build anchor mismatch")
source = source.replace(build_anchor, build_insert, 1)

required = [
    'PATCH_BRANCH="${PATCH_BRANCH:-fix/dao-ownership-final-20260727}"',
    "VETS_RUNTIME_ENV_VALIDATED=true",
    "merged JWT_SECRET is absent or shorter than 32 characters",
    'install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.config/hero-dapp/runtime.env" "$STAGE/.env"',
    "VETS_PRE_SWAP_SMOKE=PASS",
]
for marker in required:
    if marker not in source:
        raise RuntimeError(f"missing required marker: {marker}")
if 'PATCH_BRANCH="${PATCH_BRANCH:-fix/dao-ownership-production-final-20260726}"' in source:
    raise RuntimeError("stale patch branch remains")

outdir = Path("finality-export")
outdir.mkdir(exist_ok=True)
output = outdir / "herobase-production-host-finalizer-v3.sh"
output.write_text(source)
output.chmod(0o700)
subprocess.run(["bash", "-n", str(output)], check=True)

forbidden = set("\u061c\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069")
credential = re.compile(
    r"BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}"
)
if any(char in forbidden for char in source):
    raise RuntimeError("hidden or bidirectional Unicode found")
if credential.search(source):
    raise RuntimeError("credential pattern found")

blob_payload = json.dumps(
    {
        "content": base64.b64encode(source.encode()).decode(),
        "encoding": "base64",
    }
).encode()
blob_sha = json.loads(
    github_request(
        f"https://api.github.com/repos/{REPOSITORY}/git/blobs",
        data=blob_payload,
        method="POST",
    )
)["sha"]
if not re.fullmatch(r"[0-9a-f]{40}", blob_sha):
    raise RuntimeError("invalid output blob SHA")

evidence = {
    "source_blob": SOURCE_BLOB,
    "output_blob": blob_sha,
    "validation": "PASS",
    "bash_syntax": "PASS",
    "runtime_env_precedence": ["root-pm2", "legacy-env", "canonical-env"],
    "required_secrets": ["JWT_SECRET", "DATABASE_URL"],
    "pre_swap_smoke": True,
}
(outdir / "evidence.json").write_text(json.dumps(evidence, indent=2) + "\n")
print(f"VETS_HEROBASE_FINALITY_V3_BLOB={blob_sha}")
