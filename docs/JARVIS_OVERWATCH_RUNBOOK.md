# Jarvis Overwatch Runbook

Status: planning / implementation blueprint
Scope: herobase.io, hero-dapp repository, NFT contracts, and uptime assurance

## Mission

Jarvis Overwatch is the daily monitoring layer for HERO Dapp operations.

The objective is to detect failures early, produce a daily operational report, and trigger human review before small issues become production outages.

This is for VIC Foundation / HERO operations. Treat availability, contract safety, donor confidence, and user trust as mission-critical.

## Operating principle

Failure should be detected, isolated, reported, and routed for repair.

The first implementation should be boring and durable:

- Daily scheduled scan
- Machine-readable JSON output
- Human-readable Markdown report
- Clear severity levels
- No secrets printed
- No automatic destructive changes
- Human approval before production mutation

## Daily scan categories

### 1. Website uptime scan

Targets:

- `https://herobase.io/`
- `https://herobase.io/nft`
- `https://herobase.io/nft-mint`
- `https://herobase.io/swap`
- `https://herobase.io/spin`
- `https://herobase.io/stake`
- `https://herobase.io/wallet`

Checks:

- DNS resolves
- TLS certificate valid
- TLS expiry greater than warning threshold
- HTTP status is 200/2xx or expected redirect
- Response body is not empty
- Response time below threshold
- No obvious application error string

Severity:

- Critical: domain does not resolve, TLS invalid, route returns 5xx, home page down
- Warning: route slow, route 4xx unexpected, TLS expiry under warning window
- Info: route healthy

### 2. Repository health scan

Repository:

- `jratdish1/hero-dapp`

Checks:

- Latest main commit
- Open PR count
- Draft PR count
- Failing or missing status checks
- Recently changed contract files
- Recently changed deployment files
- Recently changed GitHub Actions workflows
- Dependency/audit alerts if available through GitHub/API
- Secret scanning alerts if available through GitHub/API

Severity:

- Critical: failing required main branch checks, suspected secret, deployment address changed unexpectedly
- Warning: stale PR, dependency vulnerabilities, workflow changed, contract changed without audit note
- Info: repo healthy

### 3. Contract read scan

Current contracts:

- Base HeroCards: `0x5Fad096af059ff9A2167351A0ffc8b45D71897bE`
- PulseChain HeroCards: `0xCe609B3A82E89FCd4B5e5a29159b051CE86f7B36`

Required reads:

- `MAX_SUPPLY()`
- `totalMinted()`
- `mintPhase()`
- `feeDiscountBps()`
- `startIndexSet()`

Expected baseline:

- `MAX_SUPPLY()` should equal `1500` for current HeroCards.
- Contract reads should not timeout.
- Network-specific addresses must match `deployments/LIVE_CONTRACTS.json`.

Severity:

- Critical: contract read fails on both RPC retries, address mismatch, max supply mismatch
- Warning: one RPC fails but fallback succeeds, unexpected mint phase, response slow
- Info: contract healthy

### 4. NFT V2 launch scan

Activate after V2 deployment.

Checks:

- V2 contract address exists for Base/PulseChain
- Contract source verified on explorer
- Mint phase matches intended launch state
- Pause status is expected
- Rewards distributor is configured
- Marketplace is configured
- Buy/burn router is configured
- Registry points to expected modules

Severity:

- Critical: UI points to unverified or wrong V2 address, mint live before approval, router split invalid
- Warning: V2 module paused unexpectedly, distributor underfunded, marketplace stale listing count abnormal
- Info: V2 healthy

## Report format

Jarvis should write one Markdown report per run:

`ops/reports/YYYY-MM-DD-jarvis-overwatch.md`

Suggested sections:

1. Executive verdict: GREEN / YELLOW / RED
2. Website status
3. Repo status
4. Contract status
5. NFT/V2 status
6. Open warnings
7. Required human actions
8. Raw scan artifact path

Machine-readable JSON output:

`ops/reports/YYYY-MM-DD-jarvis-overwatch.json`

## Verdict policy

GREEN:

- Site core routes healthy
- Repo has no critical alerts
- Contract reads pass
- No address mismatch

YELLOW:

- Site mostly healthy but one non-critical route warning
- Repo has non-critical stale PR/audit warning
- One RPC issue recovered through fallback

RED:

- Site down
- SSL broken or near hard failure
- Contract reads fail
- Deployment address mismatch
- Main branch checks failing
- Suspected secret or unauthorized contract/deployment change

## Self-healing policy

Allowed automatic actions in first version:

- Retry failed reads with fallback RPC
- Re-run a failed scan once after short delay
- Save degraded-state report if partial data unavailable
- Open or update a non-destructive GitHub issue/report if configured

Not allowed without human approval:

- Contract pause/unpause
- Deployment address edits
- DNS changes
- Secret rotation
- Merging PRs
- Reverting commits
- Restarting production services unless a separate approved runbook exists

## Recommended implementation phases

### Phase 1 — Report-only

- Build scan script.
- Run manually and daily.
- Store reports.
- No mutation.

### Phase 2 — Alert routing

- Send RED/YELLOW summary to approved channel.
- Open GitHub issue only for RED if configured.

### Phase 3 — Safe self-heal

- Add approved, non-destructive retries.
- Add stale cache clear or app health endpoint ping if available.

### Phase 4 — Controlled remediation

Only after operator approval gates exist:

- Restart known app process
- Revert known bad deploy
- Pause V2 mint on verified critical issue

## Required secrets / environment

Do not commit secrets.

Potential runtime variables:

- `GITHUB_TOKEN` with least privilege
- `BASE_RPC_URL`
- `PULSECHAIN_RPC_URL`
- `JARVIS_ALERT_WEBHOOK_URL`
- `JARVIS_REPORT_REPO`

## Acceptance criteria

Jarvis Overwatch is production-ready when:

- It runs daily without manual copy/paste
- It checks herobase.io critical routes
- It checks both current NFT contracts
- It produces Markdown and JSON reports
- It never prints secrets
- It fails closed on missing critical data
- It clearly marks RED/YELLOW/GREEN
- It has an approved human escalation path
