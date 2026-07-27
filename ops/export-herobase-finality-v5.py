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
SOURCE_BLOB = "4b09ff4b2d408d9a1befaf0b3f763ed6da200772"


def request(url: str, *, data: bytes | None = None, method: str = "GET") -> bytes:
    req = Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "VETS-HeroBase-Finality-v5-Exporter",
        },
    )
    with urlopen(req, timeout=60) as response:
        return response.read()


payload = json.loads(
    request(f"https://api.github.com/repos/{REPOSITORY}/git/blobs/{SOURCE_BLOB}")
)
if payload.get("encoding") != "base64":
    raise RuntimeError("unexpected source blob encoding")
source = base64.b64decode(payload["content"]).decode()

replacements = [
    (
        "ROOT_PM2_HAD_APP=false; NEW_PM2_STARTED=false; CANONICAL_SWAPPED=false; OLD_CANONICAL=''; SMOKE_PID=''",
        "ROOT_PM2_HAD_APP=false; NEW_PM2_STARTED=false; CANONICAL_SWAPPED=false; OLD_CANONICAL=''; SMOKE_PID=''; COREPACK_SHIM_INSTALLED=false; COREPACK_BACKUP_PRESENT=false",
        "state",
    ),
    (
        """    if [ "$CANONICAL_SWAPPED" = true ] && [ -n "$OLD_CANONICAL" ] && [ -d "$OLD_CANONICAL" ]; then [ -d "$APP_DIR" ] && mv "$APP_DIR" "$FAILED" || true; mv "$OLD_CANONICAL" "$APP_DIR" || true; fi
    printf 'VETS_HOST_PREP_ROLLBACK_COMPLETED=true\\n'; exit "$status"
""",
        """    if [ "$CANONICAL_SWAPPED" = true ] && [ -n "$OLD_CANONICAL" ] && [ -d "$OLD_CANONICAL" ]; then [ -d "$APP_DIR" ] && mv "$APP_DIR" "$FAILED" || true; mv "$OLD_CANONICAL" "$APP_DIR" || true; fi
    if [ "$COREPACK_SHIM_INSTALLED" = true ]; then
      rm -f /usr/local/bin/corepack
      if [ "$COREPACK_BACKUP_PRESENT" = true ] && [ -e "$BACKUP/corepack.pre" ]; then cp -a "$BACKUP/corepack.pre" /usr/local/bin/corepack; fi
    fi
    printf 'VETS_HOST_PREP_ROLLBACK_COMPLETED=true\\n'; exit "$status"
""",
        "rollback-corepack",
    ),
    (
        """    real_corepack="$(readlink -f "$(command -v corepack)")"; test "$real_corepack" != /usr/local/bin/corepack
    cat > /usr/local/bin/corepack <<EOF
""",
        """    real_corepack="$(readlink -f "$(command -v corepack)")"; test "$real_corepack" != /usr/local/bin/corepack
    if [ -e /usr/local/bin/corepack ] || [ -L /usr/local/bin/corepack ]; then
      cp -a /usr/local/bin/corepack "$BACKUP/corepack.pre"
      COREPACK_BACKUP_PRESENT=true
    fi
    cat > /usr/local/bin/corepack <<EOF
""",
        "corepack-backup",
    ),
    (
        """    chmod 755 /usr/local/bin/corepack
    runuser -u "$DEPLOY_USER" -- env HOME="/home/$DEPLOY_USER" bash -c 'corepack enable && corepack prepare pnpm@10.34.4 --activate && test "$(pnpm --version)" = 10.34.4'
""",
        """    chmod 755 /usr/local/bin/corepack
    COREPACK_SHIM_INSTALLED=true
    runuser -u "$DEPLOY_USER" -- env HOME="/home/$DEPLOY_USER" bash -c 'corepack enable && corepack prepare pnpm@10.34.4 --activate && test "$(pnpm --version)" = 10.34.4'
""",
        "corepack-state",
    ),
    (
        """gh api "repos/$REPO/issues/$TRACKER_ISSUE/comments" -f body="$prep" >/dev/null
command="VETS DEPLOY $TARGET_SHA"
comments="$(gh api --paginate "repos/$REPO/issues/$TRACKER_ISSUE/comments?per_page=100" --slurp | jq 'add')"
count="$(jq -r --arg body "$command" '[.[]|select(.user.login=="jratdish1" and .body==$body)]|length' <<<"$comments")"
if [ "$count" = 0 ]; then command_comment="$(gh api "repos/$REPO/issues/$TRACKER_ISSUE/comments" -f body="$command")"; elif [ "$count" = 1 ]; then command_comment="$(jq -c --arg body "$command" '[.[]|select(.user.login=="jratdish1" and .body==$body)]|.[0]' <<<"$comments")"; else exit 74; fi
""",
        """gh api "repos/$REPO/issues/$TRACKER_ISSUE/comments" -f body="$prep" >/dev/null
test "$(gh api "repos/$REPO/issues/$TRACKER_ISSUE" --jq .state)" = open
command="VETS DEPLOY $TARGET_SHA"
command_comment="$(gh api "repos/$REPO/issues/$TRACKER_ISSUE/comments" -f body="$command")"
""",
        "fresh-owner-command",
    ),
    (
        """ssh_status="${PIPESTATUS[0]}"
set -e
rm -f "$HOME/.ssh/vds_key" "$HOME/.ssh/known_hosts"
exit "$ssh_status"

# The lines below run only on success.
""",
        """ssh_status="${PIPESTATUS[0]}"
set -e
rm -f "$HOME/.ssh/vds_key" "$HOME/.ssh/known_hosts"
if [ "$ssh_status" -ne 0 ]; then
  exit "$ssh_status"
fi

# The lines below run only on success.
""",
        "success-receipt-reachable",
    ),
]

for old, new, name in replacements:
    if source.count(old) != 1:
        raise RuntimeError(f"{name} anchor count was {source.count(old)}")
    source = source.replace(old, new, 1)

required = [
    'PATCH_BRANCH="${PATCH_BRANCH:-fix/dao-ownership-final-20260727}"',
    "COREPACK_SHIM_INSTALLED=false",
    "COREPACK_BACKUP_PRESENT=false",
    "VETS_RUNTIME_ENV_VALIDATED=true",
    "merged JWT_SECRET is absent or shorter than 32 characters",
    "VETS_PRE_SWAP_SMOKE=PASS",
    'test "$(gh api "repos/$REPO/issues/$TRACKER_ISSUE" --jq .state)" = open',
    'if [ "$ssh_status" -ne 0 ]; then',
    "host-finalizer-v2.json",
]
for marker in required:
    if marker not in source:
        raise RuntimeError(f"missing required marker: {marker}")

for stale in [
    'fix/dao-ownership-production-final-20260726',
    'comments="$(gh api --paginate',
    'exit "$ssh_status"\n\n# The lines below run only on success.',
]:
    if stale in source:
        raise RuntimeError(f"stale behavior remains: {stale}")

outdir = Path("finality-export-v5")
outdir.mkdir(exist_ok=True)
output = outdir / "herobase-production-host-finalizer-v5.sh"
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
    request(
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
    "corepack_shim_rollback": True,
    "fresh_owner_command": True,
    "success_receipt_reachable": True,
}
(outdir / "evidence.json").write_text(json.dumps(evidence, indent=2) + "\n")
print(f"VETS_HEROBASE_FINALITY_V5_BLOB={blob_sha}")
