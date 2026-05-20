/**
 * HERO DAO — Schema Update (Production Conditions #5)
 * =====================================================
 * This file documents the schema changes needed for production.
 * 
 * CONDITION #5: proposalId column must be VARCHAR(40) or larger.
 * Current: VARCHAR(16) — TOO SMALL for new format "HERO-{base36}-{8hex}"
 * New: VARCHAR(40) — accommodates any reasonable proposal ID format
 * 
 * MIGRATION REQUIRED:
 * ALTER TABLE proposals MODIFY COLUMN proposalId VARCHAR(40) NOT NULL;
 * 
 * Additional schema changes (from dao_security_hardening.sql):
 * - proposals: +contentHash, +timelockExpiresAt, +anchoredOnChain, +anchorTxHash
 * - votes: +receiptHash, +verifiedOnChain, UNIQUE(proposalId, voterId)
 * - delegations: +effectiveAfter, +cooldownExpired
 * - NEW TABLE: proposal_audit_log
 * - NEW TABLE: proposal_timelocks
 */

// This is the UPDATED proposals table definition for Drizzle schema.ts
// Replace the existing proposals definition with this:

/*
export const proposals = mysqlTable("proposals", {
  id: int("id").autoincrement().primaryKey(),
  proposalId: varchar("proposalId", { length: 40 }).notNull().unique(),  // CHANGED: was 16
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description").notNull(),
  proposerId: int("proposerId").notNull(),
  proposerAddress: varchar("proposerAddress", { length: 42 }).notNull(),
  status: mysqlEnum("status", ["pending", "active", "passed", "defeated", "queued", "executed", "cancelled"]).default("pending").notNull(),
  chain: mysqlEnum("chain", ["base", "pulsechain", "both"]).default("both").notNull(),
  category: mysqlEnum("category", ["protocol", "treasury", "community", "emergency"]).default("protocol").notNull(),
  votesFor: bigint("votesFor", { mode: "number" }).default(0).notNull(),
  votesAgainst: bigint("votesAgainst", { mode: "number" }).default(0).notNull(),
  votesAbstain: bigint("votesAbstain", { mode: "number" }).default(0).notNull(),
  quorum: bigint("quorum", { mode: "number" }).default(5000000).notNull(),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime").notNull(),
  executionTxHash: varchar("executionTxHash", { length: 66 }),
  // NEW COLUMNS (Production Security):
  contentHash: varchar("contentHash", { length: 64 }),          // SHA-256 hex
  timelockExpiresAt: timestamp("timelockExpiresAt"),            // When execution unlocks
  anchoredOnChain: boolean("anchoredOnChain").default(false).notNull(),
  anchorTxHash: varchar("anchorTxHash", { length: 66 }),        // On-chain anchor tx
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
*/

// Export the complete migration SQL for reference
export const PRODUCTION_MIGRATION_SQL = `
-- ═══════════════════════════════════════════════════════════════════════
-- HERO DAO — Production Migration (All 5 Conditions)
-- Run this ONCE before deploying the hardened code
-- ═══════════════════════════════════════════════════════════════════════

-- CONDITION #5: Increase proposalId column to VARCHAR(40)
ALTER TABLE proposals MODIFY COLUMN proposalId VARCHAR(40) NOT NULL;

-- Add security columns to proposals table
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS contentHash VARCHAR(64) AFTER executionTxHash,
  ADD COLUMN IF NOT EXISTS timelockExpiresAt TIMESTAMP NULL AFTER contentHash,
  ADD COLUMN IF NOT EXISTS anchoredOnChain BOOLEAN DEFAULT FALSE NOT NULL AFTER timelockExpiresAt,
  ADD COLUMN IF NOT EXISTS anchorTxHash VARCHAR(66) NULL AFTER anchoredOnChain;

-- Add vote receipt hash for audit trail
ALTER TABLE votes
  ADD COLUMN IF NOT EXISTS receiptHash VARCHAR(64) AFTER txHash,
  ADD COLUMN IF NOT EXISTS verifiedOnChain BOOLEAN DEFAULT FALSE NOT NULL AFTER receiptHash;

-- Add unique constraint for atomic double-vote prevention
-- (Ignore error if already exists)
ALTER TABLE votes
  ADD UNIQUE INDEX idx_unique_vote (proposalId, voterId);

-- Add delegation cooldown tracking
ALTER TABLE delegations
  ADD COLUMN IF NOT EXISTS effectiveAfter TIMESTAMP NULL AFTER isActive,
  ADD COLUMN IF NOT EXISTS cooldownExpired BOOLEAN DEFAULT TRUE NOT NULL AFTER effectiveAfter;

-- Create proposal audit log table (for persistent rate limiting + audit trail)
CREATE TABLE IF NOT EXISTS proposal_audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  proposalId VARCHAR(40) NOT NULL,
  action VARCHAR(32) NOT NULL,
  actorId INT,
  actorAddress VARCHAR(42),
  previousStatus VARCHAR(16),
  newStatus VARCHAR(16),
  metadata JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX idx_proposal_audit (proposalId),
  INDEX idx_actor_audit (actorId),
  INDEX idx_action_time (action, createdAt)
);

-- Create timelock tracking table
CREATE TABLE IF NOT EXISTS proposal_timelocks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  proposalId VARCHAR(40) NOT NULL UNIQUE,
  finalizedAt TIMESTAMP NOT NULL,
  executionUnlocksAt TIMESTAMP NOT NULL,
  executed BOOLEAN DEFAULT FALSE NOT NULL,
  executedAt TIMESTAMP NULL,
  executionTxHash VARCHAR(66),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX idx_timelock_unlock (executionUnlocksAt)
);

-- Performance indices
CREATE INDEX IF NOT EXISTS idx_votes_proposal_voter ON votes (proposalId, voterId);
CREATE INDEX IF NOT EXISTS idx_delegations_created ON delegations (createdAt, isActive);
CREATE INDEX IF NOT EXISTS idx_proposals_status_end ON proposals (status, endTime);
`;
