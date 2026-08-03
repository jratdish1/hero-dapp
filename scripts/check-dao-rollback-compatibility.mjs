#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REQUIRED_TARGET_MARKERS = [
  ['server/dao-advisory-migration.ts', 'verifyProposalPolicyHistory'],
  ['server/dao-governance-policy.ts', 'assertAdvisoryProposalPolicy'],
  ['server/dao-anchor.ts', 'DAO on-chain operation blocked by advisory governance boundary'],
  ['server/routers.ts', 'assertNoAdvisoryTransactionHash'],
];

export function assessDaoRollbackCompatibility({
  targetSupportsBoundary,
  policyTableCount,
  proposalPolicyColumnCount,
  governedProposalCount,
}) {
  if (targetSupportsBoundary) return { allowed: true, reason: 'target-supports-boundary' };
  if (policyTableCount === 0 && proposalPolicyColumnCount === 0) {
    return { allowed: true, reason: 'boundary-not-installed' };
  }
  if (policyTableCount !== 1 || proposalPolicyColumnCount !== 3) {
    return { allowed: false, reason: 'partial-or-drifted-boundary' };
  }
  if (governedProposalCount > 0) {
    return { allowed: false, reason: 'governed-proposals-require-boundary-aware-code' };
  }
  return { allowed: true, reason: 'complete-boundary-without-governed-proposals' };
}

function readGitFile(targetSha, path) {
  return execFileSync('git', ['show', `${targetSha}:${path}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

export function targetSupportsDaoBoundary(targetSha) {
  try {
    return REQUIRED_TARGET_MARKERS.every(([path, marker]) => readGitFile(targetSha, path).includes(marker));
  } catch {
    return false;
  }
}

function readDatabaseUrlFromPm2() {
  const processes = JSON.parse(execFileSync('pm2', ['jlist'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }));
  const app = processes.find(item => item.name === 'hero-dapp');
  const databaseUrl = app?.pm2_env?.env?.DATABASE_URL ?? app?.pm2_env?.DATABASE_URL;
  if (typeof databaseUrl !== 'string' || databaseUrl.trim().length === 0) {
    throw new Error('production database configuration is unavailable');
  }
  return databaseUrl.trim();
}

async function inspectDaoBoundary(databaseUrl) {
  const mysql = await import('mysql2/promise');
  const connection = await mysql.createConnection(databaseUrl);
  try {
    const [tableRows] = await connection.query(
      `SELECT COUNT(*) AS count
         FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = 'dao_governance_policy'`,
    );
    const [columnRows] = await connection.query(
      `SELECT COUNT(*) AS count
         FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'proposals'
          AND column_name IN ('governanceMode', 'snapshotVersion', 'bindingDisabledReason')`,
    );
    const policyTableCount = Number(tableRows[0]?.count ?? 0);
    const proposalPolicyColumnCount = Number(columnRows[0]?.count ?? 0);
    let governedProposalCount = 0;
    if (policyTableCount === 1 && proposalPolicyColumnCount === 3) {
      const [proposalRows] = await connection.query(
        `SELECT COUNT(*) AS count
           FROM proposals
          WHERE governanceMode <> 'legacy'
             OR snapshotVersion <> 0`,
      );
      governedProposalCount = Number(proposalRows[0]?.count ?? 0);
    }
    return { policyTableCount, proposalPolicyColumnCount, governedProposalCount };
  } finally {
    await connection.end();
  }
}

export async function assertDaoRollbackCompatibility(targetSha) {
  if (!/^[0-9a-f]{40}$/.test(targetSha)) {
    throw new Error('rollback target SHA is invalid');
  }
  const targetSupportsBoundary = targetSupportsDaoBoundary(targetSha);
  if (targetSupportsBoundary) return;
  const databaseUrl = readDatabaseUrlFromPm2();
  const shape = await inspectDaoBoundary(databaseUrl);
  const result = assessDaoRollbackCompatibility({ targetSupportsBoundary, ...shape });
  if (!result.allowed) {
    throw new Error(`FAIL-CLOSED: DAO rollback refused (${result.reason})`);
  }
}

async function main() {
  const targetSha = process.argv[2] ?? '';
  try {
    await assertDaoRollbackCompatibility(targetSha);
    console.log('VETS_DAO_ROLLBACK_COMPATIBLE=true');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'FAIL-CLOSED: DAO rollback compatibility check failed');
    process.exitCode = 70;
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
