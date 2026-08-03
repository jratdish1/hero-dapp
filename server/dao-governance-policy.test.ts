import { describe, expect, it } from "vitest";

import {
  DAO_BINDING_DISABLED_REASON,
  advisoryProposalMetadata,
  assertAdvisoryMode,
  assertProposalVoteable,
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
});
