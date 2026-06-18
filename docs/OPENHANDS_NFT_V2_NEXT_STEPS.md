# OpenHands NFT V2 Next Steps

Paste this into OpenHands for the next implementation phase after this PR is reviewed.

```text
Mission: Continue HERO NFT V2 foundation work after the holder-verification safety patch.

Repo:
jratdish1/hero-dapp

Branch context:
Start from latest main after the holder verification PR is merged.

Hard rules:
- No private keys, seed phrases, deploy keys, or secrets.
- No production deployment.
- No contract redeploy without explicit VETS GO.
- No broad unrelated refactors.
- Small PRs only.
- Every risky component needs a fail-safe or emergency stop.

Phase 1 tasks:

1. Reconcile NFT supply metadata.
   - Source of truth: current HeroCards contract and deployments/LIVE_CONTRACTS.json.
   - Current deployed HeroCards max supply: 1500.
   - Fix stale UI/docs that imply the deployed collection is 555 or 1000.
   - If 555 is an artwork subset, label it clearly as an artwork subset, not contract max supply.

2. Centralize current HeroCards config.
   - Create shared config for:
     - Base deployed address
     - PulseChain deployed address
     - chain IDs
     - native symbols
     - explorer URLs
     - metadata base URI
     - max supply
     - mint prices
   - Remove duplicate stale hardcoded comments like "update after deployment."

3. Make current NFT mint hook chain-aware.
   - Refactor client/src/lib/useHeroCards.ts.
   - Preserve public return API where possible.
   - Support Base and PulseChain.
   - Fail clearly on unsupported chain.
   - Do not silently default every write to Base.

4. Make NFTMint page dual-chain-ready.
   - Show active chain.
   - Show ETH on Base and PLS on PulseChain.
   - Use correct explorer link.
   - Show unsupported-chain state.
   - Keep current design intact.

5. Update NftCollection page.
   - Fix 555/1500 conflict.
   - Add CTA to /nft-mint.
   - Label current marketplace iframe as external/temporary until HERO marketplace V2 is built.

6. Add contract design stubs only if helpful, but do not deploy:
   - contracts/v2/HeroCardsV2.sol
   - contracts/v2/HeroCardsRewardsDistributor.sol
   - contracts/v2/HeroCardsMarketplace.sol
   - contracts/v2/HeroBuyBurnRouter.sol

7. Add tests where repo structure supports them.
   - Holder gating reads should fail closed by default.
   - Config should return correct chain addresses.
   - UI helper functions should resolve correct explorer/native symbol.

8. Run:
   - pnpm build
   - pnpm test
   - pnpm check

9. Report:
   - Files changed
   - Tests run
   - Build/test/typecheck output
   - Remaining risks
   - Recommended next PR

V2 design direction:
- HERO is going V2 deployment route.
- Current HeroCards remain stable legacy/current collection.
- V2 should support mint reflections, built-in marketplace, and buy-and-burn via audited modules.
- Avoid unbounded holder payout loops.
- Use claim-based rewards or carefully audited accrued accounting.
- All modules need pause/circuit breaker/emergency recovery.
```
