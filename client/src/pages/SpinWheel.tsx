import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAccount } from 'wagmi';
/**
 * HERO Daily Spin-the-Wheel V2
 * 
 * Enhanced with:
 * - NFT-tiered wheels (Bronze/Silver/Gold)
 * - Streak multiplier APPLIED to rewards
 * - Claim CTA for on-chain reward distribution
 * - Provably fair verification widget
 * - Social sharing after wins
 * - Burn-for-second-spin mechanism
 * - Leaderboard
 * - Rate limiting awareness
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────────
interface Segment {
  id: string;
  label: string;
  color: string;
  weight: number;
  rewardType: string;
  rewardValue: string;
  tier?: string;
}

interface SpinResult {
  segmentId: string;
  segmentLabel: string;
  rewardType: string;
  rewardValue: string;
  finalRewardValue: string;
  multiplier: number;
  streakAtSpin: number;
  claimable: boolean;
  claimId?: string;
  nftTier: string;
  rngProof: {
    blockHash: string;
    blockNumber: number;
    proofHash: string;
    chain: string;
    timestamp: string;
    value: number;
    seed: string;
  };
  spinTimestamp: number;
}

interface SpinStats {
  totalSpins: number;
  currentStreak: number;
  longestStreak: number;
  totalHeroEarned: number;
  totalBurned: number;
  nftTier: string;
}

// ─── Wheel Canvas Component ─────────────────────────────────────
function WheelCanvas({
  segments,
  rotation,
  size = 340,
}: {
  segments: Segment[];
  rotation: number;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const center = size / 2;
    const radius = center - 10;
    if (!segments || segments.length === 0) return;
    const totalWeight = segments.reduce((s, seg) => s + seg.weight, 0);

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-center, -center);

    let startAngle = -Math.PI / 2;
    segments.forEach((seg) => {
      const sliceAngle = (seg.weight / totalWeight) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px monospace';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(seg.label, radius - 15, 4);
      ctx.restore();

      startAngle += sliceAngle;
    });

    ctx.restore();

    // Pointer triangle
    ctx.beginPath();
    ctx.moveTo(center - 10, 5);
    ctx.lineTo(center + 10, 5);
    ctx.lineTo(center, 25);
    ctx.closePath();
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [segments, rotation, size]);

  return <canvas ref={canvasRef} width={size} height={size} className="mx-auto" />;
}

// ─── Streak Display ─────────────────────────────────────────────
function StreakDisplay({ streak, longest, multiplier }: { streak: number; longest: number; multiplier: number }) {
  const flames = Math.min(streak, 7);
  return (
    <div className="flex items-center gap-4">
      <div className="text-center">
        <div className="text-2xl">{'🔥'.repeat(Math.max(flames, 1))}</div>
        <p className="text-xs text-gray-500 mt-1">
          {streak} day{streak !== 1 ? 's' : ''} | Best: {longest}
        </p>
      </div>
      {multiplier > 1 && (
        <div className="bg-green-500/20 border border-green-500/50 rounded-lg px-3 py-1">
          <span className="text-green-400 font-bold text-sm">{multiplier}x ACTIVE</span>
        </div>
      )}
    </div>
  );
}

// ─── Proof Verification Widget ──────────────────────────────────
function ProofWidget({ proof }: { proof: SpinResult['rngProof'] }) {
  const [expanded, setExpanded] = useState(false);
  if (!proof) return null;
  return (
    <div className="mt-3 border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 bg-gray-800/50 text-xs text-gray-400 flex items-center justify-between hover:bg-gray-800"
      >
        <span>🔒 Provably Fair — Verify Result</span>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="p-3 bg-gray-900/80 text-xs font-mono space-y-1">
          <div><span className="text-gray-500">Block:</span> <span className="text-green-400">{proof.blockNumber}</span></div>
          <div><span className="text-gray-500">Hash:</span> <span className="text-green-400 break-all">{proof.blockHash?.slice(0, 20)}...</span></div>
          <div><span className="text-gray-500">Proof:</span> <span className="text-yellow-400 break-all">{proof.proofHash?.slice(0, 20)}...</span></div>
          <div><span className="text-gray-500">Chain:</span> <span className="text-blue-400">{proof.chain}</span></div>
          <div><span className="text-gray-500">Time:</span> <span className="text-gray-300">{proof.timestamp}</span></div>
          <a
            href={`https://scan.pulsechain.com/block/${proof.blockNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 text-[var(--hero-orange)] underline"
          >
            Verify on PulseChain Explorer →
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Social Share Button ────────────────────────────────────────
function ShareButton({ result, streak }: { result: SpinResult; streak: number }) {
  const shareText = `Just won ${result.finalRewardValue} ${result.rewardType === 'hero_tokens' || result.rewardType === 'jackpot' ? 'HERO' : result.segmentLabel} on @HeroBase_io daily spin! 🎰 Day ${streak} streak ${streak >= 7 ? '🔥' : ''} #HERO #PulseChain #BASE`;
  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent('https://herobase.io/spin')}`;
  
  return (
    <a
      href={shareUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/50 rounded-lg text-blue-400 text-sm hover:bg-blue-500/30 transition-colors"
    >
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      Share Win on X
    </a>
  );
}

// ─── Tier Badge ─────────────────────────────────────────────────
function TierBadge({ tier }: { tier: string }) {
  const config = {
    bronze: { bg: 'bg-orange-900/30', border: 'border-orange-600/50', text: 'text-orange-400', label: '🥉 Bronze Wheel' },
    silver: { bg: 'bg-gray-700/30', border: 'border-gray-400/50', text: 'text-gray-300', label: '🥈 Silver Wheel' },
    gold: { bg: 'bg-yellow-900/30', border: 'border-yellow-500/50', text: 'text-yellow-400', label: '🥇 Gold Wheel' },
  }[tier] || { bg: 'bg-gray-800', border: 'border-gray-600', text: 'text-gray-400', label: 'Bronze Wheel' };

  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full ${config.bg} border ${config.border}`}>
      <span className={`text-xs font-bold ${config.text}`}>{config.label}</span>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────
export default function SpinWheel() {
  const { address: walletAddress, isConnected: walletConnected } = useAccount();
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [stats, setStats] = useState<SpinStats>({ totalSpins: 0, currentStreak: 0, longestStreak: 0, totalHeroEarned: 0, totalBurned: 0, nftTier: 'bronze' });
  const [canSpin, setCanSpin] = useState(true);
  const [canBurn, setCanBurn] = useState(false);
  const [burnCost, setBurnCost] = useState('0');
  const [claiming, setClaiming] = useState(false);
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // tRPC queries
  const eligibilityQuery = trpc.spin.canSpin.useQuery(
    { wallet: walletAddress || '' },
    { enabled: !!walletAddress, refetchOnWindowFocus: true }
  );

  const wheelQuery = trpc.spin.wheel.useQuery(
    { wallet: walletAddress },
    { enabled: true }
  );

  const historyQuery = trpc.spin.history.useQuery(
    { wallet: walletAddress || '' },
    { enabled: !!walletAddress }
  );

  const leaderboardQuery = trpc.spin.leaderboard.useQuery();

  const spinMutation = trpc.spin.execute.useMutation();
  const claimMutation = trpc.spin.claim.useMutation();

  // Update state from queries
  useEffect(() => {
    if (eligibilityQuery.data) {
      setCanSpin(eligibilityQuery.data.eligible);
      setCanBurn(eligibilityQuery.data.canBurnForSpin);
      setBurnCost(eligibilityQuery.data.burnCost);
    }
  }, [eligibilityQuery.data]);

  useEffect(() => {
    if (wheelQuery.data) {
      setSegments(wheelQuery.data.segments);
    }
  }, [wheelQuery.data]);

  useEffect(() => {
    if (historyQuery.data) {
      setStats(historyQuery.data.stats);
    }
  }, [historyQuery.data]);

  // Cleanup
  useEffect(() => {
    return () => { if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current); };
  }, []);

  // ─── Handle Spin ────────────────────────────────────────────────
  const handleSpin = useCallback(async (burnForSecond = false) => {
    if (spinning || (!canSpin && !burnForSecond) || !walletConnected) return;

    setSpinning(true);
    setResult(null);

    try {
      const spinResult = await spinMutation.mutateAsync({
        wallet: walletAddress || '',
        chain: 'pulsechain',
        burnForSecondSpin: burnForSecond,
      });

      // Animate to winning segment
      const totalWeight = segments.reduce((s, seg) => s + seg.weight, 0);
      const winnerIndex = segments.findIndex(s => s.id === spinResult.segmentId);
      if (winnerIndex < 0) {
        toast.error('Invalid spin result. Please try again.');
        setSpinning(false);
        return;
      }
      let winnerStartAngle = 0;
      for (let i = 0; i < winnerIndex; i++) {
        winnerStartAngle += (segments[i].weight / totalWeight) * 360;
      }
      const winnerSliceAngle = (segments[winnerIndex]?.weight || 1) / totalWeight * 360;
      const winnerMidAngle = winnerStartAngle + winnerSliceAngle / 2;
      const targetAngle = 360 - winnerMidAngle;
      const spins = 5 + Math.floor(Math.random() * 3);
      const finalRotation = spins * 360 + targetAngle;

      setRotation(finalRotation);

      spinTimeoutRef.current = setTimeout(() => {
        setResult(spinResult as SpinResult);
        setSpinning(false);
        setCanSpin(false);
        setCanBurn(true);
        // Refetch data
        eligibilityQuery.refetch();
        historyQuery.refetch();
        leaderboardQuery.refetch();

        // Show toast based on result
        if (spinResult.rewardType === 'jackpot') {
          toast.success(`🎉 JACKPOT! ${spinResult.finalRewardValue} HERO!`, { duration: 10000 });
        } else if (spinResult.rewardType === 'hero_tokens') {
          toast.success(`Won ${spinResult.finalRewardValue} HERO! ${spinResult.multiplier > 1 ? `(${spinResult.multiplier}x streak bonus!)` : ''}`);
        } else if (spinResult.rewardType === 'nothing') {
          toast.info("Try Again! Burn HERO for another spin?");
        }
      }, 4500);
    } catch (err: unknown) {
      setSpinning(false);
      toast.error("Spin failed", { description: (err instanceof Error ? err.message : String(err)) || "Please try again" });
    }
  }, [spinning, canSpin, walletConnected, walletAddress, segments, spinMutation, eligibilityQuery, historyQuery, leaderboardQuery]);

  // ─── Handle Claim ───────────────────────────────────────────────
  const handleClaim = useCallback(async () => {
    if (!result || !result.claimable || !result.claimId) return;
    setClaiming(true);
    try {
      const claimResult = await claimMutation.mutateAsync({
        wallet: walletAddress || '',
        claimId: result.claimId,
        spinTimestamp: result.spinTimestamp,
      });
      toast.success(`Claim authorized! ${claimResult.amount} HERO ready for distribution.`);
    } catch (err: unknown) {
      toast.error("Claim failed", { description: err.message });
    } finally {
      setClaiming(false);
    }
  }, [result, walletAddress, claimMutation]);

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Daily Spin Wheel</h1>
          <p className="text-gray-400 text-sm">Spin once per day. Build your streak. Earn HERO.</p>
          {walletConnected && <TierBadge tier={stats.nftTier} />}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Wheel */}
          <div className="lg:col-span-2">
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              {/* Wheel */}
              <div className="relative">
                <WheelCanvas
                  segments={segments.length > 0 ? segments : [{ id: 'loading', label: 'Loading...', color: '#333', weight: 1, rewardType: 'nothing', rewardValue: '0' }]}
                  rotation={rotation}
                  size={340}
                />
              </div>

              {/* Result Display */}
              {result && (
                <div className="mt-4 text-center">
                  <div className={`inline-block px-6 py-3 rounded-xl ${
                    result.rewardType === 'jackpot' ? 'bg-yellow-500/20 border-2 border-yellow-500 animate-pulse' :
                    result.rewardType === 'nothing' ? 'bg-gray-700/50 border border-gray-600' :
                    'bg-green-500/20 border border-green-500/50'
                  }`}>
                    <p className={`text-xl font-bold ${
                      result.rewardType === 'jackpot' ? 'text-yellow-400' :
                      result.rewardType === 'nothing' ? 'text-gray-400' :
                      'text-green-400'
                    }`}>
                      {result.rewardType === 'hero_tokens' || result.rewardType === 'jackpot'
                        ? `${Number(result.finalRewardValue).toLocaleString()} HERO`
                        : result.segmentLabel}
                    </p>
                    {result.multiplier > 1 && (
                      <p className="text-xs text-green-300 mt-1">
                        {result.multiplier}x streak bonus applied! (Base: {Number(result.rewardValue).toLocaleString()})
                      </p>
                    )}
                  </div>

                  {/* Claim CTA */}
                  {result.claimable && (
                    <button
                      onClick={handleClaim}
                      disabled={claiming}
                      className="mt-3 w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-lg hover:from-green-400 hover:to-emerald-500 transition-all shadow-lg shadow-green-500/25 disabled:opacity-50"
                    >
                      {claiming ? '⏳ Processing Claim...' : `💰 CLAIM ${Number(result.finalRewardValue).toLocaleString()} HERO`}
                    </button>
                  )}

                  {/* Social Share */}
                  {result.rewardType !== 'nothing' && (
                    <div className="mt-3">
                      <ShareButton result={result} streak={stats.currentStreak} />
                    </div>
                  )}

                  {/* Burn for second spin */}
                  {result.rewardType === 'nothing' && canBurn && (
                    <button
                      onClick={() => handleSpin(true)}
                      className="mt-3 w-full py-2 bg-orange-500/20 border border-orange-500/50 text-orange-400 font-bold rounded-lg hover:bg-orange-500/30 transition-colors text-sm"
                    >
                      🔥 Burn {burnCost} HERO for Another Spin
                    </button>
                  )}

                  {/* Proof Widget */}
                  {result.rngProof && <ProofWidget proof={result.rngProof} />}
                </div>
              )}

              {/* Spin Button */}
              {!walletConnected ? (
                <div className="mt-4">
                  <button
                    onClick={() => { const btn = document.querySelector("[data-wallet-button]") as HTMLElement; if (btn) btn.click(); else toast.error("Use the wallet button in the header to connect"); }}
                    className="w-full py-3 bg-green-500 text-black font-bold rounded-lg hover:bg-green-400 transition-colors"
                  >
                    Connect Wallet to Spin
                  </button>
                  <div className="mt-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                    <p className="text-xs text-orange-300 font-semibold mb-1">🎫 HERO NFT Unlocks Better Wheels</p>
                    <p className="text-xs text-muted-foreground">Hold HERO NFTs to unlock Silver and Gold wheels with bigger jackpots!</p>
                    <p className="text-xs text-green-400 mt-2">💡 Tip: Put your HERO into Single-Sided Staking to earn DAI!</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => handleSpin(false)}
                  disabled={spinning || !canSpin}
                  className={`w-full mt-4 py-3 font-bold rounded-lg transition-all text-lg ${
                    spinning ? 'bg-gray-700 text-gray-500 cursor-not-allowed animate-pulse' :
                    !canSpin ? 'bg-gray-700 text-gray-500 cursor-not-allowed' :
                    'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-400 hover:to-emerald-500 hover:scale-[1.02] shadow-lg shadow-green-500/25'
                  }`}
                >
                  {spinning ? '🎰 Spinning...' : !canSpin ? '⏰ Come Back Tomorrow!' : '🎰 SPIN!'}
                </button>
              )}
            </div>
          </div>

          {/* Right: Stats & Leaderboard */}
          <div className="space-y-4">
            {/* Streak */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h2 className="text-lg font-bold text-white mb-3">Your Streak</h2>
              <StreakDisplay
                streak={stats.currentStreak}
                longest={stats.longestStreak}
                multiplier={eligibilityQuery.data?.bonus?.multiplier || 1}
              />
              {/* Streak Bonuses */}
              <div className="mt-4 space-y-2 text-sm">
                {[
                  { days: 3, bonus: '1.2x', label: 'Getting Started' },
                  { days: 7, bonus: '1.5x', label: 'Weekly Warrior' },
                  { days: 14, bonus: '2x', label: 'Two Week Warrior' },
                  { days: 30, bonus: '3x', label: 'Monthly Master' },
                ].map(({ days, bonus, label }) => (
                  <div key={days} className={`flex items-center justify-between py-1 ${
                    stats.currentStreak >= days ? 'text-green-400' : 'text-gray-600'
                  }`}>
                    <span>{days}d — {label}</span>
                    <span className="font-mono font-bold">{bonus}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h2 className="text-lg font-bold text-white mb-3">Stats</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Total Spins</p>
                  <p className="text-xl font-bold text-white font-mono">{stats.totalSpins}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">HERO Earned</p>
                  <p className="text-xl font-bold text-green-400 font-mono">{stats.totalHeroEarned.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Leaderboard */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-yellow-400 mb-3">🏆 Top Streakers</h2>
              {leaderboardQuery.data && leaderboardQuery.data.length > 0 ? (
                <div className="space-y-2">
                  {leaderboardQuery.data.slice(0, 10).map((entry: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-5">{i + 1}.</span>
                        <span className="text-xs text-white font-mono">
                          {entry.wallet.slice(0, 6)}...{entry.wallet.slice(-4)}
                        </span>
                      </div>
                      <span className="text-xs text-green-400 font-bold">{entry.currentStreak}d 🔥</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">No streaks yet. Be the first!</p>
              )}
            </div>

            {/* NFT Tier Info */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-purple-400 mb-3">🎫 NFT Tier Upgrades</h2>
              <div className="space-y-2 text-xs">
                <div className={`flex justify-between py-1 ${stats.nftTier === 'bronze' ? 'text-orange-400' : 'text-gray-600'}`}>
                  <span>🥉 Bronze (1 NFT)</span>
                  <span>10K Jackpot</span>
                </div>
                <div className={`flex justify-between py-1 ${stats.nftTier === 'silver' ? 'text-gray-300' : 'text-gray-600'}`}>
                  <span>🥈 Silver (3+ NFTs)</span>
                  <span>50K Jackpot</span>
                </div>
                <div className={`flex justify-between py-1 ${stats.nftTier === 'gold' ? 'text-yellow-400' : 'text-gray-600'}`}>
                  <span>🥇 Gold (10+ NFTs)</span>
                  <span>1M Jackpot!</span>
                </div>
              </div>
              <a href="/nft" className="block mt-3 text-xs text-[var(--hero-orange)] underline">
                → Get HERO NFTs to unlock better wheels
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
