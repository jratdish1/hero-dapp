# HERO Dapp Production Deployment Safeguards

## Security objective

Production deployment is a separate, human-approved release action. A merge must never imply deployment, and no application endpoint, shell helper, or bearer token may bypass the protected GitHub environment.

## Permanent controls

### 1. One package manager and one lockfile

- Canonical package manager: pnpm `10.34.4`.
- Canonical dependency graph: `pnpm-lock.yaml`.
- `package-lock.json` is prohibited.
- Every install used for CI or production is `pnpm install --frozen-lockfile`.
- Build-time scripts validate dependencies but never install, delete, or mutate them.

### 2. Merge and deployment are separated

- The deployment workflow has no `push` trigger.
- A human must invoke `workflow_dispatch`.
- The requester must supply an exact 40-character commit SHA already merged to `main`.
- The requester must enter the explicit confirmation value `DEPLOY`.
- The GitHub `production` environment must require human approval.
- Concurrency allows only one VPS1 production deployment at a time and does not cancel an active release.

### 3. Exact release identity

Before changing runtime state, the workflow:

1. fetches `origin/main`;
2. resolves the requested object as a commit;
3. verifies it is an ancestor of `origin/main`;
4. resets the server checkout to that exact SHA;
5. verifies the active checkout still equals the requested SHA after build and reload.

The workflow never deploys an ambiguous branch tip or an unmerged commit.

### 4. SSH and credential controls

- Strict host-key verification is mandatory.
- `VPS1_KNOWN_HOSTS` is environment-scoped.
- Batch mode and a single explicit identity are required.
- Cloudflare uses a scoped API bearer token.
- Global API keys and email/key authentication are prohibited.
- Production secrets belong to the protected `production` environment, not general repository scope.

### 5. Runtime and legacy bypass prevention

- The former public tRPC deployment mutation is removed.
- `deploy.sh` and `deploy-production.sh` fail closed and direct operators to the protected workflow.
- Direct `git pull`, npm build, PM2 reload, and Cloudflare purge instructions are retired.
- No source-controlled application code may execute Git, package-manager, PM2, nginx, or Cloudflare deployment commands.

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

Third-party GitHub Actions are pinned to immutable commit SHAs.

## Prohibited production actions

- No deployment on merge or push.
- No direct server edits.
- No `git pull` on production.
- No npm install/build path.
- No skipped lockfile verification.
- No disabled SSH host verification.
- No global Cloudflare API key.
- No runtime deploy endpoint.
- No undocumented rollback.
- No force push or history rewrite to alter release evidence.

## Rollback discipline

Rollback uses the same protected workflow with a previously verified commit that remains in `main` history. The rollback record must include:

- reason;
- target SHA;
- approving reviewer;
- workflow run;
- post-release health result;
- final active SHA.

## Required GitHub settings

Repository administrators must configure the `production` environment with required reviewers and restrict environment secret access to the deployment workflow. Branch protection or rulesets should require the CI and Security and Quality jobs before merge.
