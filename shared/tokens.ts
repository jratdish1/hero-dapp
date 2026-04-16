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
    default: { http: ["https://rpc-pulsechain.g4mm4.io"] },
    public: { http: ["https://rpc-pulsechain.g4mm4.io"] },
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

// ─── PulseChain Ecosystem Tokens ────────────────────────────────────────
export const EMIT_TOKEN_PLS: TokenInfo = {
  chainId: PULSECHAIN_ID,
  address: "0x32fB5663619A657839A80133994E45c5e5cDf427",
  symbol: "EMIT",
  name: "Emit Token",
  decimals: 18,
  logoURI: "https://emit.farm/favicon.ico",
};

export const RHINO_TOKEN_PLS: TokenInfo = {
  chainId: PULSECHAIN_ID,
  address: "0x6C6D7De6C5f366a1995ed5f1e273C5B3760C6043",
  symbol: "RHINO",
  name: "Rhino Token",
  decimals: 18,
  logoURI: "https://ui-avatars.com/api/?name=RHINO&background=4B5320&color=fff&size=64",
};

export const TRUFARM_TOKEN_PLS: TokenInfo = {
  chainId: PULSECHAIN_ID,
  address: "0xCA942990EF21446Db490532E66992eD1EF76A82b",
  symbol: "TruFarm",
  name: "TruFarm",
  decimals: 18,
  logoURI: "https://ui-avatars.com/api/?name=TF&background=f97316&color=fff&size=64&bold=true",
};

// ─── BASE Ecosystem Tokens ──────────────────────────────────────────────
export const JESSE_TOKEN_BASE: TokenInfo = {
  chainId: BASE_CHAIN_ID,
  address: "0xBE8ae24C5E4D19759f640Fb89617047213be3194",
  symbol: "jesse",
  name: "jesse",
  decimals: 18,
  logoURI: "https://ui-avatars.com/api/?name=jesse&background=0052FF&color=fff&size=64",
};

export const AERO_TOKEN_BASE: TokenInfo = {
  chainId: BASE_CHAIN_ID,
  address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
  symbol: "AERO",
  name: "Aerodrome Finance",
  decimals: 18,
  logoURI: "https://assets.coingecko.com/coins/images/31745/small/token.png",
};

export const BRETT_TOKEN_BASE: TokenInfo = {
  chainId: BASE_CHAIN_ID,
  address: "0x532f27101965dd16442E59d40670FaF5eBB142E4",
  symbol: "BRETT",
  name: "Brett",
  decimals: 18,
  logoURI: "https://assets.coingecko.com/coins/images/35529/small/1000050750.png",
};

// ─── Token Lists by Chain ───────────────────────────────────────────────
export const PULSECHAIN_TOKENS: TokenInfo[] = [
  PLS_TOKEN,
  HERO_TOKEN_PLS,
  VETS_TOKEN_PLS,
  EMIT_TOKEN_PLS,
  RHINO_TOKEN_PLS,
  TRUFARM_TOKEN_PLS,
  PLSX_TOKEN,
  HEX_TOKEN,
  USDC_TOKEN_PLS,
  DAI_TOKEN_PLS,
  WPLS_TOKEN,
];

export const BASE_TOKENS: TokenInfo[] = [
  ETH_TOKEN_BASE,
  HERO_TOKEN_BASE,
  WETH_TOKEN_BASE,
  JESSE_TOKEN_BASE,
  AERO_TOKEN_BASE,
  BRETT_TOKEN_BASE,
  USDC_TOKEN_BASE,
  DAI_TOKEN_BASE,
];

export const TOKEN_MAP: Record<SupportedChainId, TokenInfo[]> = {
  [PULSECHAIN_ID]: PULSECHAIN_TOKENS,
  [BASE_CHAIN_ID]: BASE_TOKENS,
};

// ─── Farm Smart Contracts - PulseChain ──────────────────────────────────
export const FARM_CONTRACTS_PLS = {
  masterChefV2: "0xc9798c7447B209e79F12542691d4cdA64b98bD96",
  buyAndBurn: "0x9016a0DAA30bD29A51a1a2905352877947f904E9",
  zapper: "0x5a67C1dbb3F27C8C0D2B62F12C3Ed1704D14200c",
  pulseXRouter: "0x165C3410fC91EF562C50559f7d2289fEbed552d9",
  heroTruFarmLP: "0x1F7FA931F4D1789c44f4a7Adc4564DE45ed96DF5",
  heroPLSLP: "0x34948e125033a697332202964de96af85becd78f",
  vetsWPLSLP: "0xe2EC4E2033054b778a2a56B7B3EB70f89944F5e6",
  truFarmToken: "0xCA942990EF21446Db490532E66992eD1EF76A82b",
} as const;

export const FARM_POOLS_PLS = [
  {
    id: 9,
    name: "HERO/TruFarm",
    lpToken: FARM_CONTRACTS_PLS.heroTruFarmLP,
    token0: { symbol: "HERO", address: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27" },
    token1: { symbol: "TruFarm", address: FARM_CONTRACTS_PLS.truFarmToken },
    active: true,
  },
  {
    id: 67,
    name: "HERO/PLS",
    lpToken: FARM_CONTRACTS_PLS.heroPLSLP,
    token0: { symbol: "HERO", address: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27" },
    token1: { symbol: "PLS", address: "0xA1077a294dDE1B09bB078844df40758a5D0f9a27" },
    active: true,
  },
  {
    id: 1,
    name: "VETS/WPLS",
    lpToken: FARM_CONTRACTS_PLS.vetsWPLSLP,
    token0: { symbol: "VETS", address: "0x4013abBf94A745EfA7cc848989Ee83424a770060" },
    token1: { symbol: "WPLS", address: "0xA1077a294dDE1B09bB078844df40758a5D0f9a27" },
    active: true,
  },
] as const;

// ─── Farm Smart Contracts - Base ────────────────────────────────────────
export const FARM_CONTRACTS_BASE = {
  buyAndBurn: "0x67bEF0A8Be3ef576bF4ab2D904FCbe82E9846670",
  heroEthPair: "0x3bb159de8604ab7e0148edc24f2a568c430476cf",
  heroEthAerodrome: "0xb813599dd596C179C8888C8A4Bd3FEC8308D1E20",
  heroUsdcAerodrome: "0xa3F80BFea263c22f921a2C5d7A28b74338957098",
  heroBrettAerodrome: "0x26Eb84fbE7EA1a9E65C3473DEe73D0E96dd033F6",
  uniswapV3Router: "0x2626664c2603336E57B271c5C0b26F421741e481",
  aerodromeRouter: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
} as const;
// ─── Farm Pools - Base (Live on Uniswap V3 & Aerodrome) ────────────────
export const FARM_POOLS_BASE = [
  {
    id: 1,
    name: "HERO/WETH",
    lpToken: "0xb813599dd596C179C8888C8A4Bd3FEC8308D1E20",
    token0: { symbol: "HERO", address: "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8" },
    token1: { symbol: "WETH", address: "0x4200000000000000000000000000000000000006" },
    active: true,
    dex: "Aerodrome",
    pairAddress: "0xb813599dd596C179C8888C8A4Bd3FEC8308D1E20",
  },
  {
    id: 2,
    name: "HERO/WETH",
    lpToken: "0x3Bb159de8604ab7E0148EDC24F2A568c430476CF",
    token0: { symbol: "HERO", address: "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8" },
    token1: { symbol: "WETH", address: "0x4200000000000000000000000000000000000006" },
    active: true,
    dex: "Uniswap V3",
    pairAddress: "0x3Bb159de8604ab7E0148EDC24F2A568c430476CF",
  },
  {
    id: 3,
    name: "HERO/USDC",
    lpToken: "0xa3F80BFea263c22f921a2C5d7A28b74338957098",
    token0: { symbol: "HERO", address: "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8" },
    token1: { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
    active: true,
    dex: "Aerodrome",
    pairAddress: "0xa3F80BFea263c22f921a2C5d7A28b74338957098",
  },
  {
    id: 4,
    name: "HERO/BRETT",
    lpToken: "0x26Eb84fbE7EA1a9E65C3473DEe73D0E96dd033F6",
    token0: { symbol: "HERO", address: "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8" },
    token1: { symbol: "BRETT", address: "0x532f27101965dd16442E59d40670FaF5eBB142E4" },
    active: true,
    dex: "Aerodrome",
    pairAddress: "0x26Eb84fbE7EA1a9E65C3473DEe73D0E96dd033F6",
  },
  {
    id: 5,
    name: "ZORA/HERO",
    lpToken: "0x40529F54CfF8bad0AA6d19EC8983d16e9E27B1b7",
    token0: { symbol: "ZORA", address: "0x1111111111166b7FE7bd91427724B487980aFc69" },
    token1: { symbol: "HERO", address: "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8" },
    active: true,
    dex: "Aerodrome",
    pairAddress: "0x40529F54CfF8bad0AA6d19EC8983d16e9E27B1b7",
  },
  {
    id: 6,
    name: "jesse/HERO",
    lpToken: "0xbAd80210fa3119324243279CB0212b1CE3218569",
    token0: { symbol: "jesse", address: "0x50F88fe97f72CD3E75b9Eb4f747F59BcEBA80d59" },
    token1: { symbol: "HERO", address: "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8" },
    active: true,
    dex: "Aerodrome",
    pairAddress: "0xbAd80210fa3119324243279CB0212b1CE3218569",
  },
] as const;


// ─── CDN Assets ─────────────────────────────────────────────────────────
export const CDN_ASSETS = {
  heroLogo: "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/hero-logo-official_808c9ab8.png",
  blackbeard: "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/BlackBeard_94de3f9d.jfif",
  kycBadge: "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/KYC-certificate-badge_4bce12b5.png",
  auditBadge: "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/audited-by-spywolf_8a337ccc.png",
  heroSunset: "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/herouniversalgoodstonesunset_905fb0ba.webp",
  heroTruDefi: "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/HeroTruDefi_4b9604ff.jpg",
  vicInfoChart: "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/Vetsincryptoinfochartforvets,hero_c1479748.jpg",
  heroBanner: "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/445vqAqzbQinaz2K7dFjjJ/hero-banner-QpyKdvivL5TcgqnXxrRZh5.webp",
  heroEmblem: "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/445vqAqzbQinaz2K7dFjjJ/hero-emblem-aHVuQc59ySp2SrqEGw29rZ.webp",
} as const;

// ─── Live DApp URLs ─────────────────────────────────────────────────────
export const LIVE_DAPP_URLS = {
  farm: "https://herofarm-445vqaqz.manus.space",
  dao: "https://herodapp-parejpux.manus.space",
} as const;

// ─── Service Branch Ribbons ─────────────────────────────────────────────
export const SERVICE_BRANCHES = [
  { name: "Army", color: "#4B5320", emoji: "🪖" },
  { name: "Navy", color: "#000080", emoji: "⚓" },
  { name: "Marines", color: "#CC0000", emoji: "🦅" },
  { name: "Air Force", color: "#00308F", emoji: "✈️" },
  { name: "Coast Guard", color: "#FF8C00", emoji: "🚢" },
  { name: "Space Force", color: "#0B3D91", emoji: "🚀" },
  { name: "Firefighters", color: "#FF4500", emoji: "🔥" },
  { name: "Police", color: "#003366", emoji: "🛡️" },
  { name: "EMTs", color: "#FF6600", emoji: "🚑" },
] as const;

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
