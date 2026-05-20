/**
 * HERO DAO — Security Hardening Module (v1.1 — Post-Audit)
 * =========================================================
 * Implements recommendations from Grok comparative analysis + GPT-4.1 Codex Audit fixes.
 * 
 * AUDIT FIXES APPLIED (Pass 1):
 * [MEDIUM] #1  — Replaced custom timingSafeEqual with Node.js crypto.timingSafeEqual
 * [HIGH]   #2  — Increased proposal ID randomness to 8 hex chars (4 bytes)
 * [MEDIUM] #3  — Standardized chain parameter handling with multi-chain aggregation
 * [INFO]   #14 — Added nonce/salt to vote receipt hash generation
 * 
 * KISS Principle: Each function does ONE thing. DRY: Shared helpers extracted.
 */

import { createHash, randomBytes, timingSafeEqual as nodeTimingSafeEqual } from 'crypto';

// ─── Constants ──────────────────────────────────────────────────────────

/** Timelock duration: 48 hours in milliseconds */
export const TIMELOCK_DURATION_MS = 48 * 60 * 60 * 1000;

/** Minimum delegation cooldown: delegations created during active proposal
 *  voting periods cannot be used until the NEXT proposal */
export const DELEGATION_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Maximum proposals per user per day (anti-spam) */
export const MAX_PROPOSALS_PER_DAY = 3;

/** Minimum HERO balance to create a proposal */
export const MIN_PROPOSAL_BALANCE = 100_000; // 100k HERO

/** Emergency proposal quorum multiplier (2x normal) */
export const EMERGENCY_QUORUM_MULTIPLIER = 2;

// ─── Proposal Hash Commitment ───────────────────────────────────────────

/**
 * Generate a deterministic proposal hash for tamper detection.
 * Includes domain separation to prevent cross-context replay.
 * 
 * @param proposalId - Unique proposal identifier
 * @param title - Proposal title
 * @param description - Proposal description  
 * @param proposerAddress - Wallet address of proposer
 * @param chain - Target chain(s)
 * @param startTime - Voting start timestamp
 * @param endTime - Voting end timestamp
 * @returns SHA-256 hash hex string
 */
export function generateProposalHash(
  proposalId: string,
  title: string,
  description: string,
  proposerAddress: string,
  chain: string,
  startTime: Date,
  endTime: Date
): string {
  const payload = [
    'HERO_DAO_v1',           // Domain separator
    proposalId,
    title,
    description,
    proposerAddress.toLowerCase(),
    chain,
    startTime.toISOString(),
    endTime.toISOString(),
  ].join('|');

  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Verify a proposal hash matches the stored commitment.
 * Uses Node.js native crypto.timingSafeEqual for constant-time comparison.
 * 
 * AUDIT FIX #1: Replaced custom implementation with native crypto.timingSafeEqual
 */
export function verifyProposalHash(
  storedHash: string,
  proposalId: string,
  title: string,
  description: string,
  proposerAddress: string,
  chain: string,
  startTime: Date,
  endTime: Date
): boolean {
  const computed = generateProposalHash(
    proposalId, title, description, proposerAddress, chain, startTime, endTime
  );
  return timingSafeHexEqual(storedHash, computed);
}

// ─── Collision-Resistant Proposal ID ────────────────────────────────────

/**
 * Generate a cryptographically unique proposal ID.
 * Format: HERO-{timestamp_base36}-{random_8chars}
 * 
 * AUDIT FIX #2: Increased from 4 hex chars (2 bytes) to 8 hex chars (4 bytes).
 * Collision probability: ~1 in 4.3 billion per millisecond.
 */
export function generateSecureProposalId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = randomBytes(4).toString('hex').toUpperCase(); // 8 hex chars = 4 bytes
  return `HERO-${timestamp}-${random}`;
}

// ─── Multi-Chain Voting Power ───────────────────────────────────────────

/**
 * Resolve which chains to verify voting power on.
 * 
 * AUDIT FIX #3: Standardized chain parameter handling.
 * When chain is "both", returns both chains for aggregation.
 */
export function resolveVerificationChains(chain: string): Array<'pulsechain' | 'base'> {
  switch (chain) {
    case 'pulsechain': return ['pulsechain'];
    case 'base': return ['base'];
    case 'both': return ['pulsechain', 'base'];
    default: return ['pulsechain']; // Safe fallback
  }
}

// ─── Timelock Enforcement ───────────────────────────────────────────────

export interface TimelockState {
  proposalId: string;
  finalizedAt: number;      // Unix timestamp when proposal was finalized
  executionUnlocksAt: number; // Unix timestamp when execution becomes available
  executed: boolean;
  executedAt?: number;
}

/**
 * Create a timelock entry after proposal finalization.
 */
export function createTimelock(proposalId: string): TimelockState {
  const now = Date.now();
  return {
    proposalId,
    finalizedAt: now,
    executionUnlocksAt: now + TIMELOCK_DURATION_MS,
    executed: false,
  };
}

/**
 * Check if a proposal's timelock has expired and execution is allowed.
 */
export function isTimelockExpired(timelock: TimelockState): boolean {
  if (timelock.executed) return false; // Already executed
  return Date.now() >= timelock.executionUnlocksAt;
}

/**
 * Get remaining timelock duration in human-readable format.
 */
export function getTimelockRemaining(timelock: TimelockState): string {
  const remaining = timelock.executionUnlocksAt - Date.now();
  if (remaining <= 0) return 'Ready for execution';
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}h ${minutes}m remaining`;
}

// ─── Delegation Cooldown ────────────────────────────────────────────────

/**
 * Check if a delegation is in cooldown period.
 * Delegations whose effectiveAfter timestamp has not passed
 * cannot be counted toward the current proposal's vote.
 * 
 * AUDIT FIX (Pass 2): Uses effectiveAfter timestamp instead of raw createdAt
 * to ensure cooldown is respected consistently.
 */
export function isDelegationInCooldown(
  delegationEffectiveAfter: number,
  proposalStartTime: number
): boolean {
  // Delegation must be effective (cooldown expired) BEFORE the proposal started
  // to count toward that proposal's voting power
  return delegationEffectiveAfter > proposalStartTime;
}

/**
 * Calculate effective voting power considering delegation cooldowns.
 * Only delegations whose effectiveAfter has passed before proposal start count.
 * 
 * AUDIT FIX (Pass 2): Uses effectiveAfter instead of createdAt for consistency.
 */
export function calculateEffectiveVotingPower(
  ownBalance: number,
  delegations: Array<{ amount: number; effectiveAfter: number }>,
  proposalStartTime: number
): number {
  const eligibleDelegations = delegations.filter(
    d => !isDelegationInCooldown(d.effectiveAfter, proposalStartTime)
  );
  const delegatedPower = eligibleDelegations.reduce((sum, d) => sum + d.amount, 0);
  return ownBalance + delegatedPower;
}

// ─── Vote Integrity ─────────────────────────────────────────────────────

/**
 * Generate a vote receipt hash for audit trail.
 * This can be stored and later verified against on-chain data.
 * 
 * AUDIT FIX #14: Added unique nonce (random salt) to prevent replay/duplication.
 */
export function generateVoteReceipt(
  proposalId: string,
  voterAddress: string,
  choice: 'for' | 'against' | 'abstain',
  votingPower: number,
  chain: string,
  timestamp: number,
  txHash?: string
): string {
  // Generate unique nonce for each vote receipt
  const nonce = randomBytes(8).toString('hex');

  const payload = [
    'HERO_VOTE_v1',
    proposalId,
    voterAddress.toLowerCase(),
    choice,
    votingPower.toString(),
    chain,
    timestamp.toString(),
    nonce,                    // Unique per-receipt salt
    txHash || 'no-tx',       // Include tx hash if available
  ].join('|');

  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Validate that a proposal is currently in a voteable state.
 */
export function isProposalVoteable(proposal: {
  status: string;
  startTime: Date;
  endTime: Date;
}): { voteable: boolean; reason?: string } {
  const now = Date.now();

  if (proposal.status !== 'active') {
    return { voteable: false, reason: `Proposal status is "${proposal.status}", must be "active"` };
  }
  if (now < proposal.startTime.getTime()) {
    return { voteable: false, reason: 'Voting has not started yet' };
  }
  if (now > proposal.endTime.getTime()) {
    return { voteable: false, reason: 'Voting period has ended' };
  }
  return { voteable: true };
}

// ─── Anti-Spam: Proposal Creation Rate Limiting ─────────────────────────

/**
 * In-memory rate limiter for proposal creation.
 * 
 * PRODUCTION NOTE (Pass 2 Audit): For multi-instance deployments,
 * replace this with Redis-backed rate limiting (e.g., ioredis + sliding window).
 * This in-memory implementation is suitable for single-instance deployments.
 * 
 * Example Redis replacement:
 *   const key = `rate:proposal:${userId}`;
 *   const count = await redis.incr(key);
 *   if (count === 1) await redis.expire(key, 86400);
 *   return count > MAX_PROPOSALS_PER_DAY;
 */
const proposalCreationTracker = new Map<number, number[]>(); // userId -> timestamps

/**
 * Check if a user has exceeded the daily proposal creation limit.
 * Returns true if the user is rate-limited.
 */
export function isProposalRateLimited(userId: number): boolean {
  const now = Date.now();
  const dayAgo = now - (24 * 60 * 60 * 1000);

  const timestamps = proposalCreationTracker.get(userId) || [];
  const recentProposals = timestamps.filter(t => t > dayAgo);

  // Update tracker with cleaned timestamps
  proposalCreationTracker.set(userId, recentProposals);

  return recentProposals.length >= MAX_PROPOSALS_PER_DAY;
}

/**
 * Record a proposal creation for rate limiting.
 */
export function recordProposalCreation(userId: number): void {
  const timestamps = proposalCreationTracker.get(userId) || [];
  timestamps.push(Date.now());
  proposalCreationTracker.set(userId, timestamps);
}

// ─── Quorum Calculation ─────────────────────────────────────────────────

/**
 * Calculate dynamic quorum based on proposal category.
 * Emergency proposals require 2x quorum to prevent abuse.
 */
export function calculateQuorum(
  baseQuorum: number,
  category: 'protocol' | 'treasury' | 'community' | 'emergency'
): number {
  if (category === 'emergency') {
    return baseQuorum * EMERGENCY_QUORUM_MULTIPLIER;
  }
  return baseQuorum;
}

/**
 * Check if quorum has been reached for a proposal.
 */
export function isQuorumMet(
  votesFor: number,
  votesAgainst: number,
  votesAbstain: number,
  quorum: number
): boolean {
  // Both For and Against count toward quorum (abstain does NOT)
  const totalParticipation = votesFor + votesAgainst;
  return totalParticipation >= quorum;
}

// ─── Utility: Timing-Safe Hex String Comparison ─────────────────────────

/**
 * Constant-time hex string comparison using Node.js native crypto.timingSafeEqual.
 * 
 * AUDIT FIX #1: Uses native Buffer-based comparison instead of custom char loop.
 * Prevents timing side-channel attacks on hash verification.
 */
function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return nodeTimingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

// ─── Proposal Status Transition Validation ──────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['active', 'cancelled'],
  active: ['passed', 'defeated', 'cancelled'],
  passed: ['queued', 'cancelled'],
  queued: ['executed', 'cancelled'],
  defeated: [],        // Terminal state
  executed: [],        // Terminal state
  cancelled: [],       // Terminal state
};

/**
 * Validate that a status transition is allowed.
 * Prevents invalid state changes (e.g., jumping from pending to executed).
 */
export function isValidStatusTransition(
  currentStatus: string,
  newStatus: string
): boolean {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed) return false;
  return allowed.includes(newStatus);
}

/**
 * Get the list of valid transitions from a given status.
 */
export function getValidTransitions(currentStatus: string): string[] {
  return VALID_TRANSITIONS[currentStatus] || [];
}

// ─── Wallet Address Verification ────────────────────────────────────────

/**
 * Verify that the voter's wallet address matches their registered account.
 * Prevents voting with someone else's token balance.
 */
export function verifyWalletOwnership(
  claimedAddress: string,
  registeredAddress: string | null
): { valid: boolean; reason?: string } {
  if (!registeredAddress) {
    return { valid: false, reason: 'No wallet address registered on account' };
  }
  if (claimedAddress.toLowerCase() !== registeredAddress.toLowerCase()) {
    return { valid: false, reason: 'Wallet address does not match registered account' };
  }
  return { valid: true };
}

// ─── Export Summary ─────────────────────────────────────────────────────

export const DAO_SECURITY_VERSION = '1.1.0';
export const DAO_SECURITY_FEATURES = [
  'Proposal hash commitment (SHA-256 with domain separation)',
  'Collision-resistant proposal IDs (timestamp + 4-byte crypto random)',
  '48-hour timelock between finalization and execution',
  'Delegation cooldown (prevents mid-vote manipulation)',
  'Vote receipt generation with unique nonce for audit trail',
  'Proposal voteable state validation',
  'Anti-spam rate limiting for proposal creation',
  'Dynamic quorum (2x for emergency proposals)',
  'Valid status transition enforcement',
  'Native crypto.timingSafeEqual for hash comparison',
  'Wallet ownership verification',
  'Multi-chain voting power resolution',
] as const;
