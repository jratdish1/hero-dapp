import { describe, expect, it } from "vitest";

import {
  classifyDaoMigrationShape,
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

  it("normalizes MySQL check-clause formatting without weakening content", () => {
    expect(normalizeCheckClause("((`binding_enabled` = false) AND (`snapshot_version` = 1))"))
      .toBe("binding_enabled=0andsnapshot_version=1");
  });
});
