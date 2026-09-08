import { describe, expect, it } from "vitest";
import {
  sanitizeWalletTokenSymbol,
  validateBridgeRequest,
  validateSendRequest,
} from "./heroWalletValidation";

describe("heroWalletValidation", () => {
  const balances = [
    { symbol: "HERO", chain: "base", balance: "10" },
    { symbol: "HERO", chain: "pulsechain", balance: "0" },
    { symbol: "ETH", chain: "base", balance: "1.5" },
  ];

  it("rejects invalid recipient addresses", () => {
    expect(
      validateSendRequest({
        sendTo: "not-an-address",
        sendAmount: "1",
        sendToken: "HERO",
        sendChain: "base",
        balances,
      })
    ).toEqual({ error: "Invalid recipient address" });
  });

  it("rejects unsupported send token symbols", () => {
    expect(
      validateSendRequest({
        sendTo: "0x0000000000000000000000000000000000000001",
        sendAmount: "1",
        sendToken: "???",
        sendChain: "base",
        balances,
      })
    ).toEqual({ error: "Invalid token symbol" });
  });

  it("rejects send tokens that are not in wallet balances", () => {
    expect(
      validateSendRequest({
        sendTo: "0x0000000000000000000000000000000000000001",
        sendAmount: "1",
        sendToken: "USDC",
        sendChain: "base",
        balances,
      })
    ).toEqual({ error: "Token not supported or unknown" });
  });

  it("uses the selected chain when resolving send balances", () => {
    expect(
      validateSendRequest({
        sendTo: "0x0000000000000000000000000000000000000001",
        sendAmount: "1",
        sendToken: "HERO",
        sendChain: "arbitrum",
        balances,
      })
    ).toEqual({ error: "Token balance not found" });
  });

  it("rejects same-chain bridge requests", () => {
    expect(
      validateBridgeRequest({
        bridgeFrom: "base",
        bridgeTo: "base",
        bridgeAmount: "1",
        bridgeToken: "hero",
      })
    ).toEqual({ error: "Select different source and destination chains" });
  });

  it("rejects unsupported bridge chains", () => {
    expect(
      validateBridgeRequest({
        bridgeFrom: "base",
        bridgeTo: "optimism",
        bridgeAmount: "1",
        bridgeToken: "hero",
      })
    ).toEqual({ error: "Unsupported destination chain" });
  });

  it("sanitizes wallet token symbols", () => {
    expect(sanitizeWalletTokenSymbol("hero-usdc!!")).toBe("HEROUSDC");
  });
});
