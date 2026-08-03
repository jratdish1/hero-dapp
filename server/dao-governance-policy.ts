export const DAO_GOVERNANCE_MODE = "advisory" as const;
export const DAO_SNAPSHOT_VERSION = 1 as const;
export const DAO_ADVISORY_QUORUM = 1 as const;
export const DAO_BINDING_VOTING_ENABLED = false as const;
export const DAO_BINDING_DISABLED_REASON =
  "Binding governance is disabled until verified wallet ownership, finalized historical checkpoints, and an audited execution contract are available.";
export const DAO_LEGACY_PROPOSAL_DISABLED_REASON =
  "This legacy proposal is frozen because it predates the advisory policy receipt and may contain token-weighted or on-chain-anchored state.";
export const DAO_DELEGATION_DISABLED_REASON =
  "Delegation is read-only while governance uses one authenticated account and bound wallet per advisory vote.";

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
export type ProposalGovernanceMode = "legacy" | "advisory" | "binding";

export interface GovernedProposalRecord {
  status: ProposalStatus;
  startTime: Date;
  endTime: Date;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  quorum: number;
  governanceMode: ProposalGovernanceMode;
  snapshotVersion: number;
  bindingDisabledReason: string | null;
}

export function assertAdvisoryMode(requested: "advisory" | "binding"): void {
  if (requested !== DAO_GOVERNANCE_MODE || DAO_BINDING_VOTING_ENABLED) {
    throw new Error(DAO_BINDING_DISABLED_REASON);
  }
}

export function assertAdvisoryProposalPolicy(
  proposal: Pick<GovernedProposalRecord, "governanceMode" | "snapshotVersion">,
): void {
  if (proposal.governanceMode === "legacy" || proposal.snapshotVersion === 0) {
    throw new Error(DAO_LEGACY_PROPOSAL_DISABLED_REASON);
  }
  if (proposal.governanceMode !== DAO_GOVERNANCE_MODE || proposal.snapshotVersion !== DAO_SNAPSHOT_VERSION) {
    throw new Error(DAO_BINDING_DISABLED_REASON);
  }
}

export function assertProposalVoteable(
  proposal: Pick<GovernedProposalRecord, "status" | "startTime" | "endTime" | "governanceMode" | "snapshotVersion">,
  now = new Date(),
): void {
  assertAdvisoryProposalPolicy(proposal);
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

export function resolveAdvisoryStatusTransition(
  proposal: GovernedProposalRecord,
  requested: ProposalStatus,
  now = new Date(),
): ProposalStatus {
  assertAdvisoryProposalPolicy(proposal);
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

export function proposalGovernanceMetadata(
  proposal: Pick<GovernedProposalRecord, "governanceMode" | "snapshotVersion" | "bindingDisabledReason">,
) {
  const legacy = proposal.governanceMode === "legacy" || proposal.snapshotVersion === 0;
  return {
    governanceMode: proposal.governanceMode,
    snapshotVersion: proposal.snapshotVersion,
    advisoryVotingEnabled:
      !legacy
      && proposal.governanceMode === DAO_GOVERNANCE_MODE
      && proposal.snapshotVersion === DAO_SNAPSHOT_VERSION,
    bindingVotingEnabled: false,
    delegationEnabled: false,
    bindingDisabledReason: legacy
      ? DAO_LEGACY_PROPOSAL_DISABLED_REASON
      : proposal.bindingDisabledReason || DAO_BINDING_DISABLED_REASON,
  };
}

/** Metadata returned by new-proposal and wallet-binding flows. */
export function advisoryProposalMetadata() {
  return {
    governanceMode: DAO_GOVERNANCE_MODE,
    snapshotVersion: DAO_SNAPSHOT_VERSION,
    advisoryVotingEnabled: true,
    bindingVotingEnabled: DAO_BINDING_VOTING_ENABLED,
    delegationEnabled: false,
    bindingDisabledReason: DAO_BINDING_DISABLED_REASON,
  };
}
