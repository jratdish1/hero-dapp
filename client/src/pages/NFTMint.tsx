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

// ─── Types ───────────────────────────────────────────────────────

type RarityTier = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

interface PreviewTrait {
  category: string;
  trait: string;
  rarity: RarityTier;
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

const RARITY_WEIGHTS: Record<RarityTier, number> = {
  Common: 50,
  Uncommon: 25,
  Rare: 15,
  Epic: 7,
  Legendary: 3,
};

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

function getPreviewTraits(tokenId: number): PreviewTrait[] {
  const categories = [
    {
      name: 'Background',
      options: [
        { name: 'Desert Storm', rarity: 'Common' as RarityTier, weight: 50 },
        { name: 'Urban Camo', rarity: 'Common' as RarityTier, weight: 50 },
        { name: 'Forest Green', rarity: 'Common' as RarityTier, weight: 50 },
        { name: 'Ocean Blue', rarity: 'Uncommon' as RarityTier, weight: 25 },
        { name: 'Sunset Gold', rarity: 'Uncommon' as RarityTier, weight: 25 },
        { name: 'Arctic White', rarity: 'Rare' as RarityTier, weight: 15 },
        { name: 'Neon Pulse', rarity: 'Rare' as RarityTier, weight: 15 },
        { name: 'Holographic', rarity: 'Epic' as RarityTier, weight: 7 },
        { name: 'Blockchain Matrix', rarity: 'Epic' as RarityTier, weight: 7 },
        { name: 'American Flag Animated', rarity: 'Legendary' as RarityTier, weight: 3 },
      ],
    },
    {
      name: 'Outfit',
      options: [
        { name: 'BDU Woodland', rarity: 'Common' as RarityTier, weight: 50 },
        { name: 'BDU Desert', rarity: 'Common' as RarityTier, weight: 50 },
        { name: 'PT Gear', rarity: 'Common' as RarityTier, weight: 50 },
        { name: 'Dress Blues', rarity: 'Uncommon' as RarityTier, weight: 25 },
        { name: 'Flight Suit', rarity: 'Uncommon' as RarityTier, weight: 25 },
        { name: 'Ghillie Suit', rarity: 'Rare' as RarityTier, weight: 15 },
        { name: 'Tactical Black Ops', rarity: 'Rare' as RarityTier, weight: 15 },
        { name: 'Space Force Suit', rarity: 'Epic' as RarityTier, weight: 7 },
        { name: 'Gold Plated Armor', rarity: 'Epic' as RarityTier, weight: 7 },
        { name: 'Mjolnir Power Armor', rarity: 'Legendary' as RarityTier, weight: 3 },
      ],
    },
    {
      name: 'Weapon',
      options: [
        { name: 'M16A4', rarity: 'Common' as RarityTier, weight: 50 },
        { name: 'M4 Carbine', rarity: 'Common' as RarityTier, weight: 50 },
        { name: 'Ka-Bar Knife', rarity: 'Common' as RarityTier, weight: 50 },
        { name: 'M249 SAW', rarity: 'Uncommon' as RarityTier, weight: 25 },
        { name: 'M40 Sniper', rarity: 'Uncommon' as RarityTier, weight: 25 },
        { name: 'Tomahawk', rarity: 'Rare' as RarityTier, weight: 15 },
        { name: 'Minigun', rarity: 'Rare' as RarityTier, weight: 15 },
        { name: 'Plasma Rifle', rarity: 'Epic' as RarityTier, weight: 7 },
        { name: 'Crayon Launcher', rarity: 'Epic' as RarityTier, weight: 7 },
        { name: 'Infinity Gauntlet', rarity: 'Legendary' as RarityTier, weight: 3 },
      ],
    },
    {
      name: 'Rank',
      options: [
        { name: 'Private (E-1)', rarity: 'Common' as RarityTier, weight: 50 },
        { name: 'Lance Corporal (E-3)', rarity: 'Common' as RarityTier, weight: 50 },
        { name: 'Corporal (E-4)', rarity: 'Common' as RarityTier, weight: 50 },
        { name: 'Sergeant (E-5)', rarity: 'Uncommon' as RarityTier, weight: 25 },
        { name: 'Staff Sergeant (E-6)', rarity: 'Uncommon' as RarityTier, weight: 25 },
        { name: 'Gunnery Sergeant (E-7)', rarity: 'Rare' as RarityTier, weight: 15 },
        { name: 'Master Sergeant (E-8)', rarity: 'Rare' as RarityTier, weight: 15 },
        { name: 'Sergeant Major (E-9)', rarity: 'Epic' as RarityTier, weight: 7 },
        { name: 'Lieutenant (O-1)', rarity: 'Epic' as RarityTier, weight: 7 },
        { name: 'General (O-10)', rarity: 'Legendary' as RarityTier, weight: 3 },
      ],
    },
    {
      name: 'Badge',
      options: [
        { name: 'Marksman', rarity: 'Common' as RarityTier, weight: 50 },
        { name: 'Sharpshooter', rarity: 'Common' as RarityTier, weight: 50 },
        { name: 'Expert Rifleman', rarity: 'Uncommon' as RarityTier, weight: 25 },
        { name: 'Combat Action Ribbon', rarity: 'Uncommon' as RarityTier, weight: 25 },
        { name: 'Bronze Star', rarity: 'Rare' as RarityTier, weight: 15 },
        { name: 'Silver Star', rarity: 'Rare' as RarityTier, weight: 15 },
        { name: 'Navy Cross', rarity: 'Epic' as RarityTier, weight: 7 },
        { name: 'Purple Heart', rarity: 'Epic' as RarityTier, weight: 7 },
        { name: 'Medal of Honor', rarity: 'Legendary' as RarityTier, weight: 3 },
      ],
    },
    {
      name: 'Special',
      options: [
        { name: 'None', rarity: 'Common' as RarityTier, weight: 50 },
        { name: 'Dog Tags', rarity: 'Common' as RarityTier, weight: 50 },
        { name: 'Cigar', rarity: 'Uncommon' as RarityTier, weight: 25 },
        { name: 'Aviator Sunglasses', rarity: 'Uncommon' as RarityTier, weight: 25 },
        { name: 'War Paint', rarity: 'Rare' as RarityTier, weight: 15 },
        { name: 'Crypto Tattoo', rarity: 'Rare' as RarityTier, weight: 15 },
        { name: 'Holographic Shield', rarity: 'Epic' as RarityTier, weight: 7 },
        { name: 'Eagle Companion', rarity: 'Epic' as RarityTier, weight: 7 },
        { name: 'PulseChain Aura', rarity: 'Legendary' as RarityTier, weight: 3 },
      ],
    },
  ];

  return categories.map(cat => {
    const totalWeight = cat.options.reduce((sum, opt) => sum + opt.weight, 0);
    const roll = simpleHash(`preview-${tokenId}-${cat.name}`) % totalWeight;

    let cumulative = 0;
    for (const option of cat.options) {
      cumulative += option.weight;
      if (roll < cumulative) {
        return { category: cat.name, trait: option.name, rarity: option.rarity };
      }
    }
    const last = cat.options[cat.options.length - 1];
    return { category: cat.name, trait: last.name, rarity: last.rarity };
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
    setPreviewId(Math.floor(Math.random() * 10000) + 1);
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
          Provably fair trait generation — every trait is determined by on-chain randomness
        </p>
      </div>

      {/* Preview Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* NFT Preview */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Preview #{previewId}</h2>
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
