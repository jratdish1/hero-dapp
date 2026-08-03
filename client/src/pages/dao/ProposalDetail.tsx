import { useState } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAccount, useChainId } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ThumbsUp, ThumbsDown, Minus, Clock, CheckCircle, Users, AlertCircle, Link2 } from "lucide-react";
import { ConnectWalletPrompt } from "@/components/ConnectWalletPrompt";
import { IdentityBadge } from "@/components/WalletIdentity";

interface PendingBinding {
  walletAddress: string;
  challenge: string;
}

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
  const rawProposalId = params?.id || "";
  const proposalId = /^[A-Za-z0-9][A-Za-z0-9-]{2,63}$/.test(rawProposalId) ? rawProposalId : "";
  const { user } = useAuth();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [votingChoice, setVotingChoice] = useState<"for" | "against" | "abstain" | null>(null);
  const [pendingBinding, setPendingBinding] = useState<PendingBinding | null>(null);

  const connectedChain = chainId === 369 ? "pulsechain" : chainId === 8453 ? "base" : null;
  const { data: proposal, isLoading } = trpc.dao.proposals.get.useQuery(
    { proposalId },
    { enabled: !!proposalId },
  );
  const proposalDbId = proposal?.id;
  const { data: myVote } = trpc.dao.votes.myVote.useQuery(
    { proposalDbId: proposalDbId! },
    { enabled: !!proposalDbId && !!user },
  );
  const { data: votes } = trpc.dao.votes.list.useQuery(
    { proposalDbId: proposalDbId! },
    { enabled: !!proposalDbId },
  );

  const utils = trpc.useUtils();
  const bindWallet = trpc.dao.wallet.bindForVoting.useMutation({
    onSuccess: async (data) => {
      if (!data.success && data.requiresConfirmation) {
        if (!data.bindingChallenge) {
          setPendingBinding(null);
          return;
        }
        setPendingBinding({
          walletAddress: data.walletAddress,
          challenge: data.bindingChallenge,
        });
        return;
      }
      setPendingBinding(null);
      await utils.auth.me.invalidate();
    },
  });
  const castVote = trpc.dao.votes.cast.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.dao.proposals.get.invalidate({ proposalId }),
        proposalDbId ? utils.dao.votes.list.invalidate({ proposalDbId }) : Promise.resolve(),
        proposalDbId ? utils.dao.votes.myVote.invalidate({ proposalDbId }) : Promise.resolve(),
      ]);
      setVotingChoice(null);
    },
  });

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /><Skeleton className="h-48 w-full" /></div>;
  }
  if (!proposal) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
        <h2 className="text-xl font-semibold mb-2">Proposal Not Found</h2>
        <Link href="/dao/proposals"><Button variant="outline">Back to Proposals</Button></Link>
      </div>
    );
  }

  const totalVotes = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;
  const forPct = totalVotes > 0 ? (proposal.votesFor / totalVotes) * 100 : 0;
  const againstPct = totalVotes > 0 ? (proposal.votesAgainst / totalVotes) * 100 : 0;
  const abstainPct = totalVotes > 0 ? (proposal.votesAbstain / totalVotes) * 100 : 0;
  const endDate = new Date(proposal.endTime);
  const isActive = proposal.status === "active" && endDate > new Date();
  const quorumPct = proposal.quorum > 0 ? Math.min((totalVotes / proposal.quorum) * 100, 100) : 0;
  const isChainEligible = connectedChain !== null && (proposal.chain === "both" || proposal.chain === connectedChain);
  const hasVoted = !!myVote;
  const isBoundWallet = !!address && user?.walletAddress?.toLowerCase() === address.toLowerCase();
  const bindingForCurrentWallet = !!address
    && pendingBinding?.walletAddress.toLowerCase() === address.toLowerCase()
    ? pendingBinding
    : null;
  const canVotePolicy = proposal.advisoryVotingEnabled === true && proposal.governanceMode === "advisory" && proposal.snapshotVersion === 1;

  const requestWalletBinding = () => {
    if (!address) return;
    bindWallet.mutate({
      walletAddress: address,
      bindingChallenge: bindingForCurrentWallet?.challenge,
    });
  };
  const handleVote = (choice: "for" | "against" | "abstain") => {
    if (!isConnected || !address || !user || !isBoundWallet || hasVoted || !connectedChain || !isChainEligible || !canVotePolicy) return;
    castVote.mutate({
      proposalDbId: proposal.id,
      proposalId: proposal.proposalId,
      voterAddress: address,
      choice,
      votingPower: 1,
      chain: connectedChain,
    });
  };

  return (
    <div className="space-y-6">
      <Link href="/dao/proposals"><Button variant="ghost" className="gap-2"><ArrowLeft className="h-4 w-4" />Back to Proposals</Button></Link>

      <Card className="bg-card text-card-foreground border-border">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge variant="outline" className={statusColors[proposal.status] || ""}>{proposal.status}</Badge>
            <Badge variant="outline">{proposal.category}</Badge>
            <Badge variant="outline">{proposal.chain}</Badge>
            <Badge variant="outline">{proposal.governanceMode === "legacy" ? "Legacy · frozen" : "Advisory v1 · 1 account = 1 vote"}</Badge>
          </div>
          <h1 className="text-2xl font-bold">{proposal.title}</h1>
          <p className="mt-2 text-xs text-muted-foreground">{proposal.bindingDisabledReason}</p>
          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
            <span>{proposal.proposalId}</span><span>·</span>
            <span>By {proposal.proposerAddress.slice(0, 6)}...{proposal.proposerAddress.slice(-4)}</span><span>·</span>
            <span><Clock className="h-3 w-3 inline mr-1" />{isActive ? `Ends ${endDate.toLocaleDateString()}` : `Ended ${endDate.toLocaleDateString()}`}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card text-card-foreground border-border">
            <CardHeader><CardTitle>Description</CardTitle></CardHeader>
            <CardContent><div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap break-words">{String(proposal.description ?? "")}</div></CardContent>
          </Card>
          <Card className="bg-card text-card-foreground border-border">
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Recorded Votes ({votes?.length || 0})</CardTitle></CardHeader>
            <CardContent>
              {votes && votes.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {votes.map((vote) => (
                    <div key={vote.id} className="flex items-center justify-between p-2 rounded-lg border border-border">
                      <div className="flex items-center gap-2">
                        {vote.choice === "for" && <ThumbsUp className="h-4 w-4 text-green-400" />}
                        {vote.choice === "against" && <ThumbsDown className="h-4 w-4 text-red-400" />}
                        {vote.choice === "abstain" && <Minus className="h-4 w-4 text-muted-foreground" />}
                        <IdentityBadge address={vote.voterAddress} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{proposal.governanceMode === "legacy" ? `${vote.votingPower.toLocaleString()} legacy weight` : "1 advisory vote"}</span>
                        <Badge variant="outline" className="text-xs capitalize">{vote.choice}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-center text-muted-foreground py-4">No votes recorded.</p>}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-card text-card-foreground border-border">
            <CardHeader><CardTitle>Results</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[{label:"For", pct:forPct, count:proposal.votesFor, icon:<ThumbsUp className="h-3 w-3 text-green-400" />, cls:"bg-green-500"}, {label:"Against", pct:againstPct, count:proposal.votesAgainst, icon:<ThumbsDown className="h-3 w-3 text-red-400" />, cls:"bg-red-500"}, {label:"Abstain", pct:abstainPct, count:proposal.votesAbstain, icon:<Minus className="h-3 w-3" />, cls:"bg-muted-foreground/30"}].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1"><span className="flex items-center gap-1">{item.icon}{item.label}</span><span>{item.pct.toFixed(1)}% ({item.count.toLocaleString()})</span></div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${item.cls}`} style={{ width: `${item.pct}%` }} /></div>
                </div>
              ))}
              <div className="pt-2 border-t border-border">
                <div className="flex justify-between text-sm mb-1"><span>{proposal.governanceMode === "legacy" ? "Legacy quorum" : "Advisory quorum"}</span><span>{quorumPct.toFixed(1)}%</span></div>
                <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${quorumPct}%` }} /></div>
                <p className="text-xs text-muted-foreground mt-1">{totalVotes.toLocaleString()} / {proposal.quorum.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>

          {isActive && (
            <Card className="bg-card text-card-foreground border-border">
              <CardHeader><CardTitle>Cast Your Advisory Vote</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {!canVotePolicy ? (
                  <p className="text-sm text-muted-foreground text-center py-2">This proposal is frozen and cannot accept advisory-v1 votes.</p>
                ) : !isConnected ? (
                  <ConnectWalletPrompt message="Connect your wallet to cast your vote." subMessage="Advisory mode: one authenticated account and bound wallet, one vote." icon="shield" variant="card" />
                ) : !user ? (
                  <p className="text-sm text-muted-foreground text-center py-2">Sign in to vote.</p>
                ) : !isBoundWallet ? (
                  <div className="space-y-3 text-center">
                    <p className="text-sm text-muted-foreground">Bind the connected wallet to this account before voting. The server issues a signed, account-and-address-specific challenge before permanent binding.</p>
                    {bindWallet.error && <p className="text-sm text-red-400">{bindWallet.error.message}</p>}
                    <Button className="w-full gap-2" onClick={requestWalletBinding} disabled={bindWallet.isPending || !address}>
                      <Link2 className="h-4 w-4" />
                      {bindWallet.isPending ? "Binding..." : bindingForCurrentWallet ? "Confirm Permanent Wallet Binding" : "Start Wallet Binding"}
                    </Button>
                  </div>
                ) : !connectedChain ? (
                  <p className="text-sm text-muted-foreground text-center py-2">Switch to Base or PulseChain.</p>
                ) : !isChainEligible ? (
                  <p className="text-sm text-muted-foreground text-center py-2">Switch to the proposal&apos;s {proposal.chain} chain.</p>
                ) : hasVoted ? (
                  <div className="text-center py-4"><CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-400" /><p className="text-sm font-medium">You already voted</p><p className="text-xs text-muted-foreground mt-1">Your vote: {myVote?.choice}</p></div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">Advisory voting power: 1 vote</p>
                    <Button variant={votingChoice === "for" ? "default" : "outline"} className="w-full gap-2" onClick={() => setVotingChoice("for")}><ThumbsUp className="h-4 w-4" />Vote For</Button>
                    <Button variant={votingChoice === "against" ? "destructive" : "outline"} className="w-full gap-2" onClick={() => setVotingChoice("against")}><ThumbsDown className="h-4 w-4" />Vote Against</Button>
                    <Button variant={votingChoice === "abstain" ? "secondary" : "outline"} className="w-full gap-2" onClick={() => setVotingChoice("abstain")}><Minus className="h-4 w-4" />Abstain</Button>
                    {castVote.error && <p className="text-sm text-red-400">{castVote.error.message}</p>}
                    {votingChoice && <Button className="w-full mt-2" onClick={() => handleVote(votingChoice)} disabled={castVote.isPending}>{castVote.isPending ? "Submitting..." : `Confirm Vote: ${votingChoice}`}</Button>}
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
