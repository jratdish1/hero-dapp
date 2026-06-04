/**
 * HeroBase.io - Chain and Contract Configuration
 * Single source of truth for all chain IDs, contract addresses, and chain metadata.
 * Centralizing here eliminates duplication and prevents inconsistencies.
 * 
 * Verified from existing repo sources - DO NOT modify addresses unless verified.
 */

export const SUPPORTED_CHAIN_IDS = [8453, 369] as const;
export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

export interface TokenConfig {
  symbol: string;
  ca: `0x${string}`;
  decimals: number;
  isNative?: boolean;
  name?: string;
}

export interface ChainConfig {
  id: SupportedChainId;
  name: string;
  displayName: string;
  nativeSymbol: string;
  nativeName: string;
  heroCA: `0x${string}`;
  stakingCA: `0x${string}`;
  explorer: string;
  explorerName: string;
  color: string;
  rpcs: string[];
  tokens: TokenConfig[];
}

export const CHAINS: Record<SupportedChainId, ChainConfig> = {
  8453: {
    id: 8453,
    name: "base",
    displayName: "Base",
    nativeSymbol: "ETH",
    nativeName: "Ethereum",
    heroCA: "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8",
    stakingCA: "0x54063f7dbc9e70061d6E4ac052B5bf41bF3303ba",
    explorer: "https://basescan.org",
    explorerName: "BaseScan",
    color: "#0052FF",
    rpcs: ["https://mainnet.base.org", "https://base.publicnode.com", "https://1rpc.io/base"],
    tokens: [
      { symbol: "ETH", ca: "0x0000000000000000000000000000000000000000", decimals: 18, isNative: true, name: "Ether" },
      { symbol: "WETH", ca: "0x4200000000000000000000000000000000000006", decimals: 18, name: "Wrapped Ether" },
      { symbol: "USDC", ca: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6, name: "USD Coin" },
      { symbol: "HERO", ca: "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8", decimals: 18, name: "HERO Token" },
    ],
  },
  369: {
    id: 369,
    name: "pulsechain",
    displayName: "PulseChain",
    nativeSymbol: "PLS",
    nativeName: "PulseChain",
    heroCA: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
    stakingCA: "0x10315dC9a381AF756aA9ca7c46d55ee4f679a0B4",
    explorer: "https://scan.pulsechain.com",
    explorerName: "PulseScan",
    color: "#00FF88",
    rpcs: ["https://rpc-pulsechain.g4mm4.io", "https://rpc.pulsechain.com", "https://pulsechain-rpc.publicnode.com"],
    tokens: [
      { symbol: "PLS", ca: "0x0000000000000000000000000000000000000000", decimals: 18, isNative: true, name: "Pulse" },
      { symbol: "VETS", ca: "0x4013abBf94A745EfA7cc848989Ee83424A770060", decimals: 18, name: "VETERANS" },
      { symbol: "HERO", ca: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27", decimals: 18, name: "HERO Token" },
    ],
  },
};

// ─── Helper Functions ───────────────────────────────────────────────────

export function isSupportedChainId(chainId: number | undefined): chainId is SupportedChainId {
  return chainId !== undefined && (SUPPORTED_CHAIN_IDS as readonly number[]).includes(chainId);
}

export function getChainConfig(chainId: number | undefined): ChainConfig | undefined {
  if (!isSupportedChainId(chainId)) return undefined;
  return CHAINS[chainId];
}

export function getHeroAddress(chainId: number | undefined): `0x${string}` | undefined {
  return getChainConfig(chainId)?.heroCA;
}

export function getStakingAddress(chainId: number | undefined): `0x${string}` | undefined {
  return getChainConfig(chainId)?.stakingCA;
}

export function getExplorer(chainId: number | undefined): string | undefined {
  return getChainConfig(chainId)?.explorer;
}

export function getChainName(chainId: number | undefined): string | undefined {
  return getChainConfig(chainId)?.name;
}

export function getChainDisplayName(chainId: number | undefined): string | undefined {
  return getChainConfig(chainId)?.displayName;
}

export function getNativeSymbol(chainId: number | undefined): string | undefined {
  return getChainConfig(chainId)?.nativeSymbol;
}

export function getRPCs(chainId: number | undefined): string[] {
  return getChainConfig(chainId)?.rpcs ?? [];
}

export function getTokens(chainId: number | undefined): TokenConfig[] {
  return getChainConfig(chainId)?.tokens ?? [];
}

export function getTokenBySymbol(chainId: number | undefined, symbol: string): TokenConfig | undefined {
  const tokens = getTokens(chainId);
  return tokens.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
}

export function getTokenAddress(chainId: number | undefined, symbol: string): `0x${string}` | undefined {
  return getTokenBySymbol(chainId, symbol)?.ca;
}

// ─── Address Exports for Backward Compatibility ─────────────────────────

export const HERO_ADDRESSES = {
  8453: CHAINS[8453].heroCA,
  369: CHAINS[369].heroCA,
} as const;

export const STAKING_ADDRESSES = {
  8453: CHAINS[8453].stakingCA,
  369: CHAINS[369].stakingCA,
} as const;

export const CHAIN_IDS = SUPPORTED_CHAIN_IDS;
export type ChainId = SupportedChainId;