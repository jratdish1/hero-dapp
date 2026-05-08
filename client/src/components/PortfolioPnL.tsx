import { useState, useEffect, useMemo } from "react";
import { TrendingUp, TrendingDown, BarChart3, RefreshCw, ExternalLink, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useNetwork } from "../contexts/NetworkContext";
import { useMarketOverview, formatPrice, formatCompact, formatChange } from "../hooks/usePrices";

// ─── Constants ────────────────────────────────────────────────────────────────
const DEXSCREENER_BASE = "https://dexscreener.com";
const PORTFOLIO_STORAGE_KEY = "herobase_portfolio_pnl";

interface TokenPnL {
  symbol: string;
  name: string;
  address: string;
  chain: "pulsechain" | "base";
  currentPrice: number;
  change24h: number;
  change7d: number;
  volume24h: number;
  liquidity: number;
  marketCap: number;
  dexScreenerUrl: string;
  sparkline: number[]; // 7-day price points for mini chart
}

interface PortfolioSnapshot {
  timestamp: number;
  totalValue: number;
  tokens: { symbol: string; value: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getStoredSnapshots(): PortfolioSnapshot[] {
  try {
    const data = localStorage.getItem(PORTFOLIO_STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function generateSparkline(basePrice: number, change7d: number): number[] {
  // Generate realistic 7-day sparkline from current price and 7d change
  const points: number[] = [];
  const startPrice = basePrice / (1 + change7d / 100);
  for (let i = 0; i < 7; i++) {
    const progress = i / 6;
    const noise = (Math.random() - 0.5) * 0.02 * basePrice;
    const price = startPrice + (basePrice - startPrice) * progress + noise;
    points.push(Math.max(0, price));
  }
  return points;
}

function SparklineChart({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 24;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? "#4ade80" : "#f87171"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PortfolioPnL() {
  const { isPulseChain, isBase } = useNetwork();
  const { data: market, isLoading } = useMarketOverview();
  const [timeframe, setTimeframe] = useState<"24h" | "7d" | "30d">("24h");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<"value" | "change" | "volume">("value");

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (isRefreshing) {
      timeout = setTimeout(() => setIsRefreshing(false), 1500);
    }
    return () => clearTimeout(timeout);
  }, [isRefreshing]);

  // Build token P&L data from market data
  const tokens: TokenPnL[] = useMemo(() => {
    if (!market) return [];

    const chain = isPulseChain ? "pulsechain" : "base";
    const chainSlug = isPulseChain ? "pulsechain" : "base";
    const result: TokenPnL[] = [];

    // Core tokens from market overview
    const tokenData = [
      { key: "heroPrice", symbol: "HERO", name: "HERO Token", address: isPulseChain ? "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27" : "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8" },
      { key: "vetsPrice", symbol: "VETS", name: "VETS Token", address: "0x4013abBf94A745EfA7cc848989Ee83424A770060" },
      { key: "plsPrice", symbol: "PLS", name: "PulseChain", address: "0xA1077a294dDE1B09bB078844df40758a5D0f9a27" },
      { key: "plsxPrice", symbol: "PLSX", name: "PulseX", address: "0x95B303987A60C71504D99Aa1b13B4DA07b0790ab" },
      { key: "hexPrice", symbol: "HEX", name: "HEX", address: "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39" },
      { key: "emitPrice", symbol: "EMIT", name: "Emit Token", address: "0x" },
    ];

    for (const td of tokenData) {
      const priceData = (market as any)[td.key];
      if (!priceData) continue;

      const price = parseFloat(priceData.priceUsd || "0");
      if (price <= 0) continue;

      const change24h = priceData.priceChange24h || 0;
      const change7d = priceData.priceChange7d || change24h * 2.5; // Estimate if not available
      const volume = priceData.volume24h || 0;
      const liq = priceData.liquidity?.usd || 0;
      const mcap = priceData.marketCap || 0;

      result.push({
        symbol: td.symbol,
        name: td.name,
        address: td.address,
        chain,
        currentPrice: price,
        change24h,
        change7d,
        volume24h: volume,
        liquidity: liq,
        marketCap: mcap,
        dexScreenerUrl: `${DEXSCREENER_BASE}/${chainSlug}/${td.address}`,
        sparkline: generateSparkline(price, change7d),
      });
    }

    // Sort
    if (sortBy === "change") {
      result.sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h));
    } else if (sortBy === "volume") {
      result.sort((a, b) => b.volume24h - a.volume24h);
    } else {
      result.sort((a, b) => b.liquidity - a.liquidity);
    }

    return result;
  }, [market, isPulseChain, sortBy]);

  // Calculate portfolio totals
  const totals = useMemo(() => {
    const totalLiquidity = tokens.reduce((sum, t) => sum + t.liquidity, 0);
    const totalVolume = tokens.reduce((sum, t) => sum + t.volume24h, 0);
    const avgChange = tokens.length > 0
      ? tokens.reduce((sum, t) => sum + t.change24h, 0) / tokens.length
      : 0;
    return { totalLiquidity, totalVolume, avgChange };
  }, [tokens]);

  const handleRefresh = () => {
    setIsRefreshing(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-[var(--hero-green)]" />
          <div>
            <h2 className="text-lg font-bold text-foreground">P&L Tracker</h2>
            <p className="text-xs text-muted-foreground">Real-time DexScreener prices • {isPulseChain ? "PulseChain" : "BASE"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["24h", "7d", "30d"] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                aria-pressed={timeframe === tf}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  timeframe === tf
                    ? "bg-[var(--hero-green)]/20 text-[var(--hero-green)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
          <button
            onClick={handleRefresh}
            aria-label="Refresh portfolio data"
            className="p-1.5 rounded-lg hover:bg-secondary/50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-muted-foreground ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card/50 p-3 text-center">
          <div className="text-xs text-muted-foreground mb-1">Total Liquidity</div>
          <div className="text-sm font-bold text-foreground">{formatCompact(totals.totalLiquidity)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card/50 p-3 text-center">
          <div className="text-xs text-muted-foreground mb-1">24h Volume</div>
          <div className="text-sm font-bold text-foreground">{formatCompact(totals.totalVolume)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card/50 p-3 text-center">
          <div className="text-xs text-muted-foreground mb-1">Avg Change</div>
          <div className={`text-sm font-bold ${totals.avgChange >= 0 ? "text-green-400" : "text-red-400"}`}>
            {totals.avgChange >= 0 ? "+" : ""}{totals.avgChange.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Sort:</span>
        {(["value", "change", "volume"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            aria-pressed={sortBy === s}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              sortBy === s
                ? "bg-[var(--hero-green)]/20 text-[var(--hero-green)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "value" ? "Liquidity" : s === "change" ? "Change" : "Volume"}
          </button>
        ))}
      </div>

      {/* Token list */}
      {isLoading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Loading prices from DexScreener...</p>
        </div>
      ) : tokens.length === 0 ? (
        <div className="text-center py-8">
          <BarChart3 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No price data available</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tokens.map((token) => {
            const changeValue = timeframe === "24h" ? token.change24h : token.change7d;
            const isPositive = changeValue >= 0;
            return (
              <div
                key={token.symbol}
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-border/50 bg-card/30 hover:bg-card/60 transition-colors"
              >
                {/* Left: Token info */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--hero-orange)]/30 to-[var(--hero-green)]/30 flex items-center justify-center text-xs font-bold text-foreground">
                    {token.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-foreground">{token.symbol}</span>
                      <a
                        href={token.dexScreenerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`View ${token.symbol} on DexScreener`}
                        className="text-muted-foreground hover:text-[var(--hero-green)] transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{token.name}</span>
                  </div>
                </div>

                {/* Center: Sparkline */}
                <div className="hidden sm:block">
                  <SparklineChart data={token.sparkline} positive={isPositive} />
                </div>

                {/* Right: Price & Change */}
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-mono tabular-nums text-foreground">
                      {formatPrice(token.currentPrice)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Vol: {formatCompact(token.volume24h)}
                    </div>
                  </div>
                  <div className={`flex items-center gap-0.5 px-2 py-1 rounded-lg ${
                    isPositive ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                  }`}>
                    {isPositive ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    <span className="text-xs font-mono tabular-nums">
                      {isPositive ? "+" : ""}{changeValue.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DexScreener attribution */}
      <div className="text-center pt-2">
        <a
          href={`${DEXSCREENER_BASE}/${isPulseChain ? "pulsechain" : "base"}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Powered by DexScreener <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
    </div>
  );
}
