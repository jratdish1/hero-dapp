import { createDaoLogger } from "./dao-logger";
const routerLogger = createDaoLogger("dao-router");
/**
 * HERO DAO — Production Router (Final)
 * ======================================
 * Drop-in replacement for the DAO section of routers.ts
 * 
 * ALL 5 PRODUCTION CONDITIONS IMPLEMENTED:
 * ✅ #1 Persistent rate limiting (MySQL-backed via proposal_audit_log)
 * ✅ #2 Executor security (env-based config, multisig-ready)
 * ✅ #3 Output sanitization (server-side strip, frontend DOMPurify)
 * ✅ #4 On-chain anchoring (HeroDAOAnchor.anchorProposal() wired up)
 * ✅ #5 proposalId VARCHAR(40) (schema migration provided)
 * 
 * SECURITY FEATURES:
 * - Atomic double-vote prevention (DB unique constraint)
 * - Proposal hash commitment (SHA-256 with domain separation)
 * - 48-hour timelock on execution
 * - Delegation cooldown (24h effectiveAfter)
 * - Multi-chain voting power aggregation
 * - Enhanced XSS/injection input validation (14 patterns)
 * - Server-side on-chain balance verification
 * - Valid status transition enforcement
 * - Wallet ownership verification
 * - Comprehensive audit logging
 */

import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { createPublicClient, http, erc20Abi } from "viem";
import { pulsechain } from "viem/chains";
import {
  generateProposalHash,
  generateSecureProposalId,
  createTimelock,
  isTimelockExpired,
  getTimelockRemaining,
  calculateEffectiveVotingPower,
  generateVoteReceipt,
  isProposalVoteable,
  calculateQuorum,
  isQuorumMet,
  isValidStatusTransition,
  getValidTransitions,
  verifyWalletOwnership,
  resolveVerificationChains,
  MIN_PROPOSAL_BALANCE,
  TIMELOCK_DURATION_MS,
} from "./dao-security-hardening";
import {
  isProposalRateLimited,
  recordProposalCreation,
  logDaoAction,
  getTimelockForProposal,
  saveTimelock,
  markTimelockExecuted,
} from "./dao-rate-limiter";
import {
  anchorProposalOnChain,
  finalizeProposalOnChain,
  isAnchoringEnabled,
  getAnchorStatus,
} from "./dao-anchor-integration";
import { fetchSnapshotProposals, fetchSnapshotProposalById } from "./snapshot-integration";
import {
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
} from "./db";
import { sql } from "drizzle-orm";

/**
 * AUDIT FIX (HIGH #3): Atomic increment for delegate stats.
 * Uses SQL arithmetic to prevent race conditions from concurrent delegations.
 * This avoids the read-modify-write pattern that loses updates.
 */
async function atomicIncrementDelegateStats(delegateId: number, amount: number): Promise<void> {
  const { getDb } = await import("./db");
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.execute(
    sql`UPDATE delegates 
        SET votingPower = votingPower + ${amount}, 
            delegatorCount = delegatorCount + 1 
        WHERE id = ${delegateId}`
  );
}

// ─── On-Chain Verification Clients ──────────────────────────────────────
const pulsechainClient = createPublicClient({
  chain: pulsechain,
  transport: http("https://rpc.pulsechain.com"),
});

const baseClient = createPublicClient({
  chain: {
    id: 8453,
    name: "Base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: ["https://mainnet.base.org"] } },
  } as any,
  transport: http("https://mainnet.base.org"),
});

const HERO_TOKENS: Record<string, `0x${string}`> = {
  pulsechain: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
  base: "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8",
};

async function verifyVotingPower(voterAddress: string, chain: "pulsechain" | "base"): Promise<number> {
  const client = chain === "pulsechain" ? pulsechainClient : baseClient;
  const tokenAddress = HERO_TOKENS[chain];
  try {
    const balance = await client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [voterAddress as `0x${string}`],
    });
    return Math.floor(Number(balance) / 1e18);
  } catch {
    return 0;
  }
}

/**
 * Aggregate voting power across multiple chains.
 * For "both" proposals, sums balances from PulseChain and Base.
 */
async function verifyAggregatedVotingPower(
  voterAddress: string,
  proposalChain: string
): Promise<number> {
  const chains = resolveVerificationChains(proposalChain);
  const balances = await Promise.all(
    chains.map(c => verifyVotingPower(voterAddress, c))
  );
  return balances.reduce((sum, b) => sum + b, 0);
}

// ─── Validation Schemas ─────────────────────────────────────────────────
const ethAddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid wallet address format");
const txHashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid transaction hash format").optional();
const tokenSymbolSchema = z.string().max(20).regex(/^[a-zA-Z0-9$_.\-]+$/, "Invalid token symbol");

/**
 * Enhanced input sanitization — blocks 14 dangerous patterns.
 * Defense-in-depth: even though React escapes JSX, we validate on input.
 */
const DANGEROUS_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /data:\s*text\/html/i,
  /vbscript:/i,
  /expression\s*\(/i,
  /url\s*\(/i,
  /<iframe/i,
  /<object/i,
  /<embed/i,
  /<form/i,
  /&#x?[0-9a-f]+;/i,
  /%3Cscript/i,
  /\\u003c/i,
];

const safeStringSchema = (maxLen: number) => z.string().max(maxLen).refine(
  (s) => !DANGEROUS_PATTERNS.some(pattern => pattern.test(s)),
  { message: "Input contains disallowed content (potential XSS or injection)" }
);

// ═══════════════════════════════════════════════════════════════════════
// PRODUCTION DAO ROUTER
// ═══════════════════════════════════════════════════════════════════════

export const daoRouter = router({
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
      anchoringEnabled: isAnchoringEnabled(),
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
      }))
      .mutation(async ({ ctx, input }) => {
        // ─── CONDITION #1: Persistent rate limiting ───────────────
        const rateLimited = await isProposalRateLimited(ctx.user.id);
        if (rateLimited) {
          throw new Error("Rate limited: maximum 3 proposals per 24 hours");
        }

        // ─── Minimum balance check (multi-chain aggregated) ──────
        const balance = await verifyAggregatedVotingPower(
          input.walletAddress,
          input.chain || "both"
        );
        if (balance < MIN_PROPOSAL_BALANCE) {
          throw new Error(
            `Insufficient HERO balance to create proposal. Required: ${MIN_PROPOSAL_BALANCE.toLocaleString()}, Found: ${balance.toLocaleString()}`
          );
        }

        // ─── Generate secure proposal ID (collision-resistant) ───
        const proposalId = generateSecureProposalId();

        const now = new Date();
        const durationMs = (input.durationDays || 7) * 24 * 60 * 60 * 1000;
        const endTime = new Date(now.getTime() + durationMs);
        const category = input.category || "protocol";
        const chain = input.chain || "both";

        // Dynamic quorum (2x for emergency)
        const quorum = calculateQuorum(5_000_000, category);

        // ─── Generate proposal hash commitment ───────────────────
        const contentHash = generateProposalHash(
          proposalId,
          input.title,
          input.description,
          input.walletAddress,
          chain,
          now,
          endTime
        );

        // ─── Create in database ──────────────────────────────────
        await createProposal({
          proposalId,
          title: input.title,
          description: input.description,
          proposerId: ctx.user.id,
          proposerAddress: input.walletAddress,
          chain: chain as any,
          category: category as any,
          quorum,
          startTime: now,
          endTime,
        });

        // ─── CONDITION #1: Record for persistent rate limiting ───
        await recordProposalCreation(proposalId, ctx.user.id, input.walletAddress);

        // ─── Store content hash in DB (audit trail) ──────────────
        try {
          const createdProposal = await getProposalById(proposalId);
          if (createdProposal) {
            await updateProposal(createdProposal.id, {
              contentHash,
            } as any);
          }
        } catch (err) {
          routerLogger.warn(" Content hash storage failed (non-blocking):", err);
        }

        // ─── CONDITION #4: Anchor on-chain (non-blocking) ────────
        let anchorTxHash: string | null = null;
        try {
          anchorTxHash = await anchorProposalOnChain(proposalId, contentHash, endTime);
          if (anchorTxHash) {
            const anchoredProposal = await getProposalById(proposalId);
            if (anchoredProposal) {
              await updateProposal(anchoredProposal.id, {
                anchoredOnChain: true,
                anchorTxHash,
              } as any);
            }
          }
        } catch (err) {
          // Non-blocking: log but don't fail proposal creation
          routerLogger.warn(" On-chain anchoring failed (non-blocking):", err);
        }

        return { success: true, proposalId, contentHash, anchorTxHash };
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        proposalId: z.string().min(1),
        status: z.enum(["pending", "active", "passed", "defeated", "queued", "executed", "cancelled"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const proposal = await getProposalById(input.proposalId);
        if (!proposal) throw new Error("Proposal not found");

        // ─── Enforce valid status transitions ────────────────────
        if (!isValidStatusTransition(proposal.status, input.status)) {
          throw new Error(
            `Invalid status transition: "${proposal.status}" → "${input.status}". ` +
            `Allowed: ${getValidTransitions(proposal.status).join(", ") || "none (terminal state)"}`
          );
        }

        // ─── If transitioning to "queued", create timelock ───────
        if (input.status === "queued") {
          const timelockState = createTimelock(input.proposalId);
          await saveTimelock(
            input.proposalId,
            new Date(timelockState.finalizedAt),
            new Date(timelockState.executionUnlocksAt)
          );

          // ─── CONDITION #4: Finalize on-chain ───────────────────
          try {
            await finalizeProposalOnChain(
              input.proposalId,
              proposal.votesFor,
              proposal.votesAgainst,
              proposal.votesAbstain
            );
          } catch (err) {
            routerLogger.warn(" On-chain finalization failed (non-blocking):", err);
          }
        }

        // ─── If transitioning to "executed", enforce timelock ────
        if (input.status === "executed") {
          const timelock = await getTimelockForProposal(input.proposalId);
          if (!timelock) {
            throw new Error("Cannot execute: proposal must be queued with a timelock first");
          }
          if (!isTimelockExpired(timelock)) {
            throw new Error(`Cannot execute: timelock has not expired. ${getTimelockRemaining(timelock)}`);
          }
          await markTimelockExecuted(input.proposalId);
        }

        await updateProposal(proposal.id, { status: input.status as any });

        // ─── Audit log ───────────────────────────────────────────
        await logDaoAction(input.proposalId, 'status_change', ctx.user.id, {
          previousStatus: proposal.status,
          newStatus: input.status,
        });

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
        // ─── Verify wallet ownership ─────────────────────────────
        const walletCheck = verifyWalletOwnership(input.voterAddress, ctx.user.walletAddress);
        if (!walletCheck.valid) {
          throw new Error(`Wallet verification failed: ${walletCheck.reason}`);
        }

        // ─── Verify proposal is voteable ─────────────────────────
        const proposal = await getProposalById(input.proposalId);
        if (!proposal) throw new Error("Proposal not found");

        const voteableCheck = isProposalVoteable(proposal);
        if (!voteableCheck.voteable) {
          throw new Error(`Cannot vote: ${voteableCheck.reason}`);
        }

        // ─── Application-level double-vote check ─────────────────
        const existing = await getUserVote(input.proposalDbId, ctx.user.id);
        if (existing) throw new Error("Already voted on this proposal");

        // ─── Server-side on-chain balance verification ───────────
        // AUDIT FIX (MEDIUM #2): For "both" chain proposals, verify aggregated power
        const verifiedPower = proposal.chain === "both"
          ? await verifyAggregatedVotingPower(input.voterAddress, "both")
          : await verifyVotingPower(input.voterAddress, input.chain);
        if (verifiedPower <= 0) throw new Error("No HERO tokens found — cannot vote");

        // Use LOWER of client-claimed and on-chain verified (prevents inflation)
        const trustedPower = Math.min(input.votingPower, verifiedPower);

        // ─── Generate vote receipt (with nonce for audit trail) ──
        const receiptHash = generateVoteReceipt(
          input.proposalId,
          input.voterAddress,
          input.choice,
          trustedPower,
          input.chain,
          Date.now(),
          input.txHash
        );

        // ─── Cast vote (DB unique constraint = atomic protection) ─
        try {
          await castVote({
            proposalId: input.proposalDbId,
            voterId: ctx.user.id,
            voterAddress: input.voterAddress,
            choice: input.choice,
            votingPower: trustedPower,
            chain: input.chain,
            txHash: input.txHash || null,
          });
        } catch (err: any) {
          // Catch DB unique constraint violation (race condition protection)
          if (err.code === 'ER_DUP_ENTRY' || err.message?.includes('Duplicate entry')) {
            throw new Error("Already voted on this proposal (concurrent request detected)");
          }
          throw err;
        }

        // ─── Update proposal vote tallies ────────────────────────
        const newFor = input.choice === "for" ? proposal.votesFor + trustedPower : proposal.votesFor;
        const newAgainst = input.choice === "against" ? proposal.votesAgainst + trustedPower : proposal.votesAgainst;
        const newAbstain = input.choice === "abstain" ? proposal.votesAbstain + trustedPower : proposal.votesAbstain;
        await updateProposalVotes(input.proposalId, newFor, newAgainst, newAbstain);

        // ─── Log quorum reached if applicable ────────────────────
        if (isQuorumMet(newFor, newAgainst, newAbstain, proposal.quorum)) {
          await logDaoAction(input.proposalId, 'quorum_reached', ctx.user.id, {
            votesFor: newFor,
            votesAgainst: newAgainst,
            quorum: proposal.quorum,
          });
        }

        return { success: true, receiptHash };
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
        // Minimum balance to become delegate: 10k HERO
        const balance = await verifyAggregatedVotingPower(input.address, "both");
        if (balance < 10_000) {
          throw new Error("Must hold at least 10,000 HERO tokens to register as delegate");
        }

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
        // Cannot delegate to yourself
        if (input.delegatorAddress.toLowerCase() === input.delegateAddress.toLowerCase()) {
          throw new Error("Cannot delegate to yourself");
        }

        const delegate = await getDelegateByAddress(input.delegateAddress);
        if (!delegate) throw new Error("Delegate not found");

        // Verify delegator holds the tokens
        const balance = await verifyVotingPower(input.delegatorAddress, input.chain);
        if (balance < input.amount) {
          throw new Error(`Insufficient balance. Claimed: ${input.amount}, Actual: ${balance}`);
        }

        await createDelegation({
          delegatorId: ctx.user.id,
          delegatorAddress: input.delegatorAddress,
          delegateId: delegate.id,
          delegateAddress: input.delegateAddress,
          amount: input.amount,
          chain: input.chain,
          txHash: input.txHash || null,
        });

        // AUDIT FIX: Use atomic SQL increment to prevent race conditions
        // Instead of read-modify-write, we use SQL arithmetic directly
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

  // ─── NEW: Timelock status endpoint ─────────────────────────────────
  timelock: router({
    status: publicProcedure
      .input(z.object({ proposalId: z.string().min(1) }))
      .query(async ({ input }) => {
        const timelock = await getTimelockForProposal(input.proposalId);
        if (!timelock) return { hasTimelock: false };
        return {
          hasTimelock: true,
          finalizedAt: timelock.finalizedAt,
          executionUnlocksAt: timelock.executionUnlocksAt,
          isExpired: isTimelockExpired(timelock),
          remaining: getTimelockRemaining(timelock),
          executed: timelock.executed,
        };
      }),
  }),

  // ─── NEW: Anchor status endpoint ───────────────────────────────────
  anchor: router({
    status: publicProcedure.query(() => {
      return getAnchorStatus();
    }),
  }),

  // ─── NEW: Snapshot governance integration ─────────────────────────────
  snapshot: router({
    proposals: publicProcedure
      .input(z.object({ limit: z.number().int().positive().max(50).optional() }).optional())
      .query(async ({ input }) => {
        return fetchSnapshotProposals(input?.limit ?? 20);
      }),
    proposal: publicProcedure
      .input(z.object({ id: z.string().min(1) }))
      .query(async ({ input }) => {
        return fetchSnapshotProposalById(input.id);
      }),
    spaceInfo: publicProcedure.query(async () => {
      return {
        spaceId: "hero-dao.eth",
        url: "https://snapshot.org/#/hero-dao.eth",
        network: "1",
        strategies: ["erc20-balance-of"],
      };
    }),
  }),
});
