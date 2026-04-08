import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  ExternalLink,
  ArrowLeftRight,
  BarChart3,
  Sprout,
  Newspaper,
  Shield,
  Bot,
  Server,
  CheckCircle2,
  Clock,
  Heart,
  Link2,
} from "lucide-react";

interface ProductConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  status: "live" | "coming-soon" | "planned";
  url?: string;
  externalUrl?: string;
  color: string;
  tag?: string;
}

const HERO_PRODUCTS: ProductConfig[] = [
  {
    id: "swap",
    title: "HERO Swap",
    description:
      "PulseChain & BASE DEX aggregator with best swap rates, gasless mode, and smart routing across multiple DEXs for $HERO and $VETS.",
    icon: ArrowLeftRight,
    status: "live",
    url: "/swap",
    color: "var(--hero-orange)",
    tag: "Core",
  },
  {
    id: "farm",
    title: "HERO Farm",
    description:
      "Yield farming hub across partner protocols — Emit Farm, RhinoFi, and TruFarms. All $HERO/$VETS LP pairs in one place.",
    icon: Sprout,
    status: "live",
    url: "/farm",
    color: "var(--hero-green)",
    tag: "Core",
  },
  {
    id: "dashboard",
    title: "Analytics Dashboard",
    description:
      "Real-time chain analytics, gas tracker, TVL metrics, and token performance for PulseChain and BASE networks.",
    icon: BarChart3,
    status: "live",
    url: "/dashboard",
    color: "#3b82f6",
    tag: "Core",
  },
  {
    id: "portfolio",
    title: "Portfolio Tracker",
    description:
      "Track your $HERO and $VETS holdings, P&L, transaction history, and token balances across both chains.",
    icon: Globe,
    status: "live",
    url: "/portfolio",
    color: "#8b5cf6",
    tag: "Core",
  },
  {
    id: "ai",
    title: "Grok AI Assistant",
    description:
      "AI-powered market analysis, scam detection, farm yield strategy, and DeFi Q&A — powered by Grok (xAI).",
    icon: Bot,
    status: "live",
    url: "/ai",
    color: "#f59e0b",
    tag: "AI",
  },
  {
    id: "blog",
    title: "Media",
    description:
      "Influencer mentions, guest posts, and press coverage of the HERO ecosystem and VIC Foundation mission.",
    icon: Newspaper,
    status: "live",
    url: "/media",
    color: "#ec4899",
    tag: "Community",
  },
  {
    id: "dao",
    title: "HERO DAO",
    description:
      "Governance portal for proposals, voting, and treasury management. Community-driven decision making for the 501(c)(3).",
    icon: Shield,
    status: "coming-soon",
    color: "#8b5cf6",
    tag: "Governance",
  },
  {
    id: "api",
    title: "HERO API",
    description:
      "Public API for token data, swap routing, price feeds, and integration with Liberty SDK and PulseChain APIs.",
    icon: Server,
    status: "planned",
    color: "#6366f1",
    tag: "Developer",
  },
];

const PARTNER_LINKS = [
  { name: "Emit Farm", url: "https://emit.farm/", color: "#22c55e" },
  { name: "RhinoFi", url: "https://www.rhinofi.win/dapp", color: "#f97316" },
  { name: "TruFarms", url: "https://trufarms.io/", color: "#3b82f6" },
  { name: "Liberty Swap", url: "https://libertyswap.finance/", color: "#a855f7" },
  { name: "@HERO501c3", url: "https://x.com/hero501c3", color: "#1d9bf0" },
  { name: "@CrypMvs", url: "https://x.com/crypmvs", color: "#1d9bf0" },
];

function StatusBadge({ status }: { status: ProductConfig["status"] }) {
  if (status === "live") {
    return (
      <Badge className="bg-[var(--hero-green)]/10 text-[var(--hero-green)] border-[var(--hero-green)]/20 text-[10px]">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Live
      </Badge>
    );
  }
  if (status === "coming-soon") {
    return (
      <Badge className="bg-[var(--hero-orange)]/10 text-[var(--hero-orange)] border-[var(--hero-orange)]/20 text-[10px]">
        <Clock className="w-3 h-3 mr-1" />
        Coming Soon
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] text-muted-foreground">
      <Clock className="w-3 h-3 mr-1" />
      Planned
    </Badge>
  );
}

export default function Subdomains() {
  const liveCount = HERO_PRODUCTS.filter((s) => s.status === "live").length;
  const totalCount = HERO_PRODUCTS.length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Globe className="w-6 h-6 text-[var(--hero-orange)]" />
          HERO Ecosystem
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          All HERO products and services — {liveCount} of {totalCount} live
        </p>
      </div>

      {/* Mission banner */}
      <Card className="border-[var(--hero-orange)]/20 bg-gradient-to-r from-[var(--hero-orange)]/5 to-[var(--hero-green)]/5">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/hero-logo-official_808c9ab8.png"
              alt="HERO Logo"
              className="w-10 h-10 rounded-full object-cover border-2 border-[var(--hero-orange)]/40 shadow-md"
            />
            <div>
              <h3 className="font-bold text-foreground">HERO — Supporting Those Who Served</h3>
              <p className="text-xs text-muted-foreground">
                501(c)(3) Nonprofit — DeFi for Military Veterans & First Responders
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-4">
            The HERO ecosystem is built to support military veterans and first responders through decentralized finance.
            Every product, every farm, every swap — it all feeds back into the mission. Available on PulseChain and BASE networks.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center p-2.5 rounded-lg bg-secondary/50">
              <p className="text-2xl font-bold text-[var(--hero-orange)]">{liveCount}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Live</p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-secondary/50">
              <p className="text-2xl font-bold text-[var(--hero-green)]">
                {HERO_PRODUCTS.filter((s) => s.status === "coming-soon").length}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Coming Soon</p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-secondary/50">
              <p className="text-2xl font-bold text-muted-foreground">2</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Chains</p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-secondary/50">
              <p className="text-2xl font-bold text-foreground">3</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Farm Partners</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {HERO_PRODUCTS.map((product) => {
          const Icon = product.icon;
          return (
            <Card
              key={product.id}
              className={`border-border/50 bg-card/80 transition-all ${
                product.status === "live" ? "hover:shadow-md hover:border-border" : "opacity-80"
              }`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${product.color}20, ${product.color}10)`,
                        border: `1px solid ${product.color}30`,
                      }}
                    >
                      <Icon className="w-4.5 h-4.5" style={{ color: product.color }} />
                    </div>
                    <div>
                      <CardTitle className="text-sm flex items-center gap-2">
                        {product.title}
                        {product.tag && (
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{
                              background: `${product.color}15`,
                              color: product.color,
                            }}
                          >
                            {product.tag}
                          </span>
                        )}
                      </CardTitle>
                    </div>
                  </div>
                  <StatusBadge status={product.status} />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {product.description}
                </p>
                {product.status === "live" && product.url && (
                  <a href={product.url} className="block mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      style={{
                        borderColor: `${product.color}30`,
                        color: product.color,
                      }}
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                      Open
                    </Button>
                  </a>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Partner & Community Links */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[var(--hero-orange)]" />
            Partners & Community
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {PARTNER_LINKS.map((link) => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  style={{ borderColor: `${link.color}30`, color: link.color }}
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  {link.name}
                </Button>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
