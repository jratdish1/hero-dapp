#!/usr/bin/env bash
set -Eeuo pipefail

: "${VDS_HOST:?VDS_HOST is required}"
: "${VDS_SSH_KEY:?VDS_SSH_KEY is required}"
: "${VPS1_HOST:?VPS1_HOST is required}"
: "${CF_ZONE_ID:?CF_ZONE_ID is required}"
: "${RELEASE_SHA:?RELEASE_SHA is required}"
: "${AUTH_CI_RUN_ID:?AUTH_CI_RUN_ID is required}"
: "${AUTH_SECURITY_RUN_ID:?AUTH_SECURITY_RUN_ID is required}"
: "${TARGET_REPOSITORY:?TARGET_REPOSITORY is required}"

[[ "$VDS_HOST" =~ ^[A-Za-z0-9.-]+$ ]]
[[ "$VPS1_HOST" =~ ^[A-Za-z0-9.-]+$ ]]
[[ "$CF_ZONE_ID" =~ ^[0-9a-fA-F]{32}$ ]]
[[ "$RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$AUTH_CI_RUN_ID" =~ ^[0-9]+$ ]]
[[ "$AUTH_SECURITY_RUN_ID" =~ ^[0-9]+$ ]]

install -m 700 -d "$HOME/.ssh"
umask 077
printf '%s\n' "$VDS_SSH_KEY" > "$HOME/.ssh/vds_key"
ssh-keygen -y -f "$HOME/.ssh/vds_key" >/dev/null
ssh-keyscan -T 15 -t ed25519 "$VDS_HOST" > "$HOME/.ssh/vds_known_hosts" 2>/dev/null
[ -s "$HOME/.ssh/vds_known_hosts" ]
test "$(ssh-keygen -lf "$HOME/.ssh/vds_known_hosts" | awk '{print $2}')" = \
  'SHA256:EdmFXzo/0Tw9jlbH+tNfBGcRGDf1TQu8m0LWiobRXFY'
chmod 600 "$HOME/.ssh/vds_key" "$HOME/.ssh/vds_known_hosts"

cleanup_runner() {
  rm -f "$HOME/.ssh/vds_key" "$HOME/.ssh/vds_known_hosts"
}
trap cleanup_runner EXIT

ssh \
  -i "$HOME/.ssh/vds_key" \
  -o BatchMode=yes \
  -o ConnectTimeout=15 \
  -o ServerAliveInterval=10 \
  -o ServerAliveCountMax=2 \
  -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$HOME/.ssh/vds_known_hosts" \
  "root@$VDS_HOST" \
  bash -s -- \
    "$TARGET_REPOSITORY" "$VPS1_HOST" "$CF_ZONE_ID" "$RELEASE_SHA" \
    "$AUTH_CI_RUN_ID" "$AUTH_SECURITY_RUN_ID" <<'VDS'
set -Eeuo pipefail

REPO="$1"
VPS1_HOST="$2"
CF_ZONE_ID="$3"
RELEASE_SHA="$4"
AUTH_CI_RUN_ID="$5"
AUTH_SECURITY_RUN_ID="$6"
DEPLOY_USER='hero-deploy'
TMPDIR_VETS="$(mktemp -d)"

cleanup_vds() {
  chmod -R u+rwX "$TMPDIR_VETS" 2>/dev/null || true
  rm -rf "$TMPDIR_VETS"
  unset cf_token candidate global_email global_key
}
trap cleanup_vds EXIT
umask 077

for command_name in gh jq curl ssh ssh-keygen python3; do
  command -v "$command_name" >/dev/null
done
test "$(gh api user --jq .login)" = 'jratdish1'
test "$(gh api "repos/$REPO" --jq .full_name)" = "$REPO"

VPS1_ALIAS_HOST="$(ssh -G vps1 | awk '$1 == "hostname" {print $2; exit}')"
test "$VPS1_ALIAS_HOST" = "$VPS1_HOST"
ssh-keygen -F "$VPS1_ALIAS_HOST" -f /root/.ssh/known_hosts >/dev/null
ssh \
  -o BatchMode=yes \
  -o ConnectTimeout=15 \
  -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=yes \
  vps1 'test "$(id -u)" = 0 && hostname' >/dev/null

# Read candidate Cloudflare credentials from existing protected host files.
# Values are written only to a root-only temporary JSON file and never printed.
python3 - "$TMPDIR_VETS/cloudflare-candidates.json" <<'PY'
from pathlib import Path
import json
import re
import sys

output = Path(sys.argv[1])
token_names = {
    'CF_API_TOKEN', 'CLOUDFLARE_API_TOKEN', 'CF_TOKEN', 'CLOUDFLARE_TOKEN'
}
email_names = {'CF_EMAIL', 'CLOUDFLARE_EMAIL', 'CF_API_EMAIL'}
key_names = {
    'CF_KEY', 'CLOUDFLARE_KEY', 'CF_GLOBAL_API_KEY',
    'CLOUDFLARE_GLOBAL_API_KEY', 'CLOUDFLARE_API_KEY',
    'CF_API_KEY', 'GLOBAL_API_KEY'
}
result = {'tokens': []}

def add_token(value: str) -> None:
    value = value.strip()
    if value and value not in result['tokens']:
        result['tokens'].append(value)

for path in (
    Path('/root/.vets/herobase_cf_cache_token'),
    Path('/opt/apex-agent/.cf_token_cache'),
    Path('/opt/apex-agent/.cf_token'),
):
    try:
        add_token(path.read_text())
    except OSError:
        pass

for path in (
    Path('/root/.cloudflare_creds'),
    Path('/root/.env_architecture'),
    Path('/opt/apex-agent/.env'),
):
    try:
        text = path.read_text(errors='ignore')
    except OSError:
        continue

    try:
        parsed = json.loads(text)
    except Exception:
        parsed = None
    if isinstance(parsed, dict):
        for name, raw_value in parsed.items():
            value = str(raw_value).strip()
            if name in token_names:
                add_token(value)
            elif name in email_names and value and 'email' not in result:
                result['email'] = value
            elif name in key_names and value and 'key' not in result:
                result['key'] = value

    for line in text.splitlines():
        match = re.match(
            r'^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$',
            line,
        )
        if not match:
            continue
        name, value = match.group(1), match.group(2).strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
            value = value[1:-1]
        if name in token_names:
            add_token(value)
        elif name in email_names and value and 'email' not in result:
            result['email'] = value
        elif name in key_names and value and 'key' not in result:
            result['key'] = value

output.write_text(json.dumps(result))
output.chmod(0o600)
PY

cf_token=''
while IFS= read -r candidate; do
  [ -n "$candidate" ] || continue
  verify_response="$(curl -4 --fail-with-body --silent --show-error \
    --connect-timeout 10 --max-time 30 \
    -H "Authorization: Bearer $candidate" \
    -H 'Content-Type: application/json' \
    https://api.cloudflare.com/client/v4/user/tokens/verify 2>/dev/null || true)"
  zone_response="$(curl -4 --fail-with-body --silent --show-error \
    --connect-timeout 10 --max-time 30 \
    -H "Authorization: Bearer $candidate" \
    -H 'Content-Type: application/json' \
    "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID" 2>/dev/null || true)"
  if jq -e \
       '.success == true and .result.status == "active" and ((.errors // []) | length == 0)' \
       <<<"$verify_response" >/dev/null 2>&1 && \
     jq -e \
       '.success == true and .result.name == "herobase.io" and .result.status == "active" and ((.errors // []) | length == 0)' \
       <<<"$zone_response" >/dev/null 2>&1; then
    cf_token="$candidate"
    break
  fi
done < <(jq -r '.tokens[]?' "$TMPDIR_VETS/cloudflare-candidates.json")
unset candidate verify_response zone_response

if [ -z "$cf_token" ]; then
  global_email="$(jq -r '.email // empty' "$TMPDIR_VETS/cloudflare-candidates.json")"
  global_key="$(jq -r '.key // empty' "$TMPDIR_VETS/cloudflare-candidates.json")"
  [ -n "$global_email" ] && [ -n "$global_key" ] || {
    printf 'BLOCKED_CLOUDFLARE_AUTH_MISSING\n' >&2
    exit 78
  }

  zone_response="$(curl -4 --fail-with-body --silent --show-error \
    --connect-timeout 10 --max-time 30 \
    -H "X-Auth-Email: $global_email" \
    -H "X-Auth-Key: $global_key" \
    -H 'Content-Type: application/json' \
    "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID")"
  jq -e \
    '.success == true and .result.name == "herobase.io" and .result.status == "active" and ((.errors // []) | length == 0)' \
    <<<"$zone_response" >/dev/null

  permission_response="$(curl -4 --fail-with-body --silent --show-error \
    --connect-timeout 10 --max-time 30 \
    -H "X-Auth-Email: $global_email" \
    -H "X-Auth-Key: $global_key" \
    -H 'Content-Type: application/json' \
    https://api.cloudflare.com/client/v4/user/tokens/permission_groups)"
  purge_group_id="$(jq -r \
    '[.result[] | select((.name | ascii_downcase) == "cache purge")] | first.id // empty' \
    <<<"$permission_response")"
  [ -n "$purge_group_id" ] || {
    printf 'BLOCKED_CLOUDFLARE_CACHE_PURGE_PERMISSION_GROUP\n' >&2
    exit 78
  }

  token_payload="$(jq -nc \
    --arg name "HeroBase deploy cache purge $(date -u +%Y%m%dT%H%M%SZ)" \
    --arg zone "$CF_ZONE_ID" \
    --arg group "$purge_group_id" \
    '{
      name: $name,
      policies: [{
        effect: "allow",
        resources: {("com.cloudflare.api.account.zone." + $zone): "*"},
        permission_groups: [{id: $group}]
      }]
    }')"
  create_response="$(curl -4 --fail-with-body --silent --show-error \
    --connect-timeout 10 --max-time 60 \
    -X POST \
    -H "X-Auth-Email: $global_email" \
    -H "X-Auth-Key: $global_key" \
    -H 'Content-Type: application/json' \
    https://api.cloudflare.com/client/v4/user/tokens \
    --data "$token_payload")"
  jq -e \
    '.success == true and ((.errors // []) | length == 0) and (.result.value | length > 20)' \
    <<<"$create_response" >/dev/null
  cf_token="$(jq -r '.result.value' <<<"$create_response")"
  install -d -m 700 /root/.vets
  printf '%s' "$cf_token" > /root/.vets/herobase_cf_cache_token
  chmod 600 /root/.vets/herobase_cf_cache_token
  printf 'CLOUDFLARE_TOKEN_SOURCE=CREATED_SCOPED_ZONE_CACHE_PURGE\n'
  unset global_email global_key zone_response permission_response
  unset purge_group_id token_payload create_response
else
  printf 'CLOUDFLARE_TOKEN_SOURCE=REUSED_VALID_BEARER\n'
fi

verify_response="$(curl -4 --fail-with-body --silent --show-error \
  --connect-timeout 10 --max-time 30 \
  -H "Authorization: Bearer $cf_token" \
  -H 'Content-Type: application/json' \
  https://api.cloudflare.com/client/v4/user/tokens/verify)"
jq -e \
  '.success == true and .result.status == "active" and ((.errors // []) | length == 0)' \
  <<<"$verify_response" >/dev/null
printf 'CLOUDFLARE_TOKEN_VERIFY=PASS\n'
unset verify_response

ssh-keygen -q -t ed25519 -N '' -C 'github-actions-hero-deploy' \
  -f "$TMPDIR_VETS/hero_deploy_key"
public_key="$(cat "$TMPDIR_VETS/hero_deploy_key.pub")"

ssh \
  -o BatchMode=yes \
  -o ConnectTimeout=15 \
  -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=yes \
  vps1 \
  bash -s -- "$DEPLOY_USER" "$public_key" <<'VPS1'
set -Eeuo pipefail
user="$1"
public_key="$2"
if ! id "$user" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$user"
fi
test "$(id -u "$user")" -ge 1000
install -d -m 700 -o "$user" -g "$user" "/home/$user/.ssh"
authorized_keys="/home/$user/.ssh/authorized_keys"
touch "$authorized_keys"
chown "$user:$user" "$authorized_keys"
chmod 600 "$authorized_keys"
temporary="$(mktemp)"
awk '!/github-actions-hero-deploy$/' "$authorized_keys" > "$temporary"
printf '%s\n' "$public_key" >> "$temporary"
install -m 600 -o "$user" -g "$user" "$temporary" "$authorized_keys"
rm -f "$temporary"
printf 'DEPLOY_USER_READY=%s\n' "$user"
VPS1

known_hosts_file="$TMPDIR_VETS/vps1_known_hosts"
ssh-keygen -F "$VPS1_HOST" -f /root/.ssh/known_hosts 2>/dev/null \
  | awk '!/^#/' > "$known_hosts_file"
[ -s "$known_hosts_file" ]
chmod 600 "$known_hosts_file"

ssh \
  -i "$TMPDIR_VETS/hero_deploy_key" \
  -o BatchMode=yes \
  -o ConnectTimeout=15 \
  -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts_file" \
  "$DEPLOY_USER@$VPS1_HOST" \
  'test "$(id -un)" = hero-deploy && hostname' >/dev/null
printf 'DIRECT_DEPLOY_SSH=PASS\n'

printf '%s' "$VPS1_HOST" \
  | gh secret set VPS1_HOST --env production --repo "$REPO"
printf '%s' "$DEPLOY_USER" \
  | gh secret set VPS1_USER --env production --repo "$REPO"
gh secret set VPS1_SSH_KEY --env production --repo "$REPO" \
  < "$TMPDIR_VETS/hero_deploy_key"
gh secret set VPS1_KNOWN_HOSTS --env production --repo "$REPO" \
  < "$known_hosts_file"
printf '%s' "$cf_token" \
  | gh secret set CF_API_TOKEN --env production --repo "$REPO"
printf '%s' "$CF_ZONE_ID" \
  | gh secret set CF_ZONE_ID --env production --repo "$REPO"
unset cf_token

required='CF_API_TOKEN CF_ZONE_ID VPS1_HOST VPS1_KNOWN_HOSTS VPS1_SSH_KEY VPS1_USER'
actual="$(gh secret list --env production --repo "$REPO" --json name \
  --jq 'map(.name) | sort | join(" ")')"
test "$actual" = "$required"
printf 'PRODUCTION_SECRET_NAMES=%s\n' "$actual"
printf 'RELEASE_SHA=%s\n' "$RELEASE_SHA"
printf 'AUTHORIZED_CI_RUN=%s\n' "$AUTH_CI_RUN_ID"
printf 'AUTHORIZED_SECURITY_RUN=%s\n' "$AUTH_SECURITY_RUN_ID"
printf 'VETS_SECRET_PREFLIGHT_READY_V3\n'
VDS
