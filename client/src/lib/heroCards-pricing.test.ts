import { describe, it, expect } from "vitest";
import { parseEther } from "viem";
import {
  readPrice,
  mintValueWei,
  formatPrice,
  HeroCardsPriceUnavailableError,
} from "./heroCards-pricing";

describe("heroCards-pricing", () => {
  it("uses the on-chain unit price, not a static config value", () => {
    const onchain = parseEther("0.0123");
    expect(mintValueWei(onchain, 3)).toBe(parseEther("0.0369"));
  });

  it("fails closed when the on-chain price has not loaded", () => {
    expect(() => mintValueWei(undefined, 1)).toThrow(HeroCardsPriceUnavailableError);
  });

  it("rejects zero, negative and non-integer quantities", () => {
    const p = parseEther("0.01");
    expect(() => mintValueWei(p, 0)).toThrow(RangeError);
    expect(() => mintValueWei(p, -1)).toThrow(RangeError);
    expect(() => mintValueWei(p, 1.5)).toThrow(RangeError);
  });

  it("allows a free (zero-price) mint when the contract says so", () => {
    expect(mintValueWei(BigInt(0), 2)).toBe(BigInt(0));
  });

  it("readPrice only accepts bigint reads", () => {
    expect(readPrice(undefined)).toBeUndefined();
    expect(readPrice("100")).toBeUndefined();
    expect(readPrice(100)).toBeUndefined();
    expect(readPrice(BigInt(100))).toBe(BigInt(100));
  });

  it("formats on-chain price or an em dash while unknown", () => {
    expect(formatPrice(parseEther("0.05"))).toBe("0.05");
    expect(formatPrice(undefined)).toBe("\u2014");
  });
});
