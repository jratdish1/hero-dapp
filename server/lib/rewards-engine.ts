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

  // ── BigInt-safe weight calculation ──
  // Instead of dividing by 1M (which truncates small holders to 0),
  // we find the GCD-like scaling factor to keep all weights proportional.
  // This ensures holders with < 1M tokens still get fair representation.
  const minBalance = round.holders.reduce(
    (min, h) => (h.balance < min && h.balance > 0n ? h.balance : min),
    round.holders[0]?.balance ?? 1n
  );
  // Scale all balances relative to the smallest holder (minimum weight = 1)
  // Cap at MAX_SAFE_INTEGER to avoid Number overflow
  const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
  const scaledWeights = round.holders.map(h => {
    const scaled = minBalance > 0n ? h.balance / minBalance : 1n;
    return scaled > MAX_SAFE ? Number(MAX_SAFE) : Number(scaled);
  });
  const totalWeight = scaledWeights.reduce((sum, w) => sum + w, 0);

  // Build weighted items array with precise scaling
  const weightedHolders: WeightedItem<HolderSnapshot>[] = round.holders.map((h, i) => ({
    item: h,
    weight: Math.max(1, scaledWeights[i]),
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
      selectionWeight: totalWeight > 0 ? ((scaledWeights[round.holders.findIndex(h => h.wallet === selected.wallet)] ?? 1) / totalWeight) * 100 : 0,
      rngProof: rng,
      rewardAmount: round.rewardPerWinner || (BigInt(round.rewardAmount) / BigInt(actualWinnerCount)).toString(),
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

  // Sort ascending for correct median calculation
  const sorted = [...holders].sort((a, b) => (a.balance < b.balance ? -1 : a.balance > b.balance ? 1 : 0));
  // Correct median: average of two middle elements for even-length arrays
  let medianBalance = 0n;
  if (sorted.length > 0) {
    const mid = Math.floor(sorted.length / 2);
    medianBalance = sorted.length % 2 === 0
      ? (sorted[mid - 1].balance + sorted[mid].balance) / 2n
      : sorted[mid].balance;
  }

  return {
    totalHolders: holders.length,
    eligibleHolders: holders.filter(h => h.balance >= MIN_BALANCE_FOR_ELIGIBILITY).length,
    totalBalance: totalBalance.toString(),
    averageBalance: avgBalance.toString(),
    medianBalance: medianBalance.toString(),
    topHolderPercentage: holders.length > 0 ? holders[0].percentage : 0,
  };
}
