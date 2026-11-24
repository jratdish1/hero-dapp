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

  it("requires a wallet signature and recovered address before permanent binding", () => {
    const binding = readFileSync("server/dao-wallet-binding.ts", "utf8");
    const router = readFileSync("server/routers.ts", "utf8");
    const create = readFileSync("client/src/pages/dao/CreateProposal.tsx", "utf8");
    const detail = readFileSync("client/src/pages/dao/ProposalDetail.tsx", "utf8");
    expect(binding).toContain("recoverMessageAddress");
    expect(binding).toContain("verifyWalletBindingProof");
    expect(binding).toContain("not signed by the requested wallet");
    expect(router).toContain("walletSignatureSchema");
    expect(router).toContain("await verifyWalletBindingProof");
    for (const source of [create, detail]) {
      expect(source).toContain("useSignMessage");
      expect(source).toContain("signMessageAsync");
      expect(source).toContain("walletSignature");
    }
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
    expect(manifest.pnpm?.overrides?.["ip-address"]).toBe("10.7.1");
    expect(lockfile).toContain("ip-address: 10.7.1");
    expect(lockfile).toContain("ip-address@10.7.1:");
    expect(lockfile).toContain("sha512-4OUAqU9Z1i3vCnS05hzGiFnEMDpQ+62pAD/MVQOp83fYyNC8GleCqaS0QikQBmcWCrKFiUs/B8ztRRiYOAXuCA==");
    expect(lockfile).not.toContain("ip-address@10.5.1:");
    expect(lockfile).not.toContain("ip-address@10.3.1:");
    expect(lockfile).not.toContain("ip-address@10.2.0:");
  });

  it("pins the reviewed adm-zip security release in manifest and lockfile", () => {
    const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
      pnpm?: { overrides?: Record<string, string> };
    };
    const lockfile = readFileSync("pnpm-lock.yaml", "utf8");
    expect(manifest.pnpm?.overrides?.["adm-zip"]).toBe("0.6.1");
    expect(lockfile).toContain("adm-zip: 0.6.1");
    expect(lockfile).toContain("adm-zip@0.6.1:");
    expect(lockfile).toContain("sha512-Xwrja8nx9e5o2N1my4DsKCeKpdrnACyr1wtbPxBDgGzKzKyE9kRtBFA8mWldI+RVlD7CBZNWY/wQ2+ydwOR6kQ==");
    expect(lockfile).not.toContain("adm-zip@0.4.16:");
    expect(lockfile).not.toContain("adm-zip@0.5.");
  });

  it("pins the reviewed undici security release in manifest and lockfile", () => {
    const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
      pnpm?: { overrides?: Record<string, string> };
    };
    const lockfile = readFileSync("pnpm-lock.yaml", "utf8");
    expect(manifest.pnpm?.overrides?.["undici"]).toBe("6.28.1");
    expect(lockfile).toContain("undici: 6.28.1");
    expect(lockfile).toContain("undici@6.28.1:");
    expect(lockfile).toContain("sha512-zWpdTVD54H48CIybL0rWQ3ukpb9d23wM7eH5RtfdmeP70cWHNjtfo7P4vZX+5CoDcO53J4Pu5uXp7lNfjc6DRA==");
    expect(lockfile).not.toContain("undici@6.27.0:");
    expect(lockfile).not.toContain("undici@6.21.");
  });

  it("pins the reviewed proxy-addr and compression security releases in manifest and lockfile", () => {
    const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
      dependencies?: Record<string, string>;
      pnpm?: { overrides?: Record<string, string> };
    };
    const lockfile = readFileSync("pnpm-lock.yaml", "utf8");
    // GHSA-jqcg-44mw-7w3h: express -> proxy-addr <2.0.8 (critical)
    expect(manifest.pnpm?.overrides?.["proxy-addr"]).toBe("2.0.8");
    expect(lockfile).toContain("proxy-addr: 2.0.8");
    expect(lockfile).toContain("proxy-addr@2.0.8:");
    expect(lockfile).toContain("sha512-5nnx0yGyVUcY6t9RnWcARWtwT9F1D8O9rt08htPvnd49W1IgZtmLkhu9WfMzQj1cFxjHIO6connUNVW5k7AVyQ==");
    expect(lockfile).not.toContain("proxy-addr@2.0.7:");
    // GHSA-vc2v-76pw-4v95: compression <1.8.2 (high)
    expect(manifest.dependencies?.["compression"]).toBe("^1.8.2");
    expect(lockfile).toContain("compression@1.8.2:");
    expect(lockfile).toContain("sha512-o8vI5RE5A6EVVOd9o41jKp41aJom+QTEO/Bx8MYNjexMo/Bv2WOjUfZr+aL0WnYSgymUy6zeguqLTsIhV0gMvQ==");
    expect(lockfile).not.toContain("compression@1.8.1:");
  });
});
