# NFT V2 Foundation Fix Branch Summary

Branch: `nft-v2-foundation-fix`

## What this branch does

This branch starts the HERO NFT V2 route safely by fixing the current production holder-verification bug first, then documenting the V2 deployment and Jarvis Overwatch direction.

## Files changed

- `server/heroCards-holder.ts`
  - Removes stale not-deployed behavior.
  - Uses real deployed Base and PulseChain HeroCards contract addresses.
  - Adds chain-aware reads.
  - Adds timeout protection.
  - Fails closed by default for production gating.
  - Keeps explicit `failOpen` option for beta/test callers only.

- `docs/NFT_V2_DEPLOYMENT_PLAN.md`
  - Records the V2 deployment decision.
  - Defines recommended V2 contract family.
  - Covers mint reflections, marketplace, buy/burn router, registry, audit gates, and fail-safes.

- `docs/JARVIS_OVERWATCH_RUNBOOK.md`
  - Defines daily monitoring scope for herobase.io, repo health, and contract reads.
  - Defines GREEN/YELLOW/RED verdict policy.
  - Defines safe self-heal boundaries.

- `docs/OPENHANDS_NFT_V2_NEXT_STEPS.md`
  - Copy/paste implementation prompt for the next OpenHands phase.

## Explicit non-goals

- No production deployment.
- No contract redeploy.
- No marketplace implementation yet.
- No rewards/reflections implementation yet.
- No broad UI refactor.
- No private keys or secrets.

## Next recommended PR

After review/merge of this branch, the next PR should reconcile NFT supply metadata and centralize HeroCards config for Base/PulseChain before V2 contracts are implemented.
