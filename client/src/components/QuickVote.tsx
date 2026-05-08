import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Vote, ThumbsUp, ThumbsDown, Minus, Clock, Users,
  ExternalLink, AlertTriangle, CheckCircle, Loader2
} from "lucide-react";
import { useAccount } from "wagmi";
import { useNetwork } from "@/contexts/NetworkContext";

// ─── Types ────────────────────────────────────────────────────────────
interface ActiveProposal {
  id: string;
  proposalId: string;
  title: string;
  category: string;
  author: string;
  endsAt: string;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  quorum: number;
  currentQuorum: number;
  description: string;
  link: string;
}

// ─── Demo Data ────────────────────────────────────────────────────────
const ACTIVE_PROPOSALS: ActiveProposal[] = [
  {
    id: "1",
    proposalId: "HERO-2A7F",
    title: "Increase LP Rewards by 15%",
    category: "protocol",
    author: "VetsInCrypto.eth",
    endsAt: "2025-05-10T23:59:59Z",
    votesFor: 2450000,
    votesAgainst: 380000,
    votesAbstain: 120000,
    quorum: 5000000,
    currentQuorum: 2950000,
    description: "Boost LP farming rewards for HERO/WPLS and HERO/DAI pools by 15% to attract more liquidity.",
    link: "/dao/proposals/HERO-2A7F",
  },
  {
    id: "2",
    proposalId: "HERO-2B1D",
    title: "Fund Veteran Coding Bootcamp",
    category: "treasury",
    author: "MarineDAO.eth",
    endsAt: "2025-05-12T23:59:59Z",
    votesFor: 1800000,
    votesAgainst: 200000,
    votesAbstain: 50000,
    quorum: 5000000,
    currentQuorum: 2050000,
    description: "Allocate 250,000 HERO to fund a 12-week coding bootcamp for military veterans transitioning to Web3.",
    link: "/dao/proposals/HERO-2B1D",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────
function formatVotes(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(0) + "K";
  return n.toString();
}

function timeRemaining(endsAt: string): string {
  const now = new Date();
  const end = new Date(endsAt);
  const diffMs = end.getTime() - now.getTime();
  if (diffMs <= 0) return "Ended";
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h left`;
  return `${hours}h left`;
}

// ─── Component ────────────────────────────────────────────────────────
export default function QuickVote() {
  const { isConnected } = useAccount();
  const { isPulseChain } = useNetwork();
  const [votingOn, setVotingOn] = useState<string | null>(null);
  const [votedOn, setVotedOn] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const voteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (voteTimerRef.current) clearTimeout(voteTimerRef.current);
    };
  }, []);

  const handleVote = (proposalId: string, choice: "for" | "against" | "abstain") => {
    if (!isConnected) return;
    setIsSubmitting(true);
    voteTimerRef.current = setTimeout(() => {
      setVotedOn(prev => new Set([...prev, proposalId]));
      setVotingOn(null);
      setIsSubmitting(false);
    }, 1500);
  };

  if (ACTIVE_PROPOSALS.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-4 text-center">
          <Vote className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No active proposals</p>
          <a href="/dao/proposals/create">
            <Button size="sm" variant="outline" className="mt-2 text-xs">
              Create Proposal
            </Button>
          </a>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Vote className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-foreground">Active Votes</h3>
          <Badge className="bg-purple-500/10 text-purple-400 border-0 text-[9px]">
            {ACTIVE_PROPOSALS.length} active
          </Badge>
        </div>
        <a href="/dao" className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
          All proposals <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>

      {ACTIVE_PROPOSALS.map((proposal) => {
        const totalVotes = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;
        const forPct = totalVotes > 0 ? (proposal.votesFor / totalVotes * 100) : 0;
        const againstPct = totalVotes > 0 ? (proposal.votesAgainst / totalVotes * 100) : 0;
        const quorumPct = proposal.quorum > 0 ? Math.min((proposal.currentQuorum / proposal.quorum * 100), 100) : 0;
        const hasVoted = votedOn.has(proposal.proposalId);
        const isVoting = votingOn === proposal.proposalId;

        return (
          <Card key={proposal.id} className="border-border/50 hover:border-purple-500/30 transition-all">
            <CardContent className="p-3">
              {/* Header */}
              <div className="flex items-center justify-between mb-1">
                <Badge variant="outline" className="text-[8px] py-0 px-1 text-purple-400 border-purple-400/20">
                  {proposal.proposalId}
                </Badge>
                <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {timeRemaining(proposal.endsAt)}
                </span>
              </div>

              {/* Title */}
              <a href={proposal.link}>
                <h4 className="text-sm font-medium text-foreground hover:text-purple-400 transition-colors">
                  {proposal.title}
                </h4>
              </a>
              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                {proposal.description}
              </p>

              {/* Vote Bar */}
              <div className="mt-2">
                <div className="flex h-2 rounded-full overflow-hidden bg-border/50">
                  <div
                    className="bg-[var(--hero-green)] transition-all"
                    style={{ width: `${forPct}%` }}
                  />
                  <div
                    className="bg-red-500 transition-all"
                    style={{ width: `${againstPct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-[9px]">
                  <span className="text-[var(--hero-green)]">For: {formatVotes(proposal.votesFor)} ({forPct.toFixed(0)}%)</span>
                  <span className="text-red-400">Against: {formatVotes(proposal.votesAgainst)} ({againstPct.toFixed(0)}%)</span>
                </div>
              </div>

              {/* Quorum */}
              <div className="mt-1.5">
                <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-0.5">
                  <span className="flex items-center gap-1">
                    <Users className="w-2.5 h-2.5" /> Quorum
                  </span>
                  <span>{quorumPct.toFixed(0)}% ({formatVotes(proposal.currentQuorum)}/{formatVotes(proposal.quorum)})</span>
                </div>
                <div className="h-1 rounded-full bg-border/50 overflow-hidden">
                  <div
                    className={`h-full transition-all ${quorumPct >= 100 ? "bg-[var(--hero-green)]" : "bg-yellow-500"}`}
                    style={{ width: `${quorumPct}%` }}
                  />
                </div>
              </div>

              {/* Vote Actions */}
              <div className="mt-2 pt-2 border-t border-border/30">
                {hasVoted ? (
                  <div className="flex items-center gap-2 text-[10px] text-[var(--hero-green)]">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Vote submitted! Thank you for participating.</span>
                  </div>
                ) : !isConnected ? (
                  <div className="flex items-center gap-2 text-[10px] text-yellow-500">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Connect wallet to vote (voting power = HERO balance)</span>
                  </div>
                ) : isVoting ? (
                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleVote(proposal.proposalId, "for")}
                      disabled={isSubmitting}
                      className="flex-1 h-7 text-[10px] bg-[var(--hero-green)]/20 text-[var(--hero-green)] hover:bg-[var(--hero-green)]/30 border-0"
                    >
                      {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <><ThumbsUp className="w-3 h-3 mr-1" /> For</>}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleVote(proposal.proposalId, "against")}
                      disabled={isSubmitting}
                      className="flex-1 h-7 text-[10px] bg-red-500/20 text-red-400 hover:bg-red-500/30 border-0"
                    >
                      {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <><ThumbsDown className="w-3 h-3 mr-1" /> Against</>}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleVote(proposal.proposalId, "abstain")}
                      disabled={isSubmitting}
                      variant="ghost"
                      className="h-7 text-[10px] text-muted-foreground"
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setVotingOn(proposal.proposalId)}
                    className="w-full h-7 text-[10px] bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border-0"
                  >
                    <Vote className="w-3 h-3 mr-1" /> Cast Your Vote
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
