import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart3,
  Fuel,
  TrendingUp,
  Activity,
  DollarSign,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from "lucide-react";
import { HERO_TOKEN, VETS_TOKEN, FEATURED_TOKENS } from "../../../shared/tokens";

interface StatCard {
  title: string;
  value: string;
  change?: string;
  changePositive?: boolean;
  icon: React.ReactNode;
}

export default function Dashboard() {
  const [refreshing, setRefreshing] = useState(false);

  const stats: StatCard[] = [
    {
      title: "PLS Gas Price",
      value: "0.0001 PLS",
      change: "-12%",
      changePositive: true,
      icon: <Fuel className="w-5 h-5 text-[var(--hero-orange)]" />,
    },
    {
      title: "PulseChain TVL",
      value: "$142.5M",
      change: "+3.2%",
      changePositive: true,
      icon: <DollarSign className="w-5 h-5 text-[var(--hero-green)]" />,
    },
    {
      title: "24h Volume",
      value: "$8.7M",
      change: "+15.4%",
      changePositive: true,
      icon: <BarChart3 className="w-5 h-5 text-[var(--hero-orange)]" />,
    },
    {
      title: "Avg Tx Cost",
      value: "~$0.001",
      change: "-5%",
      changePositive: true,
      icon: <Zap className="w-5 h-5 text-[var(--hero-green)]" />,
    },
  ];

  const tokenPrices = [
    { token: HERO_TOKEN, price: "$0.000042", change: "+8.5%", positive: true, volume: "$12.4K" },
    { token: VETS_TOKEN, price: "$0.000018", change: "+3.2%", positive: true, volume: "$5.8K" },
    { token: FEATURED_TOKENS[3], price: "$0.00012", change: "-1.4%", positive: false, volume: "$1.2M" },
    { token: FEATURED_TOKENS[4], price: "$0.0089", change: "+0.8%", positive: true, volume: "$890K" },
    { token: FEATURED_TOKENS[5], price: "$1.00", change: "0.0%", positive: true, volume: "$3.4M" },
  ];

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Live PulseChain network stats</p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="bg-card border-border hover:hero-glow transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-secondary">{stat.icon}</div>
                {stat.change && (
                  <span
                    className={`text-xs font-medium flex items-center gap-0.5 ${
                      stat.changePositive ? "text-[var(--hero-green)]" : "text-destructive"
                    }`}
                  >
                    {stat.changePositive ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    {stat.change}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-1">{stat.title}</p>
              <p className="text-xl font-bold text-foreground">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Token prices */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[var(--hero-orange)]" />
            Featured Tokens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs text-muted-foreground font-medium py-3 px-2">Token</th>
                  <th className="text-right text-xs text-muted-foreground font-medium py-3 px-2">Price</th>
                  <th className="text-right text-xs text-muted-foreground font-medium py-3 px-2">24h Change</th>
                  <th className="text-right text-xs text-muted-foreground font-medium py-3 px-2">24h Volume</th>
                </tr>
              </thead>
              <tbody>
                {tokenPrices.map((tp) => (
                  <tr key={tp.token.symbol} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-3">
                        <img
                          src={tp.token.logoURI}
                          alt={tp.token.symbol}
                          className="w-8 h-8 rounded-full"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${tp.token.symbol}&background=random&size=32`;
                          }}
                        />
                        <div>
                          <p className="font-semibold text-foreground">{tp.token.symbol}</p>
                          <p className="text-xs text-muted-foreground">{tp.token.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-right py-3 px-2 font-medium text-foreground">{tp.price}</td>
                    <td className="text-right py-3 px-2">
                      <span
                        className={`text-sm font-medium flex items-center justify-end gap-0.5 ${
                          tp.positive ? "text-[var(--hero-green)]" : "text-destructive"
                        }`}
                      >
                        {tp.positive ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        {tp.change}
                      </span>
                    </td>
                    <td className="text-right py-3 px-2 text-sm text-muted-foreground">{tp.volume}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Network activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-[var(--hero-green)]" />
              Network Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Block Height", value: "21,456,789" },
                { label: "Validators", value: "3,421" },
                { label: "Avg Block Time", value: "10s" },
                { label: "TPS (current)", value: "~45" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-medium text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-5 h-5 text-[var(--hero-orange)]" />
              Gas Tracker
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {[
                { speed: "Slow", gwei: "0.00001", time: "~30s", color: "text-[var(--hero-green)]" },
                { speed: "Standard", gwei: "0.0001", time: "~12s", color: "text-[var(--hero-orange)]" },
                { speed: "Fast", gwei: "0.001", time: "~5s", color: "text-destructive" },
              ].map((gas) => (
                <div key={gas.speed} className="text-center p-3 rounded-lg bg-secondary">
                  <p className={`text-xs font-medium ${gas.color}`}>{gas.speed}</p>
                  <p className="text-lg font-bold text-foreground mt-1">{gas.gwei}</p>
                  <p className="text-xs text-muted-foreground">PLS · {gas.time}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
