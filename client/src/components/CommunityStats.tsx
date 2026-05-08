import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, Wallet, Vote, TrendingUp, Shield, Globe,
  Flame, Coins, ExternalLink
} from "lucide-react";
import { useNetwork } from "@/contexts/NetworkContext";

// ─── Types ────────────────────────────────────────────────────────────
interface CommunityMetrics {
  holders: number;
  holdersChange: number;
  activeVoters: number;
  treasuryValue: string;
  treasuryChange: number;
  totalBurned: string;
  burnedPct: string;
  proposalsActive: number;
  proposalsPassed: number;
  delegatesActive: number;
  marketCap: string;
  volume24h: string;
}

// ─── Demo Metrics ─────────────────────────────────────────────────────
const METRICS_PLS: CommunityMetrics = {
  holders: 1247,
  holdersChange: 3.2,
  activeVoters: 89,
  treasuryValue: "$45,200",
  treasuryChange: 12.5,
  totalBurned: "2.1M HERO",
  burnedPct: "2.1%",
  proposalsActive: 2,
  proposalsPassed: 7,
  delegatesActive: 12,
  marketCap: "$89,400",
  volume24h: "$11,350",
};

const METRICS_BASE: CommunityMetrics = {
  holders: 342,
  holdersChange: 8.7,
  activeVoters: 24,
  treasuryValue: "$12,800",
  treasuryChange: 22.1,
  totalBurned: "500K HERO",
  burnedPct: "0.5%",
  proposalsActive: 1,
  proposalsPassed: 2,
  delegatesActive: 5,
  marketCap: "$24,500",
  volume24h: "$4,200",
};

// ─── Component ────────────────────────────────────────────────────────
export default function CommunityStats() {
  const { isPulseChain } = useNetwork();
  const metrics = isPulseChain ? METRICS_PLS : METRICS_BASE;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-[var(--hero-orange)]" />
        <h3 className="text-sm font-semibold text-foreground">Community Stats</h3>
        <Badge variant="outline" className="text-[9px] py-0">
          {isPulseChain ? "PulseChain" : "BASE"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Holders */}
        <Card className="bg-gradient-to-br from-[var(--hero-orange)]/5 to-transparent border-[var(--hero-orange)]/20">
          <CardContent className="p-2.5 text-center">
            <Users className="w-3.5 h-3.5 text-[var(--hero-orange)] mx-auto mb-0.5" />
            <p className="text-base font-bold text-foreground">{metrics.holders.toLocaleString()}</p>
            <p className="text-[9px] text-muted-foreground">Holders</p>
            <span className="text-[8px] text-[var(--hero-green)]">+{metrics.holdersChange}% 7d</span>
          </CardContent>
        </Card>

        {/* Active Voters */}
        <Card className="bg-gradient-to-br from-purple-500/5 to-transparent border-purple-500/20">
          <CardContent className="p-2.5 text-center">
            <Vote className="w-3.5 h-3.5 text-purple-400 mx-auto mb-0.5" />
            <p className="text-base font-bold text-foreground">{metrics.activeVoters}</p>
            <p className="text-[9px] text-muted-foreground">Active Voters</p>
            <span className="text-[8px] text-muted-foreground">{metrics.delegatesActive} delegates</span>
          </CardContent>
        </Card>

        {/* Treasury */}
        <Card className="bg-gradient-to-br from-[var(--hero-green)]/5 to-transparent border-[var(--hero-green)]/20">
          <CardContent className="p-2.5 text-center">
            <Wallet className="w-3.5 h-3.5 text-[var(--hero-green)] mx-auto mb-0.5" />
            <p className="text-base font-bold text-foreground">{metrics.treasuryValue}</p>
            <p className="text-[9px] text-muted-foreground">Treasury</p>
            <span className="text-[8px] text-[var(--hero-green)]">+{metrics.treasuryChange}% 30d</span>
          </CardContent>
        </Card>

        {/* Burned */}
        <Card className="bg-gradient-to-br from-red-500/5 to-transparent border-red-500/20">
          <CardContent className="p-2.5 text-center">
            <Flame className="w-3.5 h-3.5 text-red-400 mx-auto mb-0.5" />
            <p className="text-base font-bold text-foreground">{metrics.totalBurned}</p>
            <p className="text-[9px] text-muted-foreground">Total Burned</p>
            <span className="text-[8px] text-red-400">{metrics.burnedPct} supply</span>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-border/30">
          <CardContent className="p-2 text-center">
            <p className="text-xs font-bold text-foreground">{metrics.marketCap}</p>
            <p className="text-[8px] text-muted-foreground">Market Cap</p>
          </CardContent>
        </Card>
        <Card className="border-border/30">
          <CardContent className="p-2 text-center">
            <p className="text-xs font-bold text-foreground">{metrics.volume24h}</p>
            <p className="text-[8px] text-muted-foreground">24h Volume</p>
          </CardContent>
        </Card>
        <Card className="border-border/30">
          <CardContent className="p-2 text-center">
            <p className="text-xs font-bold text-foreground">{metrics.proposalsPassed}</p>
            <p className="text-[8px] text-muted-foreground">Proposals Passed</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="flex gap-2 justify-center flex-wrap">
        <a href="/dao/treasury" className="text-[10px] text-muted-foreground hover:text-[var(--hero-orange)] flex items-center gap-0.5">
          <Shield className="w-2.5 h-2.5" /> Treasury <ExternalLink className="w-2 h-2" />
        </a>
        <a href="/dao/delegates" className="text-[10px] text-muted-foreground hover:text-[var(--hero-orange)] flex items-center gap-0.5">
          <Users className="w-2.5 h-2.5" /> Delegates <ExternalLink className="w-2 h-2" />
        </a>
        <a href="/tokenomics" className="text-[10px] text-muted-foreground hover:text-[var(--hero-orange)] flex items-center gap-0.5">
          <Coins className="w-2.5 h-2.5" /> Tokenomics <ExternalLink className="w-2 h-2" />
        </a>
      </div>
    </div>
  );
}
