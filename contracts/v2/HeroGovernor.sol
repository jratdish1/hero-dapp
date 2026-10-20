// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title HeroGovernor
 * @notice Trustless on-chain governance for HERO. Voting power = HERO staked in
 *         HeroSingleSidedStaking at the proposal snapshot (checkpointed, so it
 *         cannot be borrowed, moved or re-used after the snapshot).
 *         Every passed proposal is executed by a TimelockController after a
 *         mandatory delay. Replaces HeroDAOAnchor + the off-chain server tally.
 *
 * @dev Composition (OpenZeppelin 5.6.1, unmodified modules):
 *   - GovernorSettings          votingDelay / votingPeriod / proposalThreshold,
 *                               changeable only by governance itself
 *   - GovernorCountingSimple    For / Against / Abstain
 *   - GovernorVotes             reads HeroSingleSidedStaking (IVotes, block-number clock)
 *   - GovernorVotesQuorumFraction  quorum = % of total staked at snapshot
 *   - GovernorPreventLateQuorum  a last-minute quorum swing extends the vote
 *   - GovernorTimelockControl   all execution goes through the timelock
 *
 *   Role model is set on the TimelockController at deploy (see docs/governance.md):
 *     PROPOSER_ROLE + CANCELLER_ROLE -> this Governor only
 *     EXECUTOR_ROLE                  -> address(0) (anyone may execute after the delay)
 *     CANCELLER_ROLE                 -> multisig (emergency veto of queued ops only)
 *     DEFAULT_ADMIN_ROLE             -> timelock itself; deployer renounces
 *   No server, EOA or multisig can propose, pass or execute anything on its own.
 *
 *   NOT DEPLOYED. Deployment requires Codex Grade A at exact SHA and VETS GO.
 */

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorPreventLateQuorum.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";

contract HeroGovernor is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorPreventLateQuorum,
    GovernorTimelockControl
{
    constructor(
        IVotes stakedHero,
        TimelockController timelock_,
        uint48 initialVotingDelay,
        uint32 initialVotingPeriod,
        uint256 initialProposalThreshold,
        uint256 quorumPercent,
        uint48 lateQuorumVoteExtension
    )
        Governor("HeroGovernor")
        GovernorSettings(initialVotingDelay, initialVotingPeriod, initialProposalThreshold)
        GovernorVotes(stakedHero)
        GovernorVotesQuorumFraction(quorumPercent)
        GovernorPreventLateQuorum(lateQuorumVoteExtension)
        GovernorTimelockControl(timelock_)
    {}

    // --- Required overrides (pure OZ plumbing, no custom logic) ---
    function votingDelay() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingDelay();
    }

    function votingPeriod() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingPeriod();
    }

    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.proposalThreshold();
    }

    function quorum(uint256 timepoint)
        public
        view
        override(Governor, GovernorVotesQuorumFraction)
        returns (uint256)
    {
        return super.quorum(timepoint);
    }

    function proposalDeadline(uint256 proposalId)
        public
        view
        override(Governor, GovernorPreventLateQuorum)
        returns (uint256)
    {
        return super.proposalDeadline(proposalId);
    }

    function state(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function proposalNeedsQueuing(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (bool)
    {
        return super.proposalNeedsQueuing(proposalId);
    }

    function _tallyUpdated(uint256 proposalId) internal override(Governor, GovernorPreventLateQuorum) {
        super._tallyUpdated(proposalId);
    }

    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint48) {
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor() internal view override(Governor, GovernorTimelockControl) returns (address) {
        return super._executor();
    }
}
