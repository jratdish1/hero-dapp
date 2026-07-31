import { describe, expect, it } from "vitest";
import {
  finalizedPriorBlock,
  parseFinalityBlocks,
  resolveBindingVoteChain,
  snapshotBlockForChain,
} from "./dao-snapshot-policy";

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

  it("selects only the chain-specific immutable snapshot", () => {
    const proposal = {
      chain: "base" as const,
      governanceMode: "binding" as const,
      snapshotBaseBlock: 123,
      snapshotPulsechainBlock: null,
    };
    expect(snapshotBlockForChain(proposal, "base")).toBe(123);
    expect(() => snapshotBlockForChain(proposal, "pulsechain")).toThrow(/Missing trustworthy/);
  });

  it("does not treat advisory proposals as binding", () => {
    expect(() => snapshotBlockForChain({
      chain: "base",
      governanceMode: "advisory",
      snapshotBaseBlock: 123,
      snapshotPulsechainBlock: null,
    }, "base")).toThrow(/advisory/);
  });
});
