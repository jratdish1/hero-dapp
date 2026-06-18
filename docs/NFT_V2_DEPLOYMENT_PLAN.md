# HERO Cards NFT V2 Deployment Plan

Status: planning / architecture baseline
Owner: VIC Foundation / HERO Dapp
Scope: Base + PulseChain NFT V2 deployment route

## Executive decision

HERO will proceed with an NFT V2 deployment route instead of attempting to mutate the already deployed HeroCards contracts.

The existing HeroCards deployments remain the stable legacy/current collection layer:

- Base Mainnet: `0x5Fad096af059ff9A2167351A0ffc8b45D71897bE`
- PulseChain Mainnet: `0xCe609B3A82E89FCd4B5e5a29159b051CE86f7B36`

The V2 route lets HERO add reflection economics, native marketplace logic, buy-and-burn routing, stronger monitoring, and emergency controls without creating hidden risk in the already deployed contracts.

## Why V2 instead of modifying current contracts

The deployed HeroCards contracts are not treated as upgradeable proxy deployments in this repo. Their bytecode should be considered immutable. Any advanced economics should be added through new contracts or external companion modules.

V2 gives us:

- Clean audit boundary
- Safer launch control
- Better fail-safe design
- Cleaner Base/Pulse parity
- Room for mint reflections and built-in marketplace logic
- No accidental breakage of existing holders or spin-gating utility

## Current foundation that must stay stable

The current contract already includes:

- ERC-721 collection
- 1,500 max supply
- Public mint and whitelist mint
- Per-wallet mint cap
- Team mint reserve
- ERC-2981 royalties
- Pausing
- Holder tier reads
- Fee discount reads
- Spin wheel access reads
- Provenance and randomized metadata assignment

This should remain supported in the app while V2 is built.

## Immediate foundation fixes

Before V2 implementation begins, complete these cleanup tasks:

1. Fix holder verification bug.
   - `server/heroCards-holder.ts` must read the real deployed Base/Pulse contracts.
   - It must not treat the live Base address as "not deployed yet."
   - Production gating should fail closed on RPC failure unless an explicit beta/test override is passed.

2. Reconcile supply metadata.
   - Contract/deployment source of truth: 1,500 max supply.
   - Fix conflicting UI/docs that say 555 or 1,000 unless explicitly marked as an artwork subset.

3. Make HeroCards config chain-aware.
   - Base and PulseChain addresses must be centralized.
   - Native symbols must be correct: ETH on Base, PLS on PulseChain.
   - Explorer links must be network-aware.

4. Make `/nft-mint` dual-chain-ready.
   - Do not hard-default every write to Base.
   - Detect current connected chain.
   - Show unsupported-chain state clearly.

## V2 contract family

Recommended V2 architecture uses several contracts with tight responsibilities.

### 1. HeroCardsV2.sol

Purpose:

- New ERC-721 collection contract for future mint.
- Mint reflections and fee routing live here or call into routers.
- Should support Base and PulseChain deployments with identical interfaces.

Recommended features:

- ERC-721 or ERC-721A-style batch minting after audit decision
- Public mint
- Whitelist mint with Merkle proof
- Per-wallet cap
- Mint phase enum
- Pause/unpause
- Provenance hash
- Randomized reveal
- Royalty support
- Contract URI
- Owner two-step transfer
- Reentrancy guard
- Emergency withdraw controls
- Fee splitter / router integration

Do not include unbounded holder loops.

### 2. HeroCardsRewardsDistributor.sol

Purpose:

- Claim-based holder rewards.
- Supports reflections without unsafe loops over all holders.

Recommended model:

- Merkle root per epoch
- Epoch funding in native token and/or HERO
- Claim tracking by wallet and epoch
- Emergency pause
- Owner/multisig root update
- Expired/unclaimed funds recovery policy

Fail-safe posture:

- Claims fail closed if root is unset or paused.
- Double-claim prevention.
- Epoch data immutable after finalization unless emergency admin action is logged.

### 3. HeroCardsMarketplace.sol

Purpose:

- Built-in marketplace for HERO NFTs.
- Starts with fixed-price listings before bids/offers.

Recommended minimum viable functions:

- `list(tokenAddress, tokenId, price)`
- `cancelListing(listingId)`
- `buy(listingId)`
- fee accounting
- royalty accounting
- pause/unpause
- listing expiration

Fail-safe posture:

- Non-custodial listing where possible.
- Require marketplace approval before listing.
- Re-check ownership and approval at purchase.
- Cancel stale listings safely.
- Reentrancy guard on purchase.

### 4. HeroBuyBurnRouter.sol

Purpose:

- Route configured percentages of mint and marketplace proceeds into HERO/VETS buy-and-burn or treasury operations.

Recommended behavior:

- Accept native currency from V2 mint/marketplace.
- Split according to basis-point config.
- Send treasury share to controlled wallet/multisig.
- Send rewards share to distributor.
- Send buy/burn share to swap/burn path or dedicated wallet.

Fail-safe posture:

- Basis points must sum to 10,000.
- Max slippage protection for swaps.
- Circuit breaker if router/swap path fails.
- Manual recovery route for stuck funds.

### 5. HeroCardsV2Registry.sol

Purpose:

- Single source of truth for active NFT contracts and modules.
- Lets the UI discover current addresses without hardcoding every module forever.

Recommended behavior:

- Store active addresses per chain.
- Store status flags: active, paused, deprecated.
- Emit events on module changes.
- Only owner/multisig can update.

## Mint economics recommendation

Suggested starting split for V2 mints:

- 40% VIC Foundation / charity treasury
- 25% NFT holder reflections
- 20% HERO/VETS buy-and-burn or liquidity support
- 15% operations / development / infrastructure

All percentages should be configurable within capped bounds and guarded by multisig.

## Deployment sequence

### Phase 0 — Safety foundation

- Fix server holder verification.
- Reconcile supply metadata.
- Centralize deployed HeroCards config.
- Add dual-chain UI readiness.

### Phase 1 — V2 architecture and tests

- Implement `HeroCardsV2.sol`.
- Implement `HeroCardsRewardsDistributor.sol`.
- Implement `HeroBuyBurnRouter.sol`.
- Add full unit tests.
- Add invariant/fuzz tests where possible.
- Run Slither/static analysis.
- Run Codex audit loop until accepted.

### Phase 2 — Marketplace

- Implement fixed-price `HeroCardsMarketplace.sol`.
- Add UI marketplace page.
- Add listing indexer or API cache.
- Add failsafe stale-listing cleanup.

### Phase 3 — Testnet / dry run

- Deploy to test networks where practical.
- Run simulated mint/reflection/marketplace flows.
- Verify fee splits.
- Verify admin emergency pause.
- Verify claim proofs.

### Phase 4 — Production deploy

- Deploy V2 to PulseChain and Base.
- Verify contracts.
- Publish deployment artifact.
- Add addresses to registry/config.
- Turn on UI behind launch flag.
- Start Jarvis Overwatch daily scans.

## Required audit gates

No production launch without:

- Contract compile pass
- Unit tests pass
- Fuzz/invariant tests pass where available
- Static analysis reviewed
- No critical/high findings open
- Multisig/admin ownership verified
- Emergency pause tested
- Withdrawal/recovery tested
- Deployment addresses verified on explorers
- UI points to verified addresses only
- Rollback plan documented

## Operational fail-safes

Every component should include the safest reasonable failure mode:

- Mint paused if payment split fails.
- Marketplace purchase reverts if ownership/approval changed.
- Reward claim reverts if proof invalid or already claimed.
- Buy/burn router can pause swaps while still preserving funds.
- UI shows degraded state instead of pretending data is live.
- Server-side gated features fail closed in production.
- Beta/test fail-open must be explicit and visible in code.

## Jarvis Overwatch target state

Jarvis Overwatch should monitor both repo and website daily.

Daily repo scan:

- New commits to main
- Open PRs and stale PRs
- Failing checks
- Dependency vulnerabilities
- Secret scanning alerts if available
- Changed contract files
- Changed deployment address files
- Changed GitHub Actions workflows

Daily website scan:

- `https://herobase.io` HTTP status
- Core routes: `/`, `/nft`, `/nft-mint`, `/swap`, `/spin`, `/stake`, `/wallet`
- Basic page render / no obvious 500 page
- SSL certificate expiry
- DNS resolution
- Response time threshold
- Broken critical CTAs

Daily chain scan:

- Base HeroCards contract responds to `totalMinted`, `mintPhase`, `MAX_SUPPLY`
- PulseChain HeroCards contract responds to same reads
- V2 contracts respond after deployment
- Marketplace paused/unpaused status after deployment
- Rewards distributor funded/paused/root status after deployment

Alert policy:

- Critical: site down, SSL near expiry, contract read failure, wrong address, failing main build.
- Warning: high latency, stale data, open dependency vulnerability, stale PR.
- Info: successful scan summary.

## Non-negotiables

- No private keys in repo.
- No seed phrases in repo.
- No unverified production deployment address changes.
- No unbounded payout loops.
- No production fail-open access gates.
- No broad unrelated refactors in NFT PRs.
- Every module must have an emergency stop.

## Open design questions

These should be answered before V2 coding starts:

1. Final mint supply for V2.
2. Final mint price per chain.
3. Whether V2 replaces or complements the existing 1,500 HeroCards collection.
4. Whether reflections pay in native token, HERO, VETS, or a combination.
5. Whether marketplace supports only HERO NFTs first or all whitelisted NFT contracts.
6. Treasury/multisig addresses for each chain.
7. Buy/burn target token and router path per chain.
8. Whether claims are epoch-based Merkle or continuously accrued accounting.
