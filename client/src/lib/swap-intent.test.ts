import { describe, expect, it } from "vitest";
import {
  HERO_SWAP_INTENT_TTL_MS,
  describeHeroSwapIntent,
  getIntentHandoffStatus,
  parseHeroSwapIntent,
  walletChainIdForIntentHandoff,
  type HeroSwapIntent,
} from "./swap-intent";

function expectIntent(value: ReturnType<typeof parseHeroSwapIntent>): HeroSwapIntent {
  if ("error" in value) throw new Error(value.error);
  return value;
}

describe("HERO swap intent gate", () => {
  it("normalizes a BASE intent without executing anything", () => {
    const intent = expectIntent(
      parseHeroSwapIntent("swap 0.01 ETH to HERO on BASE", "pulsechain", 1_000),
    );

    expect(intent).toEqual({
      raw: "swap 0.01 ETH to HERO on BASE",
      chain: "base",
      fromToken: "ETH",
      toToken: "HERO",
      amountIn: "0.01",
      createdAtMs: 1_000,
      expiresAtMs: 1_000 + HERO_SWAP_INTENT_TTL_MS,
    });
    expect(describeHeroSwapIntent(intent)).toBe("0.01 ETH → HERO on BASE");
  });

  it("normalizes a PulseChain intent", () => {
    const intent = expectIntent(
      parseHeroSwapIntent("buy HERO with 250000 PLS on PulseChain", "base", 5_000),
    );

    expect(intent.chain).toBe("pulsechain");
    expect(intent.fromToken).toBe("PLS");
    expect(intent.amountIn).toBe("250000");
  });

  it("rejects unsupported targets and malformed or non-positive amounts", () => {
    expect(parseHeroSwapIntent("swap 1 ETH to USDC on BASE", "base")).toEqual({
      error: "This bounded intent flow only supports buying HERO.",
    });
    expect(parseHeroSwapIntent("swap 0 ETH to HERO on BASE", "base")).toHaveProperty("error");
    expect(parseHeroSwapIntent("swap -1 ETH to HERO on BASE", "base")).toHaveProperty("error");
    expect(parseHeroSwapIntent("swap 1 ETH to HERO on BASE on PulseChain", "base")).toEqual({
      error: "Choose one chain only: BASE or PulseChain.",
    });
  });

  it("cannot hand off before explicit confirmation", () => {
    const intent = expectIntent(
      parseHeroSwapIntent("swap 0.02 ETH to HERO on BASE", "base", 10_000),
    );

    expect(getIntentHandoffStatus(intent, "base", false, 10_001)).toBe("needs-confirm");
    expect(getIntentHandoffStatus(intent, "base", true, 10_001)).toBe("ready");
  });

  it("fails closed when the chain changes or the review expires", () => {
    const intent = expectIntent(
      parseHeroSwapIntent("swap 100 PLS to HERO on PulseChain", "pulsechain", 20_000),
    );

    expect(getIntentHandoffStatus(intent, "base", true, 20_001)).toBe("chain-changed");
    expect(
      getIntentHandoffStatus(
        intent,
        "pulsechain",
        true,
        20_000 + HERO_SWAP_INTENT_TTL_MS,
      ),
    ).toBe("expired");
  });

  it("fails closed when the connected wallet chainId mismatches the intent", () => {
    const intent = expectIntent(
      parseHeroSwapIntent("swap 0.01 ETH to HERO on BASE", "base", 30_000),
    );

    expect(getIntentHandoffStatus(intent, "base", true, 30_001, 369)).toBe(
      "wallet-chain-mismatch",
    );
    expect(getIntentHandoffStatus(intent, "base", true, 30_001, 8453)).toBe("ready");
    expect(getIntentHandoffStatus(intent, "base", true, 30_001, null)).toBe("ready");
  });

  it("fails closed when the wallet is on an unconfigured chain and useChainId is stale", () => {
    const intent = expectIntent(
      parseHeroSwapIntent("swap 0.01 ETH to HERO on BASE", "base", 40_000),
    );
    const staleConfiguredChainId = 8453;

    const unsupported = walletChainIdForIntentHandoff(
      true,
      staleConfiguredChainId,
      true,
      42161,
    );
    expect(unsupported).toBe(42161);
    expect(getIntentHandoffStatus(intent, "base", true, 40_001, unsupported)).toBe(
      "wallet-chain-mismatch",
    );

    const unsupportedUnknown = walletChainIdForIntentHandoff(
      true,
      staleConfiguredChainId,
      true,
      undefined,
    );
    expect(unsupportedUnknown).not.toBe(staleConfiguredChainId);
    expect(
      getIntentHandoffStatus(intent, "base", true, 40_001, unsupportedUnknown),
    ).toBe("wallet-chain-mismatch");

    const staleConnector = walletChainIdForIntentHandoff(
      true,
      staleConfiguredChainId,
      true,
      staleConfiguredChainId,
    );
    expect(staleConnector).not.toBe(staleConfiguredChainId);
    expect(
      getIntentHandoffStatus(intent, "base", true, 40_001, staleConnector),
    ).toBe("wallet-chain-mismatch");

    expect(
      walletChainIdForIntentHandoff(true, staleConfiguredChainId, false, 8453),
    ).toBe(8453);
    expect(walletChainIdForIntentHandoff(false, staleConfiguredChainId, true, 42161)).toBe(
      null,
    );
  });
});

