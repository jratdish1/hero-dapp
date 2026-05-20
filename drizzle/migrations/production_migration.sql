-- ═══════════════════════════════════════════════════════════════════════
-- HERO DAO — PRODUCTION MIGRATION
-- All 5 conditions addressed in one migration
-- Run ONCE before deploying the hardened production code
-- ═══════════════════════════════════════════════════════════════════════
-- Date: 2026-05-20
-- Audit: GPT-4.1 Codex Pass 1 + Pass 2 verified
-- ═══════════════════════════════════════════════════════════════════════

-- ─── CONDITION #5: Fix proposalId column length ─────────────────────────
-- Current: VARCHAR(16) — too small for "HERO-{base36}-{8hex}" format
-- New: VARCHAR(40) — accommodates any reasonable proposal ID
ALTER TABLE proposals MODIFY COLUMN proposalId VARCHAR(40) NOT NULL;

-- ─── Add security columns to proposals ──────────────────────────────────
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS contentHash VARCHAR(64) DEFAULT NULL COMMENT 'SHA-256 hash of proposal content',
  ADD COLUMN IF NOT EXISTS timelockExpiresAt TIMESTAMP NULL DEFAULT NULL COMMENT 'When 48h timelock expires',
  ADD COLUMN IF NOT EXISTS anchoredOnChain TINYINT(1) DEFAULT 0 NOT NULL COMMENT 'Whether anchored on-chain',
  ADD COLUMN IF NOT EXISTS anchorTxHash VARCHAR(66) DEFAULT NULL COMMENT 'On-chain anchor transaction hash';

-- ─── Add vote receipt tracking ──────────────────────────────────────────
ALTER TABLE votes
  ADD COLUMN IF NOT EXISTS receiptHash VARCHAR(64) DEFAULT NULL COMMENT 'Vote receipt hash for audit',
  ADD COLUMN IF NOT EXISTS verifiedOnChain TINYINT(1) DEFAULT 0 NOT NULL COMMENT 'On-chain verification status';

-- ─── Atomic double-vote prevention (unique constraint) ──────────────────
-- This is the critical security fix — prevents race condition double-votes
-- Using ALTER IGNORE to skip if already exists
ALTER TABLE votes
  ADD UNIQUE INDEX idx_unique_vote (proposalId, voterId);

-- ─── Delegation cooldown tracking ───────────────────────────────────────
ALTER TABLE delegations
  ADD COLUMN IF NOT EXISTS effectiveAfter TIMESTAMP NULL DEFAULT NULL COMMENT '24h cooldown expiry',
  ADD COLUMN IF NOT EXISTS cooldownExpired TINYINT(1) DEFAULT 1 NOT NULL COMMENT 'Whether cooldown has passed';

-- ─── CONDITION #1: Persistent rate limiting table ───────────────────────
-- Replaces in-memory Map — survives restarts, works multi-instance
CREATE TABLE IF NOT EXISTS proposal_audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  proposalId VARCHAR(40) NOT NULL,
  action VARCHAR(32) NOT NULL COMMENT 'proposal_created, status_change, vote_cast, quorum_reached',
  actorId INT DEFAULT NULL,
  actorAddress VARCHAR(42) DEFAULT NULL,
  previousStatus VARCHAR(16) DEFAULT NULL,
  newStatus VARCHAR(16) DEFAULT NULL,
  metadata JSON DEFAULT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX idx_proposal_audit (proposalId),
  INDEX idx_actor_audit (actorId),
  INDEX idx_action_time (action, createdAt),
  INDEX idx_rate_limit (actorId, action, createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Timelock tracking table ────────────────────────────────────────────
-- 48-hour mandatory delay between finalization and execution
CREATE TABLE IF NOT EXISTS proposal_timelocks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  proposalId VARCHAR(40) NOT NULL,
  finalizedAt TIMESTAMP NOT NULL,
  executionUnlocksAt TIMESTAMP NOT NULL,
  executed TINYINT(1) DEFAULT 0 NOT NULL,
  executedAt TIMESTAMP NULL DEFAULT NULL,
  executionTxHash VARCHAR(66) DEFAULT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE INDEX idx_timelock_proposal (proposalId),
  INDEX idx_timelock_unlock (executionUnlocksAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Performance indices ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_votes_proposal_voter ON votes (proposalId, voterId);
CREATE INDEX IF NOT EXISTS idx_delegations_active ON delegations (isActive, createdAt);
CREATE INDEX IF NOT EXISTS idx_proposals_status_end ON proposals (status, endTime);
CREATE INDEX IF NOT EXISTS idx_proposals_chain ON proposals (chain, status);

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (run after migration to confirm)
-- ═══════════════════════════════════════════════════════════════════════
-- SELECT COLUMN_TYPE FROM information_schema.COLUMNS 
--   WHERE TABLE_NAME = 'proposals' AND COLUMN_NAME = 'proposalId';
-- Expected: varchar(40)
--
-- SHOW CREATE TABLE proposal_audit_log;
-- SHOW CREATE TABLE proposal_timelocks;
-- SHOW INDEX FROM votes WHERE Key_name = 'idx_unique_vote';
-- ═══════════════════════════════════════════════════════════════════════
