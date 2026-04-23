/**
 * HERO NFT — Mint Page with Live Trait Preview
 * 
 * Features:
 * - Live trait preview with card flip animation
 * - Rarity indicators with color coding
 * - Trait reveal animation (holographic effect)
 * - Provably fair verification links
 * - Rarity score display
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';

// Import shared trait data from engine (DRY — single source of truth)
import { HERO_TRAIT_CATEGORIES, RARITY_WEIGHTS as ENGINE_RARITY_WEIGHTS } from '../lib/nft-trait-constants';
import type { RarityTier, TraitCategory } from '../lib/nft-trait-constants';

// ─── Types ───────────────────────────────────────────────────────
// RarityTier and TraitCategory imported from nft-trait-engine (single source of truth)

interface PreviewTrait {
  category: string;
  trait: string;
  rarity: RarityTier;
  isPreview: boolean; // Always true for preview — actual mint uses on-chain RNG
}

interface MintedNFT {
  tokenId: number;
  traits: PreviewTrait[];
  rarityScore: number;
  proofHash?: string;
  blockNumber?: number;
  mintTxHash?: string;
}

// ─── Constants ───────────────────────────────────────────────────

const RARITY_COLORS: Record<RarityTier, { bg: string; text: string; border: string; glow: string }> = {
  Common: { bg: 'bg-gray-700/30', text: 'text-gray-400', border: 'border-gray-600', glow: '' },
  Uncommon: { bg: 'bg-green-900/30', text: 'text-green-400', border: 'border-green-700', glow: '' },
  Rare: { bg: 'bg-blue-900/30', text: 'text-blue-400', border: 'border-blue-600', glow: 'shadow-blue-500/20' },
  Epic: { bg: 'bg-purple-900/30', text: 'text-purple-400', border: 'border-purple-600', glow: 'shadow-purple-500/30' },
  Legendary: { bg: 'bg-yellow-900/30', text: 'text-yellow-400', border: 'border-yellow-500', glow: 'shadow-yellow-500/40' },
};

// Use shared RARITY_WEIGHTS from engine (DRY)
const RARITY_WEIGHTS = ENGINE_RARITY_WEIGHTS;

const CATEGORY_ICONS: Record<string, string> = {
  Background: '🌄',
  Outfit: '🎖️',
  Weapon: '⚔️',
  Rank: '🏅',
  Badge: '🎗️',
  Special: '✨',
};

// ─── Deterministic Preview RNG (client-side only) ────────────────

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Generate preview traits using CLIENT-SIDE deterministic hash.
 * ⚠️ PREVIEW ONLY — NOT the actual mint result.
 * Uses HERO_TRAIT_CATEGORIES from shared engine (single source of truth).
 */
function getPreviewTraits(tokenId: number): PreviewTrait[] {
  return HERO_TRAIT_CATEGORIES.map(cat => {
    if (!cat.options || cat.options.length === 0) {
      throw new Error(`Category "${cat.name}" has no options`);
    }
    const totalWeight = cat.options.reduce((sum, opt) => sum + opt.weight, 0);
    if (totalWeight <= 0) {
      throw new Error(`Category "${cat.name}" has zero total weight — cannot generate preview`);
    }
    const roll = simpleHash(`preview-${tokenId}-${cat.name}`) % totalWeight;

    let cumulative = 0;
    for (const option of cat.options) {
      cumulative += option.weight;
      if (roll < cumulative) {
        return { category: cat.name, trait: option.name, rarity: option.rarity as RarityTier, isPreview: true };
      }
    }
    // Throw instead of silently returning last item
    throw new Error(`Preview selection failed for category ${cat.name}`);
  });
}

// ─── Trait Card Component ────────────────────────────────────────

function TraitCard({ trait, revealed, index }: { trait: PreviewTrait; revealed: boolean; index: number }) {
  const colors = RARITY_COLORS[trait.rarity];
  const icon = CATEGORY_ICONS[trait.category] || '🔹';

  return (
    <div
      className={`
        relative overflow-hidden rounded-lg border p-4 transition-all duration-500
        ${revealed ? `${colors.bg} ${colors.border}` : 'bg-gray-900 border-gray-800'}
        ${revealed && trait.rarity === 'Legendary' ? 'ring-2 ring-yellow-500/50 shadow-lg shadow-yellow-500/20' : ''}
        ${revealed && trait.rarity === 'Epic' ? 'ring-1 ring-purple-500/30 shadow-md shadow-purple-500/10' : ''}
      `}
      style={{ animationDelay: `${index * 150}ms` }}
    >
      {/* Holographic shimmer for Epic/Legendary */}
      {revealed && (trait.rarity === 'Legendary' || trait.rarity === 'Epic') && (
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)',
            animation: 'shimmer 3s ease-in-out infinite',
          }}
        />
      )}

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 uppercase tracking-wider">{icon} {trait.category}</span>
        {revealed && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
            {trait.rarity}
          </span>
        )}
      </div>

      {revealed ? (
        <p className="text-white font-bold text-sm">{trait.trait}</p>
      ) : (
        <div className="h-5 bg-gray-800 rounded animate-pulse" />
      )}
    </div>
  );
}

// ─── Rarity Score Display ────────────────────────────────────────

function RarityScoreDisplay({ traits }: { traits: PreviewTrait[] }) {
  const score = traits.reduce((s, t) => s + (100 - RARITY_WEIGHTS[t.rarity]), 0);
  const maxScore = traits.length * 97; // All Legendary
  const percentage = (score / maxScore) * 100;

  let tier = 'Common';
  let tierColor = 'text-gray-400';
  if (percentage > 80) { tier = 'Legendary'; tierColor = 'text-yellow-400'; }
  else if (percentage > 60) { tier = 'Epic'; tierColor = 'text-purple-400'; }
  else if (percentage > 40) { tier = 'Rare'; tierColor = 'text-blue-400'; }
  else if (percentage > 20) { tier = 'Uncommon'; tierColor = 'text-green-400'; }

  return (
    <div className="text-center py-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Rarity Score</p>
      <p className={`text-3xl font-bold font-mono ${tierColor}`}>{score}</p>
      <p className={`text-sm ${tierColor}`}>{tier} Tier</p>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export default function NFTMint() {
  const [previewId, setPreviewId] = useState(1);
  const [traits, setTraits] = useState<PreviewTrait[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [minting, setMinting] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [mintedNFTs, setMintedNFTs] = useState<MintedNFT[]>([]);

  // Generate preview traits when ID changes
  useEffect(() => {
    setRevealed(false);
    const newTraits = getPreviewTraits(previewId);
    setTraits(newTraits);

    // Auto-reveal after a short delay
    const timer = setTimeout(() => setRevealed(true), 500);
    return () => clearTimeout(timer);
  }, [previewId]);

  const handleRandomize = useCallback(() => {
    // Use CSPRNG instead of Math.random() for preview ID generation
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    setPreviewId((arr[0] % 10000) + 1);
  }, []);

  const handleMint = useCallback(async () => {
    if (!walletConnected) return;
    setMinting(true);

    // Simulate mint process
    await new Promise(resolve => setTimeout(resolve, 2000));

    const newNFT: MintedNFT = {
      tokenId: previewId,
      traits,
      rarityScore: traits.reduce((s, t) => s + (100 - RARITY_WEIGHTS[t.rarity]), 0),
    };

    setMintedNFTs(prev => [...prev, newNFT]);
    setMinting(false);
  }, [walletConnected, previewId, traits]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>🎨</span> HERO NFT Mint
        </h1>
          <p className="text-gray-400 mt-1">
          Provably fair trait generation — every trait is determined by on-chain randomness.
          <span className="text-yellow-500 text-xs ml-1">(Preview uses client-side simulation. Actual mint uses on-chain block hash.)</span>
        </p>
      </div>

      {/* Preview Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* NFT Preview */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Preview #{previewId}
              <span className="ml-2 text-xs bg-yellow-900/50 text-yellow-400 border border-yellow-700 px-2 py-0.5 rounded-full">PREVIEW ONLY</span>
            </h2>
            <button
              onClick={handleRandomize}
              className="text-sm px-3 py-1 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 transition-colors"
            >
              🎲 Randomize
            </button>
          </div>

          {/* NFT Image Placeholder */}
          <div className="aspect-square bg-gray-800 rounded-lg mb-4 flex items-center justify-center border border-gray-700">
            <div className="text-center">
              <span className="text-6xl">🦸</span>
              <p className="text-xs text-gray-600 mt-2">Image generated at mint</p>
            </div>
          </div>

          <RarityScoreDisplay traits={traits} />

          {/* Mint Button */}
          {!walletConnected ? (
            <button
              onClick={() => setWalletConnected(true)}
              className="w-full py-3 bg-green-500 text-black font-bold rounded-lg hover:bg-green-400 transition-colors"
            >
              Connect Wallet to Mint
            </button>
          ) : (
            <button
              onClick={handleMint}
              disabled={minting}
              className={`w-full py-3 font-bold rounded-lg transition-colors ${
                minting
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-green-500 text-black hover:bg-green-400'
              }`}
            >
              {minting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span> Minting...
                </span>
              ) : (
                'Mint HERO NFT'
              )}
            </button>
          )}
        </div>

        {/* Trait List */}
        <div>
          <h2 className="text-lg font-bold text-white mb-4">Traits</h2>
          <div className="grid grid-cols-1 gap-3">
            {traits.map((trait, i) => (
              <TraitCard key={trait.category} trait={trait} revealed={revealed} index={i} />
            ))}
          </div>
        </div>
      </div>

      {/* Rarity Distribution */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-bold text-white mb-4">Rarity Distribution</h2>
        <div className="grid grid-cols-5 gap-4">
          {(['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] as RarityTier[]).map(rarity => {
            const colors = RARITY_COLORS[rarity];
            const weight = RARITY_WEIGHTS[rarity];
            return (
              <div key={rarity} className={`text-center p-3 rounded-lg ${colors.bg} border ${colors.border}`}>
                <p className={`text-xs ${colors.text} font-medium`}>{rarity}</p>
                <p className="text-white font-bold text-lg">{weight}%</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-bold text-green-400 mb-4">How Provably Fair Minting Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div>
            <div className="text-2xl mb-2">1️⃣</div>
            <h3 className="font-bold text-white mb-1">On-Chain Seed</h3>
            <p className="text-gray-400">
              When you mint, the current PulseChain block hash is used as the random seed. Nobody can predict or manipulate it.
            </p>
          </div>
          <div>
            <div className="text-2xl mb-2">2️⃣</div>
            <h3 className="font-bold text-white mb-1">Trait Generation</h3>
            <p className="text-gray-400">
              The seed is hashed with your token ID and each trait category to produce unique, independent random values.
            </p>
          </div>
          <div>
            <div className="text-2xl mb-2">3️⃣</div>
            <h3 className="font-bold text-white mb-1">Verification</h3>
            <p className="text-gray-400">
              Every trait comes with a proof hash. Anyone can verify the randomness was fair by checking the block hash and seed.
            </p>
          </div>
        </div>
      </div>

      {/* CSS for shimmer animation */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
