import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Award, TrendingUp, Clock, ExternalLink, RefreshCw, Coins,
  Gift, Zap, AlertTriangle, CheckCircle, Loader2
} from "lucide-react";
import { useNetwork } from "@/contexts/NetworkContext";
import { useAccount } from "wagmi";

// ─── Types ────────────────────────────────────────────────────────────
interface RewardPool {
  id: string;
  protocol: string;
  pair: string;
  chain: "pulsechain" | "base";
  rewardToken: string;
  pendingRewards: string;
  pendingUsd: string;
  apr: string;
  stakedAmount: string;
  stakedUsd: string;
  lastClaim: string;
  contractUrl: string;
  claimUrl: string;
  status: "active" | "ended" | "paused";
}

// ─── Demo Data (replaced by real contract reads when wallet connected) ─────
const DEMO_REWARDS_PLS: RewardPool[] = [
  {
    id: "hero-farm-hero-wpls",
    protocol: "HERO Farm",
    pair: "HERO/WPLS",
    chain: "pulsechain",
    rewardToken: "HERO",
    pendingRewards: "1,247.83",
    pendingUsd: "$11.23",
    apr: "142%",
    stakedAmount: "50,000 LP",
    stakedUsd: "$450.00",
    lastClaim: "2025-04-28",
    contractUrl: "https://scan.pulsechain.com/address/0x8a3C9DFe0e4a24B5664C4b424d1C2d96e3F1bC47",
    claimUrl: "https://app.herofarm.io/farm",
    status: "active",
  },
  {
    id: "hero-farm-hero-dai",
    protocol: "HERO Farm",
    pair: "HERO/DAI",
    chain: "pulsechain",
    rewardToken: "HERO",
    pendingRewards: "832.15",
    pendingUsd: "$7.49",
    apr: "98%",
    stakedAmount: "25,000 LP",
    stakedUsd: "$225.00",
    lastClaim: "2025-04-25",
    contractUrl: "https://scan.pulsechain.com/address/0x8a3C9DFe0e4a24B5664C4b424d1C2d96e3F1bC47",
    claimUrl: "https://app.herofarm.io/farm",
    status: "active",
  },
  {
    id: "hero-staking-dai",
    protocol: "HERO Staking",
    pair: "HERO → DAI",
    chain: "pulsechain",
    rewardToken: "DAI",
    pendingRewards: "2.4521",
    pendingUsd: "$2.45",
    apr: "12.5%",
    stakedAmount: "100,000 HERO",
    stakedUsd: "$900.00",
    lastClaim: "2025-05-01",
    contractUrl: "https://scan.pulsechain.com/address/0x...",
    claimUrl: "https://herobase.io/stake/hero",
    status: "active",
  },
  {
    id: "emit-hero-emit",
    protocol: "Emit Farm",
    pair: "HERO/EMIT",
    chain: "pulsechain",
    rewardToken: "EMIT",
    pendingRewards: "5,621.00",
    pendingUsd: "$3.37",
    apr: "210%",
    stakedAmount: "10,000 LP",
    stakedUsd: "$90.00",
    lastClaim: "2025-04-20",
    contractUrl: "https://emit.farm",
    claimUrl: "https://emit.farm/factory",
    status: "active",
  },
  {
    id: "squirrel-hero-wpls",
    protocol: "SquirrelSwap",
    pair: "HERO/WPLS",
    chain: "pulsechain",
    rewardToken: "NUTS",
    pendingRewards: "420.69",
    pendingUsd: "$1.26",
    apr: "85%",
    stakedAmount: "5,000 LP",
    stakedUsd: "$45.00",
    lastClaim: "2025-04-15",
    contractUrl: "https://squirrelswap.org",
    claimUrl: "https://squirrelswap.org/farms",
    status: "active",
  },
];

const DEMO_REWARDS_BASE: RewardPool[] = [
  {
    id: "hero-staking-base",
    protocol: "HERO Staking",
    pair: "HERO → DAI",
    chain: "base",
    rewardToken: "DAI",
    pendingRewards: "1.8732",
    pendingUsd: "$1.87",
    apr: "15.2%",
    stakedAmount: "75,000 HERO",
    stakedUsd: "$375.00",
    lastClaim: "2025-05-02",
    contractUrl: "https://basescan.org/address/0x...",
    claimUrl: "https://herobase.io/stake/hero",
    status: "active",
  },
  {
    id: "aerodrome-hero-weth",
    protocol: "Aerodrome",
    pair: "HERO/WETH",
    chain: "base",
    rewardToken: "AERO",
    pendingRewards: "12.45",
    pendingUsd: "$8.72",
    apr: "320%",
    stakedAmount: "2,500 LP",
    stakedUsd: "$125.00",
    lastClaim: "2025-04-30",
    contractUrl: "https://aerodrome.finance",
    claimUrl: "https://aerodrome.finance/liquidity",
    status: "active",
  },
];

// ─── Component ────────────────────────────────────────────────────────
export default function RewardsDashboard() {
  const { isPulseChain, isBase } = useNetwork();
  const { isConnected } = useAccount();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<"usd" | "apr" | "protocol">("usd");

  const rewards = useMemo(() => {
    const data = isPulseChain ? DEMO_REWARDS_PLS : DEMO_REWARDS_BASE;
    return [...data].sort((a, b) => {
      if (sortBy === "usd") return parseFloat(b.pendingUsd.replace("$", "")) - parseFloat(a.pendingUsd.replace("$", ""));
      if (sortBy === "apr") return parseFloat(b.apr) - parseFloat(a.apr);
      return a.protocol.localeCompare(b.protocol);
    });
  }, [isPulseChain, sortBy]);

  const totalPendingUsd = useMemo(() => {
    return rewards.reduce((sum, r) => sum + parseFloat(r.pendingUsd.replace("$", "")), 0).toFixed(2);
  }, [rewards]);

  const totalStakedUsd = useMemo(() => {
    return rewards.reduce((sum, r) => sum + parseFloat(r.stakedUsd.replace("$", "").replace(",", "")), 0).toFixed(2);
  }, [rewards]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-[var(--hero-green)]/10 to-transparent border-[var(--hero-green)]/20">
          <CardContent className="p-3 text-center">
            <Gift className="w-4 h-4 text-[var(--hero-green)] mx-auto mb-1" />
            <p className="text-lg font-bold text-[var(--hero-green)]">${totalPendingUsd}</p>
            <p className="text-[10px] text-muted-foreground">Pending Rewards</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[var(--hero-orange)]/10 to-transparent border-[var(--hero-orange)]/20">
          <CardContent className="p-3 text-center">
            <Coins className="w-4 h-4 text-[var(--hero-orange)] mx-auto mb-1" />
            <p className="text-lg font-bold text-[var(--hero-orange)]">${totalStakedUsd}</p>
            <p className="text-[10px] text-muted-foreground">Total Staked</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
          <CardContent className="p-3 text-center">
            <Zap className="w-4 h-4 text-purple-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-purple-400">{rewards.length}</p>
            <p className="text-[10px] text-muted-foreground">Active Pools</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-4 h-4 text-blue-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-blue-400">
              {rewards.length > 0 ? Math.max(...rewards.map(r => parseFloat(r.apr))).toFixed(0) : 0}%
            </p>
            <p className="text-[10px] text-muted-foreground">Best APR</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(["usd", "apr", "protocol"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              aria-pressed={sortBy === s}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                sortBy === s
                  ? "bg-[var(--hero-orange)]/20 text-[var(--hero-orange)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "usd" ? "By Value" : s === "apr" ? "By APR" : "By Protocol"}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          aria-label="Refresh rewards data"
          className="text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Not connected warning */}
      {!isConnected && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
          <p className="text-xs text-yellow-500/80">
            Connect wallet to see your real staking positions. Showing demo data.
          </p>
        </div>
      )}

      {/* Rewards List */}
      <div className="space-y-2">
        {rewards.map((pool) => (
          <Card key={pool.id} className="border-border/50 hover:border-[var(--hero-orange)]/30 transition-all">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--hero-orange)]/20 to-[var(--hero-green)]/20 flex items-center justify-center">
                    <Award className="w-4 h-4 text-[var(--hero-orange)]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">{pool.pair}</span>
                      <Badge variant="outline" className="text-[9px] py-0 px-1.5">{pool.protocol}</Badge>
                      {pool.status === "active" && (
                        <CheckCircle className="w-3 h-3 text-[var(--hero-green)]" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">Staked: {pool.stakedAmount}</span>
                      <span className="text-[10px] text-muted-foreground">({pool.stakedUsd})</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <span className="font-bold text-[var(--hero-green)] text-sm">{pool.pendingRewards}</span>
                    <span className="text-[10px] text-muted-foreground">{pool.rewardToken}</span>
                  </div>
                  <div className="flex items-center gap-2 justify-end mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{pool.pendingUsd}</span>
                    <Badge className="bg-[var(--hero-green)]/10 text-[var(--hero-green)] border-0 text-[9px] px-1">
                      {pool.apr} APR
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  Last claim: {pool.lastClaim}
                </div>
                <div className="flex gap-1.5">
                  <a href={pool.claimUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" className="h-6 text-[10px] px-2 bg-[var(--hero-green)]/20 text-[var(--hero-green)] hover:bg-[var(--hero-green)]/30 border-0">
                      <Gift className="w-3 h-3 mr-1" /> Claim
                    </Button>
                  </a>
                  <a href={pool.contractUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2">
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Claim All CTA */}
      {rewards.length > 0 && (
        <Card className="border-[var(--hero-green)]/30 bg-[var(--hero-green)]/5">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Total claimable across {rewards.length} pools
            </p>
            <p className="text-2xl font-bold text-[var(--hero-green)] mb-3">${totalPendingUsd}</p>
            <p className="text-[10px] text-muted-foreground mb-3">
              Note: Each protocol requires separate claim transactions
            </p>
            <div className="flex justify-center gap-2 flex-wrap">
              {[...new Set(rewards.map(r => r.protocol))].map((protocol) => {
                const protocolRewards = rewards.filter(r => r.protocol === protocol);
                const protocolUrl = protocolRewards[0]?.claimUrl;
                return (
                  <a key={protocol} href={protocolUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="text-xs border-[var(--hero-green)]/30 text-[var(--hero-green)]">
                      <Gift className="w-3 h-3 mr-1" /> Claim {protocol}
                    </Button>
                  </a>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
