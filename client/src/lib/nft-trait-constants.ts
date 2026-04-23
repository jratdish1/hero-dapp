/**
 * HERO NFT Trait Constants — Client-Safe
 * 
 * Static data only. No server-side dependencies (no ethers, no rng-engine).
 * Used by NFTMint.tsx for preview rendering.
 * The actual trait generation logic lives in server/nft-trait-engine.ts.
 */

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

export const RARITY_WEIGHTS: Record<RarityTier, number> = {
  Common: 50,
  Uncommon: 25,
  Rare: 15,
  Epic: 7,
  Legendary: 3,
};

export const HERO_TRAIT_CATEGORIES: TraitCategory[] = [
  {
    name: 'Background',
    options: [
      { name: 'Desert Storm', rarity: 'Common', weight: 50 },
      { name: 'Urban Camo', rarity: 'Common', weight: 50 },
      { name: 'Ocean Blue', rarity: 'Common', weight: 50 },
      { name: 'Forest Green', rarity: 'Uncommon', weight: 25 },
      { name: 'Arctic White', rarity: 'Uncommon', weight: 25 },
      { name: 'Sunset Orange', rarity: 'Rare', weight: 15 },
      { name: 'Neon Grid', rarity: 'Rare', weight: 15 },
      { name: 'PulseChain Purple', rarity: 'Epic', weight: 7 },
      { name: 'Holographic', rarity: 'Epic', weight: 7 },
      { name: 'Golden Eagle', rarity: 'Legendary', weight: 3 },
    ],
  },
  {
    name: 'Body',
    options: [
      { name: 'Standard BDU', rarity: 'Common', weight: 50 },
      { name: 'Desert MARPAT', rarity: 'Common', weight: 50 },
      { name: 'Woodland MARPAT', rarity: 'Uncommon', weight: 25 },
      { name: 'Dress Blues', rarity: 'Uncommon', weight: 25 },
      { name: 'Flight Suit', rarity: 'Rare', weight: 15 },
      { name: 'Ghillie Suit', rarity: 'Rare', weight: 15 },
      { name: 'Power Armor', rarity: 'Epic', weight: 7 },
      { name: 'Cyber Suit', rarity: 'Epic', weight: 7 },
      { name: 'Commandant Regalia', rarity: 'Legendary', weight: 3 },
    ],
  },
  {
    name: 'Headgear',
    options: [
      { name: 'Cover (8-Point)', rarity: 'Common', weight: 50 },
      { name: 'Boonie Hat', rarity: 'Common', weight: 50 },
      { name: 'Kevlar Helmet', rarity: 'Uncommon', weight: 25 },
      { name: 'Beret', rarity: 'Uncommon', weight: 25 },
      { name: 'NVG Mount', rarity: 'Rare', weight: 15 },
      { name: 'Spartan Helmet', rarity: 'Rare', weight: 15 },
      { name: 'HUD Visor', rarity: 'Epic', weight: 7 },
      { name: 'Crown of Valor', rarity: 'Epic', weight: 7 },
      { name: 'Halo of Honor', rarity: 'Legendary', weight: 3 },
    ],
  },
  {
    name: 'Weapon',
    options: [
      { name: 'M16A4', rarity: 'Common', weight: 50 },
      { name: 'M4 Carbine', rarity: 'Common', weight: 50 },
      { name: 'M240B', rarity: 'Uncommon', weight: 25 },
      { name: 'M40A5 Sniper', rarity: 'Uncommon', weight: 25 },
      { name: 'SMAW Rocket', rarity: 'Rare', weight: 15 },
      { name: 'Minigun', rarity: 'Rare', weight: 15 },
      { name: 'Plasma Rifle', rarity: 'Epic', weight: 7 },
      { name: 'Crypto Cannon', rarity: 'Epic', weight: 7 },
      { name: 'Infinity Blade', rarity: 'Legendary', weight: 3 },
    ],
  },
  {
    name: 'Rank',
    options: [
      { name: 'PFC', rarity: 'Common', weight: 50 },
      { name: 'Corporal', rarity: 'Common', weight: 50 },
      { name: 'Sergeant', rarity: 'Uncommon', weight: 25 },
      { name: 'Staff Sergeant', rarity: 'Uncommon', weight: 25 },
      { name: 'Gunnery Sergeant', rarity: 'Rare', weight: 15 },
      { name: 'First Sergeant', rarity: 'Rare', weight: 15 },
      { name: 'Sergeant Major', rarity: 'Epic', weight: 7 },
      { name: 'Lieutenant', rarity: 'Epic', weight: 7 },
      { name: 'General', rarity: 'Legendary', weight: 3 },
    ],
  },
  {
    name: 'Medal',
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
