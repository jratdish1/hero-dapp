# Hero Wallet Agentic Buildout — 2026-09-14

## Status

**Repository:** `jratdish1/hero-dapp`  
**Base SHA:** `855c251a227fdae717c6f741ced7731bbb8f5253`  
**Mode:** architecture + implementation plan only; no production deploy, no wallet custody, no autonomous live transaction execution.  
**Audit gate:** any new external router, solver, paymaster, bridge, agent skill, runtime, or dependency introduced from this intake must achieve **Grade A** on one unchanged exact SHA/version before activation.

---

## Purpose

Incorporate the operator-supplied 2026-09-14 DeFi/agent research into Hero Wallet without weakening the existing wallet-security boundary. The target is a safer, more modular multi-chain wallet and swap experience where agents can research, compare, simulate, and explain routes, but **the connected user wallet remains the signer**.

Hero Wallet already exposes `/wallet` with Overview, Send, Privacy, Bridge, Approvals, and Discover tabs, plus `/swap`, portfolio, approval management, and multi-chain PulseChain/Base support. This plan extends those surfaces rather than creating a second wallet stack.

---

## Source signals

Primary DeFi design signal:

- https://x.com/libertyswapfi/status/2098472970977235042?s=46

Companion agent/fleet signals that shape review and execution discipline:

- https://x.com/teknium/status/2099327677648015365?s=46
- https://x.com/hermeswatcher/status/2099230437776466214?s=46
- https://x.com/polydao/status/2099499437068357915?s=46
- https://x.com/cyrilxbt/status/2099445557769261412?s=46
- https://x.com/bkashjosi/status/2099386761847947377?s=46

These links are scout signals. Resolve every production integration to official documentation, immutable source code, deployed contract addresses, APIs, and independent security evidence before use.

---

## Design principles

1. **User-signing boundary is absolute.** Agents may discover quotes, score routes, prepare calldata, simulate, and explain. They may not hold seed phrases/private keys or silently sign/submit swaps.
2. **No router monoculture.** Quote sources are adapters behind a common interface; no single aggregator owns the wallet architecture.
3. **Intent is advisory until signed.** A natural-language or structured user intent becomes a reviewed execution plan, not an autonomous transaction.
4. **MEV-aware by default.** Route quality includes expected output, price impact, gas, approval cost, transfer-tax effects, slippage, sandwich exposure, failed-transaction probability, and route trust.
5. **Gas abstraction is optional and explicit.** Paymasters/account-abstraction mechanisms must be separately reviewed, opt-in, chain-specific, and simulated before use.
6. **Privacy is a route property, not a marketing checkbox.** The UI should explain what data leaves the client and which service learns address/intent/quote metadata.
7. **Every external adapter is independently kill-switchable.** Failure or compromise of one provider cannot disable the wallet or silently redirect execution.
8. **Exact-chain state wins.** Chain ID, token addresses, router addresses, allowances, balances, and gas estimates must come from current verified chain context.
9. **Simulation before signature.** Every prepared write should have deterministic validation and, where feasible, RPC simulation/static call before user confirmation.
10. **Audit evidence is part of the feature.** New adapter code is not complete until tests, security review, provenance, and rollback are attached to the PR.

---

## Proposed architecture

### A. Quote-source abstraction

Create a provider-neutral interface, conceptually:

```ts
export interface SwapQuoteSource {
  id: string;
  supportedChains: readonly number[];
  getQuote(input: QuoteRequest): Promise<NormalizedQuote[]>;
  buildTransaction(quote: NormalizedQuote, account: Address): Promise<PreparedTransaction>;
  health(): Promise<SourceHealth>;
}
```

`NormalizedQuote` should include at minimum:

- source/provider identity;
- chain ID;
- token in/out addresses and decimals;
- amount in / expected amount out / minimum amount out;
- route hops;
- gas estimate and gas token;
- required approvals;
- price impact;
- transfer-tax assumptions;
- fee breakdown;
- quote expiry / block number;
- calldata target/value/data hash or equivalent immutable build reference;
- trust/audit metadata for the adapter/provider.

Do not let provider-specific response objects leak directly into React components.

### B. Route scoring

Introduce a deterministic route scorer. Suggested initial weighted dimensions:

- net output after gas;
- price impact;
- approval overhead;
- route hop count;
- quote freshness;
- known token tax/fee behavior;
- provider health/reliability;
- simulation success;
- user-selected preference: best output / lowest gas / simplest route / privacy preference.

The score must be explainable. UI should show *why* one route ranked above another.

### C. Intent compiler

Add a structured intent layer above route discovery, e.g.:

```ts
type SwapIntent = {
  chainId: number;
  sellToken: Address;
  buyToken: Address;
  amount: bigint;
  maxSlippageBps: number;
  deadlineSeconds: number;
  preference: "best-output" | "lowest-gas" | "simple-route" | "privacy";
  allowGasSponsorship: boolean;
};
```

Natural-language AI may help populate this form, but the user must review the normalized intent before quotes are requested and again before signing.

### D. Transaction preparation + simulation

Before presenting a signature request:

1. re-read chain/account;
2. re-read allowance and balance;
3. reject stale quote/expired deadline;
4. rebuild transaction from the selected adapter;
5. compare target/value/calldata hash to the reviewed quote artifact;
6. simulate/static-call where supported;
7. estimate gas;
8. surface approvals separately from swap execution;
9. show token tax / price impact / minimum received / provider / spender / destination;
10. only then call the wallet connector for explicit user signature.

### E. Adapter kill switch and health

Each quote source should have:

- feature flag;
- chain allowlist;
- health status;
- last-success timestamp;
- bounded timeout/retry;
- circuit-breaker on repeated invalid/stale/simulation-failing responses;
- independent UI disablement without code deletion.

No fallback should silently substitute a different spender/router after the user reviews a route.

---

## LibertySwap integration posture

The existing ecosystem blueprint already recognizes Liberty Swap as a PulseChain DEX/aggregator source. Treat the supplied LibertySwap post as a prompt to improve the integration architecture, not as proof that any specific SDK/router/API is safe.

Before enabling any new LibertySwap/ZKX path:

1. resolve the official repository/docs and current production contracts/APIs;
2. pin immutable source revision and deployed addresses;
3. document upgradeability/admin keys where applicable;
4. confirm chain support and token-tax handling;
5. review approval/spender semantics;
6. test quote freshness and deadline handling;
7. test revert/failure/partial-route behavior;
8. simulate calldata independently;
9. compare outputs against at least one alternate source;
10. obtain Grade A exact-SHA audit before activation.

If no official auditable integration surface can be established, keep LibertySwap as a directory/discovery link rather than a transaction adapter.

---

## Gas abstraction / paymaster lane

Gas sponsorship can improve UX but materially changes trust. Keep it behind a separate adapter and user-visible toggle.

Required before any paymaster feature:

- exact chain and entry-point/account-abstraction version;
- paymaster ownership/admin model;
- sponsorship policy and rate limits;
- what transaction/user metadata leaves the wallet;
- replay/expiry controls;
- fallback when sponsorship is denied;
- fee quote and whether fees can be taken in another token;
- independent simulation;
- explicit UI disclosure that a third party participates in transaction execution.

**Never make paymaster success a prerequisite for ordinary self-paid wallet operation.**

---

## MEV and privacy lane

Add route metadata and warnings rather than promising impossible privacy guarantees.

Candidate capabilities:

- expected slippage vs max slippage;
- sandwich-risk heuristic;
- public-mempool vs private-relay/provider indicator where applicable;
- quote-provider telemetry disclosure;
- user option to avoid multi-provider quote fanout when privacy is preferred;
- redact wallet metadata from application logs;
- no address/intent telemetry to AI services unless explicitly required and disclosed.

Any private transaction relay must be independently reviewed and must not obtain wallet custody.

---

## Approval safety

Hero Wallet already has an approvals surface. Extend it so route preparation can show:

- spender identity;
- current allowance;
- requested allowance;
- exact vs unlimited approval;
- known router/adapter audit status;
- revoke path;
- approval transaction separate from execution transaction.

Default new integrations to **exact/limited approvals** unless there is a documented UX/contract reason otherwise. Unlimited approval should require an explicit warning.

---

## Agent / Hermes execution model for this repository

Preferred profile: `vets-hero-wallet`.

Allowed by default:

- read repository and live GitHub state;
- claim one issue/PR lane with lease/idempotency;
- isolated worktree coding;
- tests, local simulations, static analysis, docs;
- create/update a review branch and PR;
- post exact-SHA evidence.

Not allowed by this plan alone:

- main-branch direct write;
- protected merge;
- production deployment;
- live wallet signing;
- seed/private-key access;
- live fund movement;
- new provider credentials;
- DNS/firewall/Cloudflare changes;
- enabling an unaudited router/paymaster/bridge.

Obsidian can retain design decisions and receipts in a mirror/index lane; GitHub remains canonical for code and deployment authority.

---

## Candidate implementation sequence

### Phase 0 — inventory and contract

- inspect current `/wallet`, `/swap`, `RouteComparison`, `SlippageSettings`, approval manager, network context, and existing server swap endpoints;
- enumerate current quote providers and any hardcoded routers;
- create `QuoteRequest`, `NormalizedQuote`, `PreparedTransaction`, and `SourceHealth` contracts;
- tests only; no provider behavior change.

### Phase 1 — normalize current sources

- wrap existing PulseChain/Base quote sources behind the interface;
- preserve current UI behavior;
- add deterministic fixture tests for normalization;
- reject malformed chain/token/amount/expiry data.

### Phase 2 — scoring + explainability

- deterministic route scorer;
- route comparison displays output, gas, price impact, approvals, source, freshness, and reason for rank;
- property/unit tests for stable scoring.

### Phase 3 — simulation gate

- prepare calldata only after route selection;
- verify target/spender/value;
- simulate/static-call and gas estimate;
- block signature UI on stale/simulation-failing route;
- test chain-switch/account-change race conditions.

### Phase 4 — LibertySwap candidate adapter

Only after official source resolution + Grade A audit:

- add disabled-by-default adapter;
- fixture/integration tests;
- compare output and calldata against documented provider behavior;
- canary in non-production/test wallet context;
- enable only with explicit review gate.

### Phase 5 — optional gas abstraction

Separate PR after paymaster architecture earns Grade A. Do not combine router and paymaster risk in one large patch.

### Phase 6 — privacy/MEV controls

- provider fanout preference;
- telemetry disclosure;
- private-relay candidate behind separately audited adapter;
- UI warnings/route metadata.

---

## Required test matrix

At minimum:

- PulseChain 369 + Base 8453;
- native/ERC-20-like entry cases applicable to supported adapters;
- insufficient balance;
- insufficient allowance;
- exact and unlimited approval paths;
- fee-on-transfer/transfer-tax tokens where supported;
- stale quote;
- changed chain after quote;
- changed account after quote;
- changed allowance after quote;
- quote provider timeout;
- malformed provider response;
- simulation revert;
- high price impact;
- slippage violation;
- route source disabled by circuit breaker;
- wallet reject signature;
- wallet disconnect before signature;
- no-provider-available fallback;
- provider disagreement beyond tolerance.

No mainnet-value E2E test should move funds without a separate explicit VETS authorization and bounded test amount.

---

## Grade A pre-activation audit prompt

```text
HERO WALLET ADAPTER AUDIT v1

TARGET: <adapter/router/solver/paymaster/bridge>
PR: <number>
EXACT HEAD: <sha>
CHAIN(S): <ids>
OFFICIAL SOURCE/CONTRACTS: <immutable refs>

Goal: decide whether this exact implementation earns Grade A. DO NOT DEPLOY OR ENABLE PRODUCTION.

1. Verify provenance, source revision, deployed contract addresses, admin/upgradeability, license, API terms, and chain IDs.
2. Review every changed file and dependency. Find all network calls, spender/router targets, calldata builders, approvals, signing calls, telemetry, persistence, and secrets surfaces.
3. Prove the user wallet remains the signer and no seed/private key/custody path exists.
4. Validate quote normalization, freshness, decimals, tax/fee handling, gas, slippage, deadlines, and chain/account race protection.
5. Independently simulate representative prepared transactions and compare target/value/calldata invariants to the reviewed quote.
6. Run unit/integration/property/E2E-safe tests, TypeScript check, dependency audit, secret scan, SAST/static checks, hidden-Unicode check, and wallet-specific adversarial cases.
7. Review approval scope; flag unexpected unlimited approvals or unverified spenders.
8. Review fail-closed behavior for provider timeout, malformed response, simulation failure, chain change, account change, circuit breaker, and quote expiry.
9. Confirm feature flag / kill switch / rollback.
10. Independent reviewer/critic must report zero unresolved P0/P1 and zero undispositioned security/correctness findings.

GRADE A requires all mandatory checks green on the unchanged exact SHA and a reproducible rollback. Anything less stays disabled.
```

---

## Canary enablement prompt — only after Grade A

```text
HERO WALLET ADAPTER CANARY v1

Precondition: exact deployment SHA == Grade-A reviewed SHA.

- enable adapter only in named non-production/canary configuration;
- use test/sandbox wallet or explicitly authorized bounded test account;
- verify quote, normalization, scoring, simulation, approval UX, signing handoff, rejection path, timeout path, and kill switch;
- compare against at least one existing source;
- confirm no secret exposure and no unexpected telemetry/egress;
- post machine evidence and disable/rollback at first unexplained mismatch.

Do not promote to production in this step.
```

---

## Completion definition

This buildout is not `COMPLETE` when code merely compiles. Completion requires:

- current architecture documented;
- external candidates resolved to official immutable sources;
- implementation split into bounded PRs;
- each new adapter receives Grade A exact-SHA review;
- tests and simulations cover the risk matrix;
- user-signing and non-custodial boundaries are proven;
- canary succeeds;
- production enablement receives a separate explicit gate.
