# deploy.yml post-deploy health check: finding and proposed fix (2026-10-23)

Status: **proposal only**. Nothing has been deployed or changed on the host or in Cloudflare.
Applying the patch changes `.github/workflows/`. That needs a token with the `workflow` scope, so the owner (or Hermes) has to apply it:

```bash
git apply docs/proposals/deploy.yml.proposed.patch   # edits .github/workflows/deploy.yml in place
git rm docs/proposals/deploy.yml.proposed.patch
```

The proposal is shipped as a patch rather than a full `deploy.yml.proposed` copy. A full copy would duplicate the deploy-authorization comment phrase that the workflow checks for. That phrase must not appear in any new file.

## The endpoint is correct

- `server/_core/systemRouter.ts` defines `system.health`, input `{ timestamp: number }`. It returns `{ ok, version, releaseSha, uptime, rpc, daoGovernance }`, with `releaseSha` read from `HERO_RELEASE_SHA`.
- The router is mounted at `/api/trpc` (`server/_core/index.ts`). The transformer is superjson, so the HTTP body looks like `{"result":{"data":{"json":{"ok":true,"releaseSha":"<sha>",...}}}}`.
- I called `appRouter.createCaller(...).system.health({timestamp:0})` in-process at 4a8775f. It returned `ok: true` and `releaseSha` equal to `HERO_RELEASE_SHA`.
- So `/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D` is the right URL. No other health endpoint is needed.

## Why it returns site HTML today

1. **The live origin does not route `/api/` to Express.**
   - Through a real browser that passes the Cloudflare challenge, `GET https://herobase.io/api/trpc/system.health?...` returns `200 text/html`: the SPA `index.html`, rendered as a client-side 404. `/api/trpc/prices.ticker` behaves the same way.
   - The response headers are nginx static-file headers (`etag W/"6ad448c1-…"`, `last-modified: Sun, 18 Oct 2026 04:19:13 GMT`).
   - That is a static `dist/public` served with an SPA fallback, something like `try_files $uri $uri/ /index.html`.
   - The repo's `nginx/herobase-cache-headers.conf` uses `try_files $uri @app` with `@app` proxying to `localhost:3000`. That config is not what's live.
2. **Cloudflare challenges datacenter clients.**
   - Plain `curl` from a datacenter IP gets `HTTP 403`, `cf-mitigated: challenge`, and the "Just a moment..." HTML.
   - GitHub-hosted runners would get the same thing, so the public verify step can never pass.
3. **The old check can pass on HTML.**
   - It greps for `"ok":true` and `"releaseSha":"<sha>"` anywhere in the body, with no content-type check and no JSON parse.

## Proposed fix (`deploy.yml.proposed.patch`)

- **Remote deploy and rollback scripts (run on the VPS over SSH):**
  - Check Express directly at `http://127.0.0.1:${HERO_HEALTH_PORT:-3000}/api/trpc/system.health?...`.
  - Then check through the host nginx with `curl --resolve herobase.io:443:127.0.0.1`, and require `content-type: application/json`. This proves nginx proxies `/api/` to Express and catches the SPA-fallback regression.
  - Both responses must parse as JSON with `result.data.json.ok === true` and `releaseSha === <expected sha>`. HTML is rejected even if it contains those strings.
- **Public verify step (runner):**
  - Require `content-type: application/json`, validate with `jq`, and fail closed on challenge HTML.
  - Precondition (owner action in Cloudflare, not done here): a WAF custom rule that skips managed challenges for exactly `http.request.uri.path eq "/api/trpc/system.health"`.
- **Host precondition (owner action, not done here):** the live nginx site has to proxy `/api/` (or `@app`) to the Express process, per `nginx/herobase-cache-headers.conf`. Until it does, the new checks correctly fail.

Local validation of the patch:
- The YAML parses, and all 16 `run:` blocks plus both remote heredocs pass `bash -n`.
- Against a mock server, the JSON health body passes, a wrong SHA is rejected, and an HTML body containing `"ok":true` is rejected. The old grep accepts that HTML body.

## How live herobase.io was last deployed

- **Actions:**
  - The last successful `deploy.yml` run was 2026-06-25 (push, bbff5a0).
  - The 2026-07-25 `workflow_dispatch` run failed at "Configure strict SSH trust".
  - Later attempts recorded in Issue #43 failed on missing Actions secrets: `VPS1_USER`, `VPS1_SSH_KEY` and `VPS1_KNOWN_HOSTS` are absent. `VPS1_HOST`, `CF_API_TOKEN` and `CF_ZONE_ID` are present. I read these by name only; no values.
- **Live static files:** last modified 2026-10-18 04:19:13 UTC.
  - No Actions run happened at that time, and `main` has no commits between 2026-10-15 and 2026-10-20.
  - So the files were written to the host outside GitHub Actions, by a manual or agent copy.
  - The repo does not show which actor or commit did it.

## Related observation

The zone has Cloudflare's WebMCP preview enabled. It injects `/.webmcp/bridge.js` into every HTML response, including dapp pages. Whether to keep it is the owner's decision.
