# PHASE 5 PLAN — Swap, Farm, Dashboard, and Portfolio Hardening

Status: PLAN ONLY. Do not implement without explicit approval.
Production deploy: NO.

---

## Goal

Continue code quality hardening after Phase 4. Remove remaining token/address duplication, harden swap link generation, fix marketing claim language, align portfolio/dashboard balance sources, and enforce external link safety attributes.

---

## Files to Inspect

client/src/pages/LimitOrders.tsx
client/src/pages/Tokenomics.tsx
client/src/pages/Onboarding.tsx
client/src/pages/dao/ProposalDetail.tsx
client/src/pages/dao/Treasury.tsx
client/src/pages/HeroWallet.tsx
client/src/lib/config.ts (or equivalent shared config)
client/src/components/SwapWidget.tsx (if exists)
client/src/pages/Farm.tsx (read-only, do not touch staking logic)

---

## Exact Risks

1. Hardcoded token addresses in non-registry files
The scanner reports 26 warnings. If addresses ever change in shared config, these files will silently use stale values. Risk: wrong token swaps or balance reads.

2. Swap external link generation
If swap URLs are constructed inline rather than from shared config, a chain/token mismatch could send users to the wrong DEX or wrong token pair.

3. Absolute marketing claims
Phrases like "guaranteed", "always", "highest yield" are legally and factually risky if provider conditions change. Should be replaced with provider-dependent wording.

4. Portfolio/Dashboard balance sources
If balance reads bypass the confirmed chain state introduced in Phase 4, they can show stale or wrong-chain balances.

5. External links missing safety attributes
Any anchor tag opening in a new tab without rel="noopener noreferrer" is a tabnapping risk.

---

## Proposed Fixes

Fix 1: Migrate all hardcoded addresses in LimitOrders.tsx, Tokenomics.tsx, Onboarding.tsx, ProposalDetail.tsx, and Treasury.tsx to import from shared config (client/src/lib/config.ts or shared/tokens.ts). Do not change the address values themselves.

Fix 2: Audit swap URL construction. Ensure all DEX links are generated from DEX_MAP in shared config. Add an allowlist check so only known DEX domains are used.

Fix 3: Replace absolute marketing language with conditional/provider-dependent wording. Example: "up to X% APY depending on pool conditions" instead of "X% APY guaranteed".

Fix 4: Verify HeroWallet.tsx and any dashboard/portfolio components use chainId from NetworkContext (which is now confirmed chain state after Phase 4) for all balance reads.

Fix 5: Audit all anchor tags with target="_blank". Add rel="noopener noreferrer" where missing.

---

## Acceptance Criteria

- scanner (check-token-registry.mjs) warning count drops from 26 to 0 or near 0
- No new hardcoded addresses introduced
- All swap links verified to use DEX_MAP entries only
- No absolute marketing claims remain in inspected files
- All target="_blank" links have rel="noopener noreferrer"
- pnpm build passes
- pnpm test count does not increase (pre-existing failures remain, no new ones added)
- pnpm check error count does not increase
- No token addresses changed
- No contract addresses changed
- No staking/reward-pool logic touched
- No DAO, AI, NFT, server, or deployment code touched

---

## Commands to Run After Implementation

pnpm build
pnpm test
pnpm check
node scripts/check-token-registry.mjs
pnpm audit --audit-level high

---

## Production Deploy

NO.
