#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const DAO_ROLLBACK_CONTRACT_VERSION = 2;
const REQUIRED_TARGET_VERSION = 2;
const POLICY_TABLE = 'dao_governance_policy';
const WALLET_UNIQUE_INDEX = 'ux_users_wallet_address';
const BINDING_DISABLED_REASON = 'Binding governance is disabled until verified wallet ownership, finalized historical checkpoints, and an audited execution contract are available.';
const LEGACY_DISABLED_REASON = 'This legacy proposal is frozen because it predates the advisory policy receipt and may contain token-weighted or on-chain-anchored state.';

export function canonicalizeCheckClause(value) {
  const source = String(value ?? '')
    .toLowerCase()
    .replaceAll('`', '')
    .replace(/_[a-z0-9]+(?=')/g, '')
    .replace(/\bfalse\b/g, '0');
  const normalized = source.replace(/[()\s]/g, '');
  if (!normalized || /\bor\b/.test(source) || /\bnot\b/.test(source)) return normalized;
  return normalized.split('and').sort().join('and');
}

export function assessDaoRollbackCompatibility({
  targetBoundaryVersion,
  boundaryInstalled,
  boundaryIntegrityValid,
}) {
  if (!boundaryInstalled) return { allowed: true, reason: 'boundary-not-installed' };
  if (!boundaryIntegrityValid) return { allowed: false, reason: 'current-boundary-invariants-failed' };
  if (targetBoundaryVersion < REQUIRED_TARGET_VERSION) {
    return { allowed: false, reason: 'target-lacks-current-boundary-contract' };
  }
  return { allowed: true, reason: 'target-and-database-preserve-boundary-v2' };
}

function readGitFile(targetSha, path) {
  return execFileSync('git', ['show', `${targetSha}:${path}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

export function targetDaoBoundaryVersion(targetSha) {
  try {
    const source = readGitFile(targetSha, 'server/dao-advisory-migration.ts');
    const match = source.match(/export const DAO_ROLLBACK_CONTRACT_VERSION\s*=\s*(\d+)\s*;/);
    return match ? Number(match[1]) : 0;
  } catch {
    return 0;
  }
}

export function targetSupportsDaoBoundary(targetSha) {
  return targetDaoBoundaryVersion(targetSha) >= REQUIRED_TARGET_VERSION;
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

function normalizeDefault(value) {
  if (value === null || value === undefined) return null;
  return String(value).toLowerCase().replace(/^'(.*)'$/, '$1').replace(/[()]/g, '');
}

function normalizeExtra(value) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function intType(value) {
  return /^int(?:\(\d+\))?$/.test(String(value).toLowerCase());
}

function exactProposalColumns(rows) {
  const byName = new Map(rows.map(row => [String(row.COLUMN_NAME), row]));
  const mode = byName.get('governanceMode');
  const version = byName.get('snapshotVersion');
  const reason = byName.get('bindingDisabledReason');
  return rows.length === 3
    && mode
    && String(mode.COLUMN_TYPE).toLowerCase() === "enum('legacy','advisory','binding')"
    && mode.IS_NULLABLE === 'NO'
    && normalizeDefault(mode.COLUMN_DEFAULT) === 'legacy'
    && version
    && intType(version.COLUMN_TYPE)
    && version.IS_NULLABLE === 'NO'
    && normalizeDefault(version.COLUMN_DEFAULT) === '0'
    && reason
    && String(reason.COLUMN_TYPE).toLowerCase() === 'varchar(512)'
    && reason.IS_NULLABLE === 'NO'
    && normalizeDefault(reason.COLUMN_DEFAULT) === LEGACY_DISABLED_REASON.toLowerCase();
}

function exactPolicyColumns(rows) {
  const expected = ['id', 'governance_mode', 'snapshot_version', 'binding_enabled', 'disabled_reason', 'created_at', 'updated_at'];
  if (JSON.stringify(rows.map(row => String(row.COLUMN_NAME))) !== JSON.stringify(expected)) return false;
  const byName = new Map(rows.map(row => [String(row.COLUMN_NAME), row]));
  const id = byName.get('id');
  const mode = byName.get('governance_mode');
  const version = byName.get('snapshot_version');
  const enabled = byName.get('binding_enabled');
  const reason = byName.get('disabled_reason');
  const created = byName.get('created_at');
  const updated = byName.get('updated_at');
  return id && intType(id.COLUMN_TYPE) && id.IS_NULLABLE === 'NO' && id.COLUMN_KEY === 'PRI' && id.COLUMN_DEFAULT === null
    && mode && String(mode.COLUMN_TYPE).toLowerCase() === "enum('advisory','binding')" && mode.IS_NULLABLE === 'NO' && normalizeDefault(mode.COLUMN_DEFAULT) === 'advisory'
    && version && intType(version.COLUMN_TYPE) && version.IS_NULLABLE === 'NO' && normalizeDefault(version.COLUMN_DEFAULT) === '1'
    && enabled && String(enabled.COLUMN_TYPE).toLowerCase() === 'tinyint(1)' && enabled.IS_NULLABLE === 'NO' && ['0', "b'0'"].includes(normalizeDefault(enabled.COLUMN_DEFAULT) ?? '')
    && reason && String(reason.COLUMN_TYPE).toLowerCase() === 'varchar(512)' && reason.IS_NULLABLE === 'NO' && reason.COLUMN_DEFAULT === null
    && created && String(created.COLUMN_TYPE).toLowerCase() === 'timestamp' && created.IS_NULLABLE === 'NO' && normalizeDefault(created.COLUMN_DEFAULT) === 'current_timestamp' && normalizeExtra(created.EXTRA).replace('default_generated', '').trim() === ''
    && updated && String(updated.COLUMN_TYPE).toLowerCase() === 'timestamp' && updated.IS_NULLABLE === 'NO' && normalizeDefault(updated.COLUMN_DEFAULT) === 'current_timestamp' && normalizeExtra(updated.EXTRA).replace('default_generated', '').trim() === 'on update current_timestamp';
}

async function inspectDaoBoundary(databaseUrl) {
  const mysql = await import('mysql2/promise');
  const connection = await mysql.createConnection(databaseUrl);
  try {
    const [tableRows] = await connection.query(
      `SELECT COUNT(*) AS count
         FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = ?`,
      [POLICY_TABLE],
    );
    const [proposalColumnRows] = await connection.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
         FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'proposals'
          AND column_name IN ('governanceMode', 'snapshotVersion', 'bindingDisabledReason')`,
    );
    const policyTableCount = Number(tableRows[0]?.count ?? 0);
    const proposalPolicyColumnCount = proposalColumnRows.length;
    if (policyTableCount === 0 && proposalPolicyColumnCount === 0) {
      return { boundaryInstalled: false, boundaryIntegrityValid: true };
    }
    if (policyTableCount !== 1 || proposalPolicyColumnCount !== 3 || !exactProposalColumns(proposalColumnRows)) {
      return { boundaryInstalled: true, boundaryIntegrityValid: false };
    }

    const [policyColumns] = await connection.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA
         FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ?
        ORDER BY ORDINAL_POSITION`,
      [POLICY_TABLE],
    );
    if (!exactPolicyColumns(policyColumns)) {
      return { boundaryInstalled: true, boundaryIntegrityValid: false };
    }

    const [constraintRows] = await connection.query(
      `SELECT tc.CONSTRAINT_NAME, tc.ENFORCED, cc.CHECK_CLAUSE
         FROM information_schema.table_constraints tc
         JOIN information_schema.check_constraints cc
           ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
          AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
        WHERE tc.CONSTRAINT_SCHEMA = DATABASE()
          AND tc.TABLE_NAME = ?
          AND tc.CONSTRAINT_TYPE = 'CHECK'`,
      [POLICY_TABLE],
    );
    const constraints = new Map(constraintRows.map(row => [String(row.CONSTRAINT_NAME), row]));
    const singleton = constraints.get('chk_dao_policy_singleton');
    const binding = constraints.get('chk_dao_binding_receipt');
    if (
      constraints.size !== 2
      || String(singleton?.ENFORCED ?? '').toUpperCase() !== 'YES'
      || canonicalizeCheckClause(singleton?.CHECK_CLAUSE) !== canonicalizeCheckClause('id = 1')
      || String(binding?.ENFORCED ?? '').toUpperCase() !== 'YES'
      || canonicalizeCheckClause(binding?.CHECK_CLAUSE) !== canonicalizeCheckClause("binding_enabled = FALSE AND governance_mode = 'advisory' AND snapshot_version = 1")
    ) {
      return { boundaryInstalled: true, boundaryIntegrityValid: false };
    }

    const [receiptRows] = await connection.query(
      `SELECT id, governance_mode, snapshot_version, binding_enabled, disabled_reason FROM ${POLICY_TABLE}`,
    );
    const receipt = receiptRows[0];
    if (
      receiptRows.length !== 1
      || Number(receipt.id) !== 1
      || receipt.governance_mode !== 'advisory'
      || Number(receipt.snapshot_version) !== 1
      || Number(receipt.binding_enabled) !== 0
      || receipt.disabled_reason !== BINDING_DISABLED_REASON
    ) {
      return { boundaryInstalled: true, boundaryIntegrityValid: false };
    }

    const [historyRows] = await connection.query(
      `SELECT COUNT(*) AS unsafe_count
         FROM proposals AS proposal
         CROSS JOIN ${POLICY_TABLE} AS policy
        WHERE policy.id = 1
          AND (
            proposal.governanceMode = 'binding'
            OR (proposal.createdAt < policy.created_at AND proposal.governanceMode <> 'legacy')
            OR (proposal.governanceMode = 'legacy' AND (
                 proposal.snapshotVersion <> 0
                 OR proposal.bindingDisabledReason <> ?
               ))
            OR (proposal.governanceMode = 'advisory' AND (
                 proposal.snapshotVersion <> 1
                 OR proposal.bindingDisabledReason <> ?
                 OR proposal.quorum <> 1
                 OR proposal.status IN ('queued', 'executed')
                 OR (
                   proposal.status IN ('passed', 'defeated')
                   AND (
                     proposal.endTime > CURRENT_TIMESTAMP(3)
                     OR (
                       proposal.status = 'passed'
                       AND NOT (
                         proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain >= proposal.quorum
                         AND proposal.votesFor > proposal.votesAgainst
                       )
                     )
                     OR (
                       proposal.status = 'defeated'
                       AND proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain >= proposal.quorum
                       AND proposal.votesFor > proposal.votesAgainst
                     )
                   )
                 )
               ))
          )`,
      [LEGACY_DISABLED_REASON, BINDING_DISABLED_REASON],
    );
    if (Number(historyRows[0]?.unsafe_count ?? 0) !== 0) {
      return { boundaryInstalled: true, boundaryIntegrityValid: false };
    }

    const [walletColumnRows] = await connection.query(
      `SELECT COLUMN_TYPE, IS_NULLABLE
         FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'users'
          AND column_name = 'walletAddress'`,
    );
    const [walletIndexRows] = await connection.query(
      `SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE
         FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'users'
          AND index_name = ?
        ORDER BY SEQ_IN_INDEX`,
      [WALLET_UNIQUE_INDEX],
    );
    const [duplicateRows] = await connection.query(
      `SELECT LOWER(walletAddress) AS normalized_wallet, COUNT(*) AS duplicate_count
         FROM users
        WHERE walletAddress IS NOT NULL
        GROUP BY LOWER(walletAddress)
       HAVING COUNT(*) > 1
        LIMIT 1`,
    );
    if (
      walletColumnRows.length !== 1
      || String(walletColumnRows[0].COLUMN_TYPE).toLowerCase() !== 'varchar(42)'
      || walletColumnRows[0].IS_NULLABLE !== 'YES'
      || walletIndexRows.length !== 1
      || walletIndexRows[0].INDEX_NAME !== WALLET_UNIQUE_INDEX
      || walletIndexRows[0].COLUMN_NAME !== 'walletAddress'
      || Number(walletIndexRows[0].SEQ_IN_INDEX) !== 1
      || Number(walletIndexRows[0].NON_UNIQUE) !== 0
      || duplicateRows.length !== 0
    ) {
      return { boundaryInstalled: true, boundaryIntegrityValid: false };
    }

    return { boundaryInstalled: true, boundaryIntegrityValid: true };
  } finally {
    await connection.end();
  }
}

export async function assertDaoRollbackCompatibility(targetSha) {
  if (!/^[0-9a-f]{40}$/.test(targetSha)) {
    throw new Error('rollback target SHA is invalid');
  }
  const databaseUrl = readDatabaseUrlFromPm2();
  const shape = await inspectDaoBoundary(databaseUrl);
  const targetBoundaryVersion = targetDaoBoundaryVersion(targetSha);
  const result = assessDaoRollbackCompatibility({ targetBoundaryVersion, ...shape });
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
