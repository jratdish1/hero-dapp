import { useState } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAccount } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ThumbsUp, ThumbsDown, Minus, Clock, CheckCircle, XCircle, Users, AlertCircle } from "lucide-react";
import { ConnectWalletPrompt } from "@/components/ConnectWalletPrompt";

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  passed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  executed: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  defeated: "bg-red-500/20 text-red-400 border-red-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
  queued: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

export default function ProposalDetail() {
  const [, params] = useRoute("/dao/proposals/:id");
  const proposalId = params?.id || "";
  const { user } = useAuth();
  const { address, isConnected } = useAccount();
  const [votingChoice, setVotingChoice] = useState<"for" | "against" | "abstain" | null>(null);

  const { data: proposal, isLoading } = trpc.dao.proposals.get.useQuery(
    { proposalId },
    { enabled: !!proposalId }
  );
  const { data: votes } = trpc.dao.votes.list.useQuery(
    { proposalDbId: proposal?.id ?? 0 },
    { enabled: !!proposal?.id }
  );

  const utils = trpc.useUtils();
  const castVote = trpc.dao.votes.cast.useMutation({
    onSuccess: () => {
      utils.dao.proposals.get.invalidate({ proposalId });
      utils.dao.votes.list.invalidate({ proposalDbId: proposal?.id ?? 0 });
      setVotingChoice(null);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
        <h2 className="text-xl font-semibold mb-2">Proposal Not Found</h2>
        <Link href="/dao/proposals">
          <Button variant="outline">Back to Proposals</Button>
        </Link>
      </div>
    );
  }

  const totalVotes = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;
  const forPct = totalVotes > 0 ? (proposal.votesFor / totalVotes) * 100 : 0;
  const againstPct = totalVotes > 0 ? (proposal.votesAgainst / totalVotes) * 100 : 0;
  const abstainPct = totalVotes > 0 ? (proposal.votesAbstain / totalVotes) * 100 : 0;
  const endDate = new Date(proposal.endTime);
  const isActive = proposal.status === "active" && endDate > new Date();
  const quorum = 5_000_000;
  const quorumPct = Math.min((totalVotes / quorum) * 100, 100);

  const handleVote = (choice: "for" | "against" | "abstain") => {
    if (!isConnected || !address || !user) return;
    castVote.mutate({
      proposalDbId: proposal.id,
      proposalId: proposal.proposalId,
      voterAddress: address,
      choice,
      votingPower: 1, // In production, this would be the user's HERO balance
      chain: "pulsechain",
    });
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/dao/proposals">
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Proposals
        </Button>
      </Link>

      {/* Proposal Header */}
      <Card className="bg-card text-card-foreground border-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className={statusColors[proposal.status] || ""}>
              {proposal.status}
            </Badge>
            <Badge variant="outline">{proposal.category}</Badge>
            <Badge variant="outline">{proposal.chain}</Badge>
          </div>
          <h1 className="text-2xl font-bold">{proposal.title}</h1>
          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
            <span>{proposal.proposalId}</span>
            <span>·</span>
            <span>By {proposal.proposerAddress.slice(0, 6)}...{proposal.proposerAddress.slice(-4)}</span>
            <span>·</span>
            <span>
              <Clock className="h-3 w-3 inline mr-1" />
              {isActive ? `Ends ${endDate.toLocaleDateString()}` : `Ended ${endDate.toLocaleDateString()}`}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Description */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card text-card-foreground border-border">
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
                {proposal.description}
              </div>
            </CardContent>
          </Card>

          {/* Votes List */}
          <Card className="bg-card text-card-foreground border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Votes ({votes?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {votes && votes.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {votes.map((v) => (
                    <div key={v.id} className="flex items-center justify-between p-2 rounded-lg border border-border">
                      <div className="flex items-center gap-2">
                        {v.choice === "for" && <ThumbsUp className="h-4 w-4 text-green-400" />}
                        {v.choice === "against" && <ThumbsDown className="h-4 w-4 text-red-400" />}
                        {v.choice === "abstain" && <Minus className="h-4 w-4 text-muted-foreground" />}
                        <span className="text-sm font-mono">
                          {v.voterAddress.slice(0, 6)}...{v.voterAddress.slice(-4)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{v.votingPower.toLocaleString()} VP</span>
                        <Badge variant="outline" className="text-xs capitalize">{v.choice}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">No votes yet. Be the first!</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Vote Results */}
          <Card className="bg-card text-card-foreground border-border">
            <CardHeader>
              <CardTitle>Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3 text-green-400" /> For</span>
                  <span>{forPct.toFixed(1)}% ({proposal.votesFor.toLocaleString()})</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${forPct}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="flex items-center gap-1"><ThumbsDown className="h-3 w-3 text-red-400" /> Against</span>
                  <span>{againstPct.toFixed(1)}% ({proposal.votesAgainst.toLocaleString()})</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${againstPct}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="flex items-center gap-1"><Minus className="h-3 w-3" /> Abstain</span>
                  <span>{abstainPct.toFixed(1)}% ({proposal.votesAbstain.toLocaleString()})</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-muted-foreground/30 rounded-full" style={{ width: `${abstainPct}%` }} />
                </div>
              </div>

              {/* Quorum */}
              <div className="pt-2 border-t border-border">
                <div className="flex justify-between text-sm mb-1">
                  <span>Quorum</span>
                  <span>{quorumPct.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${quorumPct}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {totalVotes.toLocaleString()} / {quorum.toLocaleString()} HERO needed
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Cast Vote */}
          {isActive && (
            <Card className="bg-card text-card-foreground border-border">
              <CardHeader>
                <CardTitle>Cast Your Vote</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!isConnected ? (
                  <ConnectWalletPrompt
                    message="Connect your wallet to cast your vote."
                    subMessage="1 HERO = 1 vote. Voting power is calculated from your wallet balance."
                    icon="shield"
                    variant="card"
                  />
                ) : !user ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Sign in to vote
                  </p>
                ) : (
                  <>
                    <Button
                      variant={votingChoice === "for" ? "default" : "outline"}
                      className="w-full gap-2"
                      onClick={() => setVotingChoice("for")}
                    >
                      <ThumbsUp className="h-4 w-4" /> Vote For
                    </Button>
                    <Button
                      variant={votingChoice === "against" ? "destructive" : "outline"}
                      className="w-full gap-2"
                      onClick={() => setVotingChoice("against")}
                    >
                      <ThumbsDown className="h-4 w-4" /> Vote Against
                    </Button>
                    <Button
                      variant={votingChoice === "abstain" ? "secondary" : "outline"}
                      className="w-full gap-2"
                      onClick={() => setVotingChoice("abstain")}
                    >
                      <Minus className="h-4 w-4" /> Abstain
                    </Button>
                    {votingChoice && (
                      <Button
                        className="w-full mt-2"
                        onClick={() => handleVote(votingChoice)}
                        disabled={castVote.isPending}
                      >
                        {castVote.isPending ? "Submitting..." : `Confirm Vote: ${votingChoice}`}
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
