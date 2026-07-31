import { describe, expect, it } from "vitest";
import {
  assertBindingSnapshotMetadata,
  finalizedPriorBlock,
  parseFinalityBlocks,
  resolveBindingVoteChain,
  snapshotBlockForChain,
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

describe("DAO snapshot policy", () => {
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
});
