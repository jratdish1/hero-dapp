# HERO Dapp Protected Production Deployment

## Controlling rule

Merging or pushing to `main` does **not** deploy production.

A normal release begins only with a new owner-authored comment on repository Issue #43 that exactly matches:

```text
VETS DEPLOY <lowercase-40-character-current-main-SHA>
```

The owner-command workflow validates that immutable comment, the exact current `main` SHA, and successful exact-SHA `push` runs for the required CI and repository-safety jobs. It then calls the reusable **Deploy to VPS1** workflow within the same GitHub Actions run.

The normal release path is not manually dispatchable. The reusable workflow rejects operation `deploy` unless its caller context is the owner-authored Issue #43 workflow run. This removes the detached-child authorization race and prevents a collaborator from inventing a normal-deploy correlation.

Production mutation remains blocked by the protected `production` environment and its human approval rules.

## Required GitHub configuration

The `production` environment must:

- require designated human reviewers;
- allow deployments only from `main`;
- prevent self-approval where the repository plan supports that control;
- expose only the environment-scoped production secrets listed below.

Required environment secrets:

- `VPS1_HOST`
- `VPS1_USER`
- `VPS1_SSH_KEY`
- `VPS1_KNOWN_HOSTS`
- `CF_API_TOKEN`
- `CF_ZONE_ID`

`VPS1_USER` must be a validated non-root account. Before first use, independently verify that it:

- owns `/var/www/hero-dapp`, which must be a real directory rather than a symlink;
- can fetch only the accepted `jratdish1/hero-dapp` Git origin;
- can use Git, Node, Corepack, PM2, curl, and `flock`;
- can manage the `hero-dapp` PM2 process but not unrelated services;
- does not have unrestricted passwordless sudo;
- cannot modify unrelated users, firewall rules, DNS, credentials, or infrastructure.

The Cloudflare credential must be a scoped API token rather than a global API key.

Repository rules must require the `test-build-scan` and `repository-safety` checks before merge.

## Normal release procedure

1. Confirm the intended SHA is the current tip of `main`.
2. Confirm exact-SHA `push` runs on `main` succeeded for:
   - `.github/workflows/ci.yml`, required job `test-build-scan`;
   - `.github/workflows/security-and-quality.yml`, required job `repository-safety`.
3. Confirm the protected `production` environment and non-root VPS1 account are still correctly configured.
4. Add a new owner-authored comment to Issue #43 exactly matching:

   ```text
   VETS DEPLOY <lowercase-40-character-current-main-SHA>
   ```

5. The owner-command workflow:
   - binds the correlation to the immutable Issue #43 comment ID;
   - verifies the comment author and `OWNER` association;
   - verifies the workflow run is first-attempt, owner-triggered, and based on the exact target SHA on `main`;
   - checks the exact historical SHA rather than relying on a latest-runs window;
   - rejects a previously consumed correlation;
   - calls the reusable deployment workflow directly in the same Actions run.
6. A designated reviewer approves the protected `production` environment request.
7. Require the final Issue #43 receipt and immutable artifact `production-result-<correlation>` to record:
   - requested SHA;
   - previous active SHA;
   - final active SHA;
   - deployment outcome;
   - Cloudflare purge outcome;
   - public exact-SHA verification outcome;
   - inline rollback attempted/succeeded/failed;
   - post-deploy rollback attempted/succeeded/failed;
   - final `verified` state.

A successful workflow process or PM2 PID is not sufficient. The result must prove the exact requested release is active publicly and that no rollback was attempted.

## Protected intentional rollback

Intentional rollback is a separate owner-operated path. It is used only after a completed release when a defect requires returning to a previously verified ancestor.

1. Select a target that:
   - is a different commit from current `main`;
   - remains an ancestor of current `main`;
   - has successful exact-SHA `push` evidence for both required workflows;
   - is documented as a known-good production release.
2. Record the incident, rollback reason, target SHA, approving reviewer, and tracking reference.
3. Open **Actions → Deploy to VPS1 → Run workflow** from the `main` ref.
4. Enter:
   - `commit_sha`: the verified ancestor SHA;
   - `correlation_id`: `rollback-<ticket-or-UTC-identifier>`;
   - `operation`: `rollback`;
   - `confirmation`: `ROLLBACK`;
   - leave `command_comment_id` and `command_run_id` at `0`.
5. Only the repository owner may initiate this workflow-dispatch path.
6. Obtain protected `production` environment approval.
7. Preserve the final result artifact and Issue #43 receipt.

The workflow rejects manual operation `deploy`, non-owner rollback actors, reruns, equal-to-main rollback targets, non-ancestor targets, duplicate rollback correlations, and targets without exact historical CI/security evidence.

## Authorization and duplicate-execution controls

Normal releases use a same-run reusable workflow call rather than a detached `workflow_dispatch` child. Therefore:

- a collaborator cannot manually self-assert normal-release provenance;
- no raw one-time capability is placed in workflow inputs, logs, artifacts, or issue text;
- there is no detached child run that can become orphaned after controller timeout;
- the caller and reusable workflow share the immutable owner-comment event context and run ID;
- every correlation is consumed once through a GitHub Actions bot record on Issue #43;
- same-correlation authorization attempts are serialized without canceling a pending eligible owner command;
- all production mutations are serialized by the protected workflow and an independent VPS1 `flock` writer lock.

GitHub job timeouts bound active authorization and production execution. The host lock prevents concurrent repository mutation even across different approved correlations.

## Code-enforced pre-production gates

Before any production secret is available, the authorization job verifies:

- repository, `main` ref, and first workflow attempt;
- exact SHA and correlation formats;
- Issue #43 remains open;
- normal deploys originated from the current owner Issue #43 event and same reusable workflow run;
- manual dispatch is accepted only for owner intentional rollback;
- duplicate deploy or rollback correlations do not already exist;
- the exact target has successful `push`-event CI and repository-safety jobs;
- every GitHub API request uses bounded connection and total timeouts with bounded retries.

Only after those checks pass may the protected production job request environment approval and access VPS1 or Cloudflare secrets.

## VPS1 mutation gates

The protected job:

- uses strict known-host verification, batch mode, one explicit SSH identity, and connection timeouts;
- refuses `root`;
- requires `/var/www/hero-dapp` to be non-symlinked and owned by the deployment account;
- acquires `.git/vets-production.lock` through `flock` before mutation;
- accepts only the canonical GitHub origin URLs;
- requires the complete tracked and untracked tree to be clean;
- requires a normal release to equal `origin/main`;
- requires rollback to be a different ancestor of `origin/main`;
- records the previously active SHA before mutation;
- resets to the exact requested SHA without `git pull`;
- activates pnpm `10.34.4` and requires the frozen lockfile;
- rejects `package-lock.json`;
- removes stale build output and performs the production build;
- reloads only `hero-dapp` through PM2;
- verifies checkout SHA, PM2 release identity, and public health release SHA;
- bounds health and API calls with connection and total timeouts.

## Cloudflare and public verification

Cloudflare purge occurs only after application deployment and exact-SHA health checks succeed. A purge is accepted only when:

- the HTTP request succeeds;
- API field `success` is `true`;
- the API returns zero errors.

The workflow then verifies the public health endpoint reports `ok: true` and the exact requested release SHA, and confirms the public site responds successfully.

## Rollback behavior

If installation, build, reload, PM2 identity, or health verification fails after mutation starts, the remote in-run rollback restores the previously active SHA, reinstalls its frozen dependency graph, rebuilds without historical package lifecycle hooks, reloads PM2, and requires restored exact-SHA health.

If deployment succeeds but Cloudflare or post-purge verification fails, the protected workflow performs a second bounded rollback to the previously active SHA and purges Cloudflare again.

Inline and post-deploy rollback states are recorded separately. A failed rollback is never reported as recovered.

## Prohibited paths

- Do not deploy merely by merging or pushing to `main`.
- Do not manually dispatch operation `deploy`.
- Do not run the production workflow from a non-`main` ref.
- Do not rerun either workflow; create a new owner command or new documented rollback correlation.
- Do not use `root`, unrestricted sudo, public SSH fallback, or disabled host-key verification.
- Do not deploy from a dirty, misowned, symlinked, or unexpected-origin checkout.
- Do not use `git pull`, npm lockfiles, `npm install`, `npm ci`, or `npm run build`.
- Do not invoke legacy deployment scripts or runtime deployment APIs.
- Do not use Cloudflare global API keys.
- Do not bypass environment approval, exact-SHA workflow evidence, correlation consumption, host writer locking, rollback, or public verification.
- Do not treat a missing result artifact, unknown final SHA, incomplete receipt, or canceled run as success.

## Post-release independent verification

After the protected workflow reports `verified: true`, operators may perform additional read-only checks:

```bash
for route in / /wallet /swap /portfolio /stake /community-hub /dao; do
  curl --fail --silent --show-error \
    --connect-timeout 5 --max-time 15 \
    --output /dev/null \
    --write-out "$route -> %{http_code}\n" \
    "https://herobase.io${route}"
done

curl --fail --silent --show-error \
  --connect-timeout 5 --max-time 15 \
  "https://herobase.io/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D"
```

Record route results, TLS state, browser and mobile checks, Cloudflare cache state, requested SHA, previous SHA, final active SHA, workflow run, Issue #43 receipt, and artifact digest.
