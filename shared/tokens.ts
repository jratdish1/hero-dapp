export interface TokenInfo {
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
  isNative?: boolean;
}

export interface ChainConfig {
  id: number;
  name: string;
  shortName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: { default: { http: string[] }; public: { http: string[] } };
  blockExplorers: { default: { name: string; url: string } };
  color: string;
  icon: string;
}

export interface DexSource {
  id: string;
  name: string;
  router: string;
  chainId: number;
}

// ─── Chain IDs ───────────────────────────────────────────────────────────
export const PULSECHAIN_ID = 369;
export const BASE_CHAIN_ID = 8453;

export type SupportedChainId = typeof PULSECHAIN_ID | typeof BASE_CHAIN_ID;

// ─── Chain Configs ───────────────────────────────────────────────────────
export const PULSECHAIN_CONFIG: ChainConfig = {
  id: PULSECHAIN_ID,
  name: "PulseChain",
  shortName: "PLS",
  nativeCurrency: { name: "Pulse", symbol: "PLS", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.pulsechain.com"] },
    public: { http: ["https://rpc.pulsechain.com"] },
  },
  blockExplorers: {
    default: { name: "PulseScan", url: "https://scan.pulsechain.com" },
  },
  color: "#00FF88",
  icon: "⚡",
};

export const BASE_CONFIG: ChainConfig = {
  id: BASE_CHAIN_ID,
  name: "Base",
  shortName: "BASE",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://mainnet.base.org"] },
    public: { http: ["https://mainnet.base.org"] },
  },
  blockExplorers: {
    default: { name: "BaseScan", url: "https://basescan.org" },
  },
  color: "#0052FF",
  icon: "🔵",
};

export const SUPPORTED_CHAINS: ChainConfig[] = [PULSECHAIN_CONFIG, BASE_CONFIG];

export const CHAIN_MAP: Record<SupportedChainId, ChainConfig> = {
  [PULSECHAIN_ID]: PULSECHAIN_CONFIG,
  [BASE_CHAIN_ID]: BASE_CONFIG,
};

// ─── PulseChain Tokens ──────────────────────────────────────────────────
export const HERO_TOKEN_PLS: TokenInfo = {
  chainId: PULSECHAIN_ID,
  address: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
  symbol: "HERO",
  name: "HERO Token for Veterans",
  decimals: 18,
  logoURI: "https://raw.githubusercontent.com/libertyswap-finance/app-tokens/main/token-logo/0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27.png",
};

export const VETS_TOKEN_PLS: TokenInfo = {
  chainId: PULSECHAIN_ID,
  address: "0x4013abBf94A745EfA7cc848989Ee83424A770060",
  symbol: "VETS",
  name: "VETERANS",
  decimals: 18,
  logoURI: "https://raw.githubusercontent.com/libertyswap-finance/app-tokens/main/token-logo/0x4013abBf94A745EfA7cc848989Ee83424A770060.png",
};

export const PLS_TOKEN: TokenInfo = {
  chainId: PULSECHAIN_ID,
  address: "0x0000000000000000000000000000000000000000",
  symbol: "PLS",
  name: "Pulse",
  decimals: 18,
  logoURI: "https://tokens.app.pulsex.com/images/tokens/0xA1077a294dDE1B09bB078844df40758a5D0f9a27.png",
  isNative: true,
};

export const WPLS_TOKEN: TokenInfo = {
  chainId: PULSECHAIN_ID,
  address: "0xA1077a294dDE1B09bB078844df40758a5D0f9a27",
  symbol: "WPLS",
  name: "Wrapped Pulse",
  decimals: 18,
  logoURI: "https://tokens.app.pulsex.com/images/tokens/0xA1077a294dDE1B09bB078844df40758a5D0f9a27.png",
};

export const PLSX_TOKEN: TokenInfo = {
  chainId: PULSECHAIN_ID,
  address: "0x95B303987A60C71504D99Aa1b13B4DA07b0790ab",
  symbol: "PLSX",
  name: "PulseX",
  decimals: 18,
  logoURI: "https://tokens.app.pulsex.com/images/tokens/0x95B303987A60C71504D99Aa1b13B4DA07b0790ab.png",
};

export const HEX_TOKEN: TokenInfo = {
  chainId: PULSECHAIN_ID,
  address: "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39",
  symbol: "HEX",
  name: "HEX",
  decimals: 8,
  logoURI: "https://tokens.app.pulsex.com/images/tokens/0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39.png",
};

export const USDC_TOKEN_PLS: TokenInfo = {
  chainId: PULSECHAIN_ID,
  address: "0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07",
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
  logoURI: "https://tokens.app.pulsex.com/images/tokens/0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07.png",
};

export const DAI_TOKEN_PLS: TokenInfo = {
  chainId: PULSECHAIN_ID,
  address: "0xefD766cCb38EaF1dfd701853BFCe31359239F305",
  symbol: "DAI",
  name: "Dai Stablecoin",
  decimals: 18,
  logoURI: "https://tokens.app.pulsex.com/images/tokens/0xefD766cCb38EaF1dfd701853BFCe31359239F305.png",
};

// ─── BASE Chain Tokens ──────────────────────────────────────────────────
export const HERO_TOKEN_BASE: TokenInfo = {
  chainId: BASE_CHAIN_ID,
  address: "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8",
  symbol: "HERO",
  name: "HERO Token for Veterans",
  decimals: 18,
  logoURI: "https://raw.githubusercontent.com/libertyswap-finance/app-tokens/main/token-logo/0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27.png",
};

export const ETH_TOKEN_BASE: TokenInfo = {
  chainId: BASE_CHAIN_ID,
  address: "0x0000000000000000000000000000000000000000",
  symbol: "ETH",
  name: "Ether",
  decimals: 18,
  logoURI: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  isNative: true,
};

export const WETH_TOKEN_BASE: TokenInfo = {
  chainId: BASE_CHAIN_ID,
  address: "0x4200000000000000000000000000000000000006",
  symbol: "WETH",
  name: "Wrapped Ether",
  decimals: 18,
  logoURI: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
};

export const USDC_TOKEN_BASE: TokenInfo = {
  chainId: BASE_CHAIN_ID,
  address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
  logoURI: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
};

export const DAI_TOKEN_BASE: TokenInfo = {
  chainId: BASE_CHAIN_ID,
  address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
  symbol: "DAI",
  name: "Dai Stablecoin",
  decimals: 18,
  logoURI: "https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png",
};

// ─── Token Lists by Chain ───────────────────────────────────────────────
export const PULSECHAIN_TOKENS: TokenInfo[] = [
  PLS_TOKEN,
  HERO_TOKEN_PLS,
  VETS_TOKEN_PLS,
  PLSX_TOKEN,
  HEX_TOKEN,
  USDC_TOKEN_PLS,
  DAI_TOKEN_PLS,
  WPLS_TOKEN,
];

export const BASE_TOKENS: TokenInfo[] = [
  ETH_TOKEN_BASE,
  HERO_TOKEN_BASE,
  USDC_TOKEN_BASE,
  DAI_TOKEN_BASE,
  WETH_TOKEN_BASE,
];

export const TOKEN_MAP: Record<SupportedChainId, TokenInfo[]> = {
  [PULSECHAIN_ID]: PULSECHAIN_TOKENS,
  [BASE_CHAIN_ID]: BASE_TOKENS,
};

// ─── Backward-compat aliases ────────────────────────────────────────────
export const HERO_TOKEN = HERO_TOKEN_PLS;
export const VETS_TOKEN = VETS_TOKEN_PLS;
export const FEATURED_TOKENS = PULSECHAIN_TOKENS;

// ─── DEX Sources by Chain ───────────────────────────────────────────────
export const PULSECHAIN_DEX_SOURCES: DexSource[] = [
  { id: "pulsex_v1", name: "PulseX V1", router: "0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02", chainId: PULSECHAIN_ID },
  { id: "pulsex_v2", name: "PulseX V2", router: "0x165C3410fC91EF562C50559f7d2289fEbed552d9", chainId: PULSECHAIN_ID },
  { id: "9inch", name: "9inch", router: "0x0000000000000000000000000000000000000000", chainId: PULSECHAIN_ID },
  { id: "liberty", name: "Liberty Swap", router: "0x0000000000000000000000000000000000000000", chainId: PULSECHAIN_ID },
];

export const BASE_DEX_SOURCES: DexSource[] = [
  { id: "uniswap_v3", name: "Uniswap V3", router: "0x2626664c2603336E57B271c5C0b26F421741e481", chainId: BASE_CHAIN_ID },
  { id: "aerodrome", name: "Aerodrome", router: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43", chainId: BASE_CHAIN_ID },
  { id: "baseswap", name: "BaseSwap", router: "0x327Df1E6de05895d2ab08513aaDD9313Fe505d86", chainId: BASE_CHAIN_ID },
];

export const DEX_MAP: Record<SupportedChainId, DexSource[]> = {
  [PULSECHAIN_ID]: PULSECHAIN_DEX_SOURCES,
  [BASE_CHAIN_ID]: BASE_DEX_SOURCES,
};

export const DEX_SOURCES = PULSECHAIN_DEX_SOURCES;

// ─── Helper: get tokens for a chain ─────────────────────────────────────
export function getTokensForChain(chainId: SupportedChainId): TokenInfo[] {
  return TOKEN_MAP[chainId] ?? [];
}

export function getDexSourcesForChain(chainId: SupportedChainId): DexSource[] {
  return DEX_MAP[chainId] ?? [];
}

export function getChainConfig(chainId: SupportedChainId): ChainConfig {
  return CHAIN_MAP[chainId];
}

export function getHeroToken(chainId: SupportedChainId): TokenInfo {
  return chainId === BASE_CHAIN_ID ? HERO_TOKEN_BASE : HERO_TOKEN_PLS;
}
