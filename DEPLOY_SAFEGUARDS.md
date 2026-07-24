# HERO Dapp Production Deployment Safeguards

## Security objective

Production deployment is a separate, human-approved release action. A merge must never imply deployment, and no application endpoint, shell helper, package lifecycle hook, or bearer token may bypass the protected GitHub environment.

## Permanent controls

### 1. One package manager and one lockfile

- Canonical package manager: pnpm `10.34.4`.
- Canonical dependency graph: `pnpm-lock.yaml`.
- `package-lock.json` is prohibited.
- Every install used for CI or production is `pnpm install --frozen-lockfile`.
- Build-time scripts validate dependencies but never install, delete, or mutate them.

### 2. Merge and deployment are separated

- The deployment workflow has no `push` trigger.
- A human must invoke `workflow_dispatch` from the `main` ref.
- The deployment job refuses non-`main` workflow refs.
- The `production` environment deployment-branch policy must allow only `main`.
- The requester must supply an exact lowercase 40-character commit SHA already merged to `main`.
- The requester must enter the explicit confirmation value `DEPLOY`.
- Inputs are consumed through environment variables and are never interpolated into shell source.
- The GitHub `production` environment must require human approval.
- Concurrency allows only one VPS1 production deployment at a time and does not cancel an active release.

### 3. Exact release identity and latest trusted check enforcement

Before changing runtime state, the workflow:

1. validates the workflow ref, SHA, and confirmation;
2. queries GitHub check runs for the requested SHA;
3. selects the latest check-run ID for each required name;
4. requires those checks to originate from GitHub Actions;
5. requires successful completed `test-build-scan` and `repository-safety` checks;
6. fetches `origin/main` on the server;
7. resolves the requested object as a commit;
8. verifies it is an ancestor of `origin/main`;
9. records the previously active SHA;
10. resets the server checkout to the exact requested SHA;
11. verifies the active checkout still equals the requested SHA after build and reload.

The workflow never deploys an ambiguous branch tip, an unmerged commit, a stale earlier successful check superseded by a newer failure, or an exact SHA without both required trusted repository checks.

### 4. SSH and credential controls

- Strict host-key verification is mandatory.
- `VPS1_KNOWN_HOSTS` is environment-scoped.
- Batch mode, a connection timeout, and a single explicit identity are required.
- SSH secrets are scoped only to the steps that need them.
- Ephemeral SSH key and known-host files are removed on every workflow outcome.
- Cloudflare uses a scoped API bearer token.
- Global API keys and email/key authentication are prohibited.
- Production secrets belong to the protected `production` environment, not general repository scope.

### 5. Runtime and lifecycle bypass prevention

- The former public tRPC deployment mutation is removed.
- `deploy.sh` and `deploy-production.sh` fail closed and direct operators to the protected workflow.
- The package `postdeploy` hook is removed.
- `scripts/fix-nginx-dao.sh` is deleted.
- Direct `git pull`, npm build, PM2 reload, nginx mutation, and Cloudflare purge instructions are retired.
- No source-controlled application code or package lifecycle hook may execute Git, package-manager, PM2, nginx, or Cloudflare deployment commands outside the protected workflow.

### 6. CI prerequisites

The exact release commit must pass:

- repository-pinned pnpm activation;
- absence of `package-lock.json`;
- frozen dependency installation;
- complete test suite;
- production build;
- production dependency audit at high severity;
- exact Axios security resolution;
- patched Wouter resolution;
- token registry scanner;
- exact-index hidden Unicode and credential-pattern scans.

The deployment workflow independently verifies the latest trusted successful exact-SHA check runs before accessing production. Third-party GitHub Actions are pinned to immutable commit SHAs.

### 7. Clean build, health gate, and bounded rollback

For both deployment and rollback builds, the workflow removes stale `dist` output before running `pnpm build`.

After PM2 reload, the workflow:

- verifies the server checkout still equals the approved SHA;
- retries the public tRPC health endpoint;
- requires an `ok: true` response before declaring the release healthy;
- restores the previously active SHA if installation, clean build, reload, SHA verification, or health verification fails;
- reinstalls from the previous SHA's frozen pnpm lock, removes stale output, rebuilds, and reloads PM2 during rollback;
- purges Cloudflare only after the deployment and health gate succeed.

A failed purge does not silently report a successful workflow.

## Prohibited production actions

- No deployment on merge or push.
- No production workflow execution from a non-`main` ref.
- No direct server edits.
- No `git pull` on production.
- No npm install/build path.
- No skipped lockfile, exact-SHA, trusted-app, or latest-check verification.
- No disabled SSH host verification.
- No global Cloudflare API key.
- No runtime deploy endpoint.
- No package lifecycle deployment or nginx mutation hook.
- No undocumented rollback.
- No force push or history rewrite to alter release evidence.

## Rollback discipline

A failed approved deployment automatically attempts restoration to the SHA active when that workflow began. An intentional rollback uses the same protected workflow from `main` with a previously verified commit that remains in `main` history.

Every intentional rollback record must include:

- reason;
- target SHA;
- approving reviewer;
- workflow run;
- latest trusted exact-SHA check evidence;
- post-release health result;
- final active SHA.

## Required GitHub settings

Repository administrators must configure the `production` environment with required reviewers, restrict its deployment branches to `main`, and restrict environment secret access to the deployment workflow. Branch protection or rulesets should require the CI and Security and Quality jobs before merge.
