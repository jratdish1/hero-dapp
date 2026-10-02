import { describe, it, expect, vi } from "vitest";

vi.mock("wagmi", () => ({ useAccount: vi.fn(), useBalance: vi.fn(), useReadContract: vi.fn() }));

import { resolveTokenDecimals, formatTokenBalance } from "./useTokenBalance";

describe("useTokenBalance decimals", () => {
  it("accepts real decimals() results", () => {
    expect(resolveTokenDecimals(6)).toBe(6);
    expect(resolveTokenDecimals(18)).toBe(18);
    expect(resolveTokenDecimals(BigInt(8))).toBe(8);
    expect(resolveTokenDecimals(0)).toBe(0);
  });

  it("treats missing or nonsense values as unknown (no 18 guess)", () => {
    expect(resolveTokenDecimals(undefined)).toBeUndefined();
    expect(resolveTokenDecimals(-1)).toBeUndefined();
    expect(resolveTokenDecimals(77)).toBeUndefined();
    expect(resolveTokenDecimals(6.5)).toBeUndefined();
    expect(resolveTokenDecimals("6")).toBeUndefined();
  });

  it("a 6-decimal balance formats correctly only with the real decimals", () => {
    const oneUsdc = BigInt(1_000_000);
    expect(formatTokenBalance(oneUsdc, 6)).toBe("1.00");
    expect(formatTokenBalance(oneUsdc, 18)).not.toBe("1.00"); // the old bug
  });
});
