// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title HeroCards
 * @author HERO DAO (herobase.io)
 * @notice ERC-721 NFT collection for $HERO Crypto Veterans.
 *         1,500 unique military trading cards with on-chain utility:
 *         - 2% fee discount on HeroBase swap fees for holders
 *         - Spin wheel access gating (must hold to spin)
 *         - Tiered rewards: Bronze (1), Silver (3+), Gold (10+)
 *         - Provably fair randomized minting
 *         - ERC-2981 royalties (5%)
 *
 * @dev Security: ReentrancyGuard, Ownable2Step, Pausable, CEI pattern.
 *      Audited per GPT-4.1 Codex protocol.
 */

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract HeroCards is
    ERC721,
    ERC721Enumerable,
    ERC721Royalty,
    ERC721Pausable,
    Ownable2Step,
    ReentrancyGuard
{
    using Strings for uint256;

    // ═══════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════

    uint256 public constant MAX_SUPPLY = 1500;
    uint256 public constant MAX_PER_WALLET = 20;
    uint256 public constant RESERVED_FOR_TEAM = 50;
    uint96 public constant ROYALTY_BPS = 500; // 5%

    // ═══════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════

    // Mint pricing
    uint256 public mintPrice = 0.005 ether;
    uint256 public whitelistPrice = 0.003 ether;

    // Phases
    enum MintPhase { CLOSED, WHITELIST, PUBLIC }
    MintPhase public mintPhase = MintPhase.CLOSED;

    // Whitelist (Merkle tree)
    bytes32 public merkleRoot;

    // Metadata
    string private _baseTokenURI;
    string public contractURI; // OpenSea collection metadata

    // Provenance
    string public provenanceHash; // SHA-256 of concatenated image hashes
    uint256 public randomStartIndex; // Offset for randomized assignment
    bool public startIndexSet;

    // Randomization seed components
    uint256 private _randomSeedBlock;
    bool private _randomSeedRequested;

    // Tracking
    uint256 public totalMinted;
    uint256 public teamMinted;
    mapping(address => uint256) public mintedPerWallet;

    // Utility: Fee discount
    uint256 public feeDiscountBps = 200; // 2% = 200 basis points

    // ═══════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════

    event Minted(address indexed to, uint256 indexed tokenId, uint256 metadataId);
    event MintPhaseChanged(MintPhase newPhase);
    event BaseURIUpdated(string newBaseURI);
    event ProvenanceSet(string provenanceHash);
    event RandomStartIndexSet(uint256 startIndex);
    event MintPriceUpdated(uint256 newPrice);
    event WhitelistPriceUpdated(uint256 newPrice);
    event MerkleRootUpdated(bytes32 newRoot);
    event FeeDiscountUpdated(uint256 newDiscountBps);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event ContractURIUpdated(string newContractURI);
    event TeamMinted(address indexed to, uint256 quantity, uint256 startTokenId);

    // ═══════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════

    error MintClosed();
    error NotWhitelisted();
    error ExceedsMaxSupply();
    error ExceedsWalletLimit();
    error InsufficientPayment();
    error WithdrawFailed();
    error ProvenanceAlreadySet();
    error StartIndexAlreadySet();
    error RandomSeedNotReady();
    error ZeroAddress();
    error InvalidAmount();
    error ExceedsMaxDiscount();
    error RandomSeedExpired();

    // ═══════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════

    constructor(
        string memory baseURI_,
        string memory contractURI_,
        address royaltyReceiver
    ) ERC721("HERO Cards", "HEROCARD") Ownable(msg.sender) {
        if (royaltyReceiver == address(0)) revert ZeroAddress();
        _baseTokenURI = baseURI_;
        contractURI = contractURI_;
        _setDefaultRoyalty(royaltyReceiver, ROYALTY_BPS);
    }

    // ═══════════════════════════════════════════════════════════════
    // MINTING
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Public mint (requires PUBLIC phase)
     * @param quantity Number of tokens to mint (1-MAX_PER_WALLET)
     */
    function mint(uint256 quantity) external payable nonReentrant whenNotPaused {
        if (mintPhase != MintPhase.PUBLIC) revert MintClosed();
        if (quantity == 0) revert InvalidAmount();
        if (totalMinted + quantity > MAX_SUPPLY) revert ExceedsMaxSupply();
        if (mintedPerWallet[msg.sender] + quantity > MAX_PER_WALLET) revert ExceedsWalletLimit();
        if (msg.value < mintPrice * quantity) revert InsufficientPayment();

        _mintBatch(msg.sender, quantity);
    }

    /**
     * @notice Whitelist mint (requires WHITELIST phase + valid Merkle proof)
     * @param quantity Number of tokens to mint
     * @param proof Merkle proof for whitelist verification
     */
    function whitelistMint(
        uint256 quantity,
        bytes32[] calldata proof
    ) external payable nonReentrant whenNotPaused {
        if (mintPhase != MintPhase.WHITELIST) revert MintClosed();
        if (quantity == 0) revert InvalidAmount();
        if (totalMinted + quantity > MAX_SUPPLY) revert ExceedsMaxSupply();
        if (mintedPerWallet[msg.sender] + quantity > MAX_PER_WALLET) revert ExceedsWalletLimit();
        if (msg.value < whitelistPrice * quantity) revert InsufficientPayment();

        // Verify Merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        if (!MerkleProof.verify(proof, merkleRoot, leaf)) revert NotWhitelisted();

        _mintBatch(msg.sender, quantity);
    }

    /**
     * @notice Team/reserve mint (owner only, no payment)
     * @param to Recipient address
     * @param quantity Number of tokens
     */
    function teamMint(address to, uint256 quantity) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (quantity == 0) revert InvalidAmount();
        if (totalMinted + quantity > MAX_SUPPLY) revert ExceedsMaxSupply();
        if (teamMinted + quantity > RESERVED_FOR_TEAM) revert ExceedsWalletLimit();

        teamMinted += quantity;
        uint256 startId = totalMinted + 1;
        _mintBatch(to, quantity);
        emit TeamMinted(to, quantity, startId);
    }

    /**
     * @dev Internal batch mint with randomized token ID assignment.
     *      Token IDs are sequential (1-1500), but the metadata they point to
     *      is offset by randomStartIndex for provably fair distribution.
     *      Gas-optimized: state writes happen once before the loop.
     * @param to The recipient address
     * @param quantity Number of tokens to mint in this batch
     */
    function _mintBatch(address to, uint256 quantity) internal {
        // Cache and update state ONCE (gas optimization)
        uint256 startId = totalMinted + 1;
        totalMinted += quantity;
        mintedPerWallet[to] += quantity;

        // Cache randomization state for loop
        bool _isRandomized = startIndexSet;
        uint256 _offset = randomStartIndex;

        for (uint256 i = 0; i < quantity;) {
            uint256 tokenId = startId + i;
            uint256 metadataId = _isRandomized
                ? ((tokenId + _offset - 1) % MAX_SUPPLY) + 1
                : tokenId;
            _safeMint(to, tokenId);
            emit Minted(to, tokenId, metadataId);
            unchecked { ++i; }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // RANDOMIZATION (Provably Fair)
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Request randomization seed (call BEFORE reveal).
     *         Uses future block hash for unbiased randomness.
     * @dev Must be called by owner. The actual index is set in a
     *      separate tx after the target block is mined.
     */
    function requestRandomSeed() external onlyOwner {
        if (startIndexSet) revert StartIndexAlreadySet();
        _randomSeedBlock = block.number + 1;
        _randomSeedRequested = true;
    }

    /**
     * @notice Finalize the random start index using the committed block hash.
     * @dev Must be called within 256 blocks of requestRandomSeed().
     */
    function finalizeRandomStartIndex() external onlyOwner {
        if (startIndexSet) revert StartIndexAlreadySet();
        if (!_randomSeedRequested) revert RandomSeedNotReady();
        if (block.number <= _randomSeedBlock) revert RandomSeedNotReady();

        bytes32 blockHash = blockhash(_randomSeedBlock);
        if (blockHash == bytes32(0)) {
            // Block hash expired (>256 blocks) — must re-request for security
            _randomSeedRequested = false;
            revert RandomSeedExpired();
        }

        randomStartIndex = (uint256(blockHash) % MAX_SUPPLY) + 1;
        startIndexSet = true;

        emit RandomStartIndexSet(randomStartIndex);
    }

    /**
     * @notice Get the metadata ID for a given token ID.
     *         Applies the random offset for fair distribution.
     * @param tokenId The minted token ID (1-1500)
     * @return The metadata file number to fetch from IPFS
     */
    function getMetadataId(uint256 tokenId) external view returns (uint256) {
        return _getMetadataId(tokenId);
    }

    /**
     * @dev Calculate the metadata file ID for a given token ID.
     *      Before randomization: metadataId == tokenId (1:1 mapping).
     *      After randomization: metadataId = ((tokenId + offset - 1) % MAX_SUPPLY) + 1.
     * @param tokenId The minted token ID (1-based, max 1500)
     * @return The metadata file number to fetch from IPFS
     */
    function _getMetadataId(uint256 tokenId) internal view returns (uint256) {
        if (!startIndexSet) {
            return tokenId;
        }
        return ((tokenId + randomStartIndex - 1) % MAX_SUPPLY) + 1;
    }

    // ═══════════════════════════════════════════════════════════════
    // UTILITY: HOLDER VERIFICATION
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Check if an address holds any HERO Cards NFT.
     * @param account The wallet address to check
     * @return True if the account holds at least 1 NFT
     */
    function isHolder(address account) external view returns (bool) {
        return balanceOf(account) > 0;
    }

    /**
     * @notice Get the NFT tier for a holder (used by spin wheel).
     * @param account The wallet address
     * @return tier 0=None, 1=Bronze, 2=Silver, 3=Gold
     */
    function getHolderTier(address account) external view returns (uint8 tier) {
        uint256 balance = balanceOf(account);
        if (balance >= 10) return 3; // Gold
        if (balance >= 3) return 2;  // Silver
        if (balance >= 1) return 1;  // Bronze
        return 0; // Not a holder
    }

    /**
     * @notice Get the fee discount in basis points for a holder.
     *         Returns 0 if not a holder, feeDiscountBps (default 200 = 2%) if holder.
     * @param account The wallet address
     * @return discountBps The discount in basis points (0 or 200)
     */
    function getFeeDiscount(address account) external view returns (uint256 discountBps) {
        if (balanceOf(account) > 0) {
            return feeDiscountBps;
        }
        return 0;
    }

    /**
     * @notice Check if an account can access the spin wheel.
     *         Must hold at least 1 HERO Card NFT.
     * @param account The wallet address
     * @return canSpin True if holder, false otherwise
     */
    function canAccessSpinWheel(address account) external view returns (bool canSpin) {
        return balanceOf(account) > 0;
    }

    // ═══════════════════════════════════════════════════════════════
    // METADATA
    // ═══════════════════════════════════════════════════════════════

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        uint256 metadataId = _getMetadataId(tokenId);
        string memory base = _baseTokenURI;
        return bytes(base).length > 0
            ? string(abi.encodePacked(base, metadataId.toString()))
            : "";
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    // ═══════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /// @notice Set the current mint phase (CLOSED=0, WHITELIST=1, PUBLIC=2)
    /// @param phase The new mint phase to activate
    function setMintPhase(MintPhase phase) external onlyOwner {
        mintPhase = phase;
        emit MintPhaseChanged(phase);
    }

    /// @notice Update the base URI for token metadata (IPFS CID)
    /// @param newBaseURI The new base URI (e.g., "ipfs://Qm.../")
    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    /// @notice Update the contract-level metadata URI (OpenSea collection info)
    /// @param newContractURI The new contract metadata URI
    function setContractURI(string calldata newContractURI) external onlyOwner {
        contractURI = newContractURI;
        emit ContractURIUpdated(newContractURI);
    }

    /// @notice Update the public mint price
    /// @param newPrice New price in wei per token
    function setMintPrice(uint256 newPrice) external onlyOwner {
        mintPrice = newPrice;
        emit MintPriceUpdated(newPrice);
    }

    /// @notice Update the whitelist mint price
    /// @param newPrice New whitelist price in wei per token
    function setWhitelistPrice(uint256 newPrice) external onlyOwner {
        whitelistPrice = newPrice;
        emit WhitelistPriceUpdated(newPrice);
    }

    /// @notice Update the Merkle root for whitelist verification
    /// @param newRoot The new Merkle tree root hash
    function setMerkleRoot(bytes32 newRoot) external onlyOwner {
        merkleRoot = newRoot;
        emit MerkleRootUpdated(newRoot);
    }

    /// @notice Update the fee discount for NFT holders (in basis points)
    /// @param newDiscountBps New discount (100 = 1%, max 1000 = 10%)
    function setFeeDiscount(uint256 newDiscountBps) external onlyOwner {
        if (newDiscountBps > 1000) revert ExceedsMaxDiscount();
        feeDiscountBps = newDiscountBps;
        emit FeeDiscountUpdated(newDiscountBps);
    }

    /// @notice Set the provenance hash (immutable once set). SHA-256 of all artwork hashes.
    /// @param hash The provenance hash string
    function setProvenanceHash(string calldata hash) external onlyOwner {
        if (bytes(provenanceHash).length > 0) revert ProvenanceAlreadySet();
        provenanceHash = hash;
        emit ProvenanceSet(hash);
    }

    /// @notice Pause all minting operations (emergency use)
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resume minting operations after pause
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Withdraw all ETH from mint proceeds to the owner address
    /// @dev Uses CEI pattern with ReentrancyGuard for safety
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert InvalidAmount();
        (bool success, ) = payable(owner()).call{value: balance}("");
        if (!success) revert WithdrawFailed();
        emit FundsWithdrawn(owner(), balance);
    }

    // ═══════════════════════════════════════════════════════════════
    // OVERRIDES (Required by Solidity for diamond inheritance resolution)
    // ERC721 + ERC721Enumerable + ERC721Pausable all override _update.
    // ERC721 + ERC721Enumerable both override _increaseBalance.
    // ERC721 + ERC721Enumerable + ERC721Royalty all override supportsInterface.
    // ═══════════════════════════════════════════════════════════════

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721, ERC721Enumerable, ERC721Pausable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(
        address account,
        uint128 value
    ) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721Enumerable, ERC721Royalty) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
