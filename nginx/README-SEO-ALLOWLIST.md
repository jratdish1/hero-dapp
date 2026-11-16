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
