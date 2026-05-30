import CommunityFeed from "@/components/CommunityFeed";
import QuickVote from "@/components/QuickVote";
import CommunityStats from "@/components/CommunityStats";
import { useNetwork } from "@/contexts/NetworkContext";
import { Newspaper, Twitter, Video, ExternalLink, Flame, RefreshCw, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

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

const EXPLAINER_VIDEO = "/hero-explainer-edited.mp4";
const HERO_LOGO = "/hero-logo-200.webp";

// Fallback static data — used only when API is unavailable
const STATIC_MONSTER_THREADS = [
  {
    id: 51,
    title: "PulseChain Weekly Monster Thread #51",
    author: "@CrypMvs",
    date: "Apr 27, 2026",
    summary: "\u{1F6A8} PulseChain Weekly Monster Thread #51 \u{1F6A8}  Richard's Alpha, PulseChain In Europe, Ladies Night & More Monster Moves! \u{1F525}",
    tags: ["PulseChain: Weekly"],
    url: "https://x.com/CrypMvs/status/2048687020168638465",
  },
  {
    id: 52,
    title: "PulseChain Weekly Monster Thread #52",
    author: "@CrypMvs",
    date: "May 08, 2026",
    summary: "\u{1F6A8} PulseChain Weekly Monster Thread #52 \u{1F6A8} Richard's Teachings, ChangeNow Documentary, Giveaway Frenzy & More Monster Moves! \u{1F525}",
    tags: ["PulseChain: Weekly"],
    url: "https://x.com/CrypMvs/status/2051247846675104165",
  },
];

export default function CommunityHub() {
  const { isPulseChain } = useNetwork();

  // Live API: Fetch MVS content (Weekly Monster Threads + Roundups)
  const mvsQuery = trpc.mvs.list.useQuery({ limit: 20 }, {
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });

  // Live API: Fetch published blog posts (Weekly HERO Blog)
  const blogQuery = trpc.blog.published.useQuery({ limit: 20 }, {
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });

  // Transform MVS data into display format
  const monsterThreads = useMemo(() => {
    if (!mvsQuery.data || mvsQuery.data.length === 0) return STATIC_MONSTER_THREADS;
    return mvsQuery.data.map((item: any) => ({
      id: item.id,
      title: item.content?.slice(0, 80) || `Weekly Thread by ${item.authorHandle}`,
      author: item.authorHandle || item.author,
      date: item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "",
      summary: item.content || "",
      tags: item.weekLabel ? [item.weekLabel] : ["PulseChain: Weekly"],
      url: item.tweetUrl || "https://x.com/crypmvs",
    }));
  }, [mvsQuery.data]);

  // Transform blog data into display format
  const weeklyBlogs = useMemo(() => {
    if (!blogQuery.data || blogQuery.data.length === 0) return [];
    return blogQuery.data.map((post: any) => ({
      id: post.id,
      title: post.title,
      source: post.tweetAuthor || "HERO Blog",
      date: post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "",
      excerpt: post.excerpt || "",
      url: post.tweetUrl || `/community`,
      slug: post.slug,
    }));
  }, [blogQuery.data]);

  const isLoading = mvsQuery.isLoading || blogQuery.isLoading;
  const isLive = (mvsQuery.data && mvsQuery.data.length > 0) || (blogQuery.data && blogQuery.data.length > 0);

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
        {/* Live indicator */}
        <div className="flex items-center justify-center gap-2 mt-2">
          {isLoading ? (
            <span className="flex items-center gap-1 text-xs text-yellow-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading live feed...
            </span>
          ) : isLive ? (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Live Feed Active
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-yellow-500" /> Showing cached data
            </span>
          )}
        </div>
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

      {/* Weekly Monster Threads - LIVE from API */}
      <div className="rounded-xl border border-blue-500/30 bg-card/80 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            <h2 className="font-bold text-lg text-foreground">Weekly Monster Threads</h2>
            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">@CrypMvs</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => mvsQuery.refetch()}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
              disabled={mvsQuery.isFetching}
              title="Refresh feed"
            >
              <RefreshCw className={`w-3 h-3 ${mvsQuery.isFetching ? 'animate-spin' : ''}`} />
            </button>
            <a href="https://x.com/crypmvs" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
              <Twitter className="w-3 h-3" /> Follow
            </a>
          </div>
        </div>
        <div className="space-y-3">
          {monsterThreads.map((thread) => (
            <a
              key={thread.id}
              href={isSafeUrl(thread.url) ? thread.url : "#"}
              target="_blank" rel="noopener noreferrer"
              className="block p-3 rounded-lg border border-border/50 hover:border-blue-500/50 transition-colors bg-background/40"
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-sm text-foreground">{thread.title}</h3>
                <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {thread.author} | {thread.date}
              </p>
              <p className="text-xs text-foreground/80 line-clamp-2">{thread.summary}</p>
              <div className="flex gap-2 mt-2">
                {thread.tags.map((tag) => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-semibold">
                    {tag}
                  </span>
                ))}
              </div>
            </a>
          ))}
          {monsterThreads.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No threads available yet. Check back soon!</p>
          )}
        </div>
      </div>

      {/* Weekly HERO Blog - LIVE from API */}
      <div className="rounded-xl border border-green-500/30 bg-card/80 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-green-400" />
            <h2 className="font-bold text-lg text-foreground">Weekly HERO Blog</h2>
            {isLive && (
              <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">LIVE</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => blogQuery.refetch()}
              className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1 transition-colors"
              disabled={blogQuery.isFetching}
              title="Refresh blog"
            >
              <RefreshCw className={`w-3 h-3 ${blogQuery.isFetching ? 'animate-spin' : ''}`} />
            </button>
            <a href="/community" className="text-xs text-green-400 hover:underline">
              View All Posts →
            </a>
          </div>
        </div>
        <div className="space-y-3">
          {weeklyBlogs.length > 0 ? weeklyBlogs.map((post) => (
            <a
              key={post.id}
              href={isSafeUrl(post.url) ? post.url : "#"}
              target={post.url.startsWith("http") ? "_blank" : undefined}
              rel={post.url.startsWith("http") ? "noopener noreferrer" : undefined}
              className="block p-3 rounded-lg border border-border/50 hover:border-green-500/50 transition-colors bg-background/40"
            >
              <h3 className="font-semibold text-sm text-foreground mb-1">{post.title}</h3>
              <p className="text-xs text-muted-foreground mb-1">
                {post.source} | {post.date}
              </p>
              <p className="text-xs text-foreground/80 line-clamp-2">{post.excerpt}</p>
            </a>
          )) : (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground">
                {blogQuery.isLoading ? "Loading blog posts..." : "No blog posts yet. Generate from the Blog admin panel."}
              </p>
            </div>
          )}
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
