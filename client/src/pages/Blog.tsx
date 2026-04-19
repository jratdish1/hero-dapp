import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Newspaper,
  ExternalLink,
  Twitter,
  Calendar,
  Tag,
  TrendingUp,
  Sparkles,
  RefreshCw,
  Globe,
  Mic,
  Users,
  Award,
  Heart,
  MessageCircle,
  Repeat2,
  Quote,
  Star,
  Filter,
  Pin,
  PinOff,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

// ─── DRY: Reusable helpers ──────────────────────────────────────────

function TokenBadge({ symbol, variant }: { symbol: string; variant: "hero" | "vets" }) {
  const color = variant === "hero" ? "var(--hero-orange)" : "var(--hero-green)";
  return (
    <Badge
      className="text-[10px]"
      style={{
        backgroundColor: `color-mix(in oklch, ${color} 10%, transparent)`,
        color,
        borderColor: `color-mix(in oklch, ${color} 20%, transparent)`,
      }}
    >
      {symbol}
    </Badge>
  );
}

function DateLabel({ date }: { date: string | Date | null }) {
  if (!date) return null;
  return (
    <span className="text-xs text-muted-foreground flex items-center gap-1">
      <Calendar className="w-3 h-3" />
      {typeof date === "string" ? date : new Date(date).toLocaleDateString()}
    </span>
  );
}

function EngagementStat({ icon: Icon, count, label }: { icon: React.ElementType; count: number; label: string }) {
  if (count === 0) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground" title={label}>
      <Icon className="w-3 h-3" />
      {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const styles: Record<string, string> = {
    influencer: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    community: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    press: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    partner: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };
  return (
    <Badge variant="outline" className={`text-[10px] ${styles[category] || ""}`}>
      {category}
    </Badge>
  );
}

// ─── Live Mention Card with Pin/Highlight controls ──────────────────

function LiveMentionCard({
  mention,
  isAuthenticated,
  onTogglePin,
  onToggleHighlight,
}: {
  mention: any;
  isAuthenticated: boolean;
  onTogglePin: (id: number, isPinned: boolean) => void;
  onToggleHighlight: (id: number, isHighlighted: boolean) => void;
}) {
  const typeIcon = mention.mentionType === "retweet" ? Repeat2 : mention.mentionType === "quote" ? Quote : Twitter;
  const TypeIcon = typeIcon;

  return (
    <Card className={`border-border/50 bg-card/80 hover:border-[var(--hero-orange)]/30 transition-all ${
      mention.isPinned ? "ring-2 ring-[var(--hero-orange)]/40 border-[var(--hero-orange)]/30" : ""
    } ${mention.isHighlighted ? "ring-1 ring-[var(--hero-orange)]/20" : ""}`}>
      <CardContent className="p-5">
        {/* Pinned indicator */}
        {mention.isPinned && (
          <div className="flex items-center gap-1.5 mb-2 text-[var(--hero-orange)]">
            <Pin className="w-3 h-3" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Pinned</span>
          </div>
        )}

        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3">
            {mention.authorProfileImageUrl && (
              <img
                src={mention.authorProfileImageUrl}
                alt={mention.authorUsername}
                className="w-10 h-10 rounded-full border border-border/50 shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-foreground text-sm">
                  {mention.authorDisplayName || mention.authorUsername}
                </h3>
                <span className="text-xs text-muted-foreground">@{mention.authorUsername}</span>
                {mention.isHighlighted && <Star className="w-3 h-3 text-[var(--hero-orange)]" />}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                <TypeIcon className="w-3 h-3" />
                <span className="capitalize">{mention.mentionType?.replace("_", " ")}</span>
                <span className="text-border">|</span>
                <DateLabel date={mention.tweetCreatedAt} />
                <CategoryBadge category={mention.category} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Admin controls: Pin & Highlight */}
            {isAuthenticated && (
              <>
                <Button
                  size="sm" variant="ghost"
                  className={`h-7 w-7 p-0 ${mention.isPinned ? "text-[var(--hero-orange)]" : "text-muted-foreground hover:text-[var(--hero-orange)]"}`}
                  title={mention.isPinned ? "Unpin" : "Pin to Top"}
                  onClick={() => onTogglePin(mention.id, !mention.isPinned)}
                >
                  {mention.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                </Button>
                <Button
                  size="sm" variant="ghost"
                  className={`h-7 w-7 p-0 ${mention.isHighlighted ? "text-[var(--hero-orange)]" : "text-muted-foreground hover:text-[var(--hero-orange)]"}`}
                  title={mention.isHighlighted ? "Remove highlight" : "Highlight"}
                  onClick={() => onToggleHighlight(mention.id, !mention.isHighlighted)}
                >
                  <Star className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
            <a href={mention.tweetUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="border-border/50">
                <ExternalLink className="w-3 h-3 mr-1" />
                View
              </Button>
            </a>
          </div>
        </div>

        <div className="flex gap-2 mb-3 flex-wrap">
          {mention.heroMentioned && <TokenBadge symbol="$HERO" variant="hero" />}
          {mention.vetsMentioned && <TokenBadge symbol="$VETS" variant="vets" />}
        </div>

        <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
          {mention.tweetText}
        </p>

        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30">
          <EngagementStat icon={Heart} count={mention.likeCount || 0} label="Likes" />
          <EngagementStat icon={Repeat2} count={mention.retweetCount || 0} label="Retweets" />
          <EngagementStat icon={MessageCircle} count={mention.replyCount || 0} label="Replies" />
          <EngagementStat icon={Quote} count={mention.quoteCount || 0} label="Quotes" />
          {mention.authorFollowerCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto" title="Author followers">
              <Users className="w-3 h-3" />
              {mention.authorFollowerCount >= 1000
                ? `${(mention.authorFollowerCount / 1000).toFixed(1)}k followers`
                : `${mention.authorFollowerCount} followers`}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Static Mention Card (fallback) ────────────────────────────────

function StaticMentionCard({
  title, sourceUrl, source, date, content, heroPrice, vetsPrice, farmYields, sourceType = "twitter",
}: {
  title: string; sourceUrl: string; source: string; date: string; content: string;
  heroPrice?: string; vetsPrice?: string; farmYields?: string;
  sourceType?: "twitter" | "blog" | "podcast" | "news";
}) {
  const SourceIcon = sourceType === "twitter" ? Twitter : sourceType === "podcast" ? Mic : Globe;
  return (
    <Card className="border-border/50 bg-card/80 hover:border-[var(--hero-orange)]/30 transition-all">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-bold text-foreground">{title}</h3>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <SourceIcon className="w-3 h-3" />
              <span>{source}</span>
              <span className="text-border">|</span>
              <DateLabel date={date} />
            </div>
          </div>
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="border-border/50 shrink-0">
              <ExternalLink className="w-3 h-3 mr-1" />
              View
            </Button>
          </a>
        </div>
        {(heroPrice || vetsPrice) && (
          <div className="flex gap-3 mb-3">
            {heroPrice && <TokenBadge symbol={`$HERO: ${heroPrice}`} variant="hero" />}
            {vetsPrice && <TokenBadge symbol={`$VETS: ${vetsPrice}`} variant="vets" />}
          </div>
        )}
        <p className="text-sm text-muted-foreground line-clamp-3">{content}</p>
        {farmYields && (
          <div className="mt-3 p-2.5 rounded-lg bg-secondary/50 border border-border/30">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3 h-3 text-[var(--hero-green)]" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Farm Yields</span>
            </div>
            <p className="text-xs text-foreground">{farmYields}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Article Card ──────────────────────────────────────────────────

function ArticleCard({
  title, slug, excerpt, publishedAt, tags, heroMentioned, vetsMentioned,
}: {
  title: string; slug: string; excerpt?: string | null; publishedAt?: Date | null;
  tags?: string | null; heroMentioned?: boolean | null; vetsMentioned?: boolean | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const postQuery = trpc.blog.bySlug.useQuery({ slug }, { enabled: expanded });

  return (
    <Card className="border-border/50 bg-card/80 hover:border-[var(--hero-orange)]/30 transition-all">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="font-bold text-foreground">{title}</h3>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {publishedAt && <DateLabel date={publishedAt} />}
              {heroMentioned && <TokenBadge symbol="$HERO" variant="hero" />}
              {vetsMentioned && <TokenBadge symbol="$VETS" variant="vets" />}
            </div>
          </div>
        </div>
        {excerpt && !expanded && <p className="text-sm text-muted-foreground mt-3">{excerpt}</p>}
        {tags && (
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            <Tag className="w-3 h-3 text-muted-foreground" />
            {tags.split(",").map((tag) => (
              <Badge key={tag.trim()} variant="outline" className="text-[10px] py-0">{tag.trim()}</Badge>
            ))}
          </div>
        )}
        {expanded && postQuery.data && (
          <div className="mt-4 p-4 rounded-lg bg-secondary/30 border border-border/30 prose prose-sm prose-invert max-w-none">
            <Streamdown>{postQuery.data.content}</Streamdown>
          </div>
        )}
        <Button
          size="sm" variant="ghost"
          className="mt-3 text-[var(--hero-orange)] hover:text-[var(--hero-orange)] hover:bg-[var(--hero-orange)]/10"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Collapse" : "Read Full Article"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Static Data ───────────────────────────────────────────────────

const FEATURED_MENTIONS = [
  {
    title: "Weekly HERO Ecosystem Roundup — March 30, 2026",
    sourceUrl: "https://x.com/crypmvs/status/2038513610360836215",
    source: "@CrypMvs", date: "Mar 30, 2026", sourceType: "twitter" as const,
    content: "This week's roundup featuring $HERO and $VETS on PulseChain. Farm yields looking strong across Emit Farm, TruFarms, and RhinoFi. The VIC Foundation continues to build for veterans and first responders.",
    heroPrice: "Trending", vetsPrice: "Trending",
    farmYields: "$VETS/$EMIT: 147% APR | $HERO/$EMIT: 127% APR | $HERO/$PLS: 154% APR | TruFarm SSS: 221% APR",
  },
  {
    title: "Veteran-Led DeFi: How $HERO Is Building a Benevolent Protocol",
    sourceUrl: "https://www.vicfoundation.com", source: "VIC Foundation Blog",
    date: "Mar 25, 2026", sourceType: "blog" as const,
    content: "An in-depth look at how the HERO token ecosystem leverages DeFi yield farming to fund veteran and first responder support programs through the 501(c)(3) VIC Foundation.",
  },
  {
    title: "PulseChain DeFi Projects to Watch in 2026",
    sourceUrl: "https://pulsechain.com", source: "PulseChain Community",
    date: "Mar 20, 2026", sourceType: "news" as const,
    content: "HERO Dapp highlighted as a standout project combining multi-DEX aggregation with a charitable mission.",
  },
];

const GUEST_POST_TARGETS = [
  { name: "Forbes Crypto", url: "https://www.forbes.com/crypto-blockchain/", status: "Pitching", icon: "📰" },
  { name: "CoinDesk", url: "https://www.coindesk.com/", status: "Planned", icon: "📊" },
  { name: "Decrypt", url: "https://decrypt.co/", status: "Planned", icon: "🔓" },
  { name: "The Block", url: "https://www.theblock.co/", status: "Planned", icon: "🧱" },
  { name: "Cointelegraph", url: "https://cointelegraph.com/", status: "Planned", icon: "📡" },
  { name: "Military Times", url: "https://www.militarytimes.com/", status: "Pitching", icon: "🎖️" },
];

// ─── Scheduler Status Indicator ────────────────────────────────────

function SchedulerIndicator() {
  const statusQuery = trpc.influencer.schedulerStatus.useQuery(undefined, { refetchInterval: 60000 });
  const status = statusQuery.data;
  if (!status) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {status.isActive ? (
        <CheckCircle2 className="w-3 h-3 text-[var(--hero-green)]" />
      ) : (
        <Clock className="w-3 h-3 text-muted-foreground" />
      )}
      <span>
        Auto-refresh: {status.isActive ? `every ${status.intervalHours}h` : "off"}
        {status.lastRunAt && ` · Last: ${new Date(status.lastRunAt).toLocaleTimeString()}`}
        {status.lastRunResult && ` (${status.lastRunResult.newCount} new)`}
      </span>
    </div>
  );
}

// ─── Main Media Page ────────────────────────────────────────────────

export default function Blog() {
  const { isAuthenticated } = useAuth();
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const utils = trpc.useUtils();

  // Live data from DB
  const mentionsQuery = trpc.influencer.list.useQuery(
    { category: categoryFilter as any, limit: 50 },
    { refetchInterval: 60000 }
  );
  const statsQuery = trpc.influencer.stats.useQuery(undefined, { refetchInterval: 60000 });
  const blogQuery = trpc.blog.published.useQuery({});

  // Mutations
  const refreshMutation = trpc.influencer.refresh.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.influencer.list.invalidate();
      utils.influencer.stats.invalidate();
    },
    onError: (err) => toast.error(`Refresh failed: ${err.message}`),
  });

  const generateMutation = trpc.blog.generateFromMvs.useMutation({
    onSuccess: (data) => {
      toast.success(`Article created: ${data.title}`);
      utils.blog.published.invalidate();
    },
    onError: (err) => toast.error(`Failed to generate: ${err.message}`),
  });

  // Pin/Highlight mutations (optimistic updates — DRY pattern)
  const pinMutation = trpc.influencer.togglePin.useMutation({
    onMutate: async ({ id, isPinned }) => {
      await utils.influencer.list.cancel();
      const prev = utils.influencer.list.getData();
      utils.influencer.list.setData({ category: categoryFilter as any, limit: 50 }, (old: any) =>
        old?.map((m: any) => m.id === id ? { ...m, isPinned } : m)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.influencer.list.setData({ category: categoryFilter as any, limit: 50 }, ctx.prev);
      toast.error("Failed to update pin");
    },
    onSettled: () => utils.influencer.list.invalidate(),
  });

  const highlightMutation = trpc.influencer.toggleHighlight.useMutation({
    onMutate: async ({ id, isHighlighted }) => {
      await utils.influencer.list.cancel();
      const prev = utils.influencer.list.getData();
      utils.influencer.list.setData({ category: categoryFilter as any, limit: 50 }, (old: any) =>
        old?.map((m: any) => m.id === id ? { ...m, isHighlighted } : m)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.influencer.list.setData({ category: categoryFilter as any, limit: 50 }, ctx.prev);
      toast.error("Failed to update highlight");
    },
    onSettled: () => utils.influencer.list.invalidate(),
  });

  const hasLiveMentions = (mentionsQuery.data?.length ?? 0) > 0;
  const stats = statsQuery.data;

  const filterOptions = useMemo(() => [
    { value: undefined, label: "All", count: stats?.total },
    { value: "influencer", label: "Influencers", count: stats?.influencer },
    { value: "community", label: "Community", count: stats?.community },
    { value: "press", label: "Press", count: stats?.press },
    { value: "partner", label: "Partners", count: stats?.partner },
  ], [stats]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Featured: VETS Music Video */}
      <Card className="bg-card/60 border-green-500/20 overflow-hidden">
        <CardContent className="p-0">
          <div className="p-4 border-b border-green-500/20 bg-gradient-to-r from-green-500/10 to-transparent">
            <h2 className="text-lg font-bold text-green-400 flex items-center gap-2">
              <Mic className="w-5 h-5" />
              Featured: Vets2Hero Music Video
            </h2>
            <p className="text-muted-foreground text-sm mt-1">Official VETS anthem — Supporting Veterans and First Responders</p>
          </div>
          <div className="aspect-video">
            <video
              className="w-full h-full object-contain bg-black"
              controls
              playsInline
              preload="metadata"
            >
              <source src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/TpBuoUpQVyJrFzak.mp4" type="video/mp4" />
            </video>
          </div>
          <div className="p-4 border-t border-border">
{/* HERO Global Veterans Music Video */}      <div className="mt-6">        <h3 className="text-lg font-bold text-center mb-2 text-green-400">🌍 HERO Global Veterans Music Video</h3>        <div className="aspect-video rounded-lg overflow-hidden border border-green-500/20">          <video controls preload="metadata" className="w-full h-full object-cover">            <source src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/huWiGvNsWyNdFTxB.mp4" type="video/mp4" />          </video>        </div>      </div>      {/* HERO USA Veterans Music Video */}      <div className="mt-6">        <h3 className="text-lg font-bold text-center mb-2 text-blue-400">🇺🇸 HERO USA Veterans Music Video</h3>        <div className="aspect-video rounded-lg overflow-hidden border border-blue-500/20">          <video controls preload="metadata" className="w-full h-full object-cover">            <source src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/ksLvgZRExNUgirMD.mp4" type="video/mp4" />          </video>        </div>      </div>
            <h3 className="text-foreground font-semibold text-sm mb-3">VETS Soundtrack</h3>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="bg-secondary/30 rounded-lg p-3">
                <p className="text-foreground text-xs font-medium mb-2">Corey Meme Song</p>
                <audio controls className="w-full h-8" preload="metadata">
                  <source src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/OHfJfJwCmEStjnum.mp3" type="audio/mpeg" />
                </audio>
              </div>
              <div className="bg-secondary/30 rounded-lg p-3">
                <p className="text-foreground text-xs font-medium mb-2">Salute to VETS</p>
                <audio controls className="w-full h-8" preload="metadata">
                  <source src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/tltFDkLmQuGvHOQY.mp3" type="audio/mpeg" />
                </audio>
              </div>
              <div className="bg-secondary/30 rounded-lg p-3">
                <p className="text-foreground text-xs font-medium mb-2">VETS Song #1</p>
                <audio controls className="w-full h-8" preload="metadata">
                  <source src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663472861536/yuhFIYUTLJbVpCLj.WAV" type="audio/wav" />
                </audio>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Newspaper className="w-6 h-6 text-[var(--hero-orange)]" />
            Media
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Live influencer mentions, guest posts, and HERO ecosystem coverage
          </p>
          <SchedulerIndicator />
        </div>
        <div className="flex gap-2">
          {isAuthenticated && (
            <Button
              size="sm" variant="outline"
              className="border-[var(--hero-orange)]/30 text-[var(--hero-orange)]"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
              {refreshMutation.isPending ? "Fetching..." : "Refresh Mentions"}
            </Button>
          )}
          {isAuthenticated && (
            <Button
              size="sm" variant="outline"
              className="border-[var(--hero-orange)]/30 text-[var(--hero-orange)]"
              onClick={() => {
                generateMutation.mutate({
                  tweetContent: FEATURED_MENTIONS[0].content,
                  tweetUrl: FEATURED_MENTIONS[0].sourceUrl,
                  tweetAuthor: FEATURED_MENTIONS[0].source,
                });
              }}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              )}
              Generate Article
            </Button>
          )}
          <a
            href="https://double.trudefi.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-blue-500/50 text-blue-400 hover:bg-blue-500/10 transition-colors text-sm font-medium"
          >
            <img src="https://double.trudefi.io/favicon.ico" className="w-4 h-4" alt="TruDeFi" onError={(e: React.SyntheticEvent<HTMLImageElement>) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            TruDeFi
          </a>
        </div>
      </div>

      {/* Stats bar */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Total Mentions", value: stats.total, color: "var(--hero-orange)" },
            { label: "Influencers", value: stats.influencer, color: "#a855f7" },
            { label: "Community", value: stats.community, color: "#3b82f6" },
            { label: "Press", value: stats.press, color: "#f59e0b" },
            { label: "Partners", value: stats.partner, color: "#10b981" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border/50 bg-card/80 p-3 text-center">
              <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <Tabs defaultValue="mentions">
        <TabsList className="bg-secondary/50 border border-border/50">
          <TabsTrigger value="mentions" className="data-[state=active]:bg-[var(--hero-orange)]/10 data-[state=active]:text-[var(--hero-orange)]">
            <Users className="w-3.5 h-3.5 mr-1.5" />
            Influencer Mentions
          </TabsTrigger>
          <TabsTrigger value="articles" className="data-[state=active]:bg-[var(--hero-orange)]/10 data-[state=active]:text-[var(--hero-orange)]">
            <Newspaper className="w-3.5 h-3.5 mr-1.5" />
            Articles & Guest Posts
          </TabsTrigger>
          <TabsTrigger value="press" className="data-[state=active]:bg-[var(--hero-orange)]/10 data-[state=active]:text-[var(--hero-orange)]">
            <Award className="w-3.5 h-3.5 mr-1.5" />
            Press Kit
          </TabsTrigger>
        </TabsList>

        {/* ─── Influencer Mentions Tab ─────────────────────────────── */}
        <TabsContent value="mentions" className="mt-6 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            {filterOptions.map((opt) => (
              <Button
                key={opt.label}
                size="sm"
                variant={categoryFilter === opt.value ? "default" : "outline"}
                className={categoryFilter === opt.value
                  ? "bg-[var(--hero-orange)] text-white border-0 text-xs"
                  : "border-border/50 text-xs"
                }
                onClick={() => setCategoryFilter(opt.value)}
              >
                {opt.label}
                {opt.count !== undefined && opt.count > 0 && (
                  <span className="ml-1 opacity-70">({opt.count})</span>
                )}
              </Button>
            ))}
          </div>

          {mentionsQuery.isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground mt-2">Loading mentions...</p>
            </div>
          ) : hasLiveMentions ? (
            mentionsQuery.data!.map((mention: any) => (
              <LiveMentionCard
                key={mention.id}
                mention={mention}
                isAuthenticated={isAuthenticated}
                onTogglePin={(id, isPinned) => pinMutation.mutate({ id, isPinned })}
                onToggleHighlight={(id, isHighlighted) => highlightMutation.mutate({ id, isHighlighted })}
              />
            ))
          ) : (
            <>
              <Card className="border-dashed border-[var(--hero-orange)]/30 bg-[var(--hero-orange)]/5">
                <CardContent className="p-4 text-center">
                  <Twitter className="w-6 h-6 text-[var(--hero-orange)] mx-auto mb-2" />
                  <p className="text-sm text-foreground font-medium">
                    {isAuthenticated
                      ? 'Click "Refresh Mentions" above to pull live tweets from @HERO501c3'
                      : "Sign in to fetch live Twitter mentions"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Showing featured mentions below in the meantime
                  </p>
                </CardContent>
              </Card>
              {FEATURED_MENTIONS.map((mention, i) => (
                <StaticMentionCard key={i} {...mention} />
              ))}
            </>
          )}
        </TabsContent>

        {/* ─── Articles & Guest Posts Tab ──────────────────────────── */}
        <TabsContent value="articles" className="mt-6 space-y-4">
          {blogQuery.isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground mt-2">Loading articles...</p>
            </div>
          ) : blogQuery.data && blogQuery.data.length > 0 ? (
            blogQuery.data.map((post: any) => (
              <ArticleCard
                key={post.id} title={post.title} slug={post.slug} excerpt={post.excerpt}
                publishedAt={post.publishedAt} tags={post.tags}
                heroMentioned={post.heroMentioned} vetsMentioned={post.vetsMentioned}
              />
            ))
          ) : (
            <Card className="border-dashed border-border/50 bg-transparent">
              <CardContent className="p-8 text-center">
                <Newspaper className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold text-foreground mb-1">No Articles Yet</h3>
                <p className="text-sm text-muted-foreground">
                  Articles and guest posts about the HERO ecosystem will appear here.
                </p>
                {isAuthenticated && (
                  <Button
                    size="sm"
                    className="mt-4 bg-hero-orange text-white font-bold border-0"
                    onClick={() => {
                      generateMutation.mutate({
                        tweetContent: FEATURED_MENTIONS[0].content,
                        tweetUrl: FEATURED_MENTIONS[0].sourceUrl,
                        tweetAuthor: FEATURED_MENTIONS[0].source,
                      });
                    }}
                    disabled={generateMutation.isPending}
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Generate First Article
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Press Kit Tab ──────────────────────────────────────── */}
        <TabsContent value="press" className="mt-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              <Globe className="w-5 h-5 text-[var(--hero-orange)]" />
              Guest Post Targets
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Publications we are pitching or planning guest posts for to spread the HERO mission.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {GUEST_POST_TARGETS.map((pub) => (
                <a
                  key={pub.name} href={pub.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/80 p-4 hover:border-[var(--hero-orange)]/30 transition-all group"
                >
                  <span className="text-2xl">{pub.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground group-hover:text-[var(--hero-orange)] transition-colors">{pub.name}</div>
                    <Badge variant="outline" className={`text-[10px] mt-1 ${pub.status === "Pitching" ? "border-[var(--hero-orange)]/30 text-[var(--hero-orange)]" : "border-border/50 text-muted-foreground"}`}>
                      {pub.status}
                    </Badge>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
          </div>

          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-6">
              <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                <Award className="w-5 h-5 text-[var(--hero-green)]" />
                HERO Press Kit
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Resources for journalists, bloggers, and influencers covering the HERO ecosystem.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {[
                  { label: "Project", value: "HERO Token ($HERO)" },
                  { label: "Networks", value: "PulseChain, BASE" },
                  { label: "Foundation", value: "VIC Foundation 501(c)(3)" },
                  { label: "Mission", value: "Supporting veterans & first responders" },
                  { label: "Contact", value: "t.me/VetsInCrypto", url: "https://t.me/VetsInCrypto" },
                  { label: "Twitter", value: "@HERO501c3", url: "https://x.com/hero501c3" },
                ].map((item) => (
                  <div key={item.label} className="p-3 rounded-lg bg-secondary/30 border border-border/30">
                    <span className="font-medium text-foreground">{item.label}:</span>{" "}
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[var(--hero-orange)] hover:underline">
                        {item.value}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">{item.value}</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
