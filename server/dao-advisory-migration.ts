import mysql, { type RowDataPacket } from "mysql2/promise";

import {
  DAO_ADVISORY_QUORUM,
  DAO_BINDING_DISABLED_REASON,
  DAO_LEGACY_PROPOSAL_DISABLED_REASON,
} from "./dao-governance-policy";

const LOCK_NAME = "hero_dao_advisory_boundary_v1";
const POLICY_TABLE = "dao_governance_policy";
const WALLET_UNIQUE_INDEX = "ux_users_wallet_address";
const REQUIRED_POLICY_COLUMNS = [
  "governanceMode",
  "snapshotVersion",
  "bindingDisabledReason",
] as const;
const EXPECTED_POLICY_TABLE_COLUMNS = [
  "id",
  "governance_mode",
  "snapshot_version",
  "binding_enabled",
  "disabled_reason",
  "created_at",
  "updated_at",
] as const;

export const DAO_ROLLBACK_CONTRACT_VERSION = 2;
export type DaoMigrationState = "not-configured" | "verified" | "installed";

export interface DaoMigrationStatus {
  state: DaoMigrationState;
  policyTableVerified: boolean;
  proposalPolicyColumnsVerified: boolean;
  proposalPolicyHistoryVerified: boolean;
  walletBindingUniqueVerified: boolean;
  checkedAt: string;
}

let migrationStatus: DaoMigrationStatus = {
  state: "not-configured",
  policyTableVerified: false,
  proposalPolicyColumnsVerified: false,
  proposalPolicyHistoryVerified: false,
  walletBindingUniqueVerified: false,
  checkedAt: new Date(0).toISOString(),
};

export function getDaoMigrationStatus(): DaoMigrationStatus {
  return { ...migrationStatus };
}

export function classifyDaoMigrationShape(policyTableCount: number, policyColumnCount: number): "install" | "verify" {
  if (policyTableCount === 0 && policyColumnCount === 0) return "install";
  if (policyTableCount === 1 && policyColumnCount === REQUIRED_POLICY_COLUMNS.length) return "verify";
  throw new Error(
    `FAIL-CLOSED: partial DAO policy schema detected (tables=${policyTableCount}, columns=${policyColumnCount})`,
  );
}

export function normalizeCheckClause(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("`", "")
    .replace(/_[a-z0-9]+(?=')/g, "")
    .replace(/\bfalse\b/g, "0")
    .replace(/[()\s]/g, "");
}

export function canonicalizeCheckClause(value: unknown): string {
  const source = String(value ?? "")
    .toLowerCase()
    .replaceAll("`", "")
    .replace(/_[a-z0-9]+(?=')/g, "")
    .replace(/\bfalse\b/g, "0");
  const normalized = source.replace(/[()\s]/g, "");
  if (!normalized || /\bor\b/.test(source) || /\bnot\b/.test(source)) return normalized;
  return normalized.split("and").sort().join("and");
}

export function isConstraintEnforced(value: unknown): boolean {
  return String(value ?? "").toUpperCase() === "YES";
}

export function isAdvisoryPolicyStatusAllowed(value: unknown): boolean {
  return ["pending", "active", "passed", "defeated", "cancelled"].includes(String(value));
}

export function isWalletUniqueIndexShapeValid(rows: ReadonlyArray<Record<string, unknown>>): boolean {
  return rows.length === 1
    && rows[0].INDEX_NAME === WALLET_UNIQUE_INDEX
    && rows[0].COLUMN_NAME === "walletAddress"
    && Number(rows[0].SEQ_IN_INDEX) === 1
    && Number(rows[0].NON_UNIQUE) === 0;
}

function normalizeDefault(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value).toLowerCase().replace(/^'(.*)'$/, "$1").replace(/[()]/g, "");
}

function normalizeExtra(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function isIntType(value: unknown): boolean {
  return /^int(?:\(\d+\))?$/.test(String(value).toLowerCase());
}

async function verifyProposalColumns(connection: mysql.Connection): Promise<void> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'proposals'
        AND column_name IN ('governanceMode', 'snapshotVersion', 'bindingDisabledReason')`,
  );
  const byName = new Map(rows.map(row => [String(row.COLUMN_NAME), row]));
  const mode = byName.get("governanceMode");
  const version = byName.get("snapshotVersion");
  const reason = byName.get("bindingDisabledReason");
  if (!mode || !version || !reason || rows.length !== REQUIRED_POLICY_COLUMNS.length) {
    throw new Error("FAIL-CLOSED: DAO proposal policy columns are incomplete or duplicated");
  }
  if (
    String(mode.COLUMN_TYPE).toLowerCase() !== "enum('legacy','advisory','binding')"
    || mode.IS_NULLABLE !== "NO"
    || normalizeDefault(mode.COLUMN_DEFAULT) !== "legacy"
  ) {
    throw new Error("FAIL-CLOSED: governanceMode column does not match the legacy-safe contract");
  }
  if (
    !isIntType(version.COLUMN_TYPE)
    || version.IS_NULLABLE !== "NO"
    || normalizeDefault(version.COLUMN_DEFAULT) !== "0"
  ) {
    throw new Error("FAIL-CLOSED: snapshotVersion column does not match the legacy-safe contract");
  }
  if (
    String(reason.COLUMN_TYPE).toLowerCase() !== "varchar(512)"
    || reason.IS_NULLABLE !== "NO"
    || normalizeDefault(reason.COLUMN_DEFAULT) !== DAO_LEGACY_PROPOSAL_DISABLED_REASON.toLowerCase()
  ) {
    throw new Error("FAIL-CLOSED: bindingDisabledReason column does not match the legacy-safe contract");
  }
}

async function verifyPolicyTableColumns(connection: mysql.Connection): Promise<void> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA
       FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ?
      ORDER BY ORDINAL_POSITION`,
    [POLICY_TABLE],
  );
  const names = rows.map(row => String(row.COLUMN_NAME));
  if (JSON.stringify(names) !== JSON.stringify(EXPECTED_POLICY_TABLE_COLUMNS)) {
    throw new Error(`FAIL-CLOSED: DAO policy table columns differ: ${JSON.stringify(names)}`);
  }
  const byName = new Map(rows.map(row => [String(row.COLUMN_NAME), row]));
  const id = byName.get("id")!;
  const mode = byName.get("governance_mode")!;
  const version = byName.get("snapshot_version")!;
  const enabled = byName.get("binding_enabled")!;
  const reason = byName.get("disabled_reason")!;
  const created = byName.get("created_at")!;
  const updated = byName.get("updated_at")!;

  if (!isIntType(id.COLUMN_TYPE) || id.IS_NULLABLE !== "NO" || id.COLUMN_KEY !== "PRI" || id.COLUMN_DEFAULT !== null) {
    throw new Error("FAIL-CLOSED: DAO policy id column differs from the contract");
  }
  if (
    String(mode.COLUMN_TYPE).toLowerCase() !== "enum('advisory','binding')"
    || mode.IS_NULLABLE !== "NO"
    || normalizeDefault(mode.COLUMN_DEFAULT) !== "advisory"
  ) {
    throw new Error("FAIL-CLOSED: DAO governance_mode column differs from the contract");
  }
  if (!isIntType(version.COLUMN_TYPE) || version.IS_NULLABLE !== "NO" || normalizeDefault(version.COLUMN_DEFAULT) !== "1") {
    throw new Error("FAIL-CLOSED: DAO snapshot_version column differs from the contract");
  }
  if (
    String(enabled.COLUMN_TYPE).toLowerCase() !== "tinyint(1)"
    || enabled.IS_NULLABLE !== "NO"
    || !["0", "b'0'"].includes(normalizeDefault(enabled.COLUMN_DEFAULT) ?? "")
  ) {
    throw new Error("FAIL-CLOSED: DAO binding_enabled column differs from the contract");
  }
  if (String(reason.COLUMN_TYPE).toLowerCase() !== "varchar(512)" || reason.IS_NULLABLE !== "NO" || reason.COLUMN_DEFAULT !== null) {
    throw new Error("FAIL-CLOSED: DAO disabled_reason column differs from the contract");
  }
  if (
    String(created.COLUMN_TYPE).toLowerCase() !== "timestamp"
    || created.IS_NULLABLE !== "NO"
    || normalizeDefault(created.COLUMN_DEFAULT) !== "current_timestamp"
    || normalizeExtra(created.EXTRA).replace("default_generated", "").trim() !== ""
  ) {
    throw new Error("FAIL-CLOSED: DAO created_at column differs from the contract");
  }
  const updatedExtra = normalizeExtra(updated.EXTRA).replace("default_generated", "").trim();
  if (
    String(updated.COLUMN_TYPE).toLowerCase() !== "timestamp"
    || updated.IS_NULLABLE !== "NO"
    || normalizeDefault(updated.COLUMN_DEFAULT) !== "current_timestamp"
    || updatedExtra !== "on update current_timestamp"
  ) {
    throw new Error("FAIL-CLOSED: DAO updated_at column differs from the contract");
  }

  const [primaryRows] = await connection.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE
       FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = ? AND index_name = 'PRIMARY'
      ORDER BY SEQ_IN_INDEX`,
    [POLICY_TABLE],
  );
  if (
    primaryRows.length !== 1
    || primaryRows[0].COLUMN_NAME !== "id"
    || Number(primaryRows[0].SEQ_IN_INDEX) !== 1
    || Number(primaryRows[0].NON_UNIQUE) !== 0
  ) {
    throw new Error("FAIL-CLOSED: DAO policy primary key differs from the contract");
  }
}

async function verifyPolicyTable(connection: mysql.Connection): Promise<void> {
  await verifyPolicyTableColumns(connection);
  const [constraintRows] = await connection.query<RowDataPacket[]>(
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
  const constraints = new Map(
    constraintRows.map(row => [String(row.CONSTRAINT_NAME), {
      clause: canonicalizeCheckClause(row.CHECK_CLAUSE),
      enforced: isConstraintEnforced(row.ENFORCED),
    }]),
  );
  const expectedSingleton = canonicalizeCheckClause("id = 1");
  const expectedBinding = canonicalizeCheckClause(
    "binding_enabled = FALSE AND governance_mode = 'advisory' AND snapshot_version = 1",
  );
  const singleton = constraints.get("chk_dao_policy_singleton");
  if (
    constraints.size !== 2
    || !singleton?.enforced
    || singleton.clause !== expectedSingleton
  ) {
    throw new Error("FAIL-CLOSED: enforced DAO singleton check expression is missing or changed");
  }
  const binding = constraints.get("chk_dao_binding_receipt");
  if (!binding?.enforced || binding.clause !== expectedBinding) {
    throw new Error("FAIL-CLOSED: enforced DAO binding receipt check expression is missing or changed");
  }

  const [receiptRows] = await connection.query<RowDataPacket[]>(
    `SELECT id, governance_mode, snapshot_version, binding_enabled, disabled_reason
       FROM ${POLICY_TABLE}`,
  );
  if (receiptRows.length !== 1) throw new Error("FAIL-CLOSED: DAO policy receipt is not a singleton");
  const receipt = receiptRows[0];
  if (
    Number(receipt.id) !== 1
    || receipt.governance_mode !== "advisory"
    || Number(receipt.snapshot_version) !== 1
    || Number(receipt.binding_enabled) !== 0
    || receipt.disabled_reason !== DAO_BINDING_DISABLED_REASON
  ) {
    throw new Error("FAIL-CLOSED: DAO policy receipt contents are unsafe");
  }
}

async function verifyProposalPolicyHistory(connection: mysql.Connection): Promise<void> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS unsafe_count
       FROM proposals AS proposal
       CROSS JOIN ${POLICY_TABLE} AS policy
      WHERE policy.id = 1
        AND (
          proposal.governanceMode = 'binding'
          OR (
            proposal.createdAt < policy.created_at
            AND proposal.governanceMode <> 'legacy'
          )
          OR (proposal.governanceMode = 'legacy' AND (
               proposal.snapshotVersion <> 0
               OR proposal.bindingDisabledReason <> ?
             ))
          OR (proposal.governanceMode = 'advisory' AND (
               proposal.snapshotVersion <> 1
               OR proposal.bindingDisabledReason <> ?
               OR proposal.quorum <> ?
               OR proposal.status IN ('queued', 'executed')
             ))
        )`,
    [DAO_LEGACY_PROPOSAL_DISABLED_REASON, DAO_BINDING_DISABLED_REASON, DAO_ADVISORY_QUORUM],
  );
  if (Number(rows[0]?.unsafe_count ?? 0) !== 0) {
    throw new Error("FAIL-CLOSED: proposal governance policy history is inconsistent");
  }
}

async function ensureWalletBindingUniqueness(connection: mysql.Connection): Promise<void> {
  const [columnRows] = await connection.query<RowDataPacket[]>(
    `SELECT COLUMN_TYPE, IS_NULLABLE
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'users'
        AND column_name = 'walletAddress'`,
  );
  if (
    columnRows.length !== 1
    || String(columnRows[0].COLUMN_TYPE).toLowerCase() !== "varchar(42)"
    || columnRows[0].IS_NULLABLE !== "YES"
  ) {
    throw new Error("FAIL-CLOSED: users.walletAddress does not match the binding contract");
  }

  const [duplicates] = await connection.query<RowDataPacket[]>(
    `SELECT LOWER(walletAddress) AS normalized_wallet, COUNT(*) AS duplicate_count
       FROM users
      WHERE walletAddress IS NOT NULL
      GROUP BY LOWER(walletAddress)
     HAVING COUNT(*) > 1
      LIMIT 1`,
  );
  if (duplicates.length > 0) {
    throw new Error("FAIL-CLOSED: duplicate bound wallet addresses require manual reconciliation");
  }

  const readIndex = () => connection.query<RowDataPacket[]>(
    `SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE
       FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'users'
        AND index_name = ?
      ORDER BY SEQ_IN_INDEX`,
    [WALLET_UNIQUE_INDEX],
  );
  let [indexRows] = await readIndex();
  if (indexRows.length === 0) {
    await connection.query(`UPDATE users SET walletAddress = LOWER(walletAddress) WHERE walletAddress IS NOT NULL`);
    await connection.query(`ALTER TABLE users ADD UNIQUE INDEX ${WALLET_UNIQUE_INDEX} (walletAddress)`);
    [indexRows] = await readIndex();
  }
  if (!isWalletUniqueIndexShapeValid(indexRows)) {
    throw new Error("FAIL-CLOSED: bound-wallet uniqueness index is missing or drifted");
  }
}

async function inspectShape(connection: mysql.Connection): Promise<{ tables: number; columns: number }> {
  const [tableRows] = await connection.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count
       FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?`,
    [POLICY_TABLE],
  );
  const [columnRows] = await connection.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'proposals'
        AND column_name IN ('governanceMode', 'snapshotVersion', 'bindingDisabledReason')`,
  );
  return {
    tables: Number(tableRows[0]?.count ?? 0),
    columns: Number(columnRows[0]?.count ?? 0),
  };
}

async function installBoundary(connection: mysql.Connection): Promise<void> {
  await connection.query(`
    ALTER TABLE proposals
      ADD COLUMN governanceMode ENUM('legacy', 'advisory', 'binding') NOT NULL DEFAULT 'legacy',
      ADD COLUMN snapshotVersion INT NOT NULL DEFAULT 0,
      ADD COLUMN bindingDisabledReason VARCHAR(512) NOT NULL DEFAULT ?
  `, [DAO_LEGACY_PROPOSAL_DISABLED_REASON]);

  await connection.query(`
    CREATE TABLE ${POLICY_TABLE} (
      id INT NOT NULL PRIMARY KEY,
      governance_mode ENUM('advisory', 'binding') NOT NULL DEFAULT 'advisory',
      snapshot_version INT NOT NULL DEFAULT 1,
      binding_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      disabled_reason VARCHAR(512) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT chk_dao_policy_singleton CHECK (id = 1),
      CONSTRAINT chk_dao_binding_receipt CHECK (
        binding_enabled = FALSE
        AND governance_mode = 'advisory'
        AND snapshot_version = 1
      )
    )
  `);
  await connection.query(
    `INSERT INTO ${POLICY_TABLE}
      (id, governance_mode, snapshot_version, binding_enabled, disabled_reason)
     VALUES (1, 'advisory', 1, FALSE, ?)`,
    [DAO_BINDING_DISABLED_REASON],
  );
}

export async function ensureDaoAdvisoryBoundary(): Promise<DaoMigrationStatus> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FAIL-CLOSED: DATABASE_URL is required for the production DAO policy boundary");
    }
    migrationStatus = {
      state: "not-configured",
      policyTableVerified: false,
      proposalPolicyColumnsVerified: false,
      proposalPolicyHistoryVerified: false,
      walletBindingUniqueVerified: false,
      checkedAt: new Date().toISOString(),
    };
    return getDaoMigrationStatus();
  }

  const connection = await mysql.createConnection(databaseUrl);
  let lockAcquired = false;
  try {
    const [lockRows] = await connection.query<RowDataPacket[]>(`SELECT GET_LOCK(?, 60) AS acquired`, [LOCK_NAME]);
    lockAcquired = Number(lockRows[0]?.acquired ?? 0) === 1;
    if (!lockAcquired) throw new Error("FAIL-CLOSED: could not acquire DAO migration writer lock");

    await ensureWalletBindingUniqueness(connection);
    const before = await inspectShape(connection);
    const action = classifyDaoMigrationShape(before.tables, before.columns);
    if (action === "install") await installBoundary(connection);

    const after = await inspectShape(connection);
    if (after.tables !== 1 || after.columns !== REQUIRED_POLICY_COLUMNS.length) {
      throw new Error("FAIL-CLOSED: DAO policy schema did not reach the complete state");
    }
    await verifyProposalColumns(connection);
    await verifyPolicyTable(connection);
    await verifyProposalPolicyHistory(connection);
    await ensureWalletBindingUniqueness(connection);

    migrationStatus = {
      state: action === "install" ? "installed" : "verified",
      policyTableVerified: true,
      proposalPolicyColumnsVerified: true,
      proposalPolicyHistoryVerified: true,
      walletBindingUniqueVerified: true,
      checkedAt: new Date().toISOString(),
    };
    console.info("[DAO Migration] advisory boundary verified", migrationStatus);
    return getDaoMigrationStatus();
  } finally {
    if (lockAcquired) await connection.query(`SELECT RELEASE_LOCK(?)`, [LOCK_NAME]).catch(() => undefined);
    await connection.end();
  }
}
