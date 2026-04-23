/**
 * HERO DAO — Proposals Page with RNG Fallback
 * 
 * Displays quarterly charity proposals, voting interface,
 * countdown timer, and results with RNG fallback indicator.
 */

import React, { useState, useEffect, useMemo } from 'react';

// ─── Types ───────────────────────────────────────────────────────

interface Nominee {
  id: string;
  name: string;
  description: string;
  website?: string;
  votes: number;
  weight: string; // BigInt as string for display
  percentage: number;
}

interface Proposal {
  id: string;
  quarter: string;
  nominees: Nominee[];
  status: 'active' | 'closed' | 'finalized';
  votingCloses: number;
  quorumThreshold: number;
  currentParticipation: number;
  quorumMet: boolean;
  treasuryAmount: string;
  treasuryUsdValue: string;
  result?: {
    winnerId: string;
    winnerName: string;
    selectionMethod: 'vote' | 'rng_fallback';
    rngProofHash?: string;
    rngBlockNumber?: number;
    emailSent: boolean;
  };
}

// ─── Countdown Timer Hook ────────────────────────────────────────

function useCountdown(targetTimestamp: number) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, targetTimestamp - now);

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [targetTimestamp]);

  return timeLeft;
}

// ─── Quorum Progress Bar ─────────────────────────────────────────

function QuorumBar({ current, threshold }: { current: number; threshold: number }) {
  const percentage = Math.min(100, (current / threshold) * 100);
  const met = current >= threshold;

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-gray-400">Quorum Progress</span>
        <span className={`text-sm font-mono ${met ? 'text-green-400' : 'text-orange-400'}`}>
          {current.toFixed(2)}% / {threshold}% required
        </span>
      </div>
      <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${percentage}%`,
            background: met
              ? 'linear-gradient(90deg, #00ff88, #00cc6a)'
              : 'linear-gradient(90deg, #ff6b35, #ff9a5c)',
          }}
        />
      </div>
      {!met && (
        <p className="text-xs text-orange-400/70 mt-1">
          ⚠ If quorum is not met by deadline, RNG will automatically select the winner
        </p>
      )}
    </div>
  );
}

// ─── Nominee Card ────────────────────────────────────────────────

function NomineeCard({
  nominee,
  isWinner,
  isActive,
  hasVoted,
  onVote,
}: {
  nominee: Nominee;
  isWinner: boolean;
  isActive: boolean;
  hasVoted: boolean;
  onVote: (id: string) => void;
}) {
  return (
    <div
      className={`relative p-5 rounded-lg border transition-all ${
        isWinner
          ? 'border-green-500 bg-green-500/10 ring-2 ring-green-500/30'
          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
      }`}
    >
      {isWinner && (
        <div className="absolute -top-3 left-4 px-3 py-0.5 bg-green-500 text-black text-xs font-bold rounded-full">
          WINNER
        </div>
      )}

      <h3 className="text-lg font-bold text-white mb-1">{nominee.name}</h3>
      <p className="text-sm text-gray-400 mb-4">{nominee.description}</p>

      {nominee.website && (
        <a
          href={nominee.website}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-green-400 hover:underline mb-3 block"
        >
          Visit Website →
        </a>
      )}

      {/* Vote bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{nominee.votes} votes</span>
          <span>{nominee.percentage.toFixed(1)}%</span>
        </div>
        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500/60 rounded-full transition-all"
            style={{ width: `${nominee.percentage}%` }}
          />
        </div>
      </div>

      {isActive && !hasVoted && (
        <button
          onClick={() => onVote(nominee.id)}
          className="w-full py-2 px-4 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-colors text-sm font-medium"
        >
          Vote for {nominee.name}
        </button>
      )}
    </div>
  );
}

// ─── RNG Fallback Badge ──────────────────────────────────────────

function RNGFallbackBadge({ blockNumber, proofHash }: { blockNumber?: number; proofHash?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg">
      <span className="text-orange-400 text-lg">🎲</span>
      <div>
        <p className="text-sm font-medium text-orange-400">Selected by RNG Fallback</p>
        <p className="text-xs text-gray-500">
          Quorum not met — winner selected using provably fair on-chain randomness
          {blockNumber && ` (Block #${blockNumber.toLocaleString()})`}
        </p>
        {proofHash && (
          <p className="text-xs text-gray-600 font-mono mt-1 truncate">
            Proof: {proofHash}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export default function DAOProposals() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasVoted, setHasVoted] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);

  // Mock data for development — replace with tRPC calls
  useEffect(() => {
    // Simulate API call
    const mockProposal: Proposal = {
      id: 'dao-q2-2026',
      quarter: 'Q2 2026',
      nominees: [
        {
          id: 'wwp',
          name: 'Wounded Warrior Project',
          description: 'Support for wounded veterans and their families through mental health, career counseling, and long-term rehabilitation.',
          website: 'https://www.woundedwarriorproject.org',
          votes: 12,
          weight: '450000000000000000000000',
          percentage: 45,
        },
        {
          id: 'dav',
          name: 'Disabled American Veterans',
          description: 'Providing a lifetime of support for veterans of all generations and their families.',
          website: 'https://www.dav.org',
          votes: 8,
          weight: '350000000000000000000000',
          percentage: 35,
        },
        {
          id: 'k9s',
          name: 'K9s For Warriors',
          description: 'Providing service dogs to military veterans suffering from PTSD, TBI, and MST.',
          website: 'https://www.k9sforwarriors.org',
          votes: 5,
          weight: '200000000000000000000000',
          percentage: 20,
        },
      ],
      status: 'active',
      votingCloses: Date.now() + 15 * 24 * 60 * 60 * 1000, // 15 days from now
      quorumThreshold: 10,
      currentParticipation: 3.2,
      quorumMet: false,
      treasuryAmount: '500,000 HERO',
      treasuryUsdValue: '$112.00',
    };

    setProposals([mockProposal]);
    setLoading(false);
  }, []);

  const activeProposal = useMemo(
    () => proposals.find(p => p.status === 'active'),
    [proposals]
  );

  const countdown = useCountdown(activeProposal?.votingCloses || 0);

  const handleVote = (nomineeId: string) => {
    if (!walletConnected) {
      // Trigger wallet connect
      return;
    }
    // TODO: Call tRPC mutation to cast vote
    setHasVoted(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>🏛️</span> DAO Treasury Proposals
        </h1>
        <p className="text-gray-400 mt-1">
          Vote on which charity receives the quarterly HERO treasury allocation
        </p>
      </div>

      {/* Active Proposal */}
      {activeProposal && (
        <div className="mb-8">
          {/* Proposal Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full">
                Active
              </span>
              <h2 className="text-xl font-bold text-white mt-2">{activeProposal.quarter} Treasury Vote</h2>
              <p className="text-sm text-gray-500">
                Treasury: {activeProposal.treasuryAmount} ({activeProposal.treasuryUsdValue})
              </p>
            </div>

            {/* Countdown */}
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">Voting ends in</p>
              <div className="flex gap-2">
                {[
                  { val: countdown.days, label: 'd' },
                  { val: countdown.hours, label: 'h' },
                  { val: countdown.minutes, label: 'm' },
                  { val: countdown.seconds, label: 's' },
                ].map(({ val, label }) => (
                  <div key={label} className="text-center">
                    <div className="text-lg font-mono font-bold text-white bg-gray-800 px-2 py-1 rounded">
                      {String(val).padStart(2, '0')}
                    </div>
                    <span className="text-xs text-gray-600">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quorum Bar */}
          <QuorumBar
            current={activeProposal.currentParticipation}
            threshold={activeProposal.quorumThreshold}
          />

          {/* Wallet Connect */}
          {!walletConnected && (
            <div className="mb-6 p-4 bg-gray-800/50 border border-gray-700 rounded-lg text-center">
              <p className="text-sm text-gray-400 mb-3">Connect your wallet to vote</p>
              <button
                onClick={() => setWalletConnected(true)}
                className="px-6 py-2 bg-green-500 text-black font-bold rounded-lg hover:bg-green-400 transition-colors"
              >
                Connect Wallet
              </button>
            </div>
          )}

          {/* Nominee Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {activeProposal.nominees.map(nominee => (
              <NomineeCard
                key={nominee.id}
                nominee={nominee}
                isWinner={activeProposal.result?.winnerId === nominee.id}
                isActive={activeProposal.status === 'active'}
                hasVoted={hasVoted}
                onVote={handleVote}
              />
            ))}
          </div>

          {/* RNG Fallback Info */}
          {activeProposal.result?.selectionMethod === 'rng_fallback' && (
            <div className="mt-6">
              <RNGFallbackBadge
                blockNumber={activeProposal.result.rngBlockNumber}
                proofHash={activeProposal.result.rngProofHash}
              />
            </div>
          )}

          {/* How It Works */}
          <div className="mt-8 p-5 bg-gray-900/50 border border-gray-800 rounded-lg">
            <h3 className="text-sm font-bold text-green-400 mb-3">How DAO Voting Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-400">
              <div>
                <p className="font-medium text-white mb-1">Token-Weighted Voting</p>
                <p>Your vote weight equals your HERO balance at the snapshot. More HERO = more influence.</p>
              </div>
              <div>
                <p className="font-medium text-white mb-1">Quorum Requirement</p>
                <p>{activeProposal.quorumThreshold}% of circulating supply must participate for votes to count.</p>
              </div>
              <div>
                <p className="font-medium text-orange-400 mb-1">🎲 RNG Fallback</p>
                <p>If quorum isn't met by deadline, a provably fair on-chain RNG automatically selects the winner.</p>
              </div>
              <div>
                <p className="font-medium text-white mb-1">Treasury Disbursement</p>
                <p>Winner receives {activeProposal.treasuryAmount} directly to their wallet. Notification sent to VETSCrypto@pm.me.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Past Proposals */}
      <div className="mt-12">
        <h2 className="text-lg font-bold text-white mb-4">Past Proposals</h2>
        <p className="text-sm text-gray-500">No past proposals yet. The first quarterly vote is underway.</p>
      </div>
    </div>
  );
}
