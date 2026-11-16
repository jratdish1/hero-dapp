# HERO X feed (Hero Threads + Weekly Monster Threads)

Server-side only. Runs inside the `hero-dapp` Node process (`startMentionScheduler()` in `server/_core/index.ts`).

| What | Source | Stored in | Shown at |
|---|---|---|---|
| @HERO501c3 timeline (incl. RTs of $HERO/$VETS mentions) | X API v2 `/users/:id/tweets` | `influencer_mentions` | /media (Hero Threads / mentions) |
| @CrypMvs posts ("PulseChain Weekly Monster Thread #N") | X API v2 `/users/:id/tweets` | `mvs_content` | /community (Weekly Monster Threads, via `trpc.mvs.list`) |

Keywords: `HERO_KEYWORDS` / `VETS_KEYWORDS` in `server/twitterFetcher.ts`; Monster Thread detection regex in `server/mentionScheduler.ts`.

## Environment (set on the server, never in git)
- `X_BEARER_TOKEN` (required) — X developer app bearer token with read access to user timelines. Lives in the hero-dapp pm2 env / server `.env` on the host that runs hero-dapp.
- `X_FEED_INTERVAL_HOURS` (optional, default 4, min 1).
- `X_API_BASE_URL` (optional, default `https://api.x.com/2`).
- Legacy `BUILT_IN_FORGE_API_URL/KEY` (Manus) is retired; it is only used when `X_BEARER_TOKEN` is unset.

## Verify after deploy
1. pm2 logs hero-dapp | grep MentionScheduler → `X API v2: N tweets` and `@CrypMvs: N new posts`.
2. `curl https://herobase.io/api/trpc/mvs.list` must return JSON (not the SPA 404 page).
3. /community shows the newest Monster Thread instead of the static #51/#52 fallback.

This feature only READS X. It never posts to X.
