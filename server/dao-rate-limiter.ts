/**
 * HERO DAO — Persistent Rate Limiter
 * ====================================
 * Production Condition #1: Replace in-memory Map with persistent rate limiting.
 * 
 * Strategy: Uses the existing MySQL database via Drizzle for rate limiting.
 * This avoids adding Redis as a new dependency while providing persistence
 * across server restarts and multi-instance deployments.
 * 
 * Why MySQL over Redis:
 * - No new infrastructure dependency
 * - Already have DB connection pool
 * - DAO proposals are low-frequency (max 3/day) — no need for Redis speed
 * - Survives server restarts
 * - Works across multiple instances
 * 
 * KISS: One table, two functions. That's it.
 */

import { sql } from "drizzle-orm";

// This will be imported from the db module
let getDb: () => Promise<any>;

/**
 * Initialize the rate limiter with the database getter.
 * Call this once at server startup.
 */
export function initRateLimiter(dbGetter: () => Promise<any>) {
  getDb = dbGetter;
}

/**
 * Check if a user has exceeded their daily proposal creation limit.
 * Uses the proposal_audit_log table to count recent proposals.
 * 
 * @param userId - The user's database ID
 * @param maxPerDay - Maximum proposals allowed per 24h (default: 3)
 * @returns true if rate-limited (should block), false if allowed
 */
export async function isProposalRateLimited(
  userId: number,
  maxPerDay: number = 3
): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.error("[DAO Rate Limiter] CRITICAL: DB unavailable — FAILING CLOSED to prevent abuse");
    return true; // AUDIT FIX: Fail-closed when DB unavailable to prevent spam/DoS
  }

  try {
    const result = await db.execute(
      sql`SELECT COUNT(*) as count FROM proposal_audit_log 
          WHERE actorId = ${userId} 
          AND action = 'proposal_created'
          AND createdAt > DATE_SUB(NOW(), INTERVAL 24 HOUR)`
    );
    const count = result[0]?.[0]?.count || result[0]?.count || 0;
    return Number(count) >= maxPerDay;
  } catch (err: any) {
    // AUDIT FIX: Fail-closed in production to prevent spam/DoS
    // Only fail-open if the table doesn't exist yet (pre-migration)
    const isTableMissing = err?.message?.includes("doesn't exist") || err?.code === 'ER_NO_SUCH_TABLE';
    if (isTableMissing) {
      // AUDIT NOTE: This fail-open window only exists if migration hasn't been run.
      // The deploy-production.sh script runs migrations BEFORE restarting the app,
      // so in practice this path should never be hit in production.
      console.error("[DAO Rate Limiter] CRITICAL: Table missing — migration not applied! Failing CLOSED.");
      return true; // Fail-closed even for missing table — deploy script ensures migration runs first
    }
    // For all other DB errors in production: fail-closed (block proposals)
    console.error("[DAO Rate Limiter] DB error — FAILING CLOSED to prevent abuse:", err.message);
    return true; // Block proposal creation when DB is unhealthy
  }
}

/**
 * Record a proposal creation for rate limiting purposes.
 * Writes to the proposal_audit_log table.
 * 
 * @param proposalId - The new proposal's ID
 * @param userId - The creator's database ID
 * @param walletAddress - The creator's wallet address
 */
export async function recordProposalCreation(
  proposalId: string,
  userId: number,
  walletAddress: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.execute(
      sql`INSERT INTO proposal_audit_log (proposalId, action, actorId, actorAddress, metadata, createdAt)
          VALUES (${proposalId}, 'proposal_created', ${userId}, ${walletAddress}, '{}', NOW())`
    );
  } catch (err) {
    console.warn("[DAO Rate Limiter] Record failed:", err);
  }
}

/**
 * Log any DAO action for audit trail.
 * 
 * @param proposalId - Related proposal ID
 * @param action - Action type (e.g., 'status_change', 'vote_cast', 'quorum_reached')
 * @param actorId - Who performed the action
 * @param metadata - Additional context as JSON
 */
export async function logDaoAction(
  proposalId: string,
  action: string,
  actorId: number,
  metadata: Record<string, any> = {}
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.execute(
      sql`INSERT INTO proposal_audit_log (proposalId, action, actorId, metadata, createdAt)
          VALUES (${proposalId}, ${action}, ${actorId}, ${JSON.stringify(metadata)}, NOW())`
    );
  } catch (err) {
    console.warn("[DAO Audit Log] Write failed:", err);
  }
}

/**
 * Get the timelock state for a proposal from the database.
 */
export async function getTimelockForProposal(proposalId: string): Promise<{
  proposalId: string;
  finalizedAt: number;
  executionUnlocksAt: number;
  executed: boolean;
  executedAt?: number;
} | null> {
  const db = await getDb();
  if (!db) return null;

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
  } catch {
    return null;
  }
}

/**
 * Save a timelock entry for a proposal.
 */
export async function saveTimelock(proposalId: string, finalizedAt: Date, executionUnlocksAt: Date): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.execute(
      sql`INSERT INTO proposal_timelocks (proposalId, finalizedAt, executionUnlocksAt, createdAt)
          VALUES (${proposalId}, ${finalizedAt}, ${executionUnlocksAt}, NOW())
          ON DUPLICATE KEY UPDATE finalizedAt = ${finalizedAt}, executionUnlocksAt = ${executionUnlocksAt}`
    );
  } catch (err) {
    console.warn("[DAO Timelock] Save failed:", err);
  }
}

/**
 * Mark a timelock as executed.
 */
export async function markTimelockExecuted(proposalId: string, txHash?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.execute(
      sql`UPDATE proposal_timelocks 
          SET executed = TRUE, executedAt = NOW(), executionTxHash = ${txHash || null}
          WHERE proposalId = ${proposalId}`
    );
  } catch (err) {
    console.warn("[DAO Timelock] Mark executed failed:", err);
  }
}
