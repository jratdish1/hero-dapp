import { useState } from "react";
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
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

// ─── DRY: Reusable badge helper ──────────────────────────────────────────
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

// ─── DRY: Reusable date display ──────────────────────────────────────────
function DateLabel({ date }: { date: string | Date }) {
  return (
    <span className="text-xs text-muted-foreground flex items-center gap-1">
      <Calendar className="w-3 h-3" />
      {typeof date === "string" ? date : new Date(date).toLocaleDateString()}
    </span>
  );
}

// ─── Influencer Mention Card ─────────────────────────────────────────────
function MentionCard({
  title,
  sourceUrl,
  source,
  date,
  content,
  heroPrice,
  vetsPrice,
  farmYields,
  sourceType = "twitter",
}: {
  title: string;
  sourceUrl: string;
  source: string;
  date: string;
  content: string;
  heroPrice?: string;
  vetsPrice?: string;
  farmYields?: string;
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
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Farm Yields
              </span>
            </div>
            <p className="text-xs text-foreground">{farmYields}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Blog / Guest Post Card ──────────────────────────────────────────────
function ArticleCard({
  title,
  slug,
  excerpt,
  publishedAt,
  tags,
  heroMentioned,
  vetsMentioned,
}: {
  title: string;
  slug: string;
  excerpt?: string | null;
  publishedAt?: Date | null;
  tags?: string | null;
  heroMentioned?: boolean | null;
  vetsMentioned?: boolean | null;
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

        {excerpt && !expanded && (
          <p className="text-sm text-muted-foreground mt-3">{excerpt}</p>
        )}

        {tags && (
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            <Tag className="w-3 h-3 text-muted-foreground" />
            {tags.split(",").map((tag) => (
              <Badge key={tag.trim()} variant="outline" className="text-[10px] py-0">
                {tag.trim()}
              </Badge>
            ))}
          </div>
        )}

        {expanded && postQuery.data && (
          <div className="mt-4 p-4 rounded-lg bg-secondary/30 border border-border/30 prose prose-sm prose-invert max-w-none">
            <Streamdown>{postQuery.data.content}</Streamdown>
          </div>
        )}

        <Button
          size="sm"
          variant="ghost"
          className="mt-3 text-[var(--hero-orange)] hover:text-[var(--hero-orange)] hover:bg-[var(--hero-orange)]/10"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Collapse" : "Read Full Article"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Featured Influencer / Publication Mentions ──────────────────────────
const FEATURED_MENTIONS = [
  {
    title: "Weekly HERO Ecosystem Roundup — March 30, 2026",
    sourceUrl: "https://x.com/crypmvs/status/2038513610360836215",
    source: "@CrypMvs",
    date: "Mar 30, 2026",
    sourceType: "twitter" as const,
    content:
      "This week's roundup featuring $HERO and $VETS on PulseChain. Farm yields looking strong across Emit Farm, TruFarms, and RhinoFi. The VIC Foundation continues to build for veterans and first responders.",
    heroPrice: "Trending",
    vetsPrice: "Trending",
    farmYields:
      "$VETS/$EMIT: 147% APR | $HERO/$EMIT: 127% APR | $HERO/$PLS: 154% APR | TruFarm SSS: 221% APR",
  },
  {
    title: "Veteran-Led DeFi: How $HERO Is Building a Benevolent Protocol",
    sourceUrl: "https://www.vicfoundation.com",
    source: "VIC Foundation Blog",
    date: "Mar 25, 2026",
    sourceType: "blog" as const,
    content:
      "An in-depth look at how the HERO token ecosystem leverages DeFi yield farming to fund veteran and first responder support programs through the 501(c)(3) VIC Foundation. The closed-loop flywheel creates sustainable funding without relying on donations.",
  },
  {
    title: "PulseChain DeFi Projects to Watch in 2026",
    sourceUrl: "https://pulsechain.com",
    source: "PulseChain Community",
    date: "Mar 20, 2026",
    sourceType: "news" as const,
    content:
      "HERO Dapp highlighted as a standout project combining multi-DEX aggregation with a charitable mission. The platform's gasless swap feature and military-themed NFT collection have attracted attention from both DeFi enthusiasts and veteran communities.",
  },
];

// ─── Guest Post Opportunities ────────────────────────────────────────────
const GUEST_POST_TARGETS = [
  { name: "Forbes Crypto", url: "https://www.forbes.com/crypto-blockchain/", status: "Pitching", icon: "📰" },
  { name: "CoinDesk", url: "https://www.coindesk.com/", status: "Planned", icon: "📊" },
  { name: "Decrypt", url: "https://decrypt.co/", status: "Planned", icon: "🔓" },
  { name: "The Block", url: "https://www.theblock.co/", status: "Planned", icon: "🧱" },
  { name: "Cointelegraph", url: "https://cointelegraph.com/", status: "Planned", icon: "📡" },
  { name: "Military Times", url: "https://www.militarytimes.com/", status: "Pitching", icon: "🎖️" },
];

export default function Blog() {
  const { isAuthenticated } = useAuth();
  const blogQuery = trpc.blog.published.useQuery({});
  const mvsQuery = trpc.mvs.list.useQuery({});
  const generateMutation = trpc.blog.generateFromMvs.useMutation({
    onSuccess: (data) => {
      toast.success(`Article created: ${data.title}`);
      blogQuery.refetch();
    },
    onError: (err) => {
      toast.error(`Failed to generate: ${err.message}`);
    },
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Newspaper className="w-6 h-6 text-[var(--hero-orange)]" />
            Media
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Influencer mentions, guest posts, and HERO ecosystem coverage
          </p>
        </div>
        {isAuthenticated && (
          <Button
            size="sm"
            variant="outline"
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
      </div>

      <Tabs defaultValue="mentions">
        <TabsList className="bg-secondary/50 border border-border/50">
          <TabsTrigger
            value="mentions"
            className="data-[state=active]:bg-[var(--hero-orange)]/10 data-[state=active]:text-[var(--hero-orange)]"
          >
            <Users className="w-3.5 h-3.5 mr-1.5" />
            Influencer Mentions
          </TabsTrigger>
          <TabsTrigger
            value="articles"
            className="data-[state=active]:bg-[var(--hero-orange)]/10 data-[state=active]:text-[var(--hero-orange)]"
          >
            <Newspaper className="w-3.5 h-3.5 mr-1.5" />
            Articles & Guest Posts
          </TabsTrigger>
          <TabsTrigger
            value="press"
            className="data-[state=active]:bg-[var(--hero-orange)]/10 data-[state=active]:text-[var(--hero-orange)]"
          >
            <Award className="w-3.5 h-3.5 mr-1.5" />
            Press Kit
          </TabsTrigger>
        </TabsList>

        {/* ─── Influencer Mentions Tab ─────────────────────────────── */}
        <TabsContent value="mentions" className="mt-6 space-y-4">
          {mvsQuery.data && mvsQuery.data.length > 0 ? (
            mvsQuery.data.map((mvs: any) => (
              <MentionCard
                key={mvs.id}
                title={mvs.weekLabel || `HERO Mention — ${new Date(mvs.createdAt).toLocaleDateString()}`}
                sourceUrl={mvs.tweetUrl}
                source={mvs.authorHandle}
                date={new Date(mvs.createdAt).toLocaleDateString()}
                content={mvs.content}
                heroPrice={mvs.heroPrice || undefined}
                vetsPrice={mvs.vetsPrice || undefined}
                farmYields={mvs.farmYields || undefined}
                sourceType="twitter"
              />
            ))
          ) : (
            <>
              {FEATURED_MENTIONS.map((mention, i) => (
                <MentionCard key={i} {...mention} />
              ))}
              <Card className="border-dashed border-border/50 bg-transparent">
                <CardContent className="p-6 text-center">
                  <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    More influencer mentions and media coverage will appear here as they are tracked.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Follow{" "}
                    <a
                      href="https://x.com/hero501c3"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--hero-orange)] hover:underline"
                    >
                      @HERO501c3
                    </a>{" "}
                    for the latest ecosystem updates
                  </p>
                </CardContent>
              </Card>
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
                key={post.id}
                title={post.title}
                slug={post.slug}
                excerpt={post.excerpt}
                publishedAt={post.publishedAt}
                tags={post.tags}
                heroMentioned={post.heroMentioned}
                vetsMentioned={post.vetsMentioned}
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
          {/* Guest Post Targets */}
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
                  key={pub.name}
                  href={pub.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/80 p-4 hover:border-[var(--hero-orange)]/30 transition-all group"
                >
                  <span className="text-2xl">{pub.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground group-hover:text-[var(--hero-orange)] transition-colors">
                      {pub.name}
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] mt-1 ${
                        pub.status === "Pitching"
                          ? "border-[var(--hero-orange)]/30 text-[var(--hero-orange)]"
                          : "border-border/50 text-muted-foreground"
                      }`}
                    >
                      {pub.status}
                    </Badge>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
          </div>

          {/* Press Kit Info */}
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
                <div className="p-3 rounded-lg bg-secondary/30 border border-border/30">
                  <span className="font-medium text-foreground">Project:</span>{" "}
                  <span className="text-muted-foreground">HERO Token ($HERO)</span>
                </div>
                <div className="p-3 rounded-lg bg-secondary/30 border border-border/30">
                  <span className="font-medium text-foreground">Networks:</span>{" "}
                  <span className="text-muted-foreground">PulseChain, BASE</span>
                </div>
                <div className="p-3 rounded-lg bg-secondary/30 border border-border/30">
                  <span className="font-medium text-foreground">Foundation:</span>{" "}
                  <span className="text-muted-foreground">VIC Foundation 501(c)(3)</span>
                </div>
                <div className="p-3 rounded-lg bg-secondary/30 border border-border/30">
                  <span className="font-medium text-foreground">Mission:</span>{" "}
                  <span className="text-muted-foreground">Supporting veterans & first responders</span>
                </div>
                <div className="p-3 rounded-lg bg-secondary/30 border border-border/30">
                  <span className="font-medium text-foreground">Contact:</span>{" "}
                  <a
                    href="https://t.me/VetsInCrypto"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--hero-orange)] hover:underline"
                  >
                    t.me/VetsInCrypto
                  </a>
                </div>
                <div className="p-3 rounded-lg bg-secondary/30 border border-border/30">
                  <span className="font-medium text-foreground">Twitter:</span>{" "}
                  <a
                    href="https://x.com/hero501c3"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--hero-orange)] hover:underline"
                  >
                    @HERO501c3
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
