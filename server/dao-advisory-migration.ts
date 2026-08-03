import mysql, { type RowDataPacket } from "mysql2/promise";

import {
  DAO_BINDING_DISABLED_REASON,
  DAO_LEGACY_PROPOSAL_DISABLED_REASON,
} from "./dao-governance-policy";

const LOCK_NAME = "hero_dao_advisory_boundary_v1";
const POLICY_TABLE = "dao_governance_policy";
const REQUIRED_POLICY_COLUMNS = [
  "governanceMode",
  "snapshotVersion",
  "bindingDisabledReason",
] as const;

export type DaoMigrationState = "not-configured" | "verified" | "installed";

export interface DaoMigrationStatus {
  state: DaoMigrationState;
  policyTableVerified: boolean;
  proposalPolicyColumnsVerified: boolean;
  checkedAt: string;
}

let migrationStatus: DaoMigrationStatus = {
  state: "not-configured",
  policyTableVerified: false,
  proposalPolicyColumnsVerified: false,
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
    .replace(/\bfalse\b/g, "0")
    .replace(/[()\s]/g, "");
}

function normalizeDefault(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
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
  if (!mode || !version || !reason) throw new Error("FAIL-CLOSED: DAO proposal policy columns are incomplete");
  if (
    String(mode.COLUMN_TYPE).toLowerCase() !== "enum('legacy','advisory','binding')"
    || mode.IS_NULLABLE !== "NO"
    || normalizeDefault(mode.COLUMN_DEFAULT) !== "legacy"
  ) {
    throw new Error("FAIL-CLOSED: governanceMode column does not match the legacy-safe contract");
  }
  if (
    !String(version.COLUMN_TYPE).toLowerCase().startsWith("int")
    || version.IS_NULLABLE !== "NO"
    || normalizeDefault(version.COLUMN_DEFAULT) !== "0"
  ) {
    throw new Error("FAIL-CLOSED: snapshotVersion column does not match the legacy-safe contract");
  }
  if (
    String(reason.COLUMN_TYPE).toLowerCase() !== "varchar(512)"
    || reason.IS_NULLABLE !== "NO"
    || normalizeDefault(reason.COLUMN_DEFAULT) !== DAO_LEGACY_PROPOSAL_DISABLED_REASON
  ) {
    throw new Error("FAIL-CLOSED: bindingDisabledReason column does not match the legacy-safe contract");
  }
}

async function verifyPolicyTable(connection: mysql.Connection): Promise<void> {
  const [constraintRows] = await connection.query<RowDataPacket[]>(
    `SELECT tc.CONSTRAINT_NAME, cc.CHECK_CLAUSE
       FROM information_schema.table_constraints tc
       JOIN information_schema.check_constraints cc
         ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
        AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
      WHERE tc.CONSTRAINT_SCHEMA = DATABASE()
        AND tc.TABLE_NAME = ?
        AND tc.CONSTRAINT_TYPE = 'CHECK'`,
    [POLICY_TABLE],
  );
  const clauses = new Map(
    constraintRows.map(row => [String(row.CONSTRAINT_NAME), normalizeCheckClause(row.CHECK_CLAUSE)]),
  );
  const singleton = clauses.get("chk_dao_policy_singleton") ?? "";
  const binding = clauses.get("chk_dao_binding_receipt") ?? "";
  if (!singleton.includes("id=1")) {
    throw new Error("FAIL-CLOSED: DAO singleton constraint is missing or changed");
  }
  for (const marker of [
    "binding_enabled=0",
    "governance_mode='advisory'",
    "snapshot_version=1",
  ]) {
    if (!binding.includes(marker)) {
      throw new Error(`FAIL-CLOSED: DAO binding receipt constraint missing: ${marker}`);
    }
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

    const before = await inspectShape(connection);
    const action = classifyDaoMigrationShape(before.tables, before.columns);
    if (action === "install") await installBoundary(connection);

    const after = await inspectShape(connection);
    if (after.tables !== 1 || after.columns !== REQUIRED_POLICY_COLUMNS.length) {
      throw new Error("FAIL-CLOSED: DAO policy schema did not reach the complete state");
    }
    await verifyProposalColumns(connection);
    await verifyPolicyTable(connection);

    migrationStatus = {
      state: action === "install" ? "installed" : "verified",
      policyTableVerified: true,
      proposalPolicyColumnsVerified: true,
      checkedAt: new Date().toISOString(),
    };
    console.info("[DAO Migration] advisory boundary verified", migrationStatus);
    return getDaoMigrationStatus();
  } finally {
    if (lockAcquired) await connection.query(`SELECT RELEASE_LOCK(?)`, [LOCK_NAME]).catch(() => undefined);
    await connection.end();
  }
}
