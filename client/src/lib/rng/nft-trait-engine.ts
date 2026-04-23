/**
 * HERO NFT — Trait Randomness Engine
 * 
 * Provably fair trait assignment for HERO NFT collection.
 * Uses on-chain RNG to determine traits at mint time.
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
  weight: number; // Relative weight within its category
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
  image: string; // IPFS or URL
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

// ─── Rarity Weights ──────────────────────────────────────────────

const RARITY_WEIGHTS: Record<RarityTier, number> = {
  Common: 50,
  Uncommon: 25,
  Rare: 15,
  Epic: 7,
  Legendary: 3,
};

// ─── HERO NFT Trait Definitions ──────────────────────────────────

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
 * Generate a single trait from a category using on-chain RNG
 */
export async function generateTrait(
  category: TraitCategory,
  tokenId: number,
  chain: 'pulsechain' | 'base' = 'pulsechain'
): Promise<GeneratedTrait> {
  const totalWeight = category.options.reduce((sum, opt) => sum + opt.weight, 0);
  const salt = `nft-${tokenId}-${category.name}`;
  
  const rng = await generateRandom(totalWeight, salt, chain);
  
  // Walk through options to find selected trait
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
  
  // Fallback (should never reach)
  const last = category.options[category.options.length - 1];
  return {
    category: category.name,
    trait: last.name,
    rarity: last.rarity,
    rngProof: rng,
  };
}

/**
 * Generate all traits for a single NFT
 */
export async function generateNFTTraits(
  tokenId: number,
  categories: TraitCategory[] = HERO_TRAIT_CATEGORIES,
  chain: 'pulsechain' | 'base' = 'pulsechain'
): Promise<GeneratedTrait[]> {
  const traits: GeneratedTrait[] = [];
  
  for (const category of categories) {
    const trait = await generateTrait(category, tokenId, chain);
    traits.push(trait);
  }
  
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
 * Preview traits without on-chain RNG (for UI preview)
 * Uses deterministic local randomness — NOT for production minting
 */
export function previewTraits(
  tokenId: number,
  categories: TraitCategory[] = HERO_TRAIT_CATEGORIES
): Array<{ category: string; trait: string; rarity: RarityTier }> {
  return categories.map(category => {
    const totalWeight = category.options.reduce((sum, opt) => sum + opt.weight, 0);
    const seed = `preview-${tokenId}-${category.name}`;
    const roll = deterministicRandom(seed, totalWeight);
    
    let cumulative = 0;
    for (const option of category.options) {
      cumulative += option.weight;
      if (roll < cumulative) {
        return { category: category.name, trait: option.name, rarity: option.rarity };
      }
    }
    
    const last = category.options[category.options.length - 1];
    return { category: category.name, trait: last.name, rarity: last.rarity };
  });
}

/**
 * Calculate rarity score for a set of traits
 */
export function calculateRarityScore(traits: Array<{ rarity: RarityTier }>): number {
  return traits.reduce((score, t) => {
    // Inverse weight — rarer = higher score
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
