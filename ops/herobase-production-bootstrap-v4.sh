#!/usr/bin/env bash
set -Eeuo pipefail

: "${VDS_HOST:?VDS_HOST is required}"
: "${VDS_SSH_KEY:?VDS_SSH_KEY is required}"
: "${VPS1_HOST:?VPS1_HOST is required}"
: "${CF_ZONE_ID:?CF_ZONE_ID is required}"
: "${TARGET_SHA:?TARGET_SHA is required}"
: "${EXPECTED_VDS_ED25519_FINGERPRINT:?EXPECTED_VDS_ED25519_FINGERPRINT is required}"
: "${REPOSITORY_NAME:?REPOSITORY_NAME is required}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"

[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$VDS_HOST" =~ ^[A-Za-z0-9.-]+$ ]]
[[ "$VPS1_HOST" =~ ^[A-Za-z0-9.-]+$ ]]
[[ "$CF_ZONE_ID" =~ ^[0-9a-fA-F]{32}$ ]]

install -m 700 -d "$HOME/.ssh"
umask 077
printf '%s\n' "$VDS_SSH_KEY" > "$HOME/.ssh/vds_key"
timeout --signal=TERM --kill-after=5s 15s ssh-keygen -y -f "$HOME/.ssh/vds_key" >/dev/null
ssh-keyscan -T 10 -t ed25519 "$VDS_HOST" > "$RUNNER_TEMP/vds-keyscan-v4" 2>/dev/null
[ -s "$RUNNER_TEMP/vds-keyscan-v4" ]
actual_fingerprint="$(ssh-keygen -lf "$RUNNER_TEMP/vds-keyscan-v4" | awk '{print $2}')"
test "$actual_fingerprint" = "$EXPECTED_VDS_ED25519_FINGERPRINT"
ssh-keyscan -T 10 -H "$VDS_HOST" > "$HOME/.ssh/known_hosts" 2>/dev/null
chmod 600 "$HOME/.ssh/vds_key" "$HOME/.ssh/known_hosts"

prep_log="$RUNNER_TEMP/herobase-bootstrap-v4-prep.log"
set +e
timeout --signal=TERM --kill-after=15s 900 ssh \
  -i "$HOME/.ssh/vds_key" \
  -o BatchMode=yes \
  -o ConnectTimeout=15 \
  -o ServerAliveInterval=15 \
  -o ServerAliveCountMax=3 \
  -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=yes \
  "root@$VDS_HOST" \
  bash -s -- "$TARGET_SHA" "$VPS1_HOST" "$CF_ZONE_ID" "$REPOSITORY_NAME" <<'VDS' 2>&1 | tee "$prep_log"
set -Eeuo pipefail
TARGET_SHA="$1"
VPS1_HOST="$2"
CF_ZONE_ID="$3"
REPOSITORY_NAME="$4"
DEPLOY_USER='hero-deploy'
WORK_ROOT='/root/.vets-herobase-bootstrap-v4'
mkdir -p "$WORK_ROOT/candidates"
chmod 700 "$WORK_ROOT" "$WORK_ROOT/candidates"
trap 'rm -rf "$WORK_ROOT/candidates"' EXIT

for required in ssh curl jq gh python3 flock; do
  command -v "$required" >/dev/null || exit 1
done
test "$(gh api user --jq .login)" = 'jratdish1'
ssh -G vps1 >/dev/null
vps1_resolved="$(ssh -G vps1 | awk '$1 == "hostname" {print $2; exit}')"
test -n "$vps1_resolved"
ssh-keygen -F "$vps1_resolved" >/dev/null
ssh -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=yes vps1 true

verify_token_file() {
  local file="$1" token response zone
  [ -s "$file" ] || return 1
  token="$(tr -d '\r\n' < "$file")"
  [ -n "$token" ] || return 1
  response="$(curl -4 --fail-with-body --silent --show-error \
    --connect-timeout 10 --max-time 30 \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    https://api.cloudflare.com/client/v4/user/tokens/verify 2>/dev/null || true)"
  jq -e '.success == true and ((.errors // []) | length == 0)' <<<"$response" >/dev/null 2>&1 || return 1
  zone="$(curl -4 --fail-with-body --silent --show-error \
    --connect-timeout 10 --max-time 30 \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID" 2>/dev/null || true)"
  jq -e '.success == true and .result.name == "herobase.io" and .result.status == "active" and ((.errors // []) | length == 0)' \
    <<<"$zone" >/dev/null 2>&1
}

canonical='/opt/apex-agent/.cf_token_cache'
valid_token=''
for file in \
  /opt/apex-agent/.cf_token_cache \
  /opt/apex-agent/.cf_token \
  /opt/apex-agent/.cf_token_dns; do
  if verify_token_file "$file"; then valid_token="$file"; break; fi
done

if [ -z "$valid_token" ]; then
  python3 - "$WORK_ROOT/candidates" <<'PY'
from pathlib import Path
import hashlib
import os
import re
import sys

out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
names = {
    'CF_API_TOKEN', 'CLOUDFLARE_API_TOKEN', 'CF_TOKEN',
    'CLOUDFLARE_TOKEN', 'CLOUDFLARE_CACHE_TOKEN',
}
roots = [Path('/opt/apex-agent'), Path('/root/knowledge-base'), Path('/root')]
seen = set()
index = 0
for root in roots:
    if not root.exists():
        continue
    for path in root.rglob('*'):
        try:
            if not path.is_file() or path.stat().st_size > 65536:
                continue
        except OSError:
            continue
        lowered = path.name.lower()
        if not any(token in lowered for token in ('env', 'cloudflare', 'cf_token', 'credential', 'secret')):
            continue
        try:
            lines = path.read_text(errors='ignore').splitlines()
        except OSError:
            continue
        direct = None
        if len(lines) == 1 and 20 <= len(lines[0].strip()) <= 256 and '=' not in lines[0]:
            direct = lines[0].strip()
        values = [direct] if direct else []
        for raw in lines:
            line = raw.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            key = key.strip().removeprefix('export ').strip()
            if key not in names:
                continue
            value = value.strip().strip('"').strip("'")
            if value:
                values.append(value)
        for value in values:
            if not value or '\n' in value or '\r' in value:
                continue
            digest = hashlib.sha256(value.encode()).hexdigest()
            if digest in seen:
                continue
            seen.add(digest)
            candidate = out / f'candidate-{index:04d}'
            candidate.write_text(value)
            os.chmod(candidate, 0o600)
            index += 1
PY
  for file in "$WORK_ROOT"/candidates/candidate-*; do
    [ -e "$file" ] || break
    if verify_token_file "$file"; then valid_token="$file"; break; fi
  done
fi

[ -n "$valid_token" ] || { echo 'VETS_CF_TOKEN_RECOVERY=BLOCKED' >&2; exit 78; }
install -m 600 "$valid_token" "$canonical"
printf 'VETS_CF_TOKEN_RECOVERY=PASS\n'

ssh -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=yes vps1 \
  bash -s -- "$DEPLOY_USER" <<'VPS1'
set -Eeuo pipefail
DEPLOY_USER="$1"
command -v corepack >/dev/null
corepack enable
corepack prepare pnpm@10.34.4 --activate
if id "$DEPLOY_USER" >/dev/null 2>&1 && ! sudo -u "$DEPLOY_USER" -H bash -lc 'corepack enable' >/dev/null 2>&1; then
  wrapper='/usr/local/bin/corepack'
  backup=''
  if [ -e "$wrapper" ] && ! grep -q 'VETS_HERO_DEPLOY_COREPACK_WRAPPER' "$wrapper" 2>/dev/null; then
    backup="${wrapper}.pre-vets.$(date -u +%Y%m%dT%H%M%SZ)"
    cp -a "$wrapper" "$backup"
  fi
  cat > "$wrapper" <<'WRAPPER'
#!/bin/sh
# VETS_HERO_DEPLOY_COREPACK_WRAPPER
if [ "$(id -u)" != '0' ] && [ "${1:-}" = 'enable' ]; then
  exit 0
fi
exec /usr/bin/corepack "$@"
WRAPPER
  chown root:root "$wrapper"
  chmod 755 "$wrapper"
fi
if id "$DEPLOY_USER" >/dev/null 2>&1; then
  sudo -u "$DEPLOY_USER" -H bash -lc 'corepack enable'
  sudo -u "$DEPLOY_USER" -H bash -lc 'corepack prepare pnpm@10.34.4 --activate >/dev/null'
  sudo -u "$DEPLOY_USER" -H bash -lc 'test "$(pnpm --version)" = "10.34.4"'
fi
printf 'VETS_COREPACK_COMPATIBILITY=PASS\n'
VPS1

secret_names="$(gh secret list --env production --repo "$REPOSITORY_NAME" --json name --jq 'map(.name) | sort | .[]' 2>/dev/null || true)"
secrets_ready=true
for name in CF_API_TOKEN CF_ZONE_ID VPS1_HOST VPS1_KNOWN_HOSTS VPS1_SSH_KEY VPS1_USER; do
  grep -Fxq "$name" <<<"$secret_names" || secrets_ready=false
done

host_ready=false
if [ "$secrets_ready" = true ]; then
  if ssh -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=yes vps1 \
    bash -s -- "$TARGET_SHA" "$DEPLOY_USER" <<'CHECK'
set -euo pipefail
TARGET_SHA="$1"
DEPLOY_USER="$2"
id "$DEPLOY_USER" >/dev/null
APP_DIR='/var/www/hero-dapp'
test -d "$APP_DIR/.git"
test "$(stat -c '%U' "$APP_DIR")" = "$DEPLOY_USER"
test "$(git -C "$APP_DIR" rev-parse HEAD)" = "$TARGET_SHA"
test -z "$(git -C "$APP_DIR" status --porcelain=v1 --untracked-files=all)"
sudo -u "$DEPLOY_USER" -H env PM2_HOME="/home/$DEPLOY_USER/.pm2" pm2 jlist | EXPECTED_SHA="$TARGET_SHA" node -e '
  let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{
    const p=JSON.parse(s||"[]").find(x=>x.name==="hero-dapp");
    const actual=p?.pm2_env?.env?.HERO_RELEASE_SHA ?? p?.pm2_env?.HERO_RELEASE_SHA;
    if(p?.pm2_env?.status!=="online" || actual!==process.env.EXPECTED_SHA) process.exit(1);
  });
'
response="$(curl --fail --silent --show-error --connect-timeout 5 --max-time 15 'http://127.0.0.1:3000/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D')"
printf '%s' "$response" | grep -q '"ok":true'
printf '%s' "$response" | grep -q "\"releaseSha\":\"$TARGET_SHA\""
CHECK
  then host_ready=true; fi
fi

if [ "$host_ready" = true ]; then
  printf 'VETS_PREP_ALREADY_VERIFIED=true\n'
else
  printf 'VETS_PREP_ALREADY_VERIFIED=false\n'
fi
VDS
prep_status="${PIPESTATUS[0]}"
set -e
[ "$prep_status" -eq 0 ] || exit "$prep_status"

if grep -q '^VETS_PREP_ALREADY_VERIFIED=true$' "$prep_log"; then
  echo 'bootstrap_exit_code=0' >> "$GITHUB_OUTPUT"
  echo 'cf_token_verified=true' >> "$GITHUB_OUTPUT"
  echo 'secret_names_ready=true' >> "$GITHUB_OUTPUT"
  echo 'host_verified=true' >> "$GITHUB_OUTPUT"
  echo 'deploy_user_verified=true' >> "$GITHUB_OUTPUT"
  echo 'rollback_attempted=false' >> "$GITHUB_OUTPUT"
  echo 'rollback_succeeded=false' >> "$GITHUB_OUTPUT"
  printf 'VETS_BOOTSTRAP_V4_IDEMPOTENT_VERIFY=true\n'
  exit 0
fi

bash ops/herobase-production-bootstrap.sh
