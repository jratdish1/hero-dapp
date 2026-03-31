import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Vote, Users, Wallet, ArrowRight, Plus, Clock } from "lucide-react";

function StatCard({ title, value, icon: Icon, loading }: { title: string; value: string | number; icon: any; loading: boolean }) {
  return (
    <Card className="bg-card text-card-foreground border-border">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-2xl font-bold">{value}</p>}
          </div>
          <div className="p-3 rounded-xl bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  passed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  executed: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  defeated: "bg-red-500/20 text-red-400 border-red-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export default function DaoDashboard() {
  const { data: stats, isLoading: statsLoading } = trpc.dao.stats.useQuery();
  const { data: proposals, isLoading: proposalsLoading } = trpc.dao.proposals.list.useQuery({ limit: 5 });
  const { data: delegates, isLoading: delegatesLoading } = trpc.dao.delegates.list.useQuery({ limit: 5 });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            HERO DAO Governance
          </h1>
          <p className="text-muted-foreground mt-1">
            Decentralized governance for the HERO Protocol — vote, delegate, and shape the future.
          </p>
        </div>
        <Link href="/dao/proposals/create">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Proposal
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Proposals" value={stats?.totalProposals ?? 0} icon={Vote} loading={statsLoading} />
        <StatCard title="Active Proposals" value={stats?.activeProposals ?? 0} icon={Clock} loading={statsLoading} />
        <StatCard title="Active Delegates" value={stats?.totalDelegates ?? 0} icon={Users} loading={statsLoading} />
        <StatCard
          title="Treasury Value"
          value={stats ? `$${stats.treasuryValueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "$0"}
          icon={Wallet}
          loading={statsLoading}
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Proposals */}
        <Card className="bg-card text-card-foreground border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Proposals</CardTitle>
            <Link href="/dao/proposals">
              <Button variant="ghost" size="sm" className="gap-1">
                View All <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {proposalsLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
            ) : proposals && proposals.length > 0 ? (
              proposals.map((p) => (
                <Link key={p.id} href={`/dao/proposals/${p.proposalId}`}>
                  <div className="p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{p.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {p.proposalId} · {p.category}
                        </p>
                      </div>
                      <Badge variant="outline" className={statusColors[p.status] || ""}>
                        {p.status}
                      </Badge>
                    </div>
                    {p.status === "active" && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>For: {p.votesFor.toLocaleString()}</span>
                          <span>Against: {p.votesAgainst.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{
                              width: `${p.votesFor + p.votesAgainst > 0 ? (p.votesFor / (p.votesFor + p.votesAgainst)) * 100 : 50}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Vote className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No proposals yet</p>
                <Link href="/dao/proposals/create">
                  <Button variant="outline" size="sm" className="mt-2">Create First Proposal</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Delegates */}
        <Card className="bg-card text-card-foreground border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Top Delegates</CardTitle>
            <Link href="/dao/delegates">
              <Button variant="ghost" size="sm" className="gap-1">
                View All <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {delegatesLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
            ) : delegates && delegates.length > 0 ? (
              delegates.map((d, i) => (
                <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{d.displayName || `${d.address.slice(0, 6)}...${d.address.slice(-4)}`}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.votingPower.toLocaleString()} VP · {d.delegatorCount} delegators · {d.proposalsVoted} votes
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No delegates yet</p>
                <Link href="/dao/delegates">
                  <Button variant="outline" size="sm" className="mt-2">Become a Delegate</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Governance Info */}
      <Card className="bg-card text-card-foreground border-border">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-semibold mb-2">How Voting Works</h3>
              <p className="text-sm text-muted-foreground">
                Hold $HERO tokens to gain voting power. 1 HERO = 1 vote. Voting power is calculated from your wallet balance at the time of voting.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Delegation</h3>
              <p className="text-sm text-muted-foreground">
                Delegate your voting power to trusted community members. You retain your tokens — only the voting weight is transferred.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Quorum</h3>
              <p className="text-sm text-muted-foreground">
                Proposals require 5,000,000 HERO in total votes to reach quorum. Both "For" and "Against" votes count toward quorum.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
