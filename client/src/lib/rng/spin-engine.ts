/**
 * HERO Daily Spin-the-Wheel — Gamification Engine
 * 
 * One spin per wallet per day. RNG determines the reward.
 * Streak bonuses for consecutive daily spins.
 */

import { generateRandom, type RNGResult } from '../shared/rng-engine';

// ─── Types ───────────────────────────────────────────────────────

export type RewardType = 'hero_tokens' | 'nft_whitelist' | 'merch_discount' | 'badge' | 'nothing' | 'jackpot';

export interface SpinSegment {
  id: string;
  label: string;
  rewardType: RewardType;
  rewardValue: string;
  weight: number;       // Probability weight
  color: string;        // Hex color for wheel segment
}

export interface SpinResult {
  segmentId: string;
  segmentLabel: string;
  rewardType: RewardType;
  rewardValue: string;
  rngProof: RNGResult;
  spinTimestamp: number;
}

export interface UserSpinRecord {
  wallet: string;
  lastSpinDate: string;  // YYYY-MM-DD
  currentStreak: number;
  longestStreak: number;
  totalSpins: number;
  totalRewards: string[];
  history: SpinResult[];
}

// ─── Default Wheel Configuration ─────────────────────────────────

export const DEFAULT_WHEEL_SEGMENTS: SpinSegment[] = [
  { id: 'hero-500',    label: '500 HERO',       rewardType: 'hero_tokens',    rewardValue: '500',    weight: 30, color: '#22c55e' },
  { id: 'hero-1000',   label: '1,000 HERO',     rewardType: 'hero_tokens',    rewardValue: '1000',   weight: 20, color: '#16a34a' },
  { id: 'hero-5000',   label: '5,000 HERO',     rewardType: 'hero_tokens',    rewardValue: '5000',   weight: 8,  color: '#15803d' },
  { id: 'nft-wl',      label: 'NFT Whitelist',  rewardType: 'nft_whitelist',  rewardValue: '1',      weight: 5,  color: '#8b5cf6' },
  { id: 'merch-10',    label: '10% Off Merch',  rewardType: 'merch_discount', rewardValue: '10',     weight: 10, color: '#f59e0b' },
  { id: 'merch-25',    label: '25% Off Merch',  rewardType: 'merch_discount', rewardValue: '25',     weight: 3,  color: '#d97706' },
  { id: 'badge-daily', label: 'Daily Badge',    rewardType: 'badge',          rewardValue: 'daily',  weight: 12, color: '#3b82f6' },
  { id: 'nothing',     label: 'Try Again',      rewardType: 'nothing',        rewardValue: '0',      weight: 10, color: '#6b7280' },
  { id: 'jackpot',     label: '50,000 HERO!',   rewardType: 'jackpot',        rewardValue: '50000',  weight: 2,  color: '#eab308' },
];

// ─── Core Functions ──────────────────────────────────────────────

/**
 * Check if a user can spin today
 */
export function canSpinToday(record: UserSpinRecord | null): boolean {
  if (!record) return true;
  const today = new Date().toISOString().split('T')[0];
  return record.lastSpinDate !== today;
}

/**
 * Perform a spin using on-chain RNG
 */
export async function performSpin(
  wallet: string,
  segments: SpinSegment[] = DEFAULT_WHEEL_SEGMENTS,
  chain: 'pulsechain' | 'base' = 'pulsechain'
): Promise<SpinResult> {
  const today = new Date().toISOString().split('T')[0];
  const totalWeight = segments.reduce((sum, s) => sum + s.weight, 0);
  const salt = `spin-${wallet}-${today}`;

  const rng = await generateRandom(totalWeight, salt, chain);

  let cumulative = 0;
  for (const segment of segments) {
    cumulative += segment.weight;
    if (rng.value < cumulative) {
      return {
        segmentId: segment.id,
        segmentLabel: segment.label,
        rewardType: segment.rewardType,
        rewardValue: segment.rewardValue,
        rngProof: rng,
        spinTimestamp: Date.now(),
      };
    }
  }

  // Fallback
  const last = segments[segments.length - 1];
  return {
    segmentId: last.id,
    segmentLabel: last.label,
    rewardType: last.rewardType,
    rewardValue: last.rewardValue,
    rngProof: rng,
    spinTimestamp: Date.now(),
  };
}

/**
 * Update user's spin record after a spin
 */
export function updateSpinRecord(
  record: UserSpinRecord | null,
  wallet: string,
  result: SpinResult
): UserSpinRecord {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (!record) {
    return {
      wallet,
      lastSpinDate: today,
      currentStreak: 1,
      longestStreak: 1,
      totalSpins: 1,
      totalRewards: result.rewardType !== 'nothing' ? [result.segmentLabel] : [],
      history: [result],
    };
  }

  const isConsecutive = record.lastSpinDate === yesterday;
  const newStreak = isConsecutive ? record.currentStreak + 1 : 1;

  return {
    ...record,
    lastSpinDate: today,
    currentStreak: newStreak,
    longestStreak: Math.max(record.longestStreak, newStreak),
    totalSpins: record.totalSpins + 1,
    totalRewards: result.rewardType !== 'nothing'
      ? [...record.totalRewards, result.segmentLabel]
      : record.totalRewards,
    history: [...record.history.slice(-29), result], // Keep last 30 spins
  };
}

/**
 * Get streak bonus multiplier
 */
export function getStreakBonus(streak: number): { multiplier: number; label: string } {
  if (streak >= 30) return { multiplier: 3.0, label: '3x — Monthly Master!' };
  if (streak >= 14) return { multiplier: 2.0, label: '2x — Two Week Warrior' };
  if (streak >= 7)  return { multiplier: 1.5, label: '1.5x — Weekly Warrior' };
  if (streak >= 3)  return { multiplier: 1.2, label: '1.2x — Getting Started' };
  return { multiplier: 1.0, label: 'No bonus yet' };
}
