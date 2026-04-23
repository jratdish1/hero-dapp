/**
 * HERO Community Giveaways/Raffles Engine
 * 
 * Provably fair raffle system for HERO community.
 * Entry requires holding HERO tokens. Winner selected via on-chain RNG.
 */

import { generateRandom, selectMultipleWinners, type RNGResult } from '../shared/rng-engine';

// ─── Types ───────────────────────────────────────────────────────

export interface RaffleConfig {
  id: string;
  title: string;
  description: string;
  prize: string;
  prizeValue?: string;
  minHeroBalance: bigint;       // Minimum HERO to enter
  maxEntries: number;           // Max participants (0 = unlimited)
  winnerCount: number;          // How many winners
  startTime: number;            // Unix ms
  endTime: number;              // Unix ms
  createdBy: string;            // Admin wallet
}

export interface RaffleEntry {
  wallet: string;
  heroBalance: bigint;
  enteredAt: number;
  txHash?: string;
}

export interface Raffle extends RaffleConfig {
  entries: RaffleEntry[];
  status: 'upcoming' | 'active' | 'drawing' | 'completed' | 'cancelled';
  winners?: RaffleWinner[];
  drawTimestamp?: number;
}

export interface RaffleWinner {
  wallet: string;
  heroBalance: bigint;
  rngProof: RNGResult;
  prizeAwarded: boolean;
  awardTxHash?: string;
}

export interface RaffleResult {
  raffleId: string;
  winners: RaffleWinner[];
  totalEntries: number;
  drawBlockNumber: number;
  drawBlockHash: string;
  drawTimestamp: string;
  verificationUrl: string;
}

// ─── Core Functions ──────────────────────────────────────────────

/**
 * Create a new raffle
 */
export function createRaffle(config: RaffleConfig): Raffle {
  if (config.winnerCount < 1) throw new Error('Must have at least 1 winner');
  if (config.endTime <= config.startTime) throw new Error('End time must be after start time');

  const now = Date.now();
  return {
    ...config,
    entries: [],
    status: now < config.startTime ? 'upcoming' : 'active',
  };
}

/**
 * Enter a raffle
 */
export function enterRaffle(raffle: Raffle, wallet: string, heroBalance: bigint): RaffleEntry {
  if (raffle.status !== 'active') throw new Error('Raffle is not active');
  if (Date.now() > raffle.endTime) throw new Error('Raffle has ended');
  if (heroBalance < raffle.minHeroBalance) {
    throw new Error(`Must hold at least ${raffle.minHeroBalance.toString()} HERO to enter`);
  }
  if (raffle.maxEntries > 0 && raffle.entries.length >= raffle.maxEntries) {
    throw new Error('Raffle is full');
  }

  // Check for duplicate entry
  const existing = raffle.entries.find(e => e.wallet.toLowerCase() === wallet.toLowerCase());
  if (existing) throw new Error('Already entered this raffle');

  const entry: RaffleEntry = {
    wallet: wallet.toLowerCase(),
    heroBalance,
    enteredAt: Date.now(),
  };

  raffle.entries.push(entry);
  return entry;
}

/**
 * Draw raffle winners using on-chain RNG
 */
export async function drawRaffleWinners(
  raffle: Raffle,
  chain: 'pulsechain' | 'base' = 'pulsechain'
): Promise<RaffleResult> {
  if (raffle.entries.length === 0) throw new Error('No entries to draw from');
  if (raffle.status === 'completed') throw new Error('Raffle already drawn');

  raffle.status = 'drawing';

  const actualWinnerCount = Math.min(raffle.winnerCount, raffle.entries.length);
  const salt = `raffle-${raffle.id}-draw`;

  const { winners: winnerIndices, proofs } = await selectMultipleWinners(
    raffle.entries.length,
    actualWinnerCount,
    salt,
    chain
  );

  const winners: RaffleWinner[] = winnerIndices.map((idx, i) => ({
    wallet: raffle.entries[idx].wallet,
    heroBalance: raffle.entries[idx].heroBalance,
    rngProof: proofs[i],
    prizeAwarded: false,
  }));

  raffle.winners = winners;
  raffle.status = 'completed';
  raffle.drawTimestamp = Date.now();

  return {
    raffleId: raffle.id,
    winners,
    totalEntries: raffle.entries.length,
    drawBlockNumber: proofs[0]?.blockNumber || 0,
    drawBlockHash: proofs[0]?.blockHash || '',
    drawTimestamp: new Date().toISOString(),
    verificationUrl: `https://scan.pulsechain.com/block/${proofs[0]?.blockNumber}`,
  };
}

/**
 * Check and auto-draw expired raffles
 */
export async function checkAndDrawExpiredRaffles(
  raffles: Raffle[],
  chain: 'pulsechain' | 'base' = 'pulsechain'
): Promise<RaffleResult[]> {
  const results: RaffleResult[] = [];
  const now = Date.now();

  for (const raffle of raffles) {
    if (raffle.status === 'active' && now > raffle.endTime && raffle.entries.length > 0) {
      const result = await drawRaffleWinners(raffle, chain);
      results.push(result);
    }
  }

  return results;
}
