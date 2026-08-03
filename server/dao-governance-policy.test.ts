import { describe, expect, it } from "vitest";

import {
  DAO_BINDING_DISABLED_REASON,
  DAO_LEGACY_PROPOSAL_DISABLED_REASON,
  advisoryProposalMetadata,
  assertAdvisoryMode,
  assertProposalVoteable,
  proposalGovernanceMetadata,
  resolveAdvisoryStatusTransition,
  resolveAdvisoryVoteChain,
} from "./dao-governance-policy";

const advisoryProposal = {
  status: "active" as const,
  startTime: new Date("2026-08-03T00:00:00.000Z"),
  endTime: new Date("2026-08-03T02:00:00.000Z"),
  votesFor: 2,
  votesAgainst: 1,
  votesAbstain: 0,
  quorum: 1,
  governanceMode: "advisory" as const,
  snapshotVersion: 1,
  bindingDisabledReason: DAO_BINDING_DISABLED_REASON,
};

describe("DAO governance policy", () => {
  it("keeps binding voting and delegation fail-closed", () => {
    expect(() => assertAdvisoryMode("advisory")).not.toThrow();
    expect(() => assertAdvisoryMode("binding")).toThrow(DAO_BINDING_DISABLED_REASON);
    expect(advisoryProposalMetadata()).toMatchObject({
      governanceMode: "advisory",
      snapshotVersion: 1,
      advisoryVotingEnabled: true,
      bindingVotingEnabled: false,
      delegationEnabled: false,
    });
  });

  it("accepts votes only for advisory-v1 proposals inside the active interval", () => {
    const now = new Date("2026-08-03T01:00:00.000Z");
    expect(() => assertProposalVoteable(advisoryProposal, now)).not.toThrow();
    expect(() => assertProposalVoteable({ ...advisoryProposal, status: "pending" }, now)).toThrow(/not active/);
    expect(() => assertProposalVoteable({ ...advisoryProposal, startTime: new Date("2026-08-03T02:00:00.000Z") }, now)).toThrow(/not started/);
    expect(() => assertProposalVoteable({ ...advisoryProposal, endTime: now }, now)).toThrow(/ended/);
    expect(() => assertProposalVoteable({
      ...advisoryProposal,
      governanceMode: "legacy",
      snapshotVersion: 0,
    }, now)).toThrow(DAO_LEGACY_PROPOSAL_DISABLED_REASON);
  });

  it("binds a vote to the proposal chain", () => {
    expect(resolveAdvisoryVoteChain("base", "base")).toBe("base");
    expect(resolveAdvisoryVoteChain("pulsechain", "pulsechain")).toBe("pulsechain");
    expect(resolveAdvisoryVoteChain("both", "base")).toBe("base");
    expect(resolveAdvisoryVoteChain("both", "pulsechain")).toBe("pulsechain");
    expect(() => resolveAdvisoryVoteChain("base", "pulsechain")).toThrow(/does not match/);
  });

  it("rejects binding-only states and derives final outcomes from persisted tallies", () => {
    const afterEnd = new Date("2026-08-03T03:00:00.000Z");
    expect(() => resolveAdvisoryStatusTransition(advisoryProposal, "queued", afterEnd))
      .toThrow(DAO_BINDING_DISABLED_REASON);
    expect(() => resolveAdvisoryStatusTransition(advisoryProposal, "executed", afterEnd))
      .toThrow(DAO_BINDING_DISABLED_REASON);
    expect(resolveAdvisoryStatusTransition(advisoryProposal, "passed", afterEnd)).toBe("passed");
    expect(() => resolveAdvisoryStatusTransition(advisoryProposal, "defeated", afterEnd))
      .toThrow(/result is passed/);
    expect(resolveAdvisoryStatusTransition({
      ...advisoryProposal,
      votesFor: 1,
      votesAgainst: 1,
    }, "defeated", afterEnd)).toBe("defeated");
    expect(() => resolveAdvisoryStatusTransition(advisoryProposal, "passed", new Date("2026-08-03T01:00:00.000Z")))
      .toThrow(/before voting ends/);
  });

  it("labels legacy proposals as frozen instead of advisory", () => {
    expect(proposalGovernanceMetadata({
      governanceMode: "legacy",
      snapshotVersion: 0,
      bindingDisabledReason: DAO_LEGACY_PROPOSAL_DISABLED_REASON,
    })).toMatchObject({
      governanceMode: "legacy",
      snapshotVersion: 0,
      advisoryVotingEnabled: false,
      bindingVotingEnabled: false,
      delegationEnabled: false,
      bindingDisabledReason: DAO_LEGACY_PROPOSAL_DISABLED_REASON,
    });
  });
});
