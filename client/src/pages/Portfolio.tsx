import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  History,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
} from "lucide-react";
import { HERO_TOKEN, VETS_TOKEN, FEATURED_TOKENS } from "../../../shared/tokens";

export default function Portfolio() {
  const [connected, setConnected] = useState(false);

  const mockHoldings = [
    { token: HERO_TOKEN, balance: "1,250,000", value: "$52.50", change: "+8.5%", positive: true },
    { token: VETS_TOKEN, balance: "500,000", value: "$9.00", change: "+3.2%", positive: true },
    { token: FEATURED_TOKENS[0], balance: "15,000", value: "$4.50", change: "-2.1%", positive: false },
    { token: FEATURED_TOKENS[3], balance: "100,000", value: "$12.00", change: "+1.8%", positive: true },
  ];

  const mockHistory = [
    { type: "Swap", from: "PLS", to: "HERO", amount: "10,000 PLS", time: "2 hours ago", hash: "0x1234...abcd" },
    { type: "Swap", from: "HERO", to: "VETS", amount: "50,000 HERO", time: "5 hours ago", hash: "0x5678...efgh" },
    { type: "Swap", from: "USDC", to: "PLS", amount: "100 USDC", time: "1 day ago", hash: "0x9abc...ijkl" },
    { type: "DCA Buy", from: "USDC", to: "HERO", amount: "10 USDC", time: "2 days ago", hash: "0xdef0...mnop" },
  ];

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--hero-orange)] to-[var(--hero-green)] flex items-center justify-center">
          <Wallet className="w-10 h-10 text-white" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground max-w-md">
            Connect your wallet to view your portfolio, track P&L, and manage your PulseChain assets.
          </p>
        </div>
        <Button
          onClick={() => setConnected(true)}
          className="bg-gradient-to-r from-[var(--hero-orange)] to-[var(--hero-green)] text-white border-0 px-8 h-12"
        >
          Connect Wallet
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Portfolio</h1>
        <p className="text-sm text-muted-foreground">Track your PulseChain assets</p>
      </div>

      {/* Portfolio summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border hero-glow">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Value</p>
            <p className="text-2xl font-bold text-foreground">$78.00</p>
            <span className="text-xs text-[var(--hero-green)] flex items-center gap-0.5 mt-1">
              <ArrowUpRight className="w-3 h-3" /> +5.2% (24h)
            </span>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Unrealized P&L</p>
            <p className="text-2xl font-bold text-[var(--hero-green)]">+$12.40</p>
            <span className="text-xs text-muted-foreground mt-1">Since first trade</span>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Trades</p>
            <p className="text-2xl font-bold text-foreground">24</p>
            <span className="text-xs text-muted-foreground mt-1">Last 30 days</span>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="holdings" className="w-full">
        <TabsList className="bg-secondary border border-border">
          <TabsTrigger value="holdings" className="data-[state=active]:bg-[var(--hero-orange)]/10 data-[state=active]:text-[var(--hero-orange)]">
            <PieChart className="w-4 h-4 mr-1.5" /> Holdings
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-[var(--hero-orange)]/10 data-[state=active]:text-[var(--hero-orange)]">
            <History className="w-4 h-4 mr-1.5" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="holdings" className="mt-4">
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs text-muted-foreground font-medium py-3 px-4">Token</th>
                    <th className="text-right text-xs text-muted-foreground font-medium py-3 px-4">Balance</th>
                    <th className="text-right text-xs text-muted-foreground font-medium py-3 px-4">Value</th>
                    <th className="text-right text-xs text-muted-foreground font-medium py-3 px-4">24h</th>
                  </tr>
                </thead>
                <tbody>
                  {mockHoldings.map((h) => (
                    <tr key={h.token.symbol} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={h.token.logoURI}
                            alt={h.token.symbol}
                            className="w-8 h-8 rounded-full"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${h.token.symbol}&background=random&size=32`;
                            }}
                          />
                          <div>
                            <p className="font-semibold text-foreground">{h.token.symbol}</p>
                            <p className="text-xs text-muted-foreground">{h.token.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-right py-3 px-4 font-medium text-foreground">{h.balance}</td>
                      <td className="text-right py-3 px-4 font-medium text-foreground">{h.value}</td>
                      <td className="text-right py-3 px-4">
                        <span className={`text-sm font-medium flex items-center justify-end gap-0.5 ${h.positive ? "text-[var(--hero-green)]" : "text-destructive"}`}>
                          {h.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {h.change}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs text-muted-foreground font-medium py-3 px-4">Type</th>
                    <th className="text-left text-xs text-muted-foreground font-medium py-3 px-4">Details</th>
                    <th className="text-right text-xs text-muted-foreground font-medium py-3 px-4">Amount</th>
                    <th className="text-right text-xs text-muted-foreground font-medium py-3 px-4">Time</th>
                    <th className="text-right text-xs text-muted-foreground font-medium py-3 px-4">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {mockHistory.map((h, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="py-3 px-4">
                        <span className="text-xs font-medium px-2 py-1 rounded bg-[var(--hero-orange)]/10 text-[var(--hero-orange)]">
                          {h.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground">
                        {h.from} → {h.to}
                      </td>
                      <td className="text-right py-3 px-4 text-sm font-medium text-foreground">{h.amount}</td>
                      <td className="text-right py-3 px-4 text-xs text-muted-foreground">{h.time}</td>
                      <td className="text-right py-3 px-4">
                        <a
                          href={`https://scan.pulsechain.com/tx/${h.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--hero-orange)] hover:underline text-xs flex items-center justify-end gap-0.5"
                        >
                          {h.hash} <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
