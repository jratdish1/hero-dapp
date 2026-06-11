/**
 * HeroSwapWidget — Native token swap for $HERO on BASE & PulseChain.
 * Professional branded swap interface with direct DEX links.
 * No iframes — clean, reliable, works everywhere.
 */
import { useState, useEffect } from "react";
import { useAccount, useChainId } from "wagmi";
import { useNetwork } from "@/contexts/NetworkContext";
import { getHeroAddress, getChainConfig } from "@/lib/config";
import {
  ArrowDownUp,
  Settings,
  ExternalLink,
  Zap,
  TrendingUp,
  Shield,
  Layers,
  Globe,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ─── DEX Links (dynamic based on shared config) ─────────────────────────

function buildDEXLinks() {
  const heroBase = getHeroAddress(8453);
  const heroPulse = getHeroAddress(369);
  
  return {
    base: {
      aerodrome: {
        name: "Aerodrome",
        url: `https://aerodrome.finance/swap?from=eth&to=${heroBase ?? ""}`,
        color: "blue",
        icon: Zap,
        desc: "Top BASE DEX · Deep liquidity",
      },
      uniswap: {
        name: "Uniswap",
        url: `https://app.uniswap.org/swap?outputCurrency=${heroBase ?? ""}&chain=base`,
        color: "pink",
        icon: TrendingUp,
        desc: "Universal swap · Multi-chain",
      },
      jumper: {
        name: "Jumper (Li.Fi)",
        url: `https://jumper.exchange/?fromChain=8453&fromToken=0x0000000000000000000000000000000000000000&toChain=8453&toToken=${heroBase ?? ""}`,
        color: "purple",
        icon: Globe,
        desc: "Cross-chain aggregator",
      },
    },
    pulsechain: {
      pulsex: {
        name: "PulseX",
        url: `https://app.pulsex.com/swap?outputCurrency=${heroPulse ?? ""}`,
        color: "green",
        icon: Zap,
        desc: "Native PulseChain DEX",
      },
      nines: {
        name: "9mm DEX",
        url: `https://9mm.pro/swap?outputCurrency=${heroPulse ?? ""}`,
        color: "purple",
        icon: TrendingUp,
        desc: "Concentrated liquidity",
      },
      switch: {
        name: "Switch.win",
        url: `https://switch.win/?network=pulsechain&to=${heroPulse ?? ""}`,
        color: "orange",
        icon: Layers,
        desc: "Multi-DEX aggregator",
      },
    },
  };
}

interface HeroSwapWidgetProps {
  defaultChain?: "base" | "pulsechain";
  compact?: boolean;
  showStats?: boolean;
}

export default function HeroSwapWidget({
  defaultChain = "base",
  compact = false,
  showStats = true,
}: HeroSwapWidgetProps) {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { isBase, isPulseChain } = useNetwork();
  const [activeChain, setActiveChain] = useState<"base" | "pulsechain">(
    isBase ? "base" : isPulseChain ? "pulsechain" : defaultChain
  );
  const VALID_SLIPPAGE = ["0.1", "0.5", "1.0", "3.0"] as const;
  const [slippage, setSlippage] = useState<string>("0.5");
  const safeSetSlippage = (val: string) => {
    if ((VALID_SLIPPAGE as readonly string[]).includes(val)) setSlippage(val);
  };
  const [showSettings, setShowSettings] = useState(false);

  // Auto-switch chain display based on global network context OR wallet chain
  useEffect(() => {
    if (isBase || chainId === 8453) setActiveChain("base");
    else if (isPulseChain || chainId === 369) setActiveChain("pulsechain");
  }, [chainId, isBase, isPulseChain]);

  const dexes = activeChain === "base" ? buildDEXLinks().base : buildDEXLinks().pulsechain;
  const heroAddress = getHeroAddress(activeChain === "base" ? 8453 : 369) ?? "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8";
  const nativeToken = activeChain === "base" ? "ETH" : "PLS";

  return (
    <Card className="border-hero-orange/20 bg-gradient-to-b from-card to-card/80 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <ArrowDownUp className="h-5 w-5 text-hero-orange" />
            Swap to $HERO
          </CardTitle>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
              title="Slippage settings"
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Chain Toggle */}
        <div className="flex rounded-xl p-1 gap-1 bg-background/50 border border-border/30 mt-2">
          <button
            onClick={() => setActiveChain("base")}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              activeChain === "base"
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            BASE
          </button>
          <button
            onClick={() => setActiveChain("pulsechain")}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              activeChain === "pulsechain"
                ? "bg-green-500/20 text-green-400 border border-green-500/30 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            PulseChain
          </button>
        </div>

        {/* Slippage Settings */}
        {showSettings && (
          <div className="mt-2 p-3 rounded-lg bg-background/50 border border-border/30 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Max Slippage</span>
              <div className="flex gap-1">
                {["0.1", "0.5", "1.0", "3.0"].map((val) => (
                  <button
                    key={val}
                    onClick={() => safeSetSlippage(val)}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                      slippage === val
                        ? "bg-hero-orange/20 text-hero-orange border border-hero-orange/30"
                        : "bg-muted/30 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        {/* Swap Path Visualization */}
        <div className="flex items-center justify-center gap-4 py-4 px-2 rounded-xl bg-secondary/30 border border-border/50">
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-border flex items-center justify-center">
              <span className="text-lg">{activeChain === "base" ? "💎" : "⚡"}</span>
            </div>
            <span className="text-sm font-semibold text-foreground">{nativeToken}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ArrowDownUp className="w-5 h-5 text-hero-orange animate-pulse" />
            <span className="text-[10px] text-muted-foreground">Swap</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-hero-orange/20 to-amber-500/20 border border-hero-orange/30 flex items-center justify-center">
              <span className="text-lg">🦸</span>
            </div>
            <span className="text-sm font-semibold text-foreground">HERO</span>
          </div>
        </div>

        {/* DEX Options */}
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            Choose your DEX
          </p>
          <div className="grid gap-2">
            {Object.entries(dexes).map(([key, dex]) => {
              const Icon = dex.icon;
              const colorMap: Record<string, string> = {
                blue: "border-blue-500/30 hover:border-blue-500/50 hover:bg-blue-500/5",
                pink: "border-pink-500/30 hover:border-pink-500/50 hover:bg-pink-500/5",
                purple: "border-purple-500/30 hover:border-purple-500/50 hover:bg-purple-500/5",
                green: "border-green-500/30 hover:border-green-500/50 hover:bg-green-500/5",
                orange: "border-[var(--hero-orange)]/30 hover:border-[var(--hero-orange)]/50 hover:bg-[var(--hero-orange)]/5",
              };
              const iconColorMap: Record<string, string> = {
                blue: "text-blue-400",
                pink: "text-pink-400",
                purple: "text-purple-400",
                green: "text-green-400",
                orange: "text-[var(--hero-orange)]",
              };
              return (
                <a
                  key={key}
                  href={dex.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 p-3 rounded-xl border bg-card transition-all duration-200 group ${colorMap[dex.color] || colorMap.blue}`}
                >
                  <div className={`p-2 rounded-lg bg-secondary/50 ${iconColorMap[dex.color] || iconColorMap.blue}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{dex.name}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <span className="text-xs text-muted-foreground">{dex.desc}</span>
                  </div>
                  <div className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    Swap →
                  </div>
                </a>
              );
            })}
          </div>
        </div>

        {/* Security note */}
        {showStats && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-hero-green/5 border border-hero-green/10">
            <Shield className="h-3.5 w-3.5 text-hero-green mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Swaps are routed through audited DEX contracts. Always verify the token
              address: <span className="font-mono text-foreground/70">{heroAddress.slice(0, 10) + "..."}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
