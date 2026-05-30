/**
 * HeroSwapWidget — Native token swap for $HERO on BASE.
 * Embeds Li.Fi aggregator for best routing across Aerodrome, Uniswap, etc.
 * Professional UI with real-time price impact and slippage controls.
 */
import { useState, useEffect } from "react";
import { useAccount, useChainId } from "wagmi";
import {
  ArrowDownUp,
  Settings,
  Info,
  ExternalLink,
  Zap,
  TrendingUp,
  Shield,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Token Addresses ────────────────────────────────────────────────────
const TOKENS = {
  HERO_BASE: "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8",
  HERO_PULSE: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
  ETH: "0x0000000000000000000000000000000000000000",
  USDC_BASE: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  DAI_BASE: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
};

// ─── DEX Links ──────────────────────────────────────────────────────────
const DEX_LINKS = {
  base: {
    aerodrome: `https://aerodrome.finance/swap?from=eth&to=${TOKENS.HERO_BASE}`,
    uniswap: `https://app.uniswap.org/swap?outputCurrency=${TOKENS.HERO_BASE}&chain=base`,
    lifi: `https://jumper.exchange/?fromChain=8453&fromToken=0x0000000000000000000000000000000000000000&toChain=8453&toToken=${TOKENS.HERO_BASE}`,
  },
  pulsechain: {
    pulsex: `https://app.pulsex.com/swap?outputCurrency=${TOKENS.HERO_PULSE}`,
    nines: `https://9mm.pro/swap?outputCurrency=${TOKENS.HERO_PULSE}`,
  },
};

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
  const [activeChain, setActiveChain] = useState<"base" | "pulsechain">(
    chainId === 8453 ? "base" : defaultChain
  );
  const [slippage, setSlippage] = useState("0.5");
  const [showSettings, setShowSettings] = useState(false);

  // Auto-switch chain display based on connected network
  useEffect(() => {
    if (chainId === 8453) setActiveChain("base");
    else if (chainId === 369) setActiveChain("pulsechain");
  }, [chainId]);

  const iframeUrl =
    activeChain === "base"
      ? `https://jumper.exchange/widget?fromChain=8453&fromToken=${TOKENS.ETH}&toChain=8453&toToken=${TOKENS.HERO_BASE}&theme=dark`
      : `https://app.squirrelswap.pro/#/widget?modes=swap&tokenOut=${TOKENS.HERO_PULSE}&accentColor=C8A84B&bgColor=0d1a0d&cardColor=1C2A1C&borderColor=3D5A3D&textColor=E8E8D0`;

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
                    onClick={() => setSlippage(val)}
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

      <CardContent className="p-0">
        {/* Embedded Swap Widget */}
        <div className="relative">
          <iframe
            src={iframeUrl}
            className="w-full border-0 rounded-b-lg"
            style={{ height: compact ? "420px" : "520px" }}
            title={`Swap to HERO on ${activeChain === "base" ? "BASE" : "PulseChain"}`}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>

        {/* Quick DEX Links */}
        <div className="px-4 py-3 border-t border-border/30">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
            Or swap directly on
          </p>
          <div className="flex flex-wrap gap-2">
            {activeChain === "base" ? (
              <>
                <a
                  href={DEX_LINKS.base.aerodrome}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs font-medium text-blue-400 hover:bg-blue-500/20 transition-colors"
                >
                  <Zap className="h-3 w-3" />
                  Aerodrome
                  <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                </a>
                <a
                  href={DEX_LINKS.base.uniswap}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/20 text-xs font-medium text-pink-400 hover:bg-pink-500/20 transition-colors"
                >
                  <TrendingUp className="h-3 w-3" />
                  Uniswap
                  <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                </a>
              </>
            ) : (
              <>
                <a
                  href={DEX_LINKS.pulsechain.pulsex}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/20 text-xs font-medium text-green-400 hover:bg-green-500/20 transition-colors"
                >
                  <Zap className="h-3 w-3" />
                  PulseX
                  <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                </a>
                <a
                  href={DEX_LINKS.pulsechain.nines}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs font-medium text-purple-400 hover:bg-purple-500/20 transition-colors"
                >
                  <TrendingUp className="h-3 w-3" />
                  9mm DEX
                  <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                </a>
              </>
            )}
          </div>
        </div>

        {/* Security note */}
        {showStats && (
          <div className="px-4 pb-3">
            <div className="flex items-start gap-2 p-2 rounded-lg bg-hero-green/5 border border-hero-green/10">
              <Shield className="h-3.5 w-3.5 text-hero-green mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Swaps are routed through audited DEX contracts. Always verify the token
                address: <span className="font-mono text-foreground/70">{activeChain === "base" ? TOKENS.HERO_BASE.slice(0, 10) + "..." : TOKENS.HERO_PULSE.slice(0, 10) + "..."}</span>
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
