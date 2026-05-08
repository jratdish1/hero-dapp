import { useState, useEffect, useMemo } from "react";
import { TrendingUp, Zap, CheckCircle2, ArrowRight, RefreshCw } from "lucide-react";
import { useNetwork } from "../contexts/NetworkContext";
import { useMarketOverview } from "../hooks/usePrices";
import type { DexSource } from "@shared/tokens";

// ─── Constants ────────────────────────────────────────────────────────────────
const PLS_PRICE_FALLBACK = 0.00000749; // from shared/tokens.ts

// ─── Helpers (outside component to avoid re-creation) ─────────────────────────
const priceImpactColor = (impact: number): string => {
  if (impact < 1) return "text-green-400";
  if (impact < 3) return "text-yellow-400";
  if (impact < 5) return "text-orange-400";
  return "text-red-400";
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface RouteQuote {
  dex: string;
  estimatedOutput: number;
  priceImpact: number;
  gasEstimate: number;
  isBest: boolean;
  savings: number;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function RouteComparison() {
  const { dexSources, isPulseChain } = useNetwork();
  const { data: market } = useMarketOverview();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Cleanup timeout on unmount
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (isRefreshing) {
      timeout = setTimeout(() => setIsRefreshing(false), 1000);
    }
    return () => clearTimeout(timeout);
  }, [isRefreshing]);

  const fromToken = "PLS";
  const toToken = "HERO";
  const amount = 1000000;

  // Route calculation with division-by-zero guards
  const routes: RouteQuote[] = useMemo(() => {
    const heroPrice = market?.heroPrice?.priceUsd ? parseFloat(market.heroPrice.priceUsd) : 0;
    if (heroPrice <= 0) return []; // Guard: no division by zero

    const plsPrice = market?.plsPrice?.priceUsd ? parseFloat(market.plsPrice.priceUsd) : PLS_PRICE_FALLBACK;
    const inputValue = amount * plsPrice;
    const baseOutput = inputValue / heroPrice; // Safe: heroPrice > 0 checked above

    // Realistic DEX variance simulation (production would call router contracts)
    const dexVariance: Record<string, number> = {
      "PulseX V1": 0.997,
      "PulseX V2": 1.002,
      "9inch": 0.994,
      "Liberty Swap": 0.991,
      "Uniswap V3": 1.001,
      "Aerodrome": 0.998,
      "BaseSwap": 0.995,
    };

    const quotes = (dexSources as DexSource[]).map((dex) => {
      const variance = dexVariance[dex.name] ?? 0.995;
      const output = baseOutput * variance;
      const impact = Math.abs((1 - variance) * 100);
      const gas = isPulseChain ? 0.02 + (dex.name.length % 3) * 0.01 : 0.15 + (dex.name.length % 3) * 0.05;
      return {
        dex: dex.name,
        estimatedOutput: output,
        priceImpact: impact,
        gasEstimate: gas,
        isBest: false,
        savings: 0,
      };
    });

    if (quotes.length === 0) return [];

    // Sort and mark best — immutable approach (no mutation)
    const sorted = [...quotes].sort((a, b) => b.estimatedOutput - a.estimatedOutput);
    const bestDex = sorted[0].dex;
    const worstOutput = sorted[sorted.length - 1].estimatedOutput;

    // Guard: avoid division by zero on worstOutput
    const updatedQuotes = sorted.map((q) => ({
      ...q,
      isBest: q.dex === bestDex,
      savings: worstOutput > 0 ? ((q.estimatedOutput - worstOutput) / worstOutput) * 100 : 0,
    }));

    return updatedQuotes;
  }, [market?.heroPrice?.priceUsd, market?.plsPrice?.priceUsd, dexSources, isPulseChain, amount]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setLastRefresh(new Date());
  };

  const bestRoute = routes.find((r) => r.isBest);

  if (routes.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--hero-green)]" />
          <h3 className="text-sm font-bold text-foreground">Route Comparison</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--hero-green)]/10 text-[var(--hero-green)] font-medium">
            {routes.length} DEXes
          </span>
        </div>
        <button
          onClick={handleRefresh}
          aria-label="Refresh route comparison"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Input summary */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 border border-border/50">
        <span className="text-xs text-muted-foreground">Routing</span>
        <span className="text-xs font-semibold text-foreground">{amount.toLocaleString()} {fromToken}</span>
        <ArrowRight className="w-3 h-3 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground">{toToken}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          Updated {lastRefresh.toLocaleTimeString()}
        </span>
      </div>

      {/* Route cards */}
      <div className="space-y-2">
        {routes.map((route) => (
          <div
            key={route.dex}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all ${
              route.isBest
                ? "border-[var(--hero-green)]/40 bg-[var(--hero-green)]/5"
                : "border-border/50 bg-secondary/20 hover:bg-secondary/40"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                {route.isBest && <CheckCircle2 className="w-4 h-4 text-[var(--hero-green)]" />}
                <span className={`text-sm font-medium ${route.isBest ? "text-[var(--hero-green)]" : "text-foreground"}`}>
                  {route.dex}
                </span>
              </div>
              {route.isBest && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--hero-green)]/20 text-[var(--hero-green)] font-bold uppercase">
                  Best
                </span>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className={`text-sm font-mono tabular-nums ${route.isBest ? "text-[var(--hero-green)]" : "text-foreground"}`}>
                  {route.estimatedOutput.toLocaleString(undefined, { maximumFractionDigits: 0 })} {toToken}
                </div>
                {route.savings > 0 && (
                  <div className="text-[10px] text-[var(--hero-green)]">
                    +{route.savings.toFixed(2)}% vs worst
                  </div>
                )}
              </div>

              <div className="text-right min-w-[60px]">
                <div className={`text-xs font-mono ${priceImpactColor(route.priceImpact)}`}>
                  {route.priceImpact.toFixed(2)}%
                </div>
                <div className="text-[10px] text-muted-foreground">impact</div>
              </div>

              <div className="text-right min-w-[50px]">
                <div className="text-xs font-mono text-muted-foreground">
                  ${route.gasEstimate.toFixed(3)}
                </div>
                <div className="text-[10px] text-muted-foreground">gas</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Best route summary */}
      {bestRoute && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--hero-green)]/5 border border-[var(--hero-green)]/20">
          <Zap className="w-4 h-4 text-[var(--hero-green)]" />
          <span className="text-xs text-[var(--hero-green)]">
            Best rate via <strong>{bestRoute.dex}</strong> — saves {bestRoute.savings.toFixed(2)}% vs worst route
          </span>
        </div>
      )}
    </div>
  );
}
