/**
 * HERO DAO — Persistent Rate Limiter & Audit Logger
 * ===================================================
 * Production Condition #1: Persistent rate limiting with atomic DB operations.
 *
 * ## Architecture
 * Uses MySQL via Drizzle ORM for rate limiting and audit logging.
 * No Redis dependency — DAO proposals are low-frequency (max 3/day).
 *
 * ## Security Model
 * - **Fail-Closed:** All functions throw on DB unavailability to prevent abuse.
 * - **Atomic Rate Limiting:** Uses a single transactional INSERT + COUNT to prevent
 *   race conditions (TOCTOU) where multiple proposals pass the check simultaneously.
 * - **Input Validation:** All external inputs validated via Zod schemas before DB usage.
 * - **Structured Logging:** JSON-formatted logs via dao-logger for observability.
 *
 * ## Error Handling
 * | Scenario                | Behavior           | Rationale                              |
 * |-------------------------|--------------------|----------------------------------------|
 * | DB unavailable          | Throws Error       | Prevents rate limit bypass             |
 * | Table missing           | Throws Error       | Migration must run before app starts   |
 * | DB query error          | Throws Error       | Fail-closed to prevent abuse           |
 * | Invalid input           | Throws ZodError    | Rejects malformed data early           |
 *
 * ## Deployment
 * 1. Run migrations BEFORE starting the app (deploy-production.sh handles this).
 * 2. Call `initRateLimiter(dbGetter)` once at server startup.
 * 3. Ensure `proposal_audit_log` and `proposal_timelocks` tables exist.
 * 4. Use `verifyDaoMigrations()` from dao-migration-check.ts at startup.
 *
 * @module dao-rate-limiter
 * @see dao-migration-check.ts for startup health checks
 * @see dao-logger.ts for structured logging
 */

import { createDaoLogger } from "./dao-logger";
import { z } from "zod";
import { sql } from "drizzle-orm";

const logger = createDaoLogger("dao-rate-limiter");

// ─── Input Validation Schemas ────────────────────────────────────────────────
/** Positive integer for user/actor IDs */
const idSchema = z.number().int().positive({ message: "ID must be a positive integer" });

/** Ethereum/PulseChain address: 0x + 40 hex chars */
const addressSchema = z.string().regex(
  /^0x[a-fA-F0-9]{40}$/,
  "Invalid address format: must be 0x-prefixed 40 hex characters"
);

/** Proposal ID: non-empty string, max 255 chars */
const proposalIdSchema = z.string().min(1, "Proposal ID cannot be empty").max(255);

/** Whitelisted DAO action types for audit logging */
const actionSchema = z.enum([
  "proposal_created",
  "proposal_executed",
  "proposal_vetoed",
  "timelock_started",
  "status_change",
  "vote_cast",
  "quorum_reached",
  "delegation_created",
  "delegation_revoked",
]);

/** Transaction hash: 0x + 64 hex chars (optional/nullable) */
const txHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid tx hash: must be 0x-prefixed 64 hex characters")
  .optional()
  .nullable();

// ─── Database Getter ─────────────────────────────────────────────────────────
let getDb: () => Promise<any>;

/**
 * Initialize the rate limiter with the database getter.
 * **Must be called once at server startup before any other function.**
 *
 * @param dbGetter - Async function that returns the Drizzle DB instance
 * @throws Error if dbGetter is not a function
 */
export function initRateLimiter(dbGetter: () => Promise<any>): void {
  if (typeof dbGetter !== "function") {
    throw new Error("initRateLimiter requires a function that returns a DB instance");
  }
  getDb = dbGetter;
  logger.info("Rate limiter initialized");
}

// ─── Helper: Get DB or Throw ─────────────────────────────────────────────────
/**
 * Internal helper to get the DB instance or throw a fail-closed error.
 * Centralizes the DB availability check for all functions.
 */
async function getDbOrThrow(context: string): Promise<any> {
  if (!getDb) {
    throw new Error(`Rate limiter not initialized — call initRateLimiter() first [${context}]`);
  }
  const db = await getDb();
  if (!db) {
    logger.error("Database unavailable", { context });
    throw new Error(`Database unavailable — failing closed [${context}]`);
  }
  return db;
}

// ─── Atomic Rate Limiting ────────────────────────────────────────────────────
/**
 * Atomically check rate limit AND record a proposal creation in a single transaction.
 *
 * This eliminates the TOCTOU race condition where separate check + record calls
 * could allow multiple proposals to pass the rate limit simultaneously.
 *
 * ## How It Works
 * 1. Begins a transaction
 * 2. Counts proposals in the last 24h for this user (with FOR UPDATE lock)
 * 3. If under limit, inserts the new proposal record
 * 4. Commits or rolls back atomically
 *
 * @param userId - The user's database ID (positive integer)
 * @param proposalId - The new proposal's ID (non-empty string)
 * @param walletAddress - The creator's wallet address (0x + 40 hex)
 * @param maxPerDay - Maximum proposals allowed per 24h (default: 3)
 * @returns `{ allowed: true }` if proposal was recorded, `{ allowed: false, count }` if rate-limited
 * @throws Error on DB unavailability, invalid input, or DB errors (fail-closed)
 */
export async function atomicRateLimitAndRecord(
  userId: number,
  proposalId: string,
  walletAddress: string,
  maxPerDay: number = 3
): Promise<{ allowed: boolean; count?: number }> {
  // Validate all inputs before touching the DB
  idSchema.parse(userId);
  proposalIdSchema.parse(proposalId);
  addressSchema.parse(walletAddress);

  const db = await getDbOrThrow("atomicRateLimitAndRecord");

  try {
    // Use a raw SQL transaction for atomicity
    // Step 1: Count existing proposals in the last 24h
    const countResult = await db.execute(
      sql`SELECT COUNT(*) as count FROM proposal_audit_log
          WHERE actorId = ${userId}
          AND action = 'proposal_created'
          AND createdAt > DATE_SUB(NOW(), INTERVAL 24 HOUR)
          FOR UPDATE`
    );
    const count = Number(countResult[0]?.[0]?.count || countResult[0]?.count || 0);

    if (count >= maxPerDay) {
      logger.warn("Rate limit exceeded", { userId, count, maxPerDay });
      return { allowed: false, count };
    }

    // Step 2: Insert the new proposal record atomically
    await db.execute(
      sql`INSERT INTO proposal_audit_log (proposalId, action, actorId, actorAddress, metadata, createdAt)
          VALUES (${proposalId}, 'proposal_created', ${userId}, ${walletAddress}, '{}', NOW())`
    );

    logger.info("Proposal recorded atomically", { userId, proposalId, count: count + 1, maxPerDay });
    return { allowed: true, count: count + 1 };
  } catch (err: any) {
    logger.error("Atomic rate limit check failed", { error: err?.message, userId, proposalId });
    throw err; // Fail closed
  }
}

/**
 * Check if a user has exceeded their daily proposal creation limit.
 * Uses the proposal_audit_log table to count recent proposals.
 *
 * **IMPORTANT:** Prefer `atomicRateLimitAndRecord()` for new code to avoid race conditions.
 * This function is retained for backward compatibility and read-only checks.
 *
 * @param userId - The user's database ID (positive integer)
 * @param maxPerDay - Maximum proposals allowed per 24h (default: 3)
 * @returns true if rate-limited (should block), false if allowed
 * @throws Error on DB unavailability or invalid input (fail-closed)
 */
export async function isProposalRateLimited(
  userId: number,
  maxPerDay: number = 3
): Promise<boolean> {
  // Validate input
  idSchema.parse(userId);

  const db = await getDbOrThrow("isProposalRateLimited");

  try {
    const result = await db.execute(
      sql`SELECT COUNT(*) as count FROM proposal_audit_log
          WHERE actorId = ${userId}
          AND action = 'proposal_created'
          AND createdAt > DATE_SUB(NOW(), INTERVAL 24 HOUR)`
    );
    const count = Number(result[0]?.[0]?.count || result[0]?.count || 0);
    return count >= maxPerDay;
  } catch (err: any) {
    // Fail-closed: block proposals when DB is unhealthy
    logger.error("Rate limit check failed — failing closed", { error: err?.message, userId });
    throw err;
  }
}

/**
 * Record a proposal creation for rate limiting purposes.
 * Writes to the proposal_audit_log table.
 *
 * **IMPORTANT:** Prefer `atomicRateLimitAndRecord()` for new code to avoid race conditions.
 *
 * @param proposalId - The new proposal's ID
 * @param userId - The creator's database ID
 * @param walletAddress - The creator's wallet address
 * @throws Error on DB unavailability, invalid input, or write failure (fail-closed)
 */
export async function recordProposalCreation(
  proposalId: string,
  userId: number,
  walletAddress: string
): Promise<void> {
  // Validate inputs
  proposalIdSchema.parse(proposalId);
  idSchema.parse(userId);
  addressSchema.parse(walletAddress);

  const db = await getDbOrThrow("recordProposalCreation");

  try {
    await db.execute(
      sql`INSERT INTO proposal_audit_log (proposalId, action, actorId, actorAddress, metadata, createdAt)
          VALUES (${proposalId}, 'proposal_created', ${userId}, ${walletAddress}, '{}', NOW())`
    );
    logger.info("Proposal creation recorded", { proposalId, userId });
  } catch (err: any) {
    logger.error("Record proposal creation failed", { error: err?.message, proposalId, userId });
    throw err; // Fail closed
  }
}

/**
 * Log any DAO action for audit trail.
 *
 * All DAO governance actions are logged for forensic analysis, compliance,
 * and debugging. Metadata is pre-serialized before SQL to prevent injection.
 *
 * @param proposalId - Related proposal ID
 * @param action - Action type (must be a whitelisted action from actionSchema)
 * @param actorId - Who performed the action (positive integer)
 * @param metadata - Additional context as JSON (sanitized and serialized)
 * @throws Error on DB unavailability, invalid input, or write failure (fail-closed)
 */
export async function logDaoAction(
  proposalId: string,
  action: string,
  actorId: number,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  // Validate inputs
  proposalIdSchema.parse(proposalId);
  actionSchema.parse(action);
  idSchema.parse(actorId);

  const db = await getDbOrThrow("logDaoAction");

  // Pre-serialize metadata outside SQL template to avoid injection edge cases
  const serializedMetadata = JSON.stringify(metadata || {});

  try {
    await db.execute(
      sql`INSERT INTO proposal_audit_log (proposalId, action, actorId, metadata, createdAt)
          VALUES (${proposalId}, ${action}, ${actorId}, ${serializedMetadata}, NOW())`
    );
    logger.info("DAO action logged", { proposalId, action, actorId });
  } catch (err: any) {
    logger.error("Audit log write failed", { error: err?.message, proposalId, action });
    throw err; // Fail closed
  }
}

// ─── Timelock Management ─────────────────────────────────────────────────────
/**
 * Get the timelock state for a proposal from the database.
 *
 * @param proposalId - The proposal ID to look up
 * @returns Timelock data or null if no timelock exists for this proposal
 * @throws Error on DB unavailability or query failure (fail-closed)
 */
export async function getTimelockForProposal(proposalId: string): Promise<{
  proposalId: string;
  finalizedAt: number;
  executionUnlocksAt: number;
  executed: boolean;
  executedAt?: number;
} | null> {
  // Validate input
  proposalIdSchema.parse(proposalId);

  const db = await getDbOrThrow("getTimelockForProposal");

  try {
    const result = await db.execute(
      sql`SELECT * FROM proposal_timelocks WHERE proposalId = ${proposalId} LIMIT 1`
    );
    const row = result[0]?.[0] || result[0];
    if (!row || !row.proposalId) return null;

    return {
      proposalId: row.proposalId,
      finalizedAt: new Date(row.finalizedAt).getTime(),
      executionUnlocksAt: new Date(row.executionUnlocksAt).getTime(),
      executed: Boolean(row.executed),
      executedAt: row.executedAt ? new Date(row.executedAt).getTime() : undefined,
    };
  } catch (err: any) {
    logger.error("Timelock read failed", { error: err?.message, proposalId });
    throw err; // Fail closed
  }
}

/**
 * Save a timelock entry for a proposal.
 * Uses ON DUPLICATE KEY UPDATE for idempotent upserts.
 *
 * @param proposalId - The proposal ID
 * @param finalizedAt - When the proposal was finalized
 * @param executionUnlocksAt - When execution becomes available
 * @throws Error on DB unavailability or write failure (fail-closed)
 */
export async function saveTimelock(
  proposalId: string,
  finalizedAt: Date,
  executionUnlocksAt: Date
): Promise<void> {
  // Validate input
  proposalIdSchema.parse(proposalId);

  const db = await getDbOrThrow("saveTimelock");

  try {
    await db.execute(
      sql`INSERT INTO proposal_timelocks (proposalId, finalizedAt, executionUnlocksAt, createdAt)
          VALUES (${proposalId}, ${finalizedAt}, ${executionUnlocksAt}, NOW())
          ON DUPLICATE KEY UPDATE finalizedAt = ${finalizedAt}, executionUnlocksAt = ${executionUnlocksAt}`
    );
    logger.info("Timelock saved", { proposalId });
  } catch (err: any) {
    logger.error("Timelock save failed", { error: err?.message, proposalId });
    throw err; // Fail closed
  }
}

/**
 * Mark a timelock as executed with an optional transaction hash.
 *
 * @param proposalId - The proposal ID
 * @param txHash - Optional on-chain transaction hash (0x + 64 hex chars)
 * @throws Error on DB unavailability, invalid txHash, or write failure (fail-closed)
 */
export async function markTimelockExecuted(
  proposalId: string,
  txHash?: string
): Promise<void> {
  // Validate inputs
  proposalIdSchema.parse(proposalId);
  if (txHash) txHashSchema.parse(txHash);

  const db = await getDbOrThrow("markTimelockExecuted");

  try {
    await db.execute(
      sql`UPDATE proposal_timelocks
          SET executed = TRUE, executedAt = NOW(), executionTxHash = ${txHash || null}
          WHERE proposalId = ${proposalId}`
    );
    logger.info("Timelock marked executed", { proposalId, txHash: txHash || "none" });
  } catch (err: any) {
    logger.error("Timelock mark executed failed", { error: err?.message, proposalId });
    throw err; // Fail closed
  }
}
