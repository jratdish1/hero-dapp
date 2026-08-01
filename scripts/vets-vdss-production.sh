#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_SHA="${1:-}"
DEPLOY_OPERATION="${2:-}"
CORRELATION_ID="${3:-}"
NGINX_INCLUDE_PATH="${4:-}"
PM2_PROCESS="${5:-hero-dapp-server}"
EXPECTED_HOSTNAME="vmi3266736"
EXPECTED_TAILSCALE_IP="100.112.25.66"
HEALTH_URL='https://herobase.io/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D'

[[ "$DEPLOY_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$CORRELATION_ID" =~ ^[A-Za-z0-9._-]{1,100}$ ]]
[[ "$NGINX_INCLUDE_PATH" =~ ^/etc/nginx/[A-Za-z0-9._/-]+$ ]]
[[ "$PM2_PROCESS" =~ ^[A-Za-z0-9._-]{1,64}$ ]]
case "$DEPLOY_OPERATION" in
  deploy|rollback) ;;
  *) exit 64 ;;
esac

for command_name in git node corepack pm2 curl flock nginx systemctl install sha256sum tailscale; do
  command -v "$command_name" >/dev/null || {
    printf 'missing_command=%s\n' "$command_name" >&2
    exit 69
  }
done

ACTUAL_HOSTNAME="$(hostname -s)"
ACTUAL_TAILSCALE_IP="$(tailscale ip -4 | head -n 1)"
test "$ACTUAL_HOSTNAME" = "$EXPECTED_HOSTNAME"
test "$ACTUAL_TAILSCALE_IP" = "$EXPECTED_TAILSCALE_IP"
test "$(id -u)" = "0"

APP_DIR="$(pm2 jlist | PM2_PROCESS="$PM2_PROCESS" node -e '
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", chunk => { input += chunk; });
  process.stdin.on("end", () => {
    const processes = JSON.parse(input);
    const matches = processes.filter(item => item.name === process.env.PM2_PROCESS);
    if (matches.length !== 1) process.exit(1);
    const cwd = matches[0]?.pm2_env?.pm_cwd;
    if (typeof cwd !== "string" || !cwd.startsWith("/")) process.exit(1);
    process.stdout.write(cwd);
  });
')"

test -n "$APP_DIR"
test -d "$APP_DIR"
test ! -L "$APP_DIR"
cd "$APP_DIR"
test -d .git

ORIGIN_URL="$(git remote get-url origin)"
case "$ORIGIN_URL" in
  https://github.com/jratdish1/hero-dapp.git|git@github.com:jratdish1/hero-dapp.git) ;;
  *)
    printf 'unexpected_origin=%s\n' "$ORIGIN_URL" >&2
    exit 65
    ;;
esac

test -e "$NGINX_INCLUDE_PATH"
test -f "$NGINX_INCLUDE_PATH"
test ! -L "$NGINX_INCLUDE_PATH"
nginx -T 2>&1 | grep -Fq "configuration file $NGINX_INCLUDE_PATH:"

exec 9>"$APP_DIR/.git/vets-production.lock"
flock -w 1800 9 || exit 75

PREVIOUS_SHA="$(git rev-parse HEAD)"
[[ "$PREVIOUS_SHA" =~ ^[0-9a-f]{40}$ ]]
test -z "$(git status --porcelain=v1 --untracked-files=all)"

git fetch --no-tags origin main:refs/remotes/origin/main
git cat-file -e "${DEPLOY_SHA}^{commit}"
case "$DEPLOY_OPERATION" in
  deploy)
    test "$(git rev-parse origin/main)" = "$DEPLOY_SHA"
    ;;
  rollback)
    test "$(git rev-parse origin/main)" != "$DEPLOY_SHA"
    git merge-base --is-ancestor "$DEPLOY_SHA" origin/main
    ;;
esac

BACKUP_DIR="$(mktemp -d /var/tmp/vets-herobase-rollback.XXXXXX)"
BACKUP_NGINX="$BACKUP_DIR/$(basename "$NGINX_INCLUDE_PATH")"
install -m 0600 "$NGINX_INCLUDE_PATH" "$BACKUP_NGINX"
PREVIOUS_NGINX_SHA="$(sha256sum "$NGINX_INCLUDE_PATH" | awk '{print $1}')"
MUTATION_STARTED=false

wait_for_health() {
  local expected_sha="$1" response=""
  for attempt in $(seq 1 15); do
    response="$(curl --fail --silent --show-error \
      --connect-timeout 5 --max-time 15 "$HEALTH_URL" || true)"
    if printf '%s' "$response" | grep -q '"ok":true' && \
       printf '%s' "$response" | grep -q "\"releaseSha\":\"$expected_sha\""; then
      return 0
    fi
    sleep 4
  done
  return 1
}

verify_pm2_release() {
  local expected_sha="$1"
  pm2 jlist | PM2_PROCESS="$PM2_PROCESS" EXPECTED_SHA="$expected_sha" node -e '
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => { input += chunk; });
    process.stdin.on("end", () => {
      const processes = JSON.parse(input);
      const matches = processes.filter(item => item.name === process.env.PM2_PROCESS);
      if (matches.length !== 1) process.exit(1);
      const env = matches[0]?.pm2_env;
      const actual = env?.env?.HERO_RELEASE_SHA ?? env?.HERO_RELEASE_SHA;
      if (actual !== process.env.EXPECTED_SHA) process.exit(1);
    });
  '
}

build_release() {
  corepack enable
  corepack prepare pnpm@10.34.4 --activate
  test "$(pnpm --version)" = "10.34.4"
  test ! -e package-lock.json
  pnpm install --frozen-lockfile
  rm -rf dist
  pnpm build
}

rollback_all() {
  local original_status="$?"
  trap - ERR INT TERM
  if [ "$MUTATION_STARTED" = true ]; then
    printf 'VETS_INLINE_ROLLBACK_ATTEMPTED=true\n'
    set +e
    git reset --hard "$PREVIOUS_SHA" && \
      build_release && \
      install -m 0644 "$BACKUP_NGINX" "$NGINX_INCLUDE_PATH" && \
      nginx -t && \
      systemctl reload nginx && \
      HERO_RELEASE_SHA="$PREVIOUS_SHA" pm2 reload "$PM2_PROCESS" --update-env && \
      test "$(git rev-parse HEAD)" = "$PREVIOUS_SHA" && \
      verify_pm2_release "$PREVIOUS_SHA" && \
      wait_for_health "$PREVIOUS_SHA"
    local rollback_status="$?"
    set -e
    if [ "$rollback_status" = 0 ]; then
      printf 'VETS_INLINE_ROLLBACK_SUCCEEDED=true\n'
      printf 'VETS_FINAL_SHA=%s\n' "$PREVIOUS_SHA"
    else
      printf 'VETS_INLINE_ROLLBACK_SUCCEEDED=false\n'
      exit 70
    fi
  fi
  exit "$original_status"
}
trap rollback_all ERR INT TERM

printf 'VETS_TARGET_HOSTNAME=%s\n' "$ACTUAL_HOSTNAME"
printf 'VETS_TARGET_TAILSCALE_IP=%s\n' "$ACTUAL_TAILSCALE_IP"
printf 'VETS_APP_DIR=%s\n' "$APP_DIR"
printf 'VETS_PM2_PROCESS=%s\n' "$PM2_PROCESS"
printf 'VETS_NGINX_INCLUDE_PATH=%s\n' "$NGINX_INCLUDE_PATH"
printf 'VETS_PREVIOUS_SHA=%s\n' "$PREVIOUS_SHA"
printf 'VETS_PREVIOUS_NGINX_SHA256=%s\n' "$PREVIOUS_NGINX_SHA"
printf 'VETS_MUTATION_STARTED=true\n'
MUTATION_STARTED=true

git reset --hard "$DEPLOY_SHA"
test -f nginx/herobase-cache-headers.conf
TARGET_NGINX_SHA="$(sha256sum nginx/herobase-cache-headers.conf | awk '{print $1}')"
build_release
install -m 0644 nginx/herobase-cache-headers.conf "$NGINX_INCLUDE_PATH"
test "$(sha256sum "$NGINX_INCLUDE_PATH" | awk '{print $1}')" = "$TARGET_NGINX_SHA"
nginx -t
systemctl reload nginx
nginx -T 2>&1 | grep -Fq "configuration file $NGINX_INCLUDE_PATH:"
HERO_RELEASE_SHA="$DEPLOY_SHA" pm2 reload "$PM2_PROCESS" --update-env

test "$(git rev-parse HEAD)" = "$DEPLOY_SHA"
test -z "$(git status --porcelain=v1 --untracked-files=all)"
verify_pm2_release "$DEPLOY_SHA"
wait_for_health "$DEPLOY_SHA"

MUTATION_STARTED=false
trap - ERR INT TERM
rm -rf "$BACKUP_DIR"
printf 'VETS_TARGET_NGINX_SHA256=%s\n' "$TARGET_NGINX_SHA"
printf 'VETS_FINAL_SHA=%s\n' "$DEPLOY_SHA"
printf 'VETS_INLINE_ROLLBACK_ATTEMPTED=false\n'
printf 'VETS_INLINE_ROLLBACK_SUCCEEDED=false\n'
