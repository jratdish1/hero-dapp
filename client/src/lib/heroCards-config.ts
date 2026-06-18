/**
 * HeroCards Centralized Chain Configuration
 *
 * Single source of truth for Base and PulseChain HeroCards contract config.
 * Import from here instead of duplicating addresses or chain IDs across files.
 *
 * Deployed contracts (DO NOT REDEPLOY — read-only reference):
 *   Base Mainnet:      0x5Fad096af059ff9A2167351A0ffc8b45D71897bE
 *   PulseChain Mainnet: 0xCe609B3A82E89FCd4B5e5a29159b051CE86f7B36
 */

// ─── Chain IDs ────────────────────────────────────────────────────────────────
export const CHAIN_ID_BASE = 8453 as const;
export const CHAIN_ID_PULSECHAIN = 369 as const;

// ─── Contract Addresses ───────────────────────────────────────────────────────
export const HERO_CARDS_ADDRESS_BASE = "0x5Fad096af059ff9A2167351A0ffc8b45D71897bE" as const;
export const HERO_CARDS_ADDRESS_PULSECHAIN = "0xCe609B3A82E89FCd4B5e5a29159b051CE86f7B36" as const;

// ─── Collection Constants ─────────────────────────────────────────────────────
/** Contract max supply — source of truth is LIVE_CONTRACTS.json */
export const HERO_CARDS_MAX_SUPPLY = 1500 as const;
/** Artwork subset — 555 unique card designs. NOT the deployed contract max supply. */
export const HERO_CARDS_ARTWORK_SUBSET = 555 as const;
/** Mint price in native currency (ETH on Base, PLS on PulseChain) */
export const HERO_CARDS_MINT_PRICE_ETH = "0.005" as const;
/** Whitelist mint price */
export const HERO_CARDS_WHITELIST_PRICE_ETH = "0.003" as const;
/** Max mints per wallet */
export const HERO_CARDS_MAX_PER_WALLET = 20 as const;
/** IPFS metadata base URI — from LIVE_CONTRACTS.json */
export const HERO_CARDS_METADATA_BASE_URI = "ipfs://QmXTty8QaqP6ToahspVS3oRztpjiTkrAiAmv5ixjbPynDE/" as const;

// ─── Per-Chain Config ─────────────────────────────────────────────────────────

export interface HeroCardsChainConfig {
  chainId: number;
  name: string;
  nativeSymbol: string;
  contractAddress: `0x${string}`;
  explorerBaseUrl: string;
}

export const HERO_CARDS_CHAIN_CONFIGS: Record<number, HeroCardsChainConfig> = {
  [CHAIN_ID_BASE]: {
    chainId: CHAIN_ID_BASE,
    name: "Base",
    nativeSymbol: "ETH",
    contractAddress: HERO_CARDS_ADDRESS_BASE,
    explorerBaseUrl: "https://basescan.org",
  },
  [CHAIN_ID_PULSECHAIN]: {
    chainId: CHAIN_ID_PULSECHAIN,
    name: "PulseChain",
    nativeSymbol: "PLS",
    contractAddress: HERO_CARDS_ADDRESS_PULSECHAIN,
    explorerBaseUrl: "https://scan.pulsechain.com",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get the HeroCards chain config for a given chain ID.
 * Returns undefined if the chain is not supported.
 */
export function getHeroCardsConfig(chainId: number): HeroCardsChainConfig | undefined {
  return HERO_CARDS_CHAIN_CONFIGS[chainId];
}

/**
 * Returns true if the given chain ID is a supported HeroCards chain.
 */
export function isSupportedHeroCardsChain(chainId: number): boolean {
  return chainId === CHAIN_ID_BASE || chainId === CHAIN_ID_PULSECHAIN;
}

/**
 * Returns the block explorer URL for a transaction hash on the given chain.
 * Returns undefined if the chain is not supported.
 */
export function getHeroCardsExplorerTxUrl(chainId: number, hash: string): string | undefined {
  const cfg = getHeroCardsConfig(chainId);
  if (!cfg) return undefined;
  return `${cfg.explorerBaseUrl}/tx/${hash}`;
}

/**
 * Returns the block explorer URL for an address on the given chain.
 * Returns undefined if the chain is not supported.
 */
export function getHeroCardsExplorerAddressUrl(chainId: number, address: string): string | undefined {
  const cfg = getHeroCardsConfig(chainId);
  if (!cfg) return undefined;
  return `${cfg.explorerBaseUrl}/address/${address}`;
}
