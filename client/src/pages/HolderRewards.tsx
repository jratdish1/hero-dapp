/**
 * HERO Holder Rewards Page
 * 
 * Displays reward rounds, winner selection results,
 * and eligibility checker for connected wallets.
 */

import React, { useState, useEffect } from 'react';

// ─── Types ───────────────────────────────────────────────────────

interface RewardRoundDisplay {
  id: string;
  title: string;
  description: string;
  rewardAmount: string;
  winnerCount: number;
  eligibleHolders: number;
  status: 'upcoming' | 'active' | 'drawn' | 'distributed';
  snapshotBlock?: number;
  winners?: Array<{
    wallet: string;
    weight: number;
    reward: string;
    proofHash: string;
    distributed: boolean;
  }>;
  drawnAt?: string;
}

// ─── Main Component ──────────────────────────────────────────────

export default function HolderRewards() {
  const [rounds, setRounds] = useState<RewardRoundDisplay[]>([]);
  const [walletConnected, setWalletConnected] = useState(false);
  const [userBalance, setUserBalance] = useState('0');
  const [isEligible, setIsEligible] = useState(false);

  useEffect(() => {
    // Mock data — replace with tRPC
    setRounds([
      {
        id: 'reward-001',
        title: 'April 2026 Holder Airdrop',
        description: 'Random airdrop to HERO holders. Weighted by balance — more HERO = higher chance!',
        rewardAmount: '200,000 HERO',
        winnerCount: 10,
        eligibleHolders: 342,
        status: 'drawn',
        snapshotBlock: 21456789,
        drawnAt: '2026-04-15T12:00:00Z',
        winners: [
          { wallet: '0x1a2b...3c4d', weight: 8.5, reward: '20,000 HERO', proofHash: '0xabc...', distributed: true },
          { wallet: '0x5e6f...7g8h', weight: 5.2, reward: '20,000 HERO', proofHash: '0xdef...', distributed: true },
          { wallet: '0x9i0j...1k2l', weight: 3.1, reward: '20,000 HERO', proofHash: '0xghi...', distributed: true },
        ],
      },
      {
        id: 'reward-002',
        title: 'May 2026 Holder Airdrop',
        description: 'Monthly reward round. Hold HERO to be eligible for random selection.',
        rewardAmount: '300,000 HERO',
        winnerCount: 15,
        eligibleHolders: 0,
        status: 'upcoming',
      },
    ]);
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>🎁</span> Holder Rewards
        </h1>
        <p className="text-gray-400 mt-1">
          Weighted random airdrops — hold more HERO for a higher chance of selection
        </p>
      </div>

      {/* Eligibility Check */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-bold text-white mb-4">Check Your Eligibility</h2>
        {!walletConnected ? (
          <div className="text-center">
            <p className="text-sm text-gray-400 mb-3">Connect wallet to check eligibility</p>
            <button
              onClick={() => { setWalletConnected(true); setUserBalance('125,000'); setIsEligible(true); }}
              className="px-6 py-2 bg-green-500 text-black font-bold rounded-lg hover:bg-green-400 transition-colors"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-xs text-gray-500">Your HERO Balance</p>
              <p className="text-xl font-bold text-white font-mono">{userBalance}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-xs text-gray-500">Eligibility</p>
              <p className={`text-xl font-bold ${isEligible ? 'text-green-400' : 'text-red-400'}`}>
                {isEligible ? '✅ Eligible' : '❌ Need 1,000+ HERO'}
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-xs text-gray-500">Selection Weight</p>
              <p className="text-xl font-bold text-white font-mono">
                {isEligible ? '~2.4%' : '0%'}
              </p>
              <p className="text-xs text-gray-600">Based on your balance vs total eligible</p>
            </div>
          </div>
        )}
      </div>

      {/* Reward Rounds */}
      {rounds.map(round => (
        <div key={round.id} className={`mb-6 border rounded-xl p-6 ${
          round.status === 'upcoming' ? 'border-yellow-500/30 bg-gray-900/60' :
          round.status === 'drawn' ? 'border-green-500/30 bg-gray-900/80' :
          'border-gray-700 bg-gray-900/50'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                round.status === 'upcoming' ? 'bg-yellow-500/20 text-yellow-400' :
                round.status === 'drawn' ? 'bg-green-500/20 text-green-400' :
                round.status === 'distributed' ? 'bg-blue-500/20 text-blue-400' :
                'bg-gray-700 text-gray-400'
              }`}>
                {round.status === 'upcoming' ? 'Upcoming' :
                 round.status === 'drawn' ? 'Winners Selected' :
                 round.status === 'distributed' ? 'Distributed' : 'Active'}
              </span>
              <h3 className="text-lg font-bold text-white mt-2">{round.title}</h3>
              <p className="text-sm text-gray-400">{round.description}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Reward Pool</p>
              <p className="text-white font-bold">{round.rewardAmount}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Winners</p>
              <p className="text-white font-bold">{round.winnerCount}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Eligible Holders</p>
              <p className="text-white font-bold">{round.eligibleHolders || 'TBD'}</p>
            </div>
          </div>

          {/* Winners Table */}
          {round.winners && round.winners.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-green-400 mb-2">Winners</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs uppercase">
                      <th className="text-left py-2 px-3">#</th>
                      <th className="text-left py-2 px-3">Wallet</th>
                      <th className="text-right py-2 px-3">Weight</th>
                      <th className="text-right py-2 px-3">Reward</th>
                      <th className="text-center py-2 px-3">Status</th>
                      <th className="text-right py-2 px-3">Proof</th>
                    </tr>
                  </thead>
                  <tbody>
                    {round.winners.map((w, i) => (
                      <tr key={i} className="border-t border-gray-800">
                        <td className="py-2 px-3 text-gray-400">{i + 1}</td>
                        <td className="py-2 px-3 text-white font-mono">{w.wallet}</td>
                        <td className="py-2 px-3 text-right text-gray-400">{w.weight.toFixed(1)}%</td>
                        <td className="py-2 px-3 text-right text-green-400">{w.reward}</td>
                        <td className="py-2 px-3 text-center">
                          {w.distributed
                            ? <span className="text-green-400 text-xs">✅ Sent</span>
                            : <span className="text-yellow-400 text-xs">⏳ Pending</span>
                          }
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className="text-xs text-gray-600 font-mono">{w.proofHash}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {round.snapshotBlock && (
                <p className="text-xs text-gray-600 mt-2">
                  Snapshot: Block #{round.snapshotBlock?.toLocaleString()} | Drawn: {round.drawnAt ? new Date(round.drawnAt).toLocaleDateString() : 'N/A'}
                </p>
              )}
            </div>
          )}
        </div>
      ))}

      {/* How It Works */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <h3 className="text-sm font-bold text-green-400 mb-3">How Weighted Selection Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-400">
          <div>
            <p className="font-medium text-white mb-1">Weighted Probability</p>
            <p>Your chance of winning is proportional to your HERO balance. Holding 10% of eligible supply = ~10% chance per draw.</p>
          </div>
          <div>
            <p className="font-medium text-white mb-1">Exclusions</p>
            <p>Dead address, zero address, LP contracts, and team wallets are excluded. Must hold 1,000+ HERO to be eligible.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
