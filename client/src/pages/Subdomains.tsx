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
} from "lucide-react";

interface SubdomainConfig {
  subdomain: string;
  fullDomain: string;
  title: string;
  description: string;
  icon: React.ElementType;
  status: "live" | "coming-soon" | "planned";
  url?: string;
  color: string;
}

const SUBDOMAINS: SubdomainConfig[] = [
  {
    subdomain: "app",
    fullDomain: "app.vicfoundation.com",
    title: "HERO Dapp",
    description:
      "PulseChain DEX aggregator with swap, DCA orders, limit orders, and portfolio tracking for $HERO and $VETS.",
    icon: ArrowLeftRight,
    status: "live",
    url: "#",
    color: "var(--hero-orange)",
  },
  {
    subdomain: "farm",
    fullDomain: "farm.vicfoundation.com",
    title: "HERO Farm",
    description:
      "Yield farming hub across partner protocols — Emit Farm, RhinoFi, and TruFarms. All $HERO/$VETS pairs in one place.",
    icon: Sprout,
    status: "live",
    url: "/farm",
    color: "var(--hero-green)",
  },
  {
    subdomain: "dao",
    fullDomain: "dao.vicfoundation.com",
    title: "HERO DAO",
    description:
      "Governance portal for proposals, voting, and treasury management. Community-driven decision making for the 501(c)(3).",
    icon: Shield,
    status: "coming-soon",
    color: "#8b5cf6",
  },
  {
    subdomain: "dash",
    fullDomain: "dash.vicfoundation.com",
    title: "Analytics Dashboard",
    description:
      "Real-time PulseChain analytics, arb bot monitoring, gas tracker, and token performance metrics.",
    icon: BarChart3,
    status: "live",
    url: "/dashboard",
    color: "#3b82f6",
  },
  {
    subdomain: "blog",
    fullDomain: "blog.vicfoundation.com",
    title: "MVS Blog",
    description:
      "Weekly Most Valuable Shills coverage, AI-generated blog posts highlighting $HERO and $VETS ecosystem updates.",
    icon: Newspaper,
    status: "live",
    url: "/blog",
    color: "#ec4899",
  },
  {
    subdomain: "api",
    fullDomain: "api.vicfoundation.com",
    title: "API Services",
    description:
      "Backend API for token data, swap routing, price feeds, and integration with Liberty SDK and PulseChain APIs.",
    icon: Server,
    status: "planned",
    color: "#6366f1",
  },
  {
    subdomain: "ai",
    fullDomain: "ai.vicfoundation.com",
    title: "Grok AI Assistant",
    description:
      "AI-powered market analysis, scam detection, and community Q&A powered by Grok (xAI) integration.",
    icon: Bot,
    status: "coming-soon",
    color: "#f59e0b",
  },
  {
    subdomain: "docs",
    fullDomain: "docs.vicfoundation.com",
    title: "Documentation",
    description:
      "Technical docs, smart contract audits, integration guides, and developer resources for the HERO ecosystem.",
    icon: Globe,
    status: "planned",
    color: "#14b8a6",
  },
];

function StatusBadge({ status }: { status: SubdomainConfig["status"] }) {
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
  const liveCount = SUBDOMAINS.filter((s) => s.status === "live").length;
  const totalCount = SUBDOMAINS.length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Globe className="w-6 h-6 text-[var(--hero-orange)]" />
          Subdomain Architecture
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          vicfoundation.com ecosystem — {liveCount} of {totalCount} services active
        </p>
      </div>

      {/* Domain overview */}
      <Card className="border-[var(--hero-orange)]/20 bg-gradient-to-r from-[var(--hero-orange)]/5 to-[var(--hero-green)]/5">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--hero-orange)] to-[var(--hero-green)] flex items-center justify-center">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">vicfoundation.com</h3>
              <p className="text-xs text-muted-foreground">
                501(c)(3) Nonprofit — Supporting Veterans & First Responders
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="text-center p-2.5 rounded-lg bg-secondary/50">
              <p className="text-2xl font-bold text-[var(--hero-orange)]">{liveCount}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Live</p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-secondary/50">
              <p className="text-2xl font-bold text-[var(--hero-green)]">
                {SUBDOMAINS.filter((s) => s.status === "coming-soon").length}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Coming Soon</p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-secondary/50">
              <p className="text-2xl font-bold text-muted-foreground">
                {SUBDOMAINS.filter((s) => s.status === "planned").length}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Planned</p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-secondary/50">
              <p className="text-2xl font-bold text-foreground">{totalCount}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subdomain grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {SUBDOMAINS.map((sub) => {
          const Icon = sub.icon;
          return (
            <Card
              key={sub.subdomain}
              className={`border-border/50 bg-card/80 hover:border-[${sub.color}]/30 transition-all ${
                sub.status === "live" ? "hover:shadow-md" : "opacity-80"
              }`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${sub.color}20, ${sub.color}10)`,
                        border: `1px solid ${sub.color}30`,
                      }}
                    >
                      <Icon className="w-4.5 h-4.5" style={{ color: sub.color }} />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{sub.title}</CardTitle>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">
                        {sub.fullDomain}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={sub.status} />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {sub.description}
                </p>
                {sub.status === "live" && sub.url && (
                  <a href={sub.url} className="block mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      style={{
                        borderColor: `${sub.color}30`,
                        color: sub.color,
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
    </div>
  );
}
