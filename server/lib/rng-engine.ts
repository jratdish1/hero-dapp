/**
 * HERO RNG Engine — Shared randomness module for all RNG features
 * 
 * TIER ARCHITECTURE:
 * - T1 (Off-chain): Block hash + keccak256 — suitable for giveaways, spin wheel, holder rewards
 *   Free tier: 250 draws/day. No on-chain proof required.
 *   ⚠️ T1 LIMITATIONS: Block hash can be influenced by block producers (miners/validators).
 *   Timestamp is client-controlled. T1 is NOT suitable for high-stakes financial decisions.
 *   Use T2/T3 for NFT minting, DAO voting, or any scenario where manipulation could profit.
 * - T2 (On-chain Commit-Reveal): For NFT minting, DAO voting
 *   Requires on-chain commit phase, then reveal after N blocks.
 *   Resistant to miner manipulation due to commit-reveal separation.
 * - T3 (Chainlink VRF): For high-stakes, fully verifiable randomness
 *   Requires LINK token funding and VRF Coordinator contract on BASE.
 *   See: https://docs.chain.link/vrf
 * 
 * CURRENT IMPLEMENTATION:
 * - T1: Active (off-chain, provably fair via block hash + salt)
 * - T2: Active (Commit-Reveal on PulseChain, Chainlink VRF on BASE)
 * - T3: Active (Chainlink VRF Subscription on BASE)
 * 
 * See vrf-provider.ts for T2/T3 implementation details.
 * 
 * @module rng-engine
 */

import { ethers } from 'ethers';
import { getVRFRandom, VRFProvider, type VRFTier, type VRFResult, type VRFConfig } from './vrf-provider';

// Re-export VRF types and utilities for consumers
export { getVRFRandom, VRFProvider, type VRFTier, type VRFResult, type VRFConfig };

// PulseChain RPC endpoints
const PULSECHAIN_RPC = 'https://rpc.pulsechain.com';
const BASE_RPC = 'https://mainnet.base.org';

/** Maximum safe value for the `max` parameter to prevent BigInt precision loss */
const MAX_SAFE_BOUND = Number.MAX_SAFE_INTEGER; // 2^53 - 1

export type RNGTier = 'T1_OFFCHAIN' | 'T2_COMMIT_REVEAL' | 'T3_CHAINLINK_VRF';

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
  /** Which RNG tier was used */
  tier: RNGTier;
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
 * Generate a provably fair random number using on-chain entropy (T1 tier)
 * 
 * @param max - Upper bound (exclusive). Result will be 0 to max-1. Must be <= Number.MAX_SAFE_INTEGER
 * @param salt - Additional salt for uniqueness (e.g., proposalId, raffleId)
 * @param chain - Which chain to use for block hash entropy
 * @returns RNGResult with the random value and all verification data
 * @throws Error if max is invalid or exceeds safe integer bounds
 */
export async function generateRandom(
  max: number,
  salt: string = '',
  chain: 'pulsechain' | 'base' = 'pulsechain'
): Promise<RNGResult> {
  // Input validation
  if (!Number.isInteger(max) || max <= 0) {
    throw new Error(`Max must be a positive integer, got: ${max}`);
  }
  if (max > MAX_SAFE_BOUND) {
    throw new Error(`Max exceeds safe integer bounds (${MAX_SAFE_BOUND}). Use BigInt-native methods for larger ranges.`);
  }
  if (typeof salt !== 'string') {
    throw new Error(`Salt must be a string, got: ${typeof salt}`);
  }
  
  const { blockHash, blockNumber } = await getBlockEntropy(chain);
  const timestamp = new Date().toISOString();
  
  // Combine all entropy sources
  // Note: blockHash from ethers is always a valid 0x-prefixed 66-char hex string
  const seed = ethers.solidityPackedKeccak256(
    ['bytes32', 'string', 'string'],
    [blockHash, salt, timestamp]
  );
  
  // Validate seed is a proper hex string before BigInt conversion
  if (!seed || !/^0x[0-9a-fA-F]+$/.test(seed)) {
    throw new Error(`RNG seed generation failed: invalid hex seed "${seed}"`);
  }
  
  // Convert seed to positive BigInt and mod by max (safe because max <= MAX_SAFE_INTEGER)
  // Use bitwise AND with 2^256-1 to ensure positive value
  const seedBigInt = BigInt(seed) & ((1n << 256n) - 1n);
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
    tier: 'T1_OFFCHAIN',
  };
}

/**
 * Weighted random selection — picks one item based on weights
 * Higher weight = higher probability of selection
 * 
 * @param items - Array of items with weights. All weights must be positive.
 * @param salt - Additional salt for uniqueness
 * @param chain - Which chain for entropy
 * @returns The selected item and RNG proof
 * @throws Error if items array is empty or weights are invalid
 */
export async function weightedRandom<T>(
  items: WeightedItem<T>[],
  salt: string = '',
  chain: 'pulsechain' | 'base' = 'pulsechain'
): Promise<{ selected: T; index: number; rng: RNGResult }> {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Items array must be a non-empty array');
  }
  
  // Validate all weights are positive numbers
  for (let i = 0; i < items.length; i++) {
    if (typeof items[i].weight !== 'number' || items[i].weight <= 0 || !Number.isFinite(items[i].weight)) {
      throw new Error(`Invalid weight at index ${i}: ${items[i].weight}. All weights must be positive finite numbers.`);
    }
  }
  
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  if (totalWeight <= 0 || totalWeight > MAX_SAFE_BOUND) {
    throw new Error(`Total weight (${totalWeight}) must be positive and <= ${MAX_SAFE_BOUND}`);
  }
  
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
  
  // Fallback — throw instead of silently returning last item
  throw new Error(`Weighted selection failed: value=${rng.value}, totalWeight=${totalWeight}. This indicates a logic error.`);
}

/**
 * Select N unique winners from a pool using RNG
 * Uses Promise.all for parallel RNG generation where possible
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
  if (!Number.isInteger(poolSize) || poolSize <= 0) {
    throw new Error(`Pool size must be a positive integer, got: ${poolSize}`);
  }
  if (!Number.isInteger(winnerCount) || winnerCount <= 0) {
    throw new Error(`Winner count must be a positive integer, got: ${winnerCount}`);
  }
  if (winnerCount > poolSize) {
    throw new Error(`Cannot select ${winnerCount} winners from pool of ${poolSize}`);
  }
  
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
    
    if (winners.length <= i) {
      throw new Error(`Failed to select winner ${i + 1} after ${maxAttempts} attempts`);
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
 * Generate a random number using T2/T3 VRF tiers
 * Automatically selects the best VRF method based on chain
 * 
 * @param max - Upper bound (exclusive)
 * @param salt - Additional salt for uniqueness
 * @param tier - Which VRF tier to use (T2_DIRECT or T3_SUBSCRIPTION)
 * @param chain - Which chain for VRF
 * @param vrfConfig - Optional VRF configuration overrides
 * @returns The random value and VRF proof
 */
export async function generateRandomVRF(
  max: number,
  salt: string = '',
  tier: VRFTier = 'T2_DIRECT',
  chain: 'pulsechain' | 'base' = 'pulsechain',
  vrfConfig?: Partial<VRFConfig>
): Promise<{ value: number; vrfProof: VRFResult }> {
  if (!Number.isInteger(max) || max <= 0) {
    throw new Error(`Max must be a positive integer, got: ${max}`);
  }
  if (max > MAX_SAFE_BOUND) {
    throw new Error(`Max exceeds safe integer bounds (${MAX_SAFE_BOUND})`);
  }

  const { value, proof } = await getVRFRandom(max, salt, tier, chain, vrfConfig);
  return { value, vrfProof: proof };
}

/**
 * Generate a deterministic random number from a seed (no network call)
 * 
 * ⚠️ CLIENT-SIDE PREVIEW ONLY — NOT for production minting or any on-chain decisions.
 * This uses a simple hash-based approach without on-chain entropy.
 * For production, use generateRandom() which fetches real block hashes.
 */
export function deterministicRandom(seed: string, max: number): number {
  if (!Number.isInteger(max) || max <= 0) {
    throw new Error(`Max must be a positive integer, got: ${max}`);
  }
  if (max > MAX_SAFE_BOUND) {
    throw new Error(`Max exceeds safe integer bounds`);
  }
  const hash = ethers.keccak256(ethers.toUtf8Bytes(seed));
  return Number(BigInt(hash) % BigInt(max));
}
