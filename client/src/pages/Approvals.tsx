import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, Trash2, ExternalLink, RefreshCw, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FEATURED_TOKENS, type TokenInfo } from "@shared/tokens";
import { toast } from "sonner";

interface ApprovalEntry {
  id: number;
  token: TokenInfo;
  spender: string;
  spenderName: string;
  allowance: string;
  isUnlimited: boolean;
  risk: "low" | "medium" | "high";
}

export default function Approvals() {
  const [connected, setConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const mockApprovals: ApprovalEntry[] = [
    {
      id: 1, token: FEATURED_TOKENS[1], spender: "0x98bf...cc02",
      spenderName: "PulseX V1 Router", allowance: "Unlimited",
      isUnlimited: true, risk: "low",
    },
    {
      id: 2, token: FEATURED_TOKENS[5], spender: "0x165C...b9f9",
      spenderName: "PulseX V2 Router", allowance: "1,000 USDC",
      isUnlimited: false, risk: "low",
    },
    {
      id: 3, token: FEATURED_TOKENS[2], spender: "0xdead...beef",
      spenderName: "Unknown Contract", allowance: "Unlimited",
      isUnlimited: true, risk: "high",
    },
    {
      id: 4, token: FEATURED_TOKENS[4], spender: "0x1234...5678",
      spenderName: "9inch Router", allowance: "500,000 HEX",
      isUnlimited: false, risk: "medium",
    },
  ];

  const riskColors: Record<string, string> = {
    low: "bg-[var(--hero-green)]/10 text-[var(--hero-green)] border-[var(--hero-green)]/20",
    medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    high: "bg-destructive/10 text-destructive border-destructive/20",
  };

  const riskLabels: Record<string, string> = {
    low: "Safe",
    medium: "Caution",
    high: "Danger",
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--hero-orange)] to-[var(--hero-green)] flex items-center justify-center">
          <Shield className="w-10 h-10 text-foreground" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Token Approval Manager</h2>
          <p className="text-muted-foreground max-w-md">
            Review and revoke token approvals to protect your assets. Connect your wallet to scan for active approvals.
          </p>
        </div>
        <Button
          onClick={() => setConnected(true)}
          className="bg-gradient-to-r from-[var(--hero-orange)] to-[var(--hero-green)] text-foreground border-0 px-8 h-12"
        >
          Connect Wallet to Scan
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Token Approvals</h1>
          <p className="text-sm text-muted-foreground">Manage your token allowances for safety</p>
        </div>
        <button
          onClick={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1500); }}
          className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Warning banner */}
      <Card className="bg-destructive/5 border-destructive/20">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-foreground mb-1">Security Notice</p>
            <p className="text-muted-foreground">
              Unlimited token approvals can be exploited if a contract is compromised. Review and revoke
              any approvals you no longer need, especially those marked as "Danger."
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{mockApprovals.length}</p>
            <p className="text-xs text-muted-foreground">Active Approvals</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-destructive">
              {mockApprovals.filter((a) => a.isUnlimited).length}
            </p>
            <p className="text-xs text-muted-foreground">Unlimited Approvals</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-destructive">
              {mockApprovals.filter((a) => a.risk === "high").length}
            </p>
            <p className="text-xs text-muted-foreground">High Risk</p>
          </CardContent>
        </Card>
      </div>

      {/* Approvals list */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-muted-foreground font-medium py-3 px-4">Token</th>
                <th className="text-left text-xs text-muted-foreground font-medium py-3 px-4">Spender</th>
                <th className="text-right text-xs text-muted-foreground font-medium py-3 px-4">Allowance</th>
                <th className="text-center text-xs text-muted-foreground font-medium py-3 px-4">Risk</th>
                <th className="text-right text-xs text-muted-foreground font-medium py-3 px-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {mockApprovals.map((approval) => (
                <tr key={approval.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <img
                        src={approval.token.logoURI}
                        alt={approval.token.symbol}
                        className="w-7 h-7 rounded-full"
                        onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${approval.token.symbol}&background=random&size=28`; }}
                      />
                      <span className="font-medium text-foreground">{approval.token.symbol}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">{approval.spenderName}</p>
                      <a
                        href={`https://scan.pulsechain.com/address/${approval.spender}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-[var(--hero-orange)] flex items-center gap-0.5"
                      >
                        {approval.spender} <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </td>
                  <td className="text-right py-3 px-4">
                    <span className={`text-sm font-medium ${approval.isUnlimited ? "text-destructive" : "text-foreground"}`}>
                      {approval.allowance}
                    </span>
                  </td>
                  <td className="text-center py-3 px-4">
                    <Badge variant="outline" className={riskColors[approval.risk]}>
                      {riskLabels[approval.risk]}
                    </Badge>
                  </td>
                  <td className="text-right py-3 px-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toast.info("Connect wallet to revoke approval")}
                      className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Revoke
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
