/**
 * HeroCards ERC-721 Contract ABI (Base Chain)
 * Contract: HERO Cards — 1,500 Military Trading Cards
 * Chain: Base (8453)
 * 
 * NOTE: Contract address will be set after deployment.
 * Update HERO_CARDS_ADDRESS after deploying to Base mainnet.
 */

// Contract address — UPDATE AFTER DEPLOYMENT
export const HERO_CARDS_ADDRESS = "0x5Fad096af059ff9A2167351A0ffc8b45D71897bE" as const;
// PulseChain contract address (chain 369)
export const HERO_CARDS_ADDRESS_PULSE = "0xCe609B3A82E89FCd4B5e5a29159b051CE86f7B36" as const;
export const HERO_CARDS_CHAIN_ID_PULSE = 369;

// Base chain ID
export const HERO_CARDS_CHAIN_ID = 8453;

// IPFS metadata base URI
export const HERO_CARDS_BASE_URI = "ipfs://QmXTty8QaqP6ToahspVS3oRztpjiTkrAiAmv5ixjbPynDE/";

// Mint prices (in ETH)
export const HERO_CARDS_MINT_PRICE = "0.005";
export const HERO_CARDS_WL_PRICE = "0.003";
export const HERO_CARDS_MAX_PER_WALLET = 20;
export const HERO_CARDS_MAX_SUPPLY = 1500;

export const HERO_CARDS_ABI = [
  // ─── Read Functions ───────────────────────────────────────────────
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalMinted",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "MAX_SUPPLY",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "MAX_PER_WALLET",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "mintPrice",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "whitelistPrice",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "mintPhase",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "mintedPerWallet",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenURI",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isHolder",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getHolderTier",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "tier", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getFeeDiscount",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "discountBps", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "canAccessSpinWheel",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "canSpin", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMetadataId",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "feeDiscountBps",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "provenanceHash",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "randomStartIndex",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "startIndexSet",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenOfOwnerByIndex",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  // ─── Write Functions ──────────────────────────────────────────────
  {
    type: "function",
    name: "mint",
    inputs: [{ name: "quantity", type: "uint256" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "whitelistMint",
    inputs: [
      { name: "quantity", type: "uint256" },
      { name: "proof", type: "bytes32[]" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  // ─── Events ───────────────────────────────────────────────────────
  {
    type: "event",
    name: "Minted",
    inputs: [
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "metadataId", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MintPhaseChanged",
    inputs: [
      { name: "newPhase", type: "uint8", indexed: false },
    ],
  },
  // ─── Errors ───────────────────────────────────────────────────────
  { type: "error", name: "MintClosed", inputs: [] },
  { type: "error", name: "NotWhitelisted", inputs: [] },
  { type: "error", name: "ExceedsMaxSupply", inputs: [] },
  { type: "error", name: "ExceedsWalletLimit", inputs: [] },
  { type: "error", name: "InsufficientPayment", inputs: [] },
  { type: "error", name: "InvalidAmount", inputs: [] },
] as const;
