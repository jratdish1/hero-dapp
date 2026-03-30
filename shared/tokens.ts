export interface TokenInfo {
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
  isNative?: boolean;
}

export const PULSECHAIN_ID = 369;
export const BASE_CHAIN_ID = 8453;

export const HERO_TOKEN: TokenInfo = {
  chainId: PULSECHAIN_ID,
  address: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
  symbol: "HERO",
  name: "HERO Token for Veterans",
  decimals: 18,
  logoURI: "https://raw.githubusercontent.com/libertyswap-finance/app-tokens/main/token-logo/0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27.png",
};

export const VETS_TOKEN: TokenInfo = {
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

export const USDC_TOKEN: TokenInfo = {
  chainId: PULSECHAIN_ID,
  address: "0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07",
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
  logoURI: "https://tokens.app.pulsex.com/images/tokens/0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07.png",
};

export const DAI_TOKEN: TokenInfo = {
  chainId: PULSECHAIN_ID,
  address: "0xefD766cCb38EaF1dfd701853BFCe31359239F305",
  symbol: "DAI",
  name: "Dai Stablecoin",
  decimals: 18,
  logoURI: "https://tokens.app.pulsex.com/images/tokens/0xefD766cCb38EaF1dfd701853BFCe31359239F305.png",
};

export const FEATURED_TOKENS: TokenInfo[] = [
  PLS_TOKEN,
  HERO_TOKEN,
  VETS_TOKEN,
  PLSX_TOKEN,
  HEX_TOKEN,
  USDC_TOKEN,
  DAI_TOKEN,
];

export const PULSECHAIN_CONFIG = {
  id: PULSECHAIN_ID,
  name: "PulseChain",
  nativeCurrency: { name: "Pulse", symbol: "PLS", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.pulsechain.com"] },
    public: { http: ["https://rpc.pulsechain.com"] },
  },
  blockExplorers: {
    default: { name: "PulseScan", url: "https://scan.pulsechain.com" },
  },
};

export const DEX_SOURCES = [
  { id: "pulsex_v1", name: "PulseX V1", router: "0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02" },
  { id: "pulsex_v2", name: "PulseX V2", router: "0x165C3410fC91EF562C50559f7d2289fEbed552d9" },
  { id: "9inch", name: "9inch", router: "0x0000000000000000000000000000000000000000" },
  { id: "liberty", name: "Liberty Swap", router: "0x0000000000000000000000000000000000000000" },
] as const;

export type DexSourceId = typeof DEX_SOURCES[number]["id"];
