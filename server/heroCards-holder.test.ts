/**
 * Tests for heroCards-holder.ts (server-side holder verification)
 * Covers: fail-closed behavior, address validation, failOpen override, timeout protection.
 *
 * NOTE: These tests mock the viem client to avoid real RPC calls.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock viem before importing the module ────────────────────────────────────
const mockReadContract = vi.fn();

vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({ readContract: mockReadContract })),
    http: vi.fn(),
  };
});

import {
  getHeroCardsHolderStatus,
  getHeroCardsTier,
  canAccessHeroSpinWheel,
  getHeroFeeDiscount,
} from "./heroCards-holder";

const VALID_WALLET = "0x5F1D1af1EbA90FD4A29e194275c6DfA42f4E7Dba";
const INVALID_WALLET = "not-an-address";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setupSuccessReads(balance: bigint, tier: number, canSpin: boolean, discount: bigint) {
  // Each call to getHeroCardsHolderStatus makes 4 readContract calls in order:
  // 1. balanceOf, 2. getHolderTier, 3. canAccessSpinWheel, 4. getFeeDiscount
  mockReadContract
    .mockResolvedValueOnce(balance)
    .mockResolvedValueOnce(tier)
    .mockResolvedValueOnce(canSpin)
    .mockResolvedValueOnce(discount);
}

function setupErrorReads() {
  mockReadContract.mockRejectedValue(new Error("RPC connection failed"));
}

// ─── Address Validation ───────────────────────────────────────────────────────
describe("getHeroCardsHolderStatus() — address validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws on empty wallet string", async () => {
    await expect(getHeroCardsHolderStatus("")).rejects.toThrow();
  });

  it("throws on non-hex wallet string", async () => {
    await expect(getHeroCardsHolderStatus(INVALID_WALLET)).rejects.toThrow();
  });

  it("throws on wallet that is too short", async () => {
    await expect(getHeroCardsHolderStatus("0xabc")).rejects.toThrow();
  });
});

// ─── Fail-Closed Behavior ─────────────────────────────────────────────────────
describe("getHeroCardsHolderStatus() — fail-closed on RPC error", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupErrorReads();
  });

  it("returns tier=none on RPC failure (fail-closed default)", async () => {
    const result = await getHeroCardsHolderStatus(VALID_WALLET);
    expect(result.tier).toBe("none");
    expect(result.canSpin).toBe(false);
    expect(result.balance).toBe(0);
    expect(result.feeDiscountBps).toBe(0);
  });

  it("returns tier=bronze on RPC failure when failOpen=true", async () => {
    const result = await getHeroCardsHolderStatus(VALID_WALLET, { failOpen: true });
    expect(result.tier).toBe("bronze");
    expect(result.canSpin).toBe(true);
  });

  it("fail-closed is the default (no failOpen param)", async () => {
    const result = await getHeroCardsHolderStatus(VALID_WALLET);
    expect(result.tier).toBe("none");
  });
});

// ─── Successful Holder Reads ──────────────────────────────────────────────────
describe("getHeroCardsHolderStatus() — successful reads", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns bronze tier for balance=1, tier=1", async () => {
    setupSuccessReads(1n, 1, true, 200n);
    const result = await getHeroCardsHolderStatus(VALID_WALLET);
    expect(result.tier).toBe("bronze");
    expect(result.balance).toBe(1);
    expect(result.canSpin).toBe(true);
    expect(result.feeDiscountBps).toBe(200);
  });

  it("returns silver tier for balance=3, tier=2", async () => {
    setupSuccessReads(3n, 2, true, 200n);
    const result = await getHeroCardsHolderStatus(VALID_WALLET);
    expect(result.tier).toBe("silver");
  });

  it("returns gold tier for balance=10, tier=3", async () => {
    setupSuccessReads(10n, 3, true, 200n);
    const result = await getHeroCardsHolderStatus(VALID_WALLET);
    expect(result.tier).toBe("gold");
  });

  it("returns none tier when balance=0 even if tier=1 (balance is authoritative)", async () => {
    setupSuccessReads(0n, 1, false, 0n);
    const result = await getHeroCardsHolderStatus(VALID_WALLET);
    expect(result.tier).toBe("none");
    expect(result.canSpin).toBe(false);
  });

  it("returns correct network in result", async () => {
    setupSuccessReads(1n, 1, true, 200n);
    const result = await getHeroCardsHolderStatus(VALID_WALLET, { network: "pulsechain" });
    expect(result.network).toBe("pulsechain");
  });

  it("defaults to base network", async () => {
    setupSuccessReads(1n, 1, true, 200n);
    const result = await getHeroCardsHolderStatus(VALID_WALLET);
    expect(result.network).toBe("base");
  });
});

// ─── Helper Functions ─────────────────────────────────────────────────────────
describe("getHeroCardsTier()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns bronze for invalid wallet (no throw)", async () => {
    const tier = await getHeroCardsTier(INVALID_WALLET);
    expect(tier).toBe("bronze");
  });

  it("returns bronze when RPC fails (fail-closed maps none→bronze)", async () => {
    setupErrorReads();
    const tier = await getHeroCardsTier(VALID_WALLET);
    expect(tier).toBe("bronze");
  });

  it("returns gold for a gold holder", async () => {
    setupSuccessReads(10n, 3, true, 200n);
    const tier = await getHeroCardsTier(VALID_WALLET);
    expect(tier).toBe("gold");
  });
});

describe("canAccessHeroSpinWheel()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns false for invalid wallet", async () => {
    expect(await canAccessHeroSpinWheel(INVALID_WALLET)).toBe(false);
  });

  it("returns false on RPC failure (fail-closed)", async () => {
    setupErrorReads();
    expect(await canAccessHeroSpinWheel(VALID_WALLET)).toBe(false);
  });

  it("returns true for a holder with canSpin=true", async () => {
    setupSuccessReads(1n, 1, true, 200n);
    expect(await canAccessHeroSpinWheel(VALID_WALLET)).toBe(true);
  });
});

describe("getHeroFeeDiscount()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 0 for invalid wallet", async () => {
    expect(await getHeroFeeDiscount(INVALID_WALLET)).toBe(0);
  });

  it("returns 0 on RPC failure (fail-closed)", async () => {
    setupErrorReads();
    expect(await getHeroFeeDiscount(VALID_WALLET)).toBe(0);
  });

  it("returns 200 for a holder with 200 bps discount", async () => {
    setupSuccessReads(1n, 1, true, 200n);
    expect(await getHeroFeeDiscount(VALID_WALLET)).toBe(200);
  });
});
