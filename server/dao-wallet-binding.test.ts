import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  issueWalletBindingChallenge,
  verifyWalletBindingChallenge,
} from "./dao-wallet-binding";

const originalSecret = process.env.JWT_SECRET;
const wallet = "0x1111111111111111111111111111111111111111";
const otherWallet = "0x2222222222222222222222222222222222222222";

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

  it("rejects direct confirmation, tampering, and expired challenges", () => {
    const now = Date.parse("2026-08-03T08:00:00.000Z");
    const challenge = issueWalletBindingChallenge(7, wallet, now);
    expect(() => verifyWalletBindingChallenge("true", 7, wallet, now)).toThrow(/malformed/);
    expect(() => verifyWalletBindingChallenge(`${challenge}x`, 7, wallet, now)).toThrow(/signature/);
    expect(() => verifyWalletBindingChallenge(challenge, 7, wallet, now + 11 * 60 * 1_000)).toThrow(/expired/);
  });
});
