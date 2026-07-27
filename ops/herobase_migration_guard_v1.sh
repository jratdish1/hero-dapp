#!/usr/bin/env bash
set -Eeuo pipefail

: "${VDS_HOST:?VDS_HOST is required}"
: "${VDS_SSH_KEY:?VDS_SSH_KEY is required}"
: "${RELEASE_SHA:?RELEASE_SHA is required}"

[[ "$VDS_HOST" =~ ^[A-Za-z0-9.-]+$ ]]
[[ "$RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]]

install -m 700 -d "$HOME/.ssh"
umask 077
printf '%s\n' "$VDS_SSH_KEY" > "$HOME/.ssh/vds_guard_key"
ssh-keygen -y -f "$HOME/.ssh/vds_guard_key" >/dev/null
ssh-keyscan -T 15 -t ed25519 "$VDS_HOST" > "$HOME/.ssh/vds_guard_known_hosts" 2>/dev/null
[ -s "$HOME/.ssh/vds_guard_known_hosts" ]
test "$(ssh-keygen -lf "$HOME/.ssh/vds_guard_known_hosts" | awk '{print $2}')" = \
  'SHA256:EdmFXzo/0Tw9jlbH+tNfBGcRGDf1TQu8m0LWiobRXFY'
chmod 600 "$HOME/.ssh/vds_guard_key" "$HOME/.ssh/vds_guard_known_hosts"

cleanup_guard() {
  rm -f "$HOME/.ssh/vds_guard_key" "$HOME/.ssh/vds_guard_known_hosts"
}
trap cleanup_guard EXIT

set +e
ssh \
  -i "$HOME/.ssh/vds_guard_key" \
  -o BatchMode=yes \
  -o ConnectTimeout=15 \
  -o ServerAliveInterval=10 \
  -o ServerAliveCountMax=2 \
  -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$HOME/.ssh/vds_guard_known_hosts" \
  "root@$VDS_HOST" \
  bash -s -- "$RELEASE_SHA" <<'VDS'
set -Eeuo pipefail
RELEASE_SHA="$1"
ssh \
  -o BatchMode=yes \
  -o ConnectTimeout=15 \
  -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=yes \
  vps1 \
  bash -s -- "$RELEASE_SHA" <<'VPS1'
set -Eeuo pipefail
RELEASE_SHA="$1"
DEPLOY_USER='hero-deploy'
CANONICAL='/var/www/hero-dapp'
HEALTH='/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D'
USER_HOME="/home/$DEPLOY_USER"
USER_BIN="$USER_HOME/.local/bin"

id "$DEPLOY_USER" >/dev/null
test -d "$CANONICAL/.git"
test "$(stat -c '%U' "$CANONICAL")" = "$DEPLOY_USER"
test "$(cd "$CANONICAL" && git rev-parse HEAD)" = "$RELEASE_SHA"
test -z "$(cd "$CANONICAL" && git status --porcelain=v1 --untracked-files=all)"
systemctl is-active --quiet pm2-hero-deploy.service
runuser -u "$DEPLOY_USER" -- env \
  HOME="$USER_HOME" \
  PM2_HOME="$USER_HOME/.pm2" \
  PATH="$USER_BIN:/usr/local/bin:/usr/bin:/bin" \
  pm2 jlist \
  | EXPECTED_SHA="$RELEASE_SHA" node -e '
    let input = "";
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const app = JSON.parse(input).find((item) => item.name === "hero-dapp");
      const release = app?.pm2_env?.env?.HERO_RELEASE_SHA ?? app?.pm2_env?.HERO_RELEASE_SHA;
      if (app?.pm2_env?.status !== "online" || release !== process.env.EXPECTED_SHA) process.exit(1);
    });'
root_state="$(pm2 jlist | node -e '
  let input = "";
  process.stdin.on("data", (chunk) => { input += chunk; });
  process.stdin.on("end", () => {
    const app = JSON.parse(input).find((item) => item.name === "hero-dapp");
    process.stdout.write(app?.pm2_env?.status || "absent");
  });')"
test "$root_state" != online
response="$(curl --fail --silent --show-error --connect-timeout 5 --max-time 15 \
  "https://herobase.io$HEALTH")"
grep -q '"ok":true' <<<"$response"
grep -q "\"releaseSha\":\"$RELEASE_SHA\"" <<<"$response"
printf 'CANONICAL_MIGRATION_STATE=ALREADY_COMPLETE\n'
VPS1
VDS
guard_status=$?
set -e

cleanup_guard
trap - EXIT

if [ "$guard_status" -eq 0 ]; then
  printf 'VETS_CANONICAL_MIGRATION_COMPLETE_V3\n'
  exit 0
fi

chmod 700 ops/herobase_vps1_migration_v3.sh
exec ops/herobase_vps1_migration_v3.sh
