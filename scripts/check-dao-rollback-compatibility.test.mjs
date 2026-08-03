import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DAO_ROLLBACK_CONTRACT_VERSION,
  assessDaoRollbackCompatibility,
  canonicalizeCheckClause,
  targetDaoBoundaryVersion,
  targetSupportsDaoBoundary,
} from "./check-dao-rollback-compatibility.mjs";

describe("DAO rollback compatibility guard", () => {
  it("recognizes the checked-out complete boundary contract", () => {
    const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    expect(DAO_ROLLBACK_CONTRACT_VERSION).toBe(2);
    expect(targetDaoBoundaryVersion(head)).toBe(2);
    expect(targetSupportsDaoBoundary(head)).toBe(true);
  });

  it("does not treat legacy marker-only targets as boundary compatible", () => {
    expect(assessDaoRollbackCompatibility({
      targetBoundaryVersion: 1,
      boundaryInstalled: true,
      boundaryIntegrityValid: true,
    })).toEqual({ allowed: false, reason: "target-lacks-current-boundary-contract" });
  });

  it("fails closed when exact or enforced database invariants drift", () => {
    expect(assessDaoRollbackCompatibility({
      targetBoundaryVersion: 2,
      boundaryInstalled: true,
      boundaryIntegrityValid: false,
    })).toEqual({ allowed: false, reason: "current-boundary-invariants-failed" });
  });

  it("allows a target only when target and installed database preserve v2", () => {
    expect(assessDaoRollbackCompatibility({
      targetBoundaryVersion: 2,
      boundaryInstalled: true,
      boundaryIntegrityValid: true,
    })).toEqual({ allowed: true, reason: "target-and-database-preserve-boundary-v2" });
  });

  it("allows a pre-boundary database without trusting target markers", () => {
    expect(assessDaoRollbackCompatibility({
      targetBoundaryVersion: 0,
      boundaryInstalled: false,
      boundaryIntegrityValid: true,
    })).toEqual({ allowed: true, reason: "boundary-not-installed" });
  });

  it("canonicalizes exact checks while rejecting weakened OR clauses", () => {
    const expected = canonicalizeCheckClause(
      "binding_enabled = FALSE AND governance_mode = 'advisory' AND snapshot_version = 1",
    );
    expect(canonicalizeCheckClause(
      "snapshot_version = 1 AND governance_mode = 'advisory' AND binding_enabled = 0",
    )).toBe(expected);
    expect(canonicalizeCheckClause(
      "binding_enabled = 0 OR governance_mode = 'advisory' OR snapshot_version = 1",
    )).not.toBe(expected);
  });

  it("fails closed in both rollback scripts when guard extraction is missing or empty", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    const extractionGuard = 'if ! git show "origin/main:scripts/check-dao-rollback-compatibility.mjs" > "$guard_path"; then';
    const nonEmptyGuard = 'if [ ! -s "$guard_path" ]; then';

    expect(workflow.split(extractionGuard)).toHaveLength(3);
    expect(workflow.split(nonEmptyGuard)).toHaveLength(3);

    const inlineFunction = workflow.match(
      /assert_dao_rollback_compatible\(\) \{([\s\S]*?)\n          \}/,
    )?.[1] ?? "";
    expect(inlineFunction).toContain(extractionGuard);
    expect(inlineFunction).toContain(nonEmptyGuard);
    expect(inlineFunction.match(/return 70/g)).toHaveLength(2);
    expect(inlineFunction.indexOf(extractionGuard)).toBeLessThan(inlineFunction.indexOf('node "$guard_path"'));
    expect(inlineFunction.indexOf(nonEmptyGuard)).toBeLessThan(inlineFunction.indexOf('node "$guard_path"'));

    const postFailureScript = workflow.match(
      /- name: Roll back after interrupted or post-deploy failure([\s\S]*?)- name: Purge Cloudflare after rollback/,
    )?.[1] ?? "";
    expect(postFailureScript).toContain(extractionGuard);
    expect(postFailureScript).toContain(nonEmptyGuard);
    expect(postFailureScript.match(/exit 70/g)).toHaveLength(2);
    expect(postFailureScript.indexOf(extractionGuard)).toBeLessThan(postFailureScript.indexOf('node "$guard_path"'));
    expect(postFailureScript.indexOf(nonEmptyGuard)).toBeLessThan(postFailureScript.indexOf('node "$guard_path"'));
    expect(postFailureScript.indexOf('node "$guard_path"')).toBeLessThan(postFailureScript.indexOf('git reset --hard "$ROLLBACK_SHA"'));
  });
});
