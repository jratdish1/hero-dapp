#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one replacement target, found {count}')
    target.write_text(text.replace(old, new), encoding='utf-8')


replace_once(
    'server/db.ts',
    """export async function castVote(vote: InsertVote) {
  const db = await getDb();
  if (!db) throw new Error(\"Database not available\");
  return db.insert(votes).values(vote);
}
""",
    """export async function castVote(vote: InsertVote) {
  const db = await getDb();
  if (!db) throw new Error(\"Database not available\");
  return db.insert(votes).values(vote);
}

export async function castAdvisoryVoteAtomic(
  vote: InsertVote,
  now = new Date(),
) {
  const db = await getDb();
  if (!db) throw new Error(\"Database not available\");

  return db.transaction(async tx => {
    // Serialize every vote for this proposal so duplicate-address checks and
    // lifecycle validation cannot race with another vote or status mutation.
    await tx.execute(
      sql`SELECT id FROM proposals WHERE id = ${vote.proposalId} FOR UPDATE`,
    );
    const proposalRows = await tx.select().from(proposals)
      .where(eq(proposals.id, vote.proposalId))
      .limit(1);
    const proposal = proposalRows[0];
    if (!proposal) throw new Error(\"Proposal not found\");
    if (proposal.status !== \"active\") throw new Error(\"Proposal is not active\");
    if (now < proposal.startTime) throw new Error(\"Proposal voting has not started\");
    if (now >= proposal.endTime) throw new Error(\"Proposal voting has ended\");

    const duplicate = await tx.select({ id: votes.id }).from(votes)
      .where(and(
        eq(votes.proposalId, vote.proposalId),
        eq(votes.voterAddress, vote.voterAddress),
      ))
      .limit(1);
    if (duplicate.length > 0) throw new Error(\"Wallet already voted on this proposal\");

    await tx.insert(votes).values(vote);
    const increment = vote.votingPower;
    const tallies = vote.choice === \"for\"
      ? { votesFor: sql`${proposals.votesFor} + ${increment}` }
      : vote.choice === \"against\"
        ? { votesAgainst: sql`${proposals.votesAgainst} + ${increment}` }
        : { votesAbstain: sql`${proposals.votesAbstain} + ${increment}` };
    await tx.update(proposals).set(tallies).where(eq(proposals.id, vote.proposalId));
  });
}
""",
)

replace_once(
    'server/routers.ts',
    """  updateProposalVotes,
  castVote,
  getVotesByProposal,""",
    """  castAdvisoryVoteAtomic,
  getVotesByProposal,""",
)

replace_once(
    'server/routers.ts',
    """import { fetchSnapshotProposalById, fetchSnapshotProposals } from \"./snapshot-integration\";
""",
    """import { fetchSnapshotProposalById, fetchSnapshotProposals } from \"./snapshot-integration\";
import {
  advisoryProposalMetadata,
  assertAdvisoryMode,
  assertProposalVoteable,
  resolveAdvisoryVoteChain,
} from \"./dao-governance-policy\";
""",
)

replace_once(
    'server/routers.ts',
    """          return getProposals(input?.status, input?.limit ?? 50);
""",
    """          const rows = await getProposals(input?.status, input?.limit ?? 50);
          return rows.map(proposal => ({ ...proposal, ...advisoryProposalMetadata() }));
""",
)

replace_once(
    'server/routers.ts',
    """          return getProposalById(input.proposalId);
""",
    """          const proposal = await getProposalById(input.proposalId);
          return proposal ? { ...proposal, ...advisoryProposalMetadata() } : undefined;
""",
)

replace_once(
    'server/routers.ts',
    """          durationDays: z.number().int().min(1).max(30).optional(),
          confirmBinding: z.boolean().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
""",
    """          durationDays: z.number().int().min(1).max(30).optional(),
          governanceMode: z.enum([\"advisory\", \"binding\"]).optional(),
          confirmBinding: z.boolean().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          // Binding mode is intentionally rejected before wallet binding,
          // rate-limit recording, RPC access, or any other persistent effect.
          try {
            assertAdvisoryMode(input.governanceMode ?? \"advisory\");
          } catch (error) {
            createStandardError(
              \"PRECONDITION_FAILED\",
              error instanceof Error ? error.message : \"Binding governance is disabled\",
            );
          }
""",
)

replace_once(
    'server/routers.ts',
    """          return { success: true, proposalId, contentHash, anchorTxHash };
""",
    """          return {
            success: true,
            proposalId,
            contentHash,
            anchorTxHash,
            ...advisoryProposalMetadata(),
          };
""",
)

old_cast = """      cast: protectedProcedure
        .input(z.object({
          proposalDbId: z.number().int().positive(),
          proposalId: z.string().min(1),
          voterAddress: ethAddressSchema,
          choice: z.enum([\"for\", \"against\", \"abstain\"]),
          votingPower: z.number().int().positive().max(1_000_000_000),
          chain: z.enum([\"base\", \"pulsechain\"]),
          txHash: txHashSchema,
        }))
        .mutation(async ({ ctx, input }) => {
          // AUDIT FIX 1.4: Verify wallet address belongs to authenticated user
          // If user has a registered wallet, it MUST match. If not registered, bind it on first vote.
          if (ctx.user.walletAddress) {
            if (input.voterAddress.toLowerCase() !== ctx.user.walletAddress.toLowerCase()) {
              createStandardError(\"FORBIDDEN\", \"Voter address does not match authenticated user's wallet\");
            }
          } else {
            // First-time voter: bind this wallet to their account to prevent future spoofing
            // This ensures subsequent votes must come from the same wallet
            await updateUserWalletAddress(ctx.user.id, input.voterAddress);
            routerLogger.info(\"Wallet bound to user on vote cast\", {
              userId: ctx.user.id,
              walletAddress: input.voterAddress,
              proposalId: input.proposalId,
            });
          }
          const existing = await getUserVote(input.proposalDbId, ctx.user.id);
          if (existing) createStandardError(\"BAD_REQUEST\", \"Already voted on this proposal\");
          // AUDIT FIX: Server-side on-chain verification of voting power
          const verifiedPower = await verifyVotingPower(input.voterAddress, input.chain);
          if (verifiedPower <= 0) createStandardError(\"PRECONDITION_FAILED\", \"No HERO tokens found — cannot vote\");
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
            const newFor = input.choice === \"for\" ? proposal.votesFor + trustedPower : proposal.votesFor;
            const newAgainst = input.choice === \"against\" ? proposal.votesAgainst + trustedPower : proposal.votesAgainst;
            const newAbstain = input.choice === \"abstain\" ? proposal.votesAbstain + trustedPower : proposal.votesAbstain;
            await updateProposalVotes(input.proposalId, newFor, newAgainst, newAbstain);
          }
          return { success: true };
        }),
"""
new_cast = """      cast: protectedProcedure
        .input(z.object({
          proposalDbId: z.number().int().positive(),
          proposalId: z.string().min(1),
          voterAddress: ethAddressSchema,
          choice: z.enum([\"for\", \"against\", \"abstain\"]),
          // Retained for client compatibility only; advisory voting never trusts it.
          votingPower: z.number().int().positive().max(1_000_000_000).optional(),
          chain: z.enum([\"base\", \"pulsechain\"]),
          txHash: txHashSchema,
        }))
        .mutation(async ({ ctx, input }) => {
          if (!ctx.user.walletAddress) {
            createStandardError(
              \"PRECONDITION_FAILED\",
              \"Bind and verify a wallet before voting; vote casting never binds wallets implicitly\",
            );
          }
          const normalizedWallet = ctx.user.walletAddress.toLowerCase();
          if (input.voterAddress.toLowerCase() !== normalizedWallet) {
            createStandardError(
              \"FORBIDDEN\",
              \"Voter address does not match authenticated user's wallet\",
            );
          }

          const proposal = await getProposalById(input.proposalId);
          if (!proposal || proposal.id !== input.proposalDbId) {
            createStandardError(\"NOT_FOUND\", \"Proposal identity mismatch\");
          }
          try {
            assertProposalVoteable(proposal);
          } catch (error) {
            createStandardError(
              \"PRECONDITION_FAILED\",
              error instanceof Error ? error.message : \"Proposal is not voteable\",
            );
          }

          let voteChain: \"base\" | \"pulsechain\";
          try {
            voteChain = resolveAdvisoryVoteChain(proposal.chain, input.chain);
          } catch (error) {
            createStandardError(
              \"BAD_REQUEST\",
              error instanceof Error ? error.message : \"Vote chain mismatch\",
            );
          }

          const existing = await getUserVote(input.proposalDbId, ctx.user.id);
          if (existing) createStandardError(\"BAD_REQUEST\", \"Already voted on this proposal\");

          try {
            await castAdvisoryVoteAtomic({
              proposalId: input.proposalDbId,
              voterId: ctx.user.id,
              voterAddress: normalizedWallet,
              choice: input.choice,
              // Advisory mode is one authenticated wallet/account, one vote.
              votingPower: 1,
              chain: voteChain,
              txHash: input.txHash || null,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : \"Vote rejected\";
            createStandardError(
              /already voted/i.test(message) ? \"BAD_REQUEST\" : \"PRECONDITION_FAILED\",
              message,
            );
          }
          return { success: true, ...advisoryProposalMetadata() };
        }),
"""
replace_once('server/routers.ts', old_cast, new_cast)

replace_once(
    'client/src/pages/dao/ProposalDetail.tsx',
    """import { useAccount, useChainId, useReadContract } from \"wagmi\";
import { getHeroAddress } from \"@/lib/config\";
import { erc20Abi, formatUnits } from \"viem\";
""",
    """import { useAccount, useChainId } from \"wagmi\";
""",
)

start = """  // HERO token addresses per chain
  const heroTokenAddress = chainId === 369
    ? getHeroAddress(369) ?? \"\" // PulseChain
    : getHeroAddress(8453) ?? \"\"; // BASE

  // Read user's HERO balance for voting power (1 HERO = 1 vote)
  const { data: heroBalance } = useReadContract({
    address: heroTokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: \"balanceOf\",
    args: address ? [address] : undefined,
    chainId: chainId === 369 || chainId === 8453 ? chainId : undefined,
    query: { enabled: isConnected && !!address },
  });

  // Convert balance to whole tokens (18 decimals) — use formatUnits for precision
  const votingPower = heroBalance ? Math.floor(Number(formatUnits(heroBalance, 18))) : 0;
  const connectedChain = chainId === 369 ? \"pulsechain\" : \"base\";
"""
replacement = """  // Binding/token-weighted governance is intentionally disabled. Advisory mode
  // is one authenticated wallet/account, one vote.
  const votingPower = 1;
  const connectedChain = chainId === 369 ? \"pulsechain\" : \"base\";
"""
replace_once('client/src/pages/dao/ProposalDetail.tsx', start, replacement)

replace_once(
    'client/src/pages/dao/ProposalDetail.tsx',
    """  const quorum = 5_000_000;
""",
    """  const quorum = proposal.quorum;
""",
)

replace_once(
    'client/src/pages/dao/ProposalDetail.tsx',
    """    if (votingPower <= 0) return; // Must hold HERO to vote
""",
    """    // Advisory voting is unweighted; the server ignores client power claims.
""",
)

for old, new in [
    ('1 HERO = 1 vote. Voting power is calculated from your wallet balance.', 'Advisory mode: one authenticated wallet/account, one vote.'),
    ('You need HERO tokens to vote. 1 HERO = 1 vote.', 'A verified account wallet is required for advisory voting.'),
    ('Your voting power: {votingPower.toLocaleString()} HERO', 'Advisory voting power: 1 vote'),
    ('{totalVotes.toLocaleString()} / {quorum.toLocaleString()} HERO needed', '{totalVotes.toLocaleString()} / {quorum.toLocaleString()} advisory votes needed'),
]:
    replace_once('client/src/pages/dao/ProposalDetail.tsx', old, new)

print('DAO advisory boundary patch applied')
