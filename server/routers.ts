import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  createDcaOrder,
  getDcaOrdersByUser,
  updateDcaOrderStatus,
  createLimitOrder,
  getLimitOrdersByUser,
  cancelLimitOrder,
  recordSwap,
  getSwapHistoryByWallet,
  addToWatchlist,
  getWatchlistByUser,
  removeFromWatchlist,
  createBlogPost,
  getPublishedBlogPosts,
  getBlogPostBySlug,
  getAllBlogPosts,
  updateBlogPost,
  saveMvsContent,
  getMvsContentList,
  getMvsContentByTweetId,
} from "./db";
import { invokeLLM } from "./_core/llm";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  dca: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getDcaOrdersByUser(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({
        walletAddress: z.string().min(42).max(42),
        tokenInAddress: z.string().min(42).max(42),
        tokenInSymbol: z.string().max(20),
        tokenOutAddress: z.string().min(42).max(42),
        tokenOutSymbol: z.string().max(20),
        amountPerInterval: z.string(),
        intervalSeconds: z.number().int().positive(),
        totalIntervals: z.number().int().positive().max(365),
      }))
      .mutation(async ({ ctx, input }) => {
        await createDcaOrder({
          userId: ctx.user.id,
          ...input,
          nextExecutionAt: new Date(),
        });
        return { success: true };
      }),
    updateStatus: protectedProcedure
      .input(z.object({
        orderId: z.number().int().positive(),
        status: z.enum(["active", "paused", "completed", "cancelled"]),
      }))
      .mutation(async ({ ctx, input }) => {
        await updateDcaOrderStatus(input.orderId, ctx.user.id, input.status);
        return { success: true };
      }),
  }),

  limitOrder: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getLimitOrdersByUser(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({
        walletAddress: z.string().min(42).max(42),
        tokenInAddress: z.string().min(42).max(42),
        tokenInSymbol: z.string().max(20),
        tokenOutAddress: z.string().min(42).max(42),
        tokenOutSymbol: z.string().max(20),
        amountIn: z.string(),
        targetPrice: z.string(),
        orderType: z.enum(["buy", "sell"]),
        expiresAt: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await createLimitOrder({
          userId: ctx.user.id,
          ...input,
        });
        return { success: true };
      }),
    cancel: protectedProcedure
      .input(z.object({ orderId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await cancelLimitOrder(input.orderId, ctx.user.id);
        return { success: true };
      }),
  }),

  swap: router({
    history: protectedProcedure
      .input(z.object({ walletAddress: z.string().min(42).max(42) }))
      .query(async ({ input }) => {
        return getSwapHistoryByWallet(input.walletAddress);
      }),
    record: protectedProcedure
      .input(z.object({
        walletAddress: z.string().min(42).max(42),
        tokenInAddress: z.string().min(42).max(42),
        tokenInSymbol: z.string().max(20),
        tokenOutAddress: z.string().min(42).max(42),
        tokenOutSymbol: z.string().max(20),
        amountIn: z.string(),
        amountOut: z.string(),
        dexSource: z.string().optional(),
        txHash: z.string().optional(),
        gasUsed: z.string().optional(),
        gasless: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await recordSwap({
          userId: ctx.user.id,
          ...input,
        });
        return { success: true };
      }),
  }),

  watchlist: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getWatchlistByUser(ctx.user.id);
    }),
    add: protectedProcedure
      .input(z.object({
        tokenAddress: z.string().min(42).max(42),
        tokenSymbol: z.string().max(20),
      }))
      .mutation(async ({ ctx, input }) => {
        await addToWatchlist({
          userId: ctx.user.id,
          ...input,
        });
        return { success: true };
      }),
    remove: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await removeFromWatchlist(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  blog: router({
    published: publicProcedure
      .input(z.object({ limit: z.number().int().positive().max(50).optional() }).optional())
      .query(async ({ input }) => {
        return getPublishedBlogPosts(input?.limit ?? 20);
      }),
    bySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        return getBlogPostBySlug(input.slug);
      }),
    all: protectedProcedure.query(async () => {
      return getAllBlogPosts();
    }),
    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1).max(500),
        slug: z.string().min(1).max(500),
        content: z.string().min(1),
        excerpt: z.string().max(1000).optional(),
        coverImageUrl: z.string().optional(),
        tweetId: z.string().optional(),
        tweetAuthor: z.string().optional(),
        tweetUrl: z.string().optional(),
        tags: z.string().optional(),
        heroMentioned: z.boolean().optional(),
        vetsMentioned: z.boolean().optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
        publishedAt: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        await createBlogPost(input);
        return { success: true };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        title: z.string().max(500).optional(),
        content: z.string().optional(),
        excerpt: z.string().max(1000).optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
        publishedAt: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateBlogPost(id, data);
        return { success: true };
      }),
    generateFromMvs: protectedProcedure
      .input(z.object({
        tweetContent: z.string().min(1),
        tweetUrl: z.string(),
        tweetAuthor: z.string(),
      }))
      .mutation(async ({ input }) => {
        const llmResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a crypto blog writer for the VIC Foundation. Write engaging blog posts about $HERO and $VETS tokens on PulseChain. The VIC Foundation supports military veterans and first responders through DeFi. Always highlight the bullish case for $HERO and $VETS. Include farm yield data when available. Write in an energetic but professional tone. Output JSON with fields: title, content (markdown), excerpt, tags (comma-separated).`,
            },
            {
              role: "user",
              content: `Generate a blog post from this weekly MVS (Most Valuable Shills) tweet by ${input.tweetAuthor}:\n\n${input.tweetContent}\n\nTweet URL: ${input.tweetUrl}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "blog_post",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Blog post title" },
                  content: { type: "string", description: "Full blog post in markdown" },
                  excerpt: { type: "string", description: "Short excerpt, max 200 chars" },
                  tags: { type: "string", description: "Comma-separated tags" },
                },
                required: ["title", "content", "excerpt", "tags"],
                additionalProperties: false,
              },
            },
          },
        });

        const rawContent = llmResponse.choices[0].message.content;
        const contentStr = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
        const parsed = JSON.parse(contentStr || "{}");
        const slug = parsed.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 200) + "-" + Date.now();

        const heroMentioned = input.tweetContent.toLowerCase().includes("hero");
        const vetsMentioned = input.tweetContent.toLowerCase().includes("vets");

        await createBlogPost({
          title: parsed.title,
          slug,
          content: parsed.content,
          excerpt: parsed.excerpt,
          tweetId: input.tweetUrl.split("/").pop() || "",
          tweetAuthor: input.tweetAuthor,
          tweetUrl: input.tweetUrl,
          tags: parsed.tags,
          heroMentioned,
          vetsMentioned,
          status: "published",
          publishedAt: new Date(),
        });

        return { success: true, title: parsed.title, slug };
      }),
  }),

  mvs: router({
    list: publicProcedure
      .input(z.object({ limit: z.number().int().positive().max(50).optional() }).optional())
      .query(async ({ input }) => {
        return getMvsContentList(input?.limit ?? 20);
      }),
    save: protectedProcedure
      .input(z.object({
        tweetId: z.string().min(1),
        tweetUrl: z.string().min(1),
        author: z.string().min(1),
        authorHandle: z.string().min(1),
        content: z.string().min(1),
        weekLabel: z.string().optional(),
        farmYields: z.string().optional(),
        heroPrice: z.string().optional(),
        vetsPrice: z.string().optional(),
        mediaUrls: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const existing = await getMvsContentByTweetId(input.tweetId);
        if (existing) return { success: false, message: "Already saved" };
        await saveMvsContent(input);
        return { success: true };
      }),
  }),

  ai: router({
    chat: publicProcedure
      .input(z.object({
        message: z.string().min(1).max(5000),
        chainContext: z.string().optional(),
        history: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        })).max(20).optional(),
      }))
      .mutation(async ({ input }) => {
        const systemPrompt = `You are the HERO AI Assistant, a crypto market analyst specializing in $HERO and $VETS tokens on PulseChain and BASE networks. You are built for the VIC Foundation, a 501(c)(3) nonprofit supporting military veterans and first responders through DeFi.

Key knowledge:
- $HERO on PulseChain: 0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27
- $HERO on BASE: 0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8
- $VETS on PulseChain: 0x4013abBf94A745EfA7cc848989Ee83424A770060
- Partner farms: Emit Farm (HERO/EMIT, HERO/PLS, VETS/EMIT), RhinoFi (HERO/RHINO), TruFarms (TruFarm/HERO)
- DEXs: PulseX V1/V2, 9inch, Liberty Swap (PulseChain); Uniswap V3, Aerodrome, BaseSwap (BASE)

Current chain context: ${input.chainContext || "PulseChain"}

Be helpful, accurate, and concise. Use markdown formatting. Always include disclaimers that this is not financial advice. Be bullish but honest about $HERO and $VETS. Detect and warn about potential scams when asked. Keep responses under 500 words unless detailed analysis is requested.`;

        const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
          { role: "system", content: systemPrompt },
        ];

        if (input.history) {
          for (const msg of input.history) {
            messages.push({ role: msg.role, content: msg.content });
          }
        }

        messages.push({ role: "user", content: input.message });

        const response = await invokeLLM({ messages });
        const reply = typeof response.choices[0].message.content === "string"
          ? response.choices[0].message.content
          : JSON.stringify(response.choices[0].message.content);

        return { reply: reply || "I couldn't generate a response. Please try again." };
      }),
  }),
});

export type AppRouter = typeof appRouter;
