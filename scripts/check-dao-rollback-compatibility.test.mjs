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
