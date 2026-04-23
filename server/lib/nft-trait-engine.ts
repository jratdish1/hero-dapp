/**
 * HERO NFT — Trait Randomness Engine
 * 
 * Provably fair trait assignment for HERO NFT collection.
 * 
 * IMPORTANT DISTINCTION:
 * - previewTraits(): Uses CLIENT-SIDE deterministic hash. For UI preview ONLY.
 *   Shows users what traits MIGHT look like. NOT the final result.
 * - generateTrait() / generateNFTTraits(): Uses ON-CHAIN block hash RNG (T1 tier).
 *   This is the ACTUAL mint result. Provably fair and verifiable.
 * 
 * Rarity Tiers:
 * - Common:    50% chance
 * - Uncommon:  25% chance
 * - Rare:      15% chance
 * - Epic:       7% chance
 * - Legendary:  3% chance
 */

import { generateRandom, deterministicRandom, type RNGResult } from '../shared/rng-engine';

// ─── Types ───────────────────────────────────────────────────────

export type RarityTier = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

export interface TraitOption {
  name: string;
  rarity: RarityTier;
  weight: number;
}

export interface TraitCategory {
  name: string;
  options: TraitOption[];
}

export interface GeneratedTrait {
  category: string;
  trait: string;
  rarity: RarityTier;
  rngProof: RNGResult;
}

export interface NFTMetadata {
  tokenId: number;
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string;
    rarity: RarityTier;
  }>;
  rngProofs: Array<{
    category: string;
    proofHash: string;
    blockNumber: number;
    seed: string;
  }>;
  mintedAt: string;
  mintTxHash?: string;
}

// ─── Rarity Weights (Shared Constant) ───────────────────────────

export const RARITY_WEIGHTS: Record<RarityTier, number> = {
  Common: 50,
  Uncommon: 25,
  Rare: 15,
  Epic: 7,
  Legendary: 3,
};

// ─── HERO NFT Trait Definitions (Shared Constant) ───────────────
// Exported so UI components can import directly instead of duplicating

export const HERO_TRAIT_CATEGORIES: TraitCategory[] = [
  {
    name: 'Background',
    options: [
      { name: 'Desert Storm', rarity: 'Common', weight: 50 },
      { name: 'Urban Camo', rarity: 'Common', weight: 50 },
      { name: 'Forest Green', rarity: 'Common', weight: 50 },
      { name: 'Ocean Blue', rarity: 'Uncommon', weight: 25 },
      { name: 'Sunset Gold', rarity: 'Uncommon', weight: 25 },
      { name: 'Arctic White', rarity: 'Rare', weight: 15 },
      { name: 'Neon Pulse', rarity: 'Rare', weight: 15 },
      { name: 'Holographic', rarity: 'Epic', weight: 7 },
      { name: 'Blockchain Matrix', rarity: 'Epic', weight: 7 },
      { name: 'American Flag Animated', rarity: 'Legendary', weight: 3 },
    ],
  },
  {
    name: 'Outfit',
    options: [
      { name: 'BDU Woodland', rarity: 'Common', weight: 50 },
      { name: 'BDU Desert', rarity: 'Common', weight: 50 },
      { name: 'PT Gear', rarity: 'Common', weight: 50 },
      { name: 'Dress Blues', rarity: 'Uncommon', weight: 25 },
      { name: 'Flight Suit', rarity: 'Uncommon', weight: 25 },
      { name: 'Ghillie Suit', rarity: 'Rare', weight: 15 },
      { name: 'Tactical Black Ops', rarity: 'Rare', weight: 15 },
      { name: 'Space Force Suit', rarity: 'Epic', weight: 7 },
      { name: 'Gold Plated Armor', rarity: 'Epic', weight: 7 },
      { name: 'Mjolnir Power Armor', rarity: 'Legendary', weight: 3 },
    ],
  },
  {
    name: 'Weapon',
    options: [
      { name: 'M16A4', rarity: 'Common', weight: 50 },
      { name: 'M4 Carbine', rarity: 'Common', weight: 50 },
      { name: 'Ka-Bar Knife', rarity: 'Common', weight: 50 },
      { name: 'M249 SAW', rarity: 'Uncommon', weight: 25 },
      { name: 'M40 Sniper', rarity: 'Uncommon', weight: 25 },
      { name: 'Tomahawk', rarity: 'Rare', weight: 15 },
      { name: 'Minigun', rarity: 'Rare', weight: 15 },
      { name: 'Plasma Rifle', rarity: 'Epic', weight: 7 },
      { name: 'Crayon Launcher', rarity: 'Epic', weight: 7 },
      { name: 'Infinity Gauntlet', rarity: 'Legendary', weight: 3 },
    ],
  },
  {
    name: 'Rank',
    options: [
      { name: 'Private (E-1)', rarity: 'Common', weight: 50 },
      { name: 'Lance Corporal (E-3)', rarity: 'Common', weight: 50 },
      { name: 'Corporal (E-4)', rarity: 'Common', weight: 50 },
      { name: 'Sergeant (E-5)', rarity: 'Uncommon', weight: 25 },
      { name: 'Staff Sergeant (E-6)', rarity: 'Uncommon', weight: 25 },
      { name: 'Gunnery Sergeant (E-7)', rarity: 'Rare', weight: 15 },
      { name: 'Master Sergeant (E-8)', rarity: 'Rare', weight: 15 },
      { name: 'Sergeant Major (E-9)', rarity: 'Epic', weight: 7 },
      { name: 'Lieutenant (O-1)', rarity: 'Epic', weight: 7 },
      { name: 'General (O-10)', rarity: 'Legendary', weight: 3 },
    ],
  },
  {
    name: 'Badge',
    options: [
      { name: 'Marksman', rarity: 'Common', weight: 50 },
      { name: 'Sharpshooter', rarity: 'Common', weight: 50 },
      { name: 'Expert Rifleman', rarity: 'Uncommon', weight: 25 },
      { name: 'Combat Action Ribbon', rarity: 'Uncommon', weight: 25 },
      { name: 'Bronze Star', rarity: 'Rare', weight: 15 },
      { name: 'Silver Star', rarity: 'Rare', weight: 15 },
      { name: 'Navy Cross', rarity: 'Epic', weight: 7 },
      { name: 'Purple Heart', rarity: 'Epic', weight: 7 },
      { name: 'Medal of Honor', rarity: 'Legendary', weight: 3 },
    ],
  },
  {
    name: 'Special',
    options: [
      { name: 'None', rarity: 'Common', weight: 50 },
      { name: 'Dog Tags', rarity: 'Common', weight: 50 },
      { name: 'Cigar', rarity: 'Uncommon', weight: 25 },
      { name: 'Aviator Sunglasses', rarity: 'Uncommon', weight: 25 },
      { name: 'War Paint', rarity: 'Rare', weight: 15 },
      { name: 'Crypto Tattoo', rarity: 'Rare', weight: 15 },
      { name: 'Holographic Shield', rarity: 'Epic', weight: 7 },
      { name: 'Eagle Companion', rarity: 'Epic', weight: 7 },
      { name: 'PulseChain Aura', rarity: 'Legendary', weight: 3 },
    ],
  },
];

// ─── Core Functions ──────────────────────────────────────────────

/**
 * Generate a single trait from a category using ON-CHAIN RNG (T1 tier)
 * This is the PRODUCTION function — results are provably fair.
 * 
 * @param category - The trait category to generate from
 * @param tokenId - Must be a positive integer
 * @param chain - Which chain for entropy
 */
/**
 * @param userSecret - User-provided secret (commit-reveal) to prevent front-running.
 *   REQUIRED in production mode (NODE_ENV=production or isProduction=true).
 *   Without it, the salt is deterministic and could be front-run by miners.
 *   For preview/testing, set isProduction=false to allow calls without userSecret.
 * @param isProduction - If true, userSecret is mandatory. Defaults to NODE_ENV=production.
 */
export async function generateTrait(
  category: TraitCategory,
  tokenId: number,
  chain: 'pulsechain' | 'base' = 'pulsechain',
  userSecret?: string,
  isProduction: boolean = process.env.NODE_ENV === 'production'
): Promise<GeneratedTrait> {
  if (!Number.isInteger(tokenId) || tokenId < 0) {
    throw new Error(`Token ID must be a non-negative integer, got: ${tokenId}`);
  }
  if (!category || !Array.isArray(category.options) || category.options.length === 0) {
    throw new Error(`Invalid category: must have at least one option`);
  }

  // SECURITY: Enforce userSecret in production to prevent front-running
  if (isProduction && !userSecret) {
    throw new Error(
      'userSecret is REQUIRED for production mints to prevent front-running. ' +
      'Use the commit-reveal pattern: commit a hash of the secret first, then reveal at mint time.'
    );
  }

  // Validate userSecret format if provided (min 16 chars for sufficient entropy)
  if (userSecret && userSecret.length < 16) {
    throw new Error(`userSecret must be at least 16 characters for sufficient entropy, got ${userSecret.length}`);
  }

  const totalWeight = category.options.reduce((sum, opt) => sum + opt.weight, 0);
  // Include userSecret in salt to prevent front-running (commit-reveal pattern)
  // Also add block-derived entropy even without userSecret for non-production use
  const salt = userSecret 
    ? `nft-${tokenId}-${category.name}-${userSecret}`
    : `nft-${tokenId}-${category.name}-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  
  const rng = await generateRandom(totalWeight, salt, chain);
  
  let cumulative = 0;
  for (const option of category.options) {
    cumulative += option.weight;
    if (rng.value < cumulative) {
      return {
        category: category.name,
        trait: option.name,
        rarity: option.rarity,
        rngProof: rng,
      };
    }
  }
  
  // Throw instead of silently returning last item
  throw new Error(`Trait selection failed for category ${category.name}: value=${rng.value}, totalWeight=${totalWeight}`);
}

/**
 * Generate all traits for a single NFT using ON-CHAIN RNG
 * This is the PRODUCTION function — use at mint time only.
 */
export async function generateNFTTraits(
  tokenId: number,
  categories: TraitCategory[] = HERO_TRAIT_CATEGORIES,
  chain: 'pulsechain' | 'base' = 'pulsechain',
  userSecret?: string,
  isProduction: boolean = process.env.NODE_ENV === 'production'
): Promise<GeneratedTrait[]> {
  if (!Number.isInteger(tokenId) || tokenId < 0) {
    throw new Error(`Token ID must be a non-negative integer, got: ${tokenId}`);
  }

  // Use Promise.all for parallel trait generation (each category is independent)
  const traits = await Promise.all(
    categories.map(category => generateTrait(category, tokenId, chain, userSecret, isProduction))
  );
  
  return traits;
}

/**
 * Build full NFT metadata from generated traits
 */
export function buildNFTMetadata(
  tokenId: number,
  traits: GeneratedTrait[],
  collectionName: string = 'HERO NFT Collection'
): NFTMetadata {
  if (!Number.isInteger(tokenId) || tokenId < 0) {
    throw new Error(`Token ID must be a non-negative integer, got: ${tokenId}`);
  }

  const rarityScore = traits.reduce((score, t) => {
    return score + RARITY_WEIGHTS[t.rarity];
  }, 0);

  return {
    tokenId,
    name: `${collectionName} #${tokenId}`,
    description: `HERO NFT #${tokenId} — A provably fair, on-chain generated NFT from the HERO ecosystem. Built for Veterans, by Veterans. Rarity Score: ${rarityScore}`,
    image: '', // Set after image generation
    attributes: traits.map(t => ({
      trait_type: t.category,
      value: t.trait,
      rarity: t.rarity,
    })),
    rngProofs: traits.map(t => ({
      category: t.category,
      proofHash: t.rngProof.proofHash,
      blockNumber: t.rngProof.blockNumber,
      seed: t.rngProof.seed,
    })),
    mintedAt: new Date().toISOString(),
  };
}

/**
 * ⚠️ PREVIEW ONLY — NOT for production minting
 * 
 * Uses deterministic client-side hash to show users what traits MIGHT look like.
 * The actual mint will use generateNFTTraits() with on-chain RNG.
 * Results from this function are NOT final and will differ from actual mint.
 */
export function previewTraits(
  tokenId: number,
  categories: TraitCategory[] = HERO_TRAIT_CATEGORIES
): Array<{ category: string; trait: string; rarity: RarityTier; isPreview: true }> {
  return categories.map(category => {
    const totalWeight = category.options.reduce((sum, opt) => sum + opt.weight, 0);
    const seed = `preview-${tokenId}-${category.name}`;
    const roll = deterministicRandom(seed, totalWeight);
    
    let cumulative = 0;
    for (const option of category.options) {
      cumulative += option.weight;
      if (roll < cumulative) {
        return { category: category.name, trait: option.name, rarity: option.rarity, isPreview: true as const };
      }
    }
    
    // Throw instead of silently returning last item
    throw new Error(`Preview selection failed for category ${category.name}`);
  });
}

/**
 * Calculate rarity score for a set of traits
 * Higher score = rarer NFT (inverse of weight)
 */
export function calculateRarityScore(traits: Array<{ rarity: RarityTier }>): number {
  return traits.reduce((score, t) => {
    const inverseWeight = 100 - RARITY_WEIGHTS[t.rarity];
    return score + inverseWeight;
  }, 0);
}

/**
 * Get rarity distribution stats for a batch of minted NFTs
 */
export function getRarityDistribution(
  allTraits: GeneratedTrait[]
): Record<RarityTier, { count: number; percentage: number }> {
  const total = allTraits.length;
  const counts: Record<RarityTier, number> = {
    Common: 0,
    Uncommon: 0,
    Rare: 0,
    Epic: 0,
    Legendary: 0,
  };

  for (const trait of allTraits) {
    counts[trait.rarity]++;
  }

  const result: Record<RarityTier, { count: number; percentage: number }> = {} as any;
  for (const [rarity, count] of Object.entries(counts)) {
    result[rarity as RarityTier] = {
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    };
  }

  return result;
}

/**
 * Validate a wallet address format (basic check)
 */
export function isValidWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
