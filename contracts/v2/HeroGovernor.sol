// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {GovernorSettings} from "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import {GovernorCountingSimple} from "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import {GovernorVotes} from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import {GovernorVotesQuorumFraction} from
    "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import {GovernorTimelockControl} from "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";

/**
 * @title  HeroGovernor (BUILD 2)
 * @notice Trustless on-chain DAO for HERO. Replaces HeroDAOAnchor and the
 *         off-chain tally. No server sits in any vote or value path.
 *
 *         - Votes  = staked HERO in HeroSingleSidedStaking (BUILD 1), read with
 *                    getPastVotes at the proposal snapshot. Unstaked HERO does
 *                    not vote. Staking after the snapshot cannot change it.
 *         - Clock  = block.timestamp, taken from the staking contract, so every
 *                    delay and period below is in SECONDS on Base and PulseChain.
 *         - Quorum = a percent of total staked HERO at the snapshot.
 *         - Execution goes through a TimelockController. The Governor is the
 *                    only proposer. A multisig holds CANCELLER only.
 *
 *         Built only from OpenZeppelin Contracts 5.6.1 modules. No custom vote
 *         math. No owner. Settings change only by passed proposal.
 *
 *         Deploy fresh. Never point this at, or fund, any legacy HERO contract.
 */
contract HeroGovernor is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    error ZeroAddress();
    error QuorumOutOfRange(uint256 quorumPercent);

    /// @param stakedHeroVotes  HeroSingleSidedStaking (IVotes / IERC5805 source).
    /// @param timelock         TimelockController that executes passed proposals.
    /// @param initialVotingDelay   Seconds from proposal to vote start (snapshot).
    /// @param initialVotingPeriod  Seconds voting stays open.
    /// @param initialProposalThreshold  Staked HERO (wei) needed to propose.
    /// @param quorumPercent    Percent of total staked HERO needed (1..100).
    constructor(
        IVotes stakedHeroVotes,
        TimelockController timelock,
        uint48 initialVotingDelay,
        uint32 initialVotingPeriod,
        uint256 initialProposalThreshold,
        uint256 quorumPercent
    )
        Governor("HeroGovernor")
        GovernorSettings(initialVotingDelay, initialVotingPeriod, initialProposalThreshold)
        GovernorVotes(stakedHeroVotes)
        GovernorVotesQuorumFraction(quorumPercent)
        GovernorTimelockControl(timelock)
    {
        if (address(stakedHeroVotes) == address(0) || address(timelock) == address(0)) {
            revert ZeroAddress();
        }
        // A zero quorum would let one staker pass anything alone.
        if (quorumPercent == 0 || quorumPercent > 100) revert QuorumOutOfRange(quorumPercent);
    }

    // ─── Required overrides (OpenZeppelin 5.x multiple inheritance) ───────────

    function votingDelay() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingDelay();
    }

    function votingPeriod() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingPeriod();
    }

    function quorum(uint256 timepoint)
        public
        view
        override(Governor, GovernorVotesQuorumFraction)
        returns (uint256)
    {
        return super.quorum(timepoint);
    }

    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.proposalThreshold();
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
