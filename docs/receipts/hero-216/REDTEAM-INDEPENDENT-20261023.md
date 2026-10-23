# Independent red-team of PR #135 (2026-10-23, Grok Bot executor; did not author the PR)

Reviewed head `189752c01cdfd7cc88485e1c0555303a43d59617`, rebuilt from that head (Node 22.14, pnpm 10.34.4, `--frozen-lockfile`).

## Verdict at 189752c: FAIL (fixable). Containment logic was sound, but the PR re-published full denylisted addresses and cited receipts that were never committed.

| # | Sev | Finding | Fix in this commit |
|---|---|---|---|
| 1 | High | `client/src/lib/securityContainment.test.ts` (added by this PR) contained the 6 full card-216 addresses, incl. attacker, sweeper and stolen deployer. `check_denylist.py --base origin/main` = 6 hits (the COMPROMISED ADDRESS gate would fail). | Test now stores head/tail + sha256 only; source scan matches by hash. Gate: 0 hits. |
| 2 | Medium | NFT Collection > Marketplace tab embedded/linked the SquirrelSwap NFT Nutters marketplace ("browse, buy, trade HERO NFTs"). HeroCards pay 5% ERC-2981 royalties to a receiver the compromised owner controls, so secondary buys could still route funds to the attacker. | Iframe + link hidden behind `HERO_CARDS_MINT_ENABLED`; paused warning shown (screenshot `08`). |
| 3 | Low | `useStakingActions().approve/stake` were only blocked in the HeroStake UI, not in the hook. | Hook throws while `HERO_STAKE_NEW_DEPOSITS_ENABLED` is false; bundler now drops the stake/approve write path (bundle has only withdraw/getReward/exit). |
| 4 | Low | README cited `check.log`, `test.log`, `build.log`, `ci-browser-gates-local.log`, which `.gitignore` (`*.log`) kept out of the commit. | Re-run and committed as `.txt`. |
| 5 | Low (pre-existing) | Full denylisted addresses in comments/tests: `heroCards-config.ts` header comment, `heroCards-config.test.ts`, `server/heroCards-holder.test.ts` (stolen deployer used as a "valid wallet"), `TreasuryDisplay.tsx` header comment. | Defanged / synthetic test addresses. |

## Verified OK (no change needed)
- No remaining HeroCards write path: only `useStaking.ts` and `useHeroCards.ts` call `writeContract*` in client; no `sendTransaction`/`eth_sendTransaction`/ethers signer in client; no admin page or deep link imports the HeroCards ABI for writes. Bundle: `functionName:"mint"|"whitelistMint"` = 0.
- Notice: mounted above the router in `App.tsx` and in `LandingApp.tsx` (covers `/` and every dapp route). Dismissal is `sessionStorage` only: browser check = hidden after dismiss+reload in the same tab, shown again in a new tab; nothing written to localStorage/cookies.
- Unstake (`withdraw`), claim (`getReward`) and emergency withdraw (`exit`) untouched and present in the bundle.
- Remaining plaintext full addresses are only the read-only constants: HeroCards Base/PLS in `heroCards-config.ts` + `server/heroCards-holder.ts` (writes blocked by `isBlockedContract`), and the donation receiver in `TreasuryDisplay.tsx` (balance reads; display defanged).

## Note (not fixed here)
`client/public/assets/` holds ~341 orphaned JS chunks from a July 2026 build (commit 683cec1) that get copied into every `dist/`. They contain no denylisted addresses and no mint writes, but they are stale code served publicly; propose deleting them in a separate PR.

## Re-run receipts (after fixes)
`check.txt` (tsc exit 0), `test.txt` (27 files / 473 tests), `build.txt`, `ci-browser-gates-local.txt` (8 CI gates exit 0), `redteam-bundle-grep.txt`, `denylist-check.txt`, `gitleaks.txt`, `screenshots/08-nft-marketplace-paused.jpg`.
