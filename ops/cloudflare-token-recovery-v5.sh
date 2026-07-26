#!/usr/bin/env bash
set -Eeuo pipefail

: "${CF_ZONE_ID:?}"
[[ "$CF_ZONE_ID" =~ ^[0-9a-fA-F]{32}$ ]]

TARGET='/opt/apex-agent/.cf_token_cache'
install -d -m 700 /opt/apex-agent
WORK="$(mktemp -d /root/vets-cf-token-recovery.XXXXXX)"
trap 'rm -rf "$WORK"; unset CF_TOKEN CF_EMAIL CF_GLOBAL_KEY response zone groups create' EXIT
chmod 700 "$WORK"

verify_bearer() {
  local token="$1" response zone
  response="$(curl -4 --fail-with-body --silent --show-error \
    --connect-timeout 10 --max-time 30 \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    https://api.cloudflare.com/client/v4/user/tokens/verify 2>/dev/null)" || return 1
  jq -e '.success == true and .result.status == "active" and ((.errors // []) | length == 0)' <<<"$response" >/dev/null || return 1
  zone="$(curl -4 --fail-with-body --silent --show-error \
    --connect-timeout 10 --max-time 30 \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID" 2>/dev/null)" || return 1
  jq -e '.success == true and .result.name == "herobase.io" and .result.status == "active" and ((.errors // []) | length == 0)' <<<"$zone" >/dev/null
}

# Reuse a valid bearer token from known protected files if available.
python3 - "$WORK/bearers" <<'PY'
from pathlib import Path
import os, sys
out=Path(sys.argv[1]); out.mkdir(mode=0o700)
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
        key,val=line.split('=',1); key=key.strip().removeprefix('export ').strip(); val=val.strip().strip('"').strip("'")
        if key in names and val: values.append(val)
seen=set(); n=0
for value in values:
    if value in seen: continue
    seen.add(value); n+=1
    f=out/f'candidate-{n:02d}'; f.write_text(value); os.chmod(f,0o600)
PY

for candidate in "$WORK"/bearers/candidate-*; do
  [ -f "$candidate" ] || continue
  CF_TOKEN="$(cat "$candidate")"
  if verify_bearer "$CF_TOKEN"; then
    umask 077
    printf '%s' "$CF_TOKEN" > "$TARGET"
    chmod 600 "$TARGET"
    printf 'VETS_CF_BEARER_RECOVERY=REUSED_VALID_TOKEN\n'
    exit 0
  fi
  unset CF_TOKEN
done

# No valid bearer token: recover legacy account credentials without printing them.
python3 - "$WORK/legacy.json" <<'PY'
from pathlib import Path
import json, os, sys
files=[Path('/root/.cloudflare_creds'),Path('/root/.env_architecture'),Path('/opt/apex-agent/.env'),Path('/opt/apex-agent/config/.env')]
email_names={'CF_EMAIL','CLOUDFLARE_EMAIL','CF_API_EMAIL','CLOUDFLARE_API_EMAIL'}
key_names={'CF_KEY','CF_API_KEY','CLOUDFLARE_API_KEY','CLOUDFLARE_GLOBAL_API_KEY','CF_GLOBAL_API_KEY'}
email=''; key=''
for p in files:
    try:
        if not p.is_file(): continue
        text=p.read_text(errors='ignore')
    except Exception: continue
    for line in text.splitlines():
        line=line.strip()
        if not line or line.startswith('#') or '=' not in line: continue
        name,value=line.split('=',1); name=name.strip().removeprefix('export ').strip(); value=value.strip().strip('"').strip("'")
        if not email and name in email_names and value: email=value
        if not key and name in key_names and value: key=value
Path(sys.argv[1]).write_text(json.dumps({'email':email,'key':key}))
os.chmod(sys.argv[1],0o600)
PY
CF_EMAIL="$(jq -r '.email' "$WORK/legacy.json")"
CF_GLOBAL_KEY="$(jq -r '.key' "$WORK/legacy.json")"
[ -n "$CF_EMAIL" ] || { echo 'BLOCKED: Cloudflare account email not found in protected host files' >&2; exit 78; }
[ -n "$CF_GLOBAL_KEY" ] || { echo 'BLOCKED: Cloudflare global API key not found in protected host files' >&2; exit 78; }

legacy_get() {
  curl -4 --fail-with-body --silent --show-error \
    --connect-timeout 10 --max-time 30 \
    -H "X-Auth-Email: $CF_EMAIL" \
    -H "X-Auth-Key: $CF_GLOBAL_KEY" \
    -H 'Content-Type: application/json' "$1"
}
legacy_post() {
  curl -4 --fail-with-body --silent --show-error \
    --connect-timeout 10 --max-time 30 -X POST \
    -H "X-Auth-Email: $CF_EMAIL" \
    -H "X-Auth-Key: $CF_GLOBAL_KEY" \
    -H 'Content-Type: application/json' "$1" --data "$2"
}

response="$(legacy_get https://api.cloudflare.com/client/v4/user)"
jq -e '.success == true and ((.errors // []) | length == 0)' <<<"$response" >/dev/null
zone="$(legacy_get "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID")"
jq -e '.success == true and .result.name == "herobase.io" and .result.status == "active" and ((.errors // []) | length == 0)' <<<"$zone" >/dev/null

groups="$(legacy_get https://api.cloudflare.com/client/v4/user/tokens/permission_groups)"
jq -e '.success == true and ((.errors // []) | length == 0)' <<<"$groups" >/dev/null
zone_read_id="$(jq -r '[.result[] | select((.name | ascii_downcase) == "zone read")] | first.id // empty' <<<"$groups")"
cache_purge_id="$(jq -r '[.result[] | select((.name | ascii_downcase) == "cache purge" or (.name | ascii_downcase) == "zone cache purge")] | first.id // empty' <<<"$groups")"
[[ "$zone_read_id" =~ ^[0-9a-fA-F-]{16,}$ ]] || { echo 'BLOCKED: Zone Read permission group not found' >&2; exit 78; }
[[ "$cache_purge_id" =~ ^[0-9a-fA-F-]{16,}$ ]] || { echo 'BLOCKED: Cache Purge permission group not found' >&2; exit 78; }

resource="com.cloudflare.api.account.zone.$CF_ZONE_ID"
name="VETS HeroBase cache purge $(date -u +%Y%m%dT%H%M%SZ)"
payload="$(jq -nc \
  --arg name "$name" \
  --arg resource "$resource" \
  --arg zone_read "$zone_read_id" \
  --arg cache_purge "$cache_purge_id" \
  '{name:$name,policies:[{effect:"allow",resources:{($resource):"*"},permission_groups:[{id:$zone_read},{id:$cache_purge}]}]}')"
set +e
create="$(legacy_post https://api.cloudflare.com/client/v4/user/tokens "$payload" 2>"$WORK/create.err")"
create_status=$?
set -e
if [ "$create_status" -ne 0 ] || ! jq -e '.success == true and ((.errors // []) | length == 0) and (.result.value | type == "string" and length > 20)' <<<"${create:-{}}" >/dev/null 2>&1; then
  printf 'Cloudflare token creation failed. Sanitized errors: ' >&2
  jq -c '{success,errors:[(.errors // [])[] | {code,message}],messages:[(.messages // [])[] | {code,message}]}' <<<"${create:-{}}" >&2 || true
  exit 78
fi
CF_TOKEN="$(jq -r '.result.value' <<<"$create")"
verify_bearer "$CF_TOKEN"
umask 077
printf '%s' "$CF_TOKEN" > "$TARGET"
chmod 600 "$TARGET"
printf 'VETS_CF_BEARER_RECOVERY=CREATED_SCOPED_TOKEN\n'
