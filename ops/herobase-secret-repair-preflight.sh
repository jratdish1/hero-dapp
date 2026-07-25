#!/usr/bin/env bash
set -Eeuo pipefail

# Read-only discovery for the active HeroBase production release gate.
# It never prints private keys, Cloudflare token values, passwords, or GitHub tokens.

VDSM_TAILSCALE="${VDSM_TAILSCALE:-100.122.125.32}"
VDSM_PUBLIC="${VDSM_PUBLIC:-147.93.183.207}"
VPS1_PUBLIC="${VPS1_PUBLIC:-62.146.175.67}"
HERObase_ZONE_ID="${HERObase_ZONE_ID:-1f894ca8151cd3419688c8a87ce9f5e3}"
SSH_BASE=(-o BatchMode=yes -o ConnectTimeout=12 -o ServerAliveInterval=10 -o ServerAliveCountMax=2)

choose_vdsm() {
  local candidate
  for candidate in "$VDSM_TAILSCALE" "$VDSM_PUBLIC"; do
    if ssh "${SSH_BASE[@]}" "root@$candidate" 'test "$(hostname)" != ""' >/dev/null 2>&1; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  return 1
}

printf '\n=== VETS HEROBASE SECRET REPAIR PREFLIGHT ===\n'
printf 'local_host=%s\n' "$(hostname)"
printf 'local_user=%s\n' "$(id -un)"
printf 'utc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if ! VDSM_HOST="$(choose_vdsm)"; then
  printf 'vdsm_route=BLOCKED\n'
  printf 'reason=no_batch_ssh_route_to_%s_or_%s\n' "$VDSM_TAILSCALE" "$VDSM_PUBLIC"
  exit 20
fi
printf 'vdsm_route=PASS\n'
printf 'vdsm_host=%s\n' "$VDSM_HOST"

ssh "${SSH_BASE[@]}" "root@$VDSM_HOST" bash -s -- "$VPS1_PUBLIC" "$HERObase_ZONE_ID" <<'REMOTE'
set -Eeuo pipefail
VPS1_PUBLIC="$1"
ZONE_ID="$2"

printf '\n=== VDS-M ===\n'
printf 'hostname=%s\n' "$(hostname)"
printf 'vps1_alias='; if ssh -G vps1 >/dev/null 2>&1; then echo PASS; else echo MISSING; fi
printf 'vps1_key='; if [ -s /root/.ssh/contabo_vds ]; then echo PRESENT; else echo MISSING; fi
printf 'cache_token='; if [ -s /opt/apex-agent/.cf_token_cache ]; then echo PRESENT; else echo MISSING; fi

if [ -s /opt/apex-agent/.cf_token_cache ]; then
  CF_TOKEN="$(cat /opt/apex-agent/.cf_token_cache)"
  verify="$(curl -4 --fail --silent --show-error --connect-timeout 10 --max-time 30 \
    -H "Authorization: Bearer $CF_TOKEN" \
    https://api.cloudflare.com/client/v4/user/tokens/verify || true)"
  if jq -e '.success == true and .result.status == "active" and ((.errors // []) | length == 0)' \
    >/dev/null 2>&1 <<<"$verify"; then
    echo 'cache_token_verify=PASS'
  else
    echo 'cache_token_verify=FAIL'
  fi
  zone="$(curl -4 --fail --silent --show-error --connect-timeout 10 --max-time 30 \
    -H "Authorization: Bearer $CF_TOKEN" \
    "https://api.cloudflare.com/client/v4/zones/$ZONE_ID" || true)"
  if jq -e '.success == true and .result.name == "herobase.io" and .result.status == "active" and ((.errors // []) | length == 0)' \
    >/dev/null 2>&1 <<<"$zone"; then
    echo 'herobase_zone_read=PASS'
  else
    echo 'herobase_zone_read=FAIL'
  fi
  unset CF_TOKEN verify zone
fi

printf '\n=== VPS1 READ-ONLY DISCOVERY ===\n'
ssh -o BatchMode=yes -o ConnectTimeout=12 -o ServerAliveInterval=10 -o ServerAliveCountMax=2 \
  vps1 bash -s -- "$VPS1_PUBLIC" <<'VPS1'
set -Eeuo pipefail
VPS1_PUBLIC="$1"
printf 'hostname=%s\n' "$(hostname)"
printf 'public_ip_expected=%s\n' "$VPS1_PUBLIC"
printf 'root_pm2_hero=' 
if command -v pm2 >/dev/null 2>&1 && pm2 jlist 2>/dev/null | jq -e '.[] | select(.name == "hero-dapp")' >/dev/null; then
  echo PRESENT
  pm2 jlist | jq -r '.[] | select(.name == "hero-dapp") |
    "pm2_name=" + .name,
    "pm2_status=" + (.pm2_env.status // "unknown"),
    "pm2_cwd=" + (.pm2_env.pm_cwd // "unknown"),
    "pm2_script=" + (.pm2_env.pm_exec_path // "unknown"),
    "pm2_release_sha=" + (.pm2_env.env.HERO_RELEASE_SHA // .pm2_env.HERO_RELEASE_SHA // "unset")'
else
  echo MISSING
fi

for path in /var/www/hero-dapp /root/hero-dapp; do
  if [ -d "$path" ]; then
    printf 'app_path=%s\n' "$path"
    printf 'app_owner=%s\n' "$(stat -c '%U:%G' "$path")"
    printf 'app_symlink=%s\n' "$(test -L "$path" && echo yes || echo no)"
    if [ -d "$path/.git" ]; then
      printf 'git_head=%s\n' "$(git -C "$path" rev-parse HEAD 2>/dev/null || echo unreadable)"
      printf 'git_origin=%s\n' "$(git -C "$path" remote get-url origin 2>/dev/null || echo missing)"
      if [ -z "$(git -C "$path" status --porcelain=v1 --untracked-files=all 2>/dev/null)" ]; then
        echo 'git_clean=yes'
      else
        echo 'git_clean=no'
      fi
    else
      echo 'git_repo=no'
    fi
  fi
done

printf 'candidate_users=' 
getent passwd | awk -F: '$1 ~ /^(deploy|hero|hero-deploy|herobase|www-data)$/ {printf "%s(uid=%s,shell=%s) ",$1,$3,$7}'
echo
printf 'node='; command -v node || true
printf 'corepack='; command -v corepack || true
printf 'pm2='; command -v pm2 || true
printf 'curl='; command -v curl || true
printf 'flock='; command -v flock || true
VPS1
REMOTE

printf '\npreflight=COMPLETE_READ_ONLY\n'
printf 'No secret values were printed. Paste this complete output back into the VETS chat.\n'
