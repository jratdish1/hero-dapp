import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Droplets, TrendingUp, TrendingDown, AlertTriangle, ExternalLink,
  RefreshCw, Info, BarChart3, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { useNetwork } from "@/contexts/NetworkContext";
import { useAccount } from "wagmi";

// ─── Types ────────────────────────────────────────────────────────────
interface LPPosition {
  id: string;
  pair: string;
  dex: string;
  chain: "pulsechain" | "base";
  token0: { symbol: string; amount: string; valueUsd: number };
  token1: { symbol: string; amount: string; valueUsd: number };
  lpTokens: string;
  totalValueUsd: number;
  initialValueUsd: number;
  poolShare: string;
  fee24h: string;
  impermanentLoss: number; // percentage, negative = loss
  dexUrl: string;
  pairAddress: string;
}

// ─── Demo Data ────────────────────────────────────────────────────────
const DEMO_LP_PLS: LPPosition[] = [
  {
    id: "pulsex-hero-wpls",
    pair: "HERO/WPLS",
    dex: "PulseX V2",
    chain: "pulsechain",
    token0: { symbol: "HERO", amount: "500,000", valueUsd: 45.0 },
    token1: { symbol: "WPLS", amount: "12,500", valueUsd: 45.0 },
    lpTokens: "2,236.07",
    totalValueUsd: 90.0,
    initialValueUsd: 100.0,
    poolShare: "0.0042%",
    fee24h: "$0.12",
    impermanentLoss: -3.2,
    dexUrl: "https://app.pulsex.com/liquidity",
    pairAddress: "0x1234...abcd",
  },
  {
    id: "pulsex-hero-dai",
    pair: "HERO/DAI",
    dex: "PulseX V2",
    chain: "pulsechain",
    token0: { symbol: "HERO", amount: "250,000", valueUsd: 22.5 },
    token1: { symbol: "DAI", amount: "22.50", valueUsd: 22.5 },
    lpTokens: "1,118.03",
    totalValueUsd: 45.0,
    initialValueUsd: 50.0,
    poolShare: "0.0018%",
    fee24h: "$0.05",
    impermanentLoss: -1.8,
    dexUrl: "https://app.pulsex.com/liquidity",
    pairAddress: "0x5678...efgh",
  },
  {
    id: "pulsex-vets-wpls",
    pair: "VETS/WPLS",
    dex: "PulseX V2",
    chain: "pulsechain",
    token0: { symbol: "VETS", amount: "1,000,000", valueUsd: 5.18 },
    token1: { symbol: "WPLS", amount: "1,440", valueUsd: 5.18 },
    lpTokens: "37,947.33",
    totalValueUsd: 10.36,
    initialValueUsd: 12.0,
    poolShare: "0.0089%",
    fee24h: "$0.02",
    impermanentLoss: -5.1,
    dexUrl: "https://app.pulsex.com/liquidity",
    pairAddress: "0x9abc...ijkl",
  },
  {
    id: "squirrel-hero-wpls",
    pair: "HERO/WPLS",
    dex: "SquirrelSwap",
    chain: "pulsechain",
    token0: { symbol: "HERO", amount: "100,000", valueUsd: 9.0 },
    token1: { symbol: "WPLS", amount: "2,500", valueUsd: 9.0 },
    lpTokens: "500.00",
    totalValueUsd: 18.0,
    initialValueUsd: 20.0,
    poolShare: "0.0015%",
    fee24h: "$0.03",
    impermanentLoss: -2.5,
    dexUrl: "https://squirrelswap.org/liquidity",
    pairAddress: "0xdef0...mnop",
  },
];

const DEMO_LP_BASE: LPPosition[] = [
  {
    id: "aero-hero-weth",
    pair: "HERO/WETH",
    dex: "Aerodrome",
    chain: "base",
    token0: { symbol: "HERO", amount: "200,000", valueUsd: 10.0 },
    token1: { symbol: "WETH", amount: "0.0042", valueUsd: 10.0 },
    lpTokens: "1,414.21",
    totalValueUsd: 20.0,
    initialValueUsd: 22.0,
    poolShare: "0.0031%",
    fee24h: "$0.08",
    impermanentLoss: -4.1,
    dexUrl: "https://aerodrome.finance/liquidity",
    pairAddress: "0xaero...base",
  },
  {
    id: "uniswap-hero-usdc",
    pair: "HERO/USDC",
    dex: "Uniswap V3",
    chain: "base",
    token0: { symbol: "HERO", amount: "150,000", valueUsd: 7.5 },
    token1: { symbol: "USDC", amount: "7.50", valueUsd: 7.5 },
    lpTokens: "NFT #4821",
    totalValueUsd: 15.0,
    initialValueUsd: 15.5,
    poolShare: "0.0012%",
    fee24h: "$0.04",
    impermanentLoss: -0.8,
    dexUrl: "https://app.uniswap.org/pool",
    pairAddress: "0xuni3...base",
  },
];

// ─── IL Calculator ────────────────────────────────────────────────────
function calculateIL(priceRatio: number): number {
  // IL formula: 2*sqrt(r)/(1+r) - 1
  const sqrtR = Math.sqrt(priceRatio);
  return ((2 * sqrtR) / (1 + priceRatio) - 1) * 100;
}

// ─── Component ────────────────────────────────────────────────────────
export default function LPPositionMonitor() {
  const { isPulseChain } = useNetwork();
  const { isConnected } = useAccount();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showILCalc, setShowILCalc] = useState(false);
  const [ilPriceChange, setIlPriceChange] = useState(50); // percentage price change for IL calc

  const positions = useMemo(() => {
    return isPulseChain ? DEMO_LP_PLS : DEMO_LP_BASE;
  }, [isPulseChain]);

  const totalValue = useMemo(() => {
    return positions.reduce((sum, p) => sum + p.totalValueUsd, 0);
  }, [positions]);

  const totalIL = useMemo(() => {
    const totalInitial = positions.reduce((sum, p) => sum + p.initialValueUsd, 0);
    if (totalInitial === 0) return 0;
    return ((totalValue - totalInitial) / totalInitial) * 100;
  }, [positions, totalValue]);

  const totalFees24h = useMemo(() => {
    return positions.reduce((sum, p) => sum + (parseFloat(p.fee24h.replace("$", "")) || 0), 0);
  }, [positions]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 2000);
  };

  const calculatedIL = useMemo(() => {
    return calculateIL(1 + ilPriceChange / 100);
  }, [ilPriceChange]);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
          <CardContent className="p-3 text-center">
            <Droplets className="w-4 h-4 text-blue-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-blue-400">${totalValue.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">Total LP Value</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/10 to-transparent border-red-500/20">
          <CardContent className="p-3 text-center">
            <TrendingDown className="w-4 h-4 text-red-400 mx-auto mb-1" />
            <p className={`text-lg font-bold ${totalIL >= 0 ? "text-[var(--hero-green)]" : "text-red-400"}`}>
              {totalIL >= 0 ? "+" : ""}{totalIL.toFixed(2)}%
            </p>
            <p className="text-[10px] text-muted-foreground">Net IL</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[var(--hero-green)]/10 to-transparent border-[var(--hero-green)]/20">
          <CardContent className="p-3 text-center">
            <BarChart3 className="w-4 h-4 text-[var(--hero-green)] mx-auto mb-1" />
            <p className="text-lg font-bold text-[var(--hero-green)]">${totalFees24h.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">Fees (24h)</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[var(--hero-orange)]/10 to-transparent border-[var(--hero-orange)]/20">
          <CardContent className="p-3 text-center">
            <Droplets className="w-4 h-4 text-[var(--hero-orange)] mx-auto mb-1" />
            <p className="text-lg font-bold text-[var(--hero-orange)]">{positions.length}</p>
            <p className="text-[10px] text-muted-foreground">LP Positions</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowILCalc(!showILCalc)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Info className="w-3 h-3" />
          {showILCalc ? "Hide" : "Show"} IL Calculator
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          aria-label="Refresh LP positions"
          className="text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* IL Calculator */}
      {showILCalc && (
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              Impermanent Loss Calculator
            </h4>
            <p className="text-[11px] text-muted-foreground mb-3">
              If one token's price changes relative to the other, you experience IL. This is the cost of providing liquidity vs. simply holding.
            </p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Price change:</span>
              <input
                type="range"
                min="-90"
                max="500"
                value={ilPriceChange}
                onChange={(e) => setIlPriceChange(Number(e.target.value) || 0)}
                className="flex-1 h-1.5 rounded-full appearance-none bg-border cursor-pointer"
                aria-label="Price change percentage"
              />
              <span className="text-xs font-mono font-bold text-foreground w-14 text-right">
                {ilPriceChange > 0 ? "+" : ""}{ilPriceChange}%
              </span>
            </div>
            <div className="mt-2 p-2 rounded bg-background/50 text-center">
              <span className="text-xs text-muted-foreground">Impermanent Loss: </span>
              <span className={`text-sm font-bold ${calculatedIL < -5 ? "text-red-400" : calculatedIL < -2 ? "text-yellow-400" : "text-[var(--hero-green)]"}`}>
                {calculatedIL.toFixed(2)}%
              </span>
              <p className="text-[10px] text-muted-foreground mt-1">
                {Math.abs(calculatedIL) < 1 ? "Minimal impact" :
                 Math.abs(calculatedIL) < 5 ? "Moderate — fees likely cover this" :
                 "Significant — consider if fees justify the risk"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Not connected warning */}
      {!isConnected && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
          <p className="text-xs text-yellow-500/80">
            Connect wallet to see your real LP positions. Showing demo data.
          </p>
        </div>
      )}

      {/* LP Positions List */}
      <div className="space-y-2">
        {positions.map((pos) => (
          <Card key={pos.id} className="border-border/50 hover:border-blue-500/30 transition-all">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                    <Droplets className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">{pos.pair}</span>
                      <Badge variant="outline" className="text-[9px] py-0 px-1.5">{pos.dex}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{pos.lpTokens} LP</span>
                      <span className="text-[10px] text-muted-foreground">• Pool: {pos.poolShare}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-foreground">${pos.totalValueUsd.toFixed(2)}</p>
                  <div className="flex items-center gap-1 justify-end mt-0.5">
                    {pos.impermanentLoss < 0 ? (
                      <ArrowDownRight className="w-3 h-3 text-red-400" />
                    ) : (
                      <ArrowUpRight className="w-3 h-3 text-[var(--hero-green)]" />
                    )}
                    <span className={`text-[10px] font-medium ${pos.impermanentLoss < 0 ? "text-red-400" : "text-[var(--hero-green)]"}`}>
                      {pos.impermanentLoss > 0 ? "+" : ""}{pos.impermanentLoss.toFixed(1)}% IL
                    </span>
                  </div>
                </div>
              </div>
              {/* Token breakdown */}
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-border/30">
                <div className="text-[10px]">
                  <span className="text-muted-foreground">{pos.token0.symbol}:</span>{" "}
                  <span className="text-foreground font-medium">{pos.token0.amount}</span>{" "}
                  <span className="text-muted-foreground">(${pos.token0.valueUsd.toFixed(2)})</span>
                </div>
                <div className="text-[10px]">
                  <span className="text-muted-foreground">{pos.token1.symbol}:</span>{" "}
                  <span className="text-foreground font-medium">{pos.token1.amount}</span>{" "}
                  <span className="text-muted-foreground">(${pos.token1.valueUsd.toFixed(2)})</span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-muted-foreground">Fees 24h: <span className="text-[var(--hero-green)]">{pos.fee24h}</span></span>
                <a href={pos.dexUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2 text-muted-foreground hover:text-foreground">
                    Manage <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
