# HERO Dapp Protected Production Deployment

## Controlling rule

Merging to `main` does **not** deploy production. Production releases are initiated only through the GitHub Actions workflow **Deploy to VPS1** and require approval from the protected `production` environment.

Direct SSH deployment, runtime API deployment, package lifecycle deployment, `git pull`, npm lockfiles, and manual PM2/nginx/Cloudflare operations are not authorized release paths.

## Required GitHub and VPS configuration

The `production` environment must require designated human reviewers, allow deployment only from `main`, and expose only these environment-scoped secrets:

- `VPS1_HOST`
- `VPS1_USER`
- `VPS1_SSH_KEY`
- `VPS1_KNOWN_HOSTS`
- `CF_API_TOKEN`
- `CF_ZONE_ID`

`VPS1_USER` must be a validated non-root account. Before deployment activation, an administrator must independently provision and verify that this account:

- owns `/var/www/hero-dapp` as a real directory rather than a symlink;
- can fetch the exact repository from an accepted GitHub origin URL;
- can use Git, Node, Corepack, curl, and the installed pnpm toolchain;
- owns or can manage only the `hero-dapp` PM2 process;
- does not have unrestricted passwordless sudo;
- cannot modify unrelated services, users, firewall rules, DNS, or credentials.

The Cloudflare credential must be a scoped API token, not a global API key. Branch protection or a repository ruleset must require the `test-build-scan` and `repository-safety` checks before merge.

## Release procedure

1. Confirm the target commit is already merged to `main`.
2. Confirm the latest CI and Security and Quality checks pass on that exact commit.
3. Confirm the non-root deployment account and protected environment settings have been independently verified.
4. Open **Actions → Deploy to VPS1 → Run workflow** from the `main` ref.
5. Enter the exact lowercase 40-character commit SHA.
6. Enter the confirmation value `DEPLOY`.
7. Submit the run and obtain `production` environment approval.
8. Review the completed workflow and record the deployed SHA and health result.

Workflow inputs are passed to shell commands through environment variables, not interpolated into executable shell source.

## Code-enforced release gates

Before opening an SSH session, the workflow:

- refuses to run unless the workflow ref is `refs/heads/main`;
- validates the exact SHA and explicit confirmation;
- queries GitHub check runs for the requested SHA;
- selects the latest trusted GitHub Actions run for each required check name;
- requires completed successful `test-build-scan` and `repository-safety` checks;
- refuses the release when either latest exact-SHA check is absent, external, incomplete, or unsuccessful.

The remote preflight then:

- validates the host and non-root username formats;
- exposes SSH secrets only to the steps that need them;
- uses strict SSH known-host verification, batch mode, a single explicit identity, and a connection timeout;
- requires Git, Node, Corepack, PM2, and curl before mutation;
- requires `/var/www/hero-dapp` to be a non-symlink directory owned by the deployment account;
- requires a normal Git checkout with an accepted exact GitHub origin URL;
- requires the tracked working tree to be clean;
- confirms the requested SHA is an ancestor of `origin/main`.

The deployment then:

- records the previously active SHA for bounded rollback;
- resets the checkout to the exact requested SHA;
- activates repository-pinned pnpm `10.34.4`;
- confirms `package-lock.json` is absent;
- runs `pnpm install --frozen-lockfile`;
- removes stale `dist` output before rebuilding;
- runs the current read-only dependency validator and production build;
- reloads `hero-dapp` through PM2;
- verifies the server checkout still equals the requested SHA;
- retries the public health endpoint and requires an `ok: true` response;
- restores, reinstalls, clean-builds without historical lifecycle hooks, reloads, and health-checks the previously active SHA after any post-mutation failure;
- purges Cloudflare through a scoped bearer token only after the deployment and health gate succeed;
- removes ephemeral SSH key and known-host files from the runner on every outcome.

## Prohibited paths

- Do not deploy merely by merging or pushing to `main`.
- Do not launch the production workflow from a non-`main` ref.
- Do not use `root` as the production SSH principal.
- Do not grant the deployment account unrestricted sudo.
- Do not deploy from a symlinked or misowned application path, dirty tracked tree, or unexpected Git remote.
- Do not invoke `deploy.sh` or `deploy-production.sh`; both intentionally fail closed.
- Do not call a web or tRPC deployment endpoint; the runtime endpoint has been removed.
- Do not add package lifecycle hooks that edit or reload nginx, PM2, Git, or Cloudflare.
- Do not run `npm install`, `npm ci`, or `npm run build` for this repository.
- Do not restore `package-lock.json`.
- Do not use `git pull` on production.
- Do not bypass strict host-key checking, exact-SHA validation, or latest trusted check verification.
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

After mutation begins, any installation, build, reload, SHA-verification, or health failure triggers an in-run rollback to the SHA active when the approved workflow began. The rollback restores that SHA, installs its frozen pnpm graph, removes stale build output, invokes Vite and esbuild directly without historical package lifecycle hooks, reloads PM2, and requires restored service health before reporting the original deployment failure.

An intentional rollback is a separate protected workflow run from `main` using a previously verified commit that remains an ancestor of `main`. Record the reason, target SHA, approving reviewer, workflow run, health result, and final active SHA. Never perform an undocumented manual rollback on the server.
