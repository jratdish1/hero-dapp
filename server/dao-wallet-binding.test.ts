import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";

import {
  issueWalletBindingChallenge,
  verifyWalletBindingChallenge,
  verifyWalletBindingProof,
  walletBindingMessage,
} from "./dao-wallet-binding";

const originalSecret = process.env.JWT_SECRET;
const account = privateKeyToAccount("0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
const otherAccount = privateKeyToAccount("0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789");
const wallet = account.address.toLowerCase();
const otherWallet = otherAccount.address.toLowerCase();

beforeEach(() => {
  process.env.JWT_SECRET = "vets-test-secret-that-is-longer-than-thirty-two-characters";
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

describe("DAO wallet binding challenge", () => {
  it("requires a server-issued token tied to the exact user and wallet", () => {
    const now = Date.parse("2026-08-03T08:00:00.000Z");
    const challenge = issueWalletBindingChallenge(7, wallet, now);
    expect(() => verifyWalletBindingChallenge(challenge, 7, wallet, now + 1_000)).not.toThrow();
    expect(() => verifyWalletBindingChallenge(challenge, 8, wallet, now + 1_000)).toThrow(/does not match/);
    expect(() => verifyWalletBindingChallenge(challenge, 7, otherWallet, now + 1_000)).toThrow(/does not match/);
  });

  it("requires a wallet signature that recovers the requested address", async () => {
    const now = Date.parse("2026-08-03T08:00:00.000Z");
    const challenge = issueWalletBindingChallenge(7, wallet, now);
    const signature = await account.signMessage({
      message: walletBindingMessage(challenge, 7, wallet),
    });
    await expect(verifyWalletBindingProof(challenge, signature, 7, wallet, now + 1_000)).resolves.toBeUndefined();

    const wrongSignature = await otherAccount.signMessage({
      message: walletBindingMessage(challenge, 7, wallet),
    });
    await expect(verifyWalletBindingProof(challenge, wrongSignature, 7, wallet, now + 1_000))
      .rejects.toThrow(/not signed by the requested wallet/);
  });

  it("rejects direct confirmation, tampering, malformed proof, and expired challenges", async () => {
    const now = Date.parse("2026-08-03T08:00:00.000Z");
    const challenge = issueWalletBindingChallenge(7, wallet, now);
    expect(() => verifyWalletBindingChallenge("true", 7, wallet, now)).toThrow(/malformed/);
    expect(() => verifyWalletBindingChallenge(`${challenge}x`, 7, wallet, now)).toThrow(/signature/);
    expect(() => verifyWalletBindingChallenge(challenge, 7, wallet, now + 11 * 60 * 1_000)).toThrow(/expired/);
    await expect(verifyWalletBindingProof(challenge, "0x1234", 7, wallet, now + 1_000))
      .rejects.toThrow(/malformed/);
    const expiredSignature = await account.signMessage({
      message: walletBindingMessage(challenge, 7, wallet),
    });
    await expect(verifyWalletBindingProof(challenge, expiredSignature, 7, wallet, now + 11 * 60 * 1_000))
      .rejects.toThrow(/expired/);
  });
});
