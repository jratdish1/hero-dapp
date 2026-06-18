/**
 * HERO Cards — NFT Mint Page (Production)
 * 
 * Connects to the HeroCards ERC-721 contract on supported chains (currently Base and PulseChain).
 * Features:
 * - Real on-chain minting via wagmi/viem
 * - Live supply counter
 * - Mint phase awareness (Closed/Whitelist/Public)
 * - Holder utility display (tier, fee discount, spin access)
 * - Quantity selector (1-20 per wallet)
 * - IPFS artwork preview from Lighthouse
 * - Transaction status tracking
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useHeroCards, MintPhase, HolderTier, TIER_NAMES, TIER_COLORS } from '../lib/useHeroCards';
import { HERO_CARDS_BASE_URI, HERO_CARDS_MAX_SUPPLY } from '../lib/heroCards-abi';

// ─── IPFS Gateway for artwork preview ────────────────────────────
const IPFS_GATEWAY = "https://gateway.lighthouse.storage/ipfs/";

function resolveIPFS(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    return IPFS_GATEWAY + uri.replace("ipfs://", "");
  }
  return uri;
}

// ─── Phase Badge Component ───────────────────────────────────────
function PhaseBadge({ phase }: { phase: MintPhase }) {
  const config = {
    [MintPhase.CLOSED]: { label: 'CLOSED', bg: 'bg-red-900/50', text: 'text-red-400', border: 'border-red-700' },
    [MintPhase.WHITELIST]: { label: 'WHITELIST', bg: 'bg-purple-900/50', text: 'text-purple-400', border: 'border-purple-700' },
    [MintPhase.PUBLIC]: { label: 'PUBLIC MINT LIVE', bg: 'bg-green-900/50', text: 'text-green-400', border: 'border-green-700' },
  };
  const c = config[phase];
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold ${c.bg} ${c.text} border ${c.border}`}>
      {c.label}
    </span>
  );
}

// ─── Holder Utility Card ─────────────────────────────────────────
function HolderUtilityCard({ 
  isHolder, holderTier, tierName, tierColor, feeDiscount, canSpin 
}: {
  isHolder: boolean;
  holderTier: HolderTier;
  tierName: string;
  tierColor: string;
  feeDiscount: number;
  canSpin: boolean;
}) {
  if (!isHolder) return null;
  return (
    <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-700/50 rounded-xl p-4 mb-6">
      <h3 className="text-sm font-bold text-green-400 mb-3 flex items-center gap-2">
        <span>🎖️</span> Your HERO Card Holder Benefits
      </h3>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-black/30 rounded-lg p-3">
          <p className="text-xs text-gray-400">Tier</p>
          <p className={`font-bold ${tierColor}`}>{tierName}</p>
        </div>
        <div className="bg-black/30 rounded-lg p-3">
          <p className="text-xs text-gray-400">Fee Discount</p>
          <p className="font-bold text-green-400">{feeDiscount}%</p>
        </div>
        <div className="bg-black/30 rounded-lg p-3">
          <p className="text-xs text-gray-400">Spin Wheel</p>
          <p className={`font-bold ${canSpin ? 'text-green-400' : 'text-red-400'}`}>
            {canSpin ? '✓ Access' : '✗ Locked'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────
export default function NFTMint() {
  const {
    // Chain
    chainName, chainSupported, nativeSymbol,
    // Collection
    totalMinted, maxSupply, remaining, mintPhase, mintPrice, whitelistPrice,
    // User
    isConnected, address, userBalance, userMinted, maxMintable, canMint,
    // Holder Utility
    isHolder, holderTier, tierName, tierColor, feeDiscount, canSpin,
    // Mint Actions
    mint, isMinting, isConfirming, mintSuccess, mintError, mintTxHash, mintTxExplorerUrl, refetchMinted,
  } = useHeroCards();

  const [quantity, setQuantity] = useState(1);
  const [previewId, setPreviewId] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);

  // Show success toast when mint confirms
  useEffect(() => {
    if (mintSuccess) {
      setShowSuccess(true);
      refetchMinted();
      const timer = setTimeout(() => setShowSuccess(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [mintSuccess, refetchMinted]);

  // Random preview
  const handleRandomize = useCallback(() => {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    setPreviewId((arr[0] % HERO_CARDS_MAX_SUPPLY) + 1);
  }, []);

  const handleMint = useCallback(() => {
    if (!canMint) return;
    mint(quantity);
  }, [canMint, mint, quantity]);

  const currentPrice = mintPhase === MintPhase.WHITELIST ? whitelistPrice : mintPrice;
  const totalCost = (parseFloat(currentPrice) * quantity).toFixed(4);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">
          HERO Cards <span className="text-green-400">NFT Mint</span>
        </h1>
        <p className="text-gray-400 mb-4">
          1,500 Unique Military Trading Cards — Base &amp; PulseChain
        </p>
        {isConnected && (
          <p className="text-xs mt-1 mb-2">
            {chainSupported
              ? <span className="text-green-400">Connected: {chainName} ({nativeSymbol})</span>
              : <span className="text-red-400">Unsupported chain. Please switch to Base or PulseChain.</span>
            }
          </p>
        )}
        <PhaseBadge phase={mintPhase} />
      </div>

      {/* Supply Progress Bar */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">Minted</span>
          <span className="text-white font-mono">{totalMinted} / {maxSupply}</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-1000"
            style={{ width: `${(totalMinted / maxSupply) * 100}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">{remaining} remaining</p>
      </div>

      {/* Holder Utility Card (only shows if holder) */}
      <HolderUtilityCard 
        isHolder={isHolder}
        holderTier={holderTier}
        tierName={tierName}
        tierColor={tierColor}
        feeDiscount={feeDiscount}
        canSpin={canSpin}
      />

      {/* Main Grid */}
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
          {/* NFT Artwork from IPFS */}
          <div className="aspect-square bg-gray-800 rounded-lg mb-4 overflow-hidden border border-gray-700">
            <img
              src={resolveIPFS(`${HERO_CARDS_BASE_URI}${previewId}`)}
              alt={`HERO Card #${previewId}`}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/hero-logo-200.webp';
              }}
            />
          </div>
          <p className="text-xs text-gray-500 text-center mb-4">
            Actual card assigned randomly at mint via on-chain randomization
          </p>
        </div>

        {/* Mint Panel */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-6">Mint Your HERO Card</h2>

          {/* Price Info */}
          <div className="bg-black/30 rounded-lg p-4 mb-4">
            <div className="flex justify-between mb-2">
              <span className="text-gray-400">Price per NFT</span>
              <span className="text-white font-mono">{currentPrice} {nativeSymbol}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-400">Your mints</span>
              <span className="text-white font-mono">{userMinted} / 20</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Your balance</span>
              <span className="text-green-400 font-mono">{userBalance} NFTs held</span>
            </div>
          </div>

          {/* Quantity Selector */}
          <div className="mb-4">
            <label className="text-sm text-gray-400 mb-2 block">Quantity</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 bg-gray-800 text-white rounded-lg hover:bg-gray-700 font-bold"
                disabled={quantity <= 1}
              >
                -
              </button>
              <span className="text-2xl font-bold text-white font-mono w-12 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(Math.min(maxMintable, quantity + 1))}
                className="w-10 h-10 bg-gray-800 text-white rounded-lg hover:bg-gray-700 font-bold"
                disabled={quantity >= maxMintable}
              >
                +
              </button>
              <button
                onClick={() => setQuantity(maxMintable)}
                className="ml-auto text-xs px-3 py-1 bg-gray-800 text-gray-400 rounded hover:bg-gray-700"
              >
                MAX
              </button>
            </div>
          </div>

          {/* Total Cost */}
          <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-3 mb-6">
            <div className="flex justify-between">
              <span className="text-green-400 font-medium">Total Cost</span>
              <span className="text-green-400 font-bold font-mono">{totalCost} {nativeSymbol}</span>
            </div>
          </div>

          {/* Mint Button */}
          {!isConnected ? (
            <button
              className="w-full py-4 bg-gray-700 text-gray-400 font-bold rounded-lg cursor-not-allowed"
              disabled
            >
              Connect Wallet First
            </button>
          ) : mintPhase === MintPhase.CLOSED ? (
            <button
              className="w-full py-4 bg-red-900/50 text-red-400 font-bold rounded-lg cursor-not-allowed border border-red-700"
              disabled
            >
              Minting Not Yet Open
            </button>
          ) : !canMint ? (
            <button
              className="w-full py-4 bg-gray-700 text-gray-400 font-bold rounded-lg cursor-not-allowed"
              disabled
            >
              {remaining === 0 ? 'SOLD OUT' : 'Wallet Limit Reached'}
            </button>
          ) : (
            <button
              onClick={handleMint}
              disabled={isMinting || isConfirming}
              className={`w-full py-4 font-bold rounded-lg transition-all duration-200 ${
                isMinting || isConfirming
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-emerald-400 text-black hover:from-green-400 hover:to-emerald-300 shadow-lg shadow-green-500/20'
              }`}
            >
              {isMinting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span> Confirm in Wallet...
                </span>
              ) : isConfirming ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span> Confirming on {chainName}...
                </span>
              ) : (
                `Mint ${quantity} HERO Card${quantity > 1 ? 's' : ''}`
              )}
            </button>
          )}

          {/* Error Display */}
          {mintError && (
            <div className="mt-3 p-3 bg-red-900/30 border border-red-700 rounded-lg">
              <p className="text-red-400 text-sm">
                {mintError.message?.includes('InsufficientPayment') && 'Insufficient ETH for mint'}
                {mintError.message?.includes('ExceedsWalletLimit') && 'Wallet limit reached (20 max)'}
                {mintError.message?.includes('ExceedsMaxSupply') && 'Collection sold out!'}
                {mintError.message?.includes('MintClosed') && 'Minting is currently closed'}
                {!mintError.message?.includes('Insufficient') && 
                 !mintError.message?.includes('Exceeds') && 
                 !mintError.message?.includes('MintClosed') && 
                 (mintError.message?.slice(0, 100) || 'Transaction failed')}
              </p>
            </div>
          )}

          {/* Success Toast */}
          {showSuccess && mintTxHash && (
            <div className="mt-3 p-3 bg-green-900/30 border border-green-700 rounded-lg">
              <p className="text-green-400 text-sm font-medium mb-1">
                🎉 Successfully minted {quantity} HERO Card{quantity > 1 ? 's' : ''}!
              </p>
              <a
                href={mintTxExplorerUrl ?? `https://basescan.org/tx/${mintTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-500 hover:text-green-300 underline"
              >
                View on {chainName} Explorer →
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Utility Info Section */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-bold text-green-400 mb-4">NFT Holder Utility</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-black/30 rounded-lg p-4 text-center border border-gray-800">
            <div className="text-2xl mb-2">💰</div>
            <h3 className="font-bold text-white text-sm mb-1">2% Fee Discount</h3>
            <p className="text-xs text-gray-400">Reduced swap fees on HeroBase DEX for all holders</p>
          </div>
          <div className="bg-black/30 rounded-lg p-4 text-center border border-gray-800">
            <div className="text-2xl mb-2">🎡</div>
            <h3 className="font-bold text-white text-sm mb-1">Spin Wheel Access</h3>
            <p className="text-xs text-gray-400">Must hold at least 1 HERO Card to access the prize wheel</p>
          </div>
          <div className="bg-black/30 rounded-lg p-4 text-center border border-gray-800">
            <div className="text-2xl mb-2">🏅</div>
            <h3 className="font-bold text-white text-sm mb-1">Tiered Rewards</h3>
            <p className="text-xs text-gray-400">Bronze (1), Silver (3+), Gold (10+) — higher tiers = better prizes</p>
          </div>
          <div className="bg-black/30 rounded-lg p-4 text-center border border-gray-800">
            <div className="text-2xl mb-2">🎲</div>
            <h3 className="font-bold text-white text-sm mb-1">Provably Fair</h3>
            <p className="text-xs text-gray-400">On-chain randomization ensures fair card distribution</p>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-bold text-green-400 mb-4">How Minting Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div>
            <div className="text-2xl mb-2">1️⃣</div>
            <h3 className="font-bold text-white mb-1">Connect & Mint</h3>
            <p className="text-gray-400">
              Connect your wallet on Base or PulseChain. Choose quantity (1-20) and confirm the transaction.
            </p>
          </div>
          <div>
            <div className="text-2xl mb-2">2️⃣</div>
            <h3 className="font-bold text-white mb-1">Random Assignment</h3>
            <p className="text-gray-400">
              After all 1,500 cards are minted, the collection owner triggers on-chain randomization using a future block hash.
            </p>
          </div>
          <div>
            <div className="text-2xl mb-2">3️⃣</div>
            <h3 className="font-bold text-white mb-1">Reveal & Utility</h3>
            <p className="text-gray-400">
              Your card is revealed with its unique artwork from IPFS. Holding unlocks fee discounts, spin wheel, and tiered rewards.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
