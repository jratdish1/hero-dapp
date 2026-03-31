import { describe, it, expect, vi, beforeEach } from "vitest";

// We need to isolate modules between tests to avoid cache interference
// Use vi.hoisted to create mock before imports
const mockFetch = vi.hoisted(() => vi.fn());

vi.stubGlobal("fetch", mockFetch);

describe("Price Feed Service", () => {
  beforeEach(async () => {
    mockFetch.mockReset();
    // Re-import module to clear internal in-memory cache
    vi.resetModules();
  });

  describe("fetchTokenPrices", () => {
    it("returns HERO and VETS pair data from DexScreener", async () => {
      const MOCK_PAIR = makeMockPair("HERO", "0x1");
      const MOCK_VETS = makeMockPair("VETS", "0x3");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [MOCK_PAIR, MOCK_VETS],
      });

      const { fetchTokenPrices } = await import("./priceFeed");
      const result = await fetchTokenPrices();
      expect(result).toBeDefined();
      expect(result.heroPairs).toBeDefined();
      expect(result.vetsPairs).toBeDefined();
      expect(Array.isArray(result.heroPairs)).toBe(true);
      expect(Array.isArray(result.vetsPairs)).toBe(true);
    });

    it("handles API failure gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const { fetchTokenPrices } = await import("./priceFeed");
      const result = await fetchTokenPrices();
      expect(result).toBeDefined();
      expect(result.heroPairs).toEqual([]);
      expect(result.vetsPairs).toEqual([]);
    });

    it("handles network error gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { fetchTokenPrices } = await import("./priceFeed");
      const result = await fetchTokenPrices();
      expect(result).toBeDefined();
      expect(result.heroPairs).toEqual([]);
      expect(result.vetsPairs).toEqual([]);
    });
  });

  describe("fetchPlsPrice", () => {
    it("returns PLS price data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          makeMockPair("WPLS", "0xA1077a294dDE1B09bB078844df40758a5D0f9a27"),
        ],
      });

      const { fetchPlsPrice } = await import("./priceFeed");
      const result = await fetchPlsPrice();
      expect(result).toBeDefined();
      if (result) {
        expect(result.priceUsd).toBeDefined();
        expect(typeof result.priceUsd).toBe("string");
      }
    });

    it("handles API failure gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      });

      const { fetchPlsPrice } = await import("./priceFeed");
      const result = await fetchPlsPrice();
      expect(result).toBeNull();
    });
  });

  describe("fetchEthPrice", () => {
    it("returns ETH price data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          makeMockPair("WETH", "0x4200000000000000000000000000000000000006"),
        ],
      });

      const { fetchEthPrice } = await import("./priceFeed");
      const result = await fetchEthPrice();
      expect(result).toBeDefined();
      if (result) {
        expect(result.priceUsd).toBeDefined();
      }
    });
  });

  describe("fetchBaseTokenPrices", () => {
    it("returns Base chain HERO pair data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { ...makeMockPair("HERO", "0xBase123"), chainId: "base" },
        ],
      });

      const { fetchBaseTokenPrices } = await import("./priceFeed");
      const result = await fetchBaseTokenPrices();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
    });

    it("returns empty array on failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("timeout"));

      const { fetchBaseTokenPrices } = await import("./priceFeed");
      const result = await fetchBaseTokenPrices();
      expect(result).toEqual([]);
    });
  });

  describe("getMarketOverview", () => {
    it("returns full market overview for pulsechain", async () => {
      const MOCK_HERO = makeMockPair("HERO", "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27");
      const MOCK_VETS = makeMockPair("VETS", "0x4013abBf94A745EfA7cc848989Ee83424a770060");
      const MOCK_PLS = makeMockPair("WPLS", "0xA1077a294dDE1B09bB078844df40758a5D0f9a27");
      const MOCK_ETH = makeMockPair("WETH", "0x4200000000000000000000000000000000000006");

      // fetchTokenPrices, fetchPlsPrice, fetchEthPrice all called concurrently
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => [MOCK_HERO, MOCK_VETS] })
        .mockResolvedValueOnce({ ok: true, json: async () => [MOCK_PLS] })
        .mockResolvedValueOnce({ ok: true, json: async () => [MOCK_ETH] });

      const { getMarketOverview } = await import("./priceFeed");
      const result = await getMarketOverview("pulsechain");
      expect(result).toBeDefined();
      expect(result.heroPrice).toBeDefined();
      expect(result.vetsPrice).toBeDefined();
      expect(result.heroLpPairs).toBeDefined();
      expect(result.vetsLpPairs).toBeDefined();
      expect(result.lastUpdated).toBeDefined();
      expect(typeof result.lastUpdated).toBe("number");
      expect(result.totalHeroLiquidity).toBeGreaterThanOrEqual(0);
      expect(result.totalVetsLiquidity).toBeGreaterThanOrEqual(0);
    });
  });

  describe("searchPairs", () => {
    it("returns search results for a query", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pairs: [makeMockPair("HERO", "0x1")] }),
      });

      const { searchPairs } = await import("./priceFeed");
      const result = await searchPairs("HERO");
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
    });

    it("returns empty array on failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { searchPairs } = await import("./priceFeed");
      const result = await searchPairs("HERO");
      expect(result).toEqual([]);
    });
  });
});

// ─── Helper ────────────────────────────────────────────────────────────────

function makeMockPair(symbol: string, address: string) {
  return {
    chainId: "pulsechain",
    dexId: "pulsex",
    url: "https://dexscreener.com/pulsechain/0xabc",
    pairAddress: "0xabc123",
    baseToken: { address, name: symbol, symbol },
    quoteToken: { address: "0x2", name: "WPLS", symbol: "WPLS" },
    priceNative: "0.000001",
    priceUsd: "0.0001465",
    liquidity: { usd: 3981, base: 100000, quote: 200000 },
    volume: { h24: 1200, h6: 400, h1: 100, m5: 10 },
    priceChange: { h24: 5.2, h6: 2.1, h1: 0.5 },
    txns: {
      h24: { buys: 42, sells: 18 },
      h6: { buys: 10, sells: 5 },
      h1: { buys: 3, sells: 1 },
      m5: { buys: 1, sells: 0 },
    },
    fdv: 14470,
    marketCap: 14470,
    pairCreatedAt: 1700000000000,
  };
}
