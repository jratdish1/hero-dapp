#!/usr/bin/env bash
# HERO Dapp deployment helper. This script does not authorize deployment;
# it must be invoked only through an approved production change window.
set -euo pipefail

[ -f /root/.nvm/nvm.sh ] && source /root/.nvm/nvm.sh

APP_DIR="/root/hero-dapp"
DEPLOY_DIR="/var/www/hero-dapp"
PNPM_VERSION="10.34.4"

echo "[1/5] Activating pnpm $PNPM_VERSION..."
corepack enable
corepack prepare "pnpm@$PNPM_VERSION" --activate
test "$(pnpm --version)" = "$PNPM_VERSION"

echo "[2/5] Installing frozen dependencies..."
cd "$APP_DIR"
pnpm install --frozen-lockfile

echo "[3/5] Building..."
pnpm build

echo "[4/5] Syncing dist..."
rm -rf "$DEPLOY_DIR/dist"
cp -r "$APP_DIR/dist" "$DEPLOY_DIR/dist"

echo "[5/5] Reloading PM2..."
pm2 reload hero-dapp --update-env
pm2 status hero-dapp
