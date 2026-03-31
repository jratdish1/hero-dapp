import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, TrendingUp, Shield, ArrowUpRight } from "lucide-react";

export default function Treasury() {
  const { data: snapshots, isLoading } = trpc.dao.treasury.snapshots.useQuery({});
  const { data: stats } = trpc.dao.stats.useQuery();

  const pulseSnapshots = snapshots?.filter(s => s.chain === "pulsechain") || [];
  const baseSnapshots = snapshots?.filter(s => s.chain === "base") || [];

  const totalValue = stats?.treasuryValueUsd ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Wallet className="h-8 w-8 text-primary" />
          DAO Treasury
        </h1>
        <p className="text-muted-foreground mt-1">
          Multi-chain treasury holdings for the HERO Protocol DAO.
        </p>
      </div>

      {/* Total Value */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-8 text-center">
          <p className="text-sm text-muted-foreground mb-2">Total Treasury Value</p>
          <p className="text-4xl font-bold">
            ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-muted-foreground mt-2">Across PulseChain and Base</p>
        </CardContent>
      </Card>

      {/* Chain Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PulseChain */}
        <Card className="bg-card text-card-foreground border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                <Shield className="h-3.5 w-3.5 text-green-400" />
              </div>
              PulseChain Treasury
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full mb-2" />)
            ) : pulseSnapshots.length > 0 ? (
              <div className="space-y-2">
                {pulseSnapshots.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{s.tokenSymbol}</Badge>
                      <span className="text-sm font-mono">{parseFloat(s.balance).toLocaleString()}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">${parseFloat(s.valueUsd || "0").toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate max-w-[120px]">
                        {s.tokenAddress.slice(0, 6)}...{s.tokenAddress.slice(-4)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No PulseChain treasury data yet</p>
                <p className="text-xs mt-1">Treasury snapshots will appear once recorded</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Base */}
        <Card className="bg-card text-card-foreground border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Shield className="h-3.5 w-3.5 text-blue-400" />
              </div>
              Base Treasury
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full mb-2" />)
            ) : baseSnapshots.length > 0 ? (
              <div className="space-y-2">
                {baseSnapshots.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{s.tokenSymbol}</Badge>
                      <span className="text-sm font-mono">{parseFloat(s.balance).toLocaleString()}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">${parseFloat(s.valueUsd || "0").toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate max-w-[120px]">
                        {s.tokenAddress.slice(0, 6)}...{s.tokenAddress.slice(-4)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No Base treasury data yet</p>
                <p className="text-xs mt-1">Treasury snapshots will appear once recorded</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Treasury Info */}
      <Card className="bg-card text-card-foreground border-border">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Revenue Sources
              </h3>
              <p className="text-sm text-muted-foreground">
                Treasury is funded by swap fees (0.3%), NFT minting fees, and protocol revenue from partner farm integrations.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Governance Control
              </h3>
              <p className="text-sm text-muted-foreground">
                All treasury spending requires a passed DAO proposal with quorum. Emergency proposals can fast-track critical allocations.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-primary" />
                VIC Foundation
              </h3>
              <p className="text-sm text-muted-foreground">
                A portion of treasury funds supports the VIC Foundation 501(c)(3) mission — real charity for veterans and first responders.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
