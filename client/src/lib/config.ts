/**
 * HeroBase.io - Shared Chain & Contract Configuration
 * Single source of truth for all chain IDs, contract addresses, and chain metadata.
 * Centralizing here eliminates duplication and prevents inconsistencies.
 */

export const SUPPORTED_CHAIN_IDS = [8453, 369] as const;
export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

/** Check if a chain ID is supported */
export function isSupportedChainId(chainId: number | undefined): chainId is SupportedChainId {
  return chainId !== undefined && (SUPPORTED_CHAIN_IDS as readonly number[]).includes(chainId);
}

export interface ChainConfig {
  id: SupportedChainId;
  name: string;
  nativeSymbol: string;
  nativeName: string;
  heroCA: `0x${string}`;
  stakingCA: `0x${string}`;
  explorer: string;
  explorerName: string;
  color: string;
  rpcs: string[];
  tokens: Array<{ symbol: string; ca: `0x${string}`; decimals: number }>;
}

export const CHAINS: Record<SupportedChainId, ChainConfig> = {
  8453: {
    id: 8453,
    name: "base",
    nativeSymbol: "ETH",
    nativeName: "Ethereum",
    heroCA: "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8",
    stakingCA: "0x7E9B838E8dC0f2B3a69Bb435C8B0f29FbC6aFe01",
    explorer: "https://basescan.org",
    explorerName: "BaseScan",
    color: "#0052FF",
    rpcs: ["https://mainnet.base.org", "https://base.publicnode.com"],
    tokens: [
      { symbol: "ETH", ca: "0x0000000000000000000000000000000000000000", decimals: 18 },
      { symbol: "WETH", ca: "0x4200000000000000000000000000000000000006", decimals: 18 },
      { symbol: "USDC", ca: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
      { symbol: "DAI", ca: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", decimals: 18 },
      { symbol: "HERO", ca: "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8", decimals: 18 },
    ],
  },
  369: {
    id: 369,
    name: "pulsechain",
    nativeSymbol: "PLS",
    nativeName: "PulseChain",
    heroCA: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
    stakingCA: "0xf2D960C2b9AAb3F2B4E2d81E3a54e48E4b36F68C",
    explorer: "https://scan.pulsechain.com",
    explorerName: "PulseScan",
    color: "#00FF88",
    rpcs: ["https://rpc-pulsechain.g4mm4.io", "https://rpc.pulsechain.com", "https://pulsechain-rpc.publicnode.com"],
    tokens: [
      { symbol: "PLS", ca: "0x0000000000000000000000000000000000000000", decimals: 18 },
      { symbol: "WPLS", ca: "0xA1077D0820F8F1bA5C7C8c9C0D5C2b8F8e8D4D4D", decimals: 18 },
      { symbol: "USDC", ca: "0x2b2eEeAc7ABe22E1c26B0cC77d1E1B4C5a4c6c0E", decimals: 6 },
      { symbol: "DAI", ca: "0x6B5a1D4a2b1C8A9E7F4d2B3c5D4E1F2A3C4B5D6E", decimals: 18 },
      { symbol: "HERO", ca: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27", decimals: 18 },
    ],
  },
};

/** Get chain config by chain ID (returns undefined if unsupported) */
export function getChainConfig(chainId: number | undefined): ChainConfig | undefined {
  if (!isSupportedChainId(chainId)) return undefined;
  return CHAINS[chainId];
}

/** Get staking contract address for chain */
export function getStakingAddress(chainId: number | undefined): `0x${string}` | undefined {
  const config = getChainConfig(chainId);
  return config?.stakingCA;
}

/** Get HERO token address for chain */
export function getHeroAddress(chainId: number | undefined): `0x${string}` | undefined {
  const config = getChainConfig(chainId);
  return config?.heroCA;
}

/** Get explorer URL for chain */
export function getExplorer(chainId: number | undefined): string | undefined {
  const config = getChainConfig(chainId);
  return config?.explorer;
}

/** Get chain name */
export function getChainName(chainId: number | undefined): string | undefined {
  const config = getChainConfig(chainId);
  return config?.name;
}