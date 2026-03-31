import { Link } from "wouter";
import { Button } from "@/components/ui/button";
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
import { HERO_TOKEN, VETS_TOKEN } from "../../../shared/tokens";
import { ThemeToggle } from "../components/ThemeToggle";
import { ExplainerVideoModal } from "../components/ExplainerVideoModal";

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
    title: "HERO Farm",
    description: "Yield farming across Emit Farm, RhinoFi, and TruFarms. All HERO/VETS pairs in one place.",
    href: "/farm",
    color: "var(--hero-green)",
  },
  {
    icon: Newspaper,
    title: "MVS & Blog",
    description: "Weekly Most Valuable Shills and AI-generated blog posts highlighting $HERO and $VETS.",
    href: "/blog",
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
      <ExplainerVideoModal videoUrl="https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/KCDTjud9tRyLDD264mUCsK/hero-explainer-final_c910c53b.mp4" />
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--hero-orange)] to-[var(--hero-green)] flex items-center justify-center">
              <span className="text-foreground font-bold text-base">H</span>
            </div>
            <span className="font-bold text-lg text-foreground">HERO Dapp</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/swap" className="text-muted-foreground hover:text-foreground transition-colors">Swap</Link>
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
            <Link href="/portfolio" className="text-muted-foreground hover:text-foreground transition-colors">Portfolio</Link>
            <Link href="/dca" className="text-muted-foreground hover:text-foreground transition-colors">DCA</Link>
            <Link href="/limits" className="text-muted-foreground hover:text-foreground transition-colors">Limits</Link>
            <Link href="/farm" className="text-muted-foreground hover:text-foreground transition-colors">Farm</Link>
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

      {/* Hero section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--hero-orange)]/5 to-transparent" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-[var(--hero-orange)]/5 rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-96 h-96 bg-[var(--hero-green)]/5 rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-4 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--hero-orange)]/10 border border-[var(--hero-orange)]/20 text-sm text-[var(--hero-orange)] mb-6">
            <Zap className="w-3.5 h-3.5" />
            PulseChain DEX Aggregator
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-foreground mb-6 leading-tight">
            Trade Smarter on
            <br />
            <span className="gradient-text">PulseChain</span>
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
              <div
                key={token.symbol}
                className="flex items-center gap-3 px-5 py-3 rounded-xl bg-card border border-border hover:border-[var(--hero-orange)]/30 transition-colors"
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
                  <p className="text-xs text-muted-foreground">{token.name}</p>
                </div>
                <TrendingUp className="w-4 h-4 text-[var(--hero-green)] ml-2" />
              </div>
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
            Built for the PulseChain community. Powered by veterans, for veterans.
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
                    <p className="text-sm text-muted-foreground leading-relaxed">
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
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Ready to Trade?
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto mb-8">
          Connect your wallet and start trading $HERO and $VETS with the best rates on PulseChain.
        </p>
        <Link href="/swap">
          <Button size="lg" className="bg-gradient-to-r from-[var(--hero-orange)] to-[var(--hero-green)] text-foreground border-0 h-12 px-10 text-base">
            Launch Swap <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/30">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--hero-orange)] to-[var(--hero-green)] flex items-center justify-center">
                <span className="text-foreground font-bold text-sm">H</span>
              </div>
              <span className="text-sm text-muted-foreground">
                HERO Dapp — Built for Veterans, by Veterans
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
