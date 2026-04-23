/**
 * BuyAndBurn — HERO Buy & Burn Tracker page
 * Shows total burned, burn %, circulating supply, and burn progress.
 * Uses existing tRPC endpoint: trpc.prices.buyAndBurn
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Flame, TrendingUp, Coins, BarChart3, RefreshCw,
  ArrowUpRight, Target, Zap,
} from "lucide-react";
import { useBuyAndBurn, formatPrice, formatCompact } from "@/hooks/usePrices";

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toFixed(2);
}

function BurnProgressBar({ percentage }: { percentage: number }) {
  const clampedPct = Math.min(percentage, 100);
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">Burn Progress</span>
        <span className="font-medium text-[var(--hero-orange)]">{clampedPct.toFixed(2)}%</span>
      </div>
      <div className="w-full h-3 rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${clampedPct}%`,
            background: "linear-gradient(90deg, var(--hero-orange), #ef4444)",
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>0%</span>
        <span>100M Total Supply</span>
      </div>
    </div>
  );
}

export default function BuyAndBurn() {
  const { data: burnData, isLoading, refetch, isRefetching } = useBuyAndBurn();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Flame className="w-6 h-6 text-[var(--hero-orange)]" />
            Buy &amp; Burn Tracker
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            HERO token burn stats — deflationary by design
            {burnData?.lastUpdated && (
              <span className="text-xs opacity-60 ml-2">
                · Updated {new Date(burnData.lastUpdated).toLocaleTimeString()}
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

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <Flame className="w-5 h-5 text-red-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-1">Total Burned</p>
            <p className="text-xl font-bold text-foreground">
              {isLoading ? "..." : `${formatNumber(burnData?.totalBurned || 0)} HERO`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isLoading ? "" : formatCompact(burnData?.totalBurnedUsd || 0)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-[var(--hero-orange)]/10">
                <Target className="w-5 h-5 text-[var(--hero-orange)]" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-1">Burn Percentage</p>
            <p className="text-xl font-bold text-foreground">
              {isLoading ? "..." : `${burnData?.burnPercentage || 0}%`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">of 100M total supply</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Coins className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-1">Circulating Supply</p>
            <p className="text-xl font-bold text-foreground">
              {isLoading ? "..." : `${formatNumber(burnData?.circulatingSupply || 0)} HERO`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">tokens in circulation</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-1">HERO Price</p>
            <p className="text-xl font-bold text-foreground">
              {isLoading ? "..." : formatPrice(burnData?.heroPrice)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">current market price</p>
          </CardContent>
        </Card>
      </div>

      {/* Burn Progress */}
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <BurnProgressBar percentage={burnData?.burnPercentage || 0} />
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-[var(--hero-orange)]" />
            How Buy &amp; Burn Works
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-secondary/30">
              <div className="w-8 h-8 rounded-full bg-[var(--hero-orange)]/10 flex items-center justify-center mb-3">
                <span className="text-sm font-bold text-[var(--hero-orange)]">1</span>
              </div>
              <h4 className="text-sm font-medium text-foreground mb-1">Revenue Generated</h4>
              <p className="text-xs text-muted-foreground">
                Fees from HERO ecosystem services (swaps, farms, staking) generate revenue.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/30">
              <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
                <span className="text-sm font-bold text-red-500">2</span>
              </div>
              <h4 className="text-sm font-medium text-foreground mb-1">HERO Bought Back</h4>
              <p className="text-xs text-muted-foreground">
                Revenue is used to buy HERO tokens from the open market, creating buy pressure.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/30">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                <span className="text-sm font-bold text-emerald-500">3</span>
              </div>
              <h4 className="text-sm font-medium text-foreground mb-1">Tokens Burned</h4>
              <p className="text-xs text-muted-foreground">
                Bought HERO tokens are sent to the dead address (0x...dEaD), permanently removing them from supply.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Burn Address */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Burn Addresses</p>
              <div className="space-y-1">
                <a
                  href="https://scan.pulsechain.com/address/0x000000000000000000000000000000000000dEaD"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-[var(--hero-orange)] hover:underline flex items-center gap-1"
                >
                  0x000...dEaD <ArrowUpRight className="w-3 h-3" />
                </a>
                <a
                  href="https://scan.pulsechain.com/address/0x0000000000000000000000000000000000000000"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-[var(--hero-orange)] hover:underline flex items-center gap-1"
                >
                  0x000...0000 <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">Verification</p>
              <p className="text-xs text-emerald-400 flex items-center gap-1 justify-end">
                On-chain verified ✓
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Source */}
      <p className="text-[10px] text-muted-foreground text-center">
        Burn data read directly from PulseChain RPC · Prices from{" "}
        <a href="https://dexscreener.com" target="_blank" rel="noopener noreferrer" className="text-[var(--hero-orange)] hover:underline">
          DexScreener
        </a>{" "}
        · Auto-refreshes every 30 seconds
      </p>
    </div>
  );
}
