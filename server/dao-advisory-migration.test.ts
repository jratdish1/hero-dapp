import { describe, expect, it } from "vitest";

import {
  canonicalizeCheckClause,
  classifyDaoMigrationShape,
  isConstraintEnforced,
  normalizeCheckClause,
} from "./dao-advisory-migration";

describe("DAO advisory migration policy", () => {
  it("installs only from a completely absent schema", () => {
    expect(classifyDaoMigrationShape(0, 0)).toBe("install");
  });

  it("verifies only a complete prior schema", () => {
    expect(classifyDaoMigrationShape(1, 3)).toBe("verify");
  });

  it.each([
    [1, 0],
    [0, 3],
    [1, 1],
    [1, 2],
    [2, 3],
  ])("fails closed on partial or duplicate shape tables=%s columns=%s", (tables, columns) => {
    expect(() => classifyDaoMigrationShape(tables, columns)).toThrow(/FAIL-CLOSED/);
  });

  it("normalizes MySQL check-clause formatting and charset introducers", () => {
    expect(normalizeCheckClause("((`binding_enabled` = false) AND (`governance_mode` = _utf8mb4'advisory'))"))
      .toBe("binding_enabled=0andgovernance_mode='advisory'");
  });

  it("canonicalizes only the exact expected conjunction", () => {
    const expected = canonicalizeCheckClause(
      "binding_enabled = FALSE AND governance_mode = 'advisory' AND snapshot_version = 1",
    );
    expect(canonicalizeCheckClause(
      "snapshot_version = 1 AND binding_enabled = 0 AND governance_mode = 'advisory'",
    )).toBe(expected);
    expect(canonicalizeCheckClause(
      "binding_enabled = 0 OR governance_mode = 'advisory' OR snapshot_version = 1",
    )).not.toBe(expected);
    expect(canonicalizeCheckClause(
      "binding_enabled = 0 AND governance_mode = 'advisory' AND snapshot_version = 1 AND id = 1",
    )).not.toBe(expected);
  });

  it("accepts only explicitly enforced MySQL checks", () => {
    expect(isConstraintEnforced("YES")).toBe(true);
    expect(isConstraintEnforced("yes")).toBe(true);
    expect(isConstraintEnforced("NO")).toBe(false);
    expect(isConstraintEnforced(undefined)).toBe(false);
  });
});
