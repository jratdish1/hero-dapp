import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("DAO exact-head closeout regressions", () => {
  it("uses the database clock only after the proposal row lock", () => {
    const source = readFileSync("server/db.ts", "utf8");
    const voteFunction = source.match(/export async function castAdvisoryVoteAtomic[\s\S]*?\n}\n\nexport async function getVotesByProposal/)?.[0] ?? "";
    expect(voteFunction).toContain("FOR UPDATE");
    expect(voteFunction).toContain("CURRENT_TIMESTAMP(3) AS currentTime");
    expect(voteFunction.indexOf("FOR UPDATE")).toBeLessThan(voteFunction.indexOf("CURRENT_TIMESTAMP(3) AS currentTime"));
    expect(voteFunction.indexOf("CURRENT_TIMESTAMP(3) AS currentTime")).toBeLessThan(voteFunction.indexOf("lockedNow >= proposal.endTime"));
    expect(voteFunction).not.toContain("now = new Date()");
  });

  it("locks wallet binding and backs it with a unique database index", () => {
    const database = readFileSync("server/db.ts", "utf8");
    const schema = readFileSync("drizzle/schema.ts", "utf8");
    const migration = readFileSync("server/dao-advisory-migration.ts", "utf8");
    const binding = database.match(/export async function updateUserWalletAddress[\s\S]*$/)?.[0] ?? "";
    expect(binding).toContain("db.transaction");
    expect(binding).toContain("FOR UPDATE");
    expect(binding).toContain("Wallet is already bound to another account");
    expect(binding).toContain("isDuplicateKeyError");
    expect(schema).toContain('uniqueIndex("ux_users_wallet_address").on(table.walletAddress)');
    expect(migration).toContain("duplicate bound wallet addresses require manual reconciliation");
    expect(migration).toContain("ADD UNIQUE INDEX ${WALLET_UNIQUE_INDEX} (walletAddress)");
  });

  it("computes exact proposal aggregates without a bounded listing", () => {
    const database = readFileSync("server/db.ts", "utf8");
    const router = readFileSync("server/routers.ts", "utf8");
    expect(database).toContain("export async function getDaoProposalStats");
    expect(database).toContain("COUNT(*) AS totalProposals");
    expect(database).toContain("endTime > CURRENT_TIMESTAMP(3)");
    expect(router).toContain("getDaoProposalStats()");
    expect(router).not.toContain("getProposals(undefined, 1000)");
  });

  it("rejects binding-only and invalid finalized advisory states before routes are served", () => {
    const migration = readFileSync("server/dao-advisory-migration.ts", "utf8");
    const guard = readFileSync("scripts/check-dao-rollback-compatibility.mjs", "utf8");
    for (const source of [migration, guard]) {
      expect(source).toContain("proposal.status IN ('queued', 'executed')");
      expect(source).toContain("proposal.status IN ('passed', 'defeated')");
      expect(source).toContain("proposal.endTime > CURRENT_TIMESTAMP(3)");
      expect(source).toContain("proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain >= proposal.quorum");
      expect(source).toContain("proposal.votesFor > proposal.votesAgainst");
    }
    expect(migration).toContain("await verifyProposalPolicyHistory(connection)");
  });

  it("labels every proposal accounting model truthfully", () => {
    const page = readFileSync("client/src/pages/dao/Proposals.tsx", "utf8");
    expect(page).toContain("Advisory v1 · one account, one vote");
    expect(page).toContain("Legacy frozen · no new voting or execution");
    expect(page).toContain("External Snapshot");
    expect(page).toContain("historical voting-power units");
    expect(page).toContain("external Snapshot votes");
  });

  it("inspects the installed boundary before trusting a rollback target", () => {
    const guard = readFileSync("scripts/check-dao-rollback-compatibility.mjs", "utf8");
    const assertion = guard.match(/export async function assertDaoRollbackCompatibility[\s\S]*?\n}\n\nasync function main/)?.[0] ?? "";
    expect(guard).toContain("DAO_ROLLBACK_CONTRACT_VERSION = 2");
    expect(guard).toContain("tc.ENFORCED");
    expect(guard).toContain("ux_users_wallet_address");
    expect(assertion.indexOf("inspectDaoBoundary")).toBeLessThan(assertion.indexOf("assessDaoRollbackCompatibility"));
    expect(assertion).not.toContain("if (targetSupportsBoundary) return");
  });

  it("pins the reviewed ip-address security release in manifest and lockfile", () => {
    const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
      pnpm?: { overrides?: Record<string, string> };
    };
    const lockfile = readFileSync("pnpm-lock.yaml", "utf8");
    expect(manifest.pnpm?.overrides?.["ip-address"]).toBe("10.3.1");
    expect(lockfile).toContain("ip-address: 10.3.1");
    expect(lockfile).toContain("ip-address@10.3.1:");
    expect(lockfile).toContain("sha512-1e9d3kb97NHJTIJDZW9rKqW2h6+dFa50Dy0fpPSMQp2ADje5gvKsXmdiK6dwY5t76TaTt5+P5N1Y/LoToIxP6g==");
    expect(lockfile).not.toContain("ip-address@10.2.0:");
  });
});
