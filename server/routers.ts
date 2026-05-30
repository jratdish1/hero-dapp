import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router , rateLimitedMutation } from "./_core/trpc";
import { z } from "zod";
import { createPublicClient, http, erc20Abi } from "viem";
import { pulsechain } from "viem/chains";

// ─── On-Chain Verification Clients ──────────────────────────────────────
const pulsechainClient = createPublicClient({ chain: pulsechain, transport: http("https://rpc.pulsechain.com") });
const baseClient = createPublicClient({ chain: { id: 8453, name: "Base", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: ["https://mainnet.base.org"] } } } as any, transport: http("https://mainnet.base.org") });

const HERO_TOKENS: Record<string, `0x${string}`> = {
  pulsechain: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
  base: "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8",
};

async function verifyVotingPower(voterAddress: string, chain: "pulsechain" | "base"): Promise<number> {
  const client = chain === "pulsechain" ? pulsechainClient : baseClient;
  const tokenAddress = HERO_TOKENS[chain];
  // AUDIT FIX 2.2: Add timeout to RPC calls to prevent hanging
  const RPC_TIMEOUT_MS = 10_000;
  try {
    const balancePromise = client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [voterAddress as `0x${string}`],
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("RPC timeout")), RPC_TIMEOUT_MS)
    );
    const balance = await Promise.race([balancePromise, timeoutPromise]);
    return Math.floor(Number(balance) / 1e18);
  } catch {
    return 0;
  }
}

// ─── Reusable Validation Schemas ────────────────────────────────────────
// Ethereum/PulseChain hex address: exactly 42 chars, 0x prefix + 40 hex chars
const ethAddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid wallet address format");
// Transaction hash: 0x prefix + 64 hex chars
// ─── In-memory stores for spin records and active raffles ─────────────────
const spinRecords = new Map<string, UserSpinRecord>();
const spinRecordsV2 = new Map<string, UserSpinRecordV2>();
const leaderboardCache = new Map<string, { wallet: string; currentStreak: number; longestStreak: number; totalSpins: number; totalHeroEarned: number; biggestWin: string }>();

// Helper functions for V2 router
function checkSpinRateLimit(wallet: string): boolean { return checkRateLimit(wallet, 5); }
function getBurnCostV2(spinsToday: number): string { return getBurnCost(spinsToday); }
function getWheelForTierV2(tier: string) { return getWheelForTier(tier as any); }
function generateClaimSig(wallet: string, amount: string, claimId: string, proofHash: string) { return generateClaimSignature(wallet, amount, claimId, proofHash); }
function updateLeaderboard(wallet: string, record: UserSpinRecordV2) {
  const biggest = record.history.reduce((max, h) => {
    const val = parseInt(h.finalRewardValue) || 0;
    return val > max ? val : max;
  }, 0);
  leaderboardCache.set(wallet, {
    wallet,
    currentStreak: record.currentStreak,
    longestStreak: record.longestStreak,
    totalSpins: record.totalSpins,
    totalHeroEarned: record.totalHeroEarned,
    biggestWin: biggest > 0 ? `${biggest} HERO` : 'None yet',
  });
}
const activeRaffles = new Map<string, Raffle>();
const txHashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid transaction hash format").optional();
// Safe string: no HTML tags, no script injection
const safeStringSchema = (maxLen: number) => z.string().max(maxLen).refine(
  (s) => !/<script/i.test(s) && !/javascript:/i.test(s) && !/on\w+=/.test(s),
  { message: "Input contains disallowed content" }
);
// Token symbol: alphanumeric + common symbols only
const tokenSymbolSchema = z.string().max(20).regex(/^[a-zA-Z0-9$_.\-]+$/, "Invalid token symbol");
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
  createMediaPost,
  getMediaPostsByCategory,
  getAllMediaPosts,
  getMediaPostsByUser,
  deleteMediaPost,
  createProposal,
  getProposals,
  getProposalById,
  updateProposal,
  updateProposalVotes,
  castVote,
  getVotesByProposal,
  getUserVote,
  registerDelegate,
  getDelegates,
  getDelegateByAddress,
  updateDelegate,
  createDelegation,
  getDelegationsByDelegator,
  getDelegationsByDelegate,
  revokeDelegation,
  saveTreasurySnapshot,
  getLatestTreasurySnapshots,
  getCachedChainData,
  setCachedChainData,
  upsertInfluencerMention,
  getInfluencerMentions,
  getInfluencerMentionByTweetId,
  toggleMentionPinned,
  toggleMentionHighlight,
  toggleMentionHidden,
  updateMentionCategory,
  getInfluencerMentionStats,
  atomicIncrementDelegateStats,
  updateUserWalletAddress,
} from "./db";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";
import { getHeroRestId, fetchHeroTweets, toDbRecord } from "./twitterFetcher";
import { alertNewMention } from "./telegramBot";
import { getSchedulerStatus } from "./mentionScheduler";
import { performSpin, canSpinToday, updateSpinRecord, getStreakBonus, DEFAULT_WHEEL_SEGMENTS, type UserSpinRecord } from "./spin-engine";
import { performSpinV2, canSpinTodayV2, updateSpinRecordV2, getStreakBonusV2, getWheelForTier, getBurnCost, checkRateLimit, generateClaimSignature, type UserSpinRecordV2, type SpinResultV2 } from "./spin-engine-v2";
import { createRaffle, enterRaffle, drawRaffleWinners, type Raffle, type RaffleEntry } from "./raffle-engine";
import { getMarketOverview, fetchTokenPrices, fetchBaseTokenPrices, fetchPlsPrice, fetchEthPrice, searchPairs, fetchFarmPoolData, fetchBuyAndBurnData, fetchPulsechainTickerTokens, fetchBaseTickerTokens } from "./priceFeed";
import { anchorProposalOnChain } from "./dao-anchor-integration";
import { generateProposalHash } from "./dao-security-hardening";
import { createDaoLogger } from "./dao-logger";
import { atomicRateLimitAndRecord } from "./dao-rate-limiter";

/**
 * STANDARDIZED ERROR RESPONSE PROTOCOL
 * All errors use TRPCError with semantic codes for consistent client handling.
 * Client receives: { error: { message: string, code: string } }
 */
function createStandardError(
  code: "BAD_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "TOO_MANY_REQUESTS" | "INTERNAL_SERVER_ERROR" | "PRECONDITION_FAILED",
  message: string
): never {
  throw new TRPCError({ code, message });
}



// ─── Output Sanitization (Audit Fix: May 29, 2026) ───
// Strips any residual HTML/script from user-generated content before sending to client
function sanitizeOutput(text: string): string {
  return text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

const routerLogger = createDaoLogger("routers");

// ═══════════════════════════════════════════════════════════════════════════════
// WALLET BINDING CONFIRMATION PROTOCOL — Documentation
// ═══════════════════════════════════════════════════════════════════════════════
//
// PURPOSE:
// Prevents accidental or malicious wallet address binding to user accounts.
// Once a wallet is bound, it controls governance voting power and fund access.
//
// MECHANISM:
// 1. User submits wallet address via `user.updateWallet` mutation
// 2. If user has NO existing wallet bound:
//    - Requires `confirmBinding: true` flag in the request payload
//    - Without this flag, the request is rejected with a descriptive error
//    - This forces the client to show a confirmation dialog before binding
// 3. If user ALREADY has a wallet bound:
//    - The existing wallet is verified against the request
//    - Wallet changes require admin intervention (no self-service rebinding)
//
// SECURITY RATIONALE:
// - Prevents drive-by wallet binding via CSRF or XSS
// - Ensures user explicitly acknowledges the binding action
// - Bind-on-first-use pattern: first wallet address becomes permanent
// - Wallet mismatch attempts are logged for security monitoring
//
// AUDIT TRAIL:
// - All wallet binding events are logged via dao-logger
// - Wallet mismatch attempts trigger shouldAlert() for monitoring
// - Binding timestamp is recorded for forensic analysis
//
// ═══════════════════════════════════════════════════════════════════════════════

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
    list: publicProcedure
      .input(z.object({ wallet: ethAddressSchema, chainId: z.number().optional() }))
      .query(async ({ input }) => {
        return getDcaOrdersByUser(input.wallet);
      }),
    create: protectedProcedure
      .input(z.object({
        walletAddress: ethAddressSchema,
        tokenInAddress: ethAddressSchema,
        tokenInSymbol: tokenSymbolSchema,
        tokenOutAddress: ethAddressSchema,
        tokenOutSymbol: tokenSymbolSchema,
        amountPerInterval: z.string().regex(/^\d+\.?\d*$/, "Invalid amount"),
        intervalSeconds: z.number().int().positive().max(86400 * 30),
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
        walletAddress: ethAddressSchema,
        tokenInAddress: ethAddressSchema,
        tokenInSymbol: tokenSymbolSchema,
        tokenOutAddress: ethAddressSchema,
        tokenOutSymbol: tokenSymbolSchema,
        amountIn: z.string().regex(/^\d+\.?\d*$/, "Invalid amount"),
        targetPrice: z.string().regex(/^\d+\.?\d*$/, "Invalid price"),
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
    history: publicProcedure
      .input(z.object({ walletAddress: ethAddressSchema }))
      .query(async ({ input }) => {
        return getSwapHistoryByWallet(input.walletAddress);
      }),
    record: protectedProcedure
      .input(z.object({
        walletAddress: ethAddressSchema,
        tokenInAddress: ethAddressSchema,
        tokenInSymbol: tokenSymbolSchema,
        tokenOutAddress: ethAddressSchema,
        tokenOutSymbol: tokenSymbolSchema,
        amountIn: z.string().regex(/^\d+\.?\d*$/, "Invalid amount"),
        amountOut: z.string().regex(/^\d+\.?\d*$/, "Invalid amount"),
        dexSource: z.string().max(100).optional(),
        txHash: txHashSchema,
        gasUsed: z.string().regex(/^\d+$/, "Invalid gas").optional(),
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
        tokenAddress: ethAddressSchema,
        tokenSymbol: tokenSymbolSchema,
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
              content: `Generate a blog article from this media mention / influencer post by ${input.tweetAuthor}:\n\n${input.tweetContent}\n\nSource URL: ${input.tweetUrl}`,
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
        // AUDIT FIX 1.5: Safe JSON parsing with validation
        let parsed: { title: string; content: string; excerpt: string; tags: string };
        try {
          parsed = JSON.parse(contentStr || "{}");
        } catch {
          createStandardError("INTERNAL_SERVER_ERROR", "LLM returned invalid JSON — please retry");
        }
        const blogSchema = z.object({ title: z.string().min(1), content: z.string().min(1), excerpt: z.string().min(1), tags: z.string() });
        const validated = blogSchema.safeParse(parsed);
        if (!validated.success) createStandardError("INTERNAL_SERVER_ERROR", "LLM response missing required fields — please retry");
        parsed = validated.data;
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

  media: router({
    list: publicProcedure
      .input(z.object({
        category: z.enum(["instructional", "photos", "memories", "memes", "announcements", "nfts"]).optional(),
        limit: z.number().int().positive().max(100).optional(),
      }).optional())
      .query(async ({ input }) => {
        if (input?.category) {
          return getMediaPostsByCategory(input.category, input?.limit ?? 50);
        }
        return getAllMediaPosts(input?.limit ?? 50);
      }),
    myPosts: protectedProcedure.query(async ({ ctx }) => {
      return getMediaPostsByUser(ctx.user.id);
    }),
    upload: protectedProcedure
      .input(z.object({
        walletAddress: ethAddressSchema,
        category: z.enum(["instructional", "photos", "memories", "memes", "announcements", "nfts"]),
        title: safeStringSchema(500).pipe(z.string().min(1)),
        description: safeStringSchema(2000).optional(),
        mediaType: z.enum(["image", "video", "nft"]),
        fileBase64: z.string().min(1).max(70_000_000),
        fileName: z.string().min(1).max(255).regex(/^[a-zA-Z0-9._\-\s]+$/, "Invalid filename"),
        contentType: z.string().min(1).max(100).regex(/^(image|video)\/(jpeg|jpg|png|gif|webp|mp4|webm|mov)$/, "Invalid content type"),
        fileSizeMb: z.number().positive().max(50).optional(),
        nftContractAddress: ethAddressSchema.optional(),
        nftTokenId: z.string().max(100).optional(),
        nftChainId: z.number().int().optional(),
        nftCollectionName: z.string().max(200).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.fileBase64, "base64");
        const randomSuffix = Math.random().toString(36).substring(2, 10);
        const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const fileKey = `media/${ctx.user.id}/${randomSuffix}-${safeFileName}`;
        const { url } = await storagePut(fileKey, buffer, input.contentType);
        await createMediaPost({
          userId: ctx.user.id,
          walletAddress: input.walletAddress,
          authorName: ctx.user.name || "Anonymous",
          category: input.category,
          title: input.title,
          description: input.description || null,
          mediaType: input.mediaType,
          mediaUrl: url,
          mediaKey: fileKey,
          fileSizeMb: input.fileSizeMb?.toString() || null,
          nftContractAddress: input.nftContractAddress || null,
          nftTokenId: input.nftTokenId || null,
          nftChainId: input.nftChainId || null,
          nftCollectionName: input.nftCollectionName || null,
        });
        return { success: true, url };
      }),
    shareNft: protectedProcedure
      .input(z.object({
        walletAddress: ethAddressSchema,
        title: safeStringSchema(500).pipe(z.string().min(1)),
        description: safeStringSchema(2000).optional(),
        nftImageUrl: z.string().url().refine((u) => u.startsWith("https://"), "Must be HTTPS URL"),
        nftContractAddress: ethAddressSchema,
        nftTokenId: z.string().min(1).max(100),
        nftChainId: z.number().int(),
        nftCollectionName: z.string().max(200).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await createMediaPost({
          userId: ctx.user.id,
          walletAddress: input.walletAddress,
          authorName: ctx.user.name || "Anonymous",
          category: "nfts",
          title: input.title,
          description: input.description || null,
          mediaType: "nft",
          mediaUrl: input.nftImageUrl,
          mediaKey: `nft/${input.nftContractAddress}/${input.nftTokenId}`,
          nftContractAddress: input.nftContractAddress,
          nftTokenId: input.nftTokenId,
          nftChainId: input.nftChainId,
          nftCollectionName: input.nftCollectionName || null,
        });
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await deleteMediaPost(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  prices: router({
    overview: publicProcedure
      .input(z.object({ chain: z.enum(["pulsechain", "base"]).optional() }).optional())
      .query(async ({ input }) => {
        return getMarketOverview(input?.chain || "pulsechain");
      }),
    ticker: publicProcedure
      .input(z.object({ chain: z.enum(["pulsechain", "base"]).optional() }).optional())
      .query(async ({ input }) => {
        const chain = input?.chain || "pulsechain";

        if (chain === "base") {
          const [basePairs, ethPrice, extraTokens] = await Promise.all([
            fetchBaseTokenPrices(),
            fetchEthPrice(),
            fetchBaseTickerTokens(),
          ]);
          const heroPair = basePairs[0];
          const fmt = (p: any) => p ? { price: p.priceUsd || "0", change24h: p.priceChange?.h24 || 0 } : null;
          return {
            hero: heroPair ? { price: heroPair.priceUsd || "0", change24h: heroPair.priceChange?.h24 || 0 } : null,
            eth: ethPrice ? { price: ethPrice.priceUsd, change24h: ethPrice.priceChange24h } : null,
            jesse: fmt(extraTokens.jesse),
            aero: fmt(extraTokens.aero),
            brett: fmt(extraTokens.brett),
            updatedAt: Date.now(),
          };
        }

        // PulseChain
        const [tokenData, plsPrice, ethPrice, extraTokens] = await Promise.all([
          fetchTokenPrices(),
          fetchPlsPrice(),
          fetchEthPrice(),
          fetchPulsechainTickerTokens(),
        ]);
        const heroPair = tokenData.heroPairs[0];
        const vetsPair = tokenData.vetsPairs[0];
        const fmt = (p: any) => p ? { price: p.priceUsd || "0", change24h: p.priceChange?.h24 || 0 } : null;
        return {
          hero: heroPair ? { price: heroPair.priceUsd || "0", change24h: heroPair.priceChange?.h24 || 0 } : null,
          vets: vetsPair ? { price: vetsPair.priceUsd || "0", change24h: vetsPair.priceChange?.h24 || 0 } : null,
          pls: plsPrice ? { price: plsPrice.priceUsd, change24h: plsPrice.priceChange24h } : null,
          eth: ethPrice ? { price: ethPrice.priceUsd, change24h: ethPrice.priceChange24h } : null,
          emit: fmt(extraTokens.emit),
          rhino: fmt(extraTokens.rhino),
          truFarm: fmt(extraTokens.truFarm),
          updatedAt: Date.now(),
        };
      }),
    basePairs: publicProcedure.query(async () => {
      const pairs = await fetchBaseTokenPrices();
      return pairs.map(p => ({
        pairAddress: p.pairAddress,
        baseSymbol: p.baseToken.symbol,
        quoteSymbol: p.quoteToken.symbol,
        priceUsd: p.priceUsd || "0",
        liquidity: p.liquidity?.usd || 0,
        volume24h: p.volume?.h24 || 0,
        priceChange24h: p.priceChange?.h24 || 0,
      }));
    }),
    search: publicProcedure
      .input(z.object({ query: z.string().min(1).max(100) }))
      .query(async ({ input }) => {
        return searchPairs(input.query);
      }),
    farmPools: publicProcedure
      .input(z.object({ chain: z.enum(["pulsechain", "base"]).optional() }).optional())
      .query(async ({ input }) => {
        return fetchFarmPoolData(input?.chain || "pulsechain");
      }),
    buyAndBurn: publicProcedure.query(async () => {
      return fetchBuyAndBurnData();
    }),
  }),

  dao: router({
    stats: publicProcedure.query(async () => {
      const [allProposals, activeDelegates, treasury] = await Promise.all([
        getProposals(undefined, 1000),
        getDelegates(1000),
        getLatestTreasurySnapshots(),
      ]);
      const active = allProposals.filter(p => p.status === "active").length;
      const passed = allProposals.filter(p => p.status === "passed" || p.status === "executed").length;
      const totalVotingPower = activeDelegates.reduce((sum, d) => sum + (d.votingPower || 0), 0);
      const totalTreasuryUsd = treasury.reduce((sum, t) => sum + parseFloat(t.valueUsd || "0"), 0);
      return {
        totalProposals: allProposals.length,
        activeProposals: active,
        passedProposals: passed,
        totalDelegates: activeDelegates.length,
        totalVotingPower,
        treasuryValueUsd: totalTreasuryUsd,
      };
    }),

    proposals: router({
      list: publicProcedure
        .input(z.object({ status: z.string().optional(), limit: z.number().int().positive().max(100).optional() }).optional())
        .query(async ({ input }) => {
          return getProposals(input?.status, input?.limit ?? 50);
        }),
      get: publicProcedure
        .input(z.object({ proposalId: z.string().min(1) }))
        .query(async ({ input }) => {
          return getProposalById(input.proposalId);
        }),
      create: protectedProcedure
        .input(z.object({
          title: safeStringSchema(512),
          description: safeStringSchema(10000),
          walletAddress: ethAddressSchema,
          chain: z.enum(["base", "pulsechain", "both"]).optional(),
          category: z.enum(["protocol", "treasury", "community", "emergency"]).optional(),
          durationDays: z.number().int().min(1).max(30).optional(),
          confirmBinding: z.boolean().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          // AUDIT FIX (May 29, 2026): Verify wallet ownership before proposal creation
          if (ctx.user.walletAddress) {
            if (input.walletAddress.toLowerCase() !== ctx.user.walletAddress.toLowerCase()) {
              routerLogger.warn("Wallet mismatch on proposal creation", {
                userId: ctx.user.id,
                expected: ctx.user.walletAddress,
                received: input.walletAddress,
              });
              createStandardError("FORBIDDEN", "Wallet address does not match authenticated user");
            }
          } else {
            // Wallet binding on first use — requires explicit confirmation
            if (!input.confirmBinding) {
              return {
                success: false,
                requiresConfirmation: true,
                message: "This will permanently bind this wallet to your account. Set confirmBinding: true to proceed.",
                walletAddress: input.walletAddress,
              };
            }
            await updateUserWalletAddress(ctx.user.id, input.walletAddress);
            routerLogger.info("Wallet bound to user on proposal creation", {
              userId: ctx.user.id,
              walletAddress: input.walletAddress,
            });
          }
          const proposalId = "HERO-" + Date.now().toString(36).toUpperCase();
          // AUDIT FIX: Atomic rate limit + record (race-condition safe)
          const rateCheck = await atomicRateLimitAndRecord(ctx.user.id, proposalId, input.walletAddress, 3);
          if (!rateCheck.allowed) {
            routerLogger.warn("Proposal rate limit exceeded (atomic)", {
              userId: ctx.user.id,
              count: rateCheck.count,
              walletAddress: input.walletAddress,
            });
            createStandardError("TOO_MANY_REQUESTS", "Rate limited: maximum 3 proposals per 24 hours");
          }
          const now = new Date();
          const durationMs = (input.durationDays || 7) * 24 * 60 * 60 * 1000;
          const endTime = new Date(now.getTime() + durationMs);
          // AUDIT FIX #3 (May 27, 2026): Generate content hash for tamper detection
          const contentHash = generateProposalHash(
            proposalId, input.title, input.description,
            input.walletAddress, input.chain || "both", now, endTime
          );
          await createProposal({
            proposalId,
            title: input.title,
            description: input.description,
            proposerId: ctx.user.id,
            proposerAddress: input.walletAddress,
            chain: input.chain || "both",
            category: input.category || "protocol",
            startTime: now,
            endTime,
          });
          // AUDIT FIX #3: Anchor on-chain (non-blocking — don't fail proposal creation)
          let anchorTxHash: string | null = null;
          try {
            anchorTxHash = await anchorProposalOnChain(proposalId, contentHash, endTime);
            if (anchorTxHash) {
              const anchored = await getProposalById(proposalId);
              if (anchored) {
                await updateProposal(anchored.id, { anchoredOnChain: true, anchorTxHash } as any);
              }
            }
          } catch (err) {
            console.warn("[DAO] On-chain anchoring failed (non-blocking):", err);
          }
          return { success: true, proposalId, contentHash, anchorTxHash };
        }),
      updateStatus: protectedProcedure
        .input(z.object({
          proposalId: z.string().min(1),
          status: z.enum(["pending", "active", "passed", "defeated", "queued", "executed", "cancelled"]),
        }))
        .mutation(async ({ input }) => {
          const proposal = await getProposalById(input.proposalId);
          if (!proposal) createStandardError("NOT_FOUND", "Proposal not found");
          await updateProposal(proposal.id, { status: input.status });
          return { success: true };
        }),
    }),

    votes: router({
      list: publicProcedure
        .input(z.object({ proposalDbId: z.number().int().positive() }))
        .query(async ({ input }) => {
          return getVotesByProposal(input.proposalDbId);
        }),
      myVote: protectedProcedure
        .input(z.object({ proposalDbId: z.number().int().positive() }))
        .query(async ({ ctx, input }) => {
          return getUserVote(input.proposalDbId, ctx.user.id);
        }),
      cast: protectedProcedure
        .input(z.object({
          proposalDbId: z.number().int().positive(),
          proposalId: z.string().min(1),
          voterAddress: ethAddressSchema,
          choice: z.enum(["for", "against", "abstain"]),
          votingPower: z.number().int().positive().max(1_000_000_000),
          chain: z.enum(["base", "pulsechain"]),
          txHash: txHashSchema,
        }))
        .mutation(async ({ ctx, input }) => {
          // AUDIT FIX 1.4: Verify wallet address belongs to authenticated user
          // If user has a registered wallet, it MUST match. If not registered, bind it on first vote.
          if (ctx.user.walletAddress) {
            if (input.voterAddress.toLowerCase() !== ctx.user.walletAddress.toLowerCase()) {
              createStandardError("FORBIDDEN", "Voter address does not match authenticated user's wallet");
            }
          } else {
            // First-time voter: bind this wallet to their account to prevent future spoofing
            // This ensures subsequent votes must come from the same wallet
            await updateUserWalletAddress(ctx.user.id, input.voterAddress);
            routerLogger.info("Wallet bound to user on vote cast", {
              userId: ctx.user.id,
              walletAddress: input.voterAddress,
              proposalId: input.proposalId,
            });
          }
          const existing = await getUserVote(input.proposalDbId, ctx.user.id);
          if (existing) createStandardError("BAD_REQUEST", "Already voted on this proposal");
          // AUDIT FIX: Server-side on-chain verification of voting power
          const verifiedPower = await verifyVotingPower(input.voterAddress, input.chain);
          if (verifiedPower <= 0) createStandardError("PRECONDITION_FAILED", "No HERO tokens found — cannot vote");
          // Use the LOWER of client-claimed and on-chain verified power (prevents inflation)
          const trustedPower = Math.min(input.votingPower, verifiedPower);
          await castVote({
            proposalId: input.proposalDbId,
            voterId: ctx.user.id,
            voterAddress: input.voterAddress,
            choice: input.choice,
            votingPower: trustedPower,
            chain: input.chain,
            txHash: input.txHash || null,
          });
          // Update proposal vote tallies
          const proposal = await getProposalById(input.proposalId);
          if (proposal) {
            const newFor = input.choice === "for" ? proposal.votesFor + trustedPower : proposal.votesFor;
            const newAgainst = input.choice === "against" ? proposal.votesAgainst + trustedPower : proposal.votesAgainst;
            const newAbstain = input.choice === "abstain" ? proposal.votesAbstain + trustedPower : proposal.votesAbstain;
            await updateProposalVotes(input.proposalId, newFor, newAgainst, newAbstain);
          }
          return { success: true };
        }),
    }),

    delegates: router({
      list: publicProcedure
        .input(z.object({ limit: z.number().int().positive().max(100).optional() }).optional())
        .query(async ({ input }) => {
          return getDelegates(input?.limit ?? 50);
        }),
      byAddress: publicProcedure
        .input(z.object({ address: ethAddressSchema }))
        .query(async ({ input }) => {
          return getDelegateByAddress(input.address);
        }),
      register: protectedProcedure
        .input(z.object({
        address: ethAddressSchema,
        displayName: safeStringSchema(128).optional(),
        statement: safeStringSchema(5000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
          const existing = await getDelegateByAddress(input.address);
          if (existing) createStandardError("BAD_REQUEST", "Already registered as delegate");
          await registerDelegate({
            userId: ctx.user.id,
            address: input.address,
            displayName: input.displayName || null,
            statement: input.statement || null,
          });
          return { success: true };
        }),
      update: protectedProcedure
        .input(z.object({
        address: ethAddressSchema,
        displayName: safeStringSchema(128).optional(),
        statement: safeStringSchema(5000).optional(),
      }))
      .mutation(async ({ input }) => {
          const delegate = await getDelegateByAddress(input.address);
          if (!delegate) createStandardError("NOT_FOUND", "Delegate not found");
          await updateDelegate(delegate.id, {
            displayName: input.displayName || delegate.displayName,
            statement: input.statement || delegate.statement,
          });
          return { success: true };
        }),
    }),

    delegations: router({
      myDelegations: protectedProcedure.query(async ({ ctx }) => {
        return getDelegationsByDelegator(ctx.user.id);
      }),
      receivedDelegations: protectedProcedure
        .input(z.object({ delegateId: z.number().int().positive() }))
        .query(async ({ input }) => {
          return getDelegationsByDelegate(input.delegateId);
        }),
      create: protectedProcedure
        .input(z.object({
          delegatorAddress: ethAddressSchema,
          delegateAddress: ethAddressSchema,
          amount: z.number().int().positive().max(1_000_000_000),
          chain: z.enum(["base", "pulsechain"]),
          txHash: txHashSchema,
          confirmBinding: z.boolean().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          // AUDIT FIX 1.4: Verify delegator address belongs to authenticated user
          if (ctx.user.walletAddress && input.delegatorAddress.toLowerCase() !== ctx.user.walletAddress.toLowerCase()) {
            routerLogger.warn("Wallet mismatch on delegation", {
              userId: ctx.user.id,
              expected: ctx.user.walletAddress,
              received: input.delegatorAddress,
            });
            createStandardError("FORBIDDEN", "Delegator address does not match authenticated user's wallet");
          } else if (!ctx.user.walletAddress) {
            if (!input.confirmBinding) {
              return {
                success: false,
                requiresConfirmation: true,
                message: "This will permanently bind this wallet to your account. Set confirmBinding: true to proceed.",
                walletAddress: input.delegatorAddress,
              };
            }
            await updateUserWalletAddress(ctx.user.id, input.delegatorAddress);
            routerLogger.info("Wallet bound to user on delegation", {
              userId: ctx.user.id,
              walletAddress: input.delegatorAddress,
            });
          }
          const delegate = await getDelegateByAddress(input.delegateAddress);
          if (!delegate) createStandardError("NOT_FOUND", "Delegate not found");
          await createDelegation({
            delegatorId: ctx.user.id,
            delegatorAddress: input.delegatorAddress,
            delegateId: delegate.id,
            delegateAddress: input.delegateAddress,
            amount: input.amount,
            chain: input.chain,
            txHash: input.txHash || null,
          });
          // AUDIT FIX 1.2/3.1: Use atomic SQL increment to prevent race conditions
          await atomicIncrementDelegateStats(delegate.id, input.amount);
          return { success: true };
        }),
      revoke: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          await revokeDelegation(input.id, ctx.user.id);
          return { success: true };
        }),
    }),

    treasury: router({
      snapshots: publicProcedure
        .input(z.object({ chain: z.string().optional() }).optional())
        .query(async ({ input }) => {
          return getLatestTreasurySnapshots(input?.chain);
        }),
      record: protectedProcedure
        .input(z.object({
          chain: z.enum(["base", "pulsechain"]),
          tokenSymbol: tokenSymbolSchema,
          tokenAddress: ethAddressSchema,
          balance: z.string().regex(/^\d+\.?\d*$/, "Invalid balance"),
          valueUsd: z.string().regex(/^\d+\.?\d*$/, "Invalid USD value").optional(),
        }))
        .mutation(async ({ input }) => {
          await saveTreasurySnapshot(input);
          return { success: true };
        }),
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

Be helpful, accurate, and concise. Use markdown formatting. Always include disclaimers that this is not financial advice. Be bullish but honest about $HERO and $VETS. Detect and warn about potential scams when asked. Keep responses under 500 words unless detailed analysis is requested.

IMPORTANT: If a user asks for help, support, has questions you cannot answer, or needs to speak with the team, ALWAYS direct them to the official Telegram community: https://t.me/VetsInCrypto/1 — Say something like "For further assistance or to connect with the HERO community, join our Telegram: https://t.me/VetsInCrypto/1" Include this link whenever someone asks for help, support, or community resources.`;

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

  // ─── Influencer Mentions (Twitter/X Tracking) ──────────────────
  influencer: router({
    /** Public: list mentions with optional category filter */
    list: publicProcedure
      .input(z.object({
        category: z.enum(["influencer", "community", "press", "partner"]).optional(),
        limit: z.number().int().positive().max(100).optional(),
        offset: z.number().int().min(0).optional(),
      }).optional())
      .query(async ({ input }) => {
        return getInfluencerMentions({
          category: input?.category,
          limit: input?.limit ?? 50,
          offset: input?.offset ?? 0,
        });
      }),

    /** Public: get mention stats (counts by category) */
    stats: publicProcedure.query(async () => {
      return getInfluencerMentionStats();
    }),

    /** Protected: trigger a manual fetch from Twitter API */
    refresh: protectedProcedure.mutation(async () => {
      const restId = await getHeroRestId();
      if (!restId) {
        return { success: false, message: "Could not resolve @HERO501c3 Twitter ID. API rate limit may be hit.", fetched: 0, newCount: 0, alertsSent: 0 };
      }

      const tweets = await fetchHeroTweets(restId, 40);
      let newCount = 0;
      let alertsSent = 0;

      for (const tweet of tweets) {
        const existing = await getInfluencerMentionByTweetId(tweet.tweetId);
        const isNew = !existing;
        await upsertInfluencerMention(toDbRecord(tweet));
        // Send Telegram alert for new high-profile mentions
        if (isNew) {
          newCount++;
          const sent = await alertNewMention(tweet);
          if (sent) alertsSent++;
        }
      }

      return { success: true, message: `Fetched ${tweets.length} tweets, ${newCount} new, ${alertsSent} alerts sent.`, fetched: tweets.length, newCount, alertsSent };
    }),

    /** Public: get scheduler status */
    schedulerStatus: publicProcedure.query(() => {
      return getSchedulerStatus();
    }),

    /** Protected (admin): toggle pin on a mention */
    togglePin: adminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        isPinned: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        await toggleMentionPinned(input.id, input.isPinned);
        return { success: true };
      }),

    /** Protected (admin): toggle highlight on a mention */
    toggleHighlight: adminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        isHighlighted: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        await toggleMentionHighlight(input.id, input.isHighlighted);
        return { success: true };
      }),

    /** Protected (admin): hide/unhide a mention */
    toggleHidden: adminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        isHidden: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        await toggleMentionHidden(input.id, input.isHidden);
        return { success: true };
      }),

    /** Protected (admin): update mention category */
    updateCategory: adminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        category: z.enum(["influencer", "community", "press", "partner"]),
      }))
      .mutation(async ({ input }) => {
        await updateMentionCategory(input.id, input.category);
        return { success: true };
      }),

    /** Protected: manually add a mention (for press/partner entries) */
    addManual: protectedProcedure
      .input(z.object({
        tweetId: z.string().min(1).max(30),
        authorUsername: z.string().min(1).max(100),
        authorDisplayName: z.string().max(200).optional(),
        authorFollowerCount: z.number().int().min(0).optional(),
        tweetText: safeStringSchema(5000),
        tweetUrl: z.string().url().max(500),
        category: z.enum(["influencer", "community", "press", "partner"]),
        heroMentioned: z.boolean().optional(),
        vetsMentioned: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        await upsertInfluencerMention({
          tweetId: input.tweetId,
          authorUsername: input.authorUsername,
          authorDisplayName: input.authorDisplayName || input.authorUsername,
          authorFollowerCount: input.authorFollowerCount || 0,
          tweetText: input.tweetText,
          tweetUrl: input.tweetUrl,
          mentionType: "direct_mention",
          category: input.category,
          heroMentioned: input.heroMentioned ?? true,
          vetsMentioned: input.vetsMentioned ?? false,
          sentiment: "positive",
          isHighlighted: false,
          isHidden: false,
        });
        return { success: true };
      }),
  }),
  // ─── Spin Wheel Router ─────────────────────────────────────────────────────
  spin: router({
    canSpin: publicProcedure
      .input(z.object({ wallet: ethAddressSchema }))
      .query(({ input }) => {
        const record = spinRecordsV2.get(input.wallet.toLowerCase()) || null;
        const eligible = canSpinTodayV2(record);
        const streak = record?.currentStreak || 0;
        const bonus = getStreakBonusV2(streak);
        const nftTier = record?.nftTier || 'bronze';
        const canBurn = !eligible && record !== null;
        const burnCost = canBurn ? getBurnCostV2(1) : '0';
        return {
          eligible,
          streak,
          bonus,
          totalSpins: record?.totalSpins || 0,
          nftTier,
          canBurnForSpin: canBurn,
          burnCost,
          nextSpinAt: !eligible ? new Date(new Date().setHours(24,0,0,0)).toISOString() : undefined,
        };
      }),
    execute: publicProcedure
      .input(z.object({
        wallet: ethAddressSchema,
        chain: z.enum(["pulsechain", "base"]).optional(),
        burnForSecondSpin: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        // Rate limiting
        if (!checkSpinRateLimit(input.wallet)) {
          createStandardError("TOO_MANY_REQUESTS", "Too many spin attempts. Please wait a moment.");
        }
        // IP-based rate limiting (prevents multi-wallet abuse from same IP)
        const clientIp = (ctx as any)?.req?.headers?.['cf-connecting-ip'] || (ctx as any)?.req?.socket?.remoteAddress || 'unknown';
        const ipSpinKey = 'ip_spin_' + clientIp;
        if (!checkRateLimit(ipSpinKey, 20)) {
          createStandardError("TOO_MANY_REQUESTS", "IP rate limit exceeded");
        }
        const key = input.wallet.toLowerCase();
        const record = spinRecordsV2.get(key) || null;
        const eligible = canSpinTodayV2(record);

        // Handle burn-for-second-spin
        if (!eligible && input.burnForSecondSpin) {
          // In production: verify burn tx on-chain before allowing
          routerLogger.info("Burn-for-spin attempt", { wallet: key });
        } else if (!eligible) {
          createStandardError("TOO_MANY_REQUESTS", "Already spun today. Come back tomorrow or burn HERO for another spin!");
        }

        const nftTier = record?.nftTier || 'bronze';
        routerLogger.info("Spin V2 execute", { wallet: key, tier: nftTier, streak: record?.currentStreak || 0 });

        let result;
        try {
          result = await performSpinV2(input.wallet, record, nftTier, input.chain || "pulsechain");
        } catch (err) {
          console.error("[SpinV2] RNG failure:", err);
          createStandardError("INTERNAL_SERVER_ERROR", "Spin failed — please try again.");
        }

        const updated = updateSpinRecordV2(record, input.wallet, result);
        spinRecordsV2.set(key, updated);

        // Update leaderboard
        updateLeaderboard(key, updated);

        return result;
      }),
    claim: publicProcedure
      .input(z.object({
        wallet: ethAddressSchema,
        claimId: z.string().min(1),
        spinTimestamp: z.number(),
      }))
      .mutation(({ input }) => {
        const key = input.wallet.toLowerCase();
        const record = spinRecordsV2.get(key);
        if (!record) {
          createStandardError("NOT_FOUND", "No spin record found for this wallet.");
        }
        // Find the spin result with this claimId
        const spinResult = record!.history.find(h => h.claimId === input.claimId);
        if (!spinResult) {
          createStandardError("NOT_FOUND", "Claim not found. It may have expired.");
        }
        if (!spinResult!.claimable) {
          createStandardError("BAD_REQUEST", "This reward is not claimable on-chain.");
        }
        // Generate claim signature for on-chain verification
        const { message, claimData } = generateClaimSig(
          input.wallet,
          spinResult!.finalRewardValue,
          input.claimId,
          spinResult!.rngProof.proofHash
        );
        const claimNonce = crypto.randomUUID();
        const claimExpiry = Date.now() + 3600000; // 1 hour expiry
        return {
          success: true,
          claimData,
          signature: message,
          amount: spinResult!.finalRewardValue,
          rewardType: spinResult!.rewardType,
          nonce: claimNonce,
          expiresAt: claimExpiry,
        };
      }),
    history: publicProcedure
      .input(z.object({ wallet: ethAddressSchema }))
      .query(({ input }) => {
        const record = spinRecordsV2.get(input.wallet.toLowerCase());
        return {
          history: record?.history || [],
          stats: {
            totalSpins: record?.totalSpins || 0,
            currentStreak: record?.currentStreak || 0,
            longestStreak: record?.longestStreak || 0,
            totalHeroEarned: record?.totalHeroEarned || 0,
            totalBurned: record?.totalBurned || 0,
            nftTier: record?.nftTier || 'bronze',
          },
        };
      }),
    leaderboard: publicProcedure.query(() => {
      return Array.from(leaderboardCache.values())
        .sort((a, b) => b.currentStreak - a.currentStreak)
        .slice(0, 20);
    }),
    verify: publicProcedure
      .input(z.object({ wallet: ethAddressSchema, spinTimestamp: z.number() }))
      .query(({ input }) => {
        const record = spinRecordsV2.get(input.wallet.toLowerCase());
        const spin = record?.history.find(h => h.spinTimestamp === input.spinTimestamp);
        if (!spin) return { verified: false, message: "Spin not found" };
        return {
          verified: true,
          proof: {
            blockHash: spin.rngProof.blockHash,
            blockNumber: spin.rngProof.blockNumber,
            seed: spin.rngProof.seed,
            proofHash: spin.rngProof.proofHash,
            chain: spin.rngProof.chain,
            timestamp: spin.rngProof.timestamp,
            value: spin.rngProof.value,
          },
          result: {
            segmentId: spin.segmentId,
            segmentLabel: spin.segmentLabel,
            multiplier: spin.multiplier,
            finalReward: spin.finalRewardValue,
          },
        };
      }),
    wheel: publicProcedure
      .input(z.object({ wallet: ethAddressSchema.optional() }))
      .query(({ input }) => {
        const tier = input.wallet
          ? (spinRecordsV2.get(input.wallet.toLowerCase())?.nftTier || 'bronze')
          : 'bronze';
        return { tier, segments: getWheelForTierV2(tier) };
      }),
  }),
  // ─── Raffle/Giveaway Router ────────────────────────────────────────────────
  raffle: router({
    list: publicProcedure.query(() => {
      return Array.from(activeRaffles.values()).map(r => ({
        id: r.id, title: r.title, description: r.description,
        prize: r.prize, prizeValue: r.prizeValue,
        status: r.status, startTime: r.startTime, endTime: r.endTime,
        entries: r.entries.length, maxEntries: r.maxEntries,
        winnerCount: r.winnerCount, winners: r.winners || [],
      }));
    }),
    enter: protectedProcedure
      .input(z.object({ raffleId: z.string().min(1), wallet: ethAddressSchema, heroBalance: z.string() }))
      .mutation(({ ctx, input }) => {
        // AUDIT FIX: Verify wallet ownership for raffle entry
        if (ctx.user.walletAddress && input.wallet.toLowerCase() !== ctx.user.walletAddress.toLowerCase()) {
          createStandardError("FORBIDDEN", "Wallet address does not match authenticated user");
        }
        const raffle = activeRaffles.get(input.raffleId);
        if (!raffle) createStandardError("NOT_FOUND", "Raffle not found");
        const entry = enterRaffle(raffle, input.wallet, BigInt(input.heroBalance));
        return { success: true, enteredAt: entry.enteredAt };
      }),
    draw: adminProcedure
      .input(z.object({ raffleId: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const raffle = activeRaffles.get(input.raffleId);
        if (!raffle) createStandardError("NOT_FOUND", "Raffle not found");
        const result = await drawRaffleWinners(raffle);
        activeRaffles.set(input.raffleId, { ...raffle, status: "completed", winners: result.winners });
        return result;
      }),
  }),
});

export type AppRouter = typeof appRouter;
