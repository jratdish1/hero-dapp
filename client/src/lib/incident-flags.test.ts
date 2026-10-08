import { describe, expect, it } from "vitest";
import {
  HERO_INCIDENT_MAINTENANCE,
  HERO_INCIDENT_WRITE_BLOCKED_ERROR,
  assertApprovalWriteAllowed,
  assertWalletWritesAllowed,
  isRevokeWrite,
} from "./incident-flags";

describe("HERO incident maintenance flags", () => {
  it("defaults to maintenance ON", () => {
    expect(HERO_INCIDENT_MAINTENANCE).toBe(true);
    expect(() => assertWalletWritesAllowed()).toThrow(HERO_INCIDENT_WRITE_BLOCKED_ERROR);
  });

  it("classifies only allowance removals as revokes", () => {
    expect(isRevokeWrite({ kind: "approve", amount: 0n })).toBe(true);
    expect(isRevokeWrite({ kind: "setApprovalForAll", approved: false })).toBe(true);
    expect(isRevokeWrite({ kind: "approve", amount: 1n })).toBe(false);
    expect(isRevokeWrite({ kind: "approve", amount: 2n ** 256n - 1n })).toBe(false);
    expect(isRevokeWrite({ kind: "setApprovalForAll", approved: true })).toBe(false);
  });

  it("allows revoke and blocks any non-zero approve while maintenance is on", () => {
    expect(() => assertApprovalWriteAllowed({ kind: "approve", amount: 0n })).not.toThrow();
    expect(() => assertApprovalWriteAllowed({ kind: "setApprovalForAll", approved: false })).not.toThrow();
    expect(() => assertApprovalWriteAllowed({ kind: "approve", amount: 1n })).toThrow(HERO_INCIDENT_WRITE_BLOCKED_ERROR);
    expect(() => assertApprovalWriteAllowed({ kind: "setApprovalForAll", approved: true })).toThrow(HERO_INCIDENT_WRITE_BLOCKED_ERROR);
  });

  it("does not block approvals once maintenance is explicitly off", () => {
    expect(() => assertApprovalWriteAllowed({ kind: "approve", amount: 1n }, false)).not.toThrow();
  });
});
