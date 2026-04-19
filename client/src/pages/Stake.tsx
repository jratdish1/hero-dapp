import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  Sprout,
  TrendingUp,
  Shield,
  Heart,
  Star,
  Zap,
  Info,
  Flame,
  Wallet,
  ArrowUpRight,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FARM_CONTRACTS_PLS,
  FARM_POOLS_PLS,
  FARM_CONTRACTS_BASE,
  FARM_POOLS_BASE,
  CDN_ASSETS,
  LIVE_DAPP_URLS,
  SERVICE_BRANCHES,
  HERO_TOKEN_PLS,
  VETS_TOKEN_PLS,
  HERO_TOKEN_BASE,
  BASE_CHAIN_ID,
  PULSECHAIN_ID,
} from "@shared/tokens";
import { useNetwork } from "@/contexts/NetworkContext";
import { useFarmPools, formatCompact, formatChange } from "@/hooks/usePrices";


// ─── DexScreener Live Data Hook ─────────────────────────────────────────
interface DexPairData {
  pairAddress: string;
  priceUsd: string;
  priceChange: { h24: number; h6: number; h1: number };
  volume: { h24: number; h6: number; h1: number };
  liquidity: { usd: number };
  fdv: number;
  txns: { h24: { buys: number; sells: number } };
}

function useDexScreenerBase(tokenAddress: string) {
  const [pairs, setPairs] = React.useState<Record<string, DexPairData>>({});
  const [loading, setLoading] = React.useState(true);
  const [lastUpdate, setLastUpdate] = React.useState<Date | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
        );
        const data = await res.json();
        if (cancelled) return;
        const basePairs = (data.pairs || []).filter(
          (p: any) => p.chainId === "base"
        );
        const pairMap: Record<string, DexPairData> = {};
        for (const p of basePairs) {
          pairMap[p.pairAddress.toLowerCase()] = {
            pairAddress: p.pairAddress,
            priceUsd: p.priceUsd || "0",
            priceChange: p.priceChange || { h24: 0, h6: 0, h1: 0 },
            volume: p.volume || { h24: 0, h6: 0, h1: 0 },
            liquidity: p.liquidity || { usd: 0 },
            fdv: p.fdv || 0,
            txns: p.txns || { h24: { buys: 0, sells: 0 } },
          };
        }
        setPairs(pairMap);
        setLastUpdate(new Date());
      } catch (err) {
        console.warn("DexScreener fetch failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 30000); // refresh every 30s
        return () => { cancelled = true; clearInterval(interval); };
  }, [tokenAddress]);

  return { pairs, loading, lastUpdate };
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

function formatPriceUsd(s: string): string {
  const n = parseFloat(s);
  if (isNaN(n)) return "$0.00";
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(8)}`;
}

// ─── Types ──────────────────────────────────────────────────────────────
interface FarmPool {
  pair: string;
  token0: string;
  token1: string;
  apr?: string;
  tvl?: string;
  type: "LP" | "Staking" | "LP V2";
  isHeroVets: boolean;
  farmId?: string;
  note?: string;
}

interface PartnerFarm {
  id: string;
  name: string;
  url: string;
  description: string;
  tokenSymbol: string;
  tokenPrice?: string;
  marketCap?: string;
  totalSupply?: string;
  contractAddress: string;
  color: string;
  accentColor: string;
  factoryUrl?: string;
  pools: FarmPool[];
}

// ─── Partner Farm Data (PulseChain only) ────────────────────────────────
const PARTNER_FARMS: PartnerFarm[] = [
  {
    id: "emit",
    name: "Emit Farm",
    url: "https://emit.farm/farms",
    factoryUrl: "https://emit.farm/factory",
    description:
      "Decentralized LP staking on PulseChain with DAO governance, NFT identity, and community-driven farm proposals.",
    tokenSymbol: "EMIT",
    tokenPrice: "$1.06",
    marketCap: "$270,199",
    totalSupply: "254,108",
    contractAddress: "0x32fB5663619A657839A80133994E45c5e5cDf427",
    color: "from-pink-600 to-purple-700",
    accentColor: "#ec4899",
    pools: [
      { pair: "HERO / EMIT", token0: "HERO", token1: "EMIT", type: "LP V2", isHeroVets: true, note: "Earn EMIT rewards" },
      { pair: "HERO / PLS", token0: "HERO", token1: "PLS", type: "LP", isHeroVets: true, note: "High liquidity pair" },
      { pair: "VETS / EMIT", token0: "VETS", token1: "EMIT", type: "LP", isHeroVets: true, tvl: "$1,084", farmId: "47", note: "V.I.C Foundation pool" },
      { pair: "EMIT Staking", token0: "EMIT", token1: "eDAI", apr: "116.99%", type: "Staking", isHeroVets: false, tvl: "$171,715", note: "Single-sided, earn eDAI" },
      { pair: "EMIT / WPLS", token0: "EMIT", token1: "WPLS", apr: "135.14%", type: "LP V2", isHeroVets: false },
      { pair: "EMIT / pHEX", token0: "EMIT", token1: "pHEX", apr: "149.72%", type: "LP V2", isHeroVets: false },
    ],
  },
  {
    id: "rhinofi",
    name: "RhinoFi",
    url: "https://www.rhinofi.win/dapp",
    description:
      "Track rewards, manage LPs, and monitor Charging Cycles. Holder earnings and LP reflections paid in WPLS.",
    tokenSymbol: "RHINO",
    totalSupply: "702,080,855",
    contractAddress: "0x0000000000000000000000000000000000000000",
    color: "from-yellow-500 to-green-600",
    accentColor: "#eab308",
    pools: [
      { pair: "HERO / RHINO", token0: "HERO", token1: "RHINO", type: "LP", isHeroVets: true, note: "Earn RHINO shares + WPLS reflections" },
      { pair: "RHINO / WPLS", token0: "RHINO", token1: "WPLS", type: "LP", isHeroVets: false },
      { pair: "HEX / RHINO", token0: "HEX", token1: "RHINO", type: "LP", isHeroVets: false },
      { pair: "RHINO / PLSX", token0: "RHINO", token1: "PLSX", type: "LP", isHeroVets: false },
      { pair: "RHINO / TruFarm", token0: "RHINO", token1: "TruFarm", type: "LP", isHeroVets: false },
    ],
  },
  {
    id: "trufarms",
    name: "TruFarms",
    url: "https://trufarms.io/farms",
    description:
      "Smarter staking powered by Tru2X. Single-sided staking earns eDAI from volume. Tru2X drives continuous system volume.",
    tokenSymbol: "TruFarm",
    tokenPrice: "$0.715",
    marketCap: "$830,928",
    totalSupply: "1,161,441",
    contractAddress: FARM_CONTRACTS_PLS.truFarmToken,
    color: "from-orange-500 to-amber-600",
    accentColor: "#f97316",
    pools: [
      { pair: "TruFarm / HERO", token0: "TruFarm", token1: "HERO", type: "LP V2", isHeroVets: true, note: "Earn TruFarm rewards" },
      { pair: "TruFarm Staking", token0: "TruFarm", token1: "eDAI", apr: "221.14%", type: "Staking", isHeroVets: false, tvl: "$423,279", note: "Single-sided, earn eDAI" },
      { pair: "TruFarm / WPLS", token0: "TruFarm", token1: "WPLS", apr: "152.97%", type: "LP V2", isHeroVets: false, tvl: "$42,140" },
      { pair: "TruFarm / DAI", token0: "TruFarm", token1: "DAI", apr: "121.04%", type: "LP V2", isHeroVets: false },
      { pair: "TruFarm / EMIT", token0: "TruFarm", token1: "EMIT", type: "LP V2", isHeroVets: false },
      { pair: "TruFarm / RHINO", token0: "TruFarm", token1: "RHINO", type: "LP V2", isHeroVets: false },
    ],
  },
];

// ─── Service Branch Ribbon ──────────────────────────────────────────────
function ServiceBranchRibbon() {
  return (
    <div className="flex overflow-hidden rounded-lg border border-border/30">
      {SERVICE_BRANCHES.map((branch) => (
        <Tooltip key={branch.name}>
          <TooltipTrigger asChild>
            <div
              className="flex-1 h-2 min-w-[30px] transition-all hover:h-4 cursor-pointer"
              style={{ backgroundColor: branch.color }}
            />
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs font-semibold">{branch.name}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

// ─── HERO Staking Pool Card (PulseChain) ────────────────────────────────
function HeroPoolCard({ pool, liveData }: { pool: typeof FARM_POOLS_PLS[number]; liveData?: { tvlUsd: number; volume24h: number; estimatedApr: number; priceChange24h: number } }) {
  const change = formatChange(liveData?.priceChange24h);
  return (
    <Card className="border-[#e8b84b]/30 bg-gradient-to-br from-[#161825] to-[#0d0e14] hover:border-[#e8b84b]/50 transition-all group">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#e8b84b] to-[#c08020] flex items-center justify-center">
              <Sprout className="w-4 h-4 text-foreground" />
            </div>
            <div>
              <h4 className="font-bold text-foreground">{pool.name}</h4>
              <p className="text-[10px] text-muted-foreground">Pool #{pool.id}</p>
            </div>
          </div>
          <Badge className="bg-[#52d98c]/10 text-[#52d98c] border-[#52d98c]/20 text-[10px]">
            Active
          </Badge>
        </div>

        {/* Live TVL / APR / Volume */}
        {liveData && liveData.tvlUsd > 0 ? (
          <div className="grid grid-cols-3 gap-2 mb-3 p-2.5 rounded-lg bg-secondary/30 border border-border/20">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">TVL</p>
              <p className="font-bold text-sm text-foreground">{formatCompact(liveData.tvlUsd)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Fee APR</p>
              <p className="font-bold text-sm text-[var(--hero-green)]">{liveData.estimatedApr.toFixed(1)}%</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">24h Vol</p>
              <p className="font-bold text-sm text-foreground">{formatCompact(liveData.volume24h)}</p>
            </div>
          </div>
        ) : (
          <div className="mb-3 p-2.5 rounded-lg bg-secondary/20 border border-border/10 text-center">
            <p className="text-xs text-muted-foreground animate-pulse">Loading live data...</p>
          </div>
        )}

        {/* 24h Price Change */}
        {liveData && (
          <div className="flex items-center justify-between mb-3 text-sm">
            <span className="text-muted-foreground">24h Change</span>
            <span className={`font-semibold ${change.positive ? 'text-[var(--hero-green)]' : 'text-red-400'}`}>
              {change.text}
            </span>
          </div>
        )}

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">LP Token</span>
            <Tooltip>
              <TooltipTrigger>
                <span className="font-mono text-xs text-foreground">
                  {pool.lpToken.slice(0, 8)}...{pool.lpToken.slice(-6)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-mono text-xs">{pool.lpToken}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Token A</span>
            <span className="text-foreground font-semibold">{pool.token0.symbol}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Token B</span>
            <span className="text-foreground font-semibold">{pool.token1.symbol}</span>
          </div>
        </div>

        <a href={LIVE_DAPP_URLS.stake} target="_blank" rel="noopener noreferrer" className="block mt-4">
          <Button size="sm" className="w-full bg-gradient-to-r from-[#e8b84b]/20 to-[#f0c95c]/25 border border-[#e8b84b]/30 text-[#f0c95c] hover:from-[#e8b84b]/30 hover:to-[#f0c95c]/38 font-semibold tracking-wide">
            <Wallet className="w-3.5 h-3.5 mr-1.5" />
            Stake on HERO Stake
          </Button>
        </a>
      </CardContent>
    </Card>
  );
}

// ─── BASE Pool Card with Live DexScreener Data ─────────────────────────
function BasePoolCard({ pool, liveData }: { pool: typeof FARM_POOLS_BASE[number]; liveData?: DexPairData }) {
  const dexScreenerUrl = `https://dexscreener.com/base/${pool.pairAddress}`;
  const dex = (pool as any).dex || "DEX";
  const change24h = liveData?.priceChange?.h24 ?? 0;
  const isPositive = change24h >= 0;
  return (
    <Card className="border-[#0052FF]/30 bg-gradient-to-br from-[#0a1628] to-[#0d0e14] hover:border-[#0052FF]/50 transition-all group">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0052FF] to-[#3b82f6] flex items-center justify-center">
              <Sprout className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="font-bold text-foreground">{pool.name}</h4>
              <p className="text-[10px] text-muted-foreground">{dex}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {liveData && (
              <span className={`text-xs font-bold ${isPositive ? "text-[#52d98c]" : "text-[#d94040]"}`}>
                {isPositive ? "+" : ""}{change24h.toFixed(2)}%
              </span>
            )}
            <Badge className="bg-[#0052FF]/10 text-[#0052FF] border-[#0052FF]/20 text-[10px]">
              {pool.active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>

        {/* Live Price & Stats */}
        {liveData ? (
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-lg bg-[#0052FF]/5 border border-[#0052FF]/10 p-2 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Price</p>
              <p className="text-sm font-bold text-foreground">{formatPriceUsd(liveData.priceUsd)}</p>
            </div>
            <div className="rounded-lg bg-[#0052FF]/5 border border-[#0052FF]/10 p-2 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Liquidity</p>
              <p className="text-sm font-bold text-foreground">{formatUsd(liveData.liquidity.usd)}</p>
            </div>
            <div className="rounded-lg bg-[#0052FF]/5 border border-[#0052FF]/10 p-2 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Vol 24h</p>
              <p className="text-sm font-bold text-foreground">{formatUsd(liveData.volume.h24)}</p>
            </div>
            <div className="rounded-lg bg-[#0052FF]/5 border border-[#0052FF]/10 p-2 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Txns 24h</p>
              <p className="text-sm font-bold text-foreground">
                <span className="text-[#52d98c]">{liveData.txns.h24.buys}B</span>
                {" / "}
                <span className="text-[#d94040]">{liveData.txns.h24.sells}S</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm mb-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pair Address</span>
              <Tooltip>
                <TooltipTrigger>
                  <span className="font-mono text-xs text-foreground">
                    {pool.pairAddress.slice(0, 8)}...{pool.pairAddress.slice(-6)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-mono text-xs">{pool.pairAddress}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}

        <div className="flex justify-between text-[10px] text-muted-foreground mb-3">
          <span>{pool.token0.symbol} / {pool.token1.symbol}</span>
          {liveData && <span>FDV: {formatUsd(liveData.fdv)}</span>}
        </div>

        <div className="flex gap-2">
          <a href={dexScreenerUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button size="sm" className="w-full bg-gradient-to-r from-[#0052FF]/20 to-[#3b82f6]/25 border border-[#0052FF]/30 text-[#3b82f6] hover:from-[#0052FF]/30 hover:to-[#3b82f6]/38 font-semibold tracking-wide">
              <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
              DexScreener
            </Button>
          </a>
          <a href={`https://basescan.org/address/${pool.pairAddress}`} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button size="sm" variant="outline" className="w-full border-[#0052FF]/30 text-[#0052FF] hover:bg-[#0052FF]/10">
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              BaseScan
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Partner Pool Card ──────────────────────────────────────────────────
function PoolCard({ pool }: { pool: FarmPool }) {
  return (
    <div
      className={`relative rounded-xl border p-4 transition-all hover:scale-[1.01] ${
        pool.isHeroVets
          ? "border-[var(--hero-orange)]/40 bg-[var(--hero-orange)]/5 shadow-[0_0_20px_rgba(255,140,50,0.08)]"
          : "border-border/50 bg-card/50"
      }`}
    >
      {pool.isHeroVets && (
        <div className="absolute -top-2 right-3">
          <Badge className="bg-[var(--hero-orange)] text-foreground text-[9px] px-1.5 py-0 border-0">
            HERO/VETS
          </Badge>
        </div>
      )}
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-bold text-foreground">{pool.pair}</h4>
        <Badge variant="outline" className="text-[10px] py-0">
          {pool.type}
        </Badge>
      </div>
      {pool.apr && (
        <div className="flex items-center gap-1 mb-2">
          <TrendingUp className="w-4 h-4 text-[var(--hero-green)]" />
          <span className="font-bold text-[var(--hero-green)]">{pool.apr}</span>
          <span className="text-xs text-muted-foreground">APR</span>
        </div>
      )}
      <div className="flex gap-4 text-xs text-muted-foreground">
        {pool.tvl && <span>TVL: {pool.tvl}</span>}
        {pool.farmId && <span>Farm ID: {pool.farmId}</span>}
      </div>
      {pool.note && (
        <p className="text-xs text-muted-foreground mt-2 italic">{pool.note}</p>
      )}
    </div>
  );
}

// ─── Partner Farm Tab ───────────────────────────────────────────────────
function StakeTab({ farm }: { farm: PartnerFarm }) {
  const heroVetsPools = farm.pools.filter((p) => p.isHeroVets);
  const otherPools = farm.pools.filter((p) => !p.isHeroVets);

  return (
    <div className="space-y-6">
      {/* Farm header */}
      <Card className={`border-border/30 bg-gradient-to-r ${farm.color} bg-opacity-10 overflow-hidden`}>
        <CardContent className="p-5 relative">
          <div className="absolute inset-0 bg-background/90" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  {farm.name}
                  <Badge
                    className="text-[10px] border-0"
                    style={{
                      backgroundColor: farm.accentColor + "20",
                      color: farm.accentColor,
                    }}
                  >
                    {farm.tokenSymbol}
                  </Badge>
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {farm.description}
                </p>
              </div>
              <a href={farm.url} target="_blank" rel="noopener noreferrer">
                <Button
                  variant="outline"
                  className="border-border/50 hover:border-[var(--hero-orange)]/30"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open {farm.name}
                </Button>
              </a>
              {farm.factoryUrl && (
                <a href={farm.factoryUrl} target="_blank" rel="noopener noreferrer">
                  <Button
                    variant="outline"
                    className="border-border/50 hover:border-pink-500/30 text-pink-400"
                  >
                    <Sprout className="w-4 h-4 mr-2" />
                    Factory
                  </Button>
                </a>
              )}
            </div>

            {/* Token stats */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              {farm.tokenPrice && (
                <div className="rounded-lg bg-secondary/30 p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">
                    Price
                  </p>
                  <p className="font-bold text-foreground">{farm.tokenPrice}</p>
                </div>
              )}
              {farm.marketCap && (
                <div className="rounded-lg bg-secondary/30 p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">
                    Market Cap
                  </p>
                  <p className="font-bold text-foreground">{farm.marketCap}</p>
                </div>
              )}
              {farm.totalSupply && (
                <div className="rounded-lg bg-secondary/30 p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">
                    Supply
                  </p>
                  <p className="font-bold text-foreground">{farm.totalSupply}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HERO/VETS pools first */}
      {heroVetsPools.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-[var(--hero-orange)]" />
            <h3 className="font-semibold text-foreground">$HERO & $VETS Pairs</h3>
            <Badge className="bg-[var(--hero-orange)]/10 text-[var(--hero-orange)] border-[var(--hero-orange)]/20 text-[10px]">Featured</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {heroVetsPools.map((pool) => <PoolCard key={pool.pair} pool={pool} />)}
          </div>
        </div>
      )}

      {otherPools.length > 0 && (
        <div>
          <h3 className="font-semibold text-muted-foreground mb-3 text-sm">Other {farm.name} Pools</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {otherPools.map((pool) => <PoolCard key={pool.pair} pool={pool} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Farm Page ─────────────────────────────────────────────────────
export default function Stake() {
  const [activeTab, setActiveTab] = useState("hero-farm");
  const { chainId, isPulseChain, isBase } = useNetwork();
  const { pairs: baseLiveData, loading: dexLoading, lastUpdate: dexLastUpdate } = useDexScreenerBase(HERO_TOKEN_BASE.address);
  const { data: farmPools } = useFarmPools("pulsechain");
  const { data: basePools } = useFarmPools("base");

  // Map LP pair addresses to live data for quick lookup
  const livePoolMap = new Map<number, { tvlUsd: number; volume24h: number; estimatedApr: number; priceChange24h: number }>();
  if (farmPools) {
    for (const fp of farmPools) {
      livePoolMap.set(fp.poolId, { tvlUsd: fp.tvlUsd, volume24h: fp.volume24h, estimatedApr: fp.estimatedApr, priceChange24h: fp.priceChange24h });
    }
  }

  const allHeroVetsPools = PARTNER_FARMS.flatMap((farm) =>
    farm.pools
      .filter((p) => p.isHeroVets)
      .map((p) => ({ ...p, farmName: farm.name, farmUrl: farm.url, farmColor: farm.color }))
  );

  // Chain-aware contracts and labels
  const contracts = isBase ? FARM_CONTRACTS_BASE : FARM_CONTRACTS_PLS;
  const chainLabel = isBase ? "Base" : "PulseChain";
  const chainColor = isBase ? "#0052FF" : "#52d98c";
  const chainEmoji = isBase ? "🔵" : "⚡";
  const explorerBase = isBase ? "https://basescan.org" : "https://scan.pulsechain.com";

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Midgard.wtf — PulseChain */}
      <div className="w-full bg-black py-2.5 border-b border-[var(--hero-orange)]/30 -mt-6 mb-4 -mx-4 px-4" style={{width: "calc(100% + 2rem)"}}>
        <div className="text-center">
          <a href="https://midgard.wtf/" target="_blank" rel="noopener noreferrer" className="text-[var(--hero-orange)] hover:text-white font-bold text-sm tracking-wider uppercase transition-colors inline-flex items-center gap-2">
            ⚡ MIDGARD.WTF — PulseChain DEX ⚡
          </a>
        </div>
      </div>
      {/* Service Branch Ribbon */}
      <ServiceBranchRibbon />

      {/* Page header with HERO emblem — CHAIN AWARE */}
      <div className="flex items-center gap-4">
        <img
          src={CDN_ASSETS.heroEmblem}
          alt="HERO Emblem"
          className="w-14 h-14 rounded-xl shadow-lg shadow-[#e8b84b]/20"
        />
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            HERO Stake
            <Badge
              className="text-xs ml-2"
              style={{
                backgroundColor: chainColor + "15",
                color: chainColor,
                borderColor: chainColor + "30",
              }}
            >
              {chainEmoji} Live on {chainLabel}
            </Badge>
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {isBase
              ? "Provide liquidity on Base L1 via Uniswap V3 & Aerodrome"
              : "Stake LP tokens, earn rewards, support veterans & first responders"}
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          BASE CHAIN VIEW
          ═══════════════════════════════════════════════════════════════════ */}
      {isBase ? (
        <>
          {/* BASE Stake DApp Banner */}
          <Card className="border-[#0052FF]/30 bg-gradient-to-r from-[#0a1628] to-[#161825] overflow-hidden relative">
            <div
              className="absolute inset-0 opacity-10 bg-cover bg-center"
              style={{ backgroundImage: `url(${CDN_ASSETS.heroBanner})` }}
            />
            <CardContent className="p-6 relative z-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold" style={{
                    background: "linear-gradient(170deg, #ffffff 0%, #93c5fd 25%, #0052FF 55%, #1e3a8a 85%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}>
                    HERO on Base L1
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {FARM_POOLS_BASE.length} active liquidity pairs on Uniswap V3 & Aerodrome
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge variant="outline" className="text-[10px] border-[#0052FF]/20 text-[#0052FF]">
                      <Sprout className="w-3 h-3 mr-1" /> {FARM_POOLS_BASE.length} Pairs
                    </Badge>
                    <Badge variant="outline" className="text-[10px] border-[#d94040]/20 text-[#d94040]">
                      <Flame className="w-3 h-3 mr-1" /> Buy & Burn
                    </Badge>
                    <Badge variant="outline" className="text-[10px] border-[#52d98c]/20 text-[#52d98c]">
                      <Zap className="w-3 h-3 mr-1" /> Aerodrome + Uniswap
                    </Badge>
                  </div>
                </div>
                <a href={`https://dexscreener.com/base/${HERO_TOKEN_BASE.address}`} target="_blank" rel="noopener noreferrer">
                  <Button className="bg-gradient-to-r from-[#0052FF]/20 to-[#3b82f6]/25 border border-[#0052FF]/30 text-[#3b82f6] hover:from-[#0052FF]/30 hover:to-[#3b82f6]/38 font-bold tracking-wider text-base px-8 py-3">
                    <ArrowUpRight className="w-5 h-5 mr-2" />
                    View on DexScreener
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>

          {/* BASE Smart Contract Quick Reference */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="rounded-lg border border-[#0052FF]/20 bg-card/50 p-3 text-center cursor-pointer hover:border-[#0052FF]/40 transition-colors">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">HERO Token</p>
                  <p className="font-mono text-xs text-foreground">{HERO_TOKEN_BASE.address.slice(0, 10)}...</p>
                </div>
              </TooltipTrigger>
              <TooltipContent><p className="font-mono text-xs">{HERO_TOKEN_BASE.address}</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="rounded-lg border border-[#d94040]/20 bg-card/50 p-3 text-center cursor-pointer hover:border-[#d94040]/40 transition-colors">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Buy & Burn</p>
                  <p className="font-mono text-xs text-foreground">{FARM_CONTRACTS_BASE.buyAndBurn.slice(0, 10)}...</p>
                </div>
              </TooltipTrigger>
              <TooltipContent><p className="font-mono text-xs">{FARM_CONTRACTS_BASE.buyAndBurn}</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="rounded-lg border border-[#0052FF]/20 bg-card/50 p-3 text-center cursor-pointer hover:border-[#0052FF]/40 transition-colors">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Aerodrome Router</p>
                  <p className="font-mono text-xs text-foreground">{FARM_CONTRACTS_BASE.aerodromeRouter.slice(0, 10)}...</p>
                </div>
              </TooltipTrigger>
              <TooltipContent><p className="font-mono text-xs">{FARM_CONTRACTS_BASE.aerodromeRouter}</p></TooltipContent>
            </Tooltip>
          </div>

          {/* Mission banner */}
          <Card className="border-[var(--hero-orange)]/20 bg-gradient-to-r from-[var(--hero-orange)]/5 to-[var(--hero-green)]/5">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--hero-orange)] to-[var(--hero-green)] flex items-center justify-center shrink-0">
                  <Heart className="w-6 h-6 text-foreground" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground mb-1">Supporting Veterans & First Responders</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    HERO is now <strong className="text-foreground">multi-chain</strong> — live on both PulseChain and Base L1.
                    Liquidity on Base helps expand the reach of the <strong className="text-foreground">VIC Foundation</strong>,
                    a <strong className="text-foreground">501(c)(3) nonprofit</strong> supporting military veterans and first responders.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {SERVICE_BRANCHES.map((branch) => (
                      <Badge
                        key={branch.name}
                        variant="outline"
                        className="text-[10px] py-0.5"
                        style={{ borderColor: branch.color + "60", color: branch.color }}
                      >
                        {branch.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* BASE Liquidity Pairs */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Info className="w-4 h-4 text-[#0052FF]" />
              <p className="text-sm text-muted-foreground">
                HERO liquidity pairs on Base L1 — Uniswap V3 & Aerodrome
              </p>
              {dexLastUpdate && (
                <span className="ml-auto text-[10px] text-[#52d98c] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#52d98c] animate-pulse" />
                  LIVE — {dexLastUpdate.toLocaleTimeString()}
                </span>
              )}
              {dexLoading && (
                <span className="ml-auto text-[10px] text-muted-foreground animate-pulse">
                  Fetching live data...
                </span>
              )}
            </div>
            {/* Aggregate Stats */}
            {Object.keys(baseLiveData).length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-2">
                <div className="rounded-lg border border-[#0052FF]/20 bg-gradient-to-br from-[#0052FF]/5 to-transparent p-3 text-center">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Total Liquidity</p>
                  <p className="text-lg font-bold text-[#0052FF]">
                    {formatUsd(Object.values(baseLiveData).reduce((sum, p) => sum + (p.liquidity?.usd || 0), 0))}
                  </p>
                </div>
                <div className="rounded-lg border border-[#0052FF]/20 bg-gradient-to-br from-[#0052FF]/5 to-transparent p-3 text-center">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Total Vol 24h</p>
                  <p className="text-lg font-bold text-[#0052FF]">
                    {formatUsd(Object.values(baseLiveData).reduce((sum, p) => sum + (p.volume?.h24 || 0), 0))}
                  </p>
                </div>
                <div className="rounded-lg border border-[#0052FF]/20 bg-gradient-to-br from-[#0052FF]/5 to-transparent p-3 text-center">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Active Pairs</p>
                  <p className="text-lg font-bold text-[#0052FF]">{Object.keys(baseLiveData).length}</p>
                </div>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FARM_POOLS_BASE.map((pool) => (
                <BasePoolCard
                  key={pool.id}
                  pool={pool}
                  liveData={baseLiveData[pool.pairAddress.toLowerCase()]}
                />
              ))}
            </div>
          </div>

          {/* Buy & Burn info */}
          <Card className="border-[#d94040]/20 bg-[#d94040]/5">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <Flame className="w-5 h-5 text-[#d94040]" />
                <h3 className="font-bold text-foreground">Buy & Burn Mechanism</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                HERO uses a deflationary Buy & Burn mechanism on both chains. When the burn period elapses, anyone can trigger the
                <code className="mx-1 px-1.5 py-0.5 rounded bg-secondary text-xs font-mono">buyAndBurn()</code>
                function to buy HERO from the market and burn it permanently, reducing supply.
              </p>
              <div className="flex gap-3 mt-3">
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="text-[10px] font-mono border-[#d94040]/20">
                      PLS: {FARM_CONTRACTS_PLS.buyAndBurn.slice(0, 10)}...
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent><p className="font-mono text-xs">{FARM_CONTRACTS_PLS.buyAndBurn}</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="text-[10px] font-mono border-[#0052FF]/20 bg-[#0052FF]/10 text-[#0052FF]">
                      BASE: {FARM_CONTRACTS_BASE.buyAndBurn.slice(0, 10)}...
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent><p className="font-mono text-xs">{FARM_CONTRACTS_BASE.buyAndBurn}</p></TooltipContent>
                </Tooltip>
              </div>
            </CardContent>
          </Card>

          {/* Quick links */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">Base L1 Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <a href={`https://basescan.org/token/${HERO_TOKEN_BASE.address}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="border-[#0052FF]/30 text-[#0052FF] hover:bg-[#0052FF]/10">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> BaseScan
                </Button>
              </a>
              <a href={`https://dexscreener.com/base/${HERO_TOKEN_BASE.address}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="border-[#0052FF]/30 text-[#0052FF] hover:bg-[#0052FF]/10">
                  <TrendingUp className="w-3.5 h-3.5 mr-1.5" /> DexScreener
                </Button>
              </a>
              <a href="https://app.uniswap.org/swap" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="border-[#0052FF]/30 text-[#0052FF] hover:bg-[#0052FF]/10">
                  <Zap className="w-3.5 h-3.5 mr-1.5" /> Uniswap V3
                </Button>
              </a>
              <a href="https://aerodrome.finance/swap" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="border-[#0052FF]/30 text-[#0052FF] hover:bg-[#0052FF]/10">
                  <Zap className="w-3.5 h-3.5 mr-1.5" /> Aerodrome
                </Button>
              </a>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* ═══════════════════════════════════════════════════════════════
              PULSECHAIN VIEW (original)
              ═══════════════════════════════════════════════════════════════ */}

          {/* Live Stake DApp Banner */}
          <Card className="border-[#e8b84b]/30 bg-gradient-to-r from-[#0d0e14] to-[#161825] overflow-hidden relative">
            <div
              className="absolute inset-0 opacity-10 bg-cover bg-center"
              style={{ backgroundImage: `url(${CDN_ASSETS.heroBanner})` }}
            />
            <CardContent className="p-6 relative z-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold" style={{
                    background: "linear-gradient(170deg, #ffffff 0%, #f5e8b0 25%, #e8b84b 55%, #c08020 85%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}>
                    HERO Stake DApp
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Full staking interface with Zap, Buy & Burn, Leaderboard, AI Chat, and more
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge variant="outline" className="text-[10px] border-[#e8b84b]/20 text-[#e8b84b]">
                      <Sprout className="w-3 h-3 mr-1" /> 2 Active Pools
                    </Badge>
                    <Badge variant="outline" className="text-[10px] border-[#52d98c]/20 text-[#52d98c]">
                      <Flame className="w-3 h-3 mr-1" /> Buy & Burn
                    </Badge>
                    <Badge variant="outline" className="text-[10px] border-[#5b8def]/20 text-[#5b8def]">
                      <Zap className="w-3 h-3 mr-1" /> PLS → LP Zapper
                    </Badge>
                  </div>
                </div>
                <a href={LIVE_DAPP_URLS.stake} target="_blank" rel="noopener noreferrer">
                  <Button className="bg-gradient-to-r from-[#e8b84b]/20 to-[#f0c95c]/25 border border-[#e8b84b]/30 text-[#f0c95c] hover:from-[#e8b84b]/30 hover:to-[#f0c95c]/38 font-bold tracking-wider text-base px-8 py-3">
                    <ArrowUpRight className="w-5 h-5 mr-2" />
                    Launch Stake DApp
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Smart Contract Quick Reference */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="rounded-lg border border-border/30 bg-card/50 p-3 text-center cursor-pointer hover:border-[#e8b84b]/30 transition-colors">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">MasterChef V2</p>
                  <p className="font-mono text-xs text-foreground">{FARM_CONTRACTS_PLS.masterChefV2.slice(0, 8)}...</p>
                </div>
              </TooltipTrigger>
              <TooltipContent><p className="font-mono text-xs">{FARM_CONTRACTS_PLS.masterChefV2}</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="rounded-lg border border-border/30 bg-card/50 p-3 text-center cursor-pointer hover:border-[#d94040]/30 transition-colors">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Buy & Burn</p>
                  <p className="font-mono text-xs text-foreground">{FARM_CONTRACTS_PLS.buyAndBurn.slice(0, 8)}...</p>
                </div>
              </TooltipTrigger>
              <TooltipContent><p className="font-mono text-xs">{FARM_CONTRACTS_PLS.buyAndBurn}</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="rounded-lg border border-border/30 bg-card/50 p-3 text-center cursor-pointer hover:border-[#5b8def]/30 transition-colors">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Zapper</p>
                  <p className="font-mono text-xs text-foreground">{FARM_CONTRACTS_PLS.zapper.slice(0, 8)}...</p>
                </div>
              </TooltipTrigger>
              <TooltipContent><p className="font-mono text-xs">{FARM_CONTRACTS_PLS.zapper}</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="rounded-lg border border-border/30 bg-card/50 p-3 text-center cursor-pointer hover:border-[#52d98c]/30 transition-colors">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">PulseX Router</p>
                  <p className="font-mono text-xs text-foreground">{FARM_CONTRACTS_PLS.pulseXRouter.slice(0, 8)}...</p>
                </div>
              </TooltipTrigger>
              <TooltipContent><p className="font-mono text-xs">{FARM_CONTRACTS_PLS.pulseXRouter}</p></TooltipContent>
            </Tooltip>
          </div>

          {/* Mission banner */}
          <Card className="border-[var(--hero-orange)]/20 bg-gradient-to-r from-[var(--hero-orange)]/5 to-[var(--hero-green)]/5">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--hero-orange)] to-[var(--hero-green)] flex items-center justify-center shrink-0">
                  <Heart className="w-6 h-6 text-foreground" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground mb-1">Supporting Veterans & First Responders</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Our partner stakings are <strong className="text-foreground">benevolent protocols</strong> that
                    support the HERO/VETS community. Through liquidity bonding on PulseChain, they help fund
                    the <strong className="text-foreground">VIC Foundation</strong>, a legitimate{" "}
                    <strong className="text-foreground">501(c)(3) nonprofit organization</strong>{" "}
                    dedicated to military veterans and first responders.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {SERVICE_BRANCHES.map((branch) => (
                      <Badge
                        key={branch.name}
                        variant="outline"
                        className="text-[10px] py-0.5"
                        style={{ borderColor: branch.color + "60", color: branch.color }}
                      >
                        {branch.name}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <a href="https://x.com/hero501c3" target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="border-[var(--hero-orange)]/30 text-[var(--hero-orange)] hover:bg-[var(--hero-orange)]/10">
                        <Shield className="w-3.5 h-3.5 mr-1.5" />
                        @HERO501c3 on X
                      </Button>
                    </a>
                    <a href={LIVE_DAPP_URLS.dao} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="border-[var(--hero-green)]/30 text-[var(--hero-green)] hover:bg-[var(--hero-green)]/10">
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                        HERO DAO
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-secondary/50 border border-border/50 w-full justify-start overflow-x-auto">
              <TabsTrigger value="hero-farm" className="data-[state=active]:bg-[#e8b84b]/10 data-[state=active]:text-[#e8b84b]">
                <Flame className="w-3.5 h-3.5 mr-1.5" />
                HERO Staking
              </TabsTrigger>
              <TabsTrigger value="overview" className="data-[state=active]:bg-[var(--hero-orange)]/10 data-[state=active]:text-[var(--hero-orange)]">
                <Star className="w-3.5 h-3.5 mr-1.5" />
                All HERO/VETS Pools
              </TabsTrigger>
              {PARTNER_FARMS.map((farm) => (
                <TabsTrigger
                  key={farm.id}
                  value={farm.id}
                  className="data-[state=active]:bg-[var(--hero-orange)]/10 data-[state=active]:text-[var(--hero-orange)]"
                >
                  <Sprout className="w-3.5 h-3.5 mr-1.5" />
                  {farm.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* HERO Stake Staking Pools */}
            <TabsContent value="hero-farm" className="mt-6 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Native HERO staking pools on PulseChain via MasterChef V2
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {FARM_POOLS_PLS.map((pool) => (
                  <HeroPoolCard key={pool.id} pool={pool} liveData={livePoolMap.get(pool.id)} />
                ))}
              </div>

              {/* Base chain coming soon */}
              <Card className="border-[#0052FF]/20 bg-[#0052FF]/5">
                <CardContent className="p-5 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-xl">🔵</span>
                    <h3 className="font-bold text-foreground">Base Chain Staking</h3>
                    <Badge className="bg-[#0052FF]/10 text-[#0052FF] border-[#0052FF]/20 text-[10px]">
                      {FARM_POOLS_BASE.length} Active Pairs
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    HERO is live on Base at{" "}
                    <a
                      href={`https://basescan.org/token/${HERO_TOKEN_BASE.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#0052FF] hover:underline font-mono text-xs"
                    >
                      {HERO_TOKEN_BASE.address.slice(0, 10)}...
                    </a>
                    {" "}— switch to BASE to view all pairs.
                  </p>
                  <div className="flex justify-center gap-3 mt-3">
                    <a href={`https://basescan.org/token/${HERO_TOKEN_BASE.address}`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="border-[#0052FF]/30 text-[#0052FF]">
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> BaseScan
                      </Button>
                    </a>
                    <a href={`https://dexscreener.com/base/${HERO_TOKEN_BASE.address}`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="border-[#0052FF]/30 text-[#0052FF]">
                        <TrendingUp className="w-3.5 h-3.5 mr-1.5" /> DexScreener
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>

              {/* Buy & Burn info */}
              <Card className="border-[#d94040]/20 bg-[#d94040]/5">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <Flame className="w-5 h-5 text-[#d94040]" />
                    <h3 className="font-bold text-foreground">Buy & Burn Mechanism</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    HERO uses a deflationary Buy & Burn mechanism. When the burn period elapses, anyone can trigger the
                    <code className="mx-1 px-1.5 py-0.5 rounded bg-secondary text-xs font-mono">buyAndBurn()</code>
                    function to buy HERO from the market and burn it permanently, reducing supply.
                  </p>
                  <div className="flex gap-3 mt-3">
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="outline" className="text-[10px] font-mono border-[#d94040]/20">
                          PLS: {FARM_CONTRACTS_PLS.buyAndBurn.slice(0, 10)}...
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent><p className="font-mono text-xs">{FARM_CONTRACTS_PLS.buyAndBurn}</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="outline" className="text-[10px] font-mono border-[#0052FF]/20">
                          BASE: {FARM_CONTRACTS_BASE.buyAndBurn.slice(0, 10)}...
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent><p className="font-mono text-xs">{FARM_CONTRACTS_BASE.buyAndBurn}</p></TooltipContent>
                    </Tooltip>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Overview - All HERO/VETS pools across partners */}
            <TabsContent value="overview" className="mt-6 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  All $HERO and $VETS staking pairs across partner protocols
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {allHeroVetsPools.map((pool) => (
                  <div
                    key={`${pool.farmName}-${pool.pair}`}
                    className="relative rounded-xl border border-[var(--hero-orange)]/30 bg-[var(--hero-orange)]/5 p-4 hover:border-[var(--hero-orange)]/50 transition-all"
                  >
                    <div className="absolute -top-2.5 left-3">
                      <Badge className={`bg-gradient-to-r ${pool.farmColor} text-foreground text-[10px] px-2 py-0.5 border-0`}>
                        {pool.farmName}
                      </Badge>
                    </div>
                    <div className="mt-2">
                      <h4 className="font-bold text-foreground text-lg">{pool.pair}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px] py-0">{pool.type}</Badge>
                        {pool.farmId && <span className="text-[10px] text-muted-foreground">ID: {pool.farmId}</span>}
                      </div>
                      {pool.apr && (
                        <div className="flex items-center gap-1 mt-2">
                          <TrendingUp className="w-4 h-4 text-[var(--hero-green)]" />
                          <span className="font-bold text-[var(--hero-green)] text-lg">{pool.apr}</span>
                          <span className="text-xs text-muted-foreground">APR</span>
                        </div>
                      )}
                      {pool.tvl && <p className="text-xs text-muted-foreground mt-1">TVL: {pool.tvl}</p>}
                      {pool.note && <p className="text-xs text-muted-foreground mt-2 italic">{pool.note}</p>}
                    </div>
                    <a href={pool.farmUrl} target="_blank" rel="noopener noreferrer" className="mt-3 block">
                      <Button size="sm" variant="outline" className="w-full border-[var(--hero-orange)]/30 text-[var(--hero-orange)] hover:bg-[var(--hero-orange)]/10">
                        <Zap className="w-3.5 h-3.5 mr-1.5" />
                        Stake on {pool.farmName}
                      </Button>
                    </a>
                  </div>
                ))}
              </div>

              <Card className="border-border/50 bg-card/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground">Quick Links to Partner Staking</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  {PARTNER_FARMS.map((farm) => (
                    <a key={farm.id} href={farm.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="border-border/50 hover:border-[var(--hero-orange)]/30">
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                        {farm.name}
                      </Button>
                    </a>
                  ))}
                  <a href="https://emit.farm/factory" target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="border-border/50 hover:border-pink-500/30 text-pink-400">
                      <Sprout className="w-3.5 h-3.5 mr-1.5" />
                      Emit Factory
                    </Button>
                  </a>
                  <a href={LIVE_DAPP_URLS.stake} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" className="bg-gradient-to-r from-[#e8b84b]/20 to-[#f0c95c]/25 border border-[#e8b84b]/30 text-[#f0c95c]">
                      <ArrowUpRight className="w-3.5 h-3.5 mr-1.5" />
                      HERO Stake DApp
                    </Button>
                  </a>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Individual partner staking tabs */}
            {PARTNER_FARMS.map((farm) => (
              <TabsContent key={farm.id} value={farm.id} className="mt-6">
                <StakeTab farm={farm} />
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}
    </div>
  );
}
