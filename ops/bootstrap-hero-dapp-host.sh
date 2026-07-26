#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

readonly APP_DIR="/var/www/hero-dapp"
readonly DEPLOY_USER="hero-deploy"
readonly DEPLOY_HOME="/home/hero-deploy"
readonly NODE_VERSION="22.23.1"
readonly PNPM_VERSION="10.34.4"
readonly PM2_VERSION="7.0.3"
readonly NODE_INSTALL_DIR="/opt/node-v${NODE_VERSION}-linux-x64"
readonly TOOLCHAIN_LINK="/opt/hero-node"
readonly SAFE_PATH="$TOOLCHAIN_LINK/bin:/usr/bin:/bin"
readonly HELPER_DEST="/usr/local/sbin/hero-dapp-pm2-cutover"
readonly SUDOERS_FILE="/etc/sudoers.d/hero-dapp-pm2-cutover"
readonly SYSTEMD_UNIT="/etc/systemd/system/pm2-hero-deploy.service"
readonly STATE_DIR="/var/lib/vets/hero-dapp"
readonly BOOTSTRAP_STATE="$STATE_DIR/bootstrap.json"
readonly REPO_URL="https://github.com/jratdish1/hero-dapp.git"

fatal() {
  printf 'VETS_HOST_BOOTSTRAP_ERROR=%s\n' "$*" >&2
  exit 1
}

require_sha() {
  [[ "$1" =~ ^[0-9a-f]{40}$ ]] || fatal "invalid target SHA"
}

require_root() {
  [ "$(id -u)" -eq 0 ] || fatal "root execution required"
}

install_toolchain() {
  local work archive checksum_line
  if [ -x "$TOOLCHAIN_LINK/bin/node" ] && \
     [ "$("$TOOLCHAIN_LINK/bin/node" --version)" = "v$NODE_VERSION" ]; then
    printf 'VETS_NODE_TOOLCHAIN=REUSED:%s\n' "$NODE_VERSION"
  else
    work="$(mktemp -d)"
    trap 'rm -rf "$work"' RETURN
    archive="node-v${NODE_VERSION}-linux-x64.tar.xz"
    curl --fail --silent --show-error --location \
      --connect-timeout 15 --max-time 300 \
      "https://nodejs.org/dist/v${NODE_VERSION}/${archive}" \
      --output "$work/$archive"
    curl --fail --silent --show-error --location \
      --connect-timeout 15 --max-time 60 \
      "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt" \
      --output "$work/SHASUMS256.txt"
    checksum_line="$(grep -E "^[0-9a-f]{64}  ${archive}$" "$work/SHASUMS256.txt")"
    [ -n "$checksum_line" ] || fatal "Node checksum entry missing"
    (cd "$work" && printf '%s\n' "$checksum_line" | sha256sum --check --status -) || fatal "Node archive checksum mismatch"

    rm -rf "$NODE_INSTALL_DIR"
    tar -xJf "$work/$archive" -C /opt
    [ -x "$NODE_INSTALL_DIR/bin/node" ] || fatal "Node extraction failed"
    chown -R root:root "$NODE_INSTALL_DIR"
    chmod -R a+rX "$NODE_INSTALL_DIR"
    ln -sfn "$NODE_INSTALL_DIR" "$TOOLCHAIN_LINK"
    trap - RETURN
    rm -rf "$work"
    printf 'VETS_NODE_TOOLCHAIN=INSTALLED:%s\n' "$NODE_VERSION"
  fi

  export PATH="$SAFE_PATH"
  "$TOOLCHAIN_LINK/bin/corepack" enable --install-directory "$TOOLCHAIN_LINK/bin"
  "$TOOLCHAIN_LINK/bin/corepack" prepare "pnpm@$PNPM_VERSION" --activate
  [ "$("$TOOLCHAIN_LINK/bin/pnpm" --version)" = "$PNPM_VERSION" ] || fatal "pnpm activation failed"

  "$TOOLCHAIN_LINK/bin/npm" install --global --ignore-scripts --no-audit --no-fund "pm2@$PM2_VERSION" >/dev/null
  [ "$("$TOOLCHAIN_LINK/bin/node" -p "require('$NODE_INSTALL_DIR/lib/node_modules/pm2/package.json').version")" = "$PM2_VERSION" ] || fatal "PM2 installation failed"

  printf 'VETS_NODE_VERSION=%s\n' "$("$TOOLCHAIN_LINK/bin/node" --version)"
  printf 'VETS_PNPM_VERSION=%s\n' "$("$TOOLCHAIN_LINK/bin/pnpm" --version)"
  printf 'VETS_PM2_VERSION=%s\n' "$PM2_VERSION"
}

install_process_controls() {
  local source_dir helper_source helper_sha installed_sha
  source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  helper_source="$source_dir/hero-dapp-pm2-cutover.sh"
  [ -f "$helper_source" ] || fatal "cutover helper source missing"
  bash -n "$helper_source"
  helper_sha="$(sha256sum "$helper_source" | awk '{print $1}')"

  install -o root -g root -m 755 "$helper_source" "$HELPER_DEST"
  installed_sha="$(sha256sum "$HELPER_DEST" | awk '{print $1}')"
  [ "$installed_sha" = "$helper_sha" ] || fatal "cutover helper hash mismatch"

  cat > "$SUDOERS_FILE" <<'EOF'
Defaults!/usr/local/sbin/hero-dapp-pm2-cutover env_reset,secure_path=/opt/hero-node/bin:/usr/bin:/bin
hero-deploy ALL=(root) NOPASSWD: /usr/local/sbin/hero-dapp-pm2-cutover *
EOF
  chmod 440 "$SUDOERS_FILE"
  visudo --check --file "$SUDOERS_FILE" >/dev/null

  cat > "$SYSTEMD_UNIT" <<'EOF'
[Unit]
Description=PM2 process manager for HeroBase production
After=network-online.target
Wants=network-online.target

[Service]
Type=forking
User=hero-deploy
Group=hero-deploy
Environment=PATH=/opt/hero-node/bin:/usr/bin:/bin
Environment=PM2_HOME=/home/hero-deploy/.pm2
PIDFile=/home/hero-deploy/.pm2/pm2.pid
LimitNOFILE=infinity
LimitNPROC=infinity
Restart=on-failure
RestartSec=5
ExecStart=/opt/hero-node/bin/pm2 resurrect
ExecReload=/opt/hero-node/bin/pm2 reload all
ExecStop=/opt/hero-node/bin/pm2 kill
TimeoutStartSec=60
TimeoutStopSec=60

[Install]
WantedBy=multi-user.target
EOF
  chmod 644 "$SYSTEMD_UNIT"
  systemctl daemon-reload

  printf 'VETS_CUTOVER_HELPER_SHA256=%s\n' "$helper_sha"
  printf 'VETS_CUTOVER_SUDOERS=VALID\n'
  printf 'VETS_PM2_SYSTEMD_UNIT=INSTALLED_DISABLED\n'
}

preserve_legacy_var_www() {
  local backup_root="$1"
  [ -e "$APP_DIR" ] || return 0

  if [ "$(stat -c '%U' "$APP_DIR")" = "$DEPLOY_USER" ] && [ -d "$APP_DIR/.git" ]; then
    return 0
  fi

  local destination="$backup_root/legacy-var-www-hero-dapp"
  [ ! -e "$destination" ] || fatal "legacy backup destination already exists"
  mv "$APP_DIR" "$destination"
  printf 'VETS_LEGACY_VAR_WWW_MOVED=%s\n' "$destination"
}

clone_or_sync_repository() {
  local target_sha="$1"
  require_sha "$target_sha"
  install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 755 "$(dirname "$APP_DIR")"

  if [ ! -d "$APP_DIR/.git" ]; then
    rm -rf "$APP_DIR"
    runuser -u "$DEPLOY_USER" -- env HOME="$DEPLOY_HOME" PATH="$SAFE_PATH" \
      git clone --no-tags "$REPO_URL" "$APP_DIR"
  fi

  [ ! -L "$APP_DIR" ] || fatal "application directory is a symlink"
  [ "$(stat -c '%U' "$APP_DIR")" = "$DEPLOY_USER" ] || fatal "application owner mismatch"

  runuser -u "$DEPLOY_USER" -- env HOME="$DEPLOY_HOME" PATH="$SAFE_PATH" bash -c "
    set -euo pipefail
    cd '$APP_DIR'
    origin=\"\$(git remote get-url origin)\"
    case \"\$origin\" in
      '$REPO_URL'|git@github.com:jratdish1/hero-dapp.git) ;;
      *) exit 1 ;;
    esac
    git fetch --no-tags origin main:refs/remotes/origin/main
    git cat-file -e '${target_sha}^{commit}'
    git merge-base --is-ancestor '$target_sha' origin/main
    git reset --hard '$target_sha'
    git clean -ffd
    test -z \"\$(git status --porcelain=v1 --untracked-files=all)\"
  "
  printf 'VETS_BOOTSTRAP_REPO_SHA=%s\n' "$target_sha"
}

write_minimal_environment() {
  local backup_root="$1"
  local work source_file
  work="$(mktemp -d)"
  trap 'rm -rf "$work"' RETURN

  local sources=()
  for source_file in \
    "$APP_DIR/.env" \
    "$backup_root/legacy-var-www-hero-dapp/.env" \
    /root/hero-dapp/.env \
    /root/.env_architecture; do
    [ -s "$source_file" ] && sources+=("$source_file")
  done

  SOURCES_JSON="$(printf '%s\n' "${sources[@]:-}" | "$TOOLCHAIN_LINK/bin/node" -e '
    let input=""; process.stdin.on("data",c=>input+=c); process.stdin.on("end",()=>{
      process.stdout.write(JSON.stringify(input.split(/\n/).filter(Boolean)));
    });
  ')" \
  TARGET_ENV="$work/.env" \
  "$TOOLCHAIN_LINK/bin/node" <<'NODE'
const fs = require('fs');
const crypto = require('crypto');

const allow = new Set([
  'BUILT_IN_FORGE_API_KEY',
  'BUILT_IN_FORGE_API_URL',
  'DAO_ANCHOR_CONTRACT',
  'DAO_EXECUTOR_ADDRESS',
  'DAO_EXECUTOR_PRIVATE_KEY',
  'DAO_EXECUTOR_TYPE',
  'DAO_LOG_LEVEL',
  'DAO_SAFE_CHAIN_ID',
  'DAO_SAFE_OWNERS',
  'DAO_SAFE_THRESHOLD',
  'DAO_SAFE_TX_SERVICE_URL',
  'DATABASE_URL',
  'HERO_ADMIN_PASSWORD',
  'JWT_SECRET',
  'OAUTH_SERVER_URL',
  'OPENAI_API_KEY',
  'OWNER_NAME',
  'OWNER_OPEN_ID',
  'PULSECHAIN_RPC_URL',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'VITE_ANALYTICS_ENDPOINT',
  'VITE_ANALYTICS_WEBSITE_ID',
  'VITE_APP_ID',
  'VITE_FRONTEND_FORGE_API_KEY',
  'VITE_FRONTEND_FORGE_API_URL',
  'VITE_OAUTH_PORTAL_URL',
  'VITE_WALLETCONNECT_PROJECT_ID',
  'XAI_API_KEY',
]);

function parse(content) {
  const result = new Map();
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s);
    if (!match || !allow.has(match[1])) continue;
    let value = match[2].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
       (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    if (value) result.set(match[1], value);
  }
  return result;
}

const merged = new Map();
const sources = JSON.parse(process.env.SOURCES_JSON || '[]');
// Earlier files are more specific and therefore win.
for (const source of sources.slice().reverse()) {
  const parsed = parse(fs.readFileSync(source, 'utf8'));
  for (const [key, value] of parsed) merged.set(key, value);
}

if (!merged.get('DATABASE_URL')) {
  throw new Error('DATABASE_URL is missing from all approved runtime sources');
}
if (!merged.get('JWT_SECRET') || merged.get('JWT_SECRET').length < 32) {
  merged.set('JWT_SECRET', crypto.randomBytes(48).toString('base64url'));
  console.error('VETS_JWT_SECRET_GENERATED=true');
}
if (!merged.get('OAUTH_SERVER_URL')) merged.set('OAUTH_SERVER_URL', 'https://herobase.io');
merged.set('NODE_ENV', 'production');
merged.set('PORT', '3000');

const ordered = [...merged.entries()].sort(([a], [b]) => a.localeCompare(b));
const serialized = ordered.map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n';
fs.writeFileSync(process.env.TARGET_ENV, serialized, { mode: 0o600 });
console.log(`VETS_RUNTIME_ENV_NAMES=${ordered.map(([key]) => key).join(' ')}`);
NODE

  install -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 600 "$work/.env" "$APP_DIR/.env"
  trap - RETURN
  rm -rf "$work"
  printf 'VETS_RUNTIME_ENV=INSTALLED_MODE_600\n'
}

build_and_canary() {
  local target_sha="$1"
  require_sha "$target_sha"
  runuser -u "$DEPLOY_USER" -- env \
    HOME="$DEPLOY_HOME" \
    USER="$DEPLOY_USER" \
    LOGNAME="$DEPLOY_USER" \
    PATH="$SAFE_PATH" \
    bash -c "
      set -euo pipefail
      cd '$APP_DIR'
      test \"\$(git rev-parse HEAD)\" = '$target_sha'
      test ! -e package-lock.json
      pnpm install --frozen-lockfile
      rm -rf dist
      pnpm build
      test -f dist/index.js
    "

  "$HELPER_DEST" check
  "$HELPER_DEST" canary "$target_sha"
  printf 'VETS_BOOTSTRAP_CANARY=PASS:%s\n' "$target_sha"
}

write_bootstrap_state() {
  local target_sha="$1" backup_root="$2" helper_sha
  helper_sha="$(sha256sum "$HELPER_DEST" | awk '{print $1}')"
  install -d -m 700 "$STATE_DIR"
  TARGET_SHA="$target_sha" \
  BACKUP_ROOT="$backup_root" \
  HELPER_SHA="$helper_sha" \
  NODE_VERSION="$NODE_VERSION" \
  PNPM_VERSION="$PNPM_VERSION" \
  PM2_VERSION="$PM2_VERSION" \
  "$TOOLCHAIN_LINK/bin/node" <<'NODE' > "$BOOTSTRAP_STATE"
const state = {
  schema: 'VETS_HERO_HOST_BOOTSTRAP_V1',
  targetSha: process.env.TARGET_SHA,
  backupRoot: process.env.BACKUP_ROOT,
  helperSha256: process.env.HELPER_SHA,
  nodeVersion: process.env.NODE_VERSION,
  pnpmVersion: process.env.PNPM_VERSION,
  pm2Version: process.env.PM2_VERSION,
  liveCutoverPerformed: false,
  updatedAt: new Date().toISOString(),
};
process.stdout.write(JSON.stringify(state, null, 2) + '\n');
NODE
  chmod 600 "$BOOTSTRAP_STATE"
  printf 'VETS_BOOTSTRAP_STATE=%s\n' "$BOOTSTRAP_STATE"
}

main() {
  require_root
  local target_sha="${1:-}"
  require_sha "$target_sha"

  for command_name in curl git tar xz sha256sum runuser python3 visudo systemctl flock ss; do
    command -v "$command_name" >/dev/null || fatal "missing required host command: $command_name"
  done
  id "$DEPLOY_USER" >/dev/null 2>&1 || fatal "restricted deployment user missing"

  local timestamp backup_root live_before live_after
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  backup_root="/var/backups/hero-dapp/host-bootstrap-$timestamp"
  install -d -m 700 "$backup_root"

  install_toolchain
  install_process_controls

  live_before="$("$HELPER_DEST" active-sha)"
  require_sha "$live_before"
  printf 'VETS_LIVE_SHA_BEFORE=%s\n' "$live_before"

  if [ -f "$APP_DIR/.env" ]; then
    install -m 600 "$APP_DIR/.env" "$backup_root/pre-bootstrap.env"
  fi
  preserve_legacy_var_www "$backup_root"
  clone_or_sync_repository "$target_sha"
  write_minimal_environment "$backup_root"
  build_and_canary "$target_sha"
  write_bootstrap_state "$target_sha" "$backup_root"

  live_after="$("$HELPER_DEST" active-sha)"
  require_sha "$live_after"
  [ "$live_after" = "$live_before" ] || fatal "bootstrap changed the live release"
  printf 'VETS_LIVE_SHA_AFTER=%s\n' "$live_after"
  printf 'VETS_LIVE_CUTOVER_PERFORMED=false\n'
  printf 'VETS_HOST_BOOTSTRAP_READY=true\n'
}

main "$@"
