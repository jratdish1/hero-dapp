# Cloudflare Cache Rules for herobase.io

## Problem Solved
Cloudflare was caching 404 responses for assets during deployment windows. When new hashed assets were deployed but the old Cloudflare edge cache still held 404s for those filenames, users got blank pages.

## Solution: Cache Rules (replaces Page Rules)

### Rule 1: Assets — Cache Everything (Respect Origin Headers)
- **Match:** `herobase.io/assets/*`
- **Action:** Cache Level = Cache Everything
- **Edge TTL:** Respect Origin (origin sends `max-age=31536000, immutable`)
- **Browser TTL:** Respect Origin
- **Origin Cache Control:** ON (this is the key — lets origin `Cache-Control` drive behavior)

### Rule 2: HTML Pages — Bypass Cache
- **Match:** `herobase.io/*.html` OR when `Accept: text/html`
- **Action:** Cache Level = Bypass
- **Reason:** HTML must always be fresh to reference latest asset hashes

### Rule 3: API — Bypass Cache
- **Match:** `herobase.io/api/*` OR `herobase.io/trpc/*`
- **Action:** Cache Level = Bypass

## Why This Prevents the 404 Caching Issue

1. **Origin Cache Control ON** means Cloudflare respects the `Cache-Control` header from nginx/Express
2. If nginx returns a 404 (asset not yet deployed), it does NOT send `max-age=31536000` — it sends the default short TTL
3. Only valid 200 responses with the immutable header get long-term cached
4. The deploy script purges after assets are confirmed in place, so the first request post-purge always hits origin and gets the correct 200

## Deploy Script Integration
The `deploy-production.sh` script:
1. Deploys assets atomically (symlink rotation)
2. Reloads nginx
3. Purges Cloudflare (targeted + full)
4. Verifies assets return 200 before completing

This eliminates the window where Cloudflare could cache a 404.
