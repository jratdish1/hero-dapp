#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one replacement target, found {count}")
    target.write_text(text.replace(old, new), encoding="utf-8")


replace_once(
    "server/routers.ts",
    '''import {
  advisoryProposalMetadata,
  assertAdvisoryMode,
  assertProposalVoteable,
  resolveAdvisoryVoteChain,
} from "./dao-governance-policy";''',
    '''import {
  DAO_ADVISORY_QUORUM,
  advisoryProposalMetadata,
  assertAdvisoryMode,
  assertProposalVoteable,
  resolveAdvisoryStatusTransition,
  resolveAdvisoryVoteChain,
} from "./dao-governance-policy";''',
)

replace_once(
    "server/routers.ts",
    '''            chain: input.chain || "both",
            category: input.category || "protocol",
            startTime: now,
            endTime,
''',
    '''            chain: input.chain || "both",
            category: input.category || "protocol",
            status: "active",
            quorum: DAO_ADVISORY_QUORUM,
            startTime: now,
            endTime,
''',
)

replace_once(
    "server/routers.ts",
    '''          await updateProposal(proposal.id, { status: input.status });
          return { success: true };
''',
    '''          let resolvedStatus: typeof proposal.status;
          try {
            resolvedStatus = resolveAdvisoryStatusTransition(proposal, input.status);
          } catch (error) {
            createStandardError(
              "PRECONDITION_FAILED",
              error instanceof Error ? error.message : "Invalid advisory status transition",
            );
          }
          await updateProposal(proposal.id, { status: resolvedStatus });
          return { success: true, status: resolvedStatus, ...advisoryProposalMetadata() };
''',
)

replace_once(
    "client/src/pages/dao/ProposalDetail.tsx",
    '''  // Binding/token-weighted governance is intentionally disabled. Advisory mode
  // is one authenticated wallet/account, one vote.
  const votingPower = 1;
  const connectedChain = chainId === 369 ? "pulsechain" : "base";
''',
    '''  // Binding/token-weighted governance is intentionally disabled. Advisory mode
  // is one authenticated wallet/account, one vote. Unsupported chains fail closed.
  const connectedChain = chainId === 369
    ? "pulsechain"
    : chainId === 8453
      ? "base"
      : null;
''',
)

replace_once(
    "client/src/pages/dao/ProposalDetail.tsx",
    '''  const quorum = proposal.quorum;
  const quorumPct = Math.min((totalVotes / quorum) * 100, 100);

  const handleVote = (choice: "for" | "against" | "abstain") => {
    if (!isConnected || !address || !user || hasVoted) return;
    // Advisory voting is unweighted; the server ignores client power claims.
    castVote.mutate({
      proposalDbId: proposal.id,
      proposalId: proposal.proposalId,
      voterAddress: address,
      choice,
      votingPower,
      chain: connectedChain,
    });
  };
''',
    '''  const quorum = proposal.quorum;
  const quorumPct = quorum > 0 ? Math.min((totalVotes / quorum) * 100, 100) : 0;
  const isChainEligible = connectedChain !== null
    && (proposal.chain === "both" || proposal.chain === connectedChain);

  const handleVote = (choice: "for" | "against" | "abstain") => {
    if (!isConnected || !address || !user || hasVoted || !connectedChain || !isChainEligible) return;
    // Advisory voting is unweighted; the server ignores client power claims.
    castVote.mutate({
      proposalDbId: proposal.id,
      proposalId: proposal.proposalId,
      voterAddress: address,
      choice,
      votingPower: 1,
      chain: connectedChain,
    });
  };
''',
)

replace_once(
    "client/src/pages/dao/ProposalDetail.tsx",
    '''            <Badge variant="outline">{proposal.category}</Badge>
            <Badge variant="outline">{proposal.chain}</Badge>
          </div>
          <h1 className="text-2xl font-bold">{proposal.title}</h1>
''',
    '''            <Badge variant="outline">{proposal.category}</Badge>
            <Badge variant="outline">{proposal.chain}</Badge>
            <Badge variant="outline">Advisory · 1 account = 1 vote</Badge>
          </div>
          <h1 className="text-2xl font-bold">{proposal.title}</h1>
          <p className="mt-2 text-xs text-muted-foreground">{proposal.bindingDisabledReason}</p>
''',
)

replace_once(
    "client/src/pages/dao/ProposalDetail.tsx",
    '''                ) : !user ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Sign in to vote
                  </p>
                ) : hasVoted ? (
                  <div className="text-center py-4">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-400" />
                    <p className="text-sm font-medium">You have already voted on this proposal</p>
                    <p className="text-xs text-muted-foreground mt-1">Your vote: {myVote?.choice}</p>
                  </div>
                ) : votingPower <= 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    A verified account wallet is required for advisory voting.
                  </p>
                ) : (
''',
    '''                ) : !user ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Sign in to vote
                  </p>
                ) : !connectedChain ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Switch your wallet to Base or PulseChain to cast an advisory vote.
                  </p>
                ) : !isChainEligible ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Switch to the proposal's {proposal.chain} chain before voting.
                  </p>
                ) : hasVoted ? (
                  <div className="text-center py-4">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-400" />
                    <p className="text-sm font-medium">You have already voted on this proposal</p>
                    <p className="text-xs text-muted-foreground mt-1">Your vote: {myVote?.choice}</p>
                  </div>
                ) : (
''',
)
