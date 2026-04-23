/**
 * HERO RNG Engine — Shared randomness module for all RNG features
 * Uses on-chain seed (block hash + keccak256) for provable fairness
 * Compatible with RNG FLOW T1 tier (250 draws/day, FREE)
 * 
 * @module rng-engine
 */

import { ethers } from 'ethers';

// PulseChain RPC endpoints
const PULSECHAIN_RPC = 'https://rpc.pulsechain.com';
const BASE_RPC = 'https://mainnet.base.org';

export interface RNGResult {
  /** The random number (0 to max-1) */
  value: number;
  /** The seed used for generation */
  seed: string;
  /** Block hash used as entropy source */
  blockHash: string;
  /** Block number used */
  blockNumber: number;
  /** Chain used for entropy */
  chain: 'pulsechain' | 'base';
  /** ISO timestamp */
  timestamp: string;
  /** Keccak256 hash of all inputs (verification) */
  proofHash: string;
}

export interface WeightedItem<T> {
  item: T;
  weight: number;
}

/**
 * Get the latest block hash from PulseChain or BASE for entropy
 */
export async function getBlockEntropy(chain: 'pulsechain' | 'base' = 'pulsechain'): Promise<{
  blockHash: string;
  blockNumber: number;
}> {
  const rpc = chain === 'pulsechain' ? PULSECHAIN_RPC : BASE_RPC;
  const provider = new ethers.JsonRpcProvider(rpc);
  const block = await provider.getBlock('latest');
  
  if (!block || !block.hash) {
    throw new Error(`Failed to get block from ${chain}`);
  }
  
  return {
    blockHash: block.hash,
    blockNumber: block.number,
  };
}

/**
 * Generate a provably fair random number using on-chain entropy
 * 
 * @param max - Upper bound (exclusive). Result will be 0 to max-1
 * @param salt - Additional salt for uniqueness (e.g., proposalId, raffleId)
 * @param chain - Which chain to use for block hash entropy
 * @returns RNGResult with the random value and all verification data
 */
export async function generateRandom(
  max: number,
  salt: string = '',
  chain: 'pulsechain' | 'base' = 'pulsechain'
): Promise<RNGResult> {
  if (max <= 0) throw new Error('Max must be positive');
  
  const { blockHash, blockNumber } = await getBlockEntropy(chain);
  const timestamp = new Date().toISOString();
  
  // Combine all entropy sources
  const seed = ethers.solidityPackedKeccak256(
    ['bytes32', 'string', 'string'],
    [blockHash, salt, timestamp]
  );
  
  // Convert seed to number and mod by max
  const seedBigInt = BigInt(seed);
  const value = Number(seedBigInt % BigInt(max));
  
  // Create proof hash for verification
  const proofHash = ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify({
      blockHash,
      blockNumber,
      salt,
      timestamp,
      max,
      result: value,
    }))
  );
  
  return {
    value,
    seed,
    blockHash,
    blockNumber,
    chain,
    timestamp,
    proofHash,
  };
}

/**
 * Weighted random selection — picks one item based on weights
 * Higher weight = higher probability of selection
 * 
 * @param items - Array of items with weights
 * @param salt - Additional salt for uniqueness
 * @param chain - Which chain for entropy
 * @returns The selected item and RNG proof
 */
export async function weightedRandom<T>(
  items: WeightedItem<T>[],
  salt: string = '',
  chain: 'pulsechain' | 'base' = 'pulsechain'
): Promise<{ selected: T; index: number; rng: RNGResult }> {
  if (items.length === 0) throw new Error('Items array cannot be empty');
  
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  if (totalWeight <= 0) throw new Error('Total weight must be positive');
  
  // Generate random number in range [0, totalWeight)
  const rng = await generateRandom(totalWeight, salt, chain);
  
  // Walk through items to find the selected one
  let cumulative = 0;
  for (let i = 0; i < items.length; i++) {
    cumulative += items[i].weight;
    if (rng.value < cumulative) {
      return { selected: items[i].item, index: i, rng };
    }
  }
  
  // Fallback (should never reach here)
  return { selected: items[items.length - 1].item, index: items.length - 1, rng };
}

/**
 * Select N unique winners from a pool using RNG
 * Each selection uses a different salt to ensure independence
 * 
 * @param poolSize - Total number of candidates
 * @param winnerCount - How many winners to select
 * @param baseSalt - Base salt for the selection round
 * @param chain - Which chain for entropy
 * @returns Array of winner indices and their RNG proofs
 */
export async function selectMultipleWinners(
  poolSize: number,
  winnerCount: number,
  baseSalt: string = '',
  chain: 'pulsechain' | 'base' = 'pulsechain'
): Promise<{ winners: number[]; proofs: RNGResult[] }> {
  if (winnerCount > poolSize) throw new Error('Cannot select more winners than pool size');
  
  const winners: number[] = [];
  const proofs: RNGResult[] = [];
  const used = new Set<number>();
  
  for (let i = 0; i < winnerCount; i++) {
    let attempts = 0;
    const maxAttempts = poolSize * 3; // Prevent infinite loop
    
    while (attempts < maxAttempts) {
      const salt = `${baseSalt}-round-${i}-attempt-${attempts}`;
      const rng = await generateRandom(poolSize, salt, chain);
      
      if (!used.has(rng.value)) {
        used.add(rng.value);
        winners.push(rng.value);
        proofs.push(rng);
        break;
      }
      attempts++;
    }
  }
  
  return { winners, proofs };
}

/**
 * Verify an RNG result by recomputing the proof hash
 */
export function verifyRNGResult(result: RNGResult, max: number, salt: string): boolean {
  const expectedProof = ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify({
      blockHash: result.blockHash,
      blockNumber: result.blockNumber,
      salt,
      timestamp: result.timestamp,
      max,
      result: result.value,
    }))
  );
  
  return expectedProof === result.proofHash;
}

/**
 * Generate a deterministic random number from a seed (no network call)
 * Used for client-side preview / simulation only
 */
export function deterministicRandom(seed: string, max: number): number {
  const hash = ethers.keccak256(ethers.toUtf8Bytes(seed));
  return Number(BigInt(hash) % BigInt(max));
}
