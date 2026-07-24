# HERO Dapp Protected Production Deployment

## Controlling rule

Merging to `main` does **not** deploy production. Production releases are initiated only through the GitHub Actions workflow **Deploy to VPS1** and require approval from the protected `production` environment.

Direct SSH deployment, runtime API deployment, package lifecycle deployment, `git pull`, npm lockfiles, and manual PM2/nginx/Cloudflare operations are not authorized release paths.

## Required GitHub configuration

The `production` environment must require designated human reviewers and must expose only these environment-scoped secrets:

- `VPS1_HOST`
- `VPS1_SSH_KEY`
- `VPS1_KNOWN_HOSTS`
- `CF_API_TOKEN`
- `CF_ZONE_ID`

The Cloudflare credential must be a scoped API token, not a global API key. Branch protection or a repository ruleset must require the `test-build-scan` and `repository-safety` checks before merge.

## Release procedure

1. Confirm the target commit is already merged to `main`.
2. Confirm CI and Security and Quality checks pass on that exact commit.
3. Open **Actions → Deploy to VPS1 → Run workflow**.
4. Enter the exact lowercase 40-character commit SHA.
5. Enter the confirmation value `DEPLOY`.
6. Submit the run and obtain `production` environment approval.
7. Review the completed workflow and record the deployed SHA and health result.

Workflow inputs are passed to shell commands through environment variables, not interpolated into executable shell source.

## Code-enforced release gates

Before opening an SSH session, the workflow:

- validates the exact SHA and explicit confirmation;
- queries GitHub check runs for the requested SHA;
- requires completed successful `test-build-scan` and `repository-safety` checks;
- refuses the release when either required exact-SHA check is absent or unsuccessful.

The deployment then:

- uses strict SSH known-host verification, batch mode, a single explicit identity, and a connection timeout;
- confirms the SHA is an ancestor of `origin/main`;
- records the previously active SHA for bounded rollback;
- resets the deployment checkout to the exact requested SHA;
- activates repository-pinned pnpm `10.34.4`;
- confirms `package-lock.json` is absent;
- runs `pnpm install --frozen-lockfile`;
- runs `pnpm build`;
- reloads `hero-dapp` through PM2;
- verifies the server checkout still equals the requested SHA;
- retries the public health endpoint and requires an `ok: true` response;
- restores, rebuilds, and reloads the previously active SHA if the approved deployment fails before health verification;
- purges Cloudflare through a scoped bearer token only after the deployment and health gate succeed;
- removes ephemeral SSH key and known-host files from the runner on every outcome.

## Prohibited paths

- Do not deploy merely by merging or pushing to `main`.
- Do not invoke `deploy.sh` or `deploy-production.sh`; both intentionally fail closed.
- Do not call a web or tRPC deployment endpoint; the runtime endpoint has been removed.
- Do not add package lifecycle hooks that edit or reload nginx, PM2, Git, or Cloudflare.
- Do not run `npm install`, `npm ci`, or `npm run build` for this repository.
- Do not restore `package-lock.json`.
- Do not use `git pull` on production.
- Do not bypass strict host-key checking or exact-SHA successful-check verification.
- Do not use Cloudflare global API keys.

## Post-release verification

The workflow performs the controlling health gate. After it reports success, operators may independently verify expected routes without changing server state:

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

A failure before health verification triggers an in-run rollback to the SHA that was active when the approved workflow began. The workflow rebuilds that previous SHA with its frozen pnpm lock and reloads PM2 before reporting failure.

An intentional rollback is a separate protected workflow run using a previously verified commit that remains an ancestor of `main`. Record the reason, target SHA, approving reviewer, workflow run, health result, and final active SHA. Never perform an undocumented manual rollback on the server.
