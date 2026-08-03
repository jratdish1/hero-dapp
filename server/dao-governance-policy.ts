export const DAO_GOVERNANCE_MODE = "advisory" as const;
export const DAO_SNAPSHOT_VERSION = 1 as const;
export const DAO_ADVISORY_QUORUM = 1 as const;
export const DAO_BINDING_VOTING_ENABLED = false as const;
export const DAO_BINDING_DISABLED_REASON =
  "Binding governance is disabled until verified wallet ownership, finalized historical checkpoints, and an audited execution contract are available.";

export type ProposalChain = "base" | "pulsechain" | "both";
export type VoteChain = Exclude<ProposalChain, "both">;
export type ProposalStatus =
  | "pending"
  | "active"
  | "passed"
  | "defeated"
  | "queued"
  | "executed"
  | "cancelled";

export interface AdvisoryStatusRecord {
  status: ProposalStatus;
  startTime: Date;
  endTime: Date;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  quorum: number;
}

export function assertAdvisoryMode(requested: "advisory" | "binding"): void {
  if (requested !== DAO_GOVERNANCE_MODE || DAO_BINDING_VOTING_ENABLED) {
    throw new Error(DAO_BINDING_DISABLED_REASON);
  }
}

export function assertProposalVoteable(
  proposal: { status: ProposalStatus; startTime: Date; endTime: Date },
  now = new Date(),
): void {
  if (proposal.status !== "active") {
    throw new Error("Proposal is not active");
  }
  if (now < proposal.startTime) {
    throw new Error("Proposal voting has not started");
  }
  if (now >= proposal.endTime) {
    throw new Error("Proposal voting has ended");
  }
}

export function resolveAdvisoryVoteChain(
  proposalChain: ProposalChain,
  requestedChain: VoteChain,
): VoteChain {
  if (proposalChain !== "both" && proposalChain !== requestedChain) {
    throw new Error("Vote chain does not match proposal chain");
  }
  return proposalChain === "both" ? requestedChain : proposalChain;
}

/**
 * Advisory proposals cannot enter binding execution states. Final outcomes are
 * derived from persisted tallies after the voting window instead of trusting a
 * caller-supplied status.
 */
export function resolveAdvisoryStatusTransition(
  proposal: AdvisoryStatusRecord,
  requested: ProposalStatus,
  now = new Date(),
): ProposalStatus {
  if (requested === "queued" || requested === "executed") {
    throw new Error(DAO_BINDING_DISABLED_REASON);
  }
  if (requested === proposal.status) return requested;

  if (proposal.status === "pending") {
    if (requested === "active" || requested === "cancelled") return requested;
    throw new Error("Pending advisory proposals may only be activated or cancelled");
  }

  if (proposal.status === "active") {
    if (requested === "cancelled") return requested;
    if (requested !== "passed" && requested !== "defeated") {
      throw new Error("Active advisory proposals may only be cancelled or finalized");
    }
    if (now < proposal.endTime) {
      throw new Error("Advisory proposal cannot be finalized before voting ends");
    }
    if (!Number.isSafeInteger(proposal.quorum) || proposal.quorum < 1) {
      throw new Error("Advisory proposal has an invalid quorum");
    }

    const totalVotes = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;
    const expected = totalVotes >= proposal.quorum && proposal.votesFor > proposal.votesAgainst
      ? "passed"
      : "defeated";
    if (requested !== expected) {
      throw new Error(`Advisory result is ${expected}; caller requested ${requested}`);
    }
    return expected;
  }

  throw new Error(`Proposal status ${proposal.status} is terminal`);
}

export function advisoryProposalMetadata() {
  return {
    governanceMode: DAO_GOVERNANCE_MODE,
    snapshotVersion: DAO_SNAPSHOT_VERSION,
    advisoryQuorum: DAO_ADVISORY_QUORUM,
    bindingVotingEnabled: DAO_BINDING_VOTING_ENABLED,
    bindingDisabledReason: DAO_BINDING_DISABLED_REASON,
  };
}
