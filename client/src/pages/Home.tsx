/**
 * Home.tsx — HERO Dapp Landing Page
 * Design: Military dark theme, HERO orange/green accent
 * Updates:
 *   - Title: "Trade Smarter on PulseChain & BASE"
 *   - Full hero UN banner (full height, no crop)
 *   - PulseChain/BASE network toggle wired to NetworkContext
 *   - $HERO token → herobase.io/dashboard
 *   - $VETS token → herobase.io/community
 *   - NFT showcase tab → /nft
 *   - Rotating NFT carousel with CDN images
 *   - Tab images on feature cards
 *   - Explainer video → YouTube zpwKPiA1r20
 *   - KYC badge top + bottom
 *   - YouTube plugin footer
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  ArrowLeftRight,
  Zap,
  Clock,
  Target,
  Shield,
  ArrowRight,
  ExternalLink,
  TrendingUp,
  ChevronRight,
  Sprout,
  Newspaper,
  Heart,
  Infinity,
  Gem,
  ChevronLeft,
  Users,
} from "lucide-react";
import { PULSECHAIN_ID, BASE_CHAIN_ID } from "../../../shared/tokens";
import { ThemeToggle } from "../components/ThemeToggle";
import { ExplainerVideoModal } from "../components/ExplainerVideoModal";
import { useNetwork } from "../contexts/NetworkContext";

// ── CDN Asset URLs ──────────────────────────────────────────────────────
const HERO_LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/HerologowithSoldier_092f3ebf.jpg";
const HERO_LOGO_OFFICIAL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/hero-logo-official_808c9ab8.png";
const HERO_BANNER_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/HerobannerUN_342fe48e.jpg";
const BLACKBEARD_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/BlackBeard_94de3f9d.jfif";
const KYC_BADGE_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/KYC-certificate-badge_4bce12b5.png";
const VIC_BANNER_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/vetsincryptobanner1500by500px3to1ratio_85f614f9.png";
const HERO_SUNSET_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/herouniversalgoodstonesunset_905fb0ba.webp";
const HERO_RED_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/heroredearnrewardsusa_86ad1863.webp";
const HERO_BLACK_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/heroblack_03822790.webp";
const HERO_TRUDEFI_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/HeroTruDefi_4b9604ff.jpg";
const VIC_INFOCHART_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/Vetsincryptoinfochartforvets,hero_c1479748.jpg";
const VIC_CAMO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/VICCamo_0f011a9e.png";
const HERO_STONE_FIRE_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/herouniversalstonefire_7f78342f.webp";
const HERO_BANNER_MAIN_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/HEROBannermain_14eb3e3a.jpg";
const PCT_VETS_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/PCTVets_9b3b78ab.png";
const VETS_YT_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/VetsYT_6e388a85.jpeg";

// ── Rotating NFT Showcase ───────────────────────────────────────────────
const NFT_SHOWCASE = [
  { src: HERO_SUNSET_URL, label: "HERO Universal — Stones & Sunset", rarity: "Legendary" },
  { src: HERO_RED_URL, label: "HERO Red — Earn Rewards USA", rarity: "Epic" },
  { src: HERO_BLACK_URL, label: "HERO Black — Dark Edition", rarity: "Rare" },
  { src: HERO_STONE_FIRE_URL, label: "HERO Stone Fire — Universal", rarity: "Legendary" },
  { src: HERO_TRUDEFI_URL, label: "HERO TruDefi Edition", rarity: "Epic" },
  { src: VIC_CAMO_URL, label: "VIC Camo — Military Series", rarity: "Rare" },
  { src: HERO_LOGO_OFFICIAL, label: "HERO Official — Soldier Series", rarity: "Grail" },
  { src: PCT_VETS_URL, label: "PCTVets — Veterans Edition", rarity: "Rare" },
];

const RARITY_COLORS: Record<string, string> = {
  Grail: "text-yellow-300 border-yellow-400/60 bg-yellow-400/10",
  Legendary: "text-purple-300 border-purple-400/60 bg-purple-400/10",
  Epic: "text-blue-300 border-blue-400/60 bg-blue-400/10",
  Rare: "text-green-300 border-green-400/60 bg-green-400/10",
};

// ── Feature Cards ───────────────────────────────────────────────────────
const FEATURES = [
  { icon: ArrowLeftRight, title: "Swap Aggregator", description: "Best rates across PulseX, 9inch, Liberty Swap and more. One click, best price.", href: "/swap", color: "var(--hero-orange)", image: HERO_RED_URL },
  { icon: Zap, title: "Gasless Mode", description: "Trade without gas fees. ERC-4337 Paymaster covers your transactions.", href: "/swap", color: "var(--hero-green)", image: HERO_BLACK_URL },
  { icon: BarChart3, title: "Live Dashboard", description: "Real-time PulseChain stats: gas prices, TVL, volume, and network activity.", href: "/dashboard", color: "var(--hero-orange)", image: VIC_INFOCHART_URL },
  { icon: Clock, title: "DCA Orders", description: "Dollar Cost Average into HERO, VETS, or any PulseChain token automatically.", href: "/dca", color: "var(--hero-green)", image: HERO_SUNSET_URL },
  { icon: Target, title: "Limit Orders", description: "Set your target price and let the system execute when the market hits it.", href: "/limits", color: "var(--hero-orange)", image: HERO_STONE_FIRE_URL },
  { icon: Shield, title: "Approval Manager", description: "Review and revoke token approvals. Protect your wallet from exploits.", href: "/approvals", color: "var(--hero-green)", image: VIC_CAMO_URL },
  { icon: Sprout, title: "HERO Farm", description: "Yield farming across Emit Farm, RhinoFi, and TruFarms. All HERO/VETS pairs.", href: "/farm", color: "var(--hero-green)", image: HERO_TRUDEFI_URL },
  { icon: Newspaper, title: "Media", description: "Influencer mentions, guest posts, and press coverage of the HERO ecosystem.", href: "/media", color: "var(--hero-orange)", image: VETS_YT_URL },
  { icon: Infinity, title: "Tokenomics", description: "Closed-loop flywheel: farm, stake, earn stablecoins, buy HERO.", href: "/tokenomics", color: "var(--hero-green)", image: VIC_BANNER_URL },
  { icon: Gem, title: "NFT Collection", description: "555 military-themed NFTs with rank-based utility. Hold HERO, earn higher rank.", href: "/nft", color: "var(--hero-orange)", image: HERO_LOGO_OFFICIAL },
  { icon: Heart, title: "501(c)(3) Mission", description: "Supporting military veterans and first responders through the VIC Foundation.", href: "/ecosystem", color: "var(--hero-orange)", image: HERO_BANNER_MAIN_URL },
  { icon: Users, title: "Community", description: "Join the HERO veterans community. DAO governance, proposals, and voting.", href: "/community", color: "var(--hero-green)", image: PCT_VETS_URL },
];

// ── NFT Carousel ────────────────────────────────────────────────────────
function NftCarousel() {
  const [current, setCurrent] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  const next = useCallback(() => setCurrent((c) => (c + 1) % NFT_SHOWCASE.length), []);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + NFT_SHOWCASE.length) % NFT_SHOWCASE.length), []);

  useEffect(() => {
    if (!autoPlay) return;
    const t = setInterval(next, 3500);
    return () => clearInterval(t);
  }, [autoPlay, next]);

  const nft = NFT_SHOWCASE[current];

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-[var(--hero-orange)]/30 shadow-2xl"
      style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #1a0a00 100%)" }}
      onMouseEnter={() => setAutoPlay(false)}
      onMouseLeave={() => setAutoPlay(true)}
    >
      <div className="relative aspect-square w-full max-w-sm mx-auto">
        <img
          key={current}
          src={nft.src}
          alt={nft.label}
          className="w-full h-full object-cover"
          style={{ animation: "fadeIn 0.5s ease" }}
        />
        <div className="absolute top-3 left-3">
          <span className={`text-xs font-bold px-2 py-1 rounded-full border ${RARITY_COLORS[nft.rarity] ?? "text-white border-white/30 bg-white/10"}`}>
            {nft.rarity}
          </span>
        </div>
        <div className="absolute top-3 right-3 bg-black/70 rounded-full px-2 py-1 text-xs text-white/70">
          {current + 1} / {NFT_SHOWCASE.length}
        </div>
      </div>
      <div className="px-4 py-3 text-center">
        <p className="text-sm font-semibold text-foreground">{nft.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">HERO NFT Collection — 555 Cards</p>
      </div>
      <div className="flex items-center justify-between px-4 pb-3">
        <button onClick={prev} className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors text-foreground">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex gap-1.5">
          {NFT_SHOWCASE.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)} className={`h-1.5 rounded-full transition-all ${i === current ? "bg-[var(--hero-orange)] w-4" : "bg-border w-1.5"}`} />
          ))}
        </div>
        <button onClick={next} className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors text-foreground">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="px-4 pb-4">
        <Link href="/nft">
          <Button size="sm" className="w-full bg-gradient-to-r from-[var(--hero-orange)] to-[var(--hero-green)] text-foreground border-0 text-xs">
            View Full Collection <Gem className="w-3 h-3 ml-1.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ── Fear & Greed Index ──────────────────────────────────────────────────
function FearGreedIndicator() {
  const [data, setData] = useState<{ value: number; label: string } | null>(null);
  useEffect(() => {
    fetch("https://api.alternative.me/fng/?limit=1")
      .then((r) => r.json())
      .then((d) => {
        const v = parseInt(d.data[0].value, 10);
        setData({ value: v, label: d.data[0].value_classification });
      })
      .catch(() => {});
  }, []);
  if (!data) return null;
  const pct = data.value;
  const color = pct <= 25 ? "#d94040" : pct <= 45 ? "#f5a623" : pct <= 55 ? "#e8b84b" : pct <= 75 ? "#7ec87e" : "#52d98c";
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/80 border border-border text-xs font-medium">
      <span style={{ color }} className="font-bold">{data.value}</span>
      <span className="text-muted-foreground">Fear &amp; Greed:</span>
      <span style={{ color }} className="font-semibold">{data.label}</span>
      <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Chain Explorer Dropdown ──────────────────────────────────────────────
const PULSECHAIN_EXPLORERS = [
  { name: "PulseScan", url: "https://scan.pulsechain.com" },
  { name: "Otherscan", url: "https://otherscan.io" },
  { name: "Otter (Otterscan)", url: "https://otter.pulsechain.com" },
  { name: "Midgard", url: "https://midgard.wtf" },
];
const BASE_EXPLORERS = [
  { name: "BaseScan", url: "https://basescan.org" },
  { name: "Blockscout Base", url: "https://base.blockscout.com" },
  { name: "DexScreener BASE", url: "https://dexscreener.com/base" },
  { name: "Superchain Explorer", url: "https://explorer.optimism.io" },
];
function ExplorerDropdown() {
  const { isPulseChain } = useNetwork();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const explorers = isPulseChain ? PULSECHAIN_EXPLORERS : BASE_EXPLORERS;
  const label = isPulseChain ? "⚡ PulseChain Explorers" : "🔵 BASE Explorers";
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/80 border border-border text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
      >
        {label} <ChevronRight className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 min-w-[180px] rounded-xl border border-border bg-card shadow-xl py-1">
          {explorers.map((e) => (
            <a key={e.name} href={e.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-xs text-foreground hover:bg-secondary transition-colors"
              onClick={() => setOpen(false)}
            >
              <ExternalLink className="w-3 h-3 text-muted-foreground" />
              {e.name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Network Toggle ──────────────────────────────────────────────────────
function NetworkToggle() {
  const { isPulseChain, isBase, switchNetwork } = useNetwork();
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-secondary/80 border border-border">
      <button
        onClick={() => switchNetwork(PULSECHAIN_ID)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isPulseChain ? "bg-[var(--hero-orange)] text-black shadow-md" : "text-muted-foreground hover:text-foreground"}`}
      >
        <span>⚡</span> PulseChain
      </button>
      <button
        onClick={() => switchNetwork(BASE_CHAIN_ID)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isBase ? "bg-blue-600 text-white shadow-md" : "text-muted-foreground hover:text-foreground"}`}
      >
        <span>🔵</span> BASE
      </button>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────
export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Explainer video — YouTube embed */}
      <ExplainerVideoModal videoUrl="https://www.youtube.com/embed/zpwKPiA1r20?autoplay=1&rel=0" isYoutube />

      {/* ── HERO UN Banner — full height, no crop ── */}
      <div className="w-full relative overflow-hidden">
        <img
          src={HERO_BANNER_URL}
          alt="HERO United Nations Banner"
          className="w-full object-cover object-center"
          style={{ height: "clamp(180px, 28vw, 360px)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/60 pointer-events-none" />
        {/* KYC badges */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/70 rounded-full px-3 py-1.5 border border-green-500/40">
          <img src={KYC_BADGE_URL} alt="KYC" className="w-7 h-7" />
          <span className="text-xs text-green-400 font-bold tracking-wide">KYC CERTIFIED</span>
        </div>
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/70 rounded-full px-3 py-1.5 border border-green-500/40">
          <img src={KYC_BADGE_URL} alt="Audited" className="w-7 h-7" />
          <span className="text-xs text-green-400 font-bold tracking-wide">AUDITED</span>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={HERO_LOGO_URL} alt="HERO" className="w-10 h-10 rounded-full object-cover border-2 border-[var(--hero-orange)]/40 shadow-md" onError={(e) => { (e.target as HTMLImageElement).src = HERO_LOGO_OFFICIAL; }} />
            <span className="font-bold text-lg text-foreground">HERO Dapp</span>
          </div>
          <div className="hidden md:flex items-center gap-5 text-sm">
            <Link href="/swap" className="text-muted-foreground hover:text-foreground transition-colors">Swap</Link>
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
            <Link href="/portfolio" className="text-muted-foreground hover:text-foreground transition-colors">Portfolio</Link>
            <Link href="/swap" className="px-3 py-1 rounded-md bg-[var(--hero-orange)]/10 border border-[var(--hero-orange)]/30 text-[var(--hero-orange)] font-semibold hover:bg-[var(--hero-orange)]/20 transition-colors">dApp</Link>
            <Link href="/dca" className="text-muted-foreground hover:text-foreground transition-colors">DCA</Link>
            <Link href="/nft" className="text-muted-foreground hover:text-foreground transition-colors">NFTs</Link>
            <Link href="/farm" className="text-muted-foreground hover:text-foreground transition-colors">Farm</Link>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/swap">
              <Button className="bg-gradient-to-r from-[var(--hero-orange)] to-[var(--hero-green)] text-foreground border-0 text-sm">
                Launch App
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative py-20 md:py-28 overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: `url(${HERO_BANNER_MAIN_URL})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-[var(--hero-orange)]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-40 right-1/4 w-96 h-96 bg-[var(--hero-green)]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/80 border border-border text-xs font-medium text-muted-foreground mb-6">
            <Zap className="w-3.5 h-3.5 text-[var(--hero-orange)]" />
            PulseChain + BASE DEX Aggregator
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-foreground mb-4 leading-tight">
            Trade Smarter on
            <br />
            <span className="gradient-text">PulseChain & BASE</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            The ultimate DEX aggregator for $HERO and $VETS. Best swap rates, gasless transactions,
            DCA orders, limit orders, and portfolio tracking — all in one place.
          </p>

          {/* Fear & Greed + Network Toggle + Explorer Dropdown */}
          <div className="flex flex-wrap justify-center items-center gap-3 mb-8">
            <FearGreedIndicator />
            <NetworkToggle />
            <ExplorerDropdown />
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/swap">
              <Button size="lg" className="bg-gradient-to-r from-[var(--hero-orange)] to-[var(--hero-green)] text-foreground border-0 h-12 px-8 text-base">
                Start Trading <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline" className="border-border h-12 px-8 text-base text-foreground hover:bg-secondary">
                View Dashboard <BarChart3 className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          {/* Token links — $HERO → dashboard, $VETS → community */}
          <div className="flex justify-center gap-4 flex-wrap">
            <a href="https://www.herobase.io/dashboard">
              <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-card border border-border hover:border-[var(--hero-orange)]/50 transition-all hover:shadow-lg cursor-pointer group">
                <img src={HERO_LOGO_OFFICIAL} alt="HERO" className="w-9 h-9 rounded-full border border-[var(--hero-orange)]/30" onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=HERO&background=random&size=36`; }} />
                <div className="text-left">
                  <p className="font-bold text-foreground group-hover:text-[var(--hero-orange)] transition-colors">HERO $HERO</p>
                  <p className="text-xs text-muted-foreground">HERO Token for Veterans</p>
                </div>
                <TrendingUp className="w-4 h-4 text-[var(--hero-green)] ml-2" />
              </div>
            </a>
            <a href="https://www.herobase.io/community">
              <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-card border border-border hover:border-[var(--hero-green)]/50 transition-all hover:shadow-lg cursor-pointer group">
                <img src={VIC_CAMO_URL} alt="VETS" className="w-9 h-9 rounded-full border border-[var(--hero-green)]/30" onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=VETS&background=random&size=36`; }} />
                <div className="text-left">
                  <p className="font-bold text-foreground group-hover:text-[var(--hero-green)] transition-colors">VETS $VETS</p>
                  <p className="text-xs text-muted-foreground">VETERANS</p>
                </div>
                <TrendingUp className="w-4 h-4 text-[var(--hero-green)] ml-2" />
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* ── NFT Showcase + Infochart ── */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="mb-6">
              <Badge className="mb-3 bg-[var(--hero-orange)]/10 text-[var(--hero-orange)] border-[var(--hero-orange)]/30">
                <Gem className="w-3 h-3 mr-1" /> NFT Showcase
              </Badge>
              <h2 className="text-3xl font-bold text-foreground mb-2">555 Military NFTs</h2>
              <p className="text-muted-foreground">
                Dual-chain collection on PulseChain & BASE. 10 categories, 5 rarity tiers,
                4 animated cards. Hold HERO tokens to unlock higher ranks.
              </p>
            </div>
            <NftCarousel />
          </div>
          <div className="space-y-6">
            <img src={VIC_INFOCHART_URL} alt="VetsInCrypto Info Chart" className="w-full rounded-2xl border border-border shadow-xl" />
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Total Supply", value: "555 NFTs" },
                { label: "Chains", value: "PLS + BASE" },
                { label: "Categories", value: "10 Types" },
                { label: "Animated Cards", value: "4 Videos" },
              ].map((stat) => (
                <div key={stat.label} className="bg-card border border-border rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold gradient-text">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
            <Link href="/nft">
              <Button className="w-full bg-gradient-to-r from-[var(--hero-orange)] to-[var(--hero-green)] text-foreground border-0">
                Explore Full Collection <Gem className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features Grid with Tab Images ── */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Everything You Need to <span className="gradient-text">Trade</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Built for the PulseChain community. Powered by veterans, for veterans.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <Link key={feature.title} href={feature.href}>
                <Card className="bg-card border-border hover:border-[var(--hero-orange)]/30 transition-all hover:hero-glow cursor-pointer group h-full overflow-hidden">
                  <div className="relative h-32 overflow-hidden">
                    <img src={feature.image} alt={feature.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-card/90" />
                    <div className="absolute bottom-2 left-3 w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `color-mix(in oklch, ${feature.color}, transparent 80%)` }}>
                      <Icon className="w-4 h-4" style={{ color: feature.color }} />
                    </div>
                  </div>
                  <CardContent className="p-5">
                    <h3 className="text-base font-semibold text-foreground mb-1.5 group-hover:text-[var(--hero-orange)] transition-colors">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                    <div className="mt-3 flex items-center text-xs text-[var(--hero-orange)] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Explore <ChevronRight className="w-3 h-3 ml-0.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="bg-card/50 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { label: "DEX Sources", value: "4+" },
              { label: "Supported Tokens", value: "500+" },
              { label: "Avg Gas Savings", value: "~99%" },
              { label: "Chains", value: "PLS + BASE" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl md:text-4xl font-extrabold gradient-text mb-2">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VIC Banner ── */}
      <section className="w-full">
        <img src={VIC_BANNER_URL} alt="VetsInCrypto Banner" className="w-full object-cover" style={{ maxHeight: "180px", objectPosition: "center" }} />
      </section>

      {/* ── CTA ── */}
      <section className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Ready to <span className="gradient-text">Trade Smarter?</span>
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto mb-8">
          Join thousands of veterans trading on PulseChain and BASE with the HERO ecosystem.
        </p>
        <Link href="/swap">
          <Button size="lg" className="bg-gradient-to-r from-[var(--hero-orange)] to-[var(--hero-green)] text-foreground border-0 h-12 px-10 text-base">
            Launch Swap <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-card/30">
        {/* KYC top of footer */}
        <div className="flex items-center justify-center gap-3 bg-black/60 py-3 border-b border-[var(--hero-orange)]/20">
          <img src={KYC_BADGE_URL} alt="KYC" className="w-9 h-9" />
          <span className="text-xs text-green-400 font-semibold tracking-wider">KYC CERTIFIED — VETS IN CRYPTO PROTOCOL</span>
          <img src={KYC_BADGE_URL} alt="KYC" className="w-9 h-9" />
        </div>

        {/* YouTube */}
        <div className="bg-black/40 py-4 border-b border-border">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="https://www.youtube.com/@LIFEWAVEPATCH1" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-red-600/90 hover:bg-red-600 transition-colors text-white font-semibold text-sm shadow-lg">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              Watch on YouTube
            </a>
            <span className="text-muted-foreground text-xs">@LIFEWAVEPATCH1 — HERO Ecosystem Updates & Community</span>
          </div>
        </div>

        {/* Blackbeard banner */}
        <div className="w-full relative overflow-hidden" style={{ maxHeight: "100px" }}>
          <img src={BLACKBEARD_URL} alt="Footer Banner" className="w-full object-cover object-top" style={{ height: "100px", filter: "brightness(0.8)" }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white/80 text-xs font-bold tracking-widest uppercase">HERO Dapp — Built for Veterans, by Veterans</span>
          </div>
        </div>

        {/* KYC bottom */}
        <div className="flex items-center justify-center gap-3 bg-black/60 py-2 border-t border-[var(--hero-orange)]/20">
          <img src={KYC_BADGE_URL} alt="KYC" className="w-7 h-7" />
          <span className="text-xs text-green-400 font-semibold tracking-wider">AUDITED & KYC VERIFIED</span>
          <img src={KYC_BADGE_URL} alt="KYC" className="w-7 h-7" />
        </div>

        {/* Footer links */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={HERO_LOGO_URL} alt="HERO" className="w-8 h-8 rounded-full object-cover border border-[var(--hero-orange)]/30" onError={(e) => { (e.target as HTMLImageElement).src = HERO_LOGO_OFFICIAL; }} />
              <span className="text-sm text-muted-foreground">HERO Dapp — Built for Veterans, by Veterans</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap justify-center">
              <a href="https://scan.pulsechain.com/token/0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--hero-orange)] flex items-center gap-1">$HERO Contract <ExternalLink className="w-3 h-3" /></a>
              <a href="https://scan.pulsechain.com/token/0x4013abBf94A745EfA7cc848989Ee83424A770060" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--hero-orange)] flex items-center gap-1">$VETS Contract <ExternalLink className="w-3 h-3" /></a>
              <a href="https://x.com/hero501c3" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--hero-orange)] flex items-center gap-1">@HERO501c3 <ExternalLink className="w-3 h-3" /></a>
              <Link href="/nft" className="hover:text-[var(--hero-orange)] flex items-center gap-1">NFT Collection <Gem className="w-3 h-3" /></Link>
              <a href="https://docs.vicfoundation.com" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--hero-orange)] flex items-center gap-1">Whitepaper <ExternalLink className="w-3 h-3" /></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
