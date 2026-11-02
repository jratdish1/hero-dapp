[2026-10-23 23:11 UTC / 16:11 PDT]

# contracts/v3: HERO V3 (Base + PulseChain)

Owner: **VETS (jratdish1)**.

> **NOT AUDITED FOR V3. DO NOT DEPLOY.** Deploying, signing, choosing Safes and filling addresses are all Tier B actions that need VETS. Addresses are TBD and the constructors fail closed.

The source is recovered from the verified V2 contracts; see [PROVENANCE.md](PROVENANCE.md). Ownership and admin roles are **not set here**: the deployer becomes owner, and the deploy runbook (Tier B) must hand ownership to the Owner Safe (OS-x).

## Build and test (local only, no RPC, no keys)

```
cd contracts/v3
forge build
forge test -vv
python3 script/check_no_old_addresses.py      # fails if any KB #776 / #792 §8 address appears
```

* Foundry: `auto_detect_solc` selects solc 0.8.26 (Hero, B&B), 0.8.27 (PLS HeroABLE) and 0.8.30 (Base HeroABLE), matching the verified compilers. Optimizer runs are 200.
* `evm_version = "paris"` is set for every contract. This matches the verified Hero and B&B builds. The verified HeroABLE builds used the compiler default EVM (0.8.30 defaults to prague, 0.8.27 to cancun), so the V3 HeroABLE bytecode will differ from V2. Paris avoids PUSH0 and later opcodes on both chains. VETS should confirm the target EVM before deploy.
* The tests use a dependency-free `test/utils/MiniTest.sol` (no forge-std submodule) and a mock UniswapV2 router etched at the hardcoded router address.

## Contract notes (for reviewers and the external audit)

**Access control**
* Hero, B&B and PLS HeroABLE use OZ 4.9 `Ownable`; Base HeroABLE uses OZ 5.0 `Ownable`. Ownership is single-step (no `Ownable2Step`), so a typo in `transferOwnership` is unrecoverable. The runbook must verify the Safe address before signing.
* The Hero constructor deploys its own B&B with `owner = deployer`, so **B&B ownership must be transferred separately**. Transferring Hero ownership does not move it (see `test_OwnershipHandoffToSafe`).
* Owner powers on Hero: fee split (must sum to 100%), sell fee up to 15% with decay, max-tx and exemptions, swap-back threshold, pairs, receivers, B&B address and the NFT discount.
* Owner powers on B&B: `withdrawTokens` of any token, and the daily allocation (at most 25%).
* Owner powers on HeroABLE: `withdrawToken`, `withdrawETH`, `setSigner`, the rewards address and LP targets.
* These withdraw functions are custody powers, so the Safe threshold is what protects them.
* HeroABLE `signer` defaults to the deployer. It must be set to the bot signer (B1/B2) at deploy (Tier B).

**Upgradeability:** none. There are no proxies; all contracts are immutable once deployed. Fixes require a redeploy and a migration.

**Reentrancy**
* B&B `buyAndBurn` is `nonReentrant`.
* Hero swap-back runs under a `swapping` guard. ETH is pushed to the receivers with `call{gas: 30000}`, and failures are ignored.
* Any leftover ETH is swept to `owner()`. With a Safe as owner or receiver, the fork tests must confirm that a Safe proxy accepts ETH within 30k gas. Otherwise donations and stake rewards silently accrue to the owner.

**Oracles**
* Base uses the Chainlink ETH/USD feed; PulseChain uses Tellor `getDataBefore`. Both are used only for USD statistics counters, inside try/catch, with no staleness check.
* They have no effect on swaps or fees. Low risk, but the stats can be wrong.

**Token accounting**
* Fee-on-transfer token with a buy fee and a decaying sell fee. Fee tokens are burned, added to LP, or swapped to ETH/PLS and split among donation, B&B and stake rewards.
* PulseChain adds the VETS auto-LP leg.
* Swap-back and B&B swaps use **amountOutMin = 0**, which exposes them to sandwich/MEV attacks. Flagged for the audit.
* ERC20Votes and Permit are inherited from OZ 4.9.

**Pause/timelock:** none. There is no pause switch and no timelock on any owner setter. Changes are instant once the Safe signs. A timelock is recommended (Tier B design decision).

**Deploy scripts:** none in this PR. Local fork dry runs come in a separate PR. Live deployment is Tier B only, via the hero-dapp Issue #43 process. The constructors revert on zero (TBD) receivers or token.

## Layout

```
src/base/        Hero.sol, HeroBuyAndBurn.sol, HeroABLE.sol (Base)
src/pulsechain/  Hero.sol, HeroBuyAndBurn.sol, HeroABLE.sol (PulseChain)
vendor/          verbatim OZ 4.9.0, OZ 5.0.0, Uniswap V2 interfaces
test/            MiniTest, mocks, constructor/ownership/TBD tests
script/          check_no_old_addresses.py, verify_provenance.py (read-only)
security/        old-address-hashes.sha256 (hashes only), provenance.json
```

## Address config (`config/v3-addresses.json`)

- Every V3 address (owner Safe, receivers, deployed HERO/HeroABLE/staking) is listed per chain as `"TBD"`. Filling any value is **Tier B (VETS only)**.
- `python3 script/check_v3_addresses.py` passes while values are TBD. It fails on malformed or zero addresses, on duplicates, and on any KB #776 / #792 §8 address (hash-matched, printed masked).
- `python3 script/check_v3_addresses.py --require-final` fails closed while any value is still TBD. Run it before any deploy.
- `ci/v3-guards.yml.proposed` is a workflow that runs the old-address guard, the config check and its self-test on PRs that touch `contracts/v3/**`. Moving it into `.github/workflows/` turns these checks into a failing PR check. That move needs a token with the GitHub `workflow` scope, which this agent doesn't have, so a maintainer has to do it.
- Nothing reads this file at runtime yet, so live behavior does not change.
