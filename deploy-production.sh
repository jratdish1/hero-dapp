#!/bin/bash
# ============================================================
# HERO Dapp Production Deploy Script
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
BUILD_DIR="/root/hero-dapp"
CLOUDFLARE_ZONE_ID="1f894ca8151cd3419688c8a87ce9f5e3"  # herobase.io zone
CLOUDFLARE_API_KEY="${CLOUDFLARE_API_KEY:-}"
CLOUDFLARE_EMAIL="${CLOUDFLARE_EMAIL:-}"

# Auth method: X-Auth-Email + X-Auth-Key (Global API Key)
# NOT Bearer token (which requires a scoped API token)
NGINX_ASSETS_ROOT="/var/www/hero-dapp/public/assets"
RELEASES_DIR="/var/www/hero-dapp/releases"
CURRENT_LINK="/var/www/hero-dapp/public/assets"
MAX_RELEASES=5  # Keep last N releases for instant rollback
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

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
  esac
done

# --- Pre-flight Checks ---
log "Pre-flight checks..."
command -v node >/dev/null || error "Node.js not found"
command -v npm >/dev/null || error "npm not found"
command -v pm2 >/dev/null || error "PM2 not found"
command -v nginx >/dev/null || error "nginx not found"

# Load NVM if available
[ -f /root/.nvm/nvm.sh ] && source /root/.nvm/nvm.sh

# Load Cloudflare credentials from env_architecture if not set
if [ -z "$CLOUDFLARE_API_KEY" ]; then
  if [ -f /root/.env_architecture ]; then
    CLOUDFLARE_API_KEY=$(grep -oP 'CF_GLOBAL_API_KEY=\K.*' /root/.env_architecture 2>/dev/null || echo "")
    CLOUDFLARE_EMAIL=$(grep -oP 'CLOUDFLARE_EMAIL=\K.*' /root/.env_architecture 2>/dev/null || echo "")
  fi
fi

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

# Copy new build assets to release directory
cp -r "$BUILD_DIR/dist/public/assets/"* "$RELEASES_DIR/$TIMESTAMP/" 2>/dev/null || \
  error "No assets found in build output"

# Verify assets exist
ASSET_COUNT=$(find "$RELEASES_DIR/$TIMESTAMP" -type f | wc -l)
log "Release contains $ASSET_COUNT asset files"
[ "$ASSET_COUNT" -eq 0 ] && error "Empty release — aborting"

# --- Step 3: Atomic Symlink Rotation ---
log "[3/6] Atomic asset rotation (zero-downtime)..."

# If current assets dir is a real directory (first time), convert to symlink
if [ -d "$CURRENT_LINK" ] && [ ! -L "$CURRENT_LINK" ]; then
  # Backup existing assets
  mv "$CURRENT_LINK" "$RELEASES_DIR/pre_rotation_backup"
  log "Backed up existing assets to releases/pre_rotation_backup"
fi

# Create new symlink atomically using rename
TEMP_LINK="${CURRENT_LINK}.new"
ln -sfn "$RELEASES_DIR/$TIMESTAMP" "$TEMP_LINK"
mv -Tf "$TEMP_LINK" "$CURRENT_LINK"
log "Symlink rotated: assets -> releases/$TIMESTAMP"

# --- Step 4: Deploy Server Code ---
log "[4/6] Deploying server code..."
rm -rf "$DEPLOY_DIR/dist"
cp -r "$BUILD_DIR/dist" "$DEPLOY_DIR/dist"

# Restart PM2 with zero-downtime reload
pm2 reload hero-dapp --update-env 2>/dev/null || pm2 restart hero-dapp
log "PM2 reloaded"

# --- Step 5: Nginx Cache Flush ---
log "[5/6] Flushing nginx proxy cache..."
# Clear nginx fastcgi/proxy cache if configured
if [ -d /var/cache/nginx ]; then
  find /var/cache/nginx -type f -delete 2>/dev/null
  log "Nginx cache cleared"
fi
nginx -s reload
log "Nginx reloaded"

# --- Step 6: Cloudflare Cache Purge ---
if [ "$SKIP_PURGE" = false ] && [ -n "$CLOUDFLARE_API_KEY" ]; then
  log "[6/6] Purging Cloudflare cache..."
  
  # First: purge specific asset patterns (faster propagation)
  PURGE_URLS=$(find "$RELEASES_DIR/$TIMESTAMP" -type f -name "*.js" -o -name "*.css" | \
    sed "s|$RELEASES_DIR/$TIMESTAMP|https://herobase.io/assets|" | \
    head -30 | \
    jq -R -s 'split("\n") | map(select(. != ""))')
  
  if [ -n "$PURGE_URLS" ] && [ "$PURGE_URLS" != "[]" ]; then
    curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache" \
      -H "X-Auth-Email: $CLOUDFLARE_EMAIL" \
      -H "X-Auth-Key: $CLOUDFLARE_API_KEY" \
      -H "Content-Type: application/json" \
      --data "{\"files\": $PURGE_URLS}" > /dev/null
    log "Targeted asset purge sent"
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
    warn "Cloudflare purge may have failed: $PURGE_RESULT"
  fi
else
  if [ "$SKIP_PURGE" = true ]; then
    log "[6/6] Skipping Cloudflare purge (--skip-purge)"
  else
    warn "[6/6] No CLOUDFLARE_API_KEY set — skipping purge"
  fi
fi

# --- Cleanup Old Releases ---
log "Cleaning old releases (keeping last $MAX_RELEASES)..."
cd "$RELEASES_DIR"
ls -dt */ 2>/dev/null | tail -n +$((MAX_RELEASES + 1)) | xargs rm -rf 2>/dev/null || true

# --- Verification ---
log "Verifying deployment..."
sleep 2
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/" 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
  log "Health check: HTTP $HTTP_STATUS — PASS"
else
  warn "Health check: HTTP $HTTP_STATUS — server may still be starting"
fi

# Check assets are accessible
FIRST_ASSET=$(find "$RELEASES_DIR/$TIMESTAMP" -name "*.js" -type f | head -1)
if [ -n "$FIRST_ASSET" ]; then
  ASSET_NAME=$(basename "$FIRST_ASSET")
  ASSET_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/assets/$ASSET_NAME" 2>/dev/null || echo "000")
  log "Asset check (/assets/$ASSET_NAME): HTTP $ASSET_STATUS"
fi

# --- Summary ---
echo ""
echo "============================================================"
log "DEPLOYMENT COMPLETE"
echo "============================================================"
echo "  Release:    $TIMESTAMP"
echo "  Assets:     $ASSET_COUNT files"
echo "  Server:     PM2 reloaded"
echo "  Nginx:      Reloaded"
echo "  Cloudflare: $([ "$SKIP_PURGE" = false ] && echo 'Purged' || echo 'Skipped')"
echo "  Rollback:   ln -sfn $RELEASES_DIR/<old_release> $CURRENT_LINK"
echo "============================================================"
