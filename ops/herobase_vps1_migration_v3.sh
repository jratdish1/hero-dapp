#!/usr/bin/env bash
set -Eeuo pipefail

: "${VDS_HOST:?VDS_HOST is required}"
: "${VDS_SSH_KEY:?VDS_SSH_KEY is required}"
: "${RELEASE_SHA:?RELEASE_SHA is required}"
: "${AUTH_CI_RUN_ID:?AUTH_CI_RUN_ID is required}"
: "${AUTH_SECURITY_RUN_ID:?AUTH_SECURITY_RUN_ID is required}"
: "${CREDENTIAL_RECEIPT_ID:?CREDENTIAL_RECEIPT_ID is required}"

[[ "$RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$AUTH_CI_RUN_ID" =~ ^[0-9]+$ ]]
[[ "$AUTH_SECURITY_RUN_ID" =~ ^[0-9]+$ ]]
[[ "$CREDENTIAL_RECEIPT_ID" =~ ^[0-9]+$ ]]

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
  bash -s -- "$RELEASE_SHA" "$AUTH_CI_RUN_ID" "$AUTH_SECURITY_RUN_ID" "$CREDENTIAL_RECEIPT_ID" <<'VDS'
set -Eeuo pipefail

RELEASE_SHA="$1"
AUTH_CI_RUN_ID="$2"
AUTH_SECURITY_RUN_ID="$3"
CREDENTIAL_RECEIPT_ID="$4"

ssh \
  -o BatchMode=yes \
  -o ConnectTimeout=15 \
  -o ServerAliveInterval=10 \
  -o ServerAliveCountMax=2 \
  -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=yes \
  vps1 \
  bash -s -- "$RELEASE_SHA" "$AUTH_CI_RUN_ID" "$AUTH_SECURITY_RUN_ID" "$CREDENTIAL_RECEIPT_ID" <<'VPS1'
set -Eeuo pipefail

RELEASE_SHA="$1"
AUTH_CI_RUN_ID="$2"
AUTH_SECURITY_RUN_ID="$3"
CREDENTIAL_RECEIPT_ID="$4"
DEPLOY_USER='hero-deploy'
CANONICAL='/var/www/hero-dapp'
OLD_ACTIVE='/root/hero-dapp'
HEALTH_PATH='/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D'
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="/var/backups/vets-herobase/$STAMP"
STAGE="/var/www/.hero-dapp-stage-${RELEASE_SHA:0:12}"
USER_HOME="/home/$DEPLOY_USER"
USER_BIN="$USER_HOME/.local/bin"

mkdir -p "$BACKUP"
chmod 700 "$BACKUP"
exec > >(tee -a "$BACKUP/migration.log") 2>&1

root_process_exists=false
root_was_online=false
canonical_swapped=false
user_process_started=false

rollback() {
  local status=$?
  trap - ERR
  printf 'VETS_MIGRATION_ROLLBACK_ATTEMPTED=true\n'
  if [ "$user_process_started" = true ]; then
    runuser -u "$DEPLOY_USER" -- env \
      HOME="$USER_HOME" \
      PM2_HOME="$USER_HOME/.pm2" \
      PATH="$USER_BIN:/usr/local/bin:/usr/bin:/bin" \
      pm2 delete hero-dapp >/dev/null 2>&1 || true
  fi
  systemctl stop pm2-hero-deploy.service >/dev/null 2>&1 || true
  if [ "$canonical_swapped" = true ]; then
    if [ -e "$CANONICAL" ]; then
      mv "$CANONICAL" "$CANONICAL.failed.$STAMP" || true
    fi
    if [ -d "$BACKUP/original-var-www-hero-dapp" ]; then
      mv "$BACKUP/original-var-www-hero-dapp" "$CANONICAL" || true
    fi
  fi
  if [ "$root_process_exists" = true ]; then
    pm2 restart hero-dapp --update-env >/dev/null 2>&1 || pm2 resurrect >/dev/null 2>&1 || true
  fi
  printf 'VETS_MIGRATION_ROLLBACK_COMPLETED=true\n'
  exit "$status"
}
trap rollback ERR

[[ "$RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]]
id "$DEPLOY_USER" >/dev/null
for command_name in git node npm corepack pm2 curl jq rsync runuser sshd ss ps; do
  command -v "$command_name" >/dev/null
done

printf 'RELEASE_SHA=%s\n' "$RELEASE_SHA"
printf 'AUTHORIZED_CI_RUN=%s\n' "$AUTH_CI_RUN_ID"
printf 'AUTHORIZED_SECURITY_RUN=%s\n' "$AUTH_SECURITY_RUN_ID"
printf 'CREDENTIAL_RECEIPT_ID=%s\n' "$CREDENTIAL_RECEIPT_ID"

pm2 jlist > "$BACKUP/root-pm2-before.json"
chmod 600 "$BACKUP/root-pm2-before.json"
root_status="$(node - "$BACKUP/root-pm2-before.json" <<'NODE'
const fs = require('fs');
const list = JSON.parse(fs.readFileSync(process.argv[2], 'utf8') || '[]');
const app = list.find((item) => item.name === 'hero-dapp');
process.stdout.write(app?.pm2_env?.status || 'absent');
NODE
)"
root_cwd="$(node - "$BACKUP/root-pm2-before.json" <<'NODE'
const fs = require('fs');
const list = JSON.parse(fs.readFileSync(process.argv[2], 'utf8') || '[]');
const app = list.find((item) => item.name === 'hero-dapp');
process.stdout.write(app?.pm2_env?.pm_cwd || 'unknown');
NODE
)"
printf 'ROOT_PM2_STATUS=%s\n' "$root_status"
printf 'ROOT_PM2_CWD=%s\n' "$root_cwd"
if [ "$root_status" != absent ]; then root_process_exists=true; fi
if [ "$root_status" = online ]; then root_was_online=true; fi

for path in "$OLD_ACTIVE" "$CANONICAL"; do
  label="$(printf '%s' "$path" | tr '/' '_')"
  if [ -d "$path/.git" ]; then
    (
      cd "$path"
      git rev-parse HEAD > "$BACKUP/$label.head"
      git status --porcelain=v1 --untracked-files=all > "$BACKUP/$label.status"
      git diff --binary > "$BACKUP/$label.worktree.patch" || true
      git diff --cached --binary > "$BACKUP/$label.index.patch" || true
    )
  fi
done

# Preserve names-only watchdog evidence without dumping script contents.
{
  crontab -l 2>/dev/null | grep -n 'hero-dapp' || true
  systemctl list-unit-files --no-legend 2>/dev/null | awk 'tolower($1) ~ /hero|pm2/ {print}' || true
} > "$BACKUP/hero-runtime-watchers.txt"
chmod 600 "$BACKUP/hero-runtime-watchers.txt"

rm -rf "$STAGE"
install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$STAGE"
runuser -u "$DEPLOY_USER" -- env HOME="$USER_HOME" \
  git clone --no-tags https://github.com/jratdish1/hero-dapp.git "$STAGE"
runuser -u "$DEPLOY_USER" -- env HOME="$USER_HOME" bash -c \
  "cd '$STAGE' && git checkout --detach '$RELEASE_SHA' && test \"\$(git rev-parse HEAD)\" = '$RELEASE_SHA' && test -z \"\$(git status --porcelain=v1 --untracked-files=all)\""

if [ -d "$OLD_ACTIVE" ]; then
  while IFS= read -r -d '' env_file; do
    rel="${env_file#"$OLD_ACTIVE"/}"
    case "$rel" in
      *.example|*.sample|node_modules/*|dist/*) continue ;;
    esac
    install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$STAGE/$(dirname "$rel")"
    install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$env_file" "$STAGE/$rel"
    printf 'COPIED_ENV_FILE=%s\n' "$rel"
  done < <(find "$OLD_ACTIVE" -maxdepth 2 -type f -name '.env*' -print0)
fi

node - "$BACKUP/root-pm2-before.json" "$BACKUP/runtime-env.json" <<'NODE'
const fs = require('fs');
const [source, output] = process.argv.slice(2);
const list = JSON.parse(fs.readFileSync(source, 'utf8') || '[]');
const app = list.find((item) => item.name === 'hero-dapp');
const env = { ...(app?.pm2_env?.env || {}) };
const blocked = /^(PM2_|SUDO_|SSH_|OLDPWD$|PWD$|HOME$|USER$|LOGNAME$|SHELL$|SHLVL$|_$)/;
for (const key of Object.keys(env)) {
  if (blocked.test(key)) delete env[key];
}
fs.writeFileSync(output, JSON.stringify(env));
fs.chmodSync(output, 0o600);
NODE

install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$USER_BIN"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$USER_HOME/.cache/corepack"
system_corepack="$(command -v corepack)"
system_node="$(command -v node)"
system_npm="$(command -v npm)"
system_pm2="$(command -v pm2)"
cat > "$USER_BIN/corepack" <<EOF_WRAPPER
#!/bin/sh
set -eu
case "\${1:-}" in
  enable)
    shift
    exec env COREPACK_HOME="\${COREPACK_HOME:-\$HOME/.cache/corepack}" "$system_corepack" enable --install-directory "\$HOME/.local/bin" "\$@"
    ;;
  *)
    exec env COREPACK_HOME="\${COREPACK_HOME:-\$HOME/.cache/corepack}" "$system_corepack" "\$@"
    ;;
esac
EOF_WRAPPER
chmod 755 "$USER_BIN/corepack"
chown "$DEPLOY_USER:$DEPLOY_USER" "$USER_BIN/corepack"
ln -sfn "$system_node" "$USER_BIN/node"
ln -sfn "$system_npm" "$USER_BIN/npm"
ln -sfn "$system_pm2" "$USER_BIN/pm2"
chown -h "$DEPLOY_USER:$DEPLOY_USER" "$USER_BIN/node" "$USER_BIN/npm" "$USER_BIN/pm2"

cat > /etc/ssh/sshd_config.d/99-hero-deploy-environment.conf <<EOF_SSHD
Match User $DEPLOY_USER
    SetEnv PATH=$USER_BIN:/usr/local/bin:/usr/bin:/bin
    SetEnv COREPACK_HOME=$USER_HOME/.cache/corepack
    SetEnv PM2_HOME=$USER_HOME/.pm2
EOF_SSHD
sshd -t
systemctl reload ssh || systemctl reload sshd

runuser -u "$DEPLOY_USER" -- env \
  HOME="$USER_HOME" \
  PATH="$USER_BIN:/usr/local/bin:/usr/bin:/bin" \
  COREPACK_HOME="$USER_HOME/.cache/corepack" \
  bash -c 'corepack enable && corepack prepare pnpm@10.34.4 --activate && test "$(pnpm --version)" = 10.34.4'
runuser -u "$DEPLOY_USER" -- env \
  HOME="$USER_HOME" \
  PATH="$USER_BIN:/usr/local/bin:/usr/bin:/bin" \
  COREPACK_HOME="$USER_HOME/.cache/corepack" \
  bash -c "cd '$STAGE' && pnpm install --frozen-lockfile && rm -rf dist && pnpm build"

cat > "$STAGE/dry-run-launcher.cjs" <<'NODE'
const fs = require('fs');
const { spawn } = require('child_process');
const envFile = process.argv[2];
const cwd = process.argv[3];
const releaseSha = process.argv[4];
const pidFile = process.argv[5];
const logFile = process.argv[6];
const inherited = JSON.parse(fs.readFileSync(envFile, 'utf8') || '{}');
const fd = fs.openSync(logFile, 'a', 0o600);
const child = spawn('node', ['dist/index.js'], {
  cwd,
  detached: true,
  env: { ...process.env, ...inherited, PORT: '3301', HERO_RELEASE_SHA: releaseSha },
  stdio: ['ignore', fd, fd],
});
child.unref();
fs.writeFileSync(pidFile, String(child.pid));
NODE
chown "$DEPLOY_USER:$DEPLOY_USER" "$STAGE/dry-run-launcher.cjs"
runuser -u "$DEPLOY_USER" -- env \
  HOME="$USER_HOME" \
  PATH="$USER_BIN:/usr/local/bin:/usr/bin:/bin" \
  node "$STAGE/dry-run-launcher.cjs" \
  "$BACKUP/runtime-env.json" "$STAGE" "$RELEASE_SHA" "$STAGE/dry-run.pid" "$STAGE/dry-run.log"
dry_pid="$(cat "$STAGE/dry-run.pid")"
dry_ok=false
for attempt in $(seq 1 25); do
  response="$(curl --fail --silent --show-error --connect-timeout 3 --max-time 8 \
    "http://127.0.0.1:3301$HEALTH_PATH" 2>/dev/null || true)"
  if grep -q '"ok":true' <<<"$response" && \
     grep -q "\"releaseSha\":\"$RELEASE_SHA\"" <<<"$response"; then
    dry_ok=true
    break
  fi
  sleep 2
done
kill "$dry_pid" >/dev/null 2>&1 || true
wait "$dry_pid" 2>/dev/null || true
test "$dry_ok" = true
printf 'STAGING_HEALTH=PASS\n'

if [ -e "$CANONICAL" ]; then
  mv "$CANONICAL" "$BACKUP/original-var-www-hero-dapp"
fi
mv "$STAGE" "$CANONICAL"
canonical_swapped=true
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$CANONICAL"
test -z "$(cd "$CANONICAL" && git status --porcelain=v1 --untracked-files=all)"

install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$USER_HOME/.config/herobase"
node - "$BACKUP/runtime-env.json" "$USER_HOME/.config/herobase/ecosystem.config.cjs" "$RELEASE_SHA" "$CANONICAL" <<'NODE'
const fs = require('fs');
const [envPath, output, releaseSha, cwd] = process.argv.slice(2);
const env = JSON.parse(fs.readFileSync(envPath, 'utf8') || '{}');
env.HERO_RELEASE_SHA = releaseSha;
env.PORT = '3000';
const config = { apps: [{ name: 'hero-dapp', cwd, script: 'dist/index.js', interpreter: 'node', env }] };
fs.writeFileSync(output, `module.exports = ${JSON.stringify(config)};\n`);
NODE
chown "$DEPLOY_USER:$DEPLOY_USER" "$USER_HOME/.config/herobase/ecosystem.config.cjs"
chmod 600 "$USER_HOME/.config/herobase/ecosystem.config.cjs"

if [ "$root_was_online" = true ]; then
  pm2 stop hero-dapp
fi
runuser -u "$DEPLOY_USER" -- env \
  HOME="$USER_HOME" \
  PM2_HOME="$USER_HOME/.pm2" \
  PATH="$USER_BIN:/usr/local/bin:/usr/bin:/bin" \
  pm2 start "$USER_HOME/.config/herobase/ecosystem.config.cjs" --only hero-dapp
user_process_started=true

live_ok=false
for attempt in $(seq 1 25); do
  response="$(curl --fail --silent --show-error --connect-timeout 3 --max-time 10 \
    "http://127.0.0.1:3000$HEALTH_PATH" 2>/dev/null || true)"
  if grep -q '"ok":true' <<<"$response" && \
     grep -q "\"releaseSha\":\"$RELEASE_SHA\"" <<<"$response"; then
    live_ok=true
    break
  fi
  sleep 3
done
test "$live_ok" = true
runuser -u "$DEPLOY_USER" -- env \
  HOME="$USER_HOME" \
  PM2_HOME="$USER_HOME/.pm2" \
  PATH="$USER_BIN:/usr/local/bin:/usr/bin:/bin" \
  pm2 save

cat > /etc/systemd/system/pm2-hero-deploy.service <<EOF_UNIT
[Unit]
Description=PM2 process manager for HeroBase deployment user
After=network.target

[Service]
Type=forking
User=$DEPLOY_USER
Environment=PATH=$USER_BIN:/usr/local/bin:/usr/bin:/bin
Environment=PM2_HOME=$USER_HOME/.pm2
PIDFile=$USER_HOME/.pm2/pm2.pid
Restart=on-failure
ExecStart=$USER_BIN/pm2 resurrect
ExecReload=$USER_BIN/pm2 reload all
ExecStop=$USER_BIN/pm2 kill

[Install]
WantedBy=multi-user.target
EOF_UNIT
systemctl daemon-reload
systemctl enable pm2-hero-deploy.service
systemctl restart pm2-hero-deploy.service
sleep 5
systemctl is-active --quiet pm2-hero-deploy.service

verify_user_runtime() {
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
  response="$(curl --fail --silent --show-error --connect-timeout 5 --max-time 15 \
    "https://herobase.io$HEALTH_PATH")"
  grep -q '"ok":true' <<<"$response"
  grep -q "\"releaseSha\":\"$RELEASE_SHA\"" <<<"$response"
  listener_pids="$(ss -ltnp 'sport = :3000' | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u)"
  [ -n "$listener_pids" ]
  for pid in $listener_pids; do
    test "$(ps -o user= -p "$pid" | xargs)" = "$DEPLOY_USER"
  done
  if [ "$root_process_exists" = true ]; then
    root_now="$(pm2 jlist | node -e '
      let input = "";
      process.stdin.on("data", (chunk) => { input += chunk; });
      process.stdin.on("end", () => {
        const app = JSON.parse(input).find((item) => item.name === "hero-dapp");
        process.stdout.write(app?.pm2_env?.status || "absent");
      });')"
    test "$root_now" != online
  fi
}

verify_user_runtime
printf 'MIGRATION_SOAK_SECONDS=660\n'
for cycle in $(seq 1 22); do
  sleep 30
  verify_user_runtime
done

if [ "$root_process_exists" = true ]; then
  pm2 delete hero-dapp >/dev/null 2>&1 || true
  pm2 save >/dev/null 2>&1 || true
fi
verify_user_runtime
test "$(stat -c '%U' "$CANONICAL")" = "$DEPLOY_USER"
test "$(cd "$CANONICAL" && git rev-parse HEAD)" = "$RELEASE_SHA"
test -z "$(cd "$CANONICAL" && git status --porcelain=v1 --untracked-files=all)"

canonical_swapped=false
user_process_started=false
root_process_exists=false
trap - ERR
printf 'CANONICAL_PATH=%s\n' "$CANONICAL"
printf 'CANONICAL_OWNER=%s\n' "$DEPLOY_USER"
printf 'CANONICAL_SHA=%s\n' "$RELEASE_SHA"
printf 'CANONICAL_DIRTY_COUNT=0\n'
printf 'PM2_OWNER=%s\n' "$DEPLOY_USER"
printf 'PM2_RELEASE_SHA=%s\n' "$RELEASE_SHA"
printf 'LOCAL_HEALTH=PASS\n'
printf 'PUBLIC_HEALTH=PASS\n'
printf 'BACKUP_PATH=%s\n' "$BACKUP"
printf 'VETS_CANONICAL_MIGRATION_COMPLETE_V3\n'
VPS1
VDS
