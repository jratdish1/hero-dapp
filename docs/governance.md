# HeroGovernor + HeroTimelock — trustless DAO

Status: NOT DEPLOYED. Code + tests only. Deployment requires Codex Grade A at the exact PR head and a separate VETS GO.
Replaces HeroDAOAnchor and the off-chain server tally. No HERO server sits in any governance path.

## How a decision happens
1. Anyone with at least `proposalThreshold` staked HERO proposes (targets, values, calldatas, description).
2. After `votingDelay` blocks, the snapshot is fixed. Votes = staked HERO at that block (HeroSingleSidedStaking checkpoints).
3. Voting runs `votingPeriod` blocks. For / Against / Abstain. One vote per address.
4. Passes only if For > Against and quorum (default 4% of total staked at the snapshot) is reached.
5. Passed proposals are queued in HeroTimelock and wait `minDelay` (default 2 days).
6. After the delay, anyone may execute. The timelock performs the call.

## Role model (set at deploy, verified by tests)
| Role on HeroTimelock | Holder | Power |
|---|---|---|
| PROPOSER_ROLE | HeroGovernor only | queue passed proposals |
| EXECUTOR_ROLE | address(0) = anyone | execute after the delay |
| CANCELLER_ROLE | HeroGovernor + VETS multisig | cancel a queued operation (emergency veto) |
| DEFAULT_ADMIN_ROLE | the timelock itself | changes only via governance; deployer renounces |

The multisig can only veto. It cannot propose, pass, queue, or execute anything.
Governor settings (delay, period, threshold, quorum) change only through a passed proposal.

## Protections (each has a test)
- Stake added after the snapshot does not vote; withdrawing after the snapshot does not erase a counted vote.
- Unstaked wallet HERO has zero votes.
- Below quorum or zero votes = Defeated (no silent pass).
- Execution before the timelock delay reverts.
- Late-quorum swing extends voting (`lateQuorumVoteExtension`).
- Deployer cannot re-grant itself roles after renouncing admin.

## Deploy order (testnet first; VETS GO at each step)
1. Deploy HeroSingleSidedStaking (owner = deployer, temporary).
2. Deploy HeroTimelock(minDelay, [], [address(0)], deployer).
3. Deploy HeroGovernor(staking, timelock, votingDelay, votingPeriod, proposalThreshold, quorumPercent, lateQuorumExt).
4. Timelock: grant PROPOSER + CANCELLER to governor; CANCELLER to multisig.
5. Timelock: deployer renounces DEFAULT_ADMIN_ROLE.
6. Staking: `transferOwnership(timelock)`; first governance proposal calls `acceptOwnership()`.
7. Read back every role and owner on-chain before announcing.

Suggested starting parameters (Base ~2s blocks; adjust per chain): votingDelay 1 day of blocks, votingPeriod 5 days of blocks,
proposalThreshold 0.1% of staked supply, quorum 4%, lateQuorumExt 1 day of blocks, minDelay 2 days. Final values are a VETS decision.
