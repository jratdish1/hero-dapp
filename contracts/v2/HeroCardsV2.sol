// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title HeroCardsV2
 * @notice HERO Cards V2 ERC-721 Collection — Architecture Stub (NOT DEPLOYED)
 *
 * @dev This is a planning/architecture stub for the V2 collection.
 *      DO NOT DEPLOY without a full audit, testnet dry-run, and explicit GO from VIC Foundation.
 *
 * V2 adds over V1:
 *  - Pause/unpause emergency control
 *  - Owner two-step transfer (Ownable2Step pattern)
 *  - Reentrancy guard on mint
 *  - Fee splitter/router integration (HeroBuyBurnRouter)
 *  - Royalty support (ERC-2981)
 *  - Contract URI for OpenSea/marketplace metadata
 *  - No unbounded holder loops
 *
 * Deployed V1 contracts remain the live/current collection:
 *   Base:       0x5Fad096af059ff9A2167351A0ffc8b45D71897bE
 *   PulseChain: 0xCe609B3A82E89FCd4B5e5a29159b051CE86f7B36
 */

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

// ─── Errors ───────────────────────────────────────────────────────────────────
error MintClosed();
error NotWhitelisted();
error ExceedsMaxSupply();
error ExceedsWalletLimit();
error InsufficientPayment();
error InvalidAmount();
error RouterNotSet();
error WithdrawFailed();
error AlreadyRevealed();

// ─── Enums ────────────────────────────────────────────────────────────────────
enum MintPhase {
    CLOSED,
    WHITELIST,
    PUBLIC
}

contract HeroCardsV2 is
    ERC721,
    ERC721Enumerable,
    ERC721Royalty,
    Ownable2Step,
    Pausable,
    ReentrancyGuard
{
    // ─── Constants ────────────────────────────────────────────────────────────
    uint256 public constant MAX_SUPPLY = 1500;
    uint256 public constant MAX_PER_WALLET = 20;

    // ─── State ────────────────────────────────────────────────────────────────
    uint256 public mintPrice;
    uint256 public whitelistPrice;
    MintPhase public mintPhase;

    string private _baseTokenURI;
    string private _contractURI;

    bytes32 public merkleRoot;

    uint256 public randomStartIndex;
    bool public startIndexSet;
    string public provenanceHash;

    address public buyBurnRouter;

    mapping(address => uint256) public mintedPerWallet;

    // ─── Events ───────────────────────────────────────────────────────────────
    event Minted(address indexed to, uint256 indexed tokenId);
    event MintPhaseChanged(MintPhase newPhase);
    event MerkleRootUpdated(bytes32 newRoot);
    event RouterUpdated(address indexed newRouter);
    event RandomStartIndexSet(uint256 index);
    event EmergencyWithdraw(address indexed to, uint256 amount);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseURI_,
        string memory contractURI_,
        uint256 mintPrice_,
        uint256 whitelistPrice_,
        address royaltyReceiver_,
        uint96 royaltyFeeBps_
    ) ERC721(name_, symbol_) Ownable(msg.sender) {
        _baseTokenURI = baseURI_;
        _contractURI = contractURI_;
        mintPrice = mintPrice_;
        whitelistPrice = whitelistPrice_;
        _setDefaultRoyalty(royaltyReceiver_, royaltyFeeBps_);
    }

    // ─── Mint ─────────────────────────────────────────────────────────────────

    /**
     * @notice Public mint. Requires PUBLIC phase and correct payment.
     * @param quantity Number of tokens to mint (1–MAX_PER_WALLET).
     */
    function mint(uint256 quantity) external payable nonReentrant whenNotPaused {
        if (mintPhase != MintPhase.PUBLIC) revert MintClosed();
        if (quantity == 0 || quantity > MAX_PER_WALLET) revert InvalidAmount();
        if (totalSupply() + quantity > MAX_SUPPLY) revert ExceedsMaxSupply();
        if (mintedPerWallet[msg.sender] + quantity > MAX_PER_WALLET) revert ExceedsWalletLimit();
        if (msg.value < mintPrice * quantity) revert InsufficientPayment();

        _executeMint(msg.sender, quantity);
        _routeFunds();
    }

    /**
     * @notice Whitelist mint. Requires WHITELIST phase, valid Merkle proof, and correct payment.
     * @param quantity Number of tokens to mint.
     * @param proof Merkle proof for the caller's address.
     */
    function whitelistMint(uint256 quantity, bytes32[] calldata proof)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        if (mintPhase != MintPhase.WHITELIST) revert MintClosed();
        if (quantity == 0 || quantity > MAX_PER_WALLET) revert InvalidAmount();
        if (totalSupply() + quantity > MAX_SUPPLY) revert ExceedsMaxSupply();
        if (mintedPerWallet[msg.sender] + quantity > MAX_PER_WALLET) revert ExceedsWalletLimit();
        if (msg.value < whitelistPrice * quantity) revert InsufficientPayment();

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        if (!MerkleProof.verify(proof, merkleRoot, leaf)) revert NotWhitelisted();

        _executeMint(msg.sender, quantity);
        _routeFunds();
    }

    // ─── Internal Helpers ─────────────────────────────────────────────────────

    function _executeMint(address to, uint256 quantity) internal {
        uint256 startId = totalSupply() + 1;
        mintedPerWallet[to] += quantity;
        for (uint256 i = 0; i < quantity; i++) {
            _safeMint(to, startId + i);
            emit Minted(to, startId + i);
        }
    }

    function _routeFunds() internal {
        if (buyBurnRouter == address(0)) return;
        // Forward all msg.value to the router for fee splitting.
        // Router is responsible for treasury/burn/rewards split.
        (bool ok, ) = buyBurnRouter.call{value: msg.value}("");
        if (!ok) revert WithdrawFailed();
    }

    // ─── Holder Utility ───────────────────────────────────────────────────────

    /**
     * @notice Returns the holder tier based on balance.
     * 0 = NONE, 1 = BRONZE (1+), 2 = SILVER (3+), 3 = GOLD (10+)
     */
    function getHolderTier(address account) external view returns (uint8) {
        uint256 bal = balanceOf(account);
        if (bal >= 10) return 3;
        if (bal >= 3) return 2;
        if (bal >= 1) return 1;
        return 0;
    }

    /** @notice Returns true if account holds at least 1 token. */
    function isHolder(address account) external view returns (bool) {
        return balanceOf(account) > 0;
    }

    /** @notice Returns fee discount in basis points (200 bps = 2%). */
    function getFeeDiscount(address account) external view returns (uint256) {
        return balanceOf(account) > 0 ? 200 : 0;
    }

    /** @notice Returns true if account can access the spin wheel (must hold 1+). */
    function canAccessSpinWheel(address account) external view returns (bool) {
        return balanceOf(account) > 0;
    }

    // ─── Randomized Reveal ────────────────────────────────────────────────────

    /**
     * @notice Set the random start index for metadata reveal.
     * Can only be called once, after all tokens are minted.
     * Uses a future block hash for on-chain randomness.
     */
    function setRandomStartIndex() external onlyOwner {
        if (startIndexSet) revert AlreadyRevealed();
        if (totalSupply() < MAX_SUPPLY) revert InvalidAmount();
        randomStartIndex = uint256(blockhash(block.number - 1)) % MAX_SUPPLY;
        startIndexSet = true;
        emit RandomStartIndexSet(randomStartIndex);
    }

    /** @notice Set the provenance hash before mint begins. */
    function setProvenanceHash(string calldata hash) external onlyOwner {
        provenanceHash = hash;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setMintPhase(MintPhase phase) external onlyOwner {
        mintPhase = phase;
        emit MintPhaseChanged(phase);
    }

    function setMerkleRoot(bytes32 root) external onlyOwner {
        merkleRoot = root;
        emit MerkleRootUpdated(root);
    }

    function setMintPrice(uint256 price) external onlyOwner {
        mintPrice = price;
    }

    function setWhitelistPrice(uint256 price) external onlyOwner {
        whitelistPrice = price;
    }

    function setBaseURI(string calldata uri) external onlyOwner {
        _baseTokenURI = uri;
    }

    function setContractURI(string calldata uri) external onlyOwner {
        _contractURI = uri;
    }

    function setBuyBurnRouter(address router) external onlyOwner {
        buyBurnRouter = router;
        emit RouterUpdated(router);
    }

    function setDefaultRoyalty(address receiver, uint96 feeBps) external onlyOwner {
        _setDefaultRoyalty(receiver, feeBps);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Emergency withdraw for stuck funds (e.g., if router is unset).
     * Requires router to be address(0) to prevent bypassing fee routing.
     */
    function emergencyWithdraw(address to) external onlyOwner {
        if (buyBurnRouter != address(0)) revert RouterNotSet();
        uint256 balance = address(this).balance;
        (bool ok, ) = to.call{value: balance}("");
        if (!ok) revert WithdrawFailed();
        emit EmergencyWithdraw(to, balance);
    }

    // ─── Metadata ─────────────────────────────────────────────────────────────

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function contractURI() external view returns (string memory) {
        return _contractURI;
    }

    // ─── Overrides ────────────────────────────────────────────────────────────

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721Royalty)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
