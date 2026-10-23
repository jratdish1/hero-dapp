# HERO V3 single-sided staking (ported from hero-dapp #119)

Owner: VETS (jratdish1). Status: **DRAFT. NEEDS EXTERNAL AUDIT BEFORE ANY DEPLOY.**
Not deployed anywhere. No addresses are set: the owner is a constructor parameter (`initialOwner`),
so the V3 owner Safe is chosen at deploy time (Tier B).

## What this is

`src/staking/HeroSingleSidedStaking.sol` is a byte-for-byte copy of
`contracts/v2/HeroSingleSidedStaking.sol` from hero-dapp PR #119
(branch `feat/build1-hero-single-sided-staking`, commit `4f5610dbbda0b7b1020521e1efe67d8e9a18a7c1`,
sha256 `d1cc58654e0152bf9de5ac442529cfeb73f71b9a22ed5cf6d6c40655b7fbecc4`). PRs #119 and #115 are not
modified. OpenZeppelin 5.6.1 (the version both PRs' lockfile pins) is vendored under
`vendor/oz-5.6.1/`: only the 30 files the contract imports. They are byte-identical to the npm tarball,
whose integrity matches the hero-dapp pnpm lock. See `vendor/oz-5.6.1/provenance.json`.

## #119 vs #115: analysis

**Overlap.** Both PRs implement the same Synthetix-style HERO-in, HERO-out staking contract with the
same API surface (the dApp's `staking-abi.ts`). Both use OZ 5 `Ownable2Step`, `Pausable`,
`ReentrancyGuard` and `Votes` with EIP-712 domain `("HeroSingleSidedStaking","1")`. In both, pause blocks
only `stake`, stakers are self-delegated automatically, `renounceOwnership` is disabled, the pragma is
0.8.26, and the toolchain is hardhat 3. CI passes on both.

**Differences.**

| | #119 (carry forward) | #115 |
|---|---|---|
| Vote clock | timestamp (ERC-6372 `mode=timestamp`) | OZ default block number. Base and PulseChain block times differ, so the same block-based governance settings mean different wall-clock times on each chain |
| Fee-on-transfer | credits the amount actually received | reverts (`UnsupportedToken`) unless delta == amount |
| Reward accounting | explicit liability (`totalRewardsAccrued/Paid/Reconciled`, ceil rounding) plus a solvency check in `notifyRewardAmount` (`principal + accruedUnpaid + schedule <= balance`) | `rewardReserve` + `unallocatedRewards` carry; simpler, with no explicit solvency invariant |
| Surplus / donated HERO | recycled to stakers via `notifyRewardAmount(0)`; there is **no** owner path to HERO | `recoverERC20` can send the HERO surplus (balance − staked − reserve) to an arbitrary `to` chosen by the owner |
| Duration bounds | 1 s to 365 d | 1 d to 3650 d |
| Review history | audit "M-1 stranded HERO" fix; dust-rounding fixes (latest 2026-10-20) | none recorded |
| Tests | 517-line suite, including a fee-on-transfer mock | 300-line suite |
| Extra scope | none | adds HeroGovernor and HeroTimelock (out of scope for this PR) |

**Risks.**
- **#119:** its rounding/reconciliation logic is more complex, so there is more audit surface. Donated or
  accidentally sent HERO can never be returned by the owner; it streams to stakers.
- **#115:** the block-number clock is a problem for cross-chain governance. The owner can withdraw HERO
  surplus to any address, so a reserve-accounting bug would put rewards at risk. There is no solvency
  invariant.
- **Both:** the owner can pause new stakes and set reward timing. No timelock is built in.

**Recommendation: carry #119 forward.** Reasons: a timestamp clock that is consistent across chains,
no owner path to HERO, an explicit solvency invariant, the audit and dust fixes, and the larger test
suite. #115's Governor/Timelock should be reviewed separately if the DAO wants one (Tier B design).

## PulseChain blocker (found while porting)

OZ 5.6.1 `utils/Bytes.sol` uses `MCOPY` (Cancun), so the staking contract only compiles for
`evm_version >= cancun`. A read-only `eth_call` probe (no transaction) showed:
- **Base** (mainnet.base.org) executes `MCOPY` and `TSTORE`.
- **PulseChain** (rpc.pulsechain.com) returns `invalid opcode: MCOPY` and `invalid opcode: TSTORE`. It
  does run `PUSH0`, so it is Shanghai-level.

The cancun build in this PR is therefore **Base-only**. Local check: the unmodified #119 source compiles
with `--evm-version shanghai` against OZ **5.1.0, 5.2.0, 5.3.0 and 5.4.0**, but fails on 5.5.0, 5.6.0 and
5.6.1. **Tier B decision for VETS:**
- (a) Pin OZ 5.4.0 for one bytecode on both chains (moves off the lockfile pin; needs a re-audit), or
- (b) ship per-chain builds, or
- (c) stake on Base only.

## Hero token interaction (config, Tier B)

- Hero's `_checkTxLimit` applies to **every** transfer. If the owner lowers `maxTxAmount` and the staking
  contract is not tx-limit-exempt, withdrawals larger than maxTx revert. The test
  `test_LoweredMaxTxBlocksLargeWithdrawUnlessExempt` shows this. At deploy, the owner Safe must call
  `setTxLimitExempt(staking, true)`.
- Hero charges fees only on pair transfers, so stake and withdraw are not taxed. A fee exemption is not
  needed.
- Any non-pair Hero transfer can trigger `swapBack`, so a stake or withdraw can pay for a swap. The fork
  dry-run PR exercises this against the real router.

## Contract notes

- **Access control:** `Ownable2Step` (owner = constructor `initialOwner`, intended to be the V3 owner
  Safe). Only the owner can call `notifyRewardAmount`, `setRewardsDuration` (only after the period ends),
  `pause`/`unpause`, and `recoverERC20` (non-HERO tokens only, sent to `owner()`). Renounce is disabled.
- **Upgradeability:** none. The contract is immutable; a change means a new deployment and a migration.
- **Reentrancy:** `nonReentrant` on stake, withdraw, getReward, exit, notifyRewardAmount and
  recoverERC20. Uses SafeERC20.
- **Oracles:** none.
- **Token accounting:** staking and reward token are both HERO. Principal is credited as the amount
  received. Rewards accrue as tracked liabilities with ceil rounding, and `notifyRewardAmount` enforces
  solvency. Unallocated HERO is streamed to stakers. Votes are 1 per staked HERO, with a timestamp clock.
- **Pause/timelock:** pause blocks `stake` only; exit paths stay open. There is no timelock in the
  contract. Putting the owner Safe behind a timelock is Tier B.
- **Deploy scripts:** none in this PR. The local anvil-fork dry run is a separate PR. There is no
  mainnet script.

## Tests

`FOUNDRY_PROFILE=staking forge test -vv`. The staking build targets cancun (see the PulseChain section),
so it has its own profile; the default `forge test` runs the paris HERO suite.
- 22 unit tests port the #119 hardhat suite to Foundry (MiniTest, no forge-std), plus a 256-run fuzz
  test that checks the solvency invariant across stake, fund, warp and exit sequences.
- 2 integration tests run against the recovered V3 Hero (Base) with a mock router.
