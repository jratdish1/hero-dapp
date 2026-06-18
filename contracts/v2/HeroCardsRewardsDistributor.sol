// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title HeroCardsRewardsDistributor
 * @notice Claim-based holder rewards distributor — Architecture Stub (NOT DEPLOYED)
 *
 * @dev Merkle-root-per-epoch model. No unbounded loops over holders.
 *      Supports native token and/or ERC-20 (HERO) rewards.
 *      DO NOT DEPLOY without full audit and explicit GO from VIC Foundation.
 */

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// ─── Errors ───────────────────────────────────────────────────────────────────
error EpochNotActive();
error AlreadyClaimed();
error InvalidProof();
error EpochFinalized();
error RecoveryTooEarly();
error TransferFailed();

contract HeroCardsRewardsDistributor is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Types ────────────────────────────────────────────────────────────────
    struct Epoch {
        bytes32 merkleRoot;
        uint256 nativeAmount;   // Native token (ETH/PLS) allocated
        uint256 tokenAmount;    // ERC-20 (HERO) allocated
        uint256 startTime;
        uint256 endTime;
        bool finalized;
    }

    // ─── State ────────────────────────────────────────────────────────────────
    IERC20 public heroToken;
    uint256 public epochCount;
    uint256 public constant RECOVERY_DELAY = 90 days;

    mapping(uint256 => Epoch) public epochs;
    /// @dev epochId => wallet => claimed
    mapping(uint256 => mapping(address => bool)) public claimed;

    // ─── Events ───────────────────────────────────────────────────────────────
    event EpochCreated(uint256 indexed epochId, bytes32 merkleRoot, uint256 nativeAmount, uint256 tokenAmount);
    event EpochFinalized(uint256 indexed epochId);
    event Claimed(uint256 indexed epochId, address indexed wallet, uint256 nativeAmount, uint256 tokenAmount);
    event FundsRecovered(uint256 indexed epochId, address indexed to, uint256 nativeAmount, uint256 tokenAmount);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(address heroToken_) Ownable(msg.sender) {
        heroToken = IERC20(heroToken_);
    }

    // ─── Epoch Management ─────────────────────────────────────────────────────

    /**
     * @notice Create a new reward epoch. Funds must be sent with this call (native).
     * @param merkleRoot_ Merkle root of (wallet, nativeAmount, tokenAmount) leaves.
     * @param tokenAmount_ ERC-20 (HERO) amount to allocate (must be pre-approved).
     * @param duration_ Epoch duration in seconds.
     */
    function createEpoch(
        bytes32 merkleRoot_,
        uint256 tokenAmount_,
        uint256 duration_
    ) external payable onlyOwner {
        uint256 epochId = ++epochCount;
        epochs[epochId] = Epoch({
            merkleRoot: merkleRoot_,
            nativeAmount: msg.value,
            tokenAmount: tokenAmount_,
            startTime: block.timestamp,
            endTime: block.timestamp + duration_,
            finalized: false
        });

        if (tokenAmount_ > 0) {
            heroToken.safeTransferFrom(msg.sender, address(this), tokenAmount_);
        }

        emit EpochCreated(epochId, merkleRoot_, msg.value, tokenAmount_);
    }

    /** @notice Finalize an epoch — root becomes immutable after this. */
    function finalizeEpoch(uint256 epochId) external onlyOwner {
        Epoch storage epoch = epochs[epochId];
        if (epoch.finalized) revert EpochFinalized();
        epoch.finalized = true;
        emit EpochFinalized(epochId);
    }

    // ─── Claim ────────────────────────────────────────────────────────────────

    /**
     * @notice Claim rewards for a given epoch.
     * @param epochId The epoch to claim from.
     * @param nativeAmount Native token amount allocated to caller in this epoch.
     * @param tokenAmount ERC-20 (HERO) amount allocated to caller in this epoch.
     * @param proof Merkle proof for (msg.sender, nativeAmount, tokenAmount).
     */
    function claim(
        uint256 epochId,
        uint256 nativeAmount,
        uint256 tokenAmount,
        bytes32[] calldata proof
    ) external nonReentrant whenNotPaused {
        Epoch storage epoch = epochs[epochId];
        if (!epoch.finalized) revert EpochNotActive();
        if (block.timestamp > epoch.endTime) revert EpochNotActive();
        if (claimed[epochId][msg.sender]) revert AlreadyClaimed();

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, nativeAmount, tokenAmount));
        if (!MerkleProof.verify(proof, epoch.merkleRoot, leaf)) revert InvalidProof();

        claimed[epochId][msg.sender] = true;
        emit Claimed(epochId, msg.sender, nativeAmount, tokenAmount);

        if (nativeAmount > 0) {
            (bool ok, ) = msg.sender.call{value: nativeAmount}("");
            if (!ok) revert TransferFailed();
        }
        if (tokenAmount > 0) {
            heroToken.safeTransfer(msg.sender, tokenAmount);
        }
    }

    // ─── Recovery ─────────────────────────────────────────────────────────────

    /**
     * @notice Recover unclaimed funds from a finalized, expired epoch.
     * Can only be called RECOVERY_DELAY after epoch end.
     */
    function recoverFunds(uint256 epochId, address to) external onlyOwner {
        Epoch storage epoch = epochs[epochId];
        if (!epoch.finalized) revert EpochNotActive();
        if (block.timestamp < epoch.endTime + RECOVERY_DELAY) revert RecoveryTooEarly();

        uint256 native = epoch.nativeAmount;
        uint256 tokens = epoch.tokenAmount;
        epoch.nativeAmount = 0;
        epoch.tokenAmount = 0;

        emit FundsRecovered(epochId, to, native, tokens);

        if (native > 0) {
            (bool ok, ) = to.call{value: native}("");
            if (!ok) revert TransferFailed();
        }
        if (tokens > 0) {
            heroToken.safeTransfer(to, tokens);
        }
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    receive() external payable {}
}
