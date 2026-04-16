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
    vetsWPLSLP: "0xe2EC4E2033054b778a2a56B7B3EB70f89944F5e6",
    emit: "0x32fB5663619A657839A80133994E45c5e5cDf427",
    rhino: "0x6C6D7De6C5f366a1995ed5f1e273C5B3760C6043",
    truFarm: "0xCA942990EF21446Db490532E66992eD1EF76A82b",
  },
  base: {
    hero: "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8",
    heroEthPair: "0x3bb159de8604ab7e0148edc24f2a568c430476cf",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    weth: "0x4200000000000000000000000000000000000006",
    jesse: "0xBE8ae24C5E4D19759f640Fb89617047213be3194",
    aero: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
    brett: "0x532f27101965dd16442E59d40670FaF5eBB142E4",
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
 * Fetch additional PulseChain ticker tokens: EMIT, RHINO, TruFarm.
 */
export async function fetchPulsechainTickerTokens(): Promise<{
  emit: DexScreenerPair | null;
  rhino: DexScreenerPair | null;
  truFarm: DexScreenerPair | null;
}> {
  const cacheKey = "tickerTokens_pulsechain";
  const cached = getCached<{ emit: DexScreenerPair | null; rhino: DexScreenerPair | null; truFarm: DexScreenerPair | null }>(cacheKey);
  if (cached) return cached;

  try {
    const data: DexScreenerPair[] = await fetchDexScreener(
      `/tokens/v1/pulsechain/${ADDRESSES.pulsechain.emit},${ADDRESSES.pulsechain.rhino},${ADDRESSES.pulsechain.truFarm}`
    );

    const findBest = (addr: string) => {
      const matches = data.filter(p => p.baseToken.address.toLowerCase() === addr.toLowerCase());
      if (matches.length === 0) return null;
      return matches.reduce((best, p) => (p.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? p : best);
    };

    const result = {
      emit: findBest(ADDRESSES.pulsechain.emit),
      rhino: findBest(ADDRESSES.pulsechain.rhino),
      truFarm: findBest(ADDRESSES.pulsechain.truFarm),
    };
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error("[PriceFeed] Error fetching PulseChain ticker tokens:", err);
    return { emit: null, rhino: null, truFarm: null };
  }
}

/**
 * Fetch additional BASE ticker tokens: jesse, AERO, BRETT, WETH.
 */
export async function fetchBaseTickerTokens(): Promise<{
  jesse: DexScreenerPair | null;
  aero: DexScreenerPair | null;
  brett: DexScreenerPair | null;
}> {
  const cacheKey = "tickerTokens_base";
  const cached = getCached<{ jesse: DexScreenerPair | null; aero: DexScreenerPair | null; brett: DexScreenerPair | null }>(cacheKey);
  if (cached) return cached;

  try {
    const data: DexScreenerPair[] = await fetchDexScreener(
      `/tokens/v1/base/${ADDRESSES.base.jesse},${ADDRESSES.base.aero},${ADDRESSES.base.brett}`
    );

    const findBest = (addr: string) => {
      const matches = data.filter(p => p.baseToken.address.toLowerCase() === addr.toLowerCase());
      if (matches.length === 0) return null;
      return matches.reduce((best, p) => (p.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? p : best);
    };

    const result = {
      jesse: findBest(ADDRESSES.base.jesse),
      aero: findBest(ADDRESSES.base.aero),
      brett: findBest(ADDRESSES.base.brett),
    };
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error("[PriceFeed] Error fetching Base ticker tokens:", err);
    return { jesse: null, aero: null, brett: null };
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
// ─── LP Pair TVL / APR ─────────────────────────────────────────────────────

export interface FarmPoolData {
  poolId: number;
  name: string;
  lpAddress: string;
  tvlUsd: number;
  volume24h: number;
  priceChange24h: number;
  baseToken: { symbol: string; name: string; address: string };
  quoteToken: { symbol: string; name: string; address: string };
  estimatedApr: number; // Based on 24h fees vs TVL
  txns24h: { buys: number; sells: number };
  dexId: string;
  url: string;
}

const LP_PAIR_ADDRESSES = {
  pulsechain: [
    { poolId: 67, name: "HERO/PLS", address: "0x34948e125033a697332202964de96af85becd78f" },
    { poolId: 9, name: "HERO/TruFarm", address: "0x1F7FA931F4D1789c44f4a7Adc4564DE45ed96DF5" },
    { poolId: 1, name: "VETS/WPLS", address: "0xe2EC4E2033054b778a2a56B7B3EB70f89944F5e6" },
  ],
  base: [
    { poolId: 0, name: "HERO/ETH", address: "0x3bb159de8604ab7e0148edc24f2a568c430476cf" },
  ],
} as const;

/**
 * Fetch live LP pair data for farm pools with TVL and estimated APR.
 * APR is estimated from 24h trading fees (0.3% fee tier) annualized against TVL.
 */
export async function fetchFarmPoolData(chain: "pulsechain" | "base" = "pulsechain"): Promise<FarmPoolData[]> {
  const cacheKey = `farmPools_${chain}`;
  const cached = getCached<FarmPoolData[]>(cacheKey);
  if (cached) return cached;

  const pools = LP_PAIR_ADDRESSES[chain];
  const addresses = pools.map((p) => p.address).join(",");
  const chainId = chain === "pulsechain" ? "pulsechain" : "base";

  try {
    const data = await fetchDexScreener(
      `/latest/dex/pairs/${chainId}/${addresses}`
    );
    const pairs: DexScreenerPair[] = data.pairs || [];

    const result: FarmPoolData[] = pools.map((pool) => {
      const pair = pairs.find(
        (p) => p.pairAddress.toLowerCase() === pool.address.toLowerCase()
      );

      if (!pair) {
        return {
          poolId: pool.poolId,
          name: pool.name,
          lpAddress: pool.address,
          tvlUsd: 0,
          volume24h: 0,
          priceChange24h: 0,
          baseToken: { symbol: "?", name: "Unknown", address: "" },
          quoteToken: { symbol: "?", name: "Unknown", address: "" },
          estimatedApr: 0,
          txns24h: { buys: 0, sells: 0 },
          dexId: "unknown",
          url: "",
        };
      }

      const tvl = pair.liquidity?.usd || 0;
      const vol24h = pair.volume?.h24 || 0;
      // Estimate APR from trading fees: 0.3% fee on volume, annualized
      const dailyFees = vol24h * 0.003;
      const estimatedApr = tvl > 0 ? (dailyFees * 365 / tvl) * 100 : 0;

      return {
        poolId: pool.poolId,
        name: pool.name,
        lpAddress: pool.address,
        tvlUsd: tvl,
        volume24h: vol24h,
        priceChange24h: pair.priceChange?.h24 || 0,
        baseToken: pair.baseToken,
        quoteToken: pair.quoteToken,
        estimatedApr: Math.round(estimatedApr * 100) / 100,
        txns24h: pair.txns?.h24 || { buys: 0, sells: 0 },
        dexId: pair.dexId,
        url: pair.url || "",
      };
    });

    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error(`[PriceFeed] Error fetching farm pool data for ${chain}:`, err);
    return [];
  }
}

// ─── Buy & Burn Tracker ────────────────────────────────────────────────────

const PULSECHAIN_RPC = "https://rpc-pulsechain.g4mm4.io";
const HERO_ADDRESS = "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27";
const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const HERO_TOTAL_SUPPLY = 100_000_000; // 100M HERO

export interface BuyAndBurnData {
  totalBurned: number;          // HERO tokens burned
  totalBurnedUsd: number;       // USD value of burned tokens
  burnPercentage: number;       // % of total supply burned
  totalSupply: number;          // Original total supply
  circulatingSupply: number;    // Total - burned
  heroPrice: string;            // Current HERO price
  lastUpdated: number;
}

async function rpcCall(to: string, data: string): Promise<string> {
  const res = await fetch(PULSECHAIN_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_call",
      params: [{ to, data }, "latest"],
      id: 1,
    }),
    signal: AbortSignal.timeout(10000),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

/**
 * Read HERO token balance at a given address via PulseChain RPC.
 * Uses balanceOf(address) = 0x70a08231
 */
async function getHeroBalance(address: string): Promise<number> {
  const paddedAddr = address.replace("0x", "").toLowerCase().padStart(64, "0");
  const result = await rpcCall(HERO_ADDRESS, `0x70a08231${paddedAddr}`);
  return parseInt(result, 16) / 1e18;
}

/**
 * Fetch Buy & Burn data: total burned, burn rate, circulating supply.
 * Reads from the dead address balance on-chain + DexScreener for price.
 */
export async function fetchBuyAndBurnData(): Promise<BuyAndBurnData> {
  const cacheKey = "buyAndBurn";
  const cached = getCached<BuyAndBurnData>(cacheKey);
  if (cached) return cached;

  try {
    // Fetch burned tokens and current price in parallel
    const [deadBalance, zeroBalance, tokenData] = await Promise.all([
      getHeroBalance(DEAD_ADDRESS),
      getHeroBalance(ZERO_ADDRESS),
      fetchTokenPrices(),
    ]);

    const totalBurned = deadBalance + zeroBalance;
    const burnPercentage = (totalBurned / HERO_TOTAL_SUPPLY) * 100;
    const circulatingSupply = HERO_TOTAL_SUPPLY - totalBurned;

    // Get HERO price from the best pair
    const heroPrimary = tokenData.heroPairs.length > 0
      ? tokenData.heroPairs.reduce((best, p) =>
          (p.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? p : best
        )
      : null;
    const heroPrice = heroPrimary?.priceUsd || "0";
    const totalBurnedUsd = totalBurned * parseFloat(heroPrice);

    const data: BuyAndBurnData = {
      totalBurned,
      totalBurnedUsd,
      burnPercentage: Math.round(burnPercentage * 100) / 100,
      totalSupply: HERO_TOTAL_SUPPLY,
      circulatingSupply,
      heroPrice,
      lastUpdated: Date.now(),
    };

    setCache(cacheKey, data);
    return data;
  } catch (err) {
    console.error("[PriceFeed] Error fetching Buy & Burn data:", err);
    return {
      totalBurned: 0,
      totalBurnedUsd: 0,
      burnPercentage: 0,
      totalSupply: HERO_TOTAL_SUPPLY,
      circulatingSupply: HERO_TOTAL_SUPPLY,
      heroPrice: "0",
      lastUpdated: Date.now(),
    };
  }
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
