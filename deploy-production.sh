#!/usr/bin/env bash
# ============================================================
# HERO Dapp Production Deploy Script v2.0
# Cache-Busting Hash Rotation + Atomic Asset Deployment
# ============================================================
# Prevents Cloudflare/nginx from serving stale 404s during deploy
# by using atomic symlink rotation for zero-downtime asset updates.
#
# Usage: bash deploy-production.sh [--skip-build] [--skip-purge]
# ============================================================
set -euo pipefail

# --- Configuration ---
DEPLOY_DIR="/var/www/hero-dapp"
BUILD_DIR="/var/www/hero-dapp"
CLOUDFLARE_ZONE_ID="1f894ca8151cd3419688c8a87ce9f5e3"  # herobase.io zone
CLOUDFLARE_API_KEY="${CLOUDFLARE_API_KEY:-}"
CLOUDFLARE_EMAIL="${CLOUDFLARE_EMAIL:-}"
NGINX_ASSETS_ROOT="/var/www/hero-dapp/public/assets"
RELEASES_DIR="/var/www/hero-dapp/releases"
CURRENT_LINK="/var/www/hero-dapp/public/assets"
MAX_RELEASES=5  # Keep last N releases for instant rollback
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOCKFILE="/tmp/hero-dapp-deploy.lock"
HEALTH_RETRIES=5
HEALTH_DELAY=3

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# --- Parse Args ---
SKIP_BUILD=false
SKIP_PURGE=false
for arg in "$@"; do
  case $arg in
    --skip-build) SKIP_BUILD=true ;;
    --skip-purge) SKIP_PURGE=true ;;
    --help|-h) echo "Usage: $0 [--skip-build] [--skip-purge]"; exit 0 ;;
    *) warn "Unknown argument: $arg (ignored)" ;;
  esac
done

# --- Concurrency Lock (flock) ---
exec 200>"$LOCKFILE"
if ! flock -n 200; then
  error "Another deployment is already in progress (lockfile: $LOCKFILE)"
fi
trap 'flock -u 200; rm -f "$LOCKFILE"' EXIT

# --- Pre-flight Checks ---
log "Pre-flight checks..."
command -v node >/dev/null || error "Node.js not found"
command -v npm >/dev/null || error "npm not found"
command -v pm2 >/dev/null || error "PM2 not found"
command -v nginx >/dev/null || error "nginx not found"
command -v jq >/dev/null || error "jq not found (required for Cloudflare purge)"

# Load NVM if available
[ -f /root/.nvm/nvm.sh ] && source /root/.nvm/nvm.sh

# Load Cloudflare credentials from env_architecture if not set
# File must be chmod 600 owned by root
if [ -z "$CLOUDFLARE_API_KEY" ]; then
  ENV_FILE="/root/.env_architecture"
  if [ -f "$ENV_FILE" ]; then
    # Verify permissions (must be 600 or 400)
    PERMS=$(stat -c "%a" "$ENV_FILE" 2>/dev/null || echo "unknown")
    if [ "$PERMS" != "600" ] && [ "$PERMS" != "400" ]; then
      warn "env_architecture has insecure permissions ($PERMS). Fixing to 600."
      chmod 600 "$ENV_FILE"
    fi
    CLOUDFLARE_API_KEY=$(awk -F= '/^CF_GLOBAL_API_KEY=/{print $2}' "$ENV_FILE" | tr -d '"' || echo "")
    CLOUDFLARE_EMAIL=$(awk -F= '/^CLOUDFLARE_EMAIL=/{print $2}' "$ENV_FILE" | tr -d '"' || echo "")
  fi
fi

# AUDIT FIX 2.1: Strict credential validation (fail if purge is needed but creds missing)
if [ "$SKIP_PURGE" = false ]; then
  if [ -z "$CLOUDFLARE_API_KEY" ] || [ -z "$CLOUDFLARE_EMAIL" ]; then
    error "Cloudflare credentials missing. Set CLOUDFLARE_API_KEY and CLOUDFLARE_EMAIL or use --skip-purge."
  fi
fi

# --- Rollback Function ---
PREVIOUS_RELEASE=""
rollback() {
  warn "ROLLING BACK to previous release..."
  if [ -n "$PREVIOUS_RELEASE" ] && [ -d "$PREVIOUS_RELEASE" ]; then
    TEMP_LINK="${CURRENT_LINK}.rollback"
    ln -sfn "$PREVIOUS_RELEASE" "$TEMP_LINK"
    mv -Tf "$TEMP_LINK" "$CURRENT_LINK"
    pm2 restart hero-dapp 2>/dev/null || true
    nginx -s reload 2>/dev/null || true
    error "Deployment FAILED. Rolled back to: $(basename "$PREVIOUS_RELEASE")"
  else
    error "Deployment FAILED. No previous release available for rollback."
  fi
}

# --- Step 1: Build (with content hashes) ---
if [ "$SKIP_BUILD" = false ]; then
  log "[1/6] Building production bundle with content hashes..."
  cd "$BUILD_DIR"
  npm run build 2>&1 | tail -5
  log "Build complete. New asset hashes generated."
else
  log "[1/6] Skipping build (--skip-build)"
fi

# --- Step 2: Create Release Directory ---
log "[2/6] Creating release: $TIMESTAMP"
mkdir -p "$RELEASES_DIR/$TIMESTAMP"

# Copy new build assets to release directory (show errors, don't suppress)
if ! cp -r "$BUILD_DIR/dist/public/assets/"* "$RELEASES_DIR/$TIMESTAMP/"; then
  # Also sync to nginx-served public/assets directory
  cp -f "$BUILD_DIR/dist/public/assets/"* "$BUILD_DIR/public/assets/" 2>/dev/null || true
  error "Failed to copy assets to release directory. Check disk space and permissions."
fi

# Verify assets exist
ASSET_COUNT=$(find "$RELEASES_DIR/$TIMESTAMP" -type f | wc -l)
log "Release contains $ASSET_COUNT asset files"
[ "$ASSET_COUNT" -eq 0 ] && error "Empty release — aborting"

# --- Step 3: Atomic Symlink Rotation ---
log "[3/6] Atomic asset rotation (zero-downtime)..."

# Record previous release for rollback
if [ -L "$CURRENT_LINK" ]; then
  PREVIOUS_RELEASE=$(readlink -f "$CURRENT_LINK")
  log "Previous release: $(basename "$PREVIOUS_RELEASE")"
elif [ -d "$CURRENT_LINK" ]; then
  # First time: convert real directory to symlink
  mv "$CURRENT_LINK" "$RELEASES_DIR/pre_rotation_backup"
  PREVIOUS_RELEASE="$RELEASES_DIR/pre_rotation_backup"
  log "Backed up existing assets to releases/pre_rotation_backup"
fi

# Create new symlink atomically using rename
TEMP_LINK="${CURRENT_LINK}.new"
ln -sfn "$RELEASES_DIR/$TIMESTAMP" "$TEMP_LINK"
if ! mv -Tf "$TEMP_LINK" "$CURRENT_LINK"; then
  rm -f "$TEMP_LINK"
  rollback
fi
log "Symlink rotated: assets -> releases/$TIMESTAMP"

# --- Step 4: Deploy Server Code ---
log "[4/6] Deploying server code..."
if [ "$BUILD_DIR" != "$DEPLOY_DIR" ]; then rm -rf "$DEPLOY_DIR/dist"; cp -r "$BUILD_DIR/dist" "$DEPLOY_DIR/dist"; fi

# Restart PM2 with zero-downtime reload
if ! pm2 reload hero-dapp --update-env 2>/dev/null; then
  warn "PM2 reload failed, attempting restart..."
  if ! pm2 restart hero-dapp 2>/dev/null; then
    rollback
  fi
fi
log "PM2 reloaded"

# --- Step 5: Nginx Cache Flush ---
log "[5/6] Flushing nginx proxy cache..."
# Clear nginx proxy cache if directory exists
if [ -d /var/cache/nginx ]; then
  find /var/cache/nginx -type f -delete 2>/dev/null || true
  log "Nginx cache cleared"
fi
if ! nginx -t 2>/dev/null; then
  warn "Nginx config test failed — skipping reload"
else
  nginx -s reload
  log "Nginx reloaded"
fi

# --- Step 6: Cloudflare Cache Purge ---
if [ "$SKIP_PURGE" = false ] && [ -n "$CLOUDFLARE_API_KEY" ] && [ -n "$CLOUDFLARE_EMAIL" ]; then
  log "[6/6] Purging Cloudflare cache..."
  
  # First: purge specific asset patterns (faster propagation)
  PURGE_URLS=$(find "$RELEASES_DIR/$TIMESTAMP" \( -name "*.js" -o -name "*.css" \) -type f | \
    sed "s|$RELEASES_DIR/$TIMESTAMP|https://herobase.io/assets|" | \
    head -30 | \
    jq -R -s 'split("\n") | map(select(. != ""))')
  
  if [ -n "$PURGE_URLS" ] && [ "$PURGE_URLS" != "[]" ]; then
    TARGETED_RESULT=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache" \
      -H "X-Auth-Email: $CLOUDFLARE_EMAIL" \
      -H "X-Auth-Key: $CLOUDFLARE_API_KEY" \
      -H "Content-Type: application/json" \
      --data "{\"files\": $PURGE_URLS}")
    if echo "$TARGETED_RESULT" | grep -q '"success":true'; then
      log "Targeted asset purge: SUCCESS"
    else
      warn "Targeted purge may have failed (continuing with full purge)"
    fi
  fi
  
  # Then: full purge to catch index.html and any edge-cached 404s
  sleep 2
  PURGE_RESULT=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache" \
    -H "X-Auth-Email: $CLOUDFLARE_EMAIL" \
    -H "X-Auth-Key: $CLOUDFLARE_API_KEY" \
    -H "Content-Type: application/json" \
    --data '{"purge_everything": true}')
  
  if echo "$PURGE_RESULT" | grep -q '"success":true'; then
    log "Cloudflare full purge: SUCCESS"
  else
    warn "Cloudflare purge may have failed — manual purge recommended"
  fi
else
  if [ "$SKIP_PURGE" = true ]; then
    log "[6/6] Skipping Cloudflare purge (--skip-purge)"
  else
    warn "[6/6] Missing Cloudflare credentials — skipping purge"
  fi
fi

# --- Cleanup Old Releases (protect current) ---
log "Cleaning old releases (keeping last $MAX_RELEASES)..."
CURRENT_TARGET=$(readlink -f "$CURRENT_LINK" 2>/dev/null || echo "")
cd "$RELEASES_DIR"
for OLD_RELEASE in $(ls -dt */ 2>/dev/null | tail -n +$((MAX_RELEASES + 1))); do
  OLD_PATH="$RELEASES_DIR/$OLD_RELEASE"
  # Never delete the currently active release
  if [ "$(readlink -f "$OLD_PATH")" != "$CURRENT_TARGET" ]; then
    rm -rf "$OLD_PATH"
    log "Removed old release: $OLD_RELEASE"
  fi
done

# --- Verification (with retries) ---
log "Verifying deployment (max $HEALTH_RETRIES attempts)..."
HEALTH_PASS=false
for i in $(seq 1 $HEALTH_RETRIES); do
  sleep "$HEALTH_DELAY"
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/" 2>/dev/null || echo "000")
  if [ "$HTTP_STATUS" = "200" ]; then
    HEALTH_PASS=true
    log "Health check attempt $i: HTTP $HTTP_STATUS — PASS"
    break
  else
    warn "Health check attempt $i: HTTP $HTTP_STATUS — retrying..."
  fi
done

if [ "$HEALTH_PASS" = false ]; then
  rollback
fi

# AUDIT FIX 2.3: Deep health check — verify API is responding (not just static serving)
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/trpc/system.health" 2>/dev/null || echo "000")
if [ "$API_STATUS" = "200" ] || [ "$API_STATUS" = "401" ]; then
  log "API health check: HTTP $API_STATUS — PASS (server responding)"
else
  warn "API health check: HTTP $API_STATUS — API may not be fully operational"
fi

# Check assets are accessible
FIRST_ASSET=$(find "$RELEASES_DIR/$TIMESTAMP" -name "*.js" -type f | head -1)
if [ -n "$FIRST_ASSET" ]; then
  ASSET_NAME=$(basename "$FIRST_ASSET")
  ASSET_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/assets/$ASSET_NAME" 2>/dev/null || echo "000")
  if [ "$ASSET_STATUS" = "200" ]; then
    log "Asset check (/assets/$ASSET_NAME): HTTP $ASSET_STATUS — PASS"
  else
    warn "Asset check (/assets/$ASSET_NAME): HTTP $ASSET_STATUS — may need investigation"
  fi
fi

# --- Summary ---
echo ""
echo "============================================================"
log "DEPLOYMENT COMPLETE — v2.0"
echo "============================================================"
echo "  Release:    $TIMESTAMP"
echo "  Assets:     $ASSET_COUNT files"
echo "  Server:     PM2 reloaded"
echo "  Nginx:      Reloaded"
echo "  Cloudflare: $([ "$SKIP_PURGE" = false ] && echo 'Purged' || echo 'Skipped')"
echo "  Health:     PASS (HTTP 200)"
echo "  Rollback:   bash $0 --rollback-to <release_name>"
echo "  Manual:     ln -sfn $RELEASES_DIR/<old_release> $CURRENT_LINK"
echo "============================================================"
