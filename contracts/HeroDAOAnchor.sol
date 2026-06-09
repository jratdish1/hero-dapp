// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title HeroDAOAnchor
 * @author HERO DAO (herobase.io)
 * @notice On-chain anchor contract for hybrid DAO governance.
 *         Stores proposal hashes, vote snapshots, and execution timelocks.
 *         The off-chain system handles UX; this contract provides verifiability.
 * 
 * @dev Security features implemented per Grok audit + GPT-4.1 Codex audit:
 *      - Proposal hash commitment (prevents tampering)
 *      - 48-hour timelock on execution
 *      - ReentrancyGuard on all state-changing functions
 *      - Role-based access (owner + executor)
 *      - Event emission for all critical state changes
 *      - No unbounded loops
 *      - Checks-Effects-Interactions pattern
 *      - Zero-value input validation (Audit Fix #9)
 *      - Correct error types (Audit Fix #6)
 *      - Ownable constructor fix (Audit Fix #8)
 */

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract HeroDAOAnchor is Ownable, ReentrancyGuard {

    // ─── Constants ──────────────────────────────────────────────────

    uint256 public constant TIMELOCK_DURATION = 48 hours;
    uint256 public constant MIN_VOTING_PERIOD = 1 days;
    uint256 public constant MAX_VOTING_PERIOD = 30 days;

    // ─── State ──────────────────────────────────────────────────────

    struct ProposalAnchor {
        bytes32 contentHash;       // SHA-256 of proposal content
        address proposer;          // Who created it
        uint256 startBlock;        // Block number at creation (for balance snapshots)
        uint256 votingEndsAt;      // Timestamp when voting closes
        uint256 finalizedAt;       // Timestamp when result was anchored
        uint256 executionUnlocksAt;// Timestamp when execution is allowed
        bool finalized;
        bool executed;
        uint256 votesFor;          // Final tally anchored on-chain
        uint256 votesAgainst;
        uint256 votesAbstain;
    }

    mapping(bytes32 => ProposalAnchor) public proposals; // proposalId hash => anchor
    mapping(bytes32 => bool) public executedPayloads;    // execution hash => done

    address public executor; // Authorized executor (multisig or timelock contract)

    // ─── Events ─────────────────────────────────────────────────────

    event ProposalAnchored(
        bytes32 indexed proposalIdHash,
        bytes32 contentHash,
        address indexed proposer,
        uint256 startBlock,
        uint256 votingEndsAt
    );

    event ProposalFinalized(
        bytes32 indexed proposalIdHash,
        uint256 votesFor,
        uint256 votesAgainst,
        uint256 votesAbstain,
        uint256 executionUnlocksAt
    );

    event ProposalExecuted(
        bytes32 indexed proposalIdHash,
        address indexed target,
        uint256 value,
        bytes data
    );

    event ExecutorUpdated(address indexed oldExecutor, address indexed newExecutor);

    // ─── Errors ─────────────────────────────────────────────────────

    error ProposalAlreadyExists();
    error ProposalNotFound();
    error ProposalNotFinalized();
    error ProposalAlreadyFinalized();  // AUDIT FIX #6: Distinct error for finalization
    error ProposalAlreadyExecuted();
    error TimelockNotExpired(uint256 unlocksAt);
    error InvalidVotingPeriod();
    error OnlyExecutor();
    error ExecutionFailed();
    error PayloadAlreadyExecuted();
    error InvalidInput();              // AUDIT FIX #9: For zero-value checks
    error VotingPeriodNotEnded();       // CODEX FIX #1: Prevent premature finalization
    error InvalidExecutor();            // CODEX FIX #2: Explicit executor error
    error InvalidCall();                // CODEX FIX #5: Custom error for fallback
    error InvalidVoteTally();           // CODEX FIX #6: Zero-vote sanity check

    // ─── Modifiers ──────────────────────────────────────────────────

    modifier onlyExecutor() {
        if (msg.sender != executor && msg.sender != owner()) revert OnlyExecutor();
        _;
    }

    // ─── Constructor ────────────────────────────────────────────────

    // AUDIT FIX #8: Ownable() takes initial owner as parameter in OZ v5
    constructor(address _executor) Ownable(msg.sender) {
        // CODEX FIX #2: Use custom error instead of require string
        if (_executor == address(0)) revert InvalidExecutor();
        executor = _executor;
    }

    // ─── Core Functions ─────────────────────────────────────────────

    /**
     * @notice Anchor a new proposal on-chain at creation time.
     * @param proposalIdHash keccak256 of the off-chain proposal ID string
     * @param contentHash SHA-256 hash of proposal content (title + description + params)
     * @param votingEndsAt Unix timestamp when voting closes
     */
    function anchorProposal(
        bytes32 proposalIdHash,
        bytes32 contentHash,
        uint256 votingEndsAt,
        address proposer_          // CODEX FIX #3: Accept actual proposer address
    ) external onlyExecutor nonReentrant {
        // AUDIT FIX #9: Validate non-zero inputs
        if (proposalIdHash == bytes32(0)) revert InvalidInput();
        if (contentHash == bytes32(0)) revert InvalidInput();
        // CODEX FIX #3: Validate actual proposer address
        if (proposer_ == address(0)) revert InvalidInput();
        if (proposals[proposalIdHash].startBlock != 0) revert ProposalAlreadyExists();
        // CODEX FIX #7: Explicit future-timestamp check for clarity
        if (votingEndsAt <= block.timestamp) revert InvalidVotingPeriod();
        if (votingEndsAt < block.timestamp + MIN_VOTING_PERIOD) revert InvalidVotingPeriod();
        if (votingEndsAt > block.timestamp + MAX_VOTING_PERIOD) revert InvalidVotingPeriod();

        proposals[proposalIdHash] = ProposalAnchor({
            contentHash: contentHash,
            proposer: proposer_,   // CODEX FIX #3: Store actual proposer
            startBlock: block.number,
            votingEndsAt: votingEndsAt,
            finalizedAt: 0,
            executionUnlocksAt: 0,
            finalized: false,
            executed: false,
            votesFor: 0,
            votesAgainst: 0,
            votesAbstain: 0
        });

        emit ProposalAnchored(proposalIdHash, contentHash, proposer_, block.number, votingEndsAt);
    }

    /**
     * @notice Finalize a proposal by anchoring the vote results on-chain.
     *         Starts the 48-hour timelock before execution is allowed.
     * @param proposalIdHash keccak256 of the off-chain proposal ID string
     * @param votesFor Total votes in favor
     * @param votesAgainst Total votes against
     * @param votesAbstain Total abstentions
     */
    function finalizeProposal(
        bytes32 proposalIdHash,
        uint256 votesFor,
        uint256 votesAgainst,
        uint256 votesAbstain
    ) external onlyExecutor nonReentrant {
        ProposalAnchor storage p = proposals[proposalIdHash];
        if (p.startBlock == 0) revert ProposalNotFound();
        // AUDIT FIX #6: Use correct error for already-finalized proposals
        if (p.finalized) revert ProposalAlreadyFinalized();
        // CODEX FIX #1: Prevent premature finalization before voting period ends
        if (block.timestamp < p.votingEndsAt) revert VotingPeriodNotEnded();

        // CODEX FIX #6: Sanity check — at least one vote must be recorded
        if (votesFor + votesAgainst + votesAbstain == 0) revert InvalidVoteTally();

        // Checks-Effects-Interactions: update state before any external calls
        p.finalized = true;
        p.finalizedAt = block.timestamp;
        p.executionUnlocksAt = block.timestamp + TIMELOCK_DURATION;
        p.votesFor = votesFor;
        p.votesAgainst = votesAgainst;
        p.votesAbstain = votesAbstain;

        emit ProposalFinalized(proposalIdHash, votesFor, votesAgainst, votesAbstain, p.executionUnlocksAt);
    }

    /**
     * @notice Execute a finalized proposal after the timelock has expired.
     * @param proposalIdHash keccak256 of the off-chain proposal ID string
     * @param target Contract or address to call
     * @param value ETH/PLS value to send
     * @param data Calldata for the execution
     */
    function executeProposal(
        bytes32 proposalIdHash,
        address target,
        uint256 value,
        bytes calldata data
    ) external onlyExecutor nonReentrant {
        ProposalAnchor storage p = proposals[proposalIdHash];
        if (p.startBlock == 0) revert ProposalNotFound();
        if (!p.finalized) revert ProposalNotFinalized();
        if (p.executed) revert ProposalAlreadyExecuted();
        if (block.timestamp < p.executionUnlocksAt) revert TimelockNotExpired(p.executionUnlocksAt);
        // CODEX FIX #4: Validate target address
        if (target == address(0)) revert InvalidInput();

        // Generate execution payload hash for replay protection
        bytes32 payloadHash = keccak256(abi.encode(proposalIdHash, target, value, data));
        if (executedPayloads[payloadHash]) revert PayloadAlreadyExecuted();

        // Checks-Effects-Interactions pattern
        p.executed = true;
        executedPayloads[payloadHash] = true;

        // External call LAST
        // AUDIT FIX 1.3: Use OpenZeppelin Address for safer external calls (reverts on failure)
        Address.functionCallWithValue(target, data, value);

        emit ProposalExecuted(proposalIdHash, target, value, data);
    }

    // ─── Admin Functions ────────────────────────────────────────────

    /**
     * @notice Update the executor address (e.g., to a multisig).
     */
    function setExecutor(address _newExecutor) external onlyOwner {
        // CODEX FIX #2: Use custom error instead of require string
        if (_newExecutor == address(0)) revert InvalidExecutor();
        address old = executor;
        executor = _newExecutor;
        emit ExecutorUpdated(old, _newExecutor);
    }

    // ─── View Functions ─────────────────────────────────────────────

    /**
     * @notice Check if a proposal's timelock has expired.
     */
    function isExecutable(bytes32 proposalIdHash) external view returns (bool) {
        ProposalAnchor storage p = proposals[proposalIdHash];
        return p.finalized && !p.executed && block.timestamp >= p.executionUnlocksAt;
    }

    /**
     * @notice Get the remaining timelock duration for a proposal.
     */
    function timelockRemaining(bytes32 proposalIdHash) external view returns (uint256) {
        ProposalAnchor storage p = proposals[proposalIdHash];
        if (!p.finalized || p.executed) return 0;
        if (block.timestamp >= p.executionUnlocksAt) return 0;
        return p.executionUnlocksAt - block.timestamp;
    }

    /**
     * @notice Verify a proposal's content hash matches.
     */
    function verifyContentHash(bytes32 proposalIdHash, bytes32 expectedHash) external view returns (bool) {
        return proposals[proposalIdHash].contentHash == expectedHash;
    }

    /**
     * @notice Get the snapshot block for a proposal (for off-chain balance verification).
     */
    function getSnapshotBlock(bytes32 proposalIdHash) external view returns (uint256) {
        return proposals[proposalIdHash].startBlock;
    }

    // Allow contract to receive native tokens for treasury operations
    receive() external payable {}

    // AUDIT FIX 1.4: Explicit fallback to reject invalid calls
    // CODEX FIX #5: Use custom error for consistency
    fallback() external payable {
        revert InvalidCall();
    }
}
