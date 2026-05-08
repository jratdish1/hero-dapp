import { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare, Vote, Newspaper, Bell, Users, ExternalLink,
  ThumbsUp, Clock, Filter, RefreshCw, Megaphone, Shield
} from "lucide-react";
import { useNetwork } from "@/contexts/NetworkContext";

// ─── Types ────────────────────────────────────────────────────────────
type FeedItemType = "proposal" | "blog" | "announcement" | "milestone" | "governance";

interface FeedItem {
  id: string;
  type: FeedItemType;
  title: string;
  excerpt: string;
  author: string;
  timestamp: string;
  link: string;
  chain?: "pulsechain" | "base" | "both";
  tags?: string[];
  engagement?: { likes: number; comments: number };
  status?: string;
}

// ─── Demo Feed Data ───────────────────────────────────────────────────
const FEED_ITEMS: FeedItem[] = [
  {
    id: "f1",
    type: "proposal",
    title: "HERO-2A7F: Increase LP Rewards by 15%",
    excerpt: "Proposal to boost LP farming rewards for HERO/WPLS and HERO/DAI pools to attract more liquidity providers.",
    author: "VetsInCrypto.eth",
    timestamp: "2025-05-06T14:30:00Z",
    link: "/dao/proposals/HERO-2A7F",
    chain: "pulsechain",
    tags: ["governance", "farming"],
    engagement: { likes: 47, comments: 12 },
    status: "active",
  },
  {
    id: "f2",
    type: "announcement",
    title: "HERO Token Now Live on BASE Chain",
    excerpt: "The HERO token has officially launched on BASE with Aerodrome and Uniswap V3 liquidity. Bridge now available.",
    author: "HERO Team",
    timestamp: "2025-05-05T10:00:00Z",
    link: "/blog",
    chain: "base",
    tags: ["launch", "multichain"],
    engagement: { likes: 234, comments: 56 },
  },
  {
    id: "f3",
    type: "blog",
    title: "Weekly Farm Yield Report: May 1-7",
    excerpt: "HERO/WPLS APR at 142%, HERO/DAI at 98%. New SquirrelSwap partnership yielding 85% on HERO/WPLS.",
    author: "HERO Analytics",
    timestamp: "2025-05-04T18:00:00Z",
    link: "/blog",
    chain: "both",
    tags: ["yields", "farming", "analytics"],
    engagement: { likes: 89, comments: 23 },
  },
  {
    id: "f4",
    type: "milestone",
    title: "1,000 Unique HERO Holders Reached",
    excerpt: "The HERO community has grown to over 1,000 unique wallet holders across PulseChain and BASE combined.",
    author: "HERO Team",
    timestamp: "2025-05-03T12:00:00Z",
    link: "/tokenomics",
    chain: "both",
    tags: ["milestone", "community"],
    engagement: { likes: 312, comments: 78 },
  },
  {
    id: "f5",
    type: "governance",
    title: "Treasury Report: Q1 2025",
    excerpt: "Total treasury value: $45,200. Breakdown: 60% HERO, 25% stablecoins, 15% LP positions. Full transparency report.",
    author: "Treasury Committee",
    timestamp: "2025-05-02T09:00:00Z",
    link: "/dao/treasury",
    chain: "both",
    tags: ["treasury", "transparency"],
    engagement: { likes: 156, comments: 34 },
  },
  {
    id: "f6",
    type: "proposal",
    title: "HERO-1B3C: Fund Veteran Hackathon Event",
    excerpt: "Allocate 500,000 HERO from treasury to sponsor a veteran-focused Web3 hackathon. Builds awareness and community.",
    author: "MarineDAO.eth",
    timestamp: "2025-05-01T16:00:00Z",
    link: "/dao/proposals/HERO-1B3C",
    chain: "both",
    tags: ["treasury", "community", "veterans"],
    engagement: { likes: 198, comments: 45 },
    status: "passed",
  },
  {
    id: "f7",
    type: "blog",
    title: "How to Bridge HERO from PulseChain to BASE",
    excerpt: "Step-by-step guide for bridging your HERO tokens to BASE chain using the official bridge. Gas tips included.",
    author: "HERO Docs",
    timestamp: "2025-04-30T11:00:00Z",
    link: "/blog",
    chain: "both",
    tags: ["guide", "bridge", "tutorial"],
    engagement: { likes: 67, comments: 19 },
  },
  {
    id: "f8",
    type: "announcement",
    title: "VETS Token Staking Rewards Doubled",
    excerpt: "Starting May 1st, VETS staking rewards are doubled for 30 days. Stake now to earn 2x WPLS reflections.",
    author: "HERO Team",
    timestamp: "2025-04-29T08:00:00Z",
    link: "/stake",
    chain: "pulsechain",
    tags: ["staking", "VETS", "promotion"],
    engagement: { likes: 145, comments: 31 },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<FeedItemType, { icon: typeof Vote; color: string; label: string }> = {
  proposal: { icon: Vote, color: "text-purple-400", label: "Proposal" },
  blog: { icon: Newspaper, color: "text-blue-400", label: "Blog" },
  announcement: { icon: Megaphone, color: "text-[var(--hero-orange)]", label: "Announcement" },
  milestone: { icon: Users, color: "text-[var(--hero-green)]", label: "Milestone" },
  governance: { icon: Shield, color: "text-yellow-400", label: "Governance" },
};

function timeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

// ─── Component ────────────────────────────────────────────────────────
export default function CommunityFeed() {
  const { isPulseChain } = useNetwork();
  const [filter, setFilter] = useState<FeedItemType | "all">("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredItems = useMemo(() => {
    let items = FEED_ITEMS;
    // Filter by chain
    const activeChain = isPulseChain ? "pulsechain" : "base";
    items = items.filter(item => !item.chain || item.chain === "both" || item.chain === activeChain);
    // Filter by type
    if (filter !== "all") {
      items = items.filter(item => item.type === filter);
    }
    return items;
  }, [isPulseChain, filter]);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    refreshTimerRef.current = setTimeout(() => setIsRefreshing(false), 1500);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[var(--hero-orange)]" />
          <h3 className="text-sm font-semibold text-foreground">Community Feed</h3>
          <Badge variant="outline" className="text-[9px] py-0">{filteredItems.length} items</Badge>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          aria-label="Refresh community feed"
          className="text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-1 flex-wrap">
        {(["all", "proposal", "announcement", "blog", "milestone", "governance"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              filter === f
                ? "bg-[var(--hero-orange)]/20 text-[var(--hero-orange)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Feed Items */}
      <div className="space-y-2">
        {filteredItems.map((item) => {
          const config = TYPE_CONFIG[item.type];
          const Icon = config.icon;
          return (
            <Card key={item.id} className="border-border/50 hover:border-[var(--hero-orange)]/30 transition-all">
              <CardContent className="p-3">
                <div className="flex gap-3">
                  <div className={`w-8 h-8 rounded-full bg-background flex items-center justify-center shrink-0 border border-border/50`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant="outline" className={`text-[8px] py-0 px-1 ${config.color} border-current/20`}>
                        {config.label}
                      </Badge>
                      {item.status && (
                        <Badge className={`text-[8px] py-0 px-1 border-0 ${
                          item.status === "active" ? "bg-green-500/20 text-green-400" :
                          item.status === "passed" ? "bg-blue-500/20 text-blue-400" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {item.status}
                        </Badge>
                      )}
                      <span className="text-[9px] text-muted-foreground ml-auto flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {timeAgo(item.timestamp)}
                      </span>
                    </div>
                    <a href={item.link} className="block group">
                      <h4 className="text-sm font-medium text-foreground group-hover:text-[var(--hero-orange)] transition-colors line-clamp-1">
                        {item.title}
                      </h4>
                    </a>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                      {item.excerpt}
                    </p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[9px] text-muted-foreground">by {item.author}</span>
                      {item.engagement && (
                        <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <ThumbsUp className="w-2.5 h-2.5" /> {item.engagement.likes}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <MessageSquare className="w-2.5 h-2.5" /> {item.engagement.comments}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* View All CTA */}
      <div className="text-center">
        <a href="/dao">
          <Button variant="outline" size="sm" className="text-xs border-[var(--hero-orange)]/30 text-[var(--hero-orange)]">
            View All Governance <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </a>
      </div>
    </div>
  );
}
