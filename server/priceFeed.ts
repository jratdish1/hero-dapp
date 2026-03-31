/**
 * HERO Dapp — Real-Time Price Feed Service
 * 
 * Fetches live token prices, LP pair data, and market metrics from DexScreener API.
 * Uses in-memory caching with 30-second TTL to stay well within the 300 req/min rate limit.
 * All data is served through tRPC procedures to the frontend.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TokenPrice {
  symbol: string;
  name: string;
  address: string;
  chainId: string;
  priceUsd: string;
  priceNative: string;
  priceChange24h: number;
  priceChange6h: number;
  priceChange1h: number;
  volume24h: number;
  liquidity: number;
  marketCap: number;
  fdv: number;
  txns24h: { buys: number; sells: number };
  pairAddress: string;
  dexId: string;
  updatedAt: number;
}

export interface LpPairData {
  pairAddress: string;
  dexId: string;
  chainId: string;
  baseToken: { symbol: string; name: string; address: string };
  quoteToken: { symbol: string; name: string; address: string };
  priceUsd: string;
  priceNative: string;
  liquidity: { usd: number; base: number; quote: number };
  volume24h: number;
  priceChange24h: number;
  txns24h: { buys: number; sells: number };
  pairCreatedAt: number;
  url: string;
}

export interface MarketOverview {
  heroPrice: TokenPrice | null;
  vetsPrice: TokenPrice | null;
  plsPrice: TokenPrice | null;
  ethPrice: TokenPrice | null;
  heroLpPairs: LpPairData[];
  vetsLpPairs: LpPairData[];
  totalHeroLiquidity: number;
  totalVetsLiquidity: number;
  heroMarketCap: number;
  vetsMarketCap: number;
  lastUpdated: number;
}

// ─── Contract Addresses ─────────────────────────────────────────────────────

const ADDRESSES = {
  pulsechain: {
    hero: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
    vets: "0x4013abBf94A745EfA7cc848989Ee83424a770060",
    wpls: "0xA1077a294dDE1B09bB078844df40758a5D0f9a27",
    dai: "0xefD766cCb38EaF1dfd701853BFCe31359239F305",
    heroTruFarmLP: "0x1F7FA931F4D1789c44f4a7Adc4564DE45ed96DF5",
    heroPLSLP: "0x34948e125033a697332202964de96af85becd78f",
  },
  base: {
    hero: "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8",
    heroEthPair: "0x3bb159de8604ab7e0148edc24f2a568c430476cf",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
} as const;

// ─── DexScreener API ────────────────────────────────────────────────────────

const DEXSCREENER_BASE = "https://api.dexscreener.com";

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  labels?: string[];
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd: string | null;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: { h24: number; h6: number; h1: number; m5: number };
  priceChange: { h1?: number; h6?: number; h24?: number };
  liquidity: { usd: number; base: number; quote: number };
  fdv: number | null;
  marketCap: number | null;
  pairCreatedAt: number | null;
}

async function fetchDexScreener(path: string): Promise<any> {
  const url = `${DEXSCREENER_BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`DexScreener API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function pairToTokenPrice(pair: DexScreenerPair): TokenPrice {
  return {
    symbol: pair.baseToken.symbol,
    name: pair.baseToken.name,
    address: pair.baseToken.address,
    chainId: pair.chainId,
    priceUsd: pair.priceUsd || "0",
    priceNative: pair.priceNative,
    priceChange24h: pair.priceChange?.h24 || 0,
    priceChange6h: pair.priceChange?.h6 || 0,
    priceChange1h: pair.priceChange?.h1 || 0,
    volume24h: pair.volume?.h24 || 0,
    liquidity: pair.liquidity?.usd || 0,
    marketCap: pair.marketCap || 0,
    fdv: pair.fdv || 0,
    txns24h: pair.txns?.h24 || { buys: 0, sells: 0 },
    pairAddress: pair.pairAddress,
    dexId: pair.dexId,
    updatedAt: Date.now(),
  };
}

function pairToLpData(pair: DexScreenerPair): LpPairData {
  return {
    pairAddress: pair.pairAddress,
    dexId: pair.dexId,
    chainId: pair.chainId,
    baseToken: pair.baseToken,
    quoteToken: pair.quoteToken,
    priceUsd: pair.priceUsd || "0",
    priceNative: pair.priceNative,
    liquidity: pair.liquidity || { usd: 0, base: 0, quote: 0 },
    volume24h: pair.volume?.h24 || 0,
    priceChange24h: pair.priceChange?.h24 || 0,
    txns24h: pair.txns?.h24 || { buys: 0, sells: 0 },
    pairCreatedAt: pair.pairCreatedAt || 0,
    url: pair.url || "",
  };
}

// ─── Cache ──────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache: Record<string, CacheEntry<any>> = {};
const CACHE_TTL = 30_000; // 30 seconds

function getCached<T>(key: string): T | null {
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    delete cache[key];
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  cache[key] = { data, timestamp: Date.now() };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch all token prices for HERO and VETS on PulseChain.
 * Returns all LP pairs for both tokens.
 */
export async function fetchTokenPrices(): Promise<{
  heroPairs: DexScreenerPair[];
  vetsPairs: DexScreenerPair[];
}> {
  const cacheKey = "tokenPrices_pulsechain";
  const cached = getCached<{ heroPairs: DexScreenerPair[]; vetsPairs: DexScreenerPair[] }>(cacheKey);
  if (cached) return cached;

  try {
    const data: DexScreenerPair[] = await fetchDexScreener(
      `/tokens/v1/pulsechain/${ADDRESSES.pulsechain.hero},${ADDRESSES.pulsechain.vets}`
    );

    const heroPairs = data.filter(
      (p) => p.baseToken.address.toLowerCase() === ADDRESSES.pulsechain.hero.toLowerCase()
    );
    const vetsPairs = data.filter(
      (p) => p.baseToken.address.toLowerCase() === ADDRESSES.pulsechain.vets.toLowerCase()
    );

    const result = { heroPairs, vetsPairs };
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error("[PriceFeed] Error fetching token prices:", err);
    return { heroPairs: [], vetsPairs: [] };
  }
}

/**
 * Fetch HERO token data on Base chain.
 */
export async function fetchBaseTokenPrices(): Promise<DexScreenerPair[]> {
  const cacheKey = "tokenPrices_base";
  const cached = getCached<DexScreenerPair[]>(cacheKey);
  if (cached) return cached;

  try {
    const data: DexScreenerPair[] = await fetchDexScreener(
      `/tokens/v1/base/${ADDRESSES.base.hero}`
    );
    setCache(cacheKey, data);
    return data;
  } catch (err) {
    console.error("[PriceFeed] Error fetching Base token prices:", err);
    return [];
  }
}

/**
 * Fetch PLS/USD price using WPLS/DAI pair on PulseX.
 */
export async function fetchPlsPrice(): Promise<TokenPrice | null> {
  const cacheKey = "plsPrice";
  const cached = getCached<TokenPrice>(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchDexScreener(
      `/tokens/v1/pulsechain/${ADDRESSES.pulsechain.wpls}`
    );
    // Find the highest-liquidity WPLS pair
    const pairs: DexScreenerPair[] = Array.isArray(data) ? data : [];
    if (pairs.length === 0) return null;

    const bestPair = pairs.reduce((best, p) =>
      (p.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? p : best
    );

    const price: TokenPrice = {
      ...pairToTokenPrice(bestPair),
      symbol: "PLS",
      name: "Pulse",
      address: "0x0000000000000000000000000000000000000000",
    };
    setCache(cacheKey, price);
    return price;
  } catch (err) {
    console.error("[PriceFeed] Error fetching PLS price:", err);
    return null;
  }
}

/**
 * Fetch ETH/USD price using WETH on Base.
 */
export async function fetchEthPrice(): Promise<TokenPrice | null> {
  const cacheKey = "ethPrice";
  const cached = getCached<TokenPrice>(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchDexScreener(
      `/tokens/v1/base/0x4200000000000000000000000000000000000006`
    );
    const pairs: DexScreenerPair[] = Array.isArray(data) ? data : [];
    if (pairs.length === 0) return null;

    const bestPair = pairs.reduce((best, p) =>
      (p.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? p : best
    );

    const price: TokenPrice = {
      ...pairToTokenPrice(bestPair),
      symbol: "ETH",
      name: "Ether",
      address: "0x0000000000000000000000000000000000000000",
    };
    setCache(cacheKey, price);
    return price;
  } catch (err) {
    console.error("[PriceFeed] Error fetching ETH price:", err);
    return null;
  }
}

/**
 * Get the complete market overview — prices, LP data, market caps, liquidity.
 * This is the main endpoint consumed by the frontend.
 */
export async function getMarketOverview(chain: "pulsechain" | "base" = "pulsechain"): Promise<MarketOverview> {
  const cacheKey = `marketOverview_${chain}`;
  const cached = getCached<MarketOverview>(cacheKey);
  if (cached) return cached;

  const [tokenData, plsPrice, ethPrice] = await Promise.all([
    fetchTokenPrices(),
    fetchPlsPrice(),
    fetchEthPrice(),
  ]);

  const heroPrimary = tokenData.heroPairs.length > 0
    ? pairToTokenPrice(tokenData.heroPairs.reduce((best, p) =>
        (p.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? p : best
      ))
    : null;

  const vetsPrimary = tokenData.vetsPairs.length > 0
    ? pairToTokenPrice(tokenData.vetsPairs.reduce((best, p) =>
        (p.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? p : best
      ))
    : null;

  const heroLpPairs = tokenData.heroPairs.map(pairToLpData);
  const vetsLpPairs = tokenData.vetsPairs.map(pairToLpData);

  const totalHeroLiquidity = heroLpPairs.reduce((sum, p) => sum + (p.liquidity?.usd || 0), 0);
  const totalVetsLiquidity = vetsLpPairs.reduce((sum, p) => sum + (p.liquidity?.usd || 0), 0);

  const overview: MarketOverview = {
    heroPrice: heroPrimary,
    vetsPrice: vetsPrimary,
    plsPrice,
    ethPrice,
    heroLpPairs,
    vetsLpPairs,
    totalHeroLiquidity,
    totalVetsLiquidity,
    heroMarketCap: heroPrimary?.marketCap || 0,
    vetsMarketCap: vetsPrimary?.marketCap || 0,
    lastUpdated: Date.now(),
  };

  setCache(cacheKey, overview);
  return overview;
}

/**
 * Search for any token pair on DexScreener.
 */
export async function searchPairs(query: string): Promise<LpPairData[]> {
  const cacheKey = `search_${query}`;
  const cached = getCached<LpPairData[]>(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchDexScreener(
      `/latest/dex/search?q=${encodeURIComponent(query)}`
    );
    const pairs: LpPairData[] = (data.pairs || []).map(pairToLpData);
    setCache(cacheKey, pairs);
    return pairs;
  } catch (err) {
    console.error("[PriceFeed] Error searching pairs:", err);
    return [];
  }
}
