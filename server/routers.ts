import { getHeroCardsTier, canAccessHeroSpinWheel } from "./heroCards-holder";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router , rateLimitedMutation } from "./_core/trpc";
import { z } from "zod";
import { createPublicClient, http, erc20Abi } from "viem";
import { pulsechain } from "viem/chains";

// ─── RPC Monitoring Logger ─────────────────────────────────────────────────
const rpcMetrics = {
  pulsechain: { calls: 0, timeouts: 0, errors: 0, lastError: null as string | null, avgMs: 0 },
  base: { calls: 0, timeouts: 0, errors: 0, lastError: null as string | null, avgMs: 0 },
};

function logRpcEvent(chain: "pulsechain" | "base", event: "call" | "timeout" | "error", durationMs?: number, errorMsg?: string) {
  const m = rpcMetrics[chain];
  m.calls++;
  if (event === "timeout") {
    m.timeouts++;
    m.lastError = `RPC timeout after ${durationMs}ms`;
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "warn",
      module: "rpc-monitor",
      event: "rpc_timeout",
      chain,
      durationMs,
      totalTimeouts: m.timeouts,
      totalCalls: m.calls,
      timeoutRate: `${((m.timeouts / m.calls) * 100).toFixed(1)}%`,
    }));
  } else if (event === "error") {
    m.errors++;
    m.lastError = errorMsg || "unknown";
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      module: "rpc-monitor",
      event: "rpc_error",
      chain,
      durationMs,
      error: errorMsg,
      totalErrors: m.errors,
      totalCalls: m.calls,
    }));
  } else if (durationMs) {
    // Track average response time (rolling)
    m.avgMs = m.avgMs === 0 ? durationMs : (m.avgMs * 0.9 + durationMs * 0.1);
    // Log slow RPC calls (>5s) for tuning
    if (durationMs > 5000) {
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "warn",
        module: "rpc-monitor",
        event: "rpc_slow",
        chain,
        durationMs,
        avgMs: Math.round(m.avgMs),
      }));
    }
  }
}

// Export for health check endpoint
export function getRpcMetrics() { return rpcMetrics; }

// ─── On-Chain Verification Clients ──────────────────────────────────────
const pulsechainClient = createPublicClient({ chain: pulsechain, transport: http("https://rpc.pulsechain.com", { timeout: 10_000 }) });
const baseClient = createPublicClient({ chain: { id: 8453, name: "Base", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: ["https://mainnet.base.org"] } } } as any, transport: http("https://mainnet.base.org", { timeout: 10_000 }) });

const HERO_TOKENS: Record<string, `0x${string}`> = {
  pulsechain: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
  base: "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8",
};

const HISTORICAL_VOTES_ABI = [
  {
    type: "function", name: "getPastVotes", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }, { name: "blockNumber", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function", name: "getPastTotalSupply", stateMutability: "view",
    inputs: [{ name: "blockNumber", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const RPC_TIMEOUT_MS = 10_000;

function clientForChain(chain: VoteChain) {
  return chain === "pulsechain" ? pulsechainClient : baseClient;
}

function wholeTokenNumber(raw: bigint): number {
  const whole = raw / 10n ** 18n;
  if (whole > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Voting power exceeds safe integer range");
  return Number(whole);
}

async function withRpcTimeout<T>(chain: VoteChain, task: Promise<T>): Promise<T> {
  const startTime = Date.now();
  try {
    const value = await Promise.race([
      task,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("RPC timeout")), RPC_TIMEOUT_MS)),
    ]);
    logRpcEvent(chain, "call", Date.now() - startTime);
    return value;
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const isTimeout = err?.message?.includes("timeout") || durationMs >= RPC_TIMEOUT_MS;
    logRpcEvent(chain, isTimeout ? "timeout" : "error", durationMs, err?.message);
    throw err;
  }
}

async function captureBindingSnapshot(chain: VoteChain, proposerAddress: string) {
  const client = clientForChain(chain);
  const confirmations = parseFinalityBlocks(
    chain === "base" ? process.env.DAO_BASE_FINALITY_BLOCKS : process.env.DAO_PULSECHAIN_FINALITY_BLOCKS,
    chain === "base" ? 20n : 64n,
  );
  const head = await withRpcTimeout(chain, client.getBlockNumber());
  const block = finalizedPriorBlock(head, confirmations);
  const [totalSupply] = await Promise.all([
    withRpcTimeout(chain, client.readContract({
      address: HERO_TOKENS[chain],
      abi: HISTORICAL_VOTES_ABI,
      functionName: "getPastTotalSupply",
      args: [block],
    })),
    withRpcTimeout(chain, client.readContract({
      address: HERO_TOKENS[chain],
      abi: HISTORICAL_VOTES_ABI,
      functionName: "getPastVotes",
      args: [proposerAddress as `0x${string}`, block],
    })),
  ]);
  const totalSupplyTokens = wholeTokenNumber(totalSupply);
  if (totalSupplyTokens <= 0) throw new Error("Historical total supply is unavailable");
  return {
    block: Number(block),
    confirmations: Number(confirmations),
    totalSupplyRaw: totalSupply.toString(),
    quorum: Math.max(1, Math.floor(totalSupplyTokens * 0.04)),
  };
}

async function verifyHistoricalVotingPower(voterAddress: string, chain: VoteChain, snapshotBlock: number): Promise<number> {
  try {
    const votes = await withRpcTimeout(chain, clientForChain(chain).readContract({
      address: HERO_TOKENS[chain],
      abi: HISTORICAL_VOTES_ABI,
      functionName: "getPastVotes",
      args: [voterAddress as `0x${string}`, BigInt(snapshotBlock)],
    }));
    return wholeTokenNumber(votes);
  } catch {
    return 0;
  }
}

async function verifyAdvisoryVotingPower(voterAddress: string, chain: VoteChain): Promise<number> {
  try {
    const balance = await withRpcTimeout(chain, clientForChain(chain).readContract({
      address: HERO_TOKENS[chain],
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [voterAddress as `0x${string}`],
    }));
    return wholeTokenNumber(balance);
  } catch {
    return 0;
  }
}

// ─── Reusable Validation Schemas ────────────────────────────────────────
// Ethereum/PulseChain hex address: exactly 42 chars, 0x prefix + 40 hex chars
const ethAddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid wallet address format");
// Transaction hash: 0x prefix + 64 hex chars
// ─── In-memory stores for spin records and active raffles ─────────────────
const spinRecordsV2 = new Map<string, UserSpinRecordV2>();
const leaderboardCache = new Map<string, { wallet: string; currentStreak: number; longestStreak: number; totalSpins: number; totalHeroEarned: number; biggestWin: string }>();

// Helper functions for V2 router
function checkSpinRateLimit(wallet: string): boolean { return checkRateLimit(wallet, 5); }
function getBurnCostV2(spinsToday: number): string { return getBurnCost(spinsToday); }
function getWheelForTierV2(tier: string) { return getWheelForTier(tier as any); }
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
  castVoteAndIncrementTallies,
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
import { performSpinV2, canSpinTodayV2, updateSpinRecordV2, getStreakBonusV2, getWheelForTier, getBurnCost, checkRateLimit, type UserSpinRecordV2 } from "./spin-engine-v2";
import { createRaffle, enterRaffle, drawRaffleWinners, type Raffle, type RaffleEntry } from "./raffle-engine";
import { getMarketOverview, fetchTokenPrices, fetchBaseTokenPrices, fetchPlsPrice, fetchEthPrice, searchPairs, fetchFarmPoolData, fetchBuyAndBurnData, fetchPulsechainTickerTokens, fetchBaseTickerTokens } from "./priceFeed";
import { anchorProposalOnChain } from "./dao-anchor-integration";
import { generateProposalHash } from "./dao-security-hardening";
import { createDaoLogger } from "./dao-logger";
import { atomicRateLimitAndRecord } from "./dao-rate-limiter";
import { fetchSnapshotProposalById, fetchSnapshotProposals } from "./snapshot-integration";
import {
  finalizedPriorBlock,
  parseFinalityBlocks,
  requireBindingVotingEnabled,
  resolveBindingVoteChain,
  snapshotBlockForChain,
  type VoteChain,
} from "./dao-snapshot-policy";

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
    list: protectedProcedure
      .input(z.object({ wallet: ethAddressSchema, chainId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        if (
          ctx.user.walletAddress &&
          input.wallet.toLowerCase() !== ctx.user.walletAddress.toLowerCase()
        ) {
          createStandardError("FORBIDDEN", "Wallet address does not match authenticated user");
        }
        return getDcaOrdersByUser(ctx.user.id);
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
          governanceMode: z.enum(["advisory", "binding"]).default("advisory"),
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
          const proposalChain = input.chain || "both";
          let snapshotBaseBlock: number | null = null;
          let snapshotPulsechainBlock: number | null = null;
          let snapshotBaseTotalSupply: string | null = null;
          let snapshotPulsechainTotalSupply: string | null = null;
          let snapshotConfirmations: number | null = null;
          let snapshotVerifiedAt: Date | null = null;
          let bindingDisabledReason: string | null = "Advisory proposal: historical voting power is not binding.";
          let quorum = 5_000_000;

          if (input.governanceMode === "binding") {
            try {
              requireBindingVotingEnabled(process.env.DAO_BINDING_VOTING_ENABLED);
            } catch (error) {
              createStandardError("PRECONDITION_FAILED", error instanceof Error ? error.message : "Binding DAO voting is disabled");
            }
            if (proposalChain === "both") {
              createStandardError("BAD_REQUEST", "Binding multi-chain proposals must be split into Base and PulseChain proposals");
            }
            try {
              const snapshot = await captureBindingSnapshot(proposalChain, input.walletAddress);
              snapshotConfirmations = snapshot.confirmations;
              snapshotVerifiedAt = new Date();
              bindingDisabledReason = null;
              quorum = snapshot.quorum;
              if (proposalChain === "base") {
                snapshotBaseBlock = snapshot.block;
                snapshotBaseTotalSupply = snapshot.totalSupplyRaw;
              } else {
                snapshotPulsechainBlock = snapshot.block;
                snapshotPulsechainTotalSupply = snapshot.totalSupplyRaw;
              }
            } catch (error) {
              routerLogger.error("Binding snapshot capture failed closed", {
                chain: proposalChain,
                error: error instanceof Error ? error.message : String(error),
              });
              createStandardError("PRECONDITION_FAILED", "Token historical voting capability or finalized snapshot is unavailable");
            }
          }

          // AUDIT FIX #3 (May 27, 2026): Generate content hash for tamper detection
          const contentHash = generateProposalHash(
            proposalId, input.title, input.description,
            input.walletAddress, proposalChain, now, endTime
          );
          await createProposal({
            proposalId,
            title: input.title,
            description: input.description,
            proposerId: ctx.user.id,
            proposerAddress: input.walletAddress,
            chain: proposalChain,
            category: input.category || "protocol",
            startTime: now,
            endTime,
            quorum,
            governanceMode: input.governanceMode,
            snapshotVersion: 2,
            snapshotConfirmations,
            snapshotBaseBlock,
            snapshotPulsechainBlock,
            snapshotBaseTotalSupply,
            snapshotPulsechainTotalSupply,
            snapshotVerifiedAt,
            bindingDisabledReason,
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
          return {
            success: true,
            proposalId,
            contentHash,
            anchorTxHash,
            governanceMode: input.governanceMode,
            snapshotBaseBlock,
            snapshotPulsechainBlock,
          };
        }),
      updateStatus: protectedProcedure
        .input(z.object({
          proposalId: z.string().min(1),
          status: z.enum(["pending", "active", "passed", "defeated", "queued", "executed", "cancelled"]),
        }))
        .mutation(async ({ ctx, input }) => {
          const proposal = await getProposalById(input.proposalId);
          if (!proposal) createStandardError("NOT_FOUND", "Proposal not found");
          // SECURITY FIX (cert/hero-wallet-staking-dao-20260725): enforce proposer ownership.
          // Previously any authenticated user could change any proposal's status.
          if (proposal.proposerId !== ctx.user.id) {
            createStandardError("FORBIDDEN", "Only the proposal creator may update its status");
          }
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
          const proposal = await getProposalById(input.proposalId);
          if (!proposal) createStandardError("NOT_FOUND", "Proposal not found");
          if (proposal.id !== input.proposalDbId) {
            createStandardError("BAD_REQUEST", "Proposal database and public identifiers do not match");
          }

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

          let verifiedPower: number;
          let snapshotBlock: number | null = null;
          if (proposal.governanceMode === "binding") {
            try {
              requireBindingVotingEnabled(process.env.DAO_BINDING_VOTING_ENABLED);
            } catch (error) {
              createStandardError("PRECONDITION_FAILED", error instanceof Error ? error.message : "Binding DAO voting is disabled");
            }
            let boundChain: VoteChain;
            try {
              boundChain = resolveBindingVoteChain(proposal.chain, input.chain);
              snapshotBlock = snapshotBlockForChain(proposal, boundChain);
            } catch (error) {
              createStandardError("PRECONDITION_FAILED", error instanceof Error ? error.message : "Invalid binding snapshot");
            }
            verifiedPower = await verifyHistoricalVotingPower(input.voterAddress, boundChain!, snapshotBlock!);
            if (verifiedPower <= 0) {
              createStandardError("PRECONDITION_FAILED", "No historical HERO voting power at the proposal snapshot");
            }
          } else {
            if (proposal.chain !== "both" && proposal.chain !== input.chain) {
              createStandardError("BAD_REQUEST", "Vote chain does not match proposal chain");
            }
            verifiedPower = await verifyAdvisoryVotingPower(input.voterAddress, input.chain);
            if (verifiedPower <= 0) {
              createStandardError("PRECONDITION_FAILED", "No current HERO balance found for this advisory vote");
            }
          }

          const trustedPower = Math.min(input.votingPower, verifiedPower);
          await castVoteAndIncrementTallies({
            proposalId: input.proposalDbId,
            voterId: ctx.user.id,
            voterAddress: input.voterAddress,
            choice: input.choice,
            votingPower: trustedPower,
            chain: input.chain,
            txHash: input.txHash || null,
          });
          return {
            success: true,
            governanceMode: proposal.governanceMode,
            snapshotBlock,
            trustedPower,
          };
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
      .mutation(async ({ ctx, input }) => {
          const delegate = await getDelegateByAddress(input.address);
          if (!delegate) createStandardError("NOT_FOUND", "Delegate not found");
          // SECURITY FIX (cert/hero-wallet-staking-dao-20260725): enforce delegate ownership.
          // Previously any authenticated user could update any delegate profile by address.
          if (delegate.userId !== ctx.user.id) {
            createStandardError("FORBIDDEN", "Only the delegate owner may update this profile");
          }
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

    snapshot: router({
      proposals: publicProcedure
        .input(z.object({ limit: z.number().int().positive().max(50).optional() }).optional())
        .query(async ({ input }) => fetchSnapshotProposals(input?.limit ?? 20)),
      proposal: publicProcedure
        .input(z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/) }))
        .query(async ({ input }) => fetchSnapshotProposalById(input.id)),
      spaceInfo: publicProcedure.query(() => ({
        spaceId: "hero-dao.eth",
        url: "https://snapshot.org/#/hero-dao.eth",
        network: "1",
        strategies: ["erc20-balance-of"],
      })),
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
  // Reward mutations remain fail-closed in production until the records are
  // persisted and an audited distributor signer/on-chain burn verifier exists.
  spin: router({
    canSpin: publicProcedure
      .input(z.object({ wallet: ethAddressSchema }))
      .query(async ({ input }) => {
        const productionRewardsAvailable = process.env.NODE_ENV !== "production";
        const record = spinRecordsV2.get(input.wallet.toLowerCase()) || null;
        const eligible = productionRewardsAvailable && canSpinTodayV2(record);
        const streak = record?.currentStreak || 0;
        const bonus = getStreakBonusV2(streak);
        const nftTier = await getHeroCardsTier(input.wallet) || record?.nftTier || "bronze";
        const canBurn = false;
        return {
          serviceAvailable: productionRewardsAvailable,
          serviceMessage: productionRewardsAvailable
            ? undefined
            : "Reward spins are temporarily offline while persistent records and the audited claim distributor are completed.",
          eligible,
          streak,
          bonus,
          totalSpins: record?.totalSpins || 0,
          nftTier,
          canBurnForSpin: canBurn,
          burnCost: "0",
          nextSpinAt: productionRewardsAvailable && !eligible
            ? new Date(new Date().setHours(24, 0, 0, 0)).toISOString()
            : undefined,
        };
      }),
    execute: protectedProcedure
      .input(z.object({
        wallet: ethAddressSchema,
        chain: z.enum(["pulsechain", "base"]).optional(),
        burnForSecondSpin: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const key = input.wallet.toLowerCase();
        const boundWallet = ctx.user.walletAddress?.toLowerCase();
        if (!boundWallet) {
          createStandardError("PRECONDITION_FAILED", "Bind this wallet to your signed-in account before spinning.");
        }
        if (boundWallet !== key) {
          createStandardError("FORBIDDEN", "The connected wallet does not match the signed-in account.");
        }
        if (process.env.NODE_ENV === "production") {
          createStandardError(
            "PRECONDITION_FAILED",
            "Reward spins are temporarily offline while persistent records and the audited claim distributor are completed."
          );
        }
        if (input.burnForSecondSpin) {
          createStandardError(
            "PRECONDITION_FAILED",
            "Burn-for-spin is disabled until an on-chain burn receipt verifier is deployed."
          );
        }
        if (!checkSpinRateLimit(input.wallet)) {
          createStandardError("TOO_MANY_REQUESTS", "Too many spin attempts. Please wait a moment.");
        }
        const clientIp = ctx.req.headers["cf-connecting-ip"] || ctx.req.socket.remoteAddress || "unknown";
        const ipSpinKey = `ip_spin_${Array.isArray(clientIp) ? clientIp[0] : clientIp}`;
        if (!checkRateLimit(ipSpinKey, 20)) {
          createStandardError("TOO_MANY_REQUESTS", "IP rate limit exceeded");
        }

        const record = spinRecordsV2.get(key) || null;
        if (!canSpinTodayV2(record)) {
          createStandardError("TOO_MANY_REQUESTS", "Already spun today. Come back tomorrow.");
        }

        const nftTier = await getHeroCardsTier(input.wallet) || record?.nftTier || "bronze";
        routerLogger.info("Spin V2 execute", { wallet: key, tier: nftTier, streak: record?.currentStreak || 0 });

        let result;
        try {
          result = await performSpinV2(input.wallet, record, nftTier, input.chain || "pulsechain");
        } catch (error) {
          routerLogger.error("Spin V2 RNG failure", {
            wallet: key,
            error: error instanceof Error ? error.message : String(error),
          });
          createStandardError("INTERNAL_SERVER_ERROR", "Spin failed — please try again.");
        }

        // Development-only preview results must never advertise an on-chain claim.
        result.claimable = false;
        result.claimId = undefined;
        const updated = updateSpinRecordV2(record, input.wallet, result);
        spinRecordsV2.set(key, updated);
        updateLeaderboard(key, updated);
        return result;
      }),
    claim: protectedProcedure
      .input(z.object({
        wallet: ethAddressSchema,
        claimId: z.string().min(1),
        spinTimestamp: z.number(),
      }))
      .mutation(({ ctx, input }) => {
        const boundWallet = ctx.user.walletAddress?.toLowerCase();
        if (!boundWallet || boundWallet !== input.wallet.toLowerCase()) {
          createStandardError("FORBIDDEN", "The connected wallet does not match the signed-in account.");
        }
        createStandardError(
          "PRECONDITION_FAILED",
          "On-chain reward claims are disabled until the audited distributor signer is deployed."
        );
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
            nftTier: record?.nftTier || "bronze",
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
          ? (spinRecordsV2.get(input.wallet.toLowerCase())?.nftTier || "bronze")
          : "bronze";
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
