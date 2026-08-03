import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Vote, Shield, LockKeyhole } from "lucide-react";

const DELEGATION_DISABLED_REASON =
  "Delegation is read-only while governance uses one authenticated account and bound wallet per advisory vote.";

export default function Delegates() {
  const { data: delegates, isLoading } = trpc.dao.delegates.list.useQuery({ limit: 100 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          Historical Delegates
        </h1>
        <p className="text-muted-foreground mt-1">
          Delegate and delegation records are retained for historical transparency only.
        </p>
      </div>

      <Card className="bg-card text-card-foreground border-yellow-500/30">
        <CardContent className="p-5 flex items-start gap-3">
          <LockKeyhole className="h-5 w-5 text-yellow-400 mt-0.5" />
          <div>
            <p className="font-semibold">Delegation disabled in advisory v1</p>
            <p className="text-sm text-muted-foreground mt-1">{DELEGATION_DISABLED_REASON}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Register, update, create, and revoke operations fail closed server-side. No voting weight is transferred.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-24 w-full" />)
        ) : delegates && delegates.length > 0 ? (
          delegates.map((delegate, index) => (
            <Card key={delegate.id} className="bg-card text-card-foreground border-border">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted text-muted-foreground font-bold shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">
                        {delegate.displayName || `${delegate.address.slice(0, 6)}...${delegate.address.slice(-4)}`}
                      </h3>
                      <Badge variant="outline" className="text-xs">Historical</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{delegate.address}</p>
                    {delegate.statement && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{delegate.statement}</p>}
                  </div>
                  <div className="grid grid-cols-3 gap-5 shrink-0 text-center">
                    <div><p className="text-lg font-bold">{delegate.votingPower.toLocaleString()}</p><p className="text-xs text-muted-foreground">Legacy weight</p></div>
                    <div><p className="text-lg font-bold">{delegate.delegatorCount}</p><p className="text-xs text-muted-foreground">Historical links</p></div>
                    <div><p className="text-lg font-bold">{delegate.proposalsVoted}</p><p className="text-xs text-muted-foreground">Recorded votes</p></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="bg-card text-card-foreground border-border">
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-1">No historical delegate records</h3>
              <p className="text-muted-foreground">Advisory v1 does not create new delegation state.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="bg-card text-card-foreground border-border">
        <CardHeader><CardTitle className="flex items-center gap-2"><Vote className="h-5 w-5" />Current advisory model</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-muted-foreground">
          <p><Shield className="h-4 w-4 inline mr-2 text-primary" />One authenticated account and its permanently bound wallet receive one advisory vote.</p>
          <p><LockKeyhole className="h-4 w-4 inline mr-2 text-primary" />Token-weighted delegation and binding execution remain disabled until a separately audited release.</p>
        </CardContent>
      </Card>
    </div>
  );
}
