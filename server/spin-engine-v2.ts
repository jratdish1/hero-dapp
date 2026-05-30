/**
 * HERO Spin Engine V2 — Enhanced with:
 * - Database persistence (Drizzle/MySQL)
 * - Streak multiplier APPLIED to rewards
 * - NFT-gated tiered wheels
 * - Burn-for-second-spin mechanism
 * - Rate limiting
 * - Leaderboard updates
 * - Claim flow support
 */
import { generateRandom, type RNGResult } from './lib/rng-engine';
import { ethers } from 'ethers';

// ─── Types ───────────────────────────────────────────────────────
export interface SpinSegment {
  id: string;
  label: string;
  rewardType: 'hero_tokens' | 'nft_whitelist' | 'merch_discount' | 'badge' | 'nothing' | 'jackpot' | 'second_chance';
  rewardValue: string;
  weight: number;
  color: string;
  tier?: 'bronze' | 'silver' | 'gold' | 'all';
}

export interface SpinResultV2 {
  segmentId: string;
  segmentLabel: string;
  rewardType: string;
  rewardValue: string;
  finalRewardValue: string;
  multiplier: number;
  streakAtSpin: number;
  rngProof: RNGResult;
  spinTimestamp: number;
  claimable: boolean;
  claimId?: string;
  nftTier: string;
}

export interface UserSpinRecordV2 {
  wallet: string;
  lastSpinDate: string;
  currentStreak: number;
  longestStreak: number;
  totalSpins: number;
  nftTier: 'bronze' | 'silver' | 'gold';
  totalHeroEarned: number;
  totalBurned: number;
  history: SpinResultV2[];
}

export interface SpinEligibility {
  eligible: boolean;
  reason?: string;
  streak: number;
  bonus: { multiplier: number; label: string };
  totalSpins: number;
  nftTier: string;
  nextSpinAt?: string;
  canBurnForSpin: boolean;
  burnCost: string;
}

// ─── Tiered Wheel Configurations ─────────────────────────────────
export const BRONZE_WHEEL: SpinSegment[] = [
  { id: 'hero-500',    label: '500 HERO',       rewardType: 'hero_tokens',    rewardValue: '500',    weight: 30, color: '#22c55e', tier: 'all' },
  { id: 'hero-1000',   label: '1,000 HERO',     rewardType: 'hero_tokens',    rewardValue: '1000',   weight: 20, color: '#16a34a', tier: 'all' },
  { id: 'hero-2500',   label: '2,500 HERO',     rewardType: 'hero_tokens',    rewardValue: '2500',   weight: 10, color: '#15803d', tier: 'all' },
  { id: 'nft-wl',      label: 'NFT Whitelist',  rewardType: 'nft_whitelist',  rewardValue: '1',      weight: 5,  color: '#8b5cf6', tier: 'all' },
  { id: 'merch-10',    label: '10% Off Merch',  rewardType: 'merch_discount', rewardValue: '10',     weight: 10, color: '#f59e0b', tier: 'all' },
  { id: 'badge-daily', label: 'Daily Badge',    rewardType: 'badge',          rewardValue: 'daily',  weight: 12, color: '#3b82f6', tier: 'all' },
  { id: 'nothing',     label: 'Try Again',      rewardType: 'nothing',        rewardValue: '0',      weight: 11, color: '#6b7280', tier: 'all' },
  { id: 'jackpot',     label: '10,000 HERO!',   rewardType: 'jackpot',        rewardValue: '10000',  weight: 2,  color: '#eab308', tier: 'bronze' },
];

export const SILVER_WHEEL: SpinSegment[] = [
  { id: 'hero-1000',   label: '1,000 HERO',     rewardType: 'hero_tokens',    rewardValue: '1000',   weight: 28, color: '#22c55e', tier: 'all' },
  { id: 'hero-2500',   label: '2,500 HERO',     rewardType: 'hero_tokens',    rewardValue: '2500',   weight: 20, color: '#16a34a', tier: 'all' },
  { id: 'hero-5000',   label: '5,000 HERO',     rewardType: 'hero_tokens',    rewardValue: '5000',   weight: 10, color: '#15803d', tier: 'silver' },
  { id: 'nft-wl',      label: 'NFT Whitelist',  rewardType: 'nft_whitelist',  rewardValue: '1',      weight: 7,  color: '#8b5cf6', tier: 'all' },
  { id: 'merch-25',    label: '25% Off Merch',  rewardType: 'merch_discount', rewardValue: '25',     weight: 8,  color: '#d97706', tier: 'silver' },
  { id: 'badge-daily', label: 'Silver Badge',   rewardType: 'badge',          rewardValue: 'silver', weight: 10, color: '#3b82f6', tier: 'all' },
  { id: 'nothing',     label: 'Try Again',      rewardType: 'nothing',        rewardValue: '0',      weight: 10, color: '#6b7280', tier: 'all' },
  { id: 'jackpot',     label: '50,000 HERO!',   rewardType: 'jackpot',        rewardValue: '50000',  weight: 3,  color: '#eab308', tier: 'silver' },
  { id: 'second',      label: '2nd Chance',     rewardType: 'second_chance',  rewardValue: '1',      weight: 4,  color: '#ec4899', tier: 'silver' },
];

export const GOLD_WHEEL: SpinSegment[] = [
  { id: 'hero-2500',   label: '2,500 HERO',     rewardType: 'hero_tokens',    rewardValue: '2500',   weight: 25, color: '#22c55e', tier: 'all' },
  { id: 'hero-5000',   label: '5,000 HERO',     rewardType: 'hero_tokens',    rewardValue: '5000',   weight: 18, color: '#16a34a', tier: 'all' },
  { id: 'hero-10000',  label: '10,000 HERO',    rewardType: 'hero_tokens',    rewardValue: '10000',  weight: 8,  color: '#15803d', tier: 'gold' },
  { id: 'nft-wl',      label: 'NFT Whitelist',  rewardType: 'nft_whitelist',  rewardValue: '1',      weight: 8,  color: '#8b5cf6', tier: 'all' },
  { id: 'merch-50',    label: '50% Off Merch',  rewardType: 'merch_discount', rewardValue: '50',     weight: 5,  color: '#d97706', tier: 'gold' },
  { id: 'badge-gold',  label: 'Gold Badge',     rewardType: 'badge',          rewardValue: 'gold',   weight: 8,  color: '#3b82f6', tier: 'all' },
  { id: 'nothing',     label: 'Try Again',      rewardType: 'nothing',        rewardValue: '0',      weight: 8,  color: '#6b7280', tier: 'all' },
  { id: 'jackpot',     label: '250,000 HERO!',  rewardType: 'jackpot',        rewardValue: '250000', weight: 4,  color: '#eab308', tier: 'gold' },
  { id: 'second',      label: '2nd Chance',     rewardType: 'second_chance',  rewardValue: '1',      weight: 6,  color: '#ec4899', tier: 'gold' },
  { id: 'nft-free',    label: 'Free NFT Mint',  rewardType: 'nft_whitelist',  rewardValue: 'free',   weight: 3,  color: '#f43f5e', tier: 'gold' },
  { id: 'merch-free',  label: 'Free Merch!',    rewardType: 'merch_discount', rewardValue: '100',    weight: 2,  color: '#10b981', tier: 'gold' },
  { id: 'mega-jack',   label: '1M HERO!!!',     rewardType: 'jackpot',        rewardValue: '1000000',weight: 1,  color: '#ff0000', tier: 'gold' },
];

// ─── Core Functions ──────────────────────────────────────────────

/**
 * Get wheel segments based on NFT tier
 */
export function getWheelForTier(tier: 'bronze' | 'silver' | 'gold'): SpinSegment[] {
  switch (tier) {
    case 'gold': return GOLD_WHEEL;
    case 'silver': return SILVER_WHEEL;
    default: return BRONZE_WHEEL;
  }
}

/**
 * Determine NFT tier based on holdings
 */
export function determineNFTTier(nftCount: number, heroStaked: number): 'bronze' | 'silver' | 'gold' {
  if (nftCount >= 10 || heroStaked >= 1000000) return 'gold';
  if (nftCount >= 3) return 'silver';
  return 'bronze';
}

/**
 * Check if a user can spin today
 */
export function canSpinTodayV2(record: UserSpinRecordV2 | null): boolean {
  if (!record) return true;
  const today = new Date().toISOString().split('T')[0];
  return record.lastSpinDate !== today;
}

/**
 * Get streak bonus multiplier (APPLIED to rewards)
 */
export function getStreakBonusV2(streak: number): { multiplier: number; label: string } {
  if (streak >= 30) return { multiplier: 3.0, label: '3x — Monthly Master!' };
  if (streak >= 14) return { multiplier: 2.0, label: '2x — Two Week Warrior' };
  if (streak >= 7)  return { multiplier: 1.5, label: '1.5x — Weekly Warrior' };
  if (streak >= 3)  return { multiplier: 1.2, label: '1.2x — Getting Started' };
  return { multiplier: 1.0, label: 'No bonus yet' };
}

/**
 * Calculate burn cost for a second spin (increases with streak to prevent abuse)
 */
export function getBurnCost(totalSpinsToday: number): string {
  const baseCost = 100;
  const multiplier = Math.pow(2, totalSpinsToday - 1); // 100, 200, 400, 800...
  return String(Math.min(baseCost * multiplier, 10000)); // Cap at 10K
}

/**
 * Perform an enhanced spin with all V2 features
 */
export async function performSpinV2(
  wallet: string,
  record: UserSpinRecordV2 | null,
  nftTier: 'bronze' | 'silver' | 'gold',
  chain: 'pulsechain' | 'base' = 'pulsechain'
): Promise<SpinResultV2> {
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    throw new Error(`Invalid wallet address: ${wallet}`);
  }

  const segments = getWheelForTier(nftTier);
  const streak = record?.currentStreak || 0;
  const bonus = getStreakBonusV2(streak);
  const today = new Date().toISOString().split('T')[0];
  const totalWeight = segments.reduce((sum, s) => sum + s.weight, 0);
  const salt = `spin-v2-${wallet}-${today}-${nftTier}`;

  const rng = await generateRandom(totalWeight, salt, chain);

  let cumulative = 0;
  let winningSegment: SpinSegment | null = null;
  for (const segment of segments) {
    cumulative += segment.weight;
    if (rng.value < cumulative) {
      winningSegment = segment;
      break;
    }
  }

  if (!winningSegment) {
    throw new Error(`Spin selection failed: value=${rng.value}, totalWeight=${totalWeight}`);
  }

  // APPLY streak multiplier to token rewards
  let finalRewardValue = winningSegment.rewardValue;
  if (winningSegment.rewardType === 'hero_tokens' || winningSegment.rewardType === 'jackpot') {
    const baseValue = parseInt(winningSegment.rewardValue);
    finalRewardValue = String(Math.floor(baseValue * bonus.multiplier));
  }

  // Determine if claimable (token rewards are claimable)
  const claimable = ['hero_tokens', 'jackpot'].includes(winningSegment.rewardType);
  const claimId = claimable ? ethers.keccak256(ethers.toUtf8Bytes(`${wallet}-${rng.proofHash}-${Date.now()}`)).slice(0, 18) : undefined;

  return {
    segmentId: winningSegment.id,
    segmentLabel: winningSegment.label,
    rewardType: winningSegment.rewardType,
    rewardValue: winningSegment.rewardValue,
    finalRewardValue,
    multiplier: bonus.multiplier,
    streakAtSpin: streak,
    rngProof: rng,
    spinTimestamp: Date.now(),
    claimable,
    claimId,
    nftTier,
  };
}

/**
 * Update user's spin record after a spin (V2 with enhanced tracking)
 */
export function updateSpinRecordV2(
  record: UserSpinRecordV2 | null,
  wallet: string,
  result: SpinResultV2
): UserSpinRecordV2 {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const heroEarned = ['hero_tokens', 'jackpot'].includes(result.rewardType)
    ? parseInt(result.finalRewardValue) : 0;

  if (!record) {
    return {
      wallet,
      lastSpinDate: today,
      currentStreak: 1,
      longestStreak: 1,
      totalSpins: 1,
      nftTier: result.nftTier as any,
      totalHeroEarned: heroEarned,
      totalBurned: 0,
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
    nftTier: result.nftTier as any,
    totalHeroEarned: record.totalHeroEarned + heroEarned,
    history: [...record.history.slice(-29), result],
  };
}

/**
 * Generate a claim signature for on-chain reward distribution
 * This would be verified by the HeroRewardDistributor contract
 */
export function generateClaimSignature(
  wallet: string,
  amount: string,
  claimId: string,
  proofHash: string
): { message: string; claimData: object } {
  const claimData = {
    wallet: wallet.toLowerCase(),
    amount,
    claimId,
    proofHash,
    expiry: Date.now() + 86400000, // 24h expiry
    nonce: Date.now(),
  };
  const message = ethers.solidityPackedKeccak256(
    ['address', 'uint256', 'bytes32', 'uint256'],
    [wallet, BigInt(amount), ethers.zeroPadBytes(ethers.toUtf8Bytes(claimId), 32), BigInt(claimData.expiry)]
  );
  return { message, claimData };
}

/**
 * Rate limiter — simple in-memory sliding window
 */
const rateLimitMap = new Map<string, number[]>();
export function checkRateLimit(wallet: string, maxPerMinute: number = 5): boolean {
  const now = Date.now();
  const key = wallet.toLowerCase();
  const timestamps = rateLimitMap.get(key) || [];
  const recent = timestamps.filter(t => now - t < 60000);
  rateLimitMap.set(key, recent);
  if (recent.length >= maxPerMinute) return false;
  recent.push(now);
  rateLimitMap.set(key, recent);
  return true;
}
