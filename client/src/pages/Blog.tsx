import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

function MvsCard({
  title,
  tweetUrl,
  author,
  date,
  content,
  heroPrice,
  vetsPrice,
  farmYields,
}: {
  title: string;
  tweetUrl: string;
  author: string;
  date: string;
  content: string;
  heroPrice?: string;
  vetsPrice?: string;
  farmYields?: string;
}) {
  return (
    <Card className="border-border/50 bg-card/80 hover:border-[var(--hero-orange)]/30 transition-all">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-bold text-foreground">{title}</h3>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <Twitter className="w-3 h-3" />
              <span>{author}</span>
              <span className="text-border">|</span>
              <Calendar className="w-3 h-3" />
              <span>{date}</span>
            </div>
          </div>
          <a href={tweetUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="border-border/50 shrink-0">
              <ExternalLink className="w-3 h-3 mr-1" />
              View
            </Button>
          </a>
        </div>

        {(heroPrice || vetsPrice) && (
          <div className="flex gap-3 mb-3">
            {heroPrice && (
              <Badge className="bg-[var(--hero-orange)]/10 text-[var(--hero-orange)] border-[var(--hero-orange)]/20">
                $HERO: {heroPrice}
              </Badge>
            )}
            {vetsPrice && (
              <Badge className="bg-[var(--hero-green)]/10 text-[var(--hero-green)] border-[var(--hero-green)]/20">
                $VETS: {vetsPrice}
              </Badge>
            )}
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

function BlogPost({
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
  const postQuery = trpc.blog.bySlug.useQuery(
    { slug },
    { enabled: expanded }
  );

  return (
    <Card className="border-border/50 bg-card/80 hover:border-[var(--hero-orange)]/30 transition-all">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="font-bold text-foreground">{title}</h3>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {publishedAt && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(publishedAt).toLocaleDateString()}
                </span>
              )}
              {heroMentioned && (
                <Badge className="bg-[var(--hero-orange)]/10 text-[var(--hero-orange)] border-[var(--hero-orange)]/20 text-[10px]">
                  $HERO
                </Badge>
              )}
              {vetsMentioned && (
                <Badge className="bg-[var(--hero-green)]/10 text-[var(--hero-green)] border-[var(--hero-green)]/20 text-[10px]">
                  $VETS
                </Badge>
              )}
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
              <Badge
                key={tag.trim()}
                variant="outline"
                className="text-[10px] py-0"
              >
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
          {expanded ? "Collapse" : "Read Full Post"}
        </Button>
      </CardContent>
    </Card>
  );
}

// Sample MVS data for display (will be replaced by real data from tRPC)
const SAMPLE_MVS = [
  {
    title: "Weekly MVS - March 30, 2026",
    tweetUrl: "https://x.com/crypmvs/status/2038513610360836215",
    author: "@CrypMvs",
    date: "Mar 30, 2026",
    content:
      "This week's Most Valuable Shills featuring $HERO and $VETS on PulseChain. Farm yields looking strong across Emit Farm, TruFarms, and RhinoFi. The VIC Foundation continues to build for veterans and first responders.",
    heroPrice: "Trending",
    vetsPrice: "Trending",
    farmYields:
      "$VETS/$EMIT: 147% APR | $HERO/$EMIT: 127% APR | $HERO/$PLS: 154% APR | TruFarm SSS: 221% APR",
  },
];

export default function Blog() {
  const { isAuthenticated } = useAuth();
  const blogQuery = trpc.blog.published.useQuery({});
  const mvsQuery = trpc.mvs.list.useQuery({});
  const generateMutation = trpc.blog.generateFromMvs.useMutation({
    onSuccess: (data) => {
      toast.success(`Blog post created: ${data.title}`);
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
            MVS Feed & Blog
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Weekly Most Valuable Shills and HERO/VETS community updates
          </p>
        </div>
        {isAuthenticated && (
          <Button
            size="sm"
            variant="outline"
            className="border-[var(--hero-orange)]/30 text-[var(--hero-orange)]"
            onClick={() => {
              generateMutation.mutate({
                tweetContent: SAMPLE_MVS[0].content,
                tweetUrl: SAMPLE_MVS[0].tweetUrl,
                tweetAuthor: SAMPLE_MVS[0].author,
              });
            }}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            )}
            Generate from MVS
          </Button>
        )}
      </div>

      <Tabs defaultValue="mvs">
        <TabsList className="bg-secondary/50 border border-border/50">
          <TabsTrigger
            value="mvs"
            className="data-[state=active]:bg-[var(--hero-orange)]/10 data-[state=active]:text-[var(--hero-orange)]"
          >
            <Twitter className="w-3.5 h-3.5 mr-1.5" />
            MVS Feed
          </TabsTrigger>
          <TabsTrigger
            value="blog"
            className="data-[state=active]:bg-[var(--hero-orange)]/10 data-[state=active]:text-[var(--hero-orange)]"
          >
            <Newspaper className="w-3.5 h-3.5 mr-1.5" />
            Blog Posts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mvs" className="mt-6 space-y-4">
          {/* Show saved MVS content from DB */}
          {mvsQuery.data && mvsQuery.data.length > 0 ? (
            mvsQuery.data.map((mvs: any) => (
              <MvsCard
                key={mvs.id}
                title={mvs.weekLabel || `MVS - ${new Date(mvs.createdAt).toLocaleDateString()}`}
                tweetUrl={mvs.tweetUrl}
                author={mvs.authorHandle}
                date={new Date(mvs.createdAt).toLocaleDateString()}
                content={mvs.content}
                heroPrice={mvs.heroPrice || undefined}
                vetsPrice={mvs.vetsPrice || undefined}
                farmYields={mvs.farmYields || undefined}
              />
            ))
          ) : (
            <>
              {/* Show sample data when no DB entries */}
              {SAMPLE_MVS.map((mvs, i) => (
                <MvsCard key={i} {...mvs} />
              ))}
              <Card className="border-dashed border-border/50 bg-transparent">
                <CardContent className="p-6 text-center">
                  <Twitter className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    More MVS content will appear here as weekly threads are saved.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Follow{" "}
                    <a
                      href="https://x.com/crypmvs"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--hero-orange)] hover:underline"
                    >
                      @CrypMvs
                    </a>{" "}
                    for the latest weekly shills
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="blog" className="mt-6 space-y-4">
          {blogQuery.isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground mt-2">Loading posts...</p>
            </div>
          ) : blogQuery.data && blogQuery.data.length > 0 ? (
            blogQuery.data.map((post: any) => (
              <BlogPost
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
                <h3 className="font-semibold text-foreground mb-1">No Blog Posts Yet</h3>
                <p className="text-sm text-muted-foreground">
                  Blog posts will be auto-generated from weekly MVS tweets highlighting $HERO and $VETS.
                </p>
                {isAuthenticated && (
                  <Button
                    size="sm"
                    className="mt-4 bg-gradient-to-r from-[var(--hero-orange)] to-[var(--hero-green)] text-white border-0"
                    onClick={() => {
                      generateMutation.mutate({
                        tweetContent: SAMPLE_MVS[0].content,
                        tweetUrl: SAMPLE_MVS[0].tweetUrl,
                        tweetAuthor: SAMPLE_MVS[0].author,
                      });
                    }}
                    disabled={generateMutation.isPending}
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Generate First Post from MVS
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
