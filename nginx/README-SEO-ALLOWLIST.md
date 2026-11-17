# herobase.io SEO nginx allowlist

Install at deploy time on VDS-S (do not restart nginx; test then reload):

1. Copy `herobase-seo-map.conf` to `/etc/nginx/conf.d/herobase-seo-map.conf` (http context).
2. Copy `herobase-spa-allowlist.conf` to `/etc/nginx/snippets/herobase-spa-allowlist.conf`.
3. In both the `:80` and `:443` `herobase.io` server blocks, `include` the snippet. Keep the existing `root` (currently `/opt/hero-dapp/dist/public`).
4. `nginx -t && nginx -s reload`.

The snippet:

- 301s App.tsx redirect aliases (`/farm` → `/bootcamp`, `/nfts` → `/nft`, etc.)
- trims trailing slashes on real routes
- serves prerendered `/<route>/index.html` for known SPA routes
- returns a real 404 (via `/404.html`) for unknown paths such as `/wp-login.php`, `/wp-json/`, `/sitemap_index.xml`

Do not add a catch-all `try_files ... /index.html` fallback. The Vite build runs `scripts/prerender-seo-routes.mjs` to write the per-route HTML, sitemap (`lastmod` = build date), robots.txt, and `404.html` into `dist/public`.

# Incident protections (restored 2026-11-16)

Also install, without loosening the SEO allowlist:

1. `hero-incident-trpc-block.conf` → `/etc/nginx/conf.d/` (http-context map).
2. `herobase-incident.conf` → `/etc/nginx/snippets/` and include it in both herobase.io server blocks. This adds the tRPC write 403, `/swap` and `/nft` maintenance page, and the `/api` + `/trpc` proxy to `127.0.0.1:3000`.
3. `wallet-incident.conf` similarly for wallet.herobase.io (write block + maintenance; no API proxy).
4. Copy `client/public/maintenance-swap-nft.html` into both docroots. The revoke link is https://vicfoundation.com/ (not revoke.cash).
5. `nginx -t && nginx -s reload`.

`/swap` and `/nft` are omitted from the sitemap and prerendered with `noindex`.
