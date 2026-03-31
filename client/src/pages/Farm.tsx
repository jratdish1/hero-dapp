import { useState } from "react";
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
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  pools: FarmPool[];
}

const PARTNER_FARMS: PartnerFarm[] = [
  {
    id: "emit",
    name: "Emit Farm",
    url: "https://emit.farm/farms",
    description:
      "Decentralized yield farming on PulseChain with DAO governance, NFT identity, and community-driven farm proposals.",
    tokenSymbol: "EMIT",
    tokenPrice: "$1.06",
    marketCap: "$270,199",
    totalSupply: "254,108",
    contractAddress: "0x32fB5663619A657839A80133994E45c5e5cDf427",
    color: "from-pink-600 to-purple-700",
    accentColor: "#ec4899",
    pools: [
      {
        pair: "HERO / EMIT",
        token0: "HERO",
        token1: "EMIT",
        type: "LP V2",
        isHeroVets: true,
        note: "Earn EMIT rewards",
      },
      {
        pair: "HERO / PLS",
        token0: "HERO",
        token1: "PLS",
        type: "LP",
        isHeroVets: true,
        note: "High liquidity pair",
      },
      {
        pair: "VETS / EMIT",
        token0: "VETS",
        token1: "EMIT",
        type: "LP",
        isHeroVets: true,
        tvl: "$1,084",
        farmId: "47",
        note: "V.I.C Foundation pool",
      },
      {
        pair: "EMIT Staking",
        token0: "EMIT",
        token1: "eDAI",
        apr: "116.99%",
        type: "Staking",
        isHeroVets: false,
        tvl: "$171,715",
        note: "Single-sided, earn eDAI",
      },
      {
        pair: "EMIT / WPLS",
        token0: "EMIT",
        token1: "WPLS",
        apr: "135.14%",
        type: "LP V2",
        isHeroVets: false,
      },
      {
        pair: "EMIT / pHEX",
        token0: "EMIT",
        token1: "pHEX",
        apr: "149.72%",
        type: "LP V2",
        isHeroVets: false,
      },
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
      {
        pair: "HERO / RHINO",
        token0: "HERO",
        token1: "RHINO",
        type: "LP",
        isHeroVets: true,
        note: "Earn RHINO shares + WPLS reflections",
      },
      {
        pair: "RHINO / WPLS",
        token0: "RHINO",
        token1: "WPLS",
        type: "LP",
        isHeroVets: false,
      },
      {
        pair: "HEX / RHINO",
        token0: "HEX",
        token1: "RHINO",
        type: "LP",
        isHeroVets: false,
      },
      {
        pair: "RHINO / PLSX",
        token0: "RHINO",
        token1: "PLSX",
        type: "LP",
        isHeroVets: false,
      },
      {
        pair: "RHINO / TruFarm",
        token0: "RHINO",
        token1: "TruFarm",
        type: "LP",
        isHeroVets: false,
      },
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
    contractAddress: "0xCA942990EF21446Db490532E66992eD1EF76A82b",
    color: "from-orange-500 to-amber-600",
    accentColor: "#f97316",
    pools: [
      {
        pair: "TruFarm / HERO",
        token0: "TruFarm",
        token1: "HERO",
        type: "LP V2",
        isHeroVets: true,
        note: "Earn TruFarm rewards",
      },
      {
        pair: "TruFarm Staking",
        token0: "TruFarm",
        token1: "eDAI",
        apr: "221.14%",
        type: "Staking",
        isHeroVets: false,
        tvl: "$423,279",
        note: "Single-sided, earn eDAI",
      },
      {
        pair: "TruFarm / WPLS",
        token0: "TruFarm",
        token1: "WPLS",
        apr: "152.97%",
        type: "LP V2",
        isHeroVets: false,
        tvl: "$42,140",
      },
      {
        pair: "TruFarm / DAI",
        token0: "TruFarm",
        token1: "DAI",
        apr: "121.04%",
        type: "LP V2",
        isHeroVets: false,
      },
      {
        pair: "TruFarm / EMIT",
        token0: "TruFarm",
        token1: "EMIT",
        type: "LP V2",
        isHeroVets: false,
      },
      {
        pair: "TruFarm / RHINO",
        token0: "TruFarm",
        token1: "RHINO",
        type: "LP V2",
        isHeroVets: false,
      },
    ],
  },
];

function PoolCard({ pool, accentColor }: { pool: FarmPool; accentColor: string }) {
  return (
    <div
      className={`relative rounded-xl border p-4 transition-all hover:scale-[1.01] ${
        pool.isHeroVets
          ? "border-[var(--hero-orange)]/40 bg-[var(--hero-orange)]/5 shadow-[0_0_20px_rgba(255,140,50,0.08)]"
          : "border-border/50 bg-card/50"
      }`}
    >
      {pool.isHeroVets && (
        <div className="absolute -top-2.5 left-3">
          <Badge className="bg-gradient-to-r from-[var(--hero-orange)] to-[var(--hero-green)] text-white text-[10px] px-2 py-0.5 border-0">
            <Star className="w-3 h-3 mr-1" />
            HERO/VETS
          </Badge>
        </div>
      )}

      <div className="flex items-center justify-between mt-1">
        <div>
          <h4 className="font-semibold text-foreground">{pool.pair}</h4>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-[10px] py-0">
              {pool.type}
            </Badge>
            {pool.farmId && (
              <span className="text-[10px] text-muted-foreground">
                ID: {pool.farmId}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          {pool.apr && (
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-[var(--hero-green)]" />
              <span className="font-bold text-[var(--hero-green)]">{pool.apr}</span>
            </div>
          )}
          {pool.tvl && (
            <p className="text-xs text-muted-foreground mt-0.5">TVL: {pool.tvl}</p>
          )}
        </div>
      </div>
      {pool.note && (
        <p className="text-xs text-muted-foreground mt-2 italic">{pool.note}</p>
      )}
    </div>
  );
}

function FarmTab({ farm }: { farm: PartnerFarm }) {
  const heroVetsPools = farm.pools.filter((p) => p.isHeroVets);
  const otherPools = farm.pools.filter((p) => !p.isHeroVets);

  return (
    <div className="space-y-6">
      {/* Farm header */}
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`w-10 h-10 rounded-lg bg-gradient-to-br ${farm.color} flex items-center justify-center`}
                >
                  <Sprout className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">{farm.name}</h3>
                  <p className="text-xs text-muted-foreground">{farm.tokenSymbol} Token</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {farm.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {farm.tokenPrice && (
                <div className="text-center px-3 py-1.5 rounded-lg bg-secondary/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Price</p>
                  <p className="font-semibold text-sm text-foreground">{farm.tokenPrice}</p>
                </div>
              )}
              {farm.marketCap && (
                <div className="text-center px-3 py-1.5 rounded-lg bg-secondary/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">MCap</p>
                  <p className="font-semibold text-sm text-foreground">{farm.marketCap}</p>
                </div>
              )}
              {farm.totalSupply && (
                <div className="text-center px-3 py-1.5 rounded-lg bg-secondary/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Supply</p>
                  <p className="font-semibold text-sm text-foreground">{farm.totalSupply}</p>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <a href={farm.url} target="_blank" rel="noopener noreferrer">
              <Button
                size="sm"
                className="bg-gradient-to-r from-[var(--hero-orange)] to-[var(--hero-green)] text-white border-0 hover:opacity-90"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Open {farm.name}
              </Button>
            </a>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {farm.contractAddress.slice(0, 10)}...{farm.contractAddress.slice(-6)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-mono text-xs">{farm.contractAddress}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>

      {/* HERO/VETS Pairs - Highlighted */}
      {heroVetsPools.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-[var(--hero-orange)]" />
            <h3 className="font-semibold text-foreground">
              $HERO & $VETS Pairs
            </h3>
            <Badge className="bg-[var(--hero-orange)]/10 text-[var(--hero-orange)] border-[var(--hero-orange)]/20 text-[10px]">
              Featured
            </Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {heroVetsPools.map((pool) => (
              <PoolCard key={pool.pair} pool={pool} accentColor={farm.accentColor} />
            ))}
          </div>
        </div>
      )}

      {/* Other pools */}
      {otherPools.length > 0 && (
        <div>
          <h3 className="font-semibold text-muted-foreground mb-3 text-sm">
            Other {farm.name} Pools
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {otherPools.map((pool) => (
              <PoolCard key={pool.pair} pool={pool} accentColor={farm.accentColor} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Farm() {
  const [activeTab, setActiveTab] = useState("overview");

  const allHeroVetsPools = PARTNER_FARMS.flatMap((farm) =>
    farm.pools
      .filter((p) => p.isHeroVets)
      .map((p) => ({ ...p, farmName: farm.name, farmUrl: farm.url, farmColor: farm.color }))
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Sprout className="w-6 h-6 text-[var(--hero-green)]" />
          HERO Farm
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Yield farming across PulseChain partner protocols
        </p>
      </div>

      {/* Mission banner */}
      <Card className="border-[var(--hero-orange)]/20 bg-gradient-to-r from-[var(--hero-orange)]/5 to-[var(--hero-green)]/5">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--hero-orange)] to-[var(--hero-green)] flex items-center justify-center shrink-0">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-foreground mb-1">
                Supporting Veterans & First Responders
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Our partner farms are <strong className="text-foreground">benevolent protocols</strong> that
                support the HERO/VETS community. Through liquidity bonding on PulseChain, they help fund
                the <strong className="text-foreground">VIC Foundation</strong>, a legitimate{" "}
                <strong className="text-foreground">501(c)(3) nonprofit organization</strong>{" "}
                dedicated to military veterans and first responders.
              </p>
              <div className="flex items-center gap-3 mt-3">
                <a
                  href="https://x.com/hero501c3"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" variant="outline" className="border-[var(--hero-orange)]/30 text-[var(--hero-orange)] hover:bg-[var(--hero-orange)]/10">
                    <Shield className="w-3.5 h-3.5 mr-1.5" />
                    @HERO501c3 on X
                  </Button>
                </a>
                <a
                  href="/ai"
                >
                  <Button size="sm" variant="outline" className="border-[var(--hero-green)]/30 text-[var(--hero-green)] hover:bg-[var(--hero-green)]/10">
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    HERO AI Assistant
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
          <TabsTrigger value="overview" className="data-[state=active]:bg-[var(--hero-orange)]/10 data-[state=active]:text-[var(--hero-orange)]">
            <Star className="w-3.5 h-3.5 mr-1.5" />
            HERO/VETS Pools
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

        {/* Overview - All HERO/VETS pools */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              All $HERO and $VETS farming pairs across our partner protocols
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allHeroVetsPools.map((pool) => (
              <div
                key={`${pool.farmName}-${pool.pair}`}
                className="relative rounded-xl border border-[var(--hero-orange)]/30 bg-[var(--hero-orange)]/5 p-4 hover:border-[var(--hero-orange)]/50 transition-all"
              >
                <div className="absolute -top-2.5 left-3">
                  <Badge
                    className={`bg-gradient-to-r ${pool.farmColor} text-white text-[10px] px-2 py-0.5 border-0`}
                  >
                    {pool.farmName}
                  </Badge>
                </div>
                <div className="mt-2">
                  <h4 className="font-bold text-foreground text-lg">{pool.pair}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] py-0">
                      {pool.type}
                    </Badge>
                    {pool.farmId && (
                      <span className="text-[10px] text-muted-foreground">
                        ID: {pool.farmId}
                      </span>
                    )}
                  </div>
                  {pool.apr && (
                    <div className="flex items-center gap-1 mt-2">
                      <TrendingUp className="w-4 h-4 text-[var(--hero-green)]" />
                      <span className="font-bold text-[var(--hero-green)] text-lg">
                        {pool.apr}
                      </span>
                      <span className="text-xs text-muted-foreground">APR</span>
                    </div>
                  )}
                  {pool.tvl && (
                    <p className="text-xs text-muted-foreground mt-1">TVL: {pool.tvl}</p>
                  )}
                  {pool.note && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      {pool.note}
                    </p>
                  )}
                </div>
                <a
                  href={pool.farmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 block"
                >
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-[var(--hero-orange)]/30 text-[var(--hero-orange)] hover:bg-[var(--hero-orange)]/10"
                  >
                    <Zap className="w-3.5 h-3.5 mr-1.5" />
                    Farm on {pool.farmName}
                  </Button>
                </a>
              </div>
            ))}
          </div>

          {/* Quick links to all farms */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">
                Quick Links to Partner Farms
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {PARTNER_FARMS.map((farm) => (
                <a
                  key={farm.id}
                  href={farm.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border/50 hover:border-[var(--hero-orange)]/30"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    {farm.name}
                  </Button>
                </a>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Individual farm tabs */}
        {PARTNER_FARMS.map((farm) => (
          <TabsContent key={farm.id} value={farm.id} className="mt-6">
            <FarmTab farm={farm} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
