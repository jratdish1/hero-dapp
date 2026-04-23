/**
 * HERO Community Giveaways/Raffles Page
 * 
 * Features:
 * - Active raffle display with countdown
 * - Entry button (wallet connect required)
 * - Winner announcement with confetti
 * - Historical raffle results with proof links
 */

import React, { useState, useEffect, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────

interface RaffleDisplay {
  id: string;
  title: string;
  description: string;
  prize: string;
  prizeValue?: string;
  status: 'upcoming' | 'active' | 'completed';
  entries: number;
  maxEntries: number;
  winnerCount: number;
  minHeroBalance: string;
  startTime: number;
  endTime: number;
  winners?: Array<{
    wallet: string;
    proofHash: string;
    blockNumber: number;
  }>;
  hasEntered?: boolean;
}

// ─── Countdown Hook ──────────────────────────────────────────────

function useCountdown(target: number) {
  const [left, setLeft] = useState({ d: 0, h: 0, m: 0, s: 0 });
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      setLeft({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff / 3600000) % 24),
        m: Math.floor((diff / 60000) % 60),
        s: Math.floor((diff / 1000) % 60),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return left;
}

// ─── Raffle Card ─────────────────────────────────────────────────

function RaffleCard({ raffle, onEnter }: { raffle: RaffleDisplay; onEnter: (id: string) => void }) {
  const countdown = useCountdown(raffle.endTime);
  const isActive = raffle.status === 'active';
  const isCompleted = raffle.status === 'completed';
  const fillPercent = raffle.maxEntries > 0
    ? Math.min(100, (raffle.entries / raffle.maxEntries) * 100)
    : 0;

  return (
    <div className={`rounded-xl border p-6 transition-all ${
      isActive ? 'border-green-500/50 bg-gray-900/80' :
      isCompleted ? 'border-gray-700 bg-gray-900/40 opacity-80' :
      'border-yellow-500/30 bg-gray-900/60'
    }`}>
      {/* Status Badge */}
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
          isActive ? 'bg-green-500/20 text-green-400' :
          isCompleted ? 'bg-gray-700 text-gray-400' :
          'bg-yellow-500/20 text-yellow-400'
        }`}>
          {raffle.status === 'upcoming' ? 'Coming Soon' :
           raffle.status === 'active' ? 'Live Now' : 'Completed'}
        </span>
        <span className="text-xs text-gray-500">#{raffle.id}</span>
      </div>

      {/* Title & Description */}
      <h3 className="text-lg font-bold text-white mb-1">{raffle.title}</h3>
      <p className="text-sm text-gray-400 mb-4">{raffle.description}</p>

      {/* Prize */}
      <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
        <p className="text-xs text-gray-500 uppercase">Prize</p>
        <p className="text-white font-bold">{raffle.prize}</p>
        {raffle.prizeValue && <p className="text-xs text-green-400">{raffle.prizeValue}</p>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4 text-center">
        <div>
          <p className="text-xs text-gray-500">Entries</p>
          <p className="text-white font-mono font-bold">
            {raffle.entries}{raffle.maxEntries > 0 ? `/${raffle.maxEntries}` : ''}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Winners</p>
          <p className="text-white font-mono font-bold">{raffle.winnerCount}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Min HERO</p>
          <p className="text-white font-mono font-bold">{raffle.minHeroBalance}</p>
        </div>
      </div>

      {/* Entry Progress Bar */}
      {raffle.maxEntries > 0 && (
        <div className="mb-4">
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500/60 rounded-full transition-all"
              style={{ width: `${fillPercent}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 mt-1">{fillPercent.toFixed(0)}% full</p>
        </div>
      )}

      {/* Countdown / Winners */}
      {isActive && (
        <>
          <div className="flex justify-center gap-2 mb-4">
            {[
              { v: countdown.d, l: 'd' },
              { v: countdown.h, l: 'h' },
              { v: countdown.m, l: 'm' },
              { v: countdown.s, l: 's' },
            ].map(({ v, l }) => (
              <div key={l} className="text-center">
                <div className="text-sm font-mono font-bold text-white bg-gray-800 px-2 py-1 rounded">
                  {String(v).padStart(2, '0')}
                </div>
                <span className="text-xs text-gray-600">{l}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => onEnter(raffle.id)}
            disabled={raffle.hasEntered}
            className={`w-full py-2.5 rounded-lg font-bold text-sm transition-colors ${
              raffle.hasEntered
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-green-500 text-black hover:bg-green-400'
            }`}
          >
            {raffle.hasEntered ? '✅ Entered' : 'Enter Raffle'}
          </button>
        </>
      )}

      {/* Winners Display */}
      {isCompleted && raffle.winners && (
        <div className="mt-2">
          <p className="text-xs text-gray-500 uppercase mb-2">Winners</p>
          {raffle.winners.map((w, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0">
              <span className="text-sm text-white font-mono">
                {w.wallet.slice(0, 6)}...{w.wallet.slice(-4)}
              </span>
              <a
                href={`https://scan.pulsechain.com/block/${w.blockNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-400 hover:underline"
              >
                Verify →
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export default function Giveaways() {
  const [raffles, setRaffles] = useState<RaffleDisplay[]>([]);
  const [walletConnected, setWalletConnected] = useState(false);

  useEffect(() => {
    // Mock data — replace with tRPC calls
    setRaffles([
      {
        id: 'raffle-001',
        title: 'HERO Launch Celebration',
        description: 'Celebrate the HERO ecosystem launch! Win HERO tokens just for being a holder.',
        prize: '100,000 HERO Tokens',
        prizeValue: '~$22.40',
        status: 'active',
        entries: 47,
        maxEntries: 100,
        winnerCount: 3,
        minHeroBalance: '10,000',
        startTime: Date.now() - 5 * 86400000,
        endTime: Date.now() + 10 * 86400000,
      },
      {
        id: 'raffle-002',
        title: 'Veterans Day Special',
        description: 'Special giveaway honoring all who served. Extra entries for verified veterans.',
        prize: '250,000 HERO + Exclusive NFT',
        prizeValue: '~$56.00 + NFT',
        status: 'upcoming',
        entries: 0,
        maxEntries: 500,
        winnerCount: 5,
        minHeroBalance: '1,000',
        startTime: Date.now() + 30 * 86400000,
        endTime: Date.now() + 60 * 86400000,
      },
    ]);
  }, []);

  const handleEnter = useCallback((raffleId: string) => {
    if (!walletConnected) return;
    // TODO: Call tRPC mutation
    setRaffles(prev => prev.map(r =>
      r.id === raffleId ? { ...r, hasEntered: true, entries: r.entries + 1 } : r
    ));
  }, [walletConnected]);

  const activeRaffles = raffles.filter(r => r.status === 'active');
  const upcomingRaffles = raffles.filter(r => r.status === 'upcoming');
  const completedRaffles = raffles.filter(r => r.status === 'completed');

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>🎉</span> Community Giveaways
        </h1>
        <p className="text-gray-400 mt-1">
          Provably fair raffles — winners selected by on-chain randomness. Hold HERO to enter.
        </p>
      </div>

      {!walletConnected && (
        <div className="mb-6 p-4 bg-gray-800/50 border border-gray-700 rounded-lg text-center">
          <p className="text-sm text-gray-400 mb-3">Connect your wallet to enter raffles</p>
          <button
            onClick={() => setWalletConnected(true)}
            className="px-6 py-2 bg-green-500 text-black font-bold rounded-lg hover:bg-green-400 transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      )}

      {activeRaffles.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-green-400 mb-4">Active Raffles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeRaffles.map(r => <RaffleCard key={r.id} raffle={r} onEnter={handleEnter} />)}
          </div>
        </div>
      )}

      {upcomingRaffles.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-yellow-400 mb-4">Upcoming</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingRaffles.map(r => <RaffleCard key={r.id} raffle={r} onEnter={handleEnter} />)}
          </div>
        </div>
      )}

      {completedRaffles.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-400 mb-4">Past Raffles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedRaffles.map(r => <RaffleCard key={r.id} raffle={r} onEnter={handleEnter} />)}
          </div>
        </div>
      )}

      {/* Fairness Info */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <h3 className="text-sm font-bold text-green-400 mb-3">Provably Fair Guarantee</h3>
        <p className="text-sm text-gray-400">
          Every raffle winner is selected using on-chain randomness from PulseChain block hashes.
          The selection is provably fair — anyone can verify the result by checking the block hash,
          seed, and proof hash on the PulseChain explorer. No one, including the HERO team, can
          influence or predict the outcome.
        </p>
      </div>
    </div>
  );
}
