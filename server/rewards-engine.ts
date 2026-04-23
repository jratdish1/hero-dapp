/**
 * HERO Holder Rewards — Weighted Random Airdrop Selection
 * 
 * Randomly selects HERO holders for bonus airdrops.
 * Weighted by holdings — more HERO = higher chance of selection.
 * Excludes team wallets, dead address, and LP contracts.
 */

import { weightedRandom, selectMultipleWinners, type RNGResult, type WeightedItem } from '../shared/rng-engine';

// ─── Types ───────────────────────────────────────────────────────

export interface HolderSnapshot {
  wallet: string;
  balance: bigint;
  percentage: number; // % of circulating supply
}

export interface RewardRound {
  id: string;
  title: string;
  description: string;
  rewardAmount: string;      // Total reward pool
  rewardPerWinner: string;   // Per-winner amount
  winnerCount: number;
  snapshotBlock: number;
  snapshotTimestamp: number;
  holders: HolderSnapshot[];
  excludedWallets: string[];
  status: 'pending' | 'snapshot_taken' | 'drawn' | 'distributed';
  winners?: RewardWinner[];
  drawnAt?: number;
}

export interface RewardWinner {
  wallet: string;
  balance: bigint;
  selectionWeight: number;   // Their weight relative to total
  rngProof: RNGResult;
  rewardAmount: string;
  distributed: boolean;
  distributionTxHash?: string;
}

// ─── Constants ───────────────────────────────────────────────────

const EXCLUDED_ADDRESSES = [
  '0x000000000000000000000000000000000000dEaD', // Dead address
  '0x0000000000000000000000000000000000000000', // Zero address
  // Add LP contract addresses, team wallets, etc.
];

const MIN_BALANCE_FOR_ELIGIBILITY = 1000n; // Must hold at least 1000 HERO

// ─── Core Functions ──────────────────────────────────────────────

/**
 * Create a new reward round
 */
export function createRewardRound(
  title: string,
  description: string,
  rewardAmount: string,
  winnerCount: number,
  additionalExclusions: string[] = []
): RewardRound {
  if (!title || title.trim().length === 0) throw new Error('Reward round title is required');
  if (winnerCount < 1) throw new Error(`Winner count must be at least 1, got: ${winnerCount}`);
  if (!rewardAmount || rewardAmount.trim().length === 0) throw new Error('Reward amount is required');

  // Validate exclusion wallet formats
  for (const addr of additionalExclusions) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      throw new Error(`Invalid exclusion wallet address format: ${addr}`);
    }
  }

  return {
    id: `reward-${Date.now()}`,
    title,
    description,
    rewardAmount,
    rewardPerWinner: '', // Calculated after winner count confirmed
    winnerCount,
    snapshotBlock: 0,
    snapshotTimestamp: 0,
    holders: [],
    excludedWallets: [...EXCLUDED_ADDRESSES, ...additionalExclusions.map(a => a.toLowerCase())],
    status: 'pending',
  };
}

/**
 * Take a holder snapshot (filter out excluded wallets and low balances)
 */
export function processSnapshot(
  round: RewardRound,
  allHolders: Array<{ wallet: string; balance: bigint }>,
  blockNumber: number
): void {
  const totalSupply = allHolders.reduce((sum, h) => sum + h.balance, 0n);

  round.holders = allHolders
    .filter(h => {
      const addr = h.wallet.toLowerCase();
      return (
        !round.excludedWallets.includes(addr) &&
        h.balance >= MIN_BALANCE_FOR_ELIGIBILITY
      );
    })
    .map(h => ({
      wallet: h.wallet.toLowerCase(),
      balance: h.balance,
      percentage: totalSupply > 0n ? Number((h.balance * 10000n) / totalSupply) / 100 : 0,
    }))
    .sort((a, b) => (b.balance > a.balance ? 1 : -1));

  round.snapshotBlock = blockNumber;
  round.snapshotTimestamp = Date.now();
  round.status = 'snapshot_taken';
}

/**
 * Draw winners using weighted random selection
 * Weight = HERO balance (more HERO = higher chance)
 */
export async function drawRewardWinners(
  round: RewardRound,
  chain: 'pulsechain' | 'base' = 'pulsechain'
): Promise<RewardWinner[]> {
  if (round.holders.length === 0) throw new Error('No eligible holders');
  if (round.status === 'drawn') throw new Error('Already drawn');

  const actualWinnerCount = Math.min(round.winnerCount, round.holders.length);
  const totalWeight = round.holders.reduce((sum, h) => sum + Number(h.balance / 1000000n), 0);

  // Build weighted items array
  const weightedHolders: WeightedItem<HolderSnapshot>[] = round.holders.map(h => ({
    item: h,
    weight: Math.max(1, Number(h.balance / 1000000n)), // Scale down for manageable numbers
  }));

  const winners: RewardWinner[] = [];
  const usedWallets = new Set<string>();

  // Draw winners — each draw depends on previous (to exclude already-selected)
  // so we cannot fully parallelize, but we add better error context
  for (let i = 0; i < actualWinnerCount; i++) {
    const available = weightedHolders.filter(w => !usedWallets.has(w.item.wallet));
    if (available.length === 0) {
      console.warn(`Only ${i} winners drawn out of ${actualWinnerCount} requested — ran out of eligible holders`);
      break;
    }

    const salt = `reward-${round.id}-winner-${i}`;
    const { selected, rng } = await weightedRandom(available, salt, chain);

    usedWallets.add(selected.wallet);
    winners.push({
      wallet: selected.wallet,
      balance: selected.balance,
      selectionWeight: totalWeight > 0 ? (Number(selected.balance / 1000000n) / totalWeight) * 100 : 0,
      rngProof: rng,
      rewardAmount: round.rewardPerWinner || `${round.rewardAmount} / ${actualWinnerCount}`,
      distributed: false,
    });
  }

  round.winners = winners;
  round.status = 'drawn';
  round.drawnAt = Date.now();

  return winners;
}

/**
 * Get reward round statistics
 */
export function getRewardStats(round: RewardRound): {
  totalHolders: number;
  eligibleHolders: number;
  totalBalance: string;
  averageBalance: string;
  medianBalance: string;
  topHolderPercentage: number;
} {
  const holders = round.holders;
  const totalBalance = holders.reduce((sum, h) => sum + h.balance, 0n);
  const avgBalance = holders.length > 0 ? totalBalance / BigInt(holders.length) : 0n;

  const sorted = [...holders].sort((a, b) => (a.balance > b.balance ? 1 : -1));
  const medianBalance = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)].balance : 0n;

  return {
    totalHolders: holders.length,
    eligibleHolders: holders.filter(h => h.balance >= MIN_BALANCE_FOR_ELIGIBILITY).length,
    totalBalance: totalBalance.toString(),
    averageBalance: avgBalance.toString(),
    medianBalance: medianBalance.toString(),
    topHolderPercentage: holders.length > 0 ? holders[0].percentage : 0,
  };
}
