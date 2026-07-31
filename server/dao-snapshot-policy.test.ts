import { describe, expect, it } from "vitest";
import {
  assertBindingSnapshotMetadata,
  assertProposalVoteable,
  finalizedPriorBlock,
  generateProposalSnapshotCommitment,
  parseFinalityBlocks,
  requireBindingVotingEnabled,
  resolveBindingVoteChain,
  snapshotBlockForChain,
  type SnapshotCommitmentInput,
  type SnapshotRecord,
} from "./dao-snapshot-policy";

function bindingBase(overrides: Partial<SnapshotRecord> = {}): SnapshotRecord {
  return {
    chain: "base",
    governanceMode: "binding",
    snapshotVersion: 2,
    snapshotConfirmations: 20,
    snapshotBaseBlock: 123,
    snapshotPulsechainBlock: null,
    snapshotBaseTotalSupply: "1000000000000000000000000",
    snapshotPulsechainTotalSupply: null,
    snapshotVerifiedAt: new Date("2026-07-30T00:00:00.000Z"),
    bindingDisabledReason: null,
    ...overrides,
  };
}

function bindingCommitment(
  overrides: Partial<SnapshotCommitmentInput> = {},
): SnapshotCommitmentInput {
  return {
    baseContentHash: "a".repeat(64),
    quorum: 40_000,
    ...bindingBase(),
    ...overrides,
  };
}

function advisoryCommitment(
  overrides: Partial<SnapshotCommitmentInput> = {},
): SnapshotCommitmentInput {
  return {
    baseContentHash: "b".repeat(64),
    quorum: 5_000_000,
    chain: "both",
    governanceMode: "advisory",
    snapshotVersion: 1,
    snapshotConfirmations: null,
    snapshotBaseBlock: null,
    snapshotPulsechainBlock: null,
    snapshotBaseTotalSupply: null,
    snapshotPulsechainTotalSupply: null,
    snapshotVerifiedAt: null,
    bindingDisabledReason: "Advisory proposal: historical voting power is not binding.",
    ...overrides,
  };
}

describe("DAO snapshot policy", () => {
  it("requires an explicit request-time binding feature gate", () => {
    expect(() => requireBindingVotingEnabled(undefined)).toThrow(/feature-fenced/);
    expect(() => requireBindingVotingEnabled("false")).toThrow(/feature-fenced/);
    expect(() => requireBindingVotingEnabled("TRUE")).toThrow(/feature-fenced/);
    expect(() => requireBindingVotingEnabled("true")).not.toThrow();
  });

  it("uses a finalized prior block rather than the current head", () => {
    expect(finalizedPriorBlock(100n, 20n)).toBe(80n);
  });

  it("fails closed when the chain is too young", () => {
    expect(() => finalizedPriorBlock(20n, 20n)).toThrow(/too young/);
  });

  it("validates finality configuration", () => {
    expect(parseFinalityBlocks(undefined, 64n)).toBe(64n);
    expect(() => parseFinalityBlocks("0", 64n)).toThrow(/approved range/);
    expect(() => parseFinalityBlocks("nope", 64n)).toThrow(/positive integer/);
  });

  it("binds single-chain votes to the proposal chain", () => {
    expect(resolveBindingVoteChain("base", "base")).toBe("base");
    expect(() => resolveBindingVoteChain("base", "pulsechain")).toThrow(/does not match/);
  });

  it("requires both-chain binding proposals to be split", () => {
    expect(() => resolveBindingVoteChain("both", "base")).toThrow(/split/);
  });

  it("accepts a complete chain-bound snapshot receipt", () => {
    expect(assertBindingSnapshotMetadata(bindingBase(), "base")).toEqual({
      block: 123,
      confirmations: 20,
      totalSupplyRaw: "1000000000000000000000000",
    });
    expect(snapshotBlockForChain(bindingBase(), "base")).toBe(123);
  });

  it("rejects cross-chain replay against a Base proposal", () => {
    expect(() => snapshotBlockForChain(bindingBase(), "pulsechain")).toThrow(/does not match/);
  });

  it("rejects conflicting opposite-chain snapshot metadata", () => {
    expect(() => snapshotBlockForChain(bindingBase({ snapshotPulsechainBlock: 456 }), "base"))
      .toThrow(/conflicting cross-chain/);
    expect(() => snapshotBlockForChain(bindingBase({ snapshotPulsechainTotalSupply: "1" }), "base"))
      .toThrow(/conflicting cross-chain/);
  });

  it("does not treat advisory proposals as binding", () => {
    expect(() => snapshotBlockForChain(bindingBase({ governanceMode: "advisory" }), "base"))
      .toThrow(/advisory/);
  });

  it("rejects legacy or unknown snapshot versions", () => {
    expect(() => snapshotBlockForChain(bindingBase({ snapshotVersion: 1 }), "base"))
      .toThrow(/approved snapshot version/);
  });

  it("requires a positive finality receipt", () => {
    expect(() => snapshotBlockForChain(bindingBase({ snapshotConfirmations: null }), "base"))
      .toThrow(/finality receipt/);
    expect(() => snapshotBlockForChain(bindingBase({ snapshotConfirmations: 0 }), "base"))
      .toThrow(/finality receipt/);
  });

  it("requires a verified snapshot timestamp", () => {
    expect(() => snapshotBlockForChain(bindingBase({ snapshotVerifiedAt: null }), "base"))
      .toThrow(/verified snapshot timestamp/);
    expect(() => snapshotBlockForChain(bindingBase({ snapshotVerifiedAt: "not-a-date" }), "base"))
      .toThrow(/verified snapshot timestamp/);
  });

  it("fails closed when the proposal carries a disable reason", () => {
    expect(() => snapshotBlockForChain(bindingBase({ bindingDisabledReason: "token capability unavailable" }), "base"))
      .toThrow(/disabled/);
  });

  it("requires a positive historical total-supply receipt", () => {
    expect(() => snapshotBlockForChain(bindingBase({ snapshotBaseTotalSupply: null }), "base"))
      .toThrow(/historical total supply/);
    expect(() => snapshotBlockForChain(bindingBase({ snapshotBaseTotalSupply: "0" }), "base"))
      .toThrow(/historical total supply/);
    expect(() => snapshotBlockForChain(bindingBase({ snapshotBaseTotalSupply: "1.5" }), "base"))
      .toThrow(/historical total supply/);
  });

  it("allows voting only while an active proposal is inside its window", () => {
    const proposal = {
      status: "active",
      startTime: "2026-07-30T00:00:00.000Z",
      endTime: "2026-08-01T00:00:00.000Z",
    };

    expect(() => assertProposalVoteable(proposal, new Date("2026-07-31T00:00:00.000Z")))
      .not.toThrow();
    expect(() => assertProposalVoteable({ ...proposal, status: "pending" }, new Date("2026-07-31T00:00:00.000Z")))
      .toThrow(/requires active status/);
    expect(() => assertProposalVoteable(proposal, new Date("2026-07-29T23:59:59.000Z")))
      .toThrow(/not started/);
    expect(() => assertProposalVoteable(proposal, new Date("2026-08-01T00:00:01.000Z")))
      .toThrow(/ended/);
  });

  it("rejects malformed or inverted voting windows", () => {
    expect(() => assertProposalVoteable({
      status: "active",
      startTime: "not-a-date",
      endTime: "2026-08-01T00:00:00.000Z",
    })).toThrow(/invalid voting window/);

    expect(() => assertProposalVoteable({
      status: "active",
      startTime: "2026-08-01T00:00:00.000Z",
      endTime: "2026-07-30T00:00:00.000Z",
    })).toThrow(/invalid voting window/);
  });

  it("produces a deterministic snapshot commitment", () => {
    const input = bindingCommitment();
    const first = generateProposalSnapshotCommitment(input);
    const second = generateProposalSnapshotCommitment(input);

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toBe(first);
  });

  it("changes the commitment when binding trust metadata changes", () => {
    const baseline = generateProposalSnapshotCommitment(bindingCommitment());

    expect(generateProposalSnapshotCommitment(bindingCommitment({ snapshotBaseBlock: 124 })))
      .not.toBe(baseline);
    expect(generateProposalSnapshotCommitment(bindingCommitment({ quorum: 40_001 })))
      .not.toBe(baseline);
    expect(generateProposalSnapshotCommitment(bindingCommitment({ snapshotBaseTotalSupply: "1000000000000000000000001" })))
      .not.toBe(baseline);
  });

  it("commits advisory proposals only as snapshot version 1 without binding metadata", () => {
    const first = generateProposalSnapshotCommitment(advisoryCommitment());
    const second = generateProposalSnapshotCommitment(advisoryCommitment());

    expect(first).toBe(second);
    expect(() => generateProposalSnapshotCommitment(advisoryCommitment({ snapshotVersion: 2 })))
      .toThrow(/snapshot version 1/);
    expect(() => generateProposalSnapshotCommitment(advisoryCommitment({ snapshotBaseBlock: 123 })))
      .toThrow(/must not carry binding snapshot metadata/);
    expect(() => generateProposalSnapshotCommitment(advisoryCommitment({ bindingDisabledReason: "" })))
      .toThrow(/record why binding is disabled/);
  });
});
