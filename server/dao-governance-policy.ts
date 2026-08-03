export const DAO_GOVERNANCE_MODE = "advisory" as const;
export const DAO_SNAPSHOT_VERSION = 1 as const;
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

export function advisoryProposalMetadata() {
  return {
    governanceMode: DAO_GOVERNANCE_MODE,
    snapshotVersion: DAO_SNAPSHOT_VERSION,
    bindingVotingEnabled: DAO_BINDING_VOTING_ENABLED,
    bindingDisabledReason: DAO_BINDING_DISABLED_REASON,
  };
}
