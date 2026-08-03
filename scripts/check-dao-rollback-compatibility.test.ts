import { describe, expect, it } from "vitest";

import { assessDaoRollbackCompatibility } from "./check-dao-rollback-compatibility.mjs";

describe("DAO rollback compatibility guard", () => {
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
