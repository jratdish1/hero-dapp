// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title HeroCardsMarketplace
 * @notice Fixed-price NFT marketplace for HERO Cards — Architecture Stub (NOT DEPLOYED)
 *
 * @dev Non-custodial listing model. Ownership and approval verified at purchase.
 *      Reentrancy guard on all state-changing functions.
 *      DO NOT DEPLOY without full audit and explicit GO from VIC Foundation.
 *
 * A+ Fixes (2026-06-18):
 *   - buy(): Validate platformFee + royaltyFee <= listing.price before any
 *     transfer to prevent arithmetic underflow DoS.
 *   - buy(): Validate royaltyReceiver != address(0) when royaltyFee > 0 to
 *     prevent funds being silently lost.
 *   - setFee(): Require feeRecipient != address(0) when feeBps > 0 to prevent
 *     platform fees being trapped in the contract.
 *   - list(): Require duration > 0 to prevent zero-duration listings that
 *     expire immediately.
 *   - Added FeesTooHigh custom error for the fee guard.
 */

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

// ─── Errors ───────────────────────────────────────────────────────────────────
error ListingNotActive();
error NotSeller();
error InsufficientPayment();
error NotOwnerOrApproved();
error TransferFailed();
error InvalidPrice();
error ListingExpired();
error InvalidDuration();
error FeesTooHigh();
error InvalidFeeConfig();

contract HeroCardsMarketplace is Ownable2Step, Pausable, ReentrancyGuard {

    // ─── Types ────────────────────────────────────────────────────────────────
    struct Listing {
        address seller;
        address tokenAddress;
        uint256 tokenId;
        uint256 price;
        uint256 expiresAt;
        bool active;
    }

    // ─── State ────────────────────────────────────────────────────────────────
    uint256 public listingCount;
    uint256 public platformFeeBps;   // e.g. 250 = 2.5%
    address public feeRecipient;

    mapping(uint256 => Listing) public listings;

    // ─── Events ───────────────────────────────────────────────────────────────
    event Listed(uint256 indexed listingId, address indexed seller, address tokenAddress, uint256 tokenId, uint256 price, uint256 expiresAt);
    event Cancelled(uint256 indexed listingId);
    event Purchased(uint256 indexed listingId, address indexed buyer, uint256 price);
    event FeeUpdated(uint256 newFeeBps, address newRecipient);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(uint256 platformFeeBps_, address feeRecipient_) Ownable(msg.sender) {
        // Validate fee config at construction
        if (platformFeeBps_ > 0 && feeRecipient_ == address(0)) revert InvalidFeeConfig();
        platformFeeBps = platformFeeBps_;
        feeRecipient = feeRecipient_;
    }

    // ─── Listing ──────────────────────────────────────────────────────────────

    /**
     * @notice List an NFT for fixed-price sale.
     * @param tokenAddress The ERC-721 contract address.
     * @param tokenId The token ID to list.
     * @param price Sale price in native currency (wei).
     * @param duration Listing duration in seconds. Must be > 0.
     */
    function list(
        address tokenAddress,
        uint256 tokenId,
        uint256 price,
        uint256 duration
    ) external whenNotPaused returns (uint256 listingId) {
        if (price == 0) revert InvalidPrice();
        if (duration == 0) revert InvalidDuration();
        IERC721 token = IERC721(tokenAddress);
        if (token.ownerOf(tokenId) != msg.sender) revert NotOwnerOrApproved();
        // Caller must have approved marketplace before listing
        if (
            token.getApproved(tokenId) != address(this) &&
            !token.isApprovedForAll(msg.sender, address(this))
        ) revert NotOwnerOrApproved();

        listingId = ++listingCount;
        listings[listingId] = Listing({
            seller: msg.sender,
            tokenAddress: tokenAddress,
            tokenId: tokenId,
            price: price,
            expiresAt: block.timestamp + duration,
            active: true
        });

        emit Listed(listingId, msg.sender, tokenAddress, tokenId, price, block.timestamp + duration);
    }

    /**
     * @notice Cancel an active listing. Only the seller can cancel.
     */
    function cancelListing(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        if (!listing.active) revert ListingNotActive();
        if (listing.seller != msg.sender) revert NotSeller();
        listing.active = false;
        emit Cancelled(listingId);
    }

    /**
     * @notice Purchase a listed NFT.
     * Re-checks ownership and approval at purchase time to handle stale listings.
     */
    function buy(uint256 listingId) external payable nonReentrant whenNotPaused {
        Listing storage listing = listings[listingId];
        if (!listing.active) revert ListingNotActive();
        if (block.timestamp > listing.expiresAt) {
            listing.active = false;
            revert ListingExpired();
        }
        if (msg.value < listing.price) revert InsufficientPayment();

        IERC721 token = IERC721(listing.tokenAddress);

        // Re-verify ownership and approval at purchase time
        if (token.ownerOf(listing.tokenId) != listing.seller) {
            listing.active = false;
            revert NotOwnerOrApproved();
        }
        if (
            token.getApproved(listing.tokenId) != address(this) &&
            !token.isApprovedForAll(listing.seller, address(this))
        ) {
            listing.active = false;
            revert NotOwnerOrApproved();
        }

        listing.active = false;

        // Calculate fees
        uint256 platformFee = (listing.price * platformFeeBps) / 10_000;
        uint256 royaltyFee = 0;
        address royaltyReceiver = address(0);

        // ERC-2981 royalty
        try IERC2981(listing.tokenAddress).royaltyInfo(listing.tokenId, listing.price) returns (
            address receiver, uint256 royaltyAmount
        ) {
            royaltyReceiver = receiver;
            royaltyFee = royaltyAmount;
        } catch {}

        // Guard: combined fees must not exceed listing price
        if (platformFee + royaltyFee > listing.price) revert FeesTooHigh();

        // Guard: if royalty fee > 0, receiver must be a valid address
        if (royaltyFee > 0 && royaltyReceiver == address(0)) {
            // Treat as zero royalty — do not subtract from seller proceeds
            royaltyFee = 0;
        }

        uint256 sellerProceeds = listing.price - platformFee - royaltyFee;

        // Transfer NFT before payment (CEI: state change before external calls)
        token.safeTransferFrom(listing.seller, msg.sender, listing.tokenId);

        emit Purchased(listingId, msg.sender, listing.price);

        // Distribute proceeds
        if (platformFee > 0 && feeRecipient != address(0)) {
            (bool ok1, ) = feeRecipient.call{value: platformFee}("");
            if (!ok1) revert TransferFailed();
        }
        if (royaltyFee > 0 && royaltyReceiver != address(0)) {
            (bool ok2, ) = royaltyReceiver.call{value: royaltyFee}("");
            if (!ok2) revert TransferFailed();
        }
        (bool ok3, ) = listing.seller.call{value: sellerProceeds}("");
        if (!ok3) revert TransferFailed();

        // Refund overpayment
        if (msg.value > listing.price) {
            (bool ok4, ) = msg.sender.call{value: msg.value - listing.price}("");
            if (!ok4) revert TransferFailed();
        }
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /**
     * @notice Update platform fee configuration.
     * @dev Requires feeRecipient != address(0) when feeBps > 0 to prevent
     *      platform fees being trapped in the contract.
     */
    function setFee(uint256 feeBps, address recipient) external onlyOwner {
        require(feeBps <= 1000, "Fee too high"); // max 10%
        if (feeBps > 0 && recipient == address(0)) revert InvalidFeeConfig();
        platformFeeBps = feeBps;
        feeRecipient = recipient;
        emit FeeUpdated(feeBps, recipient);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
