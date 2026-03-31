import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Vote, Plus, Filter, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  passed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  executed: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  defeated: "bg-red-500/20 text-red-400 border-red-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
  queued: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

const statusIcons: Record<string, any> = {
  active: Clock,
  pending: AlertCircle,
  passed: CheckCircle,
  executed: CheckCircle,
  defeated: XCircle,
  cancelled: XCircle,
  queued: Clock,
};

const filters = ["all", "active", "pending", "passed", "executed", "defeated"] as const;

export default function Proposals() {
  const [filter, setFilter] = useState<string>("all");
  const { data: proposals, isLoading } = trpc.dao.proposals.list.useQuery({
    status: filter === "all" ? undefined : filter,
    limit: 100,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Vote className="h-8 w-8 text-primary" />
            Proposals
          </h1>
          <p className="text-muted-foreground mt-1">
            Browse, vote, and track governance proposals for the HERO Protocol.
          </p>
        </div>
        <Link href="/dao/proposals/create">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Proposal
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {filters.map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
            className="capitalize"
          >
            {f}
          </Button>
        ))}
      </div>

      {/* Proposals List */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
        ) : proposals && proposals.length > 0 ? (
          proposals.map((p) => {
            const StatusIcon = statusIcons[p.status] || AlertCircle;
            const totalVotes = p.votesFor + p.votesAgainst + p.votesAbstain;
            const forPct = totalVotes > 0 ? (p.votesFor / totalVotes) * 100 : 0;
            const againstPct = totalVotes > 0 ? (p.votesAgainst / totalVotes) * 100 : 0;
            const endDate = new Date(p.endTime);
            const isExpired = endDate < new Date();
            const timeLeft = isExpired
              ? "Ended"
              : `${Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))}d left`;

            return (
              <Link key={p.id} href={`/dao/proposals/${p.proposalId}`}>
                <Card className="bg-card text-card-foreground border-border hover:border-primary/50 transition-colors cursor-pointer">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={statusColors[p.status] || ""}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {p.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{p.category}</Badge>
                          <Badge variant="outline" className="text-xs">{p.chain}</Badge>
                        </div>
                        <h3 className="text-lg font-semibold mt-2">{p.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {p.description.slice(0, 200)}{p.description.length > 200 ? "..." : ""}
                        </p>
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span>{p.proposalId}</span>
                          <span>·</span>
                          <span>By {p.proposerAddress.slice(0, 6)}...{p.proposerAddress.slice(-4)}</span>
                          <span>·</span>
                          <span>{timeLeft}</span>
                        </div>
                      </div>
                    </div>

                    {/* Vote Progress */}
                    {totalVotes > 0 && (
                      <div className="mt-4">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-green-400">For: {forPct.toFixed(1)}% ({p.votesFor.toLocaleString()})</span>
                          <span className="text-red-400">Against: {againstPct.toFixed(1)}% ({p.votesAgainst.toLocaleString()})</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden flex">
                          <div className="h-full bg-green-500" style={{ width: `${forPct}%` }} />
                          <div className="h-full bg-red-500" style={{ width: `${againstPct}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {totalVotes.toLocaleString()} total votes · {p.votesAbstain.toLocaleString()} abstained
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })
        ) : (
          <Card className="bg-card text-card-foreground border-border">
            <CardContent className="py-12 text-center">
              <Vote className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-1">No Proposals Found</h3>
              <p className="text-muted-foreground mb-4">
                {filter === "all" ? "Be the first to create a governance proposal." : `No ${filter} proposals at this time.`}
              </p>
              <Link href="/dao/proposals/create">
                <Button>Create Proposal</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
