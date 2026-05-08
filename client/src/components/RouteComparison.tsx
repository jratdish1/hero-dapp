import { useState, useEffect, useMemo } from "react";
import { TrendingUp, Zap, AlertTriangle, CheckCircle2, ArrowRight, RefreshCw } from "lucide-react";
import { useNetwork } from "../contexts/NetworkContext";
import { useMarketOverview, formatPrice } from "../hooks/usePrices";

interface RouteQuote {
  dex: string;
  estimatedOutput: number;
  priceImpact: number;
  gasEstimate: number;
  isBest: boolean;
  savings: number; // vs worst route in %
}

export default function RouteComparison() {
  const { dexSources, isPulseChain } = useNetwork();
  const { data: market } = useMarketOverview();
  const [fromToken, setFromToken] = useState("PLS");
  const [toToken, setToToken] = useState("HERO");
  const [amount, setAmount] = useState("1000000");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Simulated route quotes based on real DEX data patterns
  // In production this would call each DEX router contract
  const routes: RouteQuote[] = useMemo(() => {
    if (!market?.heroPrice?.priceUsd) return [];
    const heroPrice = parseFloat(market.heroPrice.priceUsd);
    const plsPrice = market.plsPrice ? parseFloat(market.plsPrice.priceUsd) : 0.00000749;
    const inputValue = parseFloat(amount) * plsPrice;
    const baseOutput = inputValue / heroPrice;

    // Simulate different DEX rates with realistic variance
    const dexVariance: Record<string, number> = {
      "PulseX V1": 0.997,
      "PulseX V2": 1.002,
      "9inch": 0.994,
      "Liberty Swap": 0.991,
      "Uniswap V3": 1.001,
      "Aerodrome": 0.998,
      "BaseSwap": 0.995,
    };

    const quotes = dexSources.map((dex: { id: string; name: string }) => {
      const variance = dexVariance[dex.name] || (0.99 + Math.random() * 0.02);
      const output = baseOutput * variance;
      const impact = (1 - variance) * 100;
      const gas = isPulseChain ? 0.02 + Math.random() * 0.03 : 0.15 + Math.random() * 0.1;
      return {
        dex: dex.name,
        estimatedOutput: output,
        priceImpact: Math.abs(impact),
        gasEstimate: gas,
        isBest: false,
        savings: 0,
      };
    });

    // Mark best route
    if (quotes.length > 0) {
      const sorted = [...quotes].sort((a, b) => b.estimatedOutput - a.estimatedOutput);
      const bestIdx = quotes.findIndex(q => q.dex === sorted[0].dex);
      const worstOutput = sorted[sorted.length - 1].estimatedOutput;
      quotes[bestIdx].isBest = true;
      quotes.forEach(q => {
        q.savings = ((q.estimatedOutput - worstOutput) / worstOutput) * 100;
      });
    }

    return quotes;
  }, [market, dexSources, amount, isPulseChain]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setLastRefresh(new Date());
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const bestRoute = routes.find(r => r.isBest);
  const priceImpactColor = (impact: number) => {
    if (impact < 1) return "text-green-400";
    if (impact < 3) return "text-yellow-400";
    if (impact < 5) return "text-orange-400";
    return "text-red-400";
  };

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
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Input summary */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 border border-border/50">
        <span className="text-xs text-muted-foreground">Routing</span>
        <span className="text-xs font-semibold text-foreground">{parseFloat(amount).toLocaleString()} {fromToken}</span>
        <ArrowRight className="w-3 h-3 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground">{toToken}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          Updated {lastRefresh.toLocaleTimeString()}
        </span>
      </div>

      {/* Route cards */}
      <div className="space-y-2">
        {routes.sort((a, b) => b.estimatedOutput - a.estimatedOutput).map((route, i) => (
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
              {/* Estimated output */}
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

              {/* Price impact */}
              <div className="text-right min-w-[60px]">
                <div className={`text-xs font-mono ${priceImpactColor(route.priceImpact)}`}>
                  {route.priceImpact.toFixed(2)}%
                </div>
                <div className="text-[10px] text-muted-foreground">impact</div>
              </div>

              {/* Gas */}
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
