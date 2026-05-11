# HERO Dapp Deploy Script
# Builds and deploys to /var/www/hero-dapp (PM2 serving directory)
set -e
source /root/.nvm/nvm.sh

echo "[1/4] Building..."
cd /root/hero-dapp
npm run build

echo "[2/4] Syncing to /var/www/hero-dapp/dist..."
rm -rf /var/www/hero-dapp/dist
cp -r /root/hero-dapp/dist /var/www/hero-dapp/dist

echo "[3/4] Restarting PM2..."
pm2 restart hero-dapp

echo "[4/4] Done! hero-dapp deployed."
pm2 status hero-dapp
