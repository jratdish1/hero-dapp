import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  castAdvisoryVoteAtomic,
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
  DAO_DELEGATION_DISABLED_REASON,
  advisoryProposalMetadata,
  assertProposalVoteable,
  proposalGovernanceMetadata,
  resolveAdvisoryVoteChain,
} from "./dao-governance-policy";
import { appRouter as legacyAppRouter } from "./routers-base";

export { getRpcMetrics } from "./routers-base";

const ethAddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid wallet address format");
const txHashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid transaction hash format").optional();

function fail(
  code: "BAD_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "TOO_MANY_REQUESTS" | "INTERNAL_SERVER_ERROR" | "PRECONDITION_FAILED",
  message: string,
): never {
  throw new TRPCError({ code, message });
}

// In tRPC v11 the router definition record stores nested router records
// directly. Preserve those exact static records and replace only the DAO
// members, avoiding any widening that would erase client procedure types.
const rootRecord = legacyAppRouter._def.record;
const legacyDaoRecord = rootRecord.dao;
const legacyProposalRecord = legacyDaoRecord.proposals;
const legacyVoteRecord = legacyDaoRecord.votes;
const legacyDelegateRecord = legacyDaoRecord.delegates;
const legacyDelegationRecord = legacyDaoRecord.delegations;

const disabledDelegationMutation = protectedProcedure.mutation(() => {
  fail("PRECONDITION_FAILED", DAO_DELEGATION_DISABLED_REASON);
});

const daoRouter = router({
  ...legacyDaoRecord,

  stats: publicProcedure.query(async () => {
    const [allProposals, historicalDelegates, treasury] = await Promise.all([
      getProposals(undefined, 1000),
      getDelegates(1000),
      getLatestTreasurySnapshots(),
    ]);
    return {
      totalProposals: allProposals.length,
      activeProposals: allProposals.filter(proposal => proposal.status === "active").length,
      passedProposals: allProposals.filter(proposal => proposal.status === "passed").length,
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
        confirmBinding: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const normalized = input.walletAddress.toLowerCase();
        const existing = ctx.user.walletAddress?.toLowerCase();
        if (existing && existing !== normalized) {
          fail("FORBIDDEN", "Account is already bound to a different wallet");
        }
        if (existing === normalized) {
          return { success: true, requiresConfirmation: false, walletAddress: normalized } as const;
        }
        if (!input.confirmBinding) {
          return {
            success: false,
            requiresConfirmation: true,
            walletAddress: normalized,
            message: "Confirm permanent account binding before casting an advisory vote.",
          } as const;
        }
        await updateUserWalletAddress(ctx.user.id, normalized);
        return { success: true, requiresConfirmation: false, walletAddress: normalized } as const;
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
            txHash: input.txHash || null,
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
