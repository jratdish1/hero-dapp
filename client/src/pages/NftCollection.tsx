import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Shield, Star, Award, Crown, Gem, Flame, Clock, Wallet,
  ExternalLink, ChevronRight, Zap, Lock, TrendingUp, Users,
  Swords, Heart, Target
} from "lucide-react";
import { SERVICE_BRANCHES } from "@shared/tokens";

// ─── Military Rank Tiers ─────────────────────────────────────────────────
const RANK_TIERS = [
  {
    rank: "Private (E-1)",
    tier: "Common",
    color: "text-zinc-400",
    bg: "bg-zinc-500/10",
    border: "border-zinc-500/30",
    holdingReq: "1,000+ HERO",
    feeReduction: "1%",
    rarity: "40%",
    count: 400,
    icon: Shield,
    description: "Entry rank. Every holder starts here. Basic fee reduction and community access.",
  },
  {
    rank: "Corporal (E-4)",
    tier: "Uncommon",
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    holdingReq: "10,000+ HERO",
    feeReduction: "2%",
    rarity: "25%",
    count: 250,
    icon: Star,
    description: "Proven holder. Enhanced fee reduction and early access to new features.",
  },
  {
    rank: "Sergeant (E-5)",
    tier: "Rare",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    holdingReq: "50,000+ HERO",
    feeReduction: "3%",
    rarity: "18%",
    count: 180,
    icon: Award,
    description: "Dedicated supporter. Priority access to governance proposals and boosted staking rewards.",
  },
  {
    rank: "Lieutenant (O-2)",
    tier: "Epic",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    holdingReq: "250,000+ HERO",
    feeReduction: "4%",
    rarity: "10%",
    count: 100,
    icon: Crown,
    description: "Officer class. Significant fee reduction, exclusive Discord channels, and DAO voting power multiplier.",
  },
  {
    rank: "Colonel (O-6)",
    tier: "Legendary",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    holdingReq: "1,000,000+ HERO",
    feeReduction: "5%",
    rarity: "5%",
    count: 50,
    icon: Gem,
    description: "Elite tier. Maximum fee reduction, exclusive airdrops, and direct founder access.",
  },
  {
    rank: "General (O-10)",
    tier: "Mythic",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    holdingReq: "5,000,000+ HERO",
    feeReduction: "7%",
    rarity: "2%",
    count: 20,
    icon: Flame,
    description: "Supreme commander. Highest rarity. Zero-fee trading, all utilities unlocked, and legendary status in the community.",
  },
];

// ─── NFT Utility Features ────────────────────────────────────────────────
const UTILITY_FEATURES = [
  {
    title: "Fee Reduction",
    description: "Hold an NFT in your wallet to automatically reduce buy/sell fees. Higher rank = bigger reduction.",
    icon: TrendingUp,
    status: "Phase 1",
  },
  {
    title: "Diamond Hands Rewards",
    description: "The longer you hold your NFT + tokens, the more you earn. Time-weighted staking multiplier.",
    icon: Clock,
    status: "Phase 1",
  },
  {
    title: "Governance Power",
    description: "NFT holders get boosted voting power in DAO proposals. Officers get 2x, Generals get 5x.",
    icon: Users,
    status: "Phase 2",
  },
  {
    title: "Exclusive Airdrops",
    description: "Periodic airdrops of HERO, VETS, and partner tokens exclusively to NFT holders.",
    icon: Zap,
    status: "Phase 2",
  },
  {
    title: "Staking Boost",
    description: "NFT holders receive boosted APY on all farm staking pools. Rank determines boost percentage.",
    icon: Flame,
    status: "Phase 3",
  },
  {
    title: "Rank Promotion",
    description: "As your wallet accumulates more HERO, your NFT rank can be upgraded — reflecting your true commitment.",
    icon: Award,
    status: "Phase 3",
  },
];

export default function NftCollection() {
  const [activeTab, setActiveTab] = useState("ranks");

  return (
    <div className="space-y-6">
      {/* Service Branch Ribbon */}
      <div className="flex gap-0 h-1.5 rounded-full overflow-hidden">
        {SERVICE_BRANCHES.map((b) => (
          <div key={b.name} className="flex-1" style={{ backgroundColor: b.color }} title={b.name} />
        ))}
      </div>

      {/* Header */}
      <div className="text-center space-y-3">
        <Badge variant="outline" className="border-orange-500/40 text-orange-400">
          <Swords className="w-3 h-3 mr-1" /> 1,000 Piece Collection
        </Badge>
        <h1 className="text-3xl font-bold text-white">
          HERO <span className="text-orange-400">NFT Collection</span>
        </h1>
        <p className="text-zinc-400 max-w-2xl mx-auto">
          Military and first responder themed NFTs with real utility. Your rank reflects your commitment — 
          hold more HERO, earn a higher rank, unlock greater rewards. Even the little guy can become a whale someday.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Supply", value: "1,000", icon: Gem, color: "text-orange-400" },
          { label: "Rank Tiers", value: "6 Ranks", icon: Award, color: "text-purple-400" },
          { label: "Max Fee Reduction", value: "7%", icon: TrendingUp, color: "text-green-400" },
          { label: "Status", value: "In Development", icon: Lock, color: "text-yellow-400" },
        ].map((stat) => (
          <Card key={stat.label} className="bg-zinc-900/60 border-zinc-800">
            <CardContent className="p-4 text-center">
              <stat.icon className={`w-5 h-5 mx-auto mb-2 ${stat.color}`} />
              <p className="text-white font-semibold text-sm">{stat.value}</p>
              <p className="text-zinc-500 text-xs">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-zinc-900 border border-zinc-800 w-full justify-start">
          <TabsTrigger value="ranks" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
            <Award className="w-4 h-4 mr-1" /> Rank System
          </TabsTrigger>
          <TabsTrigger value="utility" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
            <Zap className="w-4 h-4 mr-1" /> Utility
          </TabsTrigger>
          <TabsTrigger value="branches" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
            <Shield className="w-4 h-4 mr-1" /> Service Branches
          </TabsTrigger>
          <TabsTrigger value="roadmap" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
            <Target className="w-4 h-4 mr-1" /> Roadmap
          </TabsTrigger>
        </TabsList>

        {/* RANKS TAB */}
        <TabsContent value="ranks" className="mt-4 space-y-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {RANK_TIERS.map((rank) => {
              const Icon = rank.icon;
              return (
                <Card key={rank.rank} className={`bg-zinc-900/60 ${rank.border} hover:shadow-lg transition-all`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-10 h-10 rounded-lg ${rank.bg} flex items-center justify-center`}>
                          <Icon className={`w-5 h-5 ${rank.color}`} />
                        </div>
                        <div>
                          <CardTitle className={`text-sm ${rank.color}`}>{rank.rank}</CardTitle>
                          <p className="text-xs text-zinc-500">{rank.tier}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-[10px] ${rank.border} ${rank.color}`}>
                        {rank.count} NFTs
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-zinc-400 text-xs leading-relaxed">{rank.description}</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Holding Requirement</span>
                        <span className="text-white font-medium">{rank.holdingReq}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Fee Reduction</span>
                        <span className="text-green-400 font-medium">-{rank.feeReduction}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Rarity</span>
                        <span className={rank.color}>{rank.rarity}</span>
                      </div>
                      <Progress value={parseInt(rank.rarity)} className="h-1.5" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Diamond Hands Insight */}
          <Card className="bg-gradient-to-r from-yellow-500/5 to-orange-500/5 border-yellow-500/20">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Gem className="w-6 h-6 text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-yellow-400 font-semibold text-sm">Diamond Hands Philosophy</h4>
                  <p className="text-zinc-300 text-sm mt-1">
                    The longer you hold, the more you earn. Your NFT rank can be <strong className="text-white">promoted</strong> as 
                    your wallet accumulates more HERO tokens. A Private today could become a General tomorrow. 
                    Time in the market beats timing the market — and your NFT reflects that journey.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* UTILITY TAB */}
        <TabsContent value="utility" className="mt-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {UTILITY_FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="bg-zinc-900/60 border-zinc-800 hover:border-orange-500/30 transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-orange-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-white font-semibold text-sm">{feature.title}</h4>
                          <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-400">{feature.status}</Badge>
                        </div>
                        <p className="text-zinc-400 text-xs leading-relaxed">{feature.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* How Fee Reduction Works */}
          <Card className="bg-zinc-900/40 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                How Fee Reduction Works
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { step: "1", text: "Hold a HERO NFT in your connected wallet" },
                  { step: "2", text: "Smart contract automatically detects your NFT rank" },
                  { step: "3", text: "Buy/sell fee is reduced based on your rank tier (1% to 7%)" },
                  { step: "4", text: "No action needed — it's automatic and gasless" },
                ].map((s) => (
                  <div key={s.step} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-sm font-bold shrink-0">{s.step}</div>
                    <p className="text-zinc-300 text-sm">{s.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SERVICE BRANCHES TAB */}
        <TabsContent value="branches" className="mt-4 space-y-4">
          <Card className="bg-zinc-900/40 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-400" />
                Honoring Those Who Serve
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Each NFT features artwork representing military branches and first responders. 
                The collection honors the brave men and women who serve our communities and nation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {SERVICE_BRANCHES.map((branch) => (
                  <div
                    key={branch.name}
                    className="bg-zinc-800/50 rounded-lg p-4 text-center hover:bg-zinc-800 transition-colors"
                  >
                    <div
                      className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl"
                      style={{ backgroundColor: `${branch.color}20` }}
                    >
                      {branch.emoji}
                    </div>
                    <p className="text-white text-sm font-medium">{branch.name}</p>
                    <p className="text-zinc-500 text-xs mt-1" style={{ color: branch.color }}>
                      {branch.name === "Army" ? "Hooah!" :
                       branch.name === "Navy" ? "Hooyah!" :
                       branch.name === "Marines" ? "Oorah!" :
                       branch.name === "Air Force" ? "Aim High!" :
                       branch.name === "Coast Guard" ? "Semper Paratus!" :
                       branch.name === "Space Force" ? "Semper Supra!" :
                       branch.name === "Firefighters" ? "Bravest!" :
                       branch.name === "Police" ? "Finest!" :
                       "Heroes!"}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-red-500/5 to-blue-500/5 border-red-500/20">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Shield className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-white font-semibold text-sm">Supporting Veterans & First Responders</h4>
                  <p className="text-zinc-300 text-sm mt-1">
                    HERO is a 501(c)(3) nonprofit supporting military veterans and first responders through the 
                    VIC Foundation. A portion of all NFT mint revenue goes directly to veteran support programs.
                  </p>
                  <a href="https://x.com/hero501c3" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-orange-400 text-xs mt-2 hover:text-orange-300">
                    Follow @HERO501c3 on X <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ROADMAP TAB */}
        <TabsContent value="roadmap" className="mt-4 space-y-4">
          <Card className="bg-zinc-900/40 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-orange-400" />
                NFT Development Roadmap
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                {
                  phase: "Phase 1",
                  title: "Artwork & Minting",
                  status: "In Progress",
                  statusColor: "text-yellow-400 border-yellow-500/40",
                  items: [
                    "1,000 unique military/first responder artworks",
                    "Ranking insignia system based on token holdings",
                    "Rarity tiers tied to military ranks (E-1 to O-10)",
                    "Smart contract deployment with fee reduction utility",
                    "Mint event with proceeds to treasury",
                  ],
                },
                {
                  phase: "Phase 2",
                  title: "Utility Activation",
                  status: "Planned",
                  statusColor: "text-blue-400 border-blue-500/40",
                  items: [
                    "Automatic fee reduction for NFT holders",
                    "Diamond hands time-weighted staking multiplier",
                    "Governance voting power boost",
                    "Exclusive airdrop eligibility",
                  ],
                },
                {
                  phase: "Phase 3",
                  title: "Advanced Features",
                  status: "Future",
                  statusColor: "text-zinc-400 border-zinc-500/40",
                  items: [
                    "Rank promotion system (upgrade NFT as holdings grow)",
                    "Staking APY boost based on NFT rank",
                    "Cross-chain NFT bridging (PulseChain ↔ BASE)",
                    "Community marketplace for trading",
                    "Rarity script implementation for unique traits",
                  ],
                },
              ].map((phase) => (
                <div key={phase.phase} className="relative pl-8 border-l-2 border-zinc-800">
                  <div className="absolute left-0 top-0 w-4 h-4 rounded-full bg-orange-500 -translate-x-[9px]" />
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-white font-semibold">{phase.phase}: {phase.title}</h4>
                    <Badge variant="outline" className={`text-[10px] ${phase.statusColor}`}>{phase.status}</Badge>
                  </div>
                  <ul className="space-y-1.5">
                    {phase.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-zinc-400 text-sm">
                        <ChevronRight className="w-3 h-3 text-orange-400 shrink-0 mt-1" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
