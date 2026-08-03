import { describe, expect, it } from "vitest";

import {
  DAO_ADVISORY_QUORUM,
  DAO_BINDING_DISABLED_REASON,
  advisoryProposalMetadata,
  assertAdvisoryMode,
  assertProposalVoteable,
  resolveAdvisoryStatusTransition,
  resolveAdvisoryVoteChain,
} from "./dao-governance-policy";

describe("DAO governance policy", () => {
  it("keeps binding voting fail-closed", () => {
    expect(() => assertAdvisoryMode("advisory")).not.toThrow();
    expect(() => assertAdvisoryMode("binding")).toThrow(
      DAO_BINDING_DISABLED_REASON,
    );
    expect(advisoryProposalMetadata()).toMatchObject({
      governanceMode: "advisory",
      snapshotVersion: 1,
      advisoryQuorum: DAO_ADVISORY_QUORUM,
      bindingVotingEnabled: false,
    });
  });

  it("accepts votes only inside the active interval", () => {
    const now = new Date("2026-08-03T01:00:00.000Z");
    expect(() => assertProposalVoteable({
      status: "active",
      startTime: new Date("2026-08-03T00:00:00.000Z"),
      endTime: new Date("2026-08-03T02:00:00.000Z"),
    }, now)).not.toThrow();
    expect(() => assertProposalVoteable({
      status: "pending",
      startTime: new Date("2026-08-03T00:00:00.000Z"),
      endTime: new Date("2026-08-03T02:00:00.000Z"),
    }, now)).toThrow(/not active/);
    expect(() => assertProposalVoteable({
      status: "active",
      startTime: new Date("2026-08-03T02:00:00.000Z"),
      endTime: new Date("2026-08-03T03:00:00.000Z"),
    }, now)).toThrow(/not started/);
    expect(() => assertProposalVoteable({
      status: "active",
      startTime: new Date("2026-08-02T00:00:00.000Z"),
      endTime: now,
    }, now)).toThrow(/ended/);
  });

  it("binds a vote to the proposal chain", () => {
    expect(resolveAdvisoryVoteChain("base", "base")).toBe("base");
    expect(resolveAdvisoryVoteChain("pulsechain", "pulsechain")).toBe("pulsechain");
    expect(resolveAdvisoryVoteChain("both", "base")).toBe("base");
    expect(resolveAdvisoryVoteChain("both", "pulsechain")).toBe("pulsechain");
    expect(() => resolveAdvisoryVoteChain("base", "pulsechain"))
      .toThrow(/does not match/);
  });

  it("blocks binding execution states and derives final advisory outcomes", () => {
    const ended = {
      status: "active" as const,
      startTime: new Date("2026-08-03T00:00:00.000Z"),
      endTime: new Date("2026-08-03T01:00:00.000Z"),
      votesFor: 2,
      votesAgainst: 1,
      votesAbstain: 0,
      quorum: 1,
    };
    const now = new Date("2026-08-03T02:00:00.000Z");

    expect(resolveAdvisoryStatusTransition(ended, "passed", now)).toBe("passed");
    expect(() => resolveAdvisoryStatusTransition(ended, "defeated", now))
      .toThrow(/result is passed/);
    expect(() => resolveAdvisoryStatusTransition(ended, "queued", now))
      .toThrow(DAO_BINDING_DISABLED_REASON);
    expect(() => resolveAdvisoryStatusTransition(ended, "executed", now))
      .toThrow(DAO_BINDING_DISABLED_REASON);
  });

  it("treats ties or missing quorum as defeated", () => {
    const now = new Date("2026-08-03T02:00:00.000Z");
    const base = {
      status: "active" as const,
      startTime: new Date("2026-08-03T00:00:00.000Z"),
      endTime: new Date("2026-08-03T01:00:00.000Z"),
      votesFor: 1,
      votesAgainst: 1,
      votesAbstain: 0,
      quorum: 1,
    };
    expect(resolveAdvisoryStatusTransition(base, "defeated", now)).toBe("defeated");
    expect(resolveAdvisoryStatusTransition({ ...base, votesAgainst: 0, quorum: 2 }, "defeated", now))
      .toBe("defeated");
  });
});
