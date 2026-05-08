import CommunityFeed from "@/components/CommunityFeed";
import QuickVote from "@/components/QuickVote";
import CommunityStats from "@/components/CommunityStats";
import { useNetwork } from "@/contexts/NetworkContext";
import { Newspaper, Twitter, Video, ExternalLink, Flame } from "lucide-react";

// URL validation to prevent XSS via javascript: or data: URLs
function isSafeUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return url.startsWith('/'); // Allow relative paths
  }
}


const EXPLAINER_VIDEO = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/hFXqEKDGLjZqGGBP.mp4";
const HERO_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/hero-logo-official_808c9ab8.png";

// Weekly Monster Threads from @CrypMvs
const MONSTER_THREADS = [
  {
    id: 1,
    title: "Weekly HERO Ecosystem Roundup — May 4, 2026",
    author: "@CrypMvs",
    date: "May 4, 2026",
    summary: "Farm yields update: $VETS/$EMIT 147% APR | $HERO/$EMIT 127% APR | $HERO/$PLS 154% APR | TruFarm SSS 221% APR",
    tags: ["$HERO: Trending", "$VETS: Trending"],
    url: "https://x.com/crypmvs",
  },
  {
    id: 2,
    title: "Weekly HERO Ecosystem Roundup — April 27, 2026",
    author: "@CrypMvs",
    date: "Apr 27, 2026",
    summary: "New partnerships announced. HERO single-sided staking live with 500 DAI reward pool. Community treasury at 4.9M PLS.",
    tags: ["$HERO: Growth", "Staking: Live"],
    url: "https://x.com/crypmvs",
  },
  {
    id: 3,
    title: "Weekly HERO Ecosystem Roundup — April 20, 2026",
    author: "@CrypMvs",
    date: "Apr 20, 2026",
    summary: "HeroBase.io DApp launch on BASE chain. Multi-chain aggregation now live. DAO governance proposal system deployed.",
    tags: ["$HERO: BASE Launch", "DApp: Live"],
    url: "https://x.com/crypmvs",
  },
];

// Weekly Blog Posts
const WEEKLY_BLOGS = [
  {
    id: 1,
    title: "Veteran-Led DeFi: How $HERO is Building a Benevolent Protocol",
    source: "VIC Foundation Blog",
    date: "Apr 28, 2026",
    excerpt: "An in-depth look at how the HERO token ecosystem leverages DeFi yield farming to fund veteran and first responder support programs through the 501(c)(3) VIC Foundation.",
    url: "/community",
  },
  {
    id: 2,
    title: "PulseChain DeFi Projects to Watch in 2026",
    source: "PulseChain Community",
    date: "Apr 21, 2026",
    excerpt: "HERO DApp highlighted as a standout project combining multi-DEX aggregation with a charitable mission.",
    url: "/community",
  },
  {
    id: 3,
    title: "Weekly Farm Yield Report: May 1-7",
    source: "HERO Analytics",
    date: "May 7, 2026",
    excerpt: "Top performing pools this week: VETS/EMIT at 147% APR, HERO/PLS at 154% APR. Single-sided staking reward pool funded.",
    url: "/community",
  },
];

export default function CommunityHub() {
  const { isPulseChain } = useNetwork();
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Page Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          HERO Community Hub
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Weekly Blog, Monster Threads, Governance & Community Updates
        </p>
      </div>

      {/* Community Stats Banner */}
      <CommunityStats />

      {/* HERO Ecosystem Explainer Video */}
      <div className="rounded-xl border border-[var(--hero-orange)]/30 bg-card/80 backdrop-blur-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Video className="w-5 h-5 text-[var(--hero-orange)]" />
          <h2 className="font-bold text-lg text-foreground">HERO Ecosystem Explainer</h2>
        </div>
        <div className="aspect-video rounded-lg overflow-hidden border border-[var(--hero-orange)]/20">
          <video
            controls
            preload="metadata"
            className="w-full h-full object-cover"
            poster={HERO_LOGO}
          >
            <source src={EXPLAINER_VIDEO} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Quick overview of the HERO ecosystem — Built for Veterans, by Veterans
        </p>
      </div>

      {/* Weekly Monster Threads */}
      <div className="rounded-xl border border-blue-500/30 bg-card/80 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            <h2 className="font-bold text-lg text-foreground">Weekly Monster Threads</h2>
            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">@CrypMvs</span>
          </div>
          <a href="https://x.com/crypmvs" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
            <Twitter className="w-3 h-3" /> Follow
          </a>
        </div>
        <div className="space-y-3">
          {MONSTER_THREADS.map((thread) => (
            <a
              key={thread.id}
              href={isSafeUrl(thread.url) ? thread.url : "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 rounded-lg border border-border/50 hover:border-blue-500/50 transition-colors bg-background/40"
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-sm text-foreground">{thread.title}</h3>
                <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {thread.author} | {thread.date}
              </p>
              <p className="text-xs text-foreground/80">{thread.summary}</p>
              <div className="flex gap-2 mt-2">
                {thread.tags.map((tag) => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-semibold">
                    {tag}
                  </span>
                ))}
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Weekly HERO Blog */}
      <div className="rounded-xl border border-green-500/30 bg-card/80 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-green-400" />
            <h2 className="font-bold text-lg text-foreground">Weekly HERO Blog</h2>
          </div>
          <a href="/community" className="text-xs text-green-400 hover:underline">
            View All Posts →
          </a>
        </div>
        <div className="space-y-3">
          {WEEKLY_BLOGS.map((post) => (
            <a
              key={post.id}
              href={isSafeUrl(post.url) ? post.url : "#"}
              className="block p-3 rounded-lg border border-border/50 hover:border-green-500/50 transition-colors bg-background/40"
            >
              <h3 className="font-semibold text-sm text-foreground mb-1">{post.title}</h3>
              <p className="text-xs text-muted-foreground mb-1">
                {post.source} | {post.date}
              </p>
              <p className="text-xs text-foreground/80">{post.excerpt}</p>
            </a>
          ))}
        </div>
      </div>

      {/* Two Column Layout: Feed + Voting */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Community Feed - 2/3 width */}
        <div className="lg:col-span-2">
          <CommunityFeed />
        </div>
        {/* Quick Vote Sidebar - 1/3 width */}
        <div>
          <QuickVote />
        </div>
      </div>
    </div>
  );
}
