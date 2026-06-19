// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title HeroBuyBurnRouter
 * @notice Fee splitter for V2 mint and marketplace proceeds — Architecture Stub (NOT DEPLOYED)
 *
 * @dev Accepts native currency from HeroCardsV2 mint and HeroCardsMarketplace.
 *      Splits proceeds according to basis-point config (must sum to 10,000).
 *      DO NOT DEPLOY without full audit and explicit GO from VIC Foundation.
 *
 * Suggested starting split (all configurable within capped bounds):
 *   40% → VIC Foundation / charity treasury
 *   25% → NFT holder reflections (HeroCardsRewardsDistributor)
 *   20% → HERO/VETS buy-and-burn or liquidity support
 *   15% → operations / development / infrastructure
 *
 * A+ Fixes (2026-06-18):
 *   - Paused receive() behavior: Option B — intentionally revert while paused.
 *     Upstream callers (HeroCardsV2 mint) must check router pause state before
 *     forwarding funds. This is the simpler, more auditable design.
 *     OPERATOR SOP: Do not pause the router while minting is active.
 *   - Removed unused SlippageExceeded error.
 *   - updateSplits(): Added explicit length-mismatch revert with LengthMismatch error.
 *   - _distribute(): Last recipient receives remainder to avoid dust from rounding.
 *     This is preserved and explicitly documented.
 */

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ─── Errors ───────────────────────────────────────────────────────────────────
error BpsNotSumTo10000();
error TransferFailed();
error ZeroAddress();
error LengthMismatch();
error RouterPaused();

contract HeroBuyBurnRouter is Ownable2Step, Pausable, ReentrancyGuard {

    // ─── Types ────────────────────────────────────────────────────────────────
    struct Split {
        address recipient;
        uint256 bps;
        string label;
    }

    // ─── State ────────────────────────────────────────────────────────────────
    Split[] public splits;
    uint256 public totalReceived;
    uint256 public totalDistributed;

    // ─── Events ───────────────────────────────────────────────────────────────
    event FundsReceived(address indexed from, uint256 amount);
    event FundsDistributed(uint256 totalAmount);
    event SplitUpdated(uint256 splitCount);
    event EmergencyWithdraw(address indexed to, uint256 amount);

    // ─── Constructor ──────────────────────────────────────────────────────────
    /**
     * @param recipients_ Array of recipient addresses.
     * @param bpsValues_  Array of basis points (must sum to 10,000).
     * @param labels_     Human-readable labels for each split.
     */
    constructor(
        address[] memory recipients_,
        uint256[] memory bpsValues_,
        string[] memory labels_
    ) Ownable(msg.sender) {
        _setSplits(recipients_, bpsValues_, labels_);
    }

    // ─── Receive ──────────────────────────────────────────────────────────────

    /**
     * @notice Receive ETH and immediately distribute to all recipients.
     *
     * @dev PAUSED BEHAVIOR (Option B — intentional revert):
     *      While paused, receive() reverts with RouterPaused().
     *      Upstream callers (HeroCardsV2 mint) must check router pause state
     *      before forwarding funds.
     *      OPERATOR SOP: Do not pause the router while minting is active.
     *      Use emergencyWithdraw() to recover funds after pausing.
     */
    receive() external payable {
        if (paused()) revert RouterPaused();
        totalReceived += msg.value;
        emit FundsReceived(msg.sender, msg.value);
        _distribute(msg.value);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    /**
     * @notice Distribute `amount` across all configured splits.
     * @dev The last recipient receives the remainder to avoid dust from rounding.
     *      If any recipient reverts on receiving ETH, the entire distribution reverts.
     *      OPERATOR SOP: Ensure all recipients are EOAs or contracts that accept ETH.
     */
    function _distribute(uint256 amount) internal nonReentrant {
        uint256 len = splits.length;
        uint256 distributed = 0;

        for (uint256 i = 0; i < len; i++) {
            uint256 share;
            if (i == len - 1) {
                // Last recipient gets remainder to avoid dust from rounding
                share = amount - distributed;
            } else {
                share = (amount * splits[i].bps) / 10_000;
            }
            distributed += share;

            if (share > 0) {
                (bool ok, ) = splits[i].recipient.call{value: share}("");
                if (!ok) revert TransferFailed();
            }
        }

        totalDistributed += distributed;
        emit FundsDistributed(distributed);
    }

    function _setSplits(
        address[] memory recipients_,
        uint256[] memory bpsValues_,
        string[] memory labels_
    ) internal {
        if (recipients_.length != bpsValues_.length || bpsValues_.length != labels_.length)
            revert LengthMismatch();

        uint256 total = 0;
        for (uint256 i = 0; i < bpsValues_.length; i++) {
            if (recipients_[i] == address(0)) revert ZeroAddress();
            total += bpsValues_[i];
        }
        if (total != 10_000) revert BpsNotSumTo10000();

        delete splits;
        for (uint256 i = 0; i < recipients_.length; i++) {
            splits.push(Split({
                recipient: recipients_[i],
                bps: bpsValues_[i],
                label: labels_[i]
            }));
        }

        emit SplitUpdated(splits.length);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /**
     * @notice Update the fee split configuration.
     * Basis points must sum to exactly 10,000.
     */
    function updateSplits(
        address[] calldata recipients_,
        uint256[] calldata bpsValues_,
        string[] calldata labels_
    ) external onlyOwner {
        _setSplits(recipients_, bpsValues_, labels_);
    }

    /**
     * @notice Emergency withdraw for stuck funds.
     * Only callable when paused.
     */
    function emergencyWithdraw(address to) external onlyOwner whenPaused {
        uint256 balance = address(this).balance;
        (bool ok, ) = to.call{value: balance}("");
        if (!ok) revert TransferFailed();
        emit EmergencyWithdraw(to, balance);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─── View ─────────────────────────────────────────────────────────────────

    function getSplitCount() external view returns (uint256) {
        return splits.length;
    }

    function getSplit(uint256 index) external view returns (address recipient, uint256 bps, string memory label) {
        Split storage s = splits[index];
        return (s.recipient, s.bps, s.label);
    }
}
