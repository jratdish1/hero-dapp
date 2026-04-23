import { useState } from "react";
import { Card } from "@/components/ui/card";
import {
  ArrowLeftRight, Zap, ExternalLink, Shield, Clock,
} from "lucide-react";
import { useNetwork } from "../contexts/NetworkContext";
import { useMarketOverview, formatPrice, formatChange } from "../hooks/usePrices";

/* ─── Live Price Banner ─── */
function LivePriceBanner() {
  const { data: market, isLoading } = useMarketOverview();
  if (isLoading || !market)
    return (
      <div className="text-xs text-muted-foreground animate-pulse">
        Loading live prices...
      </div>
    );

  const items = [
    { symbol: "HERO", price: market.heroPrice?.priceUsd, change: market.heroPrice?.priceChange24h },
    { symbol: "VETS", price: market.vetsPrice?.priceUsd, change: market.vetsPrice?.priceChange24h },
    { symbol: "PLS",  price: market.plsPrice?.priceUsd,  change: market.plsPrice?.priceChange24h },
  ].filter((i) => i.price);

  return (
    <div className="flex items-center gap-2 sm:gap-4 flex-wrap relative z-10 bg-card/95 backdrop-blur-sm rounded px-2 py-1">
      <span className="text-xs text-muted-foreground whitespace-nowrap">Live:</span>
      {items.map((i) => {
        const { text, positive } = formatChange(i.change);
        return (
          <div key={i.symbol} className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-xs font-semibold text-foreground">{i.symbol}</span>
            <span className="text-xs font-mono text-foreground tabular-nums">{formatPrice(i.price)}</span>
            <span className={`text-xs font-mono tabular-nums ${positive ? "text-green-400" : "text-red-400"}`}>
              {text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Quick Token Buttons ─── */
function QuickTokenRow() {
  const { tokens } = useNetwork();
  const heroTokens = tokens.slice(0, 6);

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {heroTokens.map((t) => (
        <span
          key={t.address}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-secondary text-muted-foreground whitespace-nowrap"
        >
          <img
            src={t.logoURI}
            alt={t.symbol}
            className="w-4 h-4 rounded-full"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${t.symbol}&background=random&size=16`;
            }}
          />
          {t.symbol}
        </span>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   SWAP PAGE
   Order: Switch (top) → SquirrelSwap (middle) → Liberty Swap (bottom)
   ═══════════════════════════════════════════════════ */
export default function Swap() {
  const { dexSources, chain } = useNetwork();
  const [showSwitch, setShowSwitch] = useState(true);
  const [showSquirrel, setShowSquirrel] = useState(true);

  // ── Switch.win widget URL — themed to herobase.io dark military style ──
  // HERO (PulseChain): 0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27
  // PLS native: 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
  const switchWidgetSrc = [
    "https://switch.win/widget",
    "?network=pulsechain",
    "&from=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    "&to=0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
  ].join("");

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* ═══ 1. SWITCH AGGREGATOR — TOP ═══ */}
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--hero-orange)] to-[var(--hero-green)] flex items-center justify-center">
              <span className="text-xs font-bold text-black">S</span>
            </div>
            <h2 className="text-lg font-bold text-foreground">Switch Aggregator</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--hero-orange)]/10 text-[var(--hero-orange)] border border-[var(--hero-orange)]/20 font-medium">
              Best Rates · Multi-DEX
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://switch.win/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              Open Full App <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={() => setShowSwitch(!showSwitch)}
              className="text-xs px-2 py-1 rounded bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              {showSwitch ? "Collapse" : "Expand"}
            </button>
          </div>
        </div>

        {/* Live prices + quick tokens */}
        <Card className="mb-3 bg-card border-border">
          <div className="p-3 space-y-2">
            <LivePriceBanner />
            <QuickTokenRow />
          </div>
        </Card>

        {/* Switch widget iframe */}
        {showSwitch && (
          <Card className="bg-card border-border overflow-hidden">
            <div className="w-full" style={{ minHeight: "500px" }}>
              <iframe
                src={switchWidgetSrc}
                className="w-full border-0"
                style={{ height: "680px", minHeight: "500px", borderRadius: "12px", display: "block" }}
                title="Switch — PulseChain DEX Aggregator"
                allow="clipboard-read; clipboard-write"
                loading="lazy"
              />
            </div>
          </Card>
        )}

        {/* DEX sources */}
        <div className="mt-3 flex items-center justify-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span>Aggregating from:</span>
          {dexSources.map((dex: { id: string; name: string }) => (
            <span key={dex.id} className="px-2 py-1 rounded bg-secondary">
              {dex.name}
            </span>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-2">
          Powered by Switch — Aggregates PulseX V1 & V2, 9inch, Liberty Swap & more for best execution
        </p>
      </div>

      {/* ═══ DIVIDER ═══ */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          More Swap Options
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* ═══ 2. SQUIRRELSWAP PRO — MIDDLE ═══ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <img
              src="https://iili.io/qdikIJj.png"
              alt="SquirrelSwap"
              className="w-6 h-6 rounded-full"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <h2 className="text-lg font-bold text-foreground">SquirrelSwap Pro</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--hero-green)]/10 text-[var(--hero-green)] font-medium">
              10 DEXes
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://app.squirrelswap.pro/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              Open Full App <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={() => setShowSquirrel(!showSquirrel)}
              className="text-xs px-2 py-1 rounded bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              {showSquirrel ? "Collapse" : "Expand"}
            </button>
          </div>
        </div>

        {showSquirrel && (
          <Card className="bg-card border-border overflow-hidden">
            <div className="w-full" style={{ height: "680px" }}>
              <iframe
                src="https://app.squirrelswap.pro/#/widget?modes=swap,limit,dca&accentColor=e8b84b&bgColor=0d1a0d&cardColor=161825&borderColor=2a2b3d&textColor=e6edf3&tokenOut=0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27"
                className="w-full h-full border-0"
                title="SquirrelSwap Pro — PulseChain DEX Aggregator"
                allow="clipboard-write; clipboard-read"
                loading="lazy"
              />
            </div>
          </Card>
        )}

        <p className="text-xs text-muted-foreground text-center mt-2">
          Aggregates 10 DEXes on PulseChain — PulseX, 9mm, 9inch, PHUX, pDEX & more
        </p>
      </div>

      {/* ═══ DIVIDER ═══ */}
      <div className="flex items-center gap-3 mt-8">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          Cross-Chain Bridge
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* ═══ 3. LIBERTY SWAP — BOTTOM ═══ */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🗽</span>
            <h2 className="text-lg font-bold text-foreground">Liberty Swap</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--hero-green)]/10 text-[var(--hero-green)] border border-[var(--hero-green)]/20 font-medium">
              Cross-Chain · USDC Bridge · Privacy
            </span>
          </div>
          <a
            href="https://libertyswap.finance/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            Open Full App <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Bridge USDC between PulseChain and BASE — 1:1 rate, 0.3% fee, gasless mode available. Send to any wallet with Railgun privacy.
        </p>
        <Card className="bg-card border-border overflow-hidden">
          <div className="p-6 space-y-6">
            {/* Bridge Visual */}
            <div className="flex items-center justify-center gap-4 py-6">
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-secondary/50 border border-border min-w-[120px]">
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <span className="text-2xl">🔵</span>
                </div>
                <span className="text-sm font-semibold text-foreground">BASE</span>
                <span className="text-xs text-muted-foreground">USDC</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-1 text-[var(--hero-green)]">
                  <ArrowLeftRight className="w-6 h-6" />
                </div>
                <span className="text-xs text-muted-foreground font-medium">1:1 Rate</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-secondary/50 border border-border min-w-[120px]">
                <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <span className="text-2xl">⚡</span>
                </div>
                <span className="text-sm font-semibold text-foreground">PulseChain</span>
                <span className="text-xs text-muted-foreground">USDC</span>
              </div>
            </div>
            {/* Features */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-secondary/30 border border-border/50">
                <Zap className="w-5 h-5 text-[var(--hero-green)]" />
                <span className="text-xs font-medium text-foreground">Gasless</span>
                <span className="text-[10px] text-muted-foreground text-center">No gas required</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-secondary/30 border border-border/50">
                <Shield className="w-5 h-5 text-[var(--hero-orange)]" />
                <span className="text-xs font-medium text-foreground">Private</span>
                <span className="text-[10px] text-muted-foreground text-center">Railgun protocol</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-secondary/30 border border-border/50">
                <Clock className="w-5 h-5 text-blue-400" />
                <span className="text-xs font-medium text-foreground">2-3 min</span>
                <span className="text-[10px] text-muted-foreground text-center">Bridge time</span>
              </div>
            </div>
            {/* Fee info */}
            <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-secondary/20 border border-border/50">
              <span className="text-sm text-muted-foreground">Protocol Fee</span>
              <span className="text-sm font-semibold text-foreground">0.3%</span>
            </div>
            {/* CTA Button */}
            <a
              href="https://libertyswap.finance/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-gradient-to-r from-[var(--hero-green)] to-emerald-600 text-black font-bold text-base hover:opacity-90 transition-opacity"
            >
              <span>🗽</span> Open Liberty Swap <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </Card>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Powered by Liberty Finance — Intent-based cross-chain swaps with Railgun privacy
        </p>
      </div>
    </div>
  );
}
