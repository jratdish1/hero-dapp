# HeroSingleSidedStaking — design, proof, deploy checklist

Status: NOT DEPLOYED. Code + tests only. Deployment requires Codex Grade A at the exact PR head and a separate VETS GO.

## What it is
Stake HERO, earn HERO. Same function surface as the app ABI (`client/src/lib/staking-abi.ts`, 15 functions, checked by test).
Adds OpenZeppelin `Votes` so `HeroGovernor` (next build) can read staked HERO at a proposal snapshot
(`getVotes`, `getPastVotes`, `getPastTotalSupply`, `delegate`).

## Trust guarantees (each has a test and a mutation that the tests catch)
| Guarantee | How |
|---|---|
| Principal never backs rewards | `notifyRewardAmount` pulls new HERO in; `rewardReserve` tracks funded-minus-paid separately from `totalSupply` (staked) |
| Owner can never take principal or funded rewards | `recoverERC20(HERO)` limited to `balance - totalStaked - rewardReserve` |
| Withdraw works while paused | pause blocks `stake` only; `withdraw`, `getReward`, `exit` have no pause check |
| No stranded rewards | time with zero stakers accrues to `unallocatedRewards`, rolled into the next `notifyRewardAmount` |
| No double-counted votes | self-delegate runs before the balance is credited; test asserts sum of votes == totalSupply |
| No fee-on-transfer surprises | exact balance-delta check on stake and funding (`UnsupportedToken`) |
| Ownership can't be orphaned | `Ownable2Step`; `renounceOwnership` disabled |

Voting power: first stake auto-self-delegates. Wallet HERO that is not staked has zero votes.
Clock: block number (OZ default), so Governor snapshots are block numbers on each chain.

## Proof (local, exact files in this PR)
- New tests: 22/22 (`test/v2/HeroSingleSidedStaking.test.mjs`)
- Full `test/v2`: 157/157 (135 existing + 22)
- Mutations caught: owner-drains-principal, withdraw-blocked-when-paused, vote double-count, reserve-not-decremented, idle-rewards-stranded (5/5)
- Compiler: solc 0.8.26 native + WASM seeded from ethereum/solc-bin; sha256 and keccak256 both matched the official list.json

## Deploy checklist (VETS GO required at each step)
1. Codex Grade A at exact head; Slither run clean or dispositioned.
2. Owner = hardware wallet or multisig. Never a server key.
3. Base Sepolia / PulseChain testnet first with a test token.
4. Constructor: `(HERO address, owner multisig, rewardsDuration)`.
5. Fund: owner `approve` then `notifyRewardAmount(amount)`.
6. Point `client` staking address config at the new contract only after live read-back of `stakingToken`, `rewardsToken`, `owner`, `rewardsDuration`.

## Existing live staking contracts (not touched by this PR)
- Base `0xAD7991a6…C722` — source unverified; holds user HERO. Migration plan: users `exit()` from old, `stake()` into new. No forced moves.
- PulseChain `0xD5F17397…297E` — unread.
Hermes read-only first: `stakingToken`, `rewardsToken`, `owner`, `totalSupply` on both.
