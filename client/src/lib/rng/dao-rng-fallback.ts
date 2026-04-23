/**
 * HERO DAO — RNG Fallback Module
 * 
 * Quarterly charity treasury allocation with automatic RNG fallback
 * when voter quorum is not met.
 * 
 * Flow:
 * 1. Admin creates quarterly proposal with 3 charity nominees
 * 2. HERO holders vote (token-weighted) for 30 days
 * 3. At deadline: if quorum met → top vote wins; if not → RNG picks
 * 4. Winner declared → email sent to VETSCrypto@pm.me
 * 5. Treasury disbursement initiated
 */

import { generateRandom, type RNGResult } from '../shared/rng-engine';
import { sendDAOResultEmail, type EmailConfig, type DAOResultEmail } from '../shared/email-notify';
import { ethers } from 'ethers';

// ─── Types ───────────────────────────────────────────────────────

export interface CharityNominee {
  id: string;
  name: string;
  description: string;
  website?: string;
  walletAddress?: string; // For direct on-chain disbursement
}

export interface Vote {
  voter: string;          // Wallet address
  nomineeId: string;      // Which nominee they voted for
  weight: bigint;         // HERO token balance at snapshot
  timestamp: number;      // Unix timestamp
  txHash?: string;        // On-chain vote tx
}

export interface Proposal {
  id: string;
  quarter: string;        // e.g., "Q2 2026"
  nominees: CharityNominee[];
  createdAt: number;
  votingOpens: number;    // Unix timestamp
  votingCloses: number;   // Unix timestamp (deadline)
  quorumThreshold: number; // Percentage of circulating supply (e.g., 10)
  circulatingSupply: bigint;
  treasuryAmount: string;
  treasuryUsdValue: string;
  status: 'draft' | 'active' | 'closed' | 'finalized';
  votes: Vote[];
  result?: ProposalResult;
}

export interface ProposalResult {
  winnerId: string;
  winnerName: string;
  selectionMethod: 'vote' | 'rng_fallback';
  voteTally: Map<string, { votes: number; weight: bigint; percentage: number }>;
  quorumMet: boolean;
  totalVotesCast: number;
  totalWeight: bigint;
  participationRate: number;
  rngProof?: RNGResult;
  emailSent: boolean;
  emailMessageId?: string;
  finalizedAt: number;
}

// ─── Constants ───────────────────────────────────────────────────

const HERO_TOKEN_ADDRESS = '0x0d86883FAf4FfD7aEb116390af37746F45b6f378'; // HERO on PulseChain
const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const DEFAULT_QUORUM = 10; // 10% of circulating supply must vote

// Quarterly schedule (month 0-indexed)
const QUARTERLY_SCHEDULE = [
  { quarter: 'Q1', openMonth: 0, openDay: 1, closeMonth: 0, closeDay: 31 },
  { quarter: 'Q2', openMonth: 3, openDay: 1, closeMonth: 3, closeDay: 30 },
  { quarter: 'Q3', openMonth: 6, openDay: 1, closeMonth: 6, closeDay: 31 },
  { quarter: 'Q4', openMonth: 9, openDay: 1, closeMonth: 9, closeDay: 31 },
];

// ─── Core Functions ──────────────────────────────────────────────

/**
 * Create a new quarterly proposal
 */
export function createProposal(
  quarter: string,
  nominees: CharityNominee[],
  circulatingSupply: bigint,
  treasuryAmount: string,
  treasuryUsdValue: string,
  quorumThreshold: number = DEFAULT_QUORUM
): Proposal {
  if (nominees.length < 2 || nominees.length > 5) {
    throw new Error('Must have 2-5 nominees');
  }

  const now = Date.now();
  const votingCloses = now + (30 * 24 * 60 * 60 * 1000); // 30 days from now

  return {
    id: `dao-${quarter.toLowerCase()}-${Date.now()}`,
    quarter,
    nominees,
    createdAt: now,
    votingOpens: now,
    votingCloses,
    quorumThreshold,
    circulatingSupply,
    treasuryAmount,
    treasuryUsdValue,
    status: 'active',
    votes: [],
  };
}

/**
 * Cast a vote on a proposal
 */
export function castVote(
  proposal: Proposal,
  voter: string,
  nomineeId: string,
  heroBalance: bigint
): Vote {
  // Validate proposal is active
  if (proposal.status !== 'active') {
    throw new Error('Proposal is not active');
  }

  const now = Date.now();
  if (now < proposal.votingOpens) {
    throw new Error('Voting has not started yet');
  }
  if (now > proposal.votingCloses) {
    throw new Error('Voting period has ended');
  }

  // Validate nominee exists
  if (!proposal.nominees.find(n => n.id === nomineeId)) {
    throw new Error('Invalid nominee ID');
  }

  // Check if voter already voted
  const existingVote = proposal.votes.find(v => v.voter.toLowerCase() === voter.toLowerCase());
  if (existingVote) {
    throw new Error('Voter has already cast a vote');
  }

  // Minimum balance check (must hold at least 1 HERO)
  if (heroBalance <= 0n) {
    throw new Error('Must hold HERO tokens to vote');
  }

  const vote: Vote = {
    voter: voter.toLowerCase(),
    nomineeId,
    weight: heroBalance,
    timestamp: now,
  };

  proposal.votes.push(vote);
  return vote;
}

/**
 * Tally votes for a proposal
 */
export function tallyVotes(proposal: Proposal): Map<string, { votes: number; weight: bigint; percentage: number }> {
  const tally = new Map<string, { votes: number; weight: bigint; percentage: number }>();

  // Initialize all nominees with zero
  for (const nominee of proposal.nominees) {
    tally.set(nominee.id, { votes: 0, weight: 0n, percentage: 0 });
  }

  // Count votes
  let totalWeight = 0n;
  for (const vote of proposal.votes) {
    const entry = tally.get(vote.nomineeId);
    if (entry) {
      entry.votes++;
      entry.weight += vote.weight;
      totalWeight += vote.weight;
    }
  }

  // Calculate percentages
  if (totalWeight > 0n) {
    for (const [, entry] of tally) {
      entry.percentage = Number((entry.weight * 10000n) / totalWeight) / 100;
    }
  }

  return tally;
}

/**
 * Check if quorum is met
 */
export function checkQuorum(proposal: Proposal): {
  met: boolean;
  required: number;
  actual: number;
  totalWeight: bigint;
} {
  let totalWeight = 0n;
  for (const vote of proposal.votes) {
    totalWeight += vote.weight;
  }

  const requiredWeight = (proposal.circulatingSupply * BigInt(proposal.quorumThreshold)) / 100n;
  const actualPercentage = Number((totalWeight * 10000n) / proposal.circulatingSupply) / 100;

  return {
    met: totalWeight >= requiredWeight,
    required: proposal.quorumThreshold,
    actual: actualPercentage,
    totalWeight,
  };
}

/**
 * Finalize a proposal — determine winner by vote or RNG fallback
 * This is the main function called when the voting deadline passes
 */
export async function finalizeProposal(
  proposal: Proposal,
  emailConfig?: EmailConfig
): Promise<ProposalResult> {
  if (proposal.status === 'finalized') {
    throw new Error('Proposal already finalized');
  }

  const tally = tallyVotes(proposal);
  const quorum = checkQuorum(proposal);

  let winnerId: string;
  let winnerName: string;
  let selectionMethod: 'vote' | 'rng_fallback';
  let rngProof: RNGResult | undefined;

  if (quorum.met) {
    // ─── QUORUM MET: Top vote wins ───
    selectionMethod = 'vote';
    
    let maxWeight = 0n;
    winnerId = proposal.nominees[0].id;
    
    for (const [id, entry] of tally) {
      if (entry.weight > maxWeight) {
        maxWeight = entry.weight;
        winnerId = id;
      }
    }
    
    winnerName = proposal.nominees.find(n => n.id === winnerId)!.name;
  } else {
    // ─── QUORUM NOT MET: RNG Fallback ───
    selectionMethod = 'rng_fallback';
    
    // Use on-chain RNG to pick from nominees
    const salt = `dao-${proposal.id}-${proposal.quarter}-fallback`;
    rngProof = await generateRandom(proposal.nominees.length, salt, 'pulsechain');
    
    const winnerIndex = rngProof.value;
    winnerId = proposal.nominees[winnerIndex].id;
    winnerName = proposal.nominees[winnerIndex].name;
  }

  // Build result
  const result: ProposalResult = {
    winnerId,
    winnerName,
    selectionMethod,
    voteTally: tally,
    quorumMet: quorum.met,
    totalVotesCast: proposal.votes.length,
    totalWeight: quorum.totalWeight,
    participationRate: quorum.actual,
    rngProof,
    emailSent: false,
    finalizedAt: Date.now(),
  };

  // Send email notification
  if (emailConfig) {
    const nominees = proposal.nominees.map(n => {
      const t = tally.get(n.id)!;
      return { name: n.name, votes: t.votes, percentage: t.percentage };
    });

    const emailData: DAOResultEmail = {
      quarter: proposal.quarter,
      selectionMethod,
      winnerName,
      nominees,
      quorumMet: quorum.met,
      quorumThreshold: proposal.quorumThreshold,
      actualParticipation: quorum.actual,
      totalVotesCast: proposal.votes.length,
      treasuryAmount: proposal.treasuryAmount,
      treasuryUsdValue: proposal.treasuryUsdValue,
      rngSeed: rngProof?.seed,
      blockNumber: rngProof?.blockNumber,
    };

    const emailResult = await sendDAOResultEmail(emailConfig, emailData);
    result.emailSent = emailResult.success;
    result.emailMessageId = emailResult.messageId;
  }

  // Update proposal status
  proposal.status = 'finalized';
  proposal.result = result;

  return result;
}

/**
 * Check if a proposal's deadline has passed and auto-finalize if needed
 * This should be called by a cron job or scheduled task
 */
export async function checkAndFinalizeExpiredProposals(
  proposals: Proposal[],
  emailConfig?: EmailConfig
): Promise<ProposalResult[]> {
  const results: ProposalResult[] = [];
  const now = Date.now();

  for (const proposal of proposals) {
    if (proposal.status === 'active' && now > proposal.votingCloses) {
      proposal.status = 'closed';
      const result = await finalizeProposal(proposal, emailConfig);
      results.push(result);
    }
  }

  return results;
}

/**
 * Get the next quarterly deadline
 */
export function getNextQuarterlyDeadline(): { quarter: string; opens: Date; closes: Date } {
  const now = new Date();
  const year = now.getFullYear();

  for (const sched of QUARTERLY_SCHEDULE) {
    const opens = new Date(year, sched.openMonth, sched.openDay);
    const closes = new Date(year, sched.closeMonth, sched.closeDay, 23, 59, 59);

    if (now < closes) {
      return {
        quarter: `${sched.quarter} ${year}`,
        opens,
        closes,
      };
    }
  }

  // Next year Q1
  return {
    quarter: `Q1 ${year + 1}`,
    opens: new Date(year + 1, 0, 1),
    closes: new Date(year + 1, 0, 31, 23, 59, 59),
  };
}
