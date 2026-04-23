/**
 * DexAnalytics — HERO/VETS DEX pool stats and volume analytics
 * Fetches live data from DexScreener API via tRPC.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, Droplets, TrendingUp, ArrowUpRight, ArrowDownRight,
  RefreshCw, ExternalLink, Activity,
} from "lucide-react";
import { useMarketOverview, formatPrice, formatCompact, formatChange } from "@/hooks/usePrices";

function PoolRow({ pair, rank }: { pair: any; rank: number }) {
  const change = formatChange(pair.priceChange24h);
  return (
    <a
      href={pair.url || `https://dexscreener.com/${pair.chainId}/${pair.pairAddress}`}
      target="_blank"
      rel="noopener noreferrer"
      className="grid grid-cols-[24px_1fr_100px_100px_80px_60px] gap-3 items-center px-3 py-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors group"
    >
      <span className="text-xs text-muted-foreground font-medium">#{rank}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {pair.baseToken?.symbol || "?"}/{pair.quoteToken?.symbol || "?"}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">
          {pair.dexId || "Unknown DEX"} · {pair.chainId === "pulsechain" ? "PLS" : "BASE"}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs font-medium text-foreground">{formatPrice(pair.priceUsd)}</p>
      </div>
      <div className="text-right">
        <p className="text-xs font-medium text-foreground">
          {formatCompact(pair.liquidity?.usd || pair.liquidity)}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs font-medium text-foreground">
          {formatCompact(pair.volume24h)}
        </p>
      </div>
      <div className="text-right">
        <span className={`text-xs font-medium flex items-center justify-end gap-0.5 ${change.positive ? "text-emerald-400" : "text-amber-400"}`}>
          {change.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {change.text}
        </span>
      </div>
    </a>
  );
}

export default function DexAnalytics() {
  const { data: market, isLoading, refetch, isRefetching } = useMarketOverview();

  const heroPairs = market?.heroLpPairs || [];
  const vetsPairs = market?.vetsLpPairs || [];

  // Sort by liquidity descending
  const sortedHero = [...heroPairs].sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
  const sortedVets = [...vetsPairs].sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));

  const totalHeroVol = heroPairs.reduce((sum, p) => sum + (p.volume24h || 0), 0);
  const totalVetsVol = vetsPairs.reduce((sum, p) => sum + (p.volume24h || 0), 0);
  const totalHeroTxns = heroPairs.reduce((sum, p) => sum + (p.txns24h?.buys || 0) + (p.txns24h?.sells || 0), 0);
  const totalVetsTxns = vetsPairs.reduce((sum, p) => sum + (p.txns24h?.buys || 0) + (p.txns24h?.sells || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[var(--hero-orange)]" />
            DEX Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            HERO &amp; VETS pool stats across all DEXs
            {market?.lastUpdated && (
              <span className="text-xs opacity-60 ml-2">
                · Updated {new Date(market.lastUpdated).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh data"
        >
          <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">HERO Liquidity</p>
            <p className="text-lg font-bold text-foreground">
              {isLoading ? "..." : formatCompact(market?.totalHeroLiquidity)}
            </p>
            <p className="text-[10px] text-muted-foreground">{heroPairs.length} pools</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">HERO 24h Volume</p>
            <p className="text-lg font-bold text-foreground">
              {isLoading ? "..." : formatCompact(totalHeroVol)}
            </p>
            <p className="text-[10px] text-muted-foreground">{totalHeroTxns.toLocaleString()} txns</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">VETS Liquidity</p>
            <p className="text-lg font-bold text-foreground">
              {isLoading ? "..." : formatCompact(market?.totalVetsLiquidity)}
            </p>
            <p className="text-[10px] text-muted-foreground">{vetsPairs.length} pools</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">VETS 24h Volume</p>
            <p className="text-lg font-bold text-foreground">
              {isLoading ? "..." : formatCompact(totalVetsVol)}
            </p>
            <p className="text-[10px] text-muted-foreground">{totalVetsTxns.toLocaleString()} txns</p>
          </CardContent>
        </Card>
      </div>

      {/* HERO Pools */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[var(--hero-orange)]/10 flex items-center justify-center">
              <span className="text-xs font-bold text-[var(--hero-orange)]">H</span>
            </div>
            HERO Pools
            <Badge variant="outline" className="text-[10px] ml-auto">{heroPairs.length} pools</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Table Header */}
          <div className="grid grid-cols-[24px_1fr_100px_100px_80px_60px] gap-3 px-3 py-2 text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border mb-1">
            <span>#</span>
            <span>Pair</span>
            <span className="text-right">Price</span>
            <span className="text-right">Liquidity</span>
            <span className="text-right">24h Vol</span>
            <span className="text-right">24h</span>
          </div>
          <div className="space-y-1">
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground text-sm">Loading pools...</div>
            ) : sortedHero.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">No HERO pools found</div>
            ) : (
              sortedHero.map((pair, i) => <PoolRow key={pair.pairAddress || i} pair={pair} rank={i + 1} />)
            )}
          </div>
        </CardContent>
      </Card>

      {/* VETS Pools */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[var(--hero-green)]/10 flex items-center justify-center">
              <span className="text-xs font-bold text-[var(--hero-green)]">V</span>
            </div>
            VETS Pools
            <Badge variant="outline" className="text-[10px] ml-auto">{vetsPairs.length} pools</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-[24px_1fr_100px_100px_80px_60px] gap-3 px-3 py-2 text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border mb-1">
            <span>#</span>
            <span>Pair</span>
            <span className="text-right">Price</span>
            <span className="text-right">Liquidity</span>
            <span className="text-right">24h Vol</span>
            <span className="text-right">24h</span>
          </div>
          <div className="space-y-1">
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground text-sm">Loading pools...</div>
            ) : sortedVets.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">No VETS pools found</div>
            ) : (
              sortedVets.map((pair, i) => <PoolRow key={pair.pairAddress || i} pair={pair} rank={i + 1} />)
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Source */}
      <p className="text-[10px] text-muted-foreground text-center">
        Data sourced from{" "}
        <a href="https://dexscreener.com" target="_blank" rel="noopener noreferrer" className="text-[var(--hero-orange)] hover:underline">
          DexScreener
        </a>{" "}
        · Auto-refreshes every 30 seconds
      </p>
    </div>
  );
}
