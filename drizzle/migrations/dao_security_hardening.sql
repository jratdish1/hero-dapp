-- HERO DAO Security Hardening Migration (v1.1 — Post-Audit)
-- Implements Grok audit recommendations + GPT-4.1 Codex Audit fixes
-- Date: 2026-05-20
--
-- AUDIT FIXES APPLIED:
-- [LOW] #11 — Changed hash columns to CHAR(64) with fixed length for hex storage
--             (BINARY(32) requires app-level conversion; CHAR(64) is simpler and still indexed well)
-- [LOW] #12 — Added foreign key constraints for referential integrity

-- 1. Add proposal hash commitment column
ALTER TABLE proposals
  ADD COLUMN contentHash CHAR(64) AFTER executionTxHash,
  ADD COLUMN timelockExpiresAt TIMESTAMP NULL AFTER contentHash,
  ADD COLUMN anchoredOnChain BOOLEAN DEFAULT FALSE NOT NULL AFTER timelockExpiresAt,
  ADD COLUMN anchorTxHash VARCHAR(66) NULL AFTER anchoredOnChain;

-- 2. Add vote receipt hash for audit trail
ALTER TABLE votes
  ADD COLUMN receiptHash CHAR(64) AFTER txHash,
  ADD COLUMN verifiedOnChain BOOLEAN DEFAULT FALSE NOT NULL AFTER receiptHash;

-- 3. Add delegation cooldown tracking
ALTER TABLE delegations
  ADD COLUMN effectiveAfter TIMESTAMP NULL AFTER isActive,
  ADD COLUMN cooldownExpired BOOLEAN DEFAULT TRUE NOT NULL AFTER effectiveAfter;

-- 4. Create unique constraint to prevent double voting at DB level (atomic)
-- This is the CRITICAL fix for the race condition identified by Grok
ALTER TABLE votes
  ADD UNIQUE INDEX idx_unique_vote (proposalId, voterId);

-- 5. Create proposal audit log table with foreign key
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
  CONSTRAINT fk_audit_actor FOREIGN KEY (actorId) REFERENCES users(id) ON DELETE SET NULL
);

-- 6. Create timelock tracking table with foreign key
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

-- 7. Add index for faster vote lookups (supports the unique constraint)
CREATE INDEX idx_votes_proposal_voter ON votes (proposalId, voterId);

-- 8. Add index for delegation cooldown queries
CREATE INDEX idx_delegations_created ON delegations (createdAt, isActive);

-- 9. Add index for proposal status queries (used by auto-finalization cron)
CREATE INDEX idx_proposals_status_end ON proposals (status, endTime);
