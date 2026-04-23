/**
 * HERO NFT — Artist Integration Pipeline
 * 
 * This module bridges the human artist's artwork with the on-chain NFT system.
 * 
 * WORKFLOW:
 * 1. Artist delivers layer images (PNGs) organized by trait category
 * 2. This pipeline validates, registers, and maps artwork to trait definitions
 * 3. At mint time: RNG selects traits → compositor layers the artwork → metadata generated
 * 4. Composed image + metadata uploaded to IPFS → tokenURI set on-chain
 * 
 * DIRECTORY STRUCTURE (artist delivers):
 *   /artwork/
 *     /Background/
 *       desert_storm.png
 *       urban_camo.png
 *       ...
 *     /Outfit/
 *       bdu_woodland.png
 *       ...
 *     /Weapon/
 *       m16a4.png
 *       ...
 *     /Rank/
 *       private_e1.png
 *       ...
 *     /Badge/
 *       marksman.png
 *       ...
 *     /Special/
 *       none.png (transparent)
 *       dog_tags.png
 *       ...
 * 
 * LAYER ORDER (bottom to top):
 *   Background → Outfit → Weapon → Rank → Badge → Special
 * 
 * IMAGE REQUIREMENTS:
 *   - Format: PNG with transparency (except Background)
 *   - Size: 2000x2000px (configurable)
 *   - Background: Opaque full canvas
 *   - All other layers: Transparent background, positioned correctly
 */

import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { createCanvas, loadImage, type Canvas } from 'canvas'; // npm: canvas (node-canvas)
import { HERO_TRAIT_CATEGORIES, type RarityTier, type TraitCategory } from './nft-trait-engine';

// ─── Types ───────────────────────────────────────────────────────

export interface ArtworkManifest {
  version: string;
  collectionName: string;
  artist: string;
  canvasSize: { width: number; height: number };
  layerOrder: string[];          // Category names in compositing order (bottom to top)
  categories: ArtworkCategory[];
  totalPossibleCombinations: string;  // BigInt serialized as string to avoid precision loss
  createdAt: string;
  validatedAt?: string;
}

export interface ArtworkCategory {
  name: string;                  // Must match TraitCategory.name exactly
  layerIndex: number;            // Compositing order (0 = bottom)
  assets: ArtworkAsset[];
}

export interface ArtworkAsset {
  traitName: string;             // Must match TraitOption.name exactly
  rarity: RarityTier;
  fileName: string;              // e.g., "desert_storm.png"
  filePath: string;              // Absolute path to the file
  fileSize: number;              // Bytes
  dimensions: { width: number; height: number };
  hash: string;                  // SHA-256 of the file for integrity verification
  validated: boolean;
}

export interface ComposedNFT {
  tokenId: number;
  imageBuffer: Buffer;           // The composed PNG image
  imagePath: string;             // Local save path
  traits: Array<{ category: string; trait: string; rarity: RarityTier }>;
  layersUsed: string[];          // File paths of layers used
  compositeHash: string;         // SHA-256 of the final composed image
}

export interface NFTUtility {
  tokenId: number;
  utilityType: string;           // e.g., "staking_boost", "governance_weight", "access_pass"
  value: string | number;        // e.g., "1.5x", 10, "VIP"
  description: string;
  expiresAt?: number;            // Optional expiration timestamp
  conditions?: string[];         // e.g., ["Must hold for 30 days"]
}

export interface UtilityRule {
  name: string;
  description: string;
  triggerType: 'rarity_score' | 'specific_trait' | 'trait_combination' | 'token_range';
  trigger: {
    minRarityScore?: number;
    maxRarityScore?: number;
    requiredTrait?: { category: string; traitName: string };
    requiredTraits?: Array<{ category: string; traitName: string }>;
    tokenIdRange?: { min: number; max: number };
  };
  utility: {
    type: string;
    value: string | number;
    description: string;
  };
}

// ─── Configuration ──────────────────────────────────────────────

export const DEFAULT_CONFIG = {
  canvasWidth: 2000,
  canvasHeight: 2000,
  outputFormat: 'image/png' as const,
  outputQuality: 1.0,
  layerOrder: ['Background', 'Outfit', 'Weapon', 'Rank', 'Badge', 'Special'],
  artworkBaseDir: '/artwork',     // Override per deployment
  outputDir: '/output/nfts',      // Override per deployment
  metadataDir: '/output/metadata', // Override per deployment
};

// ─── Artwork Manifest Builder ───────────────────────────────────

/**
 * Scan the artist's artwork directory and build a manifest
 * Validates all files match trait definitions and meet image requirements
 * 
 * @param artworkDir - Root directory containing category subdirectories
 * @param artist - Artist name for manifest metadata
 * @param collectionName - Collection name
 * @returns ArtworkManifest with all validated assets
 */
export async function buildArtworkManifest(
  artworkDir: string,
  artist: string = 'Unknown Artist',
  collectionName: string = 'HERO NFT Collection'
): Promise<ArtworkManifest> {
  try {
    await fsp.access(artworkDir);
  } catch {
    throw new Error(`Artwork directory not found: ${artworkDir}`);
  }

  const categories: ArtworkCategory[] = [];
  const errors: string[] = [];
  let totalCombinations = 1n;  // BigInt to avoid overflow with many categories/assets

  for (let layerIdx = 0; layerIdx < DEFAULT_CONFIG.layerOrder.length; layerIdx++) {
    const categoryName = DEFAULT_CONFIG.layerOrder[layerIdx];
    const categoryDir = path.join(artworkDir, categoryName);

    // Find matching trait category from engine
    const traitCategory = HERO_TRAIT_CATEGORIES.find(c => c.name === categoryName);
    if (!traitCategory) {
      errors.push(`Category "${categoryName}" not found in trait definitions`);
      continue;
    }

    try {
      await fsp.access(categoryDir);
    } catch {
      errors.push(`Missing artwork directory: ${categoryDir}`);
      continue;
    }

    const assets: ArtworkAsset[] = [];
    const files = (await fsp.readdir(categoryDir)).filter(f => f.toLowerCase().endsWith('.png'));

    for (const option of traitCategory.options) {
      // Convert trait name to expected filename: "Desert Storm" → "desert_storm.png"
      const expectedFileName = traitNameToFileName(option.name).toLowerCase();
      const matchingFile = files.find(f => f.toLowerCase() === expectedFileName);

      if (!matchingFile) {
        errors.push(`Missing artwork for "${categoryName}/${option.name}" (expected: ${expectedFileName})`);
        continue;
      }

      const filePath = path.join(categoryDir, matchingFile);
      const stats = await fsp.stat(filePath);
      const fileBuffer = await fsp.readFile(filePath);
      // Use SHA-256 for file integrity (consistent with types and comments)
      const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Validate image dimensions (basic check via PNG header)
      const dimensions = getPNGDimensions(fileBuffer);

      assets.push({
        traitName: option.name,
        rarity: option.rarity,
        fileName: matchingFile,
        filePath,
        fileSize: stats.size,
        dimensions,
        hash,
        validated: dimensions.width === DEFAULT_CONFIG.canvasWidth && 
                   dimensions.height === DEFAULT_CONFIG.canvasHeight,
      });
    }

    categories.push({
      name: categoryName,
      layerIndex: layerIdx,
      assets,
    });

    totalCombinations *= BigInt(assets.length);
  }

  if (errors.length > 0) {
    console.warn(`⚠️ Artwork manifest warnings (${errors.length}):`);
    errors.forEach(e => console.warn(`  - ${e}`));
  }

  const manifest: ArtworkManifest = {
    version: '1.0.0',
    collectionName,
    artist,
    canvasSize: { width: DEFAULT_CONFIG.canvasWidth, height: DEFAULT_CONFIG.canvasHeight },
    layerOrder: DEFAULT_CONFIG.layerOrder,
    categories,
    totalPossibleCombinations: totalCombinations.toString(),
    createdAt: new Date().toISOString(),
  };

  return manifest;
}

/**
 * Validate an existing manifest — check all files still exist and hashes match
 */
export async function validateManifest(manifest: ArtworkManifest): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const category of manifest.categories) {
    for (const asset of category.assets) {
      try {
        await fsp.access(asset.filePath);
      } catch {
        errors.push(`File missing: ${asset.filePath}`);
        continue;
      }

      const fileBuffer = await fsp.readFile(asset.filePath);
      // Use SHA-256 consistent with buildArtworkManifest
      const currentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      if (currentHash !== asset.hash) {
        errors.push(`Hash mismatch for ${asset.fileName}: expected ${asset.hash}, got ${currentHash}`);
      }

      if (!asset.validated) {
        warnings.push(`${asset.fileName} dimensions don't match canvas size (${manifest.canvasSize.width}x${manifest.canvasSize.height})`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ─── Image Compositor ───────────────────────────────────────────

/**
 * Compose an NFT image from trait selections and artwork layers
 * Layers are composited bottom-to-top: Background → Outfit → Weapon → Rank → Badge → Special
 * 
 * @param manifest - The validated artwork manifest
 * @param traits - Array of selected traits (from RNG engine)
 * @param tokenId - Token ID for the NFT
 * @param outputDir - Directory to save the composed image
 * @returns ComposedNFT with image buffer and metadata
 */
export async function composeNFTImage(
  manifest: ArtworkManifest,
  traits: Array<{ category: string; trait: string; rarity: RarityTier }>,
  tokenId: number,
  outputDir: string
): Promise<ComposedNFT> {
  const canvas = createCanvas(manifest.canvasSize.width, manifest.canvasSize.height);
  const ctx = canvas.getContext('2d');

  const layersUsed: string[] = [];

  // Composite layers in order (bottom to top)
  for (const categoryName of manifest.layerOrder) {
    const trait = traits.find(t => t.category === categoryName);
    if (!trait) {
      console.warn(`No trait selected for category "${categoryName}", skipping layer`);
      continue;
    }

    const category = manifest.categories.find(c => c.name === categoryName);
    if (!category) continue;

    const asset = category.assets.find(a => a.traitName === trait.trait);
    if (!asset) {
      console.warn(`No artwork found for trait "${trait.trait}" in "${categoryName}"`);
      continue;
    }

    try {
      const img = await loadImage(asset.filePath);
      ctx.drawImage(img, 0, 0, manifest.canvasSize.width, manifest.canvasSize.height);
      layersUsed.push(asset.filePath);
    } catch (err: any) {
      throw new Error(`Failed to load layer "${asset.filePath}": ${err.message}`);
    }
  }

  // Export as PNG buffer
  const imageBuffer = canvas.toBuffer('image/png');
  
  // Save to disk
  await fsp.mkdir(outputDir, { recursive: true });
  const imagePath = path.join(outputDir, `hero_nft_${tokenId}.png`);
  await fsp.writeFile(imagePath, imageBuffer);

  // Hash the composed image for integrity (SHA-256 consistent with manifest)
  const compositeHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');

  return {
    tokenId,
    imageBuffer,
    imagePath,
    traits,
    layersUsed,
    compositeHash,
  };
}

// ─── Metadata Generator ─────────────────────────────────────────

/**
 * Generate ERC-721 compliant metadata JSON for an NFT
 * Includes traits, rarity, RNG proofs, and image URI
 * 
 * @param composed - The composed NFT from composeNFTImage
 * @param imageURI - IPFS or HTTP URI for the image (set after upload)
 * @param collectionName - Name of the collection
 * @param externalUrl - Optional external URL for the NFT
 */
export function generateMetadata(
  composed: ComposedNFT,
  imageURI: string,
  collectionName: string = 'HERO NFT Collection',
  externalUrl?: string
): Record<string, any> {
  const rarityScore = composed.traits.reduce((score, t) => {
    const weights: Record<string, number> = { Common: 50, Uncommon: 25, Rare: 15, Epic: 7, Legendary: 3 };
    return score + (100 - (weights[t.rarity] || 50));
  }, 0);

  return {
    name: `${collectionName} #${composed.tokenId}`,
    description: `HERO NFT #${composed.tokenId} — A provably fair, on-chain generated NFT from the HERO ecosystem. Built for Veterans, by Veterans.`,
    image: imageURI,
    external_url: externalUrl || `https://herobase.io/nft/${composed.tokenId}`,
    attributes: [
      ...composed.traits.map(t => ({
        trait_type: t.category,
        value: t.trait,
      })),
      {
        trait_type: 'Rarity Score',
        value: rarityScore,
        display_type: 'number',
      },
      {
        trait_type: 'Rarity Tier',
        value: getRarityTierFromScore(rarityScore, composed.traits.length),
      },
    ],
    properties: {
      category: 'image',
      creators: [{ address: '', share: 100 }],
      files: [{ uri: imageURI, type: 'image/png' }],
    },
    // HERO-specific extensions
    hero_metadata: {
      collection: collectionName,
      compositeHash: composed.compositeHash,
      layerCount: composed.layersUsed.length,
      mintChain: 'pulsechain',
    },
  };
}

/**
 * Batch generate metadata for multiple NFTs
 * Saves individual JSON files + a combined collection metadata file
 */
export async function batchGenerateMetadata(
  composedNFTs: ComposedNFT[],
  imageURIs: Map<number, string>,
  outputDir: string,
  collectionName: string = 'HERO NFT Collection'
): Promise<string[]> {
  await fsp.mkdir(outputDir, { recursive: true });

  const metadataPaths: string[] = [];

  for (const nft of composedNFTs) {
    const imageURI = imageURIs.get(nft.tokenId) || '';
    const metadata = generateMetadata(nft, imageURI, collectionName);
    
    const metadataPath = path.join(outputDir, `${nft.tokenId}.json`);
    await fsp.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    metadataPaths.push(metadataPath);
  }

  // Generate collection-level metadata
  const collectionMetadata = {
    name: collectionName,
    description: 'HERO NFT Collection — Provably fair, on-chain generated NFTs. Built for Veterans, by Veterans.',
    image: imageURIs.get(composedNFTs[0]?.tokenId) || '',
    external_link: 'https://herobase.io/nft-mint',
    seller_fee_basis_points: 500, // 5% royalty
    fee_recipient: '', // Set to HERO treasury address
    totalSupply: composedNFTs.length,
  };

  const collectionPath = path.join(outputDir, 'collection.json');
  await fsp.writeFile(collectionPath, JSON.stringify(collectionMetadata, null, 2));
  metadataPaths.push(collectionPath);

  return metadataPaths;
}

// ─── Utility Binding System ─────────────────────────────────────

/**
 * Define utility rules that map traits/rarity to in-app utilities
 * This is the script that ties utilities to specific cards in the collection
 */
export const DEFAULT_UTILITY_RULES: UtilityRule[] = [
  // Rarity-based utilities
  {
    name: 'Legendary Staking Boost',
    description: 'Legendary NFTs get 3x staking rewards',
    triggerType: 'rarity_score',
    trigger: { minRarityScore: 550 }, // ~All Legendary
    utility: { type: 'staking_boost', value: '3x', description: '3x staking rewards multiplier' },
  },
  {
    name: 'Epic Staking Boost',
    description: 'Epic-tier NFTs get 2x staking rewards',
    triggerType: 'rarity_score',
    trigger: { minRarityScore: 450, maxRarityScore: 549 },
    utility: { type: 'staking_boost', value: '2x', description: '2x staking rewards multiplier' },
  },
  {
    name: 'Rare Staking Boost',
    description: 'Rare-tier NFTs get 1.5x staking rewards',
    triggerType: 'rarity_score',
    trigger: { minRarityScore: 350, maxRarityScore: 449 },
    utility: { type: 'staking_boost', value: '1.5x', description: '1.5x staking rewards multiplier' },
  },
  // Specific trait utilities
  {
    name: 'Medal of Honor Access',
    description: 'Medal of Honor badge holders get VIP access to all HERO events',
    triggerType: 'specific_trait',
    trigger: { requiredTrait: { category: 'Badge', traitName: 'Medal of Honor' } },
    utility: { type: 'access_pass', value: 'VIP', description: 'VIP access to all HERO events and channels' },
  },
  {
    name: 'General Governance Weight',
    description: 'General rank holders get 5x DAO voting weight',
    triggerType: 'specific_trait',
    trigger: { requiredTrait: { category: 'Rank', traitName: 'General (O-10)' } },
    utility: { type: 'governance_weight', value: 5, description: '5x DAO voting weight' },
  },
  {
    name: 'Infinity Gauntlet Power',
    description: 'Infinity Gauntlet holders can burn NFTs to mint new ones at 50% cost',
    triggerType: 'specific_trait',
    trigger: { requiredTrait: { category: 'Weapon', traitName: 'Infinity Gauntlet' } },
    utility: { type: 'mint_discount', value: '50%', description: '50% discount on future mints via burn-to-mint' },
  },
  // Trait combination utilities
  {
    name: 'Full Legendary Set',
    description: 'All 6 Legendary traits = exclusive animated PFP + lifetime VIP',
    triggerType: 'trait_combination',
    trigger: {
      requiredTraits: [
        { category: 'Background', traitName: 'American Flag Animated' },
        { category: 'Outfit', traitName: 'Mjolnir Power Armor' },
        { category: 'Weapon', traitName: 'Infinity Gauntlet' },
        { category: 'Rank', traitName: 'General (O-10)' },
        { category: 'Badge', traitName: 'Medal of Honor' },
        { category: 'Special', traitName: 'PulseChain Aura' },
      ],
    },
    utility: { type: 'legendary_set', value: 'lifetime_vip', description: 'Animated PFP + Lifetime VIP + 10x staking + Exclusive merch' },
  },
  // Early minter bonus
  {
    name: 'OG Minter',
    description: 'First 100 minted NFTs get OG status',
    triggerType: 'token_range',
    trigger: { tokenIdRange: { min: 1, max: 100 } },
    utility: { type: 'og_status', value: 'OG', description: 'OG Minter status — exclusive channel access + airdrop eligibility' },
  },
];

/**
 * Evaluate which utilities a specific NFT qualifies for
 * This is the core function that ties utilities to specific cards
 * 
 * @param tokenId - The NFT token ID
 * @param traits - The NFT's traits
 * @param rarityScore - The NFT's rarity score
 * @param rules - Utility rules to evaluate (defaults to DEFAULT_UTILITY_RULES)
 * @returns Array of utilities this NFT qualifies for
 */
export function evaluateUtilities(
  tokenId: number,
  traits: Array<{ category: string; trait: string; rarity: RarityTier }>,
  rarityScore: number,
  rules: UtilityRule[] = DEFAULT_UTILITY_RULES
): NFTUtility[] {
  const utilities: NFTUtility[] = [];

  for (const rule of rules) {
    let qualifies = false;

    switch (rule.triggerType) {
      case 'rarity_score': {
        const min = rule.trigger.minRarityScore ?? 0;
        const max = rule.trigger.maxRarityScore ?? Infinity;
        qualifies = rarityScore >= min && rarityScore <= max;
        break;
      }
      case 'specific_trait': {
        if (rule.trigger.requiredTrait) {
          const { category, traitName } = rule.trigger.requiredTrait;
          qualifies = traits.some(t => t.category === category && t.trait === traitName);
        }
        break;
      }
      case 'trait_combination': {
        if (rule.trigger.requiredTraits) {
          qualifies = rule.trigger.requiredTraits.every(req =>
            traits.some(t => t.category === req.category && t.trait === req.traitName)
          );
        }
        break;
      }
      case 'token_range': {
        if (rule.trigger.tokenIdRange) {
          const { min, max } = rule.trigger.tokenIdRange;
          qualifies = tokenId >= min && tokenId <= max;
        }
        break;
      }
    }

    if (qualifies) {
      utilities.push({
        tokenId,
        utilityType: rule.utility.type,
        value: rule.utility.value,
        description: rule.utility.description,
      });
    }
  }

  return utilities;
}

/**
 * Generate a utility map for an entire collection
 * Returns a Map of tokenId → utilities for on-chain or off-chain storage
 */
export function generateUtilityMap(
  nfts: Array<{
    tokenId: number;
    traits: Array<{ category: string; trait: string; rarity: RarityTier }>;
    rarityScore: number;
  }>,
  rules: UtilityRule[] = DEFAULT_UTILITY_RULES
): Map<number, NFTUtility[]> {
  const utilityMap = new Map<number, NFTUtility[]>();

  for (const nft of nfts) {
    const utilities = evaluateUtilities(nft.tokenId, nft.traits, nft.rarityScore, rules);
    if (utilities.length > 0) {
      utilityMap.set(nft.tokenId, utilities);
    }
  }

  return utilityMap;
}

/**
 * Export utility map as JSON for on-chain Merkle tree or off-chain API
 */
export async function exportUtilityMapJSON(
  utilityMap: Map<number, NFTUtility[]>,
  outputPath: string
): Promise<void> {
  const serializable: Record<number, NFTUtility[]> = {};
  for (const [tokenId, utilities] of utilityMap) {
    serializable[tokenId] = utilities;
  }

  await fsp.writeFile(outputPath, JSON.stringify(serializable, null, 2));
}

// ─── IPFS Upload Interface ──────────────────────────────────────

/**
 * IPFS upload interface — implement with your preferred provider
 * (Pinata, NFT.Storage, Infura IPFS, etc.)
 * 
 * This is a placeholder that returns the expected interface.
 * Replace with actual IPFS upload logic when ready.
 */
export interface IPFSUploader {
  uploadImage(imageBuffer: Buffer, fileName: string): Promise<string>;  // Returns ipfs:// URI
  uploadMetadata(metadata: Record<string, any>, fileName: string): Promise<string>;
  uploadDirectory(dirPath: string): Promise<string>;  // Returns base URI for directory
}

/**
 * Create a Pinata IPFS uploader (most common for NFTs)
 * Requires PINATA_API_KEY and PINATA_SECRET_KEY env vars
 */
export function createPinataUploader(): IPFSUploader {
  const apiKey = process.env.PINATA_API_KEY;
  const secretKey = process.env.PINATA_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error('PINATA_API_KEY and PINATA_SECRET_KEY environment variables required');
  }

  return {
    async uploadImage(imageBuffer: Buffer, fileName: string): Promise<string> {
      // Implementation uses Pinata SDK or REST API
      // POST to https://api.pinata.cloud/pinning/pinFileToIPFS
      // Returns: ipfs://Qm...
      throw new Error('Pinata upload not yet implemented — set up Pinata account first');
    },
    async uploadMetadata(metadata: Record<string, any>, fileName: string): Promise<string> {
      // POST to https://api.pinata.cloud/pinning/pinJSONToIPFS
      throw new Error('Pinata upload not yet implemented — set up Pinata account first');
    },
    async uploadDirectory(dirPath: string): Promise<string> {
      // POST to https://api.pinata.cloud/pinning/pinFileToIPFS (with directory)
      throw new Error('Pinata upload not yet implemented — set up Pinata account first');
    },
  };
}

// ─── Full Mint Pipeline ─────────────────────────────────────────

/**
 * Complete mint pipeline — from RNG trait selection to composed image + metadata
 * This is the main function called at mint time
 * 
 * @param manifest - Validated artwork manifest
 * @param tokenId - Token ID being minted
 * @param traits - Traits selected by RNG engine (from generateNFTTraits)
 * @param outputDir - Base output directory
 * @param ipfsUploader - Optional IPFS uploader (if not provided, saves locally)
 * @returns Complete NFT data including image, metadata, and utilities
 */
export async function executeMintPipeline(
  manifest: ArtworkManifest,
  tokenId: number,
  traits: Array<{ category: string; trait: string; rarity: RarityTier }>,
  outputDir: string,
  ipfsUploader?: IPFSUploader
): Promise<{
  composed: ComposedNFT;
  metadata: Record<string, any>;
  utilities: NFTUtility[];
  imageURI: string;
  metadataURI: string;
}> {
  // Step 1: Compose the image from artwork layers
  const imageOutputDir = path.join(outputDir, 'images');
  const composed = await composeNFTImage(manifest, traits, tokenId, imageOutputDir);

  // Step 2: Upload image (IPFS or local)
  let imageURI: string;
  if (ipfsUploader) {
    imageURI = await ipfsUploader.uploadImage(composed.imageBuffer, `hero_nft_${tokenId}.png`);
  } else {
    imageURI = `file://${composed.imagePath}`; // Local fallback
  }

  // Step 3: Generate metadata
  const metadata = generateMetadata(composed, imageURI);

  // Step 4: Upload metadata (IPFS or local)
  let metadataURI: string;
  const metadataOutputDir = path.join(outputDir, 'metadata');
  await fsp.mkdir(metadataOutputDir, { recursive: true });
  const metadataPath = path.join(metadataOutputDir, `${tokenId}.json`);
  await fsp.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

  if (ipfsUploader) {
    metadataURI = await ipfsUploader.uploadMetadata(metadata, `${tokenId}.json`);
  } else {
    metadataURI = `file://${metadataPath}`; // Local fallback
  }

  // Step 5: Evaluate utilities
  const rarityScore = traits.reduce((score, t) => {
    const weights: Record<string, number> = { Common: 50, Uncommon: 25, Rare: 15, Epic: 7, Legendary: 3 };
    return score + (100 - (weights[t.rarity] || 50));
  }, 0);
  const utilities = evaluateUtilities(tokenId, traits, rarityScore);

  return {
    composed,
    metadata,
    utilities,
    imageURI,
    metadataURI,
  };
}

// ─── Helper Functions ───────────────────────────────────────────

/**
 * Convert trait name to expected file name
 * "Desert Storm" → "desert_storm.png"
 */
function traitNameToFileName(traitName: string): string {
  return traitName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    + '.png';
}

/**
 * Read PNG dimensions from file header (first 24 bytes)
 */
function getPNGDimensions(buffer: Buffer): { width: number; height: number } {
  if (buffer.length < 24) return { width: 0, height: 0 };
  // PNG header: bytes 16-19 = width, 20-23 = height (big-endian)
  if (buffer[0] === 0x89 && buffer[1] === 0x50) { // PNG magic bytes
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }
  return { width: 0, height: 0 };
}

/**
 * Get rarity tier label from score
 */
function getRarityTierFromScore(score: number, traitCount: number): string {
  const maxScore = traitCount * 97; // All Legendary
  const percentage = (score / maxScore) * 100;
  
  if (percentage > 80) return 'Legendary';
  if (percentage > 60) return 'Epic';
  if (percentage > 40) return 'Rare';
  if (percentage > 20) return 'Uncommon';
  return 'Common';
}
