/**
 * HERO DAO — Migration Health Check & Deployment Safety
 * ======================================================
 * Verifies required database tables and environment configuration
 * exist before the app starts. Fails fast with clear error messages.
 *
 * ## Purpose
 * Prevents partial deployments where the app starts without required
 * DB tables or environment variables, which would cause silent failures
 * in rate limiting, audit logging, and timelock management.
 *
 * ## Usage
 * Call `runDaoStartupChecks(db)` at server startup, BEFORE registering
 * any DAO routes. If it returns `{ ok: false }`, the app should refuse
 * to start and log the specific failures.
 *
 * ## Required Tables
 * - `proposal_audit_log`: Rate limiting and audit trail
 * - `proposal_timelocks`: Timelock management for proposal execution
 *
 * ## Required Environment Variables
 * - `DAO_EXECUTOR_TYPE`: Must be set (eoa or gnosis_safe)
 * - `DAO_EXECUTOR_ADDRESS`: Must be a valid Ethereum address
 *
 * @module dao-migration-check
 * @see dao-rate-limiter.ts — depends on proposal_audit_log table
 * @see dao-executor-config.ts — validates executor environment
 */

import { createDaoLogger } from "./dao-logger";

const logger = createDaoLogger("dao-startup");

/** Tables required for DAO operations */
const REQUIRED_TABLES = [
  "proposal_audit_log",
  "proposal_timelocks",
] as const;

/** Environment variables required for DAO operations */
const REQUIRED_ENV_VARS = [
  "DAO_EXECUTOR_TYPE",
  "DAO_EXECUTOR_ADDRESS",
] as const;

/** Optional but recommended environment variables */
const RECOMMENDED_ENV_VARS = [
  "VITE_WALLETCONNECT_PROJECT_ID",
  "DAO_SAFE_OWNERS",
  "DAO_SAFE_THRESHOLD",
  "DAO_LOG_LEVEL",
] as const;

export interface StartupCheckResult {
  ok: boolean;
  tables: { name: string; exists: boolean }[];
  envVars: { name: string; set: boolean; required: boolean }[];
  errors: string[];
  warnings: string[];
}

/**
 * Verify that all required database tables exist.
 *
 * @param db - The Drizzle database instance
 * @returns Object with ok status and list of missing tables
 */
export async function verifyDaoMigrations(db: any): Promise<{
  ok: boolean;
  missing: string[];
}> {
  if (!db) {
    logger.error("Database connection unavailable during migration check");
    return { ok: false, missing: ["ALL — no DB connection"] };
  }

  const missing: string[] = [];

  for (const table of REQUIRED_TABLES) {
    try {
      const { sql } = await import("drizzle-orm");
      await db.execute(sql`SELECT 1 FROM ${sql.raw(table)} LIMIT 1`);
      logger.info(`Table verified: ${table}`);
    } catch (err: any) {
      const isTableMissing =
        err?.message?.includes("doesn't exist") ||
        err?.code === "ER_NO_SUCH_TABLE";
      if (isTableMissing) {
        missing.push(table);
        logger.error(`Missing required table: ${table}`);
      } else {
        logger.warn(`Table ${table} check had non-fatal error`, {
          error: err?.message,
        });
      }
    }
  }

  if (missing.length > 0) {
    logger.fatal("DAO migration check FAILED — run migrations before starting", {
      missing,
    });
    return { ok: false, missing };
  }

  logger.info("All DAO database migrations verified");
  return { ok: true, missing: [] };
}

/**
 * Verify that all required environment variables are set.
 *
 * @returns Object with lists of missing required and recommended vars
 */
export function verifyDaoEnvironment(): {
  errors: string[];
  warnings: string[];
  envStatus: { name: string; set: boolean; required: boolean }[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const envStatus: { name: string; set: boolean; required: boolean }[] = [];

  for (const varName of REQUIRED_ENV_VARS) {
    const isSet = Boolean(process.env[varName]);
    envStatus.push({ name: varName, set: isSet, required: true });
    if (!isSet) {
      errors.push(`Required environment variable ${varName} is not set`);
      logger.error(`Missing required env var: ${varName}`);
    }
  }

  for (const varName of RECOMMENDED_ENV_VARS) {
    const isSet = Boolean(process.env[varName]);
    envStatus.push({ name: varName, set: isSet, required: false });
    if (!isSet) {
      warnings.push(`Recommended environment variable ${varName} is not set`);
      logger.warn(`Missing recommended env var: ${varName}`);
    }
  }

  return { errors, warnings, envStatus };
}

/**
 * Run all DAO startup checks: migrations + environment + executor config.
 *
 * **Call this at server startup before registering DAO routes.**
 *
 * In production (`NODE_ENV=production`), this will throw if any required
 * check fails, preventing the app from starting in a broken state.
 *
 * In development, it logs warnings but allows startup to continue.
 *
 * @param db - The Drizzle database instance
 * @returns Full startup check result
 * @throws Error in production if any required check fails
 */
export async function runDaoStartupChecks(db: any): Promise<StartupCheckResult> {
  logger.info("Running DAO startup checks...");

  // Check migrations
  const migrationResult = await verifyDaoMigrations(db);

  // Check environment
  const envResult = verifyDaoEnvironment();

  // Check executor config
  let executorErrors: string[] = [];
  let executorWarnings: string[] = [];
  try {
    const { validateExecutorConfig } = await import("./dao-executor-config");
    const execResult = validateExecutorConfig();
    executorErrors = execResult.errors;
    executorWarnings = execResult.warnings;
  } catch (err: any) {
    executorErrors.push(`Executor config validation failed: ${err?.message}`);
  }

  const allErrors = [
    ...migrationResult.missing.map((t: string) => `Missing table: ${t}`),
    ...envResult.errors,
    ...executorErrors,
  ];

  const allWarnings = [...envResult.warnings, ...executorWarnings];

  const result: StartupCheckResult = {
    ok: allErrors.length === 0,
    tables: REQUIRED_TABLES.map((t) => ({
      name: t,
      exists: !migrationResult.missing.includes(t),
    })),
    envVars: envResult.envStatus,
    errors: allErrors,
    warnings: allWarnings,
  };

  if (result.ok) {
    logger.info("All DAO startup checks PASSED", {
      tables: result.tables.length,
      warnings: allWarnings.length,
    });
  } else {
    logger.fatal("DAO startup checks FAILED", {
      errors: allErrors,
      warnings: allWarnings,
    });

    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `DAO startup checks failed:\n${allErrors.join("\n")}`
      );
    }
  }

  for (const w of allWarnings) {
    logger.warn(w);
  }

  return result;
}
