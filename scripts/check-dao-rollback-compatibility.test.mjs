import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  assessDaoRollbackCompatibility,
  targetSupportsDaoBoundary,
} from "./check-dao-rollback-compatibility.mjs";

describe("DAO rollback compatibility guard", () => {
  it("recognizes the checked-out advisory boundary", () => {
    const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    expect(targetSupportsDaoBoundary(head)).toBe(true);
  });

  it("fails closed when the deploy workflow cannot extract a non-empty guard", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    const functionBody = workflow.match(
      /assert_dao_rollback_compatible\(\) \{([\s\S]*?)\n          \}/,
    )?.[1] ?? "";

    expect(functionBody).toContain(
      'if ! git show "origin/main:scripts/check-dao-rollback-compatibility.mjs" > "$guard_path"; then',
    );
    expect(functionBody).toMatch(/if \[ ! -s "\$guard_path" \]; then/);
    expect(functionBody.match(/return 70/g)).toHaveLength(2);
    expect(functionBody.indexOf("if ! git show")).toBeLessThan(functionBody.indexOf('node "$guard_path"'));
    expect(functionBody.indexOf('if [ ! -s "$guard_path" ]')).toBeLessThan(functionBody.indexOf('node "$guard_path"'));
  });

  it("allows targets that preserve the complete advisory boundary", () => {
    expect(assessDaoRollbackCompatibility({
      targetSupportsBoundary: true,
      policyTableCount: 1,
      proposalPolicyColumnCount: 3,
      governedProposalCount: 9,
    })).toEqual({ allowed: true, reason: "target-supports-boundary" });
  });

  it("allows a pre-boundary database with no policy shape", () => {
    expect(assessDaoRollbackCompatibility({
      targetSupportsBoundary: false,
      policyTableCount: 0,
      proposalPolicyColumnCount: 0,
      governedProposalCount: 0,
    })).toEqual({ allowed: true, reason: "boundary-not-installed" });
  });

  it.each([
    [1, 0],
    [0, 3],
    [1, 2],
    [2, 3],
  ])("fails closed for partial or drifted schema tables=%s columns=%s", (policyTableCount, proposalPolicyColumnCount) => {
    expect(assessDaoRollbackCompatibility({
      targetSupportsBoundary: false,
      policyTableCount,
      proposalPolicyColumnCount,
      governedProposalCount: 0,
    })).toEqual({ allowed: false, reason: "partial-or-drifted-boundary" });
  });

  it("refuses boundary-unaware code after governed proposals exist", () => {
    expect(assessDaoRollbackCompatibility({
      targetSupportsBoundary: false,
      policyTableCount: 1,
      proposalPolicyColumnCount: 3,
      governedProposalCount: 1,
    })).toEqual({ allowed: false, reason: "governed-proposals-require-boundary-aware-code" });
  });

  it("allows old code only while the complete boundary has no governed proposal rows", () => {
    expect(assessDaoRollbackCompatibility({
      targetSupportsBoundary: false,
      policyTableCount: 1,
      proposalPolicyColumnCount: 3,
      governedProposalCount: 0,
    })).toEqual({ allowed: true, reason: "complete-boundary-without-governed-proposals" });
  });
});
