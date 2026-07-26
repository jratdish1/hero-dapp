#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

readonly APP_DIR="/var/www/hero-dapp"
readonly DEPLOY_USER="hero-deploy"
readonly DEPLOY_HOME="/home/hero-deploy"
readonly TOOLCHAIN_DIR="/opt/hero-node"
readonly NODE_BIN="$TOOLCHAIN_DIR/bin/node"
readonly PM2_BIN="$TOOLCHAIN_DIR/bin/pm2"
readonly PM2_HOME="$DEPLOY_HOME/.pm2"
readonly STATE_DIR="/var/lib/vets/hero-dapp"
readonly PENDING_STATE="$STATE_DIR/cutover-pending.env"
readonly COMMITTED_STATE="$STATE_DIR/cutover-committed.env"
readonly LOCK_FILE="/run/lock/hero-dapp-pm2-cutover.lock"
readonly PROCESS_NAME="hero-dapp"
readonly CANARY_NAME="hero-dapp-canary"
readonly PRODUCTION_PORT="3000"
readonly CANARY_PORT="3001"
readonly HEALTH_PATH='/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D'
readonly SAFE_PATH="$TOOLCHAIN_DIR/bin:/usr/bin:/bin"

export PATH="$SAFE_PATH"

fatal() {
  printf 'VETS_PM2_CUTOVER_ERROR=%s\n' "$*" >&2
  exit 1
}

require_sha() {
  local value="$1"
  [[ "$value" =~ ^[0-9a-f]{40}$ ]] || fatal "invalid SHA"
}

require_root() {
  [ "$(id -u)" -eq 0 ] || fatal "root execution required"
  local caller="${SUDO_USER:-root}"
  case "$caller" in
    root|hero-deploy) ;;
    *) fatal "unauthorized caller" ;;
  esac
}

state_value() {
  local file="$1" key="$2" value
  [ -f "$file" ] || return 1
  value="$(awk -F= -v wanted="$key" '$1 == wanted {print substr($0, index($0, "=") + 1); exit}' "$file")"
  [ -n "$value" ] || return 1
  printf '%s' "$value"
}

write_state() {
  local file="$1" legacy_sha="$2" target_sha="$3" state="$4"
  require_sha "$legacy_sha"
  require_sha "$target_sha"
  install -d -m 700 "$STATE_DIR"
  local temp
  temp="$(mktemp "$STATE_DIR/.state.XXXXXX")"
  {
    printf 'SCHEMA=VETS_HERO_PM2_CUTOVER_V1\n'
    printf 'STATE=%s\n' "$state"
    printf 'LEGACY_SHA=%s\n' "$legacy_sha"
    printf 'TARGET_SHA=%s\n' "$target_sha"
    printf 'UPDATED_AT=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  } > "$temp"
  chmod 600 "$temp"
  mv -f "$temp" "$file"
}

user_pm2() {
  runuser -u "$DEPLOY_USER" -- env \
    HOME="$DEPLOY_HOME" \
    USER="$DEPLOY_USER" \
    LOGNAME="$DEPLOY_USER" \
    PATH="$SAFE_PATH" \
    PM2_HOME="$PM2_HOME" \
    "$PM2_BIN" "$@"
}

user_pm2_with_release() {
  local port="$1" sha="$2"
  shift 2
  require_sha "$sha"
  runuser -u "$DEPLOY_USER" -- env \
    HOME="$DEPLOY_HOME" \
    USER="$DEPLOY_USER" \
    LOGNAME="$DEPLOY_USER" \
    PATH="$SAFE_PATH" \
    PM2_HOME="$PM2_HOME" \
    NODE_ENV=production \
    PORT="$port" \
    HERO_RELEASE_SHA="$sha" \
    "$PM2_BIN" "$@"
}

root_pm2_bin() {
  local candidate
  for candidate in /usr/local/bin/pm2 /usr/bin/pm2 /root/.nvm/versions/node/*/bin/pm2; do
    [ -x "$candidate" ] || continue
    printf '%s' "$candidate"
    return 0
  done
  return 1
}

root_pm2() {
  local binary
  binary="$(root_pm2_bin)" || fatal "legacy root PM2 binary not found"
  env HOME=/root USER=root LOGNAME=root PM2_HOME=/root/.pm2 "$binary" "$@"
}

pm2_process_json() {
  local scope="$1" name="$2"
  local data
  case "$scope" in
    user) data="$(user_pm2 jlist)" ;;
    root) data="$(root_pm2 jlist)" ;;
    *) fatal "invalid PM2 scope" ;;
  esac
  printf '%s' "$data" | PROCESS_NAME="$name" "$NODE_BIN" -e '
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => { input += chunk; });
    process.stdin.on("end", () => {
      const list = JSON.parse(input || "[]");
      const match = list.find(item => item?.name === process.env.PROCESS_NAME);
      if (!match) process.exit(1);
      const env = match.pm2_env || {};
      process.stdout.write(JSON.stringify({
        name: match.name,
        status: env.status || "unknown",
        cwd: env.pm_cwd || "",
        releaseSha: env.env?.HERO_RELEASE_SHA ?? env.HERO_RELEASE_SHA ?? "",
      }));
    });
  '
}

pm2_process_exists() {
  pm2_process_json "$1" "$2" >/dev/null 2>&1
}

pm2_process_online() {
  local json
  json="$(pm2_process_json "$1" "$2" 2>/dev/null)" || return 1
  [ "$(printf '%s' "$json" | "$NODE_BIN" -e '
    let input=""; process.stdin.on("data",c=>input+=c); process.stdin.on("end",()=>process.stdout.write(JSON.parse(input).status));
  ')" = "online" ]
}

pm2_release_sha() {
  local json sha
  json="$(pm2_process_json "$1" "$2")" || return 1
  sha="$(printf '%s' "$json" | "$NODE_BIN" -e '
    let input=""; process.stdin.on("data",c=>input+=c); process.stdin.on("end",()=>process.stdout.write(JSON.parse(input).releaseSha || ""));
  ')"
  require_sha "$sha"
  printf '%s' "$sha"
}

root_active_sha() {
  local json cwd sha
  json="$(pm2_process_json root "$PROCESS_NAME")" || fatal "legacy root PM2 process not found"
  cwd="$(printf '%s' "$json" | "$NODE_BIN" -e '
    let input=""; process.stdin.on("data",c=>input+=c); process.stdin.on("end",()=>process.stdout.write(JSON.parse(input).cwd || ""));
  ')"
  [ -n "$cwd" ] || fatal "legacy root PM2 cwd is empty"
  [ -d "$cwd/.git" ] || fatal "legacy root PM2 cwd is not a Git repository"
  sha="$(git -C "$cwd" rev-parse HEAD)"
  require_sha "$sha"
  printf '%s' "$sha"
}

assert_app_tree() {
  local expected_sha="$1" owner mode
  require_sha "$expected_sha"
  [ -d "$APP_DIR" ] || fatal "application directory missing"
  [ ! -L "$APP_DIR" ] || fatal "application directory must not be a symlink"
  owner="$(stat -c '%U' "$APP_DIR")"
  [ "$owner" = "$DEPLOY_USER" ] || fatal "application directory owner mismatch"
  [ -d "$APP_DIR/.git" ] || fatal "application Git repository missing"
  [ "$(git -C "$APP_DIR" rev-parse HEAD)" = "$expected_sha" ] || fatal "application Git SHA mismatch"
  [ -z "$(git -C "$APP_DIR" status --porcelain=v1 --untracked-files=all)" ] || fatal "application tree is dirty"
  [ -f "$APP_DIR/dist/index.js" ] || fatal "server build missing"
  [ -f "$APP_DIR/.env" ] || fatal "runtime environment file missing"
  [ "$(stat -c '%U' "$APP_DIR/.env")" = "$DEPLOY_USER" ] || fatal "runtime environment owner mismatch"
  mode="$(stat -c '%a' "$APP_DIR/.env")"
  [ "$mode" = "600" ] || fatal "runtime environment mode must be 600"
}

assert_toolchain() {
  [ -x "$NODE_BIN" ] || fatal "Node binary missing"
  [ -x "$PM2_BIN" ] || fatal "PM2 binary missing"
  [ "$("$NODE_BIN" --version)" = "v22.23.1" ] || fatal "unexpected Node version"
  [ "$(runuser -u "$DEPLOY_USER" -- env PATH="$SAFE_PATH" pnpm --version)" = "10.34.4" ] || fatal "unexpected pnpm version"
}

health_matches() {
  local port="$1" sha="$2" response
  require_sha "$sha"
  response="$(curl --fail --silent --show-error \
    --connect-timeout 5 --max-time 10 \
    "http://127.0.0.1:${port}${HEALTH_PATH}")" || return 1
  printf '%s' "$response" | EXPECTED_SHA="$sha" "$NODE_BIN" -e '
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => { input += chunk; });
    process.stdin.on("end", () => {
      let parsed;
      try { parsed = JSON.parse(input); } catch { process.exit(1); }
      const stack = [parsed];
      let ok = false;
      while (stack.length) {
        const value = stack.pop();
        if (!value || typeof value !== "object") continue;
        if (value.ok === true && value.releaseSha === process.env.EXPECTED_SHA) {
          ok = true;
          break;
        }
        for (const nested of Object.values(value)) stack.push(nested);
      }
      if (!ok) process.exit(1);
    });
  '
}

wait_for_health() {
  local port="$1" sha="$2"
  for attempt in $(seq 1 20); do
    if health_matches "$port" "$sha"; then
      return 0
    fi
    sleep 3
  done
  return 1
}

wait_for_port_free() {
  local port="$1"
  for attempt in $(seq 1 20); do
    if ! ss -ltn "sport = :$port" 2>/dev/null | tail -n +2 | grep -q .; then
      return 0
    fi
    sleep 1
  done
  return 1
}

start_user_process() {
  local name="$1" port="$2" sha="$3"
  require_sha "$sha"
  user_pm2 delete "$name" >/dev/null 2>&1 || true
  user_pm2_with_release "$port" "$sha" \
    start "$APP_DIR/dist/index.js" \
    --name "$name" \
    --cwd "$APP_DIR" \
    --interpreter "$NODE_BIN" \
    --time \
    --update-env >/dev/null
}

reload_user_process() {
  local port="$1" sha="$2"
  user_pm2_with_release "$port" "$sha" reload "$PROCESS_NAME" --update-env >/dev/null
}

verify_user_process() {
  local name="$1" port="$2" sha="$3"
  pm2_process_online user "$name" || return 1
  [ "$(pm2_release_sha user "$name")" = "$sha" ] || return 1
  wait_for_health "$port" "$sha"
}

run_canary() {
  local sha="$1" cleanup_failed=false
  require_sha "$sha"
  assert_toolchain
  assert_app_tree "$sha"
  user_pm2 delete "$CANARY_NAME" >/dev/null 2>&1 || true
  wait_for_port_free "$CANARY_PORT" || fatal "canary port is occupied"

  cleanup_canary() {
    user_pm2 delete "$CANARY_NAME" >/dev/null 2>&1 || cleanup_failed=true
    wait_for_port_free "$CANARY_PORT" || cleanup_failed=true
  }
  trap cleanup_canary RETURN

  start_user_process "$CANARY_NAME" "$CANARY_PORT" "$sha"
  verify_user_process "$CANARY_NAME" "$CANARY_PORT" "$sha" || fatal "canary exact-SHA health verification failed"
  cleanup_canary
  trap - RETURN
  [ "$cleanup_failed" = false ] || fatal "canary cleanup failed"
  printf 'VETS_CANARY_VERIFIED_SHA=%s\n' "$sha"
}

restore_legacy_root() {
  local expected_sha="$1"
  require_sha "$expected_sha"
  user_pm2 delete "$PROCESS_NAME" >/dev/null 2>&1 || true
  wait_for_port_free "$PRODUCTION_PORT" || fatal "production port did not release before legacy restore"
  root_pm2 restart "$PROCESS_NAME" --update-env >/dev/null
  for attempt in $(seq 1 20); do
    if pm2_process_online root "$PROCESS_NAME" && \
       [ "$(root_active_sha)" = "$expected_sha" ] && \
       curl --fail --silent --show-error --connect-timeout 5 --max-time 10 \
         --output /dev/null http://127.0.0.1:3000/; then
      rm -f "$PENDING_STATE"
      printf 'VETS_LEGACY_ROOT_RESTORED_SHA=%s\n' "$expected_sha"
      return 0
    fi
    sleep 3
  done
  fatal "legacy root PM2 restore failed"
}

activate_release() {
  local target_sha="$1" legacy_sha="" first_cutover=false
  require_sha "$target_sha"
  run_canary "$target_sha"

  if pm2_process_exists user "$PROCESS_NAME"; then
    reload_user_process "$PRODUCTION_PORT" "$target_sha"
    verify_user_process "$PROCESS_NAME" "$PRODUCTION_PORT" "$target_sha" || fatal "user PM2 reload verification failed"
    user_pm2 save --force >/dev/null
    printf 'VETS_USER_PM2_ACTIVE_SHA=%s\n' "$target_sha"
    return 0
  fi

  pm2_process_online root "$PROCESS_NAME" || fatal "first cutover requires an online legacy root PM2 process"
  legacy_sha="$(root_active_sha)"
  require_sha "$legacy_sha"
  write_state "$PENDING_STATE" "$legacy_sha" "$target_sha" "pending"
  first_cutover=true

  root_pm2 stop "$PROCESS_NAME" >/dev/null
  wait_for_port_free "$PRODUCTION_PORT" || {
    restore_legacy_root "$legacy_sha"
    fatal "production port did not release for cutover"
  }

  if ! start_user_process "$PROCESS_NAME" "$PRODUCTION_PORT" "$target_sha" || \
     ! verify_user_process "$PROCESS_NAME" "$PRODUCTION_PORT" "$target_sha"; then
    restore_legacy_root "$legacy_sha"
    fatal "first user PM2 cutover failed; legacy root process restored"
  fi

  user_pm2 save --force >/dev/null
  printf 'VETS_PM2_CUTOVER_PENDING=true\n'
  printf 'VETS_LEGACY_SHA=%s\n' "$legacy_sha"
  printf 'VETS_USER_PM2_ACTIVE_SHA=%s\n' "$target_sha"
}

commit_cutover() {
  local target_sha="$1" legacy_sha
  require_sha "$target_sha"
  verify_user_process "$PROCESS_NAME" "$PRODUCTION_PORT" "$target_sha" || fatal "cannot commit an unverified user PM2 release"

  if [ -f "$PENDING_STATE" ]; then
    legacy_sha="$(state_value "$PENDING_STATE" LEGACY_SHA)"
    require_sha "$legacy_sha"
    [ "$(state_value "$PENDING_STATE" TARGET_SHA)" = "$target_sha" ] || fatal "pending target SHA mismatch"
    if pm2_process_exists root "$PROCESS_NAME"; then
      root_pm2 delete "$PROCESS_NAME" >/dev/null
      root_pm2 save --force >/dev/null
    fi
    write_state "$COMMITTED_STATE" "$legacy_sha" "$target_sha" "committed"
    rm -f "$PENDING_STATE"
  elif [ -f "$COMMITTED_STATE" ]; then
    legacy_sha="$(state_value "$COMMITTED_STATE" LEGACY_SHA)"
    require_sha "$legacy_sha"
    write_state "$COMMITTED_STATE" "$legacy_sha" "$target_sha" "committed"
  else
    fatal "no cutover state exists"
  fi

  user_pm2 save --force >/dev/null
  systemctl daemon-reload
  systemctl enable pm2-hero-deploy.service >/dev/null
  printf 'VETS_PM2_CUTOVER_COMMITTED_SHA=%s\n' "$target_sha"
}

active_sha() {
  local sha
  if pm2_process_online user "$PROCESS_NAME"; then
    sha="$(pm2_release_sha user "$PROCESS_NAME")"
  elif pm2_process_online root "$PROCESS_NAME"; then
    sha="$(root_active_sha)"
  else
    fatal "no active HeroBase PM2 process"
  fi
  require_sha "$sha"
  printf '%s\n' "$sha"
}

rollback_release() {
  local target_sha="$1" legacy_sha
  require_sha "$target_sha"
  if [ -f "$PENDING_STATE" ]; then
    legacy_sha="$(state_value "$PENDING_STATE" LEGACY_SHA)"
    require_sha "$legacy_sha"
    [ "$target_sha" = "$legacy_sha" ] || fatal "pending rollback SHA mismatch"
    restore_legacy_root "$legacy_sha"
    return 0
  fi

  [ -f "$COMMITTED_STATE" ] || fatal "committed user PM2 state missing"
  assert_app_tree "$target_sha"
  run_canary "$target_sha"
  if pm2_process_exists user "$PROCESS_NAME"; then
    reload_user_process "$PRODUCTION_PORT" "$target_sha"
  else
    wait_for_port_free "$PRODUCTION_PORT" || fatal "production port occupied before user rollback"
    start_user_process "$PROCESS_NAME" "$PRODUCTION_PORT" "$target_sha"
  fi
  verify_user_process "$PROCESS_NAME" "$PRODUCTION_PORT" "$target_sha" || fatal "user PM2 rollback verification failed"
  user_pm2 save --force >/dev/null
  legacy_sha="$(state_value "$COMMITTED_STATE" LEGACY_SHA)"
  write_state "$COMMITTED_STATE" "$legacy_sha" "$target_sha" "committed"
  printf 'VETS_USER_PM2_ROLLBACK_SHA=%s\n' "$target_sha"
}

status_mode() {
  if [ -f "$PENDING_STATE" ]; then
    printf 'pending\n'
  elif [ -f "$COMMITTED_STATE" ]; then
    printf 'committed\n'
  elif pm2_process_online root "$PROCESS_NAME"; then
    printf 'legacy-root\n'
  else
    printf 'unknown\n'
  fi
}

main() {
  require_root
  install -d -m 755 "$(dirname "$LOCK_FILE")"
  exec 9>"$LOCK_FILE"
  flock -w 300 9 || fatal "cutover lock timeout"

  local operation="${1:-}" sha="${2:-}"
  case "$operation" in
    check)
      assert_toolchain
      [ -d "$APP_DIR/.git" ] || fatal "application repository missing"
      printf 'VETS_PM2_CUTOVER_CHECK=PASS\n'
      ;;
    canary)
      run_canary "$sha"
      ;;
    activate)
      activate_release "$sha"
      ;;
    commit)
      commit_cutover "$sha"
      ;;
    rollback)
      rollback_release "$sha"
      ;;
    active-sha)
      active_sha
      ;;
    mode)
      status_mode
      ;;
    *)
      fatal "unsupported operation"
      ;;
  esac
}

main "$@"
