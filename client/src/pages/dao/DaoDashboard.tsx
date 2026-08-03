import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { sanitizeProposalContent } from "@/lib/sanitize-output";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Vote, Users, Wallet, ArrowRight, Plus, Clock, LockKeyhole } from "lucide-react";

function StatCard({ title, value, icon: Icon, loading }: { title: string; value: string | number; icon: any; loading: boolean }) {
  return (
    <Card className="bg-card text-card-foreground border-border">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div><p className="text-sm text-muted-foreground">{title}</p>{loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-2xl font-bold">{value}</p>}</div>
          <div className="p-3 rounded-xl bg-primary/10"><Icon className="h-6 w-6 text-primary" /></div>
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3"><Shield className="h-8 w-8 text-primary" />HERO Advisory Governance</h1>
          <p className="text-muted-foreground mt-1">Non-binding community proposals with one authenticated account and bound wallet receiving one vote.</p>
        </div>
        <Link href="/dao/proposals/create"><Button className="gap-2"><Plus className="h-4 w-4" />New Advisory Proposal</Button></Link>
      </div>

      <Card className="bg-card text-card-foreground border-yellow-500/30">
        <CardContent className="p-5 flex items-start gap-3">
          <LockKeyhole className="h-5 w-5 text-yellow-400 mt-0.5" />
          <div>
            <p className="font-semibold">Binding governance is disabled</p>
            <p className="text-sm text-muted-foreground mt-1">No token-weighted voting, delegation transfer, proposal execution, treasury control, or wallet transaction is performed by advisory v1.</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Recorded Proposals" value={stats?.totalProposals ?? 0} icon={Vote} loading={statsLoading} />
        <StatCard title="Active Advisory Windows" value={stats?.activeProposals ?? 0} icon={Clock} loading={statsLoading} />
        <StatCard title="Historical Delegate Records" value={stats?.totalDelegates ?? 0} icon={Users} loading={statsLoading} />
        <StatCard title="Read-only Treasury Snapshot" value={stats ? `$${stats.treasuryValueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "$0"} icon={Wallet} loading={statsLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card text-card-foreground border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Proposal Records</CardTitle>
            <Link href="/dao/proposals"><Button variant="ghost" size="sm" className="gap-1">View All <ArrowRight className="h-4 w-4" /></Button></Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {proposalsLoading ? Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />) : proposals && proposals.length > 0 ? proposals.map((proposal) => (
              <Link key={proposal.id} href={`/dao/proposals/${proposal.proposalId}`}>
                <div className="p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{sanitizeProposalContent(proposal.title)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{proposal.proposalId} · {proposal.category} · {proposal.governanceMode === "legacy" ? "legacy frozen" : "advisory v1"}</p>
                    </div>
                    <Badge variant="outline" className={statusColors[proposal.status] || ""}>{proposal.status}</Badge>
                  </div>
                  {proposal.status === "active" && proposal.advisoryVotingEnabled && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>For: {proposal.votesFor.toLocaleString()}</span><span>Against: {proposal.votesAgainst.toLocaleString()}</span></div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: `${proposal.votesFor + proposal.votesAgainst > 0 ? (proposal.votesFor / (proposal.votesFor + proposal.votesAgainst)) * 100 : 50}%` }} /></div>
                    </div>
                  )}
                </div>
              </Link>
            )) : (
              <div className="text-center py-8 text-muted-foreground"><Vote className="h-10 w-10 mx-auto mb-2 opacity-50" /><p>No proposal records yet</p><Link href="/dao/proposals/create"><Button variant="outline" size="sm" className="mt-2">Create Advisory Proposal</Button></Link></div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card text-card-foreground border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Historical Delegate Records</CardTitle>
            <Link href="/dao/delegates"><Button variant="ghost" size="sm" className="gap-1">View All <ArrowRight className="h-4 w-4" /></Button></Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {delegatesLoading ? Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />) : delegates && delegates.length > 0 ? delegates.map((delegate, index) => (
              <div key={delegate.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground font-bold text-sm">{index + 1}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{delegate.displayName || `${delegate.address.slice(0, 6)}...${delegate.address.slice(-4)}`}</p>
                  <p className="text-xs text-muted-foreground">{delegate.votingPower.toLocaleString()} legacy weight · {delegate.delegatorCount} historical links · {delegate.proposalsVoted} recorded votes</p>
                </div>
              </div>
            )) : <div className="text-center py-8 text-muted-foreground"><Users className="h-10 w-10 mx-auto mb-2 opacity-50" /><p>No historical delegate records</p></div>}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card text-card-foreground border-border">
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div><h3 className="font-semibold mb-2">Advisory voting</h3><p className="text-sm text-muted-foreground">Each authenticated account must complete a server-signed permanent wallet-binding challenge. The bound wallet receives one advisory vote.</p></div>
          <div><h3 className="font-semibold mb-2">Delegation</h3><p className="text-sm text-muted-foreground">Delegation writes are disabled. Existing records are shown only as historical data and transfer no voting weight.</p></div>
          <div><h3 className="font-semibold mb-2">Quorum and execution</h3><p className="text-sm text-muted-foreground">New advisory-v1 proposals use their persisted quorum. Results are non-binding, and queued/executed states are blocked.</p></div>
        </CardContent>
      </Card>
    </div>
  );
}
