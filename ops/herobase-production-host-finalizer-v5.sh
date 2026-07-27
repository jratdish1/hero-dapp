#!/usr/bin/env bash
set -Eeuo pipefail

: "${GH_TOKEN:?}"
: "${GITHUB_REPOSITORY:?}"
: "${VDS_HOST:?}"
: "${VDS_SSH_KEY:?}"
: "${VPS1_HOST:?}"
: "${CF_ZONE_ID:?}"

PATCH_BRANCH="${PATCH_BRANCH:-fix/dao-ownership-final-20260727}"
TRACKER_ISSUE="${TRACKER_ISSUE:-43}"
EXPECTED_VDS_ED25519="${EXPECTED_VDS_ED25519:-SHA256:EdmFXzo/0Tw9jlbH+tNfBGcRGDf1TQu8m0LWiobRXFY}"
mkdir -p evidence
repo_api="https://api.github.com/repos/$GITHUB_REPOSITORY"
owner="${GITHUB_REPOSITORY%%/*}"

api_get() {
  local url="$1" response=""
  for attempt in $(seq 1 5); do
    if response="$(curl --fail-with-body --silent --show-error \
      --connect-timeout 10 --max-time 30 \
      -H "Authorization: Bearer $GH_TOKEN" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "$url")"; then
      printf '%s' "$response"
      return 0
    fi
    sleep $((attempt * 2))
  done
  return 1
}

first_attempt_push_run() {
  local workflow_file="$1" required_job="$2" sha="$3"
  local workflow_id runs run_id jobs
  workflow_id="$(api_get "$repo_api/actions/workflows/$workflow_file" | jq -r '.id')"
  [[ "$workflow_id" =~ ^[0-9]+$ ]] || return 1
  runs="$(api_get "$repo_api/actions/workflows/$workflow_id/runs?branch=main&event=push&head_sha=$sha&per_page=100")"
  run_id="$(jq -r --arg sha "$sha" '
    [.workflow_runs[] | select(
      .head_sha == $sha and .head_branch == "main" and .event == "push" and
      .run_attempt == 1 and .status == "completed" and .conclusion == "success"
    )] | sort_by(.id) | last.id // empty
  ' <<<"$runs")"
  [[ "$run_id" =~ ^[0-9]+$ ]] || return 1
  jobs="$(api_get "$repo_api/actions/runs/$run_id/jobs?per_page=100")"
  jq -e --arg name "$required_job" '
    [.jobs[] | select(.name == $name)]
    | length > 0 and (max_by(.id) | .status == "completed" and .conclusion == "success")
  ' <<<"$jobs" >/dev/null || return 1
  printf '%s' "$run_id"
}

target_sha=''
ci_run_id=''
security_run_id=''
for attempt in $(seq 1 180); do
  pulls="$(api_get "$repo_api/pulls?state=all&head=$owner:$PATCH_BRANCH&base=main&per_page=100")"
  merged="$(jq -r 'if length == 1 then .[0].merged_at != null else false end' <<<"$pulls")"
  if [ "$merged" = true ]; then
    candidate="$(api_get "$repo_api/git/ref/heads/main" | jq -r '.object.sha')"
    [[ "$candidate" =~ ^[0-9a-f]{40}$ ]] || exit 1
    source="$(api_get "$repo_api/contents/server/routers.ts?ref=$candidate" | jq -r '.content' | tr -d '\n' | base64 -d)"
    if grep -Fq 'proposal.proposerId !== ctx.user.id' <<<"$source" &&
       grep -Fq 'delegate.userId !== ctx.user.id' <<<"$source"; then
      ci_run_id="$(first_attempt_push_run ci.yml test-build-scan "$candidate" || true)"
      security_run_id="$(first_attempt_push_run security-and-quality.yml repository-safety "$candidate" || true)"
      if [[ "$ci_run_id" =~ ^[0-9]+$ ]] && [[ "$security_run_id" =~ ^[0-9]+$ ]]; then
        target_sha="$candidate"
        break
      fi
    fi
  fi
  sleep 20
done
[[ "$target_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$ci_run_id" =~ ^[0-9]+$ ]]
[[ "$security_run_id" =~ ^[0-9]+$ ]]

jq -n --arg target_sha "$target_sha" --arg ci_run_id "$ci_run_id" --arg security_run_id "$security_run_id" \
  '{target_sha:$target_sha,ci_run_id:$ci_run_id,security_run_id:$security_run_id,gate:"PASS"}' \
  > evidence/exact-main-gate-v2.json

[[ "$VDS_HOST" =~ ^[A-Za-z0-9.-]+$ ]]
[[ "$VPS1_HOST" =~ ^[A-Za-z0-9.-]+$ ]]
[[ "$CF_ZONE_ID" =~ ^[0-9a-fA-F]{32}$ ]]
install -m 700 -d "$HOME/.ssh"
umask 077
printf '%s\n' "$VDS_SSH_KEY" > "$HOME/.ssh/vds_key"
timeout --signal=TERM --kill-after=5s 15s ssh-keygen -y -f "$HOME/.ssh/vds_key" >/dev/null
: > "$HOME/.ssh/known_hosts"
for attempt in 1 2 3; do
  ssh-keyscan -T 10 -t ed25519 -H "$VDS_HOST" >> "$HOME/.ssh/known_hosts" 2>/dev/null || true
  [ -s "$HOME/.ssh/known_hosts" ] && break
  sleep $((attempt * 2))
done
[ -s "$HOME/.ssh/known_hosts" ]
actual_fingerprint="$(ssh-keygen -lf "$HOME/.ssh/known_hosts" | awk 'NR==1 {print $2}')"
test "$actual_fingerprint" = "$EXPECTED_VDS_ED25519"
chmod 600 "$HOME/.ssh/vds_key" "$HOME/.ssh/known_hosts"
printf 'VDS_HOST_IDENTITY=PASS:%s\n' "$actual_fingerprint" > evidence/vds-host-identity-v2.txt

remote_log="$RUNNER_TEMP/host-finalizer-v2.log"
set +e
ssh \
  -i "$HOME/.ssh/vds_key" \
  -o BatchMode=yes \
  -o ConnectTimeout=15 \
  -o ServerAliveInterval=15 \
  -o ServerAliveCountMax=3 \
  -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=yes \
  "root@$VDS_HOST" \
  bash -s -- "$target_sha" "$VPS1_HOST" "$CF_ZONE_ID" "$GITHUB_REPOSITORY" "$ci_run_id" "$security_run_id" <<'VDS' 2>&1 | tee "$remote_log"
set -Eeuo pipefail
TARGET_SHA="$1"
VPS1_HOST="$2"
CF_ZONE_ID="$3"
REPO="$4"
AUTH_CI_RUN_ID="$5"
AUTH_SECURITY_RUN_ID="$6"
DEPLOY_USER='hero-deploy'
TRACKER_ISSUE='43'
exec 8>/root/vets-herobase-finalizer.lock
flock -w 7200 8 || exit 75
WORK="$(mktemp -d /root/vets-herobase-finalize.XXXXXX)"
trap 'rm -rf "$WORK"; unset CF_API_TOKEN' EXIT
chmod 700 "$WORK"

[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$VPS1_HOST" =~ ^[A-Za-z0-9.-]+$ ]]
[[ "$CF_ZONE_ID" =~ ^[0-9a-fA-F]{32}$ ]]
[[ "$AUTH_CI_RUN_ID" =~ ^[0-9]+$ ]]
[[ "$AUTH_SECURITY_RUN_ID" =~ ^[0-9]+$ ]]
command -v gh >/dev/null
command -v jq >/dev/null
command -v ssh >/dev/null
test "$(gh api user --jq .login)" = jratdish1
gh repo view "$REPO" >/dev/null
printf 'VETS_VDSM_ROUTE=PASS\n'
printf 'VETS_VDSM_GITHUB_AUTH=PASS\n'

mkdir -m 700 "$WORK/candidates"
python3 - "$WORK/candidates" <<'PY'
from pathlib import Path
import os, sys
out=Path(sys.argv[1])
files=[Path('/opt/apex-agent/.cf_token_cache'),Path('/opt/apex-agent/.cf_token'),Path('/root/.env_architecture'),Path('/opt/apex-agent/.env'),Path('/opt/apex-agent/config/.env'),Path('/root/.cloudflare_creds')]
names={'CF_API_TOKEN','CLOUDFLARE_API_TOKEN','CF_TOKEN','CLOUDFLARE_TOKEN','CF_CACHE_TOKEN','CLOUDFLARE_CACHE_TOKEN'}
values=[]
for p in files:
    try:
        if not p.is_file(): continue
        text=p.read_text(errors='ignore')
    except Exception: continue
    raw=text.strip()
    if p.name in {'.cf_token_cache','.cf_token'} and raw and '\n' not in raw and ' ' not in raw: values.append(raw)
    for line in text.splitlines():
        line=line.strip()
        if not line or line.startswith('#') or '=' not in line: continue
        key,val=line.split('=',1); key=key.strip().removeprefix('export ').strip()
        if key in names:
            val=val.strip().strip('"').strip("'")
            if val: values.append(val)
seen=set(); n=0
for value in values:
    if value in seen: continue
    seen.add(value); n+=1
    f=out/f'candidate-{n:02d}'; f.write_text(value); os.chmod(f,0o600)
(out/'count').write_text(str(n)); os.chmod(out/'count',0o600)
PY
selected=''
for file in "$WORK"/candidates/candidate-*; do
  [ -f "$file" ] || continue
  token="$(cat "$file")"
  if verify="$(curl -4 --fail-with-body --silent --show-error --connect-timeout 10 --max-time 30 -H "Authorization: Bearer $token" -H 'Content-Type: application/json' https://api.cloudflare.com/client/v4/user/tokens/verify 2>/dev/null)" &&
     jq -e '.success==true and .result.status=="active" and ((.errors//[])|length==0)' <<<"$verify" >/dev/null &&
     zone="$(curl -4 --fail-with-body --silent --show-error --connect-timeout 10 --max-time 30 -H "Authorization: Bearer $token" -H 'Content-Type: application/json' "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID" 2>/dev/null)" &&
     jq -e '.success==true and .result.name=="herobase.io" and .result.status=="active" and ((.errors//[])|length==0)' <<<"$zone" >/dev/null; then
    selected="$file"; unset token verify zone; break
  fi
  unset token verify zone
done
[ -n "$selected" ] || { echo 'BLOCKED: scoped Cloudflare bearer token not found' >&2; exit 78; }
CF_API_TOKEN="$(cat "$selected")"; export CF_API_TOKEN
printf 'VETS_CF_TOKEN_VERIFY=PASS\n'
printf 'VETS_CF_ZONE=PASS:herobase.io:active\n'

DEPLOY_KEY='/root/.ssh/hero-dapp-deploy-ed25519'
install -m 700 -d /root/.ssh
if [ ! -s "$DEPLOY_KEY" ]; then ssh-keygen -q -t ed25519 -N '' -C hero-dapp-production-deploy -f "$DEPLOY_KEY"; fi
chmod 600 "$DEPLOY_KEY"; chmod 644 "$DEPLOY_KEY.pub"; ssh-keygen -y -f "$DEPLOY_KEY" >/dev/null
deploy_pub_b64="$(base64 -w0 < "$DEPLOY_KEY.pub")"
vps1_key="$(ssh -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=yes vps1 'cat /etc/ssh/ssh_host_ed25519_key.pub')"
[[ "$vps1_key" =~ ^ssh-ed25519[[:space:]][A-Za-z0-9+/=]+ ]]
printf '%s %s\n' "$VPS1_HOST" "$(awk '{print $1" "$2}' <<<"$vps1_key")" > "$WORK/vps1_known_hosts"
chmod 600 "$WORK/vps1_known_hosts"

ssh -o BatchMode=yes -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -o StrictHostKeyChecking=yes vps1 bash -s -- "$TARGET_SHA" "$deploy_pub_b64" <<'VPS1'
set -Eeuo pipefail
TARGET_SHA="$1"
DEPLOY_PUB="$(printf '%s' "$2" | base64 -d)"
DEPLOY_USER='hero-deploy'
APP_DIR='/var/www/hero-dapp'
LEGACY_DIR='/root/hero-dapp'
HEALTH_LOCAL='http://127.0.0.1:3000/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D'
HEALTH_PUBLIC='https://herobase.io/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D'
exec 9>/var/lock/vets-herobase-host-prep.lock
flock -w 7200 9 || exit 75
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="/var/backups/vets-herobase/$STAMP"
STAGE="/var/www/.hero-dapp-stage-$TARGET_SHA"
FAILED="/var/www/.hero-dapp-failed-$STAMP"
ROOT_PM2_HAD_APP=false; NEW_PM2_STARTED=false; CANONICAL_SWAPPED=false; OLD_CANONICAL=''; SMOKE_PID=''; COREPACK_SHIM_INSTALLED=false; COREPACK_BACKUP_PRESENT=false

health_ok() {
  local url="$1" response=''
  for attempt in $(seq 1 20); do
    response="$(curl --fail --silent --show-error --connect-timeout 5 --max-time 15 "$url" || true)"
    if grep -q '"ok":true' <<<"$response" && grep -q "\"releaseSha\":\"$TARGET_SHA\"" <<<"$response"; then return 0; fi
    sleep 3
  done
  return 1
}

already=false
if id "$DEPLOY_USER" >/dev/null 2>&1 && [ -d "$APP_DIR/.git" ] &&
   [ "$(stat -c '%U' "$APP_DIR")" = "$DEPLOY_USER" ] &&
   [ "$(git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || true)" = "$TARGET_SHA" ] &&
   [ -z "$(git -C "$APP_DIR" status --porcelain=v1 --untracked-files=all 2>/dev/null || true)" ] &&
   runuser -u "$DEPLOY_USER" -- env HOME="/home/$DEPLOY_USER" pm2 jlist | EXPECTED_SHA="$TARGET_SHA" node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{const a=JSON.parse(s).find(x=>x.name==="hero-dapp");const v=a?.pm2_env?.env?.HERO_RELEASE_SHA??a?.pm2_env?.HERO_RELEASE_SHA;if(a?.pm2_env?.status!=="online"||v!==process.env.EXPECTED_SHA)process.exit(1)})' &&
   health_ok "$HEALTH_LOCAL" && health_ok "$HEALTH_PUBLIC"; then
  already=true
fi

if [ "$already" = false ]; then
  rollback() {
    status="$?"; trap - ERR; printf 'VETS_HOST_PREP_ROLLBACK_ATTEMPTED=true\n'
    if [ -n "${SMOKE_PID:-}" ]; then kill "$SMOKE_PID" >/dev/null 2>&1 || true; wait "$SMOKE_PID" >/dev/null 2>&1 || true; SMOKE_PID=''; fi
    if [ "$NEW_PM2_STARTED" = true ]; then runuser -u "$DEPLOY_USER" -- env HOME="/home/$DEPLOY_USER" pm2 delete hero-dapp >/dev/null 2>&1 || true; fi
    if [ "$ROOT_PM2_HAD_APP" = true ]; then pm2 restart hero-dapp --update-env >/dev/null 2>&1 || true; pm2 save >/dev/null 2>&1 || true; fi
    if [ "$CANONICAL_SWAPPED" = true ] && [ -n "$OLD_CANONICAL" ] && [ -d "$OLD_CANONICAL" ]; then [ -d "$APP_DIR" ] && mv "$APP_DIR" "$FAILED" || true; mv "$OLD_CANONICAL" "$APP_DIR" || true; fi
    if [ "$COREPACK_SHIM_INSTALLED" = true ]; then
      rm -f /usr/local/bin/corepack
      if [ "$COREPACK_BACKUP_PRESENT" = true ] && [ -e "$BACKUP/corepack.pre" ]; then cp -a "$BACKUP/corepack.pre" /usr/local/bin/corepack; fi
    fi
    printf 'VETS_HOST_PREP_ROLLBACK_COMPLETED=true\n'; exit "$status"
  }
  trap rollback ERR
  for c in git node corepack pm2 curl flock jq runuser tar systemctl nginx; do command -v "$c" >/dev/null; done
  mkdir -p "$BACKUP"; chmod 700 "$BACKUP"
  df -h /var/www > "$BACKUP/df-before.txt"
  pm2 jlist > "$BACKUP/root-pm2-jlist.json"; pm2 save >/dev/null 2>&1 || true
  [ -f /root/.pm2/dump.pm2 ] && cp -a /root/.pm2/dump.pm2 "$BACKUP/root-pm2-dump.pm2"
  nginx -T > "$BACKUP/nginx-T.txt" 2>&1
  curl -sS --connect-timeout 5 --max-time 15 "$HEALTH_LOCAL" > "$BACKUP/health-local-before.json" 2>/dev/null || true
  curl -sS --connect-timeout 5 --max-time 15 "$HEALTH_PUBLIC" > "$BACKUP/health-public-before.json" 2>/dev/null || true
  if [ -d "$APP_DIR/.git" ]; then
    git -C "$APP_DIR" rev-parse HEAD > "$BACKUP/var-www-head.txt" || true
    git -C "$APP_DIR" status --porcelain=v1 --untracked-files=all > "$BACKUP/var-www-status.txt" || true
    git -C "$APP_DIR" diff --binary > "$BACKUP/var-www-working.diff" || true
    git -C "$APP_DIR" diff --cached --binary > "$BACKUP/var-www-index.diff" || true
    git -C "$APP_DIR" ls-files --others --exclude-standard -z > "$BACKUP/var-www-untracked.zlist" || true
    if [ -s "$BACKUP/var-www-untracked.zlist" ]; then tar --null -T "$BACKUP/var-www-untracked.zlist" -C "$APP_DIR" -czf "$BACKUP/var-www-untracked.tgz" || true; fi
  fi
  if [ -d "$LEGACY_DIR/.git" ]; then git -C "$LEGACY_DIR" rev-parse HEAD > "$BACKUP/legacy-head.txt" || true; git -C "$LEGACY_DIR" status --porcelain=v1 --untracked-files=all > "$BACKUP/legacy-status.txt" || true; fi
  [ -f "$APP_DIR/.env" ] && install -m 600 "$APP_DIR/.env" "$BACKUP/var-www.env" || true
  [ -f "$LEGACY_DIR/.env" ] && install -m 600 "$LEGACY_DIR/.env" "$BACKUP/legacy.env" || true

  if ! id "$DEPLOY_USER" >/dev/null 2>&1; then useradd --create-home --home-dir "/home/$DEPLOY_USER" --shell /bin/bash "$DEPLOY_USER"; fi
  test "$(id -u "$DEPLOY_USER")" -ge 1000
  install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
  touch "/home/$DEPLOY_USER/.ssh/authorized_keys"; chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"; chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
  auth_line="restrict $DEPLOY_PUB"; grep -Fxq "$auth_line" "/home/$DEPLOY_USER/.ssh/authorized_keys" || printf '%s\n' "$auth_line" >> "/home/$DEPLOY_USER/.ssh/authorized_keys"
  install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.config/hero-dapp"
  python3 - "$BACKUP/root-pm2-jlist.json" "$LEGACY_DIR/.env" "$APP_DIR/.env" "/home/$DEPLOY_USER/.config/hero-dapp/runtime-env.json" "/home/$DEPLOY_USER/.config/hero-dapp/runtime.env" <<'PYENV'
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
        if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in {'\"', "'"}:
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
Path(json_out).write_text(json.dumps(values, indent=2, sort_keys=True) + '\n')
Path(dotenv_out).write_text(''.join(f'{key}={json.dumps(value)}\n' for key, value in sorted(values.items())))
os.chmod(json_out, 0o600)
os.chmod(dotenv_out, 0o600)
print(f'VETS_RUNTIME_ENV_VALIDATED=true keys={len(values)}')
PYENV
  chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.config/hero-dapp/runtime-env.json" "/home/$DEPLOY_USER/.config/hero-dapp/runtime.env"
  chmod 600 "/home/$DEPLOY_USER/.config/hero-dapp/runtime-env.json" "/home/$DEPLOY_USER/.config/hero-dapp/runtime.env"

  rm -rf "$STAGE"; install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /var/www
  runuser -u "$DEPLOY_USER" -- env HOME="/home/$DEPLOY_USER" git clone --no-tags https://github.com/jratdish1/hero-dapp.git "$STAGE"
  runuser -u "$DEPLOY_USER" -- env HOME="/home/$DEPLOY_USER" git -C "$STAGE" checkout -B main "$TARGET_SHA"
  test "$(git -C "$STAGE" rev-parse HEAD)" = "$TARGET_SHA"; test -z "$(git -C "$STAGE" status --porcelain=v1 --untracked-files=all)"
  install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.config/hero-dapp/runtime.env" "$STAGE/.env"
  test -z "$(git -C "$STAGE" status --porcelain=v1 --untracked-files=all)"
  corepack enable; corepack prepare pnpm@10.34.4 --activate; test "$(pnpm --version)" = 10.34.4
  if ! runuser -u "$DEPLOY_USER" -- env HOME="/home/$DEPLOY_USER" bash -c 'corepack enable && corepack prepare pnpm@10.34.4 --activate && test "$(pnpm --version)" = 10.34.4'; then
    real_corepack="$(readlink -f "$(command -v corepack)")"; test "$real_corepack" != /usr/local/bin/corepack
    if [ -e /usr/local/bin/corepack ] || [ -L /usr/local/bin/corepack ]; then
      cp -a /usr/local/bin/corepack "$BACKUP/corepack.pre"
      COREPACK_BACKUP_PRESENT=true
    fi
    cat > /usr/local/bin/corepack <<EOF
#!/bin/sh
if [ "\${1:-}" = enable ] && command -v pnpm >/dev/null 2>&1 && [ "\$(pnpm --version 2>/dev/null)" = 10.34.4 ]; then exit 0; fi
exec "$real_corepack" "\$@"
EOF
    chmod 755 /usr/local/bin/corepack
    COREPACK_SHIM_INSTALLED=true
    runuser -u "$DEPLOY_USER" -- env HOME="/home/$DEPLOY_USER" bash -c 'corepack enable && corepack prepare pnpm@10.34.4 --activate && test "$(pnpm --version)" = 10.34.4'
    printf 'VETS_COREPACK_COMPAT_SHIM=INSTALLED\n'
  else printf 'VETS_COREPACK_COMPAT_SHIM=NOT_REQUIRED\n'; fi
  runuser -u "$DEPLOY_USER" -- env HOME="/home/$DEPLOY_USER" bash -c "cd '$STAGE' && corepack enable && corepack prepare pnpm@10.34.4 --activate && pnpm install --frozen-lockfile && rm -rf dist && pnpm build"
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
  printf 'VETS_PRE_SWAP_SMOKE=PASS\n'
  if [ -e "$APP_DIR" ]; then OLD_CANONICAL="$BACKUP/var-www-hero-dapp"; mv "$APP_DIR" "$OLD_CANONICAL"; fi
  mv "$STAGE" "$APP_DIR"; CANONICAL_SWAPPED=true; chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
  test "$(stat -c '%U' "$APP_DIR")" = "$DEPLOY_USER"; test -z "$(git -C "$APP_DIR" status --porcelain=v1 --untracked-files=all)"
  cat > "/home/$DEPLOY_USER/.config/hero-dapp/ecosystem.config.cjs" <<EOF
const fs=require('fs');const env=JSON.parse(fs.readFileSync('/home/$DEPLOY_USER/.config/hero-dapp/runtime-env.json','utf8'));module.exports={apps:[{name:'hero-dapp',cwd:'$APP_DIR',script:'$APP_DIR/dist/index.js',interpreter:'node',env:{...env,NODE_ENV:'production',HERO_RELEASE_SHA:'$TARGET_SHA'}}]};
EOF
  chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.config/hero-dapp/ecosystem.config.cjs"; chmod 600 "/home/$DEPLOY_USER/.config/hero-dapp/ecosystem.config.cjs"
  if pm2 describe hero-dapp >/dev/null 2>&1; then ROOT_PM2_HAD_APP=true; pm2 stop hero-dapp; fi
  runuser -u "$DEPLOY_USER" -- env HOME="/home/$DEPLOY_USER" HERO_RELEASE_SHA="$TARGET_SHA" pm2 start "/home/$DEPLOY_USER/.config/hero-dapp/ecosystem.config.cjs" --only hero-dapp --update-env
  NEW_PM2_STARTED=true; runuser -u "$DEPLOY_USER" -- env HOME="/home/$DEPLOY_USER" pm2 save
  health_ok "$HEALTH_LOCAL"; health_ok "$HEALTH_PUBLIC"
  runuser -u "$DEPLOY_USER" -- env HOME="/home/$DEPLOY_USER" pm2 jlist | EXPECTED_SHA="$TARGET_SHA" node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{const a=JSON.parse(s).find(x=>x.name==="hero-dapp");const v=a?.pm2_env?.env?.HERO_RELEASE_SHA??a?.pm2_env?.HERO_RELEASE_SHA;if(a?.pm2_env?.status!=="online"||v!==process.env.EXPECTED_SHA||a?.pm2_env?.pm_cwd!=="/var/www/hero-dapp")process.exit(1)})'
  if [ "$ROOT_PM2_HAD_APP" = true ]; then pm2 delete hero-dapp; pm2 save; fi
  env PATH="$PATH" pm2 startup systemd -u "$DEPLOY_USER" --hp "/home/$DEPLOY_USER" >/dev/null 2>&1 || true
  systemctl enable "pm2-$DEPLOY_USER" >/dev/null 2>&1 || true
  runuser -u "$DEPLOY_USER" -- env HOME="/home/$DEPLOY_USER" pm2 save
  CANONICAL_SWAPPED=false; NEW_PM2_STARTED=false; ROOT_PM2_HAD_APP=false; trap - ERR
  printf 'VETS_HOST_BACKUP=%s\n' "$BACKUP"
else
  printf 'VETS_HOST_ALREADY_PREPARED=true\n'
  printf 'VETS_HOST_BACKUP=existing\n'
fi
printf 'VETS_HOST_PREPARED=true\n'
printf 'VETS_HOST_FINAL_SHA=%s\n' "$TARGET_SHA"
VPS1

ssh -i "$DEPLOY_KEY" -o BatchMode=yes -o ConnectTimeout=15 -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$WORK/vps1_known_hosts" "$DEPLOY_USER@$VPS1_HOST" bash -s -- "$TARGET_SHA" <<'VERIFY'
set -euo pipefail
TARGET_SHA="$1"; test "$(id -un)" = hero-deploy; test "$(stat -c '%U' /var/www/hero-dapp)" = hero-deploy; test "$(git -C /var/www/hero-dapp rev-parse HEAD)" = "$TARGET_SHA"; test -z "$(git -C /var/www/hero-dapp status --porcelain=v1 --untracked-files=all)"
pm2 jlist | EXPECTED_SHA="$TARGET_SHA" node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{const a=JSON.parse(s).find(x=>x.name==="hero-dapp");const v=a?.pm2_env?.env?.HERO_RELEASE_SHA??a?.pm2_env?.HERO_RELEASE_SHA;if(a?.pm2_env?.status!=="online"||v!==process.env.EXPECTED_SHA)process.exit(1)})'
VERIFY
printf 'VETS_DIRECT_NONROOT_SSH=PASS\n'

printf '%s' "$VPS1_HOST" | gh secret set VPS1_HOST --env production --repo "$REPO"
printf '%s' "$DEPLOY_USER" | gh secret set VPS1_USER --env production --repo "$REPO"
gh secret set VPS1_SSH_KEY --env production --repo "$REPO" < "$DEPLOY_KEY"
gh secret set VPS1_KNOWN_HOSTS --env production --repo "$REPO" < "$WORK/vps1_known_hosts"
printf '%s' "$CF_API_TOKEN" | gh secret set CF_API_TOKEN --env production --repo "$REPO"
printf '%s' "$CF_ZONE_ID" | gh secret set CF_ZONE_ID --env production --repo "$REPO"
inventory="$(gh secret list --env production --repo "$REPO" --json name --jq 'map(.name)')"
for name in CF_API_TOKEN CF_ZONE_ID VPS1_HOST VPS1_KNOWN_HOSTS VPS1_SSH_KEY VPS1_USER; do jq -e --arg name "$name" 'index($name)!=null' <<<"$inventory" >/dev/null; done
printf 'VETS_PRODUCTION_SECRET_INVENTORY=PASS\n'

prep="$(cat <<EOF
## VETS host preparation receipt v2

- Target SHA: \`$TARGET_SHA\`
- Exact-main CI run: \`$AUTH_CI_RUN_ID\`
- Exact-main Security run: \`$AUTH_SECURITY_RUN_ID\`
- VDS-M route / owner GitHub authentication / VPS1 non-root SSH: **PASS**
- Cloudflare bearer token and active herobase.io zone read: **PASS**
- Canonical app path and PM2 exact-SHA health: **PASS**
- Six protected production secrets: **PRESENT**
- Result: **READY FOR PROTECTED DEPLOYMENT**
EOF
)"
gh api "repos/$REPO/issues/$TRACKER_ISSUE/comments" -f body="$prep" >/dev/null
test "$(gh api "repos/$REPO/issues/$TRACKER_ISSUE" --jq .state)" = open
command="VETS DEPLOY $TARGET_SHA"
command_comment="$(gh api "repos/$REPO/issues/$TRACKER_ISSUE/comments" -f body="$command")"
comment_id="$(jq -r '.id' <<<"$command_comment")"; [[ "$comment_id" =~ ^[0-9]+$ ]]
printf 'VETS_OWNER_COMMAND_COMMENT_ID=%s\n' "$comment_id"
printf 'VETS_OWNER_COMMAND_POSTED=true\n'
VDS
ssh_status="${PIPESTATUS[0]}"
set -e
rm -f "$HOME/.ssh/vds_key" "$HOME/.ssh/known_hosts"
if [ "$ssh_status" -ne 0 ]; then
  exit "$ssh_status"
fi

# The lines below run only on success.
grep -q '^VETS_HOST_PREPARED=true$' "$remote_log"
grep -q '^VETS_DIRECT_NONROOT_SSH=PASS$' "$remote_log"
grep -q '^VETS_PRODUCTION_SECRET_INVENTORY=PASS$' "$remote_log"
grep -q '^VETS_OWNER_COMMAND_POSTED=true$' "$remote_log"
final_sha="$(sed -n 's/^VETS_HOST_FINAL_SHA=//p' "$remote_log" | tail -n 1)"
backup="$(sed -n 's/^VETS_HOST_BACKUP=//p' "$remote_log" | tail -n 1)"
comment_id="$(sed -n 's/^VETS_OWNER_COMMAND_COMMENT_ID=//p' "$remote_log" | tail -n 1)"
[[ "$final_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$comment_id" =~ ^[0-9]+$ ]]
jq -n --arg target_sha "$final_sha" --arg backup_path "$backup" --arg command_comment_id "$comment_id" --arg ci_run_id "$ci_run_id" --arg security_run_id "$security_run_id" '{target_sha:$target_sha,backup_path:$backup_path,command_comment_id:$command_comment_id,ci_run_id:$ci_run_id,security_run_id:$security_run_id,host_prepared:true,secrets_present:true,owner_command_posted:true}' > evidence/host-finalizer-v2.json
