/**
 * Tests for heroCards-config.ts
 * Covers: chain config lookup, helper functions, constants, and edge cases.
 */
import { describe, it, expect } from "vitest";
import {
  CHAIN_ID_BASE,
  CHAIN_ID_PULSECHAIN,
  HERO_CARDS_ADDRESS_BASE,
  HERO_CARDS_ADDRESS_PULSECHAIN,
  HERO_CARDS_MAX_SUPPLY,
  HERO_CARDS_ARTWORK_SUBSET,
  HERO_CARDS_MAX_PER_WALLET,
  HERO_CARDS_MINT_PRICE_ETH,
  HERO_CARDS_WHITELIST_PRICE_ETH,
  HERO_CARDS_CHAIN_CONFIGS,
  getHeroCardsConfig,
  isSupportedHeroCardsChain,
  getHeroCardsExplorerTxUrl,
  getHeroCardsExplorerAddressUrl,
} from "./heroCards-config";

// ─── Constants ────────────────────────────────────────────────────────────────
describe("HeroCards Constants", () => {
  it("CHAIN_ID_BASE is 8453", () => {
    expect(CHAIN_ID_BASE).toBe(8453);
  });

  it("CHAIN_ID_PULSECHAIN is 369", () => {
    expect(CHAIN_ID_PULSECHAIN).toBe(369);
  });

  it("HERO_CARDS_MAX_SUPPLY is 1500 (contract source of truth)", () => {
    expect(HERO_CARDS_MAX_SUPPLY).toBe(1500);
  });

  it("HERO_CARDS_ARTWORK_SUBSET is 555 (NOT the max supply)", () => {
    expect(HERO_CARDS_ARTWORK_SUBSET).toBe(555);
    expect(HERO_CARDS_ARTWORK_SUBSET).not.toBe(HERO_CARDS_MAX_SUPPLY);
  });

  it("HERO_CARDS_MAX_PER_WALLET is 20", () => {
    expect(HERO_CARDS_MAX_PER_WALLET).toBe(20);
  });

  it("HERO_CARDS_MINT_PRICE_ETH is 0.005", () => {
    expect(HERO_CARDS_MINT_PRICE_ETH).toBe("0.005");
  });

  it("HERO_CARDS_WHITELIST_PRICE_ETH is 0.003", () => {
    expect(HERO_CARDS_WHITELIST_PRICE_ETH).toBe("0.003");
  });

  it("Base contract address matches LIVE_CONTRACTS.json", () => {
    expect(HERO_CARDS_ADDRESS_BASE).toBe("0x5Fad096af059ff9A2167351A0ffc8b45D71897bE");
  });

  it("PulseChain contract address matches LIVE_CONTRACTS.json", () => {
    expect(HERO_CARDS_ADDRESS_PULSECHAIN).toBe("0xCe609B3A82E89FCd4B5e5a29159b051CE86f7B36");
  });
});

// ─── Chain Configs ────────────────────────────────────────────────────────────
describe("HERO_CARDS_CHAIN_CONFIGS", () => {
  it("has exactly 2 supported chains", () => {
    expect(Object.keys(HERO_CARDS_CHAIN_CONFIGS)).toHaveLength(2);
  });

  it("Base config has correct chainId and nativeSymbol", () => {
    const cfg = HERO_CARDS_CHAIN_CONFIGS[CHAIN_ID_BASE];
    expect(cfg.chainId).toBe(8453);
    expect(cfg.nativeSymbol).toBe("ETH");
    expect(cfg.contractAddress).toBe(HERO_CARDS_ADDRESS_BASE);
  });

  it("PulseChain config has correct chainId and nativeSymbol", () => {
    const cfg = HERO_CARDS_CHAIN_CONFIGS[CHAIN_ID_PULSECHAIN];
    expect(cfg.chainId).toBe(369);
    expect(cfg.nativeSymbol).toBe("PLS");
    expect(cfg.contractAddress).toBe(HERO_CARDS_ADDRESS_PULSECHAIN);
  });
});

// ─── getHeroCardsConfig ───────────────────────────────────────────────────────
describe("getHeroCardsConfig()", () => {
  it("returns Base config for chainId 8453", () => {
    const cfg = getHeroCardsConfig(8453);
    expect(cfg).toBeDefined();
    expect(cfg!.name).toBe("Base");
  });

  it("returns PulseChain config for chainId 369", () => {
    const cfg = getHeroCardsConfig(369);
    expect(cfg).toBeDefined();
    expect(cfg!.name).toBe("PulseChain");
  });

  it("returns undefined for unsupported chain (Ethereum mainnet)", () => {
    expect(getHeroCardsConfig(1)).toBeUndefined();
  });

  it("returns undefined for chainId 0", () => {
    expect(getHeroCardsConfig(0)).toBeUndefined();
  });

  it("returns undefined for Polygon", () => {
    expect(getHeroCardsConfig(137)).toBeUndefined();
  });
});

// ─── isSupportedHeroCardsChain ────────────────────────────────────────────────
describe("isSupportedHeroCardsChain()", () => {
  it("returns true for Base (8453)", () => {
    expect(isSupportedHeroCardsChain(8453)).toBe(true);
  });

  it("returns true for PulseChain (369)", () => {
    expect(isSupportedHeroCardsChain(369)).toBe(true);
  });

  it("returns false for Ethereum mainnet (1)", () => {
    expect(isSupportedHeroCardsChain(1)).toBe(false);
  });

  it("returns false for Polygon (137)", () => {
    expect(isSupportedHeroCardsChain(137)).toBe(false);
  });

  it("returns false for chainId 0", () => {
    expect(isSupportedHeroCardsChain(0)).toBe(false);
  });

  it("returns false for negative chainId", () => {
    expect(isSupportedHeroCardsChain(-1)).toBe(false);
  });
});

// ─── getHeroCardsExplorerTxUrl ────────────────────────────────────────────────
describe("getHeroCardsExplorerTxUrl()", () => {
  const MOCK_HASH = "0xabc123def456";

  it("returns BaseScan tx URL for Base chain", () => {
    const url = getHeroCardsExplorerTxUrl(8453, MOCK_HASH);
    expect(url).toBe(`https://basescan.org/tx/${MOCK_HASH}`);
  });

  it("returns PulseChain scan tx URL for PulseChain", () => {
    const url = getHeroCardsExplorerTxUrl(369, MOCK_HASH);
    expect(url).toBe(`https://scan.pulsechain.com/tx/${MOCK_HASH}`);
  });

  it("returns undefined for unsupported chain", () => {
    expect(getHeroCardsExplorerTxUrl(1, MOCK_HASH)).toBeUndefined();
  });
});

// ─── getHeroCardsExplorerAddressUrl ───────────────────────────────────────────
describe("getHeroCardsExplorerAddressUrl()", () => {
  const MOCK_ADDR = "0x5Fad096af059ff9A2167351A0ffc8b45D71897bE";

  it("returns BaseScan address URL for Base chain", () => {
    const url = getHeroCardsExplorerAddressUrl(8453, MOCK_ADDR);
    expect(url).toBe(`https://basescan.org/address/${MOCK_ADDR}`);
  });

  it("returns PulseChain scan address URL for PulseChain", () => {
    const url = getHeroCardsExplorerAddressUrl(369, MOCK_ADDR);
    expect(url).toBe(`https://scan.pulsechain.com/address/${MOCK_ADDR}`);
  });

  it("returns undefined for unsupported chain", () => {
    expect(getHeroCardsExplorerAddressUrl(1, MOCK_ADDR)).toBeUndefined();
  });
});
