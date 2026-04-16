import { useState } from "react";
import { useNetwork } from "@/contexts/NetworkContext";
import { useBuyAndBurn, formatPrice, formatCompact } from "@/hooks/usePrices";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowRight, ArrowDown, Repeat, Flame, TrendingUp, Shield,
  Coins, Zap, ExternalLink, CircleDollarSign, Users, Target,
  ChevronRight, Infinity, Rocket, Lock
} from "lucide-react";
import {
  FARM_CONTRACTS_PLS, FARM_CONTRACTS_BASE, FARM_POOLS_PLS,
  HERO_TOKEN_PLS, VETS_TOKEN_PLS, SERVICE_BRANCHES,
} from "@shared/tokens";

// ─── Flywheel Step Component ─────────────────────────────────────────────
function FlywheelStep({ step, title, description, icon: Icon, color, isLast }: {
  step: number; title: string; description: string; icon: any; color: string; isLast?: boolean;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex flex-col items-center">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-black font-bold text-lg ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
        {!isLast && <div className="w-0.5 h-16 bg-gradient-to-b from-orange-500/60 to-transparent mt-2" />}
      </div>
      <div className="flex-1 pb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-orange-400 font-mono">STEP {step}</span>
        </div>
        <h4 className="text-foreground font-semibold text-lg">{title}</h4>
        <p className="text-muted-foreground text-sm mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

// ─── Revenue Stream Card ─────────────────────────────────────────────────
function RevenueCard({ title, description, icon: Icon, badge, link, linkText }: {
  title: string; description: string; icon: any; badge: string; link?: string; linkText?: string;
}) {
  return (
    <Card className="bg-card/60 border-border hover:border-orange-500/30 transition-all">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-orange-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-foreground font-semibold text-sm">{title}</h4>
              <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-400">{badge}</Badge>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-orange-400 text-xs mt-2 hover:text-orange-300 transition-colors">
                {linkText || "Learn More"} <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Tokenomics() {
  const { chain } = useNetwork();
  const [activeTab, setActiveTab] = useState("flywheel");
  const { data: burnData, isLoading: burnLoading } = useBuyAndBurn();

  return (
    <div className="space-y-6">
      {/* ── Service Branch Ribbon ─────────────────────────────────────── */}
      <div className="flex gap-0 h-1.5 rounded-full overflow-hidden">
        {SERVICE_BRANCHES.map((b) => (
          <div key={b.name} className="flex-1" style={{ backgroundColor: b.color }} title={b.name} />
        ))}
      </div>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="text-center space-y-3">
        <Badge variant="outline" className="border-orange-500/40 text-orange-400">
          <Infinity className="w-3 h-3 mr-1" /> Closed-Loop Economics
        </Badge>
        <h1 className="text-3xl font-bold text-foreground">
          HERO <span className="text-orange-400">Tokenomics</span>
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          A self-sustaining deflationary flywheel that creates continuous buy pressure, 
          funds the treasury, and rewards holders — all without stressing the protocol.
        </p>
        <div className="flex justify-center gap-3">
          <a href="https://docs.vicfoundation.com/" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="border-border text-muted-foreground hover:text-foreground">
              <ExternalLink className="w-3 h-3 mr-1" /> Whitepaper
            </Button>
          </a>
          <a href="https://dashboard.vicfoundation.com/" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="border-border text-muted-foreground hover:text-foreground">
              <TrendingUp className="w-3 h-3 mr-1" /> Live Dashboard
            </Button>
          </a>
        </div>
      </div>

      {/* ── Quick Stats (Live from on-chain) ────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card/60 border-border">
          <CardContent className="p-4 text-center">
            <Flame className="w-5 h-5 mx-auto mb-2 text-red-400" />
            <p className="text-foreground font-semibold text-sm">
              {burnLoading ? <span className="animate-pulse">Loading...</span> : `${burnData?.totalBurned.toLocaleString("en-US", { maximumFractionDigits: 0 })} HERO`}
            </p>
            <p className="text-muted-foreground/70 text-xs">Total Burned</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border">
          <CardContent className="p-4 text-center">
            <Zap className="w-5 h-5 mx-auto mb-2 text-orange-400" />
            <p className="text-foreground font-semibold text-sm">
              {burnLoading ? <span className="animate-pulse">Loading...</span> : `${burnData?.burnPercentage}% Supply`}
            </p>
            <p className="text-muted-foreground/70 text-xs">Burn Rate</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border">
          <CardContent className="p-4 text-center">
            <CircleDollarSign className="w-5 h-5 mx-auto mb-2 text-green-400" />
            <p className="text-foreground font-semibold text-sm">
              {burnLoading ? <span className="animate-pulse">Loading...</span> : formatCompact(burnData?.totalBurnedUsd || 0)}
            </p>
            <p className="text-muted-foreground/70 text-xs">Burned Value (USD)</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border">
          <CardContent className="p-4 text-center">
            <Coins className="w-5 h-5 mx-auto mb-2 text-blue-400" />
            <p className="text-foreground font-semibold text-sm">
              {burnLoading ? <span className="animate-pulse">Loading...</span> : `${(burnData?.circulatingSupply || 100000000).toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
            </p>
            <p className="text-muted-foreground/70 text-xs">Circulating Supply</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Tabs ─────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-card border border-border w-full justify-start">
          <TabsTrigger value="flywheel" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
            <Repeat className="w-4 h-4 mr-1" /> The Flywheel
          </TabsTrigger>
          <TabsTrigger value="revenue" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
            <TrendingUp className="w-4 h-4 mr-1" /> Revenue Streams
          </TabsTrigger>
          <TabsTrigger value="burn" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
            <Flame className="w-4 h-4 mr-1" /> Buy & Burn
          </TabsTrigger>
          <TabsTrigger value="contracts" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
            <Shield className="w-4 h-4 mr-1" /> Contracts
          </TabsTrigger>
        </TabsList>

        {/* ── FLYWHEEL TAB ──────────────────────────────────────────── */}
        <TabsContent value="flywheel" className="mt-4 space-y-6">
          {/* Tokenomics Animated Video Loop */}
          <Card className="bg-card/60 border-border overflow-hidden">
            <CardContent className="p-0">
              <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
                <video
                  src="/tokenomics_video.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                  style={{ animation: 'none' }}
                />
                <div className="absolute bottom-2 right-2">
                  <Badge className="bg-black/70 text-orange-400 border-orange-500/30 text-[10px]">HERO Tokenomics Flywheel</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Flywheel Diagram */}
          <Card className="bg-card/40 border-border overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-green-500/5" />
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Infinity className="w-5 h-5 text-orange-400" />
                The Infinite Money Printer
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                A closed-loop system where every step feeds the next, creating perpetual buy pressure for $HERO
              </CardDescription>
            </CardHeader>
            <CardContent className="relative">
              <div className="grid md:grid-cols-2 gap-8">
                {/* Left: Step-by-step flow */}
                <div>
                  <FlywheelStep
                    step={1}
                    title="Provide Liquidity"
                    description="Users add HERO + partner token (EMIT, TruFarm, PLS) to LP pools on PulseChain DEXs. This deepens liquidity and earns LP tokens."
                    icon={Coins}
                    color="bg-orange-400"
                  />
                  <FlywheelStep
                    step={2}
                    title="Stake LP Tokens"
                    description="Stake LP tokens in partner farms (Emit Farm, TruFarms, RhinoFi). Earn native reward tokens (EMIT, TruFarm, RHINO) as yield."
                    icon={Lock}
                    color="bg-yellow-400"
                  />
                  <FlywheelStep
                    step={3}
                    title="Single-Sided Staking"
                    description="Stake earned native tokens (EMIT, TruFarm) in their respective single-sided staking pools. These pools reward you with DAI (≈$1 stablecoin)."
                    icon={CircleDollarSign}
                    color="bg-green-400"
                  />
                  <FlywheelStep
                    step={4}
                    title="DAI → Buy HERO"
                    description="Use DAI rewards to buy $HERO from the market. This creates continuous buy pressure WITHOUT selling any protocol tokens. The protocol stays healthy."
                    icon={TrendingUp}
                    color="bg-blue-400"
                  />
                  <FlywheelStep
                    step={5}
                    title="Treasury Grows"
                    description="Treasury accumulates HERO through continuous buys. Buy & Burn mechanism permanently removes HERO from supply, making each remaining token more valuable."
                    icon={Flame}
                    color="bg-red-400"
                    isLast
                  />
                </div>

                {/* Right: Visual flywheel */}
                <div className="flex items-center justify-center">
                  <div className="relative w-72 h-72">
                    {/* Center */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center shadow-lg shadow-orange-500/20 animate-pulse">
                        <span className="text-foreground font-bold text-lg">$HERO</span>
                      </div>
                    </div>
                    {/* Orbit items */}
                    {[
                      { label: "LP", angle: 0, color: "bg-orange-500" },
                      { label: "Farm", angle: 72, color: "bg-yellow-500" },
                      { label: "Stake", angle: 144, color: "bg-green-500" },
                      { label: "DAI", angle: 216, color: "bg-blue-500" },
                      { label: "Burn", angle: 288, color: "bg-red-500" },
                    ].map((item) => {
                      const rad = (item.angle * Math.PI) / 180;
                      const x = 50 + 38 * Math.cos(rad);
                      const y = 50 + 38 * Math.sin(rad);
                      return (
                        <div
                          key={item.label}
                          className={`absolute w-14 h-14 rounded-full ${item.color} flex items-center justify-center text-foreground text-xs font-bold shadow-lg`}
                          style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}
                        >
                          {item.label}
                        </div>
                      );
                    })}
                    {/* Rotating ring */}
                    <div className="absolute inset-4 rounded-full border-2 border-dashed border-orange-500/30 animate-spin" style={{ animationDuration: "20s" }} />
                    <div className="absolute inset-8 rounded-full border border-orange-500/10" />
                  </div>
                </div>
              </div>

              {/* Key insight box */}
              <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <Rocket className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-green-400 font-semibold text-sm">Why This Works</h4>
                    <p className="text-muted-foreground text-sm mt-1">
                      The key insight is that <strong className="text-foreground">DAI rewards come from external protocol fees</strong> — not from selling HERO. 
                      This means every cycle adds buy pressure without any corresponding sell pressure. 
                      Combined with Buy & Burn deflation, the supply shrinks while demand grows. 
                      Even a small holder benefits from this compounding effect over time.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Flywheel paths */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground text-base flex items-center gap-2">
                  <img src="https://emit.farm/favicon.ico" alt="Emit Farm" className="w-5 h-5 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  Emit Farm Path
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  "HERO/EMIT LP → Stake on Emit Farm",
                  "Earn EMIT rewards",
                  "Single-side stake EMIT → Earn DAI",
                  "DAI → Buy HERO → Treasury",
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 text-xs font-bold">{i + 1}</div>
                    <span className="text-muted-foreground text-sm">{step}</span>
                    {i < 3 && <ArrowRight className="w-3 h-3 text-muted-foreground/50 ml-auto" />}
                  </div>
                ))}
                <a href="https://emit.farm/" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-orange-400 text-xs mt-2 hover:text-orange-300">
                  Visit Emit Farm <ExternalLink className="w-3 h-3" />
                </a>
              </CardContent>
            </Card>

            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground text-base flex items-center gap-2">
                  <img src="https://trufarms.io/favicon.ico" alt="TruFarms" className="w-5 h-5 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  TruFarm Path
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  "HERO/TruFarm LP → Stake on TruFarms",
                  "Earn TruFarm rewards",
                  "Single-side stake TruFarm → Earn DAI",
                  "DAI → Buy HERO → Treasury",
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 text-xs font-bold">{i + 1}</div>
                    <span className="text-muted-foreground text-sm">{step}</span>
                    {i < 3 && <ArrowRight className="w-3 h-3 text-muted-foreground/50 ml-auto" />}
                  </div>
                ))}
                <a href="https://trufarms.io/" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-orange-400 text-xs mt-2 hover:text-orange-300">
                  Visit TruFarms <ExternalLink className="w-3 h-3" />
                </a>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── REVENUE STREAMS TAB ───────────────────────────────────── */}
        <TabsContent value="revenue" className="mt-4 space-y-6">
          <Card className="bg-card/40 border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Multiple Revenue Streams
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                The HERO protocol doesn't rely on a single income source. Multiple external revenue streams 
                ensure the protocol stays in the black — consistently high and to the right.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <RevenueCard
                  title="LP Farming Yields"
                  description="HERO/EMIT, HERO/PLS, HERO/TruFarm, and VETS/EMIT LP pairs earn native token rewards from partner farms. These rewards are converted to DAI and used to buy HERO."
                  icon={Coins}
                  badge="Active"
                  link="https://emit.farm/"
                  linkText="Emit Farm"
                />
                <RevenueCard
                  title="TruDefi 2X Protocol"
                  description="Community integration amplifier that brings additional external revenue into the protocol through DeFi service fee sharing. No token purchase required — pure revenue."
                  icon={Zap}
                  badge="Active"
                  link="https://double.trudefi.io/"
                  linkText="TruDefi 2X"
                />
                <RevenueCard
                  title="Buy & Burn Mechanism"
                  description="Automated deflationary mechanism. When the burn period elapses, anyone can trigger buyAndBurn() to buy HERO from the market and burn it permanently."
                  icon={Flame}
                  badge="Active"
                />
                <RevenueCard
                  title="Single-Sided Staking → DAI"
                  description="Stake earned EMIT or TruFarm tokens in single-sided pools that reward DAI (≈$1 stablecoin). This DAI funds treasury buys without selling any HERO."
                  icon={CircleDollarSign}
                  badge="Active"
                />
                <RevenueCard
                  title="NFT Collection Revenue"
                  description="1,000-piece military/first responder NFT collection with utility. Mint revenue flows to treasury. Holding NFTs reduces buy/sell fees."
                  icon={Shield}
                  badge="Coming Soon"
                />
                <RevenueCard
                  title="Additional External Streams"
                  description="Multiple external revenue streams being onboarded to ensure the protocol never relies on a single source. Diversification is key to long-term sustainability."
                  icon={Target}
                  badge="In Progress"
                />
              </div>
            </CardContent>
          </Card>

          {/* Revenue flow diagram */}
          <Card className="bg-card/60 border-border">
            <CardHeader>
              <CardTitle className="text-foreground text-base">Revenue Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-3">
                <div className="grid grid-cols-3 gap-4 w-full max-w-lg">
                  {["LP Yields", "TruDefi 2X", "NFT Sales"].map((src) => (
                    <div key={src} className="bg-secondary rounded-lg p-3 text-center">
                      <p className="text-muted-foreground text-xs font-medium">{src}</p>
                    </div>
                  ))}
                </div>
                <ArrowDown className="w-5 h-5 text-orange-400" />
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 text-center max-w-xs">
                  <p className="text-orange-400 font-semibold text-sm">HERO Treasury</p>
                  <p className="text-muted-foreground text-xs mt-1">Accumulates DAI + HERO</p>
                </div>
                <div className="flex gap-8">
                  <div className="flex flex-col items-center gap-2">
                    <ArrowDown className="w-4 h-4 text-green-400" />
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                      <p className="text-green-400 text-xs font-semibold">Buy HERO</p>
                      <p className="text-muted-foreground/70 text-[10px]">Buy pressure</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <ArrowDown className="w-4 h-4 text-red-400" />
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
                      <p className="text-red-400 text-xs font-semibold">Burn HERO</p>
                      <p className="text-muted-foreground/70 text-[10px]">Reduce supply</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── BUY & BURN TAB ────────────────────────────────────────── */}
        <TabsContent value="burn" className="mt-4 space-y-4">
          <Card className="bg-card/40 border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Flame className="w-5 h-5 text-red-400" />
                Buy & Burn Mechanism
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                HERO uses a deflationary Buy & Burn mechanism. When the burn period elapses, 
                anyone can trigger the buyAndBurn() function to buy HERO from the market and burn it permanently.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-secondary/50 rounded-lg p-4">
                  <h4 className="text-orange-400 font-semibold text-sm mb-3">PulseChain</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Contract</span>
                      <code className="text-muted-foreground text-xs">{FARM_CONTRACTS_PLS.buyAndBurn.slice(0, 10)}...{FARM_CONTRACTS_PLS.buyAndBurn.slice(-6)}</code>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Burned</span>
                      <span className="text-red-400 font-semibold">
                        {burnLoading ? "Loading..." : `${burnData?.totalBurned.toLocaleString("en-US", { maximumFractionDigits: 2 })} HERO`}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Burn %</span>
                      <span className="text-orange-400 font-semibold">
                        {burnLoading ? "Loading..." : `${burnData?.burnPercentage}% of supply`}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Burned USD Value</span>
                      <span className="text-green-400">
                        {burnLoading ? "Loading..." : formatCompact(burnData?.totalBurnedUsd || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">HERO Price</span>
                      <span className="text-foreground">
                        {burnLoading ? "Loading..." : formatPrice(burnData?.heroPrice)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Circulating Supply</span>
                      <span className="text-muted-foreground">
                        {burnLoading ? "Loading..." : `${burnData?.circulatingSupply.toLocaleString("en-US", { maximumFractionDigits: 0 })} HERO`}
                      </span>
                    </div>
                  </div>
                  <a href={`https://scan.pulsechain.com/address/${FARM_CONTRACTS_PLS.buyAndBurn}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-orange-400 text-xs mt-3 hover:text-orange-300">
                    View on PulseScan <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="bg-secondary/50 rounded-lg p-4">
                  <h4 className="text-blue-400 font-semibold text-sm mb-3">Base Chain</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Contract</span>
                      <code className="text-muted-foreground text-xs">{FARM_CONTRACTS_BASE.buyAndBurn.slice(0, 10)}...{FARM_CONTRACTS_BASE.buyAndBurn.slice(-6)}</code>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-400">Deployed</Badge>
                    </div>
                  </div>
                  <a href={`https://basescan.org/address/${FARM_CONTRACTS_BASE.buyAndBurn}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 text-xs mt-3 hover:text-blue-300">
                    View on BaseScan <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* How it works */}
              <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                <h4 className="text-red-400 font-semibold text-sm mb-2">How Buy & Burn Works</h4>
                <div className="grid md:grid-cols-3 gap-3">
                  {[
                    { step: "1", text: "Fees accumulate in the Buy & Burn contract from trading activity" },
                    { step: "2", text: "When the burn period elapses, anyone can call buyAndBurn()" },
                    { step: "3", text: "Contract buys HERO from the market and sends it to the dead address — permanently removed" },
                  ].map((s) => (
                    <div key={s.step} className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 text-xs font-bold shrink-0">{s.step}</div>
                      <p className="text-muted-foreground text-xs leading-relaxed">{s.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CONTRACTS TAB ─────────────────────────────────────────── */}
        <TabsContent value="contracts" className="mt-4 space-y-4">
          <Card className="bg-card/40 border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-400" />
                Verified Smart Contracts
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                All HERO smart contracts are verified and audited. SpyWolf Audit + KYC verified.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { name: "HERO Token (PLS)", address: HERO_TOKEN_PLS.address, chain: "PulseChain", explorer: "https://scan.pulsechain.com" },
                  { name: "VETS Token (PLS)", address: VETS_TOKEN_PLS.address, chain: "PulseChain", explorer: "https://scan.pulsechain.com" },
                  { name: "HERO Token (BASE)", address: "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8", chain: "Base", explorer: "https://basescan.org" },
                  { name: "MasterChef V2", address: FARM_CONTRACTS_PLS.masterChefV2, chain: "PulseChain", explorer: "https://scan.pulsechain.com" },
                  { name: "Buy & Burn (PLS)", address: FARM_CONTRACTS_PLS.buyAndBurn, chain: "PulseChain", explorer: "https://scan.pulsechain.com" },
                  { name: "Buy & Burn (BASE)", address: FARM_CONTRACTS_BASE.buyAndBurn, chain: "Base", explorer: "https://basescan.org" },
                  { name: "Zapper", address: FARM_CONTRACTS_PLS.zapper, chain: "PulseChain", explorer: "https://scan.pulsechain.com" },
                  { name: "PulseX Router", address: FARM_CONTRACTS_PLS.pulseXRouter, chain: "PulseChain", explorer: "https://scan.pulsechain.com" },
                ].map((c) => (
                  <div key={c.name} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                    <div>
                      <p className="text-foreground text-sm font-medium">{c.name}</p>
                      <p className="text-muted-foreground/70 text-xs">{c.chain}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-muted-foreground text-xs hidden md:block">{c.address.slice(0, 10)}...{c.address.slice(-6)}</code>
                      <a href={`${c.explorer}/address/${c.address}`} target="_blank" rel="noopener noreferrer"
                        className="text-orange-400 hover:text-orange-300">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Founder's Vision ──────────────────────────────────────────── */}
      <Card className="bg-gradient-to-br from-card to-card/60 border-border">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
              <Target className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h3 className="text-foreground font-semibold text-lg mb-2">The Founder's Vision</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                The goal is to create a self-sustaining protocol that continuously funds the treasury with HERO buys, 
                creating perpetual buy pressure. With multiple external revenue streams — LP farming yields, TruDefi 2X 
                community amplifier, NFT sales, and more — the protocol doesn't carry the stress of trying to stay 
                in the black. <strong className="text-orange-400">Consistently high and to the right</strong> is the objective.
              </p>
              <p className="text-muted-foreground text-sm mt-3">
                Even a small holder benefits: the longer you hold, the more the flywheel compounds in your favor. 
                Diamond hands are rewarded. The little guy can become a whale someday.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
