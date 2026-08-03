import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Vote, Plus, Filter, Clock, CheckCircle, XCircle, AlertCircle, ExternalLink, ShieldAlert } from "lucide-react";

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  passed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  executed: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  defeated: "bg-red-500/20 text-red-400 border-red-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
  queued: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

const statusIcons: Record<string, typeof Clock> = {
  active: Clock,
  pending: AlertCircle,
  passed: CheckCircle,
  executed: CheckCircle,
  defeated: XCircle,
  cancelled: XCircle,
  queued: Clock,
};

const filters = ["all", "active", "pending", "passed", "executed", "defeated"] as const;
type RecordKind = "advisory" | "legacy" | "snapshot";

export default function Proposals() {
  const [filter, setFilter] = useState<string>("all");

  const { data: localProposals, isLoading: localLoading } = trpc.dao.proposals.list.useQuery({
    status: filter === "all" ? undefined : filter,
    limit: 100,
  });

  const { data: snapshotProposals, isLoading: snapLoading } = trpc.dao.snapshot.proposals.useQuery({
    limit: 20,
  });

  const allProposals = useMemo(() => {
    const local = (localProposals || []).map((proposal) => ({
      ...proposal,
      source: "local" as const,
      recordKind: (
        proposal.governanceMode === "advisory" && proposal.snapshotVersion === 1
          ? "advisory"
          : "legacy"
      ) as RecordKind,
      snapshotUrl: null as string | null,
    }));

    const snapshot = (snapshotProposals || [])
      .filter((proposal) => filter === "all" || proposal.status === filter)
      .map((proposal) => ({
        id: 0,
        proposalId: proposal.proposalId,
        title: proposal.title,
        description: proposal.description,
        status: proposal.status,
        votesFor: proposal.votesFor,
        votesAgainst: proposal.votesAgainst,
        votesAbstain: proposal.votesAbstain,
        category: proposal.category,
        chain: proposal.chain,
        proposerAddress: proposal.proposerAddress,
        endTime: proposal.endTime,
        createdAt: proposal.createdAt,
        source: "snapshot" as const,
        recordKind: "snapshot" as RecordKind,
        snapshotUrl: proposal.snapshotUrl,
        governanceMode: "snapshot" as const,
        snapshotVersion: null,
        bindingDisabledReason: null,
      }));

    return [...local, ...snapshot].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [localProposals, snapshotProposals, filter]);

  const isLoading = localLoading || snapLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Vote className="h-8 w-8 text-primary" />
            Proposals
          </h1>
          <p className="text-muted-foreground mt-1">
            Review advisory-v1 proposals, frozen legacy records, and external Snapshot proposals.
          </p>
        </div>
        <div className="flex gap-2">
          <a href="https://snapshot.org/#/hero-dao.eth" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Snapshot
            </Button>
          </a>
          <Link href="/dao/proposals/create">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Advisory Proposal
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {filters.map((value) => (
          <Button
            key={value}
            variant={filter === value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(value)}
            className="capitalize"
          >
            {value}
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-32 w-full" />)
        ) : allProposals.length > 0 ? (
          allProposals.map((proposal) => {
            const StatusIcon = statusIcons[proposal.status] || AlertCircle;
            const totalTally = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;
            const forPct = totalTally > 0 ? (proposal.votesFor / totalTally) * 100 : 0;
            const againstPct = totalTally > 0 ? (proposal.votesAgainst / totalTally) * 100 : 0;
            const endDate = new Date(proposal.endTime);
            const isExpired = endDate < new Date();
            const timeLabel = proposal.recordKind === "legacy"
              ? "Frozen legacy record"
              : isExpired
                ? "Ended"
                : `${Math.ceil((endDate.getTime() - Date.now()) / 86_400_000)}d left`;
            const tallyLabel = proposal.recordKind === "advisory"
              ? `${totalTally.toLocaleString()} advisory account votes`
              : proposal.recordKind === "legacy"
                ? `${totalTally.toLocaleString()} historical voting-power units`
                : `${totalTally.toLocaleString()} external Snapshot votes`;

            const cardContent = (
              <Card className="bg-card text-card-foreground border-border hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline" className={statusColors[proposal.status] || ""}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {proposal.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{proposal.category}</Badge>
                        <Badge variant="outline" className="text-xs">{proposal.chain}</Badge>
                        {proposal.recordKind === "advisory" && (
                          <Badge variant="outline" className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                            Advisory v1 · one account, one vote
                          </Badge>
                        )}
                        {proposal.recordKind === "legacy" && (
                          <Badge variant="outline" className="text-xs bg-amber-500/20 text-amber-300 border-amber-500/30">
                            <ShieldAlert className="h-3 w-3 mr-1" />
                            Legacy frozen · no new voting or execution
                          </Badge>
                        )}
                        {proposal.recordKind === "snapshot" && (
                          <Badge variant="outline" className="text-xs bg-indigo-500/20 text-indigo-400 border-indigo-500/30">
                            External Snapshot
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold mt-2">{proposal.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {proposal.description.slice(0, 200)}{proposal.description.length > 200 ? "..." : ""}
                      </p>
                      {proposal.recordKind === "legacy" && proposal.bindingDisabledReason && (
                        <p className="text-xs text-amber-300 mt-2">{proposal.bindingDisabledReason}</p>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                        <span>{proposal.proposalId}</span>
                        <span>·</span>
                        <span>By {proposal.proposerAddress.slice(0, 6)}...{proposal.proposerAddress.slice(-4)}</span>
                        <span>·</span>
                        <span>{timeLabel}</span>
                      </div>
                    </div>
                  </div>

                  {totalTally > 0 && (
                    <div className="mt-4">
                      <div className="flex justify-between text-xs mb-1 gap-3">
                        <span className="text-green-400">For: {forPct.toFixed(1)}% ({proposal.votesFor.toLocaleString()})</span>
                        <span className="text-red-400">Against: {againstPct.toFixed(1)}% ({proposal.votesAgainst.toLocaleString()})</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden flex">
                        <div className="h-full bg-green-500" style={{ width: `${forPct}%` }} />
                        <div className="h-full bg-red-500" style={{ width: `${againstPct}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {tallyLabel} · {proposal.votesAbstain.toLocaleString()} abstained
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );

            if (proposal.source === "snapshot" && proposal.snapshotUrl) {
              return (
                <a key={proposal.proposalId} href={proposal.snapshotUrl} target="_blank" rel="noopener noreferrer">
                  {cardContent}
                </a>
              );
            }

            return (
              <Link key={proposal.proposalId} href={`/dao/proposals/${proposal.proposalId}`}>
                {cardContent}
              </Link>
            );
          })
        ) : (
          <Card className="bg-card text-card-foreground border-border">
            <CardContent className="py-12 text-center">
              <Vote className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-1">No Proposals Found</h3>
              <p className="text-muted-foreground mb-4">
                {filter === "all" ? "No advisory or historical proposal records are available." : `No ${filter} proposals at this time.`}
              </p>
              <Link href="/dao/proposals/create">
                <Button>Create Advisory Proposal</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
