import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// CDN Asset URLs
const HERO_LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/hero-logo-official_808c9ab8.png";
const HERO_BANNER_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/HerobannerUN_342fe48e.jpg";
const BLACKBEARD_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/hero_not_a_hero_footer_40622e74.jpg";
const KYC_BADGE_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/KYC-certificate-badge_4bce12b5.png";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeftRight,
  BarChart3,
  Wallet,
  Clock,
  Target,
  Shield,
  Zap,
  ArrowRight,
  ExternalLink,
  TrendingUp,
  ChevronRight,
  Sprout,
  Newspaper,
  Heart,
  Infinity,
  Gem,
  BookOpen,
  Globe,
} from "lucide-react";
import { HERO_TOKEN, VETS_TOKEN, CDN_ASSETS } from "@shared/tokens";
import { ThemeToggle } from "../components/ThemeToggle";

const FEATURES = [
  {
    icon: ArrowLeftRight,
    title: "Swap Aggregator",
    description: "Best rates across PulseX, 9inch, Liberty Swap and more. One click, best price.",
    href: "/swap",
    color: "var(--hero-orange)",
  },
  {
    icon: Zap,
    title: "Gasless Mode",
    description: "Trade without gas fees. ERC-4337 Paymaster covers your transactions.",
    href: "/swap",
    color: "var(--hero-green)",
  },
  {
    icon: BarChart3,
    title: "Live Dashboard",
    description: "Real-time PulseChain stats: gas prices, TVL, volume, and network activity.",
    href: "/dashboard",
    color: "var(--hero-orange)",
  },
  {
    icon: Clock,
    title: "DCA Orders",
    description: "Dollar Cost Average into HERO, VETS, or any PulseChain token automatically.",
    href: "/dca",
    color: "var(--hero-green)",
  },
  {
    icon: Target,
    title: "Limit Orders",
    description: "Set your target price and let the system execute when the market hits it.",
    href: "/limits",
    color: "var(--hero-orange)",
  },
  {
    icon: Shield,
    title: "Approval Manager",
    description: "Review and revoke token approvals. Protect your wallet from exploits.",
    href: "/approvals",
    color: "var(--hero-green)",
  },
  {
    icon: Sprout,
    title: "HERO Stake",
    description: "Staking across Emit Farm, RhinoFi, and TruFarms. All HERO/VETS pairs in one place.",
    href: "/farm",
    color: "var(--hero-green)",
  },
  {
    icon: Newspaper,
    title: "Media",
    description: "Influencer mentions, guest posts, and press coverage of the HERO ecosystem.",
    href: "/media",
    color: "var(--hero-orange)",
  },
  {
    icon: Infinity,
    title: "Tokenomics",
    description: "Closed-loop flywheel: farm, stake, earn stablecoins, buy HERO. Infinite money printer.",
    href: "/tokenomics",
    color: "var(--hero-green)",
  },
  {
    icon: Gem,
    title: "NFT Collection",
    description: "1,000 military-themed NFTs with rank-based utility. Hold more HERO, earn higher rank.",
    href: "/nft",
    color: "var(--hero-orange)",
  },
  {
    icon: Heart,
    title: "501(c)(3) Mission",
    description: "Supporting military veterans and first responders through the VIC Foundation.",
    href: "/ecosystem",
    color: "var(--hero-orange)",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Explainer video pop-up on first visit */}
      {/* Midgard.wtf Banner */}
      <div className="w-full bg-black py-2.5 border-b border-[var(--hero-orange)]/30">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <a
            href="https://midgard.wtf/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--hero-orange)] hover:text-white font-bold text-sm tracking-wider uppercase transition-colors inline-flex items-center gap-2"
          >
            ⚡ MIDGARD.WTF — Blockchain Explorer for PulseChain ⚡
          </a>
        </div>
      </div>
      {/* Veterans Tagline Banner */}
      <div className="w-full bg-gradient-to-r from-black via-[rgb(15,12,8)] to-black py-2 border-b border-[var(--hero-orange)]/20">
        <p className="text-center text-sm font-bold tracking-[0.25em] uppercase" style={{color: "var(--hero-orange)"}}>
          HERO Dapp — Built for Veterans, by Veterans
        </p>
      </div>
      {/* HERO UN Banner — Full Size Hero Header */}
      <div className="w-full relative" style={{height: '60vh', minHeight: '400px', maxHeight: '700px'}}>
        <img
          src={HERO_BANNER_URL}
          alt="HERO United Nations Banner"
          className="w-full h-full object-cover object-center"
        />
        {/* Bottom gradient fade for clean break */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
        {/* KYC Badge overlay */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm rounded-full px-3 py-1.5 border border-green-500/30">
          <img src={KYC_BADGE_URL} alt="KYC Certified" className="w-8 h-8" />
          <span className="text-xs text-green-400 font-bold tracking-wide">KYC</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={HERO_LOGO_URL}
              alt="HERO Logo"
              className="w-10 h-10 rounded-full object-cover border-2 border-[var(--hero-orange)]/40 shadow-md"
            />
            <span className="font-bold text-lg text-foreground">HERO Dapp</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/swap" className="text-muted-foreground hover:text-foreground transition-colors">Swap</Link>
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
            <Link href="/portfolio" className="text-muted-foreground hover:text-foreground transition-colors">Portfolio</Link>
            <Link href="/bootcamp" className="px-3 py-1 rounded-md bg-[var(--hero-orange)]/10 border border-[var(--hero-orange)]/30 text-[var(--hero-orange)] font-semibold hover:bg-[var(--hero-orange)]/20 transition-colors">Boot Camp</Link>
            <Link href="/dca" className="text-muted-foreground hover:text-foreground transition-colors">DCA</Link>
            <Link href="/limits" className="text-muted-foreground hover:text-foreground transition-colors">Limits</Link>
            <Link href="/stake" className="text-muted-foreground hover:text-foreground transition-colors">Stake</Link>
            <Link href="/tokenomics" className="text-muted-foreground hover:text-foreground transition-colors">Tokenomics</Link>
            <Link href="/nft" className="text-muted-foreground hover:text-foreground transition-colors">NFTs</Link>
            <a href="https://docs.vicfoundation.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">Whitepaper <ExternalLink className="w-3 h-3" /></a>
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

      {/* Hero section with background video */}
      <section className="relative overflow-hidden">
        {/* Background Video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
          src={CDN_ASSETS.tokenomicsVideo}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background" />
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--hero-orange)]/5 to-transparent" />
        
        <div className="relative max-w-7xl mx-auto px-4 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--hero-orange)]/10 border border-[var(--hero-orange)]/20 text-sm text-[var(--hero-orange)] mb-6">
            <Zap className="w-3.5 h-3.5" />
            PulseChain & BASE DEX Aggregator
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-foreground mb-6 leading-tight">
            Trade Smarter on
            <br />
            <span className="gradient-text">PulseChain</span> &amp; <span className="text-blue-400">BASE</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            The ultimate DEX aggregator for $HERO and $VETS. Best swap rates, gasless transactions,
            DCA orders, limit orders, and portfolio tracking — all in one place.
          </p>

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

          {/* Featured tokens */}
          <div className="flex justify-center gap-4 flex-wrap">
            {[HERO_TOKEN, VETS_TOKEN].map((token) => (
              <Link href="/swap"><div
                key={token.symbol}
                className="flex items-center gap-3 px-5 py-3 rounded-xl bg-card border border-border hover:border-[var(--hero-orange)]/30 transition-colors cursor-pointer"
              >
                <img
                  src={token.logoURI}
                  alt={token.symbol}
                  className="w-8 h-8 rounded-full"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${token.symbol}&background=random&size=32`;
                  }}
                />
                <div className="text-left">
                  <p className="font-bold text-foreground">${token.symbol}</p>
                  <p className="text-xs text-white/70">{token.name}</p>
                </div>
                <TrendingUp className="w-4 h-4 text-[var(--hero-green)] ml-2" />
              </div></Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Everything You Need to <span className="gradient-text">Trade</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Built for the PulseChain and Base Communities. Powered by Veterans for Veterans and First Responders.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <Link key={feature.title} href={feature.href}>
                <Card className="bg-card border-border hover:border-[var(--hero-orange)]/30 transition-all hover:hero-glow cursor-pointer group h-full">
                  <CardContent className="p-6">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                      style={{ backgroundColor: `color-mix(in oklch, ${feature.color}, transparent 90%)` }}
                    >
                      <Icon className="w-6 h-6" style={{ color: feature.color }} />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-[var(--hero-orange)] transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-white/90 font-medium leading-relaxed">
                      {feature.description}
                    </p>
                    <div className="mt-4 flex items-center text-xs text-[var(--hero-orange)] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Explore <ChevronRight className="w-3 h-3 ml-0.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Stats section */}
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
                <p className="text-3xl md:text-4xl font-bold gradient-text">{stat.value}</p>
                <p className="text-sm text-white/90 font-medium mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* Bio Wellness — RegenValor */}
      <section className="relative border-y border-border overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{backgroundImage: "url(/regenvalor_hero_bg.webp)", backgroundSize: "cover", backgroundPosition: "center"}} />
        <div className="absolute inset-0 bg-gradient-to-b from-card/80 to-card/90" />
        <div className="relative max-w-7xl mx-auto px-4 py-16">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-orange-500/10 rounded-2xl blur-xl" />
              <div className="relative bg-card/80 rounded-2xl border border-border p-8">
                <a href="https://regenvalor.com" target="_blank" rel="noopener noreferrer">
                  <img
                    src="/regenvalor_og.png"
                    alt="RegenValor Logo"
                    className="w-48 mx-auto mb-6 opacity-90 hover:opacity-100 transition-opacity"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </a>
                <div className="text-center">
                  <Badge className="bg-green-500/20 text-green-300 border-green-500/40 mb-4">Bio Wellness</Badge>
                  <h3 className="text-2xl font-bold text-foreground mb-2">RegenValor</h3>
                  <p className="text-muted-foreground text-sm">Regenerative wellness for those who served</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Heart className="w-5 h-5 text-red-400" />
                <h2 className="text-2xl md:text-3xl font-bold text-foreground">Taking Care of Our Own</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Veterans and first responders sacrifice everything for our communities. RegenValor is our commitment to giving back — 
                providing cutting-edge bio wellness solutions, regenerative health products, and holistic care designed specifically 
                for those who have served.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                From advanced peptide therapies to regenerative medicine, RegenValor bridges the gap between military-grade resilience 
                and modern wellness science. Because the heroes who protect us deserve the best care available.
              </p>
              <div className="flex flex-wrap gap-3 mt-4">
                <Badge className="bg-orange-500/10 text-orange-300 border-orange-500/30">Veteran-Owned</Badge>
                <Badge className="bg-green-500/10 text-green-300 border-green-500/30">Regenerative Health</Badge>
                <Badge className="bg-blue-500/10 text-blue-300 border-blue-500/30">Peptide Therapy</Badge>
                <Badge className="bg-purple-500/10 text-purple-300 border-purple-500/30">Bio Wellness</Badge>
              </div>
              <a href="https://regenvalor.com" target="_blank" rel="noopener noreferrer">
                <Button className="mt-4 bg-gradient-to-r from-green-600 to-green-500 text-white border-0 gap-2">
                  Visit RegenValor <ExternalLink className="w-4 h-4" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Ready to Trade?
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto mb-8">
          Connect your wallet and start trading $HERO and $VETS with the best rates on PulseChain and BASE.
        </p>
        <Link href="/swap">
          <Button size="lg" className="bg-gradient-to-r from-[var(--hero-orange)] to-[var(--hero-green)] text-foreground border-0 h-12 px-10 text-base">
            Launch Swap <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border" style={{background: "rgb(10, 14, 28)"}}>
        {/* YouTube Channel Section */}
        <div className="border-t border-border bg-black/40 py-4">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://www.youtube.com/@LIFEWAVEPATCH1"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-red-600/90 hover:bg-red-600 transition-colors text-white font-semibold text-sm shadow-lg"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              Watch on YouTube
            </a>
            <span className="text-muted-foreground text-xs">@LIFEWAVEPATCH1 — HERO Ecosystem Updates & Community</span>
          </div>
        </div>
        {/* KYC Badge row */}
        <div className="flex items-center justify-center gap-3 bg-black/60 py-2 border-t border-[var(--hero-orange)]/20">
          <img src={KYC_BADGE_URL} alt="KYC Certified" className="w-8 h-8" />
          <span className="text-xs text-green-400 font-semibold tracking-wider">KYC CERTIFIED — VETS IN CRYPTO PROTOCOL</span>
          <img src={KYC_BADGE_URL} alt="KYC Certified" className="w-8 h-8" />
        </div>
        {/* Blackbeard footer banner */}
        <div className="w-full relative overflow-hidden" style={{maxHeight: "350px"}}>
          <img
            src={BLACKBEARD_URL}
            alt="Black Bear Footer"
            className="w-full object-contain"
            style={{height: "350px", objectFit: "cover"}}
          />

        </div>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={HERO_LOGO_URL} alt="HERO Logo" className="w-8 h-8 rounded-full object-cover border border-[var(--hero-orange)]/30" />
              <span className="text-sm font-bold tracking-wide text-muted-foreground">
                HERO Dapp
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-white/70">
              <a
                href="https://scan.pulsechain.com/token/0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--hero-orange)] flex items-center gap-1"
              >
                $HERO Contract <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://scan.pulsechain.com/token/0x4013abBf94A745EfA7cc848989Ee83424A770060"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--hero-orange)] flex items-center gap-1"
              >
                $VETS Contract <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://x.com/hero501c3"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--hero-orange)] flex items-center gap-1"
              >
                @HERO501c3 <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://dashboard.vicfoundation.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--hero-orange)] flex items-center gap-1"
              >
                Dashboard <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://docs.vicfoundation.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--hero-orange)] flex items-center gap-1"
              >
                Whitepaper <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
