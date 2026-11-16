# Grok-4.3 chat widget — hero-dapp

Built 2026-11-16 by SEO & AEO Desk under owner VETS GO (t114u). **Staged only — Builder Fleet Ops deploys.**


## What it is
- `server/grok-chat-server.mjs` — zero-dependency Node 18+ sidecar. `POST /api/grok-chat` → xAI `grok-4.3`. Key is read from `/etc/grok-chat/<site>.env` only; never in client JS, logs, or git.
- Abuse controls: Origin allowlist, JSON-only, 16 KB body cap, 8-turn / 1200-char history cap, per-IP 6/min + 40/hr, daily cap 1500, 25 s upstream timeout; nginx `limit_req` 12 r/m burst 4 in front.
- `public/grok-chat.js` + `grok-chat.css` — vanilla embed, CSP-safe (external script + stylesheet, no inline code, model text rendered with textContent).
- `prompts/` — site prompt built only from the live site's own content (fetched 2026-11-16). No financial advice; seed-phrase safety; contact/support fallback.


| Instance | Domain | Host | Sidecar | Prompt | Guard |
|---|---|---|---|---|---|
| `herobase` | herobase.io | VDS-S | 127.0.0.1:3312 | `prompts/herobase.md` | none |
| `hero-wallet` | wallet.herobase.io | VDS-S | 127.0.0.1:3313 | `prompts/hero-wallet.md` | none |

## Test
```bash
cd grok-chat && node --test tests/server.test.mjs      # 4/4, mock upstream, no key needed

```

## Deploy (Builder Fleet Ops / host operator)
### herobase.io (`herobase`)
```bash
# on VDS-S — backup first
sudo mkdir -p /root/backups/grok-chat-$(date +%Y%m%d-%H%M) && sudo cp -a /etc/nginx /root/backups/grok-chat-$(date +%Y%m%d-%H%M)/
ss -ltn | grep -q ':3312 ' && echo "PORT 3312 BUSY - pick another and update env+snippet"
node --version   # needs >= 18
sudo useradd --system --no-create-home --shell /usr/sbin/nologin grokchat 2>/dev/null || true
sudo mkdir -p /opt/grok-chat/herobase /etc/grok-chat /var/log/grok-chat && sudo chown grokchat:grokchat /var/log/grok-chat
sudo rsync -a --delete grok-chat/ /opt/grok-chat/herobase/            # from this branch checkout
sudo install -m 0640 -o root -g grokchat grok-chat/deploy/herobase.env.example /etc/grok-chat/herobase.env
sudoedit /etc/grok-chat/herobase.env    # paste XAI_API_KEY from the vault on the host. Never commit it.
sudo cp grok-chat/deploy/grok-chat@.service /etc/systemd/system/ && sudo systemctl daemon-reload
sudo systemctl enable --now grok-chat@herobase && curl -s 127.0.0.1:3312/api/grok-chat/health
sudo cp grok-chat/deploy/nginx-grok-chat-zone.conf /etc/nginx/conf.d/grok-chat-zone.conf      # once per host
sudo cp grok-chat/deploy/nginx-grok-chat-herobase.conf /etc/nginx/snippets/grok-chat-herobase.conf
# add `include /etc/nginx/snippets/grok-chat-herobase.conf;` inside the herobase.io 443 server block
# SPA: the embed tag is already in client/index.html on this branch; deploy the app via the owner-gated Issue #43 flow AFTER the sidecar + nginx are live
sudo nginx -t && sudo systemctl reload nginx
# purge Cloudflare cache for herobase.io, then verify in a browser: bubble appears, a question gets an answer, 7th message in a minute gets 429
```
Rollback: remove the include line(s), `sudo nginx -t && sudo systemctl reload nginx`, `sudo systemctl disable --now grok-chat@herobase`.

### wallet.herobase.io (`hero-wallet`)
```bash
# on VDS-S — backup first
sudo mkdir -p /root/backups/grok-chat-$(date +%Y%m%d-%H%M) && sudo cp -a /etc/nginx /root/backups/grok-chat-$(date +%Y%m%d-%H%M)/
ss -ltn | grep -q ':3313 ' && echo "PORT 3313 BUSY - pick another and update env+snippet"
node --version   # needs >= 18
sudo useradd --system --no-create-home --shell /usr/sbin/nologin grokchat 2>/dev/null || true
sudo mkdir -p /opt/grok-chat/hero-wallet /etc/grok-chat /var/log/grok-chat && sudo chown grokchat:grokchat /var/log/grok-chat
sudo rsync -a --delete grok-chat/ /opt/grok-chat/hero-wallet/            # from this branch checkout
sudo install -m 0640 -o root -g grokchat grok-chat/deploy/hero-wallet.env.example /etc/grok-chat/hero-wallet.env
sudoedit /etc/grok-chat/hero-wallet.env    # paste XAI_API_KEY from the vault on the host. Never commit it.
sudo cp grok-chat/deploy/grok-chat@.service /etc/systemd/system/ && sudo systemctl daemon-reload
sudo systemctl enable --now grok-chat@hero-wallet && curl -s 127.0.0.1:3313/api/grok-chat/health
sudo cp grok-chat/deploy/nginx-grok-chat-zone.conf /etc/nginx/conf.d/grok-chat-zone.conf      # once per host
sudo cp grok-chat/deploy/nginx-grok-chat-hero-wallet.conf /etc/nginx/snippets/grok-chat-hero-wallet.conf
# add `include /etc/nginx/snippets/grok-chat-hero-wallet.conf;` inside the wallet.herobase.io 443 server block
# static page: also add `include /etc/nginx/snippets/grok-chat-inject-hero-wallet.conf;` inside `location / {}` (cp deploy/nginx-grok-chat-inject-hero-wallet.conf there)
sudo nginx -t && sudo systemctl reload nginx
# purge Cloudflare cache for wallet.herobase.io, then verify in a browser: bubble appears, a question gets an answer, 7th message in a minute gets 429
```
Rollback: remove the include line(s), `sudo nginx -t && sudo systemctl reload nginx`, `sudo systemctl disable --now grok-chat@hero-wallet`.

