# HERO Dapp Protected Production Deployment

## Controlling rule

Merging or pushing to `main` does **not** deploy production.

A normal release begins only with a new owner-authored comment on repository Issue #43 that exactly matches:

```text
VETS DEPLOY <lowercase-40-character-current-main-SHA>
```

The owner-command workflow validates the immutable comment, current `main`, exact-SHA push CI/security evidence, first-attempt owner identity, and an unused correlation. It then calls the reusable **Deploy to VPS1** workflow in the same GitHub Actions run and event context.

Normal deployment is not manually dispatchable. Manual workflow dispatch exists only for a separately owner-authorized intentional rollback.

Production mutation remains behind the protected `production` environment and its required human approval.

## Required GitHub configuration

The `production` environment must:

- require designated human reviewers;
- allow deployments only from `main`;
- prevent self-approval where the repository plan supports that control;
- expose only the six environment-scoped production secrets below.

Required environment secrets:

- `VPS1_HOST`
- `VPS1_USER`
- `VPS1_SSH_KEY`
- `VPS1_KNOWN_HOSTS`
- `CF_API_TOKEN`
- `CF_ZONE_ID`

Before any SSH connection, the workflow checks every secret by name without printing its value. It also requires:

- a valid host and non-root Unix username;
- a 32-character hexadecimal Cloudflare zone ID;
- a private key that `ssh-keygen -y` can parse within a bounded timeout;
- a `known_hosts` entry that represents `VPS1_HOST`.

A missing or malformed secret fails before production mutation and identifies only the secret name or failed validation class.

`VPS1_USER` must own the real, non-symlinked `/var/www/hero-dapp` directory, fetch only the accepted `jratdish1/hero-dapp` origin, use Git/Node/Corepack/PM2/curl/`flock`, manage only the `hero-dapp` PM2 process, and have no unrestricted passwordless sudo or unrelated infrastructure authority.

The Cloudflare credential must be a scoped API token, never a global API key.

Repository rules must require `test-build-scan` and `repository-safety` before merge.

## Normal release procedure

1. Confirm the intended SHA is the current tip of `main`.
2. Confirm exact-SHA `push` runs on branch `main` passed for:
   - `.github/workflows/ci.yml`, job `test-build-scan`;
   - `.github/workflows/security-and-quality.yml`, job `repository-safety`.
3. Confirm the protected environment, six secrets, and restricted VPS1 account are configured.
4. Add the exact owner command to open Issue #43.
5. The command workflow binds correlation `issue-43-comment-<comment-id>`, validates owner/event/run provenance, records the exact authorizing CI and Security run IDs, rejects reuse, and calls the reusable deployment workflow in the same run.
6. A designated reviewer approves the `production` environment request.
7. Preserve the final Issue #43 receipt and the immutable artifact `production-result-<correlation>` in every outcome.

The immutable artifact is controlling evidence. It records the exact authorizing workflow runs and whether the final Issue receipt posted successfully. A transient comment-API failure does not roll back an otherwise exact-SHA-verified application release; the artifact is uploaded with `receipt_posted: false`, and the workflow then fails its final receipt gate so the release cannot be reported fully verified.

## Protected intentional rollback

Intentional rollback is a distinct owner-operated path for a previously verified ancestor. It does **not** depend on Issue #43 remaining open.

1. Select a target that is different from current `main`, remains an ancestor of current `main`, has successful exact-SHA push CI/security evidence, and is documented as known-good.
2. Record the incident, reason, target SHA, approving reviewer, and tracking reference.
3. Run **Deploy to VPS1** from `main` with:
   - `commit_sha`: verified ancestor SHA;
   - `correlation_id`: `rollback-<ticket-or-UTC-identifier>`;
   - `operation`: `rollback`;
   - `confirmation`: `ROLLBACK`;
   - `command_comment_id`: `0`;
   - `command_run_id`: `0`.
4. Only the repository owner may initiate the dispatch.
5. Obtain protected-environment approval.
6. Preserve the authorization/result ledger comments when GitHub permits and always preserve the immutable result artifact.

A closed Issue #43 does not disable emergency rollback. A locked or unavailable ledger that prevents correlation consumption fails closed before mutation.

## Authorization and duplicate-execution controls

- Normal releases use a same-run reusable workflow call, not a detached child dispatch.
- The caller and reusable workflow share the immutable owner-comment event and run ID.
- Manual collaborators cannot self-assert normal deployment provenance.
- Deploy and rollback correlations are serialized and consumed once before environment access.
- Correlation lookup paginates the complete Issue #43 ledger and fails closed if the ledger cannot be exhausted safely.
- A correlation-consumption POST is attempted once; if its response is ambiguous, the workflow re-reads the complete ledger and accepts exactly one matching record rather than issuing a duplicate POST.
- Production mutations are serialized by GitHub concurrency and an independent VPS1 `flock` lock.
- GitHub API calls use bounded connection/overall timeouts and bounded retries where retrying is safe.

## Pre-production evidence gates

Before any production secret is available, authorization verifies:

- canonical repository, `main` ref, and first workflow attempt;
- exact SHA/correlation formats;
- open Issue #43 for normal deploy only;
- owner-authored immutable deploy comment and same-run provenance;
- owner-only workflow dispatch for rollback;
- unused deploy/rollback correlation;
- exact target `push` CI and repository-safety workflow/job success;
- preservation of the exact authorizing CI and Security workflow run IDs in the consumption record, final Issue receipt, and immutable result;
- ancestor relationship for intentional rollback.

## VPS1 mutation gates

The protected job:

- validates all six secret names and SSH trust material before connection;
- uses strict host-key checking, batch mode, one explicit key, keepalives, and timeouts;
- refuses `root`;
- requires the real app directory to be owned by the deployment account;
- accepts only canonical GitHub origins;
- requires the complete tracked and untracked tree to be clean;
- records the previous SHA and acquires `.git/vets-production.lock`;
- requires normal release SHA to equal `origin/main`;
- requires rollback SHA to be a different ancestor of `origin/main`;
- activates pnpm `10.34.4`, rejects `package-lock.json`, and uses frozen installation;
- removes stale build output, rebuilds, reloads only `hero-dapp`, and verifies Git/PM2/public health SHA identity.

Immediately before the first production mutation, the remote script emits `VETS_MUTATION_STARTED=true`. The runner records this marker. If the SSH session, runner, or terminal result is interrupted after the marker and inline rollback is not verified successful, the separate bounded rollback path restores the previous SHA. A pre-mutation failure does not invoke application rollback. The protected job reserves enough time for the bounded deployment attempt, the full separate rollback window, evidence capture, and cleanup.

## Cloudflare and public verification

Cloudflare purge occurs only after exact-SHA application deployment succeeds. Purge passes only when:

- the HTTP request succeeds;
- JSON field `success` is `true`;
- the `errors` array is empty.

The workflow then requires the public health endpoint to report `ok: true` and the exact requested release SHA, and requires the public homepage to respond successfully.

## Rollback and receipt truth

The remote inline rollback covers install/build/reload/identity/health failures after mutation starts. The separate rollback covers:

- interrupted SSH or runner execution after the mutation marker when inline recovery is not verified;
- Cloudflare purge failure after successful deployment;
- public post-purge verification failure.

The immutable result records:

- requested, previous, and final active SHAs;
- whether mutation began;
- deploy, purge, public verification, and final-state outcomes;
- inline rollback attempted/succeeded/failed;
- post-deploy rollback attempted/succeeded/failed;
- rollback purge outcome;
- exact authorizing CI and Security workflow run IDs;
- application-state verification before receipt publication;
- receipt-posted boolean and receipt step outcome;
- final verified boolean, which requires both exact application state and the required Issue receipt.

A transient Issue-comment failure does not trigger application rollback and does not erase exact production truth. It is recorded as `receipt_posted: false` in the mandatory artifact, the artifact is uploaded, and the workflow concludes failure at the final receipt gate.

## Prohibited paths

- No deployment merely by merge or push.
- No manual dispatch of operation `deploy`.
- No non-`main` production workflow ref.
- No workflow rerun; create a new owner command or rollback correlation.
- No root deployment, unrestricted sudo, public SSH fallback, or disabled host verification.
- No dirty, misowned, symlinked, or unexpected-origin checkout.
- No `git pull`, npm lockfile, npm install/build path, legacy deploy script, or runtime deploy API.
- No Cloudflare global API key.
- No bypass of environment approval, exact-SHA evidence, correlation consumption, writer locking, rollback, purge validation, or public verification.
- No claim of success from a missing artifact, missing Issue receipt, unknown final SHA, or false `verified` state.

## Post-release independent verification

After the protected workflow artifact reports `verified: true`, perform read-only route and health verification:

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

Record route results, TLS state, browser/mobile checks, Cloudflare cache state, requested/previous/final SHAs, authorizing CI/Security run IDs, workflow run, receipt status, artifact name, and artifact digest.
