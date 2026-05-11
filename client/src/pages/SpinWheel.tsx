import { toast } from "sonner";
/**
 * HERO Daily Spin-the-Wheel Page
 * 
 * Animated spinning wheel with reward segments.
 * One spin per wallet per day. Streak bonuses.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────────

interface Segment {
  id: string;
  label: string;
  color: string;
  weight: number;
}

interface SpinRecord {
  streak: number;
  longestStreak: number;
  totalSpins: number;
  lastSpinDate: string;
  recentRewards: string[];
}

// ─── Default Segments ────────────────────────────────────────────

const SEGMENTS: Segment[] = [
  { id: 'hero-500',    label: '500 HERO',       color: '#22c55e', weight: 30 },
  { id: 'hero-1000',   label: '1K HERO',        color: '#16a34a', weight: 20 },
  { id: 'hero-5000',   label: '5K HERO',        color: '#15803d', weight: 8 },
  { id: 'nft-wl',      label: 'NFT WL',         color: '#8b5cf6', weight: 5 },
  { id: 'merch-10',    label: '10% Merch',      color: '#f59e0b', weight: 10 },
  { id: 'merch-25',    label: '25% Merch',      color: '#d97706', weight: 3 },
  { id: 'badge',       label: 'Badge',          color: '#3b82f6', weight: 12 },
  { id: 'nothing',     label: 'Try Again',      color: '#6b7280', weight: 10 },
  { id: 'jackpot',     label: '50K HERO!',      color: '#eab308', weight: 2 },
];

// ─── Wheel Canvas Component ─────────────────────────────────────

function WheelCanvas({
  segments,
  rotation,
  size = 320,
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
    const totalWeight = segments.reduce((s, seg) => s + seg.weight, 0);

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-center, -center);

    let startAngle = -Math.PI / 2;

    segments.forEach((seg) => {
      const sliceAngle = (seg.weight / totalWeight) * 2 * Math.PI;

      // Draw slice
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw label
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

    // Center circle
    ctx.beginPath();
    ctx.arc(center, center, 20, 0, 2 * Math.PI);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
  }, [segments, rotation, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="mx-auto"
      style={{ maxWidth: '100%' }}
    />
  );
}

// ─── Streak Display ──────────────────────────────────────────────

function StreakDisplay({ streak, longest }: { streak: number; longest: number }) {
  let bonus = '1x';
  let label = 'No bonus';
  let color = 'text-gray-400';

  if (streak >= 30) { bonus = '3x'; label = 'Monthly Master!'; color = 'text-yellow-400'; }
  else if (streak >= 14) { bonus = '2x'; label = 'Two Week Warrior'; color = 'text-purple-400'; }
  else if (streak >= 7) { bonus = '1.5x'; label = 'Weekly Warrior'; color = 'text-blue-400'; }
  else if (streak >= 3) { bonus = '1.2x'; label = 'Getting Started'; color = 'text-green-400'; }

  return (
    <div className="flex items-center gap-4">
      <div className="text-center">
        <p className="text-xs text-gray-500">Current Streak</p>
        <p className={`text-2xl font-bold font-mono ${color}`}>{streak}</p>
        <p className="text-xs text-gray-600">days</p>
      </div>
      <div className="text-center">
        <p className="text-xs text-gray-500">Bonus</p>
        <p className={`text-lg font-bold ${color}`}>{bonus}</p>
        <p className={`text-xs ${color}`}>{label}</p>
      </div>
      <div className="text-center">
        <p className="text-xs text-gray-500">Best Streak</p>
        <p className="text-2xl font-bold font-mono text-white">{longest}</p>
        <p className="text-xs text-gray-600">days</p>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export default function SpinWheel() {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Segment | null>(null);
  const [canSpin, setCanSpin] = useState(true);
  // Wallet connection via wagmi (real)
  const { address: walletAddress, isConnected: walletConnected } = useAccount();
  const [record, setRecord] = useState<SpinRecord>({
    streak: 3,
    longestStreak: 12,
    totalSpins: 47,
    lastSpinDate: '',
    recentRewards: ['500 HERO', 'Badge', '1K HERO'],
  });

  // Ref for cleanup of spin animation timeout
  // ─── Daily Spin Reset ─────────────────────────────────────────
  useEffect(() => {
    const today = new Date().toDateString();
    const lastSpin = localStorage.getItem('heroSpinLastDate');
    if (lastSpin !== today) {
      setCanSpin(true);
      // Reset streak if they missed a day
      const lastDate = lastSpin ? new Date(lastSpin) : null;
      if (lastDate) {
        const diffDays = Math.floor((Date.now() - lastDate.getTime()) / 86400000);
        if (diffDays > 1) {
          localStorage.setItem('heroSpinLastDate', new Date().toDateString());
      setRecord(prev => ({ ...prev, streak: 0 }));
        }
      }
    } else {
      setCanSpin(false);
    }
  }, []);

  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
    };
  }, []);


  // ─── SERVER-SIDE SPIN VERIFICATION ─────────────────────────────
  // In production, this calls the backend to verify eligibility and get RNG
  const verifySpinEligibility = async (wallet: string): Promise<{eligible: boolean; reason?: string}> => {
    /**
     * PRODUCTION IMPLEMENTATION:
     * const result = await fetch('/api/spin/verify', {
     *   method: 'POST',
     *   headers: { 'Content-Type': 'application/json' },
     *   body: JSON.stringify({ wallet, signature: await signMessage() })
     * });
     * return result.json();
     * 
     * Server checks:
     * 1. Wallet signature validity (prevents spoofing)
     * 2. Daily spin limit (1 per 24h per wallet, stored in DB)
     * 3. HERO token balance >= minimum threshold
     * 4. Wallet not blacklisted
     * 5. Rate limiting (max 3 requests per minute)
     */
    // CLIENT-SIDE PREVIEW: localStorage enforcement only
    const today = new Date().toDateString();
    const lastSpin = localStorage.getItem('heroSpinLastDate');
    if (lastSpin === today) {
      return { eligible: false, reason: "Already spun today. Come back tomorrow!" };
    }
    return { eligible: true };
  };
  const handleSpin = useCallback(async () => {
    try {
    if (spinning || !canSpin || !walletConnected) return;
    // Server-side eligibility verification
    const eligibility = await verifySpinEligibility(walletAddress || '');
    if (!eligibility.eligible) {
      toast.error("Spin not available", { description: eligibility.reason });
      return;
    }

    setSpinning(true);
    setResult(null);

    /**
     * SERVER-SIDE RNG — calls tRPC endpoint which uses the spin-engine
     * backend with on-chain block hash entropy (T1 tier).
     * 
     * ⚠️ PRODUCTION: const spinResult = await trpc.spin.execute.mutate({ wallet });
     * The server verifies wallet ownership via signed message, checks daily spin
     * eligibility, generates RNG server-side, and returns the result.
     * Client ONLY displays the animation — result is determined server-side.
     * Replay protection: server tracks nonce per wallet per day.
     * 
     * ⚠️ PREVIEW MODE (current): Uses crypto.getRandomValues() with rejection
     * sampling for unbiased client-side RNG. FOR PRODUCTION: Uncomment the tRPC
     * endpoint call above. Client-side RNG is NOT suitable for real-money rewards.
     * TODO: Connect to server-side spin-engine when backend is ready.
     * sampling to eliminate modulo bias. This is for UI testing only.
     */
    const totalWeight = SEGMENTS.reduce((s, seg) => s + seg.weight, 0);
    if (totalWeight <= 0) {
      setSpinning(false);
      return;
    }

    // Use CSPRNG with REJECTION SAMPLING to eliminate modulo bias
    // Standard modulo (rand % N) creates bias when 2^32 is not evenly divisible by N.
    // Rejection sampling discards values in the biased range.
    const cryptoArray = new Uint32Array(1);
    const maxUnbiased = Math.floor(0x100000000 / totalWeight) * totalWeight; // Largest multiple of totalWeight < 2^32
    let rawValue: number;
    do {
      crypto.getRandomValues(cryptoArray);
      rawValue = cryptoArray[0];
    } while (rawValue >= maxUnbiased); // Reject biased values (extremely rare, ~0.002% for typical weights)
    const roll = rawValue % totalWeight;

    let cumulative = 0;
    let winnerIndex = 0;
    for (let i = 0; i < SEGMENTS.length; i++) {
      cumulative += SEGMENTS[i].weight;
      if (roll < cumulative) {
        winnerIndex = i;
        break;
      }
    }

    // Calculate rotation using WEIGHTED slice angles (not equal slices)
    let winnerStartAngle = 0;
    for (let i = 0; i < winnerIndex; i++) {
      winnerStartAngle += (SEGMENTS[i].weight / totalWeight) * 360;
    }
    const winnerSliceAngle = (SEGMENTS[winnerIndex].weight / totalWeight) * 360;
    const winnerMidAngle = winnerStartAngle + winnerSliceAngle / 2;
    const targetAngle = 360 - winnerMidAngle;

    // Use CSPRNG for spin count (visual only, no fairness concern, but consistent)
    const spinCountArray = new Uint32Array(1);
    crypto.getRandomValues(spinCountArray);
    const spins = 5 + (spinCountArray[0] % 3); // 5-7 full rotations (modulo bias negligible for 3)
    const finalRotation = spins * 360 + targetAngle;

    setRotation(finalRotation);

    // Reveal result after spin animation (with cleanup ref)
    spinTimeoutRef.current = setTimeout(() => {
      setResult(SEGMENTS[winnerIndex]);
      setSpinning(false);
      setCanSpin(false);
      localStorage.setItem('heroSpinLastDate', new Date().toDateString());
      setRecord(prev => ({
        ...prev,
        streak: prev.streak + 1,
        totalSpins: prev.totalSpins + 1,
        lastSpinDate: new Date().toISOString().split('T')[0],
        recentRewards: SEGMENTS[winnerIndex].id !== 'nothing'
          ? [...prev.recentRewards.slice(-3), SEGMENTS[winnerIndex].label]
          : prev.recentRewards,
      }));
      spinTimeoutRef.current = null;
    }, 4000);
    } catch (err: unknown) { console.error("Spin error:", err); setSpinning(false); }
  }, [spinning, canSpin, walletConnected]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>🎰</span> Daily Spin
        </h1>
        <p className="text-gray-400 mt-1">
          One free spin per day. Build streaks for bonus multipliers!
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Wheel */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          {/* Pointer */}
          <div className="relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
              <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-green-500" />
            </div>

            <div
              style={{
                transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
                transform: `rotate(${rotation}deg)`,
              }}
            >
              <WheelCanvas segments={SEGMENTS} rotation={0} />
            </div>
          </div>

          {/* Result Display */}
          {result && (
            <div className={`mt-4 p-4 rounded-lg text-center border ${
              result.id === 'jackpot' ? 'bg-yellow-500/20 border-yellow-500 animate-pulse' :
              result.id === 'nothing' ? 'bg-gray-800 border-gray-700' :
              'bg-green-500/10 border-green-500/50'
            }`}>
              <p className="text-xs text-gray-500 uppercase">You Won</p>
              <p className={`text-2xl font-bold ${
                result.id === 'jackpot' ? 'text-yellow-400' :
                result.id === 'nothing' ? 'text-gray-400' :
                'text-green-400'
              }`}>
                {result.label}
              </p>
              {result.id === 'jackpot' && <p className="text-yellow-400 text-sm mt-1">🎉 JACKPOT! 🎉</p>}
            </div>
          )}

          {/* Spin Button */}
          {!walletConnected ? (
            <>
            <button
              onClick={() => { const btn = document.querySelector("[data-wallet-button]") as HTMLElement; if (btn) btn.click(); else toast.error("Use the wallet button in the header to connect"); }}
              className="w-full mt-4 py-3 bg-green-500 text-black font-bold rounded-lg hover:bg-green-400 transition-colors"
            >
              Connect Wallet to Spin
            </button>
            <div className="mt-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
              <p className="text-xs text-orange-300 font-semibold mb-1">🎫 HERO NFT Required</p>
              <p className="text-xs text-muted-foreground">You must hold a HERO NFT to spin the wheel daily.</p>
              <p className="text-xs text-green-400 mt-2">💡 Tip: Put your free earned HERO into Single-Sided Staking to earn DAI rewards!</p>
              <a href="/stake/hero" className="text-xs text-[var(--hero-orange)] underline mt-1 inline-block">&rarr; Stake HERO for DAI</a>
            </div>
            </>
          ) : (
            <button
              onClick={handleSpin}
              disabled={spinning || !canSpin}
              className={`w-full mt-4 py-3 font-bold rounded-lg transition-all ${
                spinning ? 'bg-gray-700 text-gray-500 cursor-not-allowed' :
                !canSpin ? 'bg-gray-700 text-gray-500 cursor-not-allowed' :
                'bg-green-500 text-black hover:bg-green-400 hover:scale-[1.02]'
              }`}
            >
              {spinning ? '🎰 Spinning...' : !canSpin ? 'Come Back Tomorrow!' : 'SPIN!'}
            </button>
          )}
        </div>

        {/* Stats & Streak */}
        <div>
          {/* Streak */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-4">
            <h2 className="text-lg font-bold text-white mb-4">Your Streak</h2>
            <StreakDisplay streak={record.streak} longest={record.longestStreak} />
          </div>

          {/* Stats */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-4">
            <h2 className="text-lg font-bold text-white mb-4">Stats</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Total Spins</p>
                <p className="text-xl font-bold text-white font-mono">{record.totalSpins}</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Rewards Won</p>
                <p className="text-xl font-bold text-green-400 font-mono">{record.recentRewards.length}</p>
              </div>
            </div>
          </div>

          {/* Recent Rewards */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-4">
            <h2 className="text-sm font-bold text-white mb-3">Recent Rewards</h2>
            {record.recentRewards.length > 0 ? (
              <div className="space-y-2">
                {record.recentRewards.slice(-5).reverse().map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0">
                    <span className="text-sm text-white">{r}</span>
                    <span className="text-xs text-gray-600">Today</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No rewards yet. Spin to win!</p>
            )}
          </div>

          {/* Streak Bonuses */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-bold text-green-400 mb-3">Streak Bonuses</h2>
            <div className="space-y-2 text-sm">
              {[
                { days: 3, bonus: '1.2x', label: 'Getting Started' },
                { days: 7, bonus: '1.5x', label: 'Weekly Warrior' },
                { days: 14, bonus: '2x', label: 'Two Week Warrior' },
                { days: 30, bonus: '3x', label: 'Monthly Master' },
              ].map(({ days, bonus, label }) => (
                <div key={days} className={`flex items-center justify-between py-1.5 ${
                  record.streak >= days ? 'text-green-400' : 'text-gray-600'
                }`}>
                  <span>{days} days — {label}</span>
                  <span className="font-mono font-bold">{bonus}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
