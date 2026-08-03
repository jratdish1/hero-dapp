import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  castAdvisoryVoteAtomic,
  createProposal,
  getDaoProposalStats,
  getDelegateByAddress,
  getDelegates,
  getLatestTreasurySnapshots,
  getProposalById,
  getProposals,
  getUserVote,
  getVotesByProposal,
  updateProposal,
  updateUserWalletAddress,
} from "./db";
import {
  DAO_ADVISORY_QUORUM,
  DAO_BINDING_DISABLED_REASON,
  DAO_DELEGATION_DISABLED_REASON,
  DAO_SNAPSHOT_VERSION,
  advisoryProposalMetadata,
  assertNoAdvisoryTransactionHash,
  assertProposalVoteable,
  proposalGovernanceMetadata,
  resolveAdvisoryVoteChain,
} from "./dao-governance-policy";
import { atomicRateLimitAndRecord } from "./dao-rate-limiter";
import { generateProposalHash } from "./dao-security-hardening";
import {
  issueWalletBindingChallenge,
  verifyWalletBindingProof,
  walletBindingMessage,
} from "./dao-wallet-binding";
import { appRouter as legacyAppRouter } from "./routers-base";

export { getRpcMetrics } from "./routers-base";

const ethAddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid wallet address format");
const txHashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid transaction hash format").optional();
const bindingChallengeSchema = z.string().min(64).max(2_048).optional();
const walletSignatureSchema = z.string()
  .regex(/^0x(?:[0-9a-fA-F]{128}|[0-9a-fA-F]{130})$/, "Invalid wallet signature format")
  .optional();
const safeStringSchema = (maxLength: number) => z.string().min(1).max(maxLength).refine(
  value => !/<script/i.test(value) && !/javascript:/i.test(value) && !/on\w+=/i.test(value),
  { message: "Input contains disallowed content" },
);

function fail(
  code: "BAD_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "TOO_MANY_REQUESTS" | "INTERNAL_SERVER_ERROR" | "PRECONDITION_FAILED",
  message: string,
): never {
  throw new TRPCError({ code, message });
}

const rootRecord = legacyAppRouter._def.record;
const legacyDaoRecord = rootRecord.dao;
const legacyProposalRecord = legacyDaoRecord.proposals;
const legacyVoteRecord = legacyDaoRecord.votes;
const legacyDelegateRecord = legacyDaoRecord.delegates;
const legacyDelegationRecord = legacyDaoRecord.delegations;

const disabledDelegationMutation = protectedProcedure.mutation(() => {
  fail("PRECONDITION_FAILED", DAO_DELEGATION_DISABLED_REASON);
});

async function requireWalletBindingProof(
  challenge: string,
  walletSignature: string,
  userId: number,
  walletAddress: string,
): Promise<void> {
  try {
    await verifyWalletBindingProof(challenge, walletSignature, userId, walletAddress);
  } catch (error) {
    fail(
      "PRECONDITION_FAILED",
      error instanceof Error ? error.message : "Wallet binding proof is invalid",
    );
  }
}

function newBindingChallenge(userId: number, walletAddress: string) {
  const bindingChallenge = issueWalletBindingChallenge(userId, walletAddress);
  return {
    bindingChallenge,
    bindingMessage: walletBindingMessage(bindingChallenge, userId, walletAddress),
  };
}

const daoRouter = router({
  ...legacyDaoRecord,

  stats: publicProcedure.query(async () => {
    const [proposalStats, historicalDelegates, treasury] = await Promise.all([
      getDaoProposalStats(),
      getDelegates(1000),
      getLatestTreasurySnapshots(),
    ]);
    return {
      ...proposalStats,
      totalDelegates: historicalDelegates.length,
      totalVotingPower: 0,
      treasuryValueUsd: treasury.reduce((sum, item) => sum + parseFloat(item.valueUsd || "0"), 0),
      governanceMode: "advisory" as const,
      delegationEnabled: false,
      delegationDisabledReason: DAO_DELEGATION_DISABLED_REASON,
    };
  }),

  wallet: router({
    bindForVoting: protectedProcedure
      .input(z.object({
        walletAddress: ethAddressSchema,
        bindingChallenge: bindingChallengeSchema,
        walletSignature: walletSignatureSchema,
      }))
      .mutation(async ({ ctx, input }) => {
        const normalized = input.walletAddress.toLowerCase();
        const existing = ctx.user.walletAddress?.toLowerCase();
        if (existing && existing !== normalized) {
          fail("FORBIDDEN", "Account is already bound to a different wallet");
        }
        if (existing === normalized) {
          return {
            success: true,
            requiresConfirmation: false,
            walletAddress: normalized,
            bindingChallenge: undefined,
            bindingMessage: undefined,
          } as const;
        }
        if (!input.bindingChallenge && !input.walletSignature) {
          return {
            success: false,
            requiresConfirmation: true,
            walletAddress: normalized,
            ...newBindingChallenge(ctx.user.id, normalized),
            message: "Sign the wallet-binding message before permanently binding this address.",
          } as const;
        }
        if (!input.bindingChallenge || !input.walletSignature) {
          fail("PRECONDITION_FAILED", "Wallet binding requires both the server challenge and wallet signature");
        }
        await requireWalletBindingProof(
          input.bindingChallenge,
          input.walletSignature,
          ctx.user.id,
          normalized,
        );
        try {
          await updateUserWalletAddress(ctx.user.id, normalized);
        } catch (error) {
          fail("PRECONDITION_FAILED", error instanceof Error ? error.message : "Wallet binding failed");
        }
        return {
          success: true,
          requiresConfirmation: false,
          walletAddress: normalized,
          bindingChallenge: undefined,
          bindingMessage: undefined,
        } as const;
      }),
  }),

  proposals: router({
    ...legacyProposalRecord,
    list: publicProcedure
      .input(z.object({ status: z.string().optional(), limit: z.number().int().positive().max(100).optional() }).optional())
      .query(async ({ input }) => {
        const rows = await getProposals(input?.status, input?.limit ?? 50);
        return rows.map(proposal => ({ ...proposal, ...proposalGovernanceMetadata(proposal) }));
      }),
    get: publicProcedure
      .input(z.object({ proposalId: z.string().min(1) }))
      .query(async ({ input }) => {
        const proposal = await getProposalById(input.proposalId);
        return proposal ? { ...proposal, ...proposalGovernanceMetadata(proposal) } : undefined;
      }),
    create: protectedProcedure
      .input(z.object({
        title: safeStringSchema(512),
        description: safeStringSchema(10_000),
        walletAddress: ethAddressSchema,
        chain: z.enum(["base", "pulsechain", "both"]).optional(),
        category: z.enum(["protocol", "treasury", "community", "emergency"]).optional(),
        durationDays: z.number().int().min(1).max(30).optional(),
        governanceMode: z.enum(["advisory", "binding"]).optional(),
        bindingChallenge: bindingChallengeSchema,
        walletSignature: walletSignatureSchema,
      }))
      .mutation(async ({ ctx, input }) => {
        if ((input.governanceMode ?? "advisory") !== "advisory") {
          fail("PRECONDITION_FAILED", DAO_BINDING_DISABLED_REASON);
        }
        const normalizedWallet = input.walletAddress.toLowerCase();
        const existingWallet = ctx.user.walletAddress?.toLowerCase();
        if (existingWallet && existingWallet !== normalizedWallet) {
          fail("FORBIDDEN", "Wallet address does not match the authenticated account wallet");
        }
        if (!existingWallet && !input.bindingChallenge && !input.walletSignature) {
          return {
            success: false,
            requiresConfirmation: true,
            message: "Sign the wallet-binding message before creating this advisory proposal.",
            walletAddress: normalizedWallet,
            ...newBindingChallenge(ctx.user.id, normalizedWallet),
            proposalId: undefined,
            contentHash: undefined,
            anchorTxHash: undefined,
            ...advisoryProposalMetadata(),
          } as const;
        }
        if (!existingWallet) {
          if (!input.bindingChallenge || !input.walletSignature) {
            fail("PRECONDITION_FAILED", "Wallet binding requires both the server challenge and wallet signature");
          }
          await requireWalletBindingProof(
            input.bindingChallenge,
            input.walletSignature,
            ctx.user.id,
            normalizedWallet,
          );
          try {
            await updateUserWalletAddress(ctx.user.id, normalizedWallet);
          } catch (error) {
            fail("PRECONDITION_FAILED", error instanceof Error ? error.message : "Wallet binding failed");
          }
        }

        const proposalId = `HERO-A1-${Date.now().toString(36).toUpperCase()}`;
        const rateCheck = await atomicRateLimitAndRecord(ctx.user.id, proposalId, normalizedWallet, 3);
        if (!rateCheck.allowed) {
          fail("TOO_MANY_REQUESTS", "Rate limited: maximum 3 proposals per 24 hours");
        }
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + (input.durationDays ?? 7) * 86_400_000);
        const chain = input.chain ?? "both";
        const contentHash = generateProposalHash(
          proposalId,
          input.title,
          input.description,
          normalizedWallet,
          chain,
          startTime,
          endTime,
        );

        await createProposal({
          proposalId,
          title: input.title,
          description: input.description,
          proposerId: ctx.user.id,
          proposerAddress: normalizedWallet,
          status: "active",
          chain,
          category: input.category ?? "protocol",
          governanceMode: "advisory",
          snapshotVersion: DAO_SNAPSHOT_VERSION,
          bindingDisabledReason: DAO_BINDING_DISABLED_REASON,
          quorum: DAO_ADVISORY_QUORUM,
          startTime,
          endTime,
        });

        return {
          success: true,
          requiresConfirmation: false,
          walletAddress: normalizedWallet,
          bindingChallenge: undefined,
          bindingMessage: undefined,
          proposalId,
          contentHash,
          anchorTxHash: null,
          ...advisoryProposalMetadata(),
        } as const;
      }),
    updateStatus: protectedProcedure
      .input(z.object({
        proposalId: z.string().min(1),
        status: z.enum(["pending", "active", "passed", "defeated", "queued", "executed", "cancelled"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const proposal = await getProposalById(input.proposalId);
        if (!proposal) fail("NOT_FOUND", "Proposal not found");
        if (proposal.proposerId !== ctx.user.id) {
          fail("FORBIDDEN", "Only the proposal creator may update its status");
        }
        try {
          await updateProposal(proposal.id, { status: input.status });
        } catch (error) {
          fail(
            "PRECONDITION_FAILED",
            error instanceof Error ? error.message : "Invalid advisory status transition",
          );
        }
        const updated = await getProposalById(input.proposalId);
        return {
          success: true,
          status: updated?.status,
          ...(updated ? proposalGovernanceMetadata(updated) : advisoryProposalMetadata()),
        };
      }),
  }),

  votes: router({
    ...legacyVoteRecord,
    list: publicProcedure
      .input(z.object({ proposalDbId: z.number().int().positive() }))
      .query(({ input }) => getVotesByProposal(input.proposalDbId)),
    myVote: protectedProcedure
      .input(z.object({ proposalDbId: z.number().int().positive() }))
      .query(({ ctx, input }) => getUserVote(input.proposalDbId, ctx.user.id)),
    cast: protectedProcedure
      .input(z.object({
        proposalDbId: z.number().int().positive(),
        proposalId: z.string().min(1),
        voterAddress: ethAddressSchema,
        choice: z.enum(["for", "against", "abstain"]),
        votingPower: z.number().int().positive().max(1_000_000_000).optional(),
        chain: z.enum(["base", "pulsechain"]),
        txHash: txHashSchema,
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.walletAddress) {
          fail("PRECONDITION_FAILED", "Bind the connected wallet explicitly before voting");
        }
        const normalizedWallet = ctx.user.walletAddress.toLowerCase();
        if (input.voterAddress.toLowerCase() !== normalizedWallet) {
          fail("FORBIDDEN", "Voter address does not match the authenticated account wallet");
        }
        const proposal = await getProposalById(input.proposalId);
        if (!proposal || proposal.id !== input.proposalDbId) {
          fail("NOT_FOUND", "Proposal identity mismatch");
        }
        try {
          assertProposalVoteable(proposal);
        } catch (error) {
          fail("PRECONDITION_FAILED", error instanceof Error ? error.message : "Proposal is not voteable");
        }
        try {
          assertNoAdvisoryTransactionHash(input.txHash);
        } catch (error) {
          fail("BAD_REQUEST", error instanceof Error ? error.message : "Advisory transaction metadata is not allowed");
        }
        let voteChain: "base" | "pulsechain";
        try {
          voteChain = resolveAdvisoryVoteChain(proposal.chain, input.chain);
        } catch (error) {
          fail("BAD_REQUEST", error instanceof Error ? error.message : "Vote chain mismatch");
        }
        try {
          await castAdvisoryVoteAtomic({
            proposalId: input.proposalDbId,
            voterId: ctx.user.id,
            voterAddress: normalizedWallet,
            choice: input.choice,
            votingPower: 1,
            chain: voteChain,
            txHash: null,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Vote rejected";
          fail(/already voted/i.test(message) ? "BAD_REQUEST" : "PRECONDITION_FAILED", message);
        }
        return { success: true, ...proposalGovernanceMetadata(proposal) };
      }),
  }),

  delegates: router({
    ...legacyDelegateRecord,
    byAddress: publicProcedure
      .input(z.object({ address: ethAddressSchema }))
      .query(({ input }) => getDelegateByAddress(input.address)),
    register: disabledDelegationMutation,
    update: disabledDelegationMutation,
  }),

  delegations: router({
    ...legacyDelegationRecord,
    create: disabledDelegationMutation,
    revoke: disabledDelegationMutation,
  }),
});

export const appRouter = router({
  ...rootRecord,
  dao: daoRouter,
});

export type AppRouter = typeof appRouter;
