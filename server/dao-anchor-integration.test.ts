import { afterEach, describe, expect, it } from "vitest";

import {
  anchorProposalOnChain,
  finalizeProposalOnChain,
  getAnchorStatus,
  getOnChainTimelockRemaining,
  isAnchoringEnabled,
  isProposalExecutableOnChain,
  verifyContentHashOnChain,
} from "./dao-anchor-integration";
import { DAO_BINDING_DISABLED_REASON } from "./dao-governance-policy";

const originalContract = process.env.DAO_ANCHOR_CONTRACT;
const originalKey = process.env.DAO_EXECUTOR_PRIVATE_KEY;

afterEach(() => {
  if (originalContract === undefined) delete process.env.DAO_ANCHOR_CONTRACT;
  else process.env.DAO_ANCHOR_CONTRACT = originalContract;
  if (originalKey === undefined) delete process.env.DAO_EXECUTOR_PRIVATE_KEY;
  else process.env.DAO_EXECUTOR_PRIVATE_KEY = originalKey;
});

describe("DAO advisory on-chain boundary", () => {
  it("stays disabled even when legacy signer configuration is present", async () => {
    process.env.DAO_ANCHOR_CONTRACT = "0x1111111111111111111111111111111111111111";
    process.env.DAO_EXECUTOR_PRIVATE_KEY = `0x${"22".repeat(32)}`;

    expect(isAnchoringEnabled()).toBe(false);
    expect(getAnchorStatus()).toEqual({
      enabled: false,
      contractAddress: "0x0000000000000000000000000000000000000000",
      executorConfigured: false,
      disabledReason: DAO_BINDING_DISABLED_REASON,
    });
    await expect(anchorProposalOnChain(
      "HERO-ADVISORY",
      "a".repeat(64),
      new Date(Date.now() + 60_000),
    )).resolves.toBeNull();
    await expect(finalizeProposalOnChain("HERO-ADVISORY", 1, 0, 0)).resolves.toBeNull();
    await expect(isProposalExecutableOnChain("HERO-ADVISORY")).resolves.toBe(false);
    await expect(getOnChainTimelockRemaining("HERO-ADVISORY")).resolves.toBe(0);
    await expect(verifyContentHashOnChain("HERO-ADVISORY", "a".repeat(64))).resolves.toBe(false);
  });
});
