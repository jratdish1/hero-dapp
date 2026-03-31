import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";

// ─── Reusable Validation Schemas ────────────────────────────────────────
// Ethereum/PulseChain hex address: exactly 42 chars, 0x prefix + 40 hex chars
const ethAddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid wallet address format");
// Transaction hash: 0x prefix + 64 hex chars
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
} from "./db";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";
import { getMarketOverview, fetchTokenPrices, fetchBaseTokenPrices, fetchPlsPrice, fetchEthPrice, searchPairs, fetchFarmPoolData, fetchBuyAndBurnData } from "./priceFeed";

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
    history: protectedProcedure
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
    ticker: publicProcedure.query(async () => {
      const [tokenData, plsPrice, ethPrice] = await Promise.all([
        fetchTokenPrices(),
        fetchPlsPrice(),
        fetchEthPrice(),
      ]);
      const heroPair = tokenData.heroPairs[0];
      const vetsPair = tokenData.vetsPairs[0];
      return {
        hero: heroPair ? { price: heroPair.priceUsd || "0", change24h: heroPair.priceChange?.h24 || 0 } : null,
        vets: vetsPair ? { price: vetsPair.priceUsd || "0", change24h: vetsPair.priceChange?.h24 || 0 } : null,
        pls: plsPrice ? { price: plsPrice.priceUsd, change24h: plsPrice.priceChange24h } : null,
        eth: ethPrice ? { price: ethPrice.priceUsd, change24h: ethPrice.priceChange24h } : null,
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
          title: z.string().min(1).max(512),
          description: z.string().min(1).max(10000),
          walletAddress: ethAddressSchema,
          chain: z.enum(["base", "pulsechain", "both"]).optional(),
          category: z.enum(["protocol", "treasury", "community", "emergency"]).optional(),
          durationDays: z.number().int().min(1).max(30).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const proposalId = "HERO-" + Date.now().toString(36).toUpperCase();
          const now = new Date();
          const durationMs = (input.durationDays || 7) * 24 * 60 * 60 * 1000;
          const endTime = new Date(now.getTime() + durationMs);
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
          return { success: true, proposalId };
        }),
      updateStatus: protectedProcedure
        .input(z.object({
          proposalId: z.string().min(1),
          status: z.enum(["pending", "active", "passed", "defeated", "queued", "executed", "cancelled"]),
        }))
        .mutation(async ({ input }) => {
          const proposal = await getProposalById(input.proposalId);
          if (!proposal) throw new Error("Proposal not found");
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
          const existing = await getUserVote(input.proposalDbId, ctx.user.id);
          if (existing) throw new Error("Already voted on this proposal");
          await castVote({
            proposalId: input.proposalDbId,
            voterId: ctx.user.id,
            voterAddress: input.voterAddress,
            choice: input.choice,
            votingPower: input.votingPower,
            chain: input.chain,
            txHash: input.txHash || null,
          });
          // Update proposal vote tallies
          const proposal = await getProposalById(input.proposalId);
          if (proposal) {
            const newFor = input.choice === "for" ? proposal.votesFor + input.votingPower : proposal.votesFor;
            const newAgainst = input.choice === "against" ? proposal.votesAgainst + input.votingPower : proposal.votesAgainst;
            const newAbstain = input.choice === "abstain" ? proposal.votesAbstain + input.votingPower : proposal.votesAbstain;
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
          if (existing) throw new Error("Already registered as delegate");
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
          if (!delegate) throw new Error("Delegate not found");
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
        }))
        .mutation(async ({ ctx, input }) => {
          const delegate = await getDelegateByAddress(input.delegateAddress);
          if (!delegate) throw new Error("Delegate not found");
          await createDelegation({
            delegatorId: ctx.user.id,
            delegatorAddress: input.delegatorAddress,
            delegateId: delegate.id,
            delegateAddress: input.delegateAddress,
            amount: input.amount,
            chain: input.chain,
            txHash: input.txHash || null,
          });
          // Update delegate's voting power and delegator count
          await updateDelegate(delegate.id, {
            votingPower: delegate.votingPower + input.amount,
            delegatorCount: delegate.delegatorCount + 1,
          });
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
});

export type AppRouter = typeof appRouter;
