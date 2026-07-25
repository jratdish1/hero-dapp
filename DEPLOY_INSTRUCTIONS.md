# HERO Dapp Protected Production Deployment

## Controlling rule

Merging to `main` does **not** deploy production. Normal releases are initiated only by the owner-only command workflow and then executed by the GitHub Actions workflow **Deploy to VPS1** after approval from the protected `production` environment.

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

## Normal release procedure

1. Confirm the target commit is the current tip of `main`.
2. Confirm successful `push`-event runs on branch `main` for both `.github/workflows/ci.yml` and `.github/workflows/security-and-quality.yml` at that exact SHA.
3. Confirm the non-root deployment account and protected environment settings have been independently verified.
4. Open repository Issue #43 and add a new owner-authored comment exactly matching:

   ```text
   VETS DEPLOY <lowercase-40-character-current-main-SHA>
   ```

5. The owner-command workflow generates the immutable correlation `issue-43-comment-<comment-id>`, revalidates current `main`, rejects command replay, dispatches **Deploy to VPS1** with operation `deploy`, and monitors the exact correlated child run.
6. A designated reviewer approves the protected `production` environment when GitHub requests approval.
7. Require the final Issue #43 receipt and workflow artifact to show:
   - exact-SHA application deployment succeeded;
   - Cloudflare purge succeeded with API `success: true` and no errors;
   - public post-purge verification succeeded;
   - no rollback was attempted.

Do not manually invent a normal-release correlation or bypass the owner command. Workflow inputs are passed to shell commands through environment variables, not interpolated into executable shell source.

## Protected intentional rollback procedure

An intentional rollback is used only when a defect is discovered after a release has completed. It is not a substitute for ordinary forward deployment.

1. Select a previously verified commit that:
   - remains an ancestor of current `main`;
   - had successful `push`-event runs on branch `main` for both required workflows;
   - is known to have operated correctly in production.
2. Record the incident reason, rollback target SHA, approving reviewer, and tracking issue before execution.
3. Open **Actions → Deploy to VPS1 → Run workflow** from the `main` ref.
4. Enter:
   - `commit_sha`: the exact verified ancestor SHA;
   - `correlation_id`: `manual-rollback-<UTC timestamp>-<incident or ticket id>` using only letters, numbers, `.`, `_`, or `-`;
   - `operation`: `rollback`;
   - `confirmation`: `ROLLBACK`.
5. Obtain protected `production` environment approval.
6. Record the workflow run, Cloudflare purge result, health result, and final active SHA in the incident.

The workflow rejects a rollback target equal to current `main`, rejects non-ancestor targets, rejects commits without trusted historical push-to-main checks, and rejects all workflow reruns. Never perform an undocumented manual rollback on the server.

## Code-enforced release gates

Before opening an SSH session, the workflow:

- refuses to run unless the workflow ref is `refs/heads/main`;
- refuses every GitHub Actions rerun (`github.run_attempt` must equal `1`);
- validates the exact SHA, correlation, operation, and explicit confirmation;
- requires current `main` for operation `deploy`;
- permits operation `rollback` only for a different verified ancestor of current `main`;
- resolves the expected CI and security workflow IDs;
- requires successful exact-SHA `push` runs from branch `main` and their required jobs;
- retries bounded transient GitHub API failures rather than accepting missing evidence or failing on the first network hiccup.

The remote preflight then:

- validates the host and non-root username formats;
- exposes SSH secrets only to the steps that need them;
- uses strict SSH known-host verification, batch mode, a single explicit identity, and a connection timeout;
- requires Git, Node, Corepack, PM2, and curl before mutation;
- requires `/var/www/hero-dapp` to be a non-symlink directory owned by the deployment account;
- requires a normal Git checkout with an accepted exact GitHub origin URL;
- requires the complete tracked and untracked working tree to be clean;
- requires an ordinary release SHA to equal `origin/main`;
- requires an intentional rollback SHA to be a different ancestor of `origin/main`.

The deployment or rollback then:

- records the previously active SHA for bounded failure recovery;
- resets the checkout to the exact requested SHA;
- activates repository-pinned pnpm `10.34.4`;
- confirms `package-lock.json` is absent;
- runs `pnpm install --frozen-lockfile`;
- removes stale `dist` output before rebuilding;
- runs the current read-only dependency validator and production build;
- reloads `hero-dapp` through PM2;
- verifies the server checkout and PM2 release identity equal the requested SHA;
- retries the public health endpoint and requires `ok: true` plus the exact release SHA;
- restores, reinstalls, clean-builds without historical lifecycle hooks, reloads, and health-checks the previously active SHA after any post-mutation failure;
- records rollback attempted, succeeded, and failed states separately;
- purges Cloudflare through a scoped bearer token only after the application and health gates succeed;
- retries bounded Cloudflare/API and post-purge verification failures without weakening the required success conditions;
- removes ephemeral SSH key and known-host files from the runner on every outcome.

## Prohibited paths

- Do not deploy merely by merging or pushing to `main`.
- Do not launch the production workflow from a non-`main` ref.
- Do not use `root` as the production SSH principal.
- Do not grant the deployment account unrestricted sudo.
- Do not deploy from a symlinked or misowned application path, dirty working tree, or unexpected Git remote.
- Do not invoke `deploy.sh` or `deploy-production.sh`; both intentionally fail closed.
- Do not call a web or tRPC deployment endpoint; the runtime endpoint has been removed.
- Do not add package lifecycle hooks that edit or reload nginx, PM2, Git, or Cloudflare.
- Do not run `npm install`, `npm ci`, or `npm run build` for this repository.
- Do not restore `package-lock.json`.
- Do not use `git pull` on production.
- Do not bypass strict host-key checking, exact-SHA validation, workflow provenance, correlation, environment approval, or Cloudflare result validation.
- Do not use Cloudflare global API keys.
- Do not rerun either the owner-command workflow or the protected deployment workflow; issue a new owner command or a new documented rollback run instead.

## Post-release verification

The protected workflow performs the controlling health and purge gates. After it reports success, operators may independently verify expected routes without changing server state:

```bash
for route in / /wallet /swap /portfolio /stake /community-hub /dao; do
  curl --fail --silent --show-error --output /dev/null \
    --write-out "$route -> %{http_code}\n" \
    "https://herobase.io${route}"
done

curl --fail --silent --show-error \
  "https://herobase.io/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D"
```

Record the exact active release SHA, route results, response headers, TLS result, browser-console result, mobile result, Cloudflare cache status, and receipt artifact.

## Automatic failure rollback

After mutation begins, any installation, build, reload, SHA-verification, or health failure triggers an in-run rollback to the SHA active when the approved workflow began. The rollback restores that SHA, installs its frozen pnpm graph, removes stale build output, invokes Vite and esbuild directly without historical package lifecycle hooks, reloads PM2, and requires restored service health before reporting the original deployment failure.

Automatic failure rollback and intentional operator rollback are distinct. Both remain inside the protected workflow and both require immutable GitHub evidence; neither authorizes manual server mutation.
