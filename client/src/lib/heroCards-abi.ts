/**
 * HeroCards ERC-721 Contract ABI
 * Contract: HERO Cards — 1,500 max supply Military Trading Cards
 * Deployed on Base (8453) and PulseChain (369).
 *
 * Chain config and addresses are centralized in heroCards-config.ts.
 * Import from there instead of duplicating addresses here.
 */
export {
  HERO_CARDS_ADDRESS_BASE as HERO_CARDS_ADDRESS,
  HERO_CARDS_ADDRESS_PULSECHAIN as HERO_CARDS_ADDRESS_PULSE,
  CHAIN_ID_BASE as HERO_CARDS_CHAIN_ID,
  CHAIN_ID_PULSECHAIN as HERO_CARDS_CHAIN_ID_PULSE,
  HERO_CARDS_METADATA_BASE_URI as HERO_CARDS_BASE_URI,
  HERO_CARDS_MINT_PRICE_ETH as HERO_CARDS_MINT_PRICE,
  HERO_CARDS_WHITELIST_PRICE_ETH as HERO_CARDS_WL_PRICE,
  HERO_CARDS_MAX_PER_WALLET,
  HERO_CARDS_MAX_SUPPLY,
} from "./heroCards-config";

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
