# Deploy Instructions for herobase.io Audit Fixes

**Date:** May 27, 2026  
**Commit:** Pushed to `jratdish1/hero-dapp` (main branch)  
**Status:** Code pushed to GitHub, awaiting deploy on VPS1

## Quick Deploy (SSH into VPS1 from VDS-M)

```bash
# From VDS-M:
ssh vps1

# On VPS1:
cd /var/www/hero-dapp
git pull origin main
npm run build
pm2 reload hero-dapp

# Purge Cloudflare (using env vars from /root/.env_architecture):
source /root/.env_architecture
curl -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache" \
  -H "X-Auth-Email: ${CLOUDFLARE_EMAIL}" \
  -H "X-Auth-Key: ${CLOUDFLARE_API_KEY}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

## What Was Fixed (Audit Fixes)

1. **CSP Hardening** - Replaced `unsafe-inline` with nonce-based script policy for production
2. **Timing-Safe Auth** - Fixed `safeCompare` length leak in standalone-auth.ts  
3. **DAO Anchoring** - Wired on-chain proposal anchoring into main router
4. **Spin Error Handling** - Added try/catch with user-friendly error to spin execute mutation

## Verification After Deploy

```bash
# Test all routes
for route in / /wallet /swap /portfolio /stake /community-hub /dao; do
  curl -s -o /dev/null -w "$route → %{http_code}\n" "https://herobase.io${route}"
done

# Test tRPC
curl -s "https://herobase.io/api/trpc/system.health?input=%7B%22json%22%3A%7B%7D%7D"
```

## Notes
- SSH key (`vds_key`) must be provided at session start for scheduled tasks
- VDS-M fail2ban may block sandbox IPs — consider whitelisting Manus IP range
- Consider adding a GitHub Actions workflow for automated deploys
