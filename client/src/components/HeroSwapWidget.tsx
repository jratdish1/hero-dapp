/**
 * HeroSwapWidget — Native token swap discovery for $HERO on BASE & PulseChain.
 * Professional branded swap interface with direct DEX links.
 * Agent-assisted intents are review-only until explicit human confirmation.
 */
import { useState, useEffect } from "react";
import { useAccount, useChainId } from "wagmi";
import { useNetwork } from "@/contexts/NetworkContext";
import { getHeroAddress } from "@/lib/config";
import {
  describeHeroSwapIntent,
  getIntentHandoffStatus,
  parseHeroSwapIntent,
  type HeroSwapIntent,
} from "@/lib/swap-intent";
import {
  ArrowDownUp,
  Settings,
  ExternalLink,
  Zap,
  TrendingUp,
  Shield,
  Layers,
  Globe,
  Bot,
  CheckCircle2,
  AlertTriangle,
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
    isBase ? "base" : isPulseChain ? "pulsechain" : defaultChain,
  );
  const VALID_SLIPPAGE = ["0.1", "0.5", "1.0", "3.0"] as const;
  const [slippage, setSlippage] = useState<string>("0.5");
  const safeSetSlippage = (val: string) => {
    if ((VALID_SLIPPAGE as readonly string[]).includes(val)) setSlippage(val);
  };
  const [showSettings, setShowSettings] = useState(false);
  const [intentText, setIntentText] = useState("");
  const [intentReview, setIntentReview] = useState<HeroSwapIntent | null>(null);
  const [intentConfirmed, setIntentConfirmed] = useState(false);
  const [intentError, setIntentError] = useState<string | null>(null);

  // Auto-switch chain display based on global network context OR wallet chain.
  useEffect(() => {
    if (isBase || chainId === 8453) setActiveChain("base");
    else if (isPulseChain || chainId === 369) setActiveChain("pulsechain");
  }, [chainId, isBase, isPulseChain]);

  // A chain change invalidates and removes the old review so route labels can never
  // describe a different chain from the intent that was reviewed.
  useEffect(() => {
    if (!intentReview || activeChain === intentReview.chain) return;
    setIntentReview(null);
    setIntentConfirmed(false);
    setIntentError("Chain changed after review. Review the intent again before continuing.");
  }, [activeChain, intentReview]);

  const dexes = activeChain === "base" ? buildDEXLinks().base : buildDEXLinks().pulsechain;
  const dexEntries = Object.entries(dexes);
  const primaryIntentDex = dexEntries[0]?.[1];
  const heroAddress = getHeroAddress(activeChain === "base" ? 8453 : 369) ?? "";
  const nativeToken = activeChain === "base" ? "ETH" : "PLS";
  const intentReviewMatchesChain = intentReview?.chain === activeChain;

  const resetIntentReview = () => {
    setIntentReview(null);
    setIntentConfirmed(false);
    setIntentError(null);
  };

  const handleIntentTextChange = (value: string) => {
    setIntentText(value);
    if (intentReview || intentConfirmed) resetIntentReview();
  };

  const handleReviewIntent = () => {
    const parsed = parseHeroSwapIntent(intentText, activeChain);
    if ("error" in parsed) {
      setIntentReview(null);
      setIntentConfirmed(false);
      setIntentError(parsed.error);
      return;
    }

    setActiveChain(parsed.chain);
    setIntentReview(parsed);
    setIntentConfirmed(false);
    setIntentError(null);
  };

  const handleConfirmIntent = () => {
    if (!intentReview) return;
    const status = getIntentHandoffStatus(intentReview, activeChain, false);
    if (status === "expired") {
      setIntentConfirmed(false);
      setIntentError("Intent review expired. Review it again before continuing.");
      return;
    }
    if (status === "chain-changed") {
      setIntentReview(null);
      setIntentConfirmed(false);
      setIntentError("Chain changed after review. Review the intent again before continuing.");
      return;
    }

    setIntentConfirmed(true);
    setIntentError(null);
  };

  const guardIntentHandoff = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!intentReview) {
      event.preventDefault();
      return;
    }
    const status = getIntentHandoffStatus(intentReview, activeChain, intentConfirmed);
    if (status === "ready") return;

    event.preventDefault();
    if (status === "chain-changed") setIntentReview(null);
    setIntentConfirmed(false);
    setIntentError(
      status === "expired"
        ? "Intent review expired. Review it again before continuing."
        : status === "chain-changed"
          ? "Chain changed after review. Review the intent again before continuing."
          : "Explicit confirmation is required before the intent handoff.",
    );
  };

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
              type="button"
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
            type="button"
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
            type="button"
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
                    type="button"
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
        {/* Agent-assisted intent lane. This never signs or broadcasts. */}
        <div className="space-y-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
          <div className="flex items-start gap-2">
            <Bot className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">Agent-assisted intent — review first</p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Intent text can prepare a bounded route handoff. It never signs, broadcasts, or opens a DEX until you review and explicitly confirm.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              value={intentText}
              onChange={(event) => handleIntentTextChange(event.target.value)}
              placeholder={`swap ${activeChain === "base" ? "0.01 ETH" : "100000 PLS"} to HERO on ${activeChain === "base" ? "BASE" : "PulseChain"}`}
              aria-label="HERO swap intent"
              className="min-w-0 flex-1 rounded-md border border-border bg-background/70 px-3 py-2 text-xs text-foreground outline-none focus:border-cyan-500/50"
            />
            <button
              type="button"
              onClick={handleReviewIntent}
              className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/15"
            >
              Review intent
            </button>
          </div>

          {intentError && (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
              <span className="text-[10px] text-amber-200">{intentError}</span>
            </div>
          )}

          {intentReview && intentReviewMatchesChain && (
            <div className="space-y-2 rounded-md border border-border/60 bg-background/50 p-3" data-testid="swap-intent-review">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Intent review</p>
                  <p className="text-sm font-mono text-foreground">{describeHeroSwapIntent(intentReview)}</p>
                </div>
                <span className="text-[10px] text-muted-foreground">expires in 2 min</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded bg-secondary/40 px-2 py-1.5">
                  <span className="text-muted-foreground">Route handoff</span>
                  <div className="font-medium text-foreground">{primaryIntentDex?.name ?? "Unavailable"}</div>
                </div>
                <div className="rounded bg-secondary/40 px-2 py-1.5">
                  <span className="text-muted-foreground">Local slippage preference</span>
                  <div className="font-medium text-foreground">{slippage}%</div>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground leading-relaxed">
                This is a route preview, not an executable price quote. The local slippage preference is not transferred to the external DEX. Final output, fees, spender, deadline, slippage, transaction details, and wallet signature must be reviewed there.
              </p>

              {!intentConfirmed ? (
                <button
                  type="button"
                  onClick={handleConfirmIntent}
                  className="w-full rounded-md bg-cyan-500/15 border border-cyan-500/30 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20"
                  data-testid="swap-intent-confirm"
                >
                  Confirm intent
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] text-green-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Confirmed. No transaction has been signed or broadcast.
                  </div>
                  {primaryIntentDex && (
                    <a
                      href={primaryIntentDex.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={guardIntentHandoff}
                      className="flex w-full items-center justify-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-bold text-green-300 hover:bg-green-500/15"
                      data-testid="swap-intent-handoff"
                    >
                      Continue to {primaryIntentDex.name} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

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

        {/* Manual DEX Options — separate from agent-assisted intent lane. */}
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            Manual DEX options
          </p>
          <div className="grid gap-2">
            {dexEntries.map(([key, dex]) => {
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
              {isConnected ? "Wallet connected. " : "Connect your wallet only when you are ready to transact. "}
              External DEX and wallet confirmations remain authoritative. Always verify the token address:{" "}
              <span className="font-mono text-foreground/70">{heroAddress.slice(0, 10) + "..."}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
