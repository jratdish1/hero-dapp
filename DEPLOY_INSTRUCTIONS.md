# HERO Dapp Protected Production Deployment

## Controlling rule

Merging to `main` does **not** deploy production. Production releases are initiated only through the GitHub Actions workflow **Deploy to VPS1** and require approval from the protected `production` environment.

Direct SSH deployment, runtime API deployment, `git pull`, npm lockfiles, and manual PM2/Cloudflare operations are not authorized release paths.

## Required GitHub configuration

The `production` environment must require designated human reviewers and must expose only these environment-scoped secrets:

- `VPS1_HOST`
- `VPS1_SSH_KEY`
- `VPS1_KNOWN_HOSTS`
- `CF_API_TOKEN`
- `CF_ZONE_ID`

The Cloudflare credential must be a scoped API token, not a global API key.

## Release procedure

1. Confirm the target commit is already merged to `main`.
2. Confirm CI and Security and Quality checks pass on that exact commit.
3. Open **Actions → Deploy to VPS1 → Run workflow**.
4. Enter the exact 40-character commit SHA.
5. Enter the confirmation value `DEPLOY`.
6. Submit the run and obtain `production` environment approval.
7. Review the completed workflow and record the deployed SHA.

The workflow then performs these bounded operations:

- validates the confirmation and exact SHA format;
- uses strict SSH known-host verification;
- confirms the SHA is an ancestor of `origin/main`;
- resets the deployment checkout to that exact SHA;
- activates repository-pinned pnpm `10.34.4`;
- runs `pnpm install --frozen-lockfile`;
- runs `pnpm build`;
- reloads `hero-dapp` through PM2;
- verifies the server checkout still equals the requested SHA;
- purges Cloudflare through a scoped bearer token only after success.

## Prohibited paths

- Do not deploy merely by merging or pushing to `main`.
- Do not invoke `deploy.sh` or `deploy-production.sh`; both intentionally fail closed.
- Do not call a web or tRPC deployment endpoint; the runtime endpoint has been removed.
- Do not run `npm install`, `npm ci`, or `npm run build` for this repository.
- Do not restore `package-lock.json`.
- Do not use `git pull` on production.
- Do not bypass strict host-key checking.
- Do not use Cloudflare global API keys.

## Post-release verification

After an approved workflow reports success, verify the expected release routes and health endpoint without changing server state:

```bash
for route in / /wallet /swap /portfolio /stake /community-hub /dao; do
  curl --fail --silent --show-error --output /dev/null \
    --write-out "$route -> %{http_code}\n" \
    "https://herobase.io${route}"
done

curl --fail --silent --show-error \
  "https://herobase.io/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D"
```

## Rollback

Rollback is another protected workflow run using a previously verified commit that remains an ancestor of `main`. Record the reason, target SHA, approval, workflow run, health result, and final active SHA. Never perform an undocumented manual rollback on the server.
