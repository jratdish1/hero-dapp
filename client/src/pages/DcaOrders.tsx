import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, Pause, Play, Trash2, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNetwork } from "../contexts/NetworkContext";
import { FEATURED_TOKENS, type TokenInfo } from "../../../shared/tokens";
import { toast } from "sonner";

interface DcaOrderUI {
  id: number;
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  amountPerInterval: string;
  interval: string;
  totalIntervals: number;
  completedIntervals: number;
  status: "active" | "paused" | "completed" | "cancelled";
}

export default function DcaOrders() {
  const { chainId, isPulseChain, isBase } = useNetwork();
  
  // Filter tokens based on active chain
  const BASE_TOKENS = FEATURED_TOKENS.filter((t: any) => 
    ['HERO', 'WETH', 'USDC', 'BRETT', 'ZORA'].includes(t.symbol) || 
    t.symbol.toLowerCase().includes('eth')
  );
  const PLS_TOKENS = FEATURED_TOKENS;
  const activeTokens = isBase ? BASE_TOKENS : PLS_TOKENS;
  
  // Chain-specific mock orders
  const baseMockOrders = [
    { id: 1, tokenIn: BASE_TOKENS.find((t: any) => t.symbol === 'USDC') || BASE_TOKENS[0], tokenOut: BASE_TOKENS.find((t: any) => t.symbol === 'HERO') || BASE_TOKENS[1], amount: '10', frequency: 'Daily' as const, totalOrders: 30, completedOrders: 12, status: 'active' as const, nextExecution: '2026-04-17 09:00' },
    { id: 2, tokenIn: BASE_TOKENS.find((t: any) => t.symbol === 'WETH') || BASE_TOKENS[0], tokenOut: BASE_TOKENS.find((t: any) => t.symbol === 'HERO') || BASE_TOKENS[1], amount: '0.01', frequency: 'Weekly' as const, totalOrders: 12, completedOrders: 4, status: 'active' as const, nextExecution: '2026-04-21 09:00' },
  ];
  const [showCreate, setShowCreate] = useState(false);
  const [tokenIn, setTokenIn] = useState<string>(FEATURED_TOKENS[5].address);
  const [tokenOut, setTokenOut] = useState<string>(FEATURED_TOKENS[1].address);
  const [amount, setAmount] = useState("");
  const [interval, setInterval] = useState("daily");
  const [totalOrders, setTotalOrders] = useState("7");

  const mockOrders: DcaOrderUI[] = [
    {
      id: 1,
      tokenIn: FEATURED_TOKENS[5],
      tokenOut: FEATURED_TOKENS[1],
      amountPerInterval: "10 USDC",
      interval: "Daily",
      totalIntervals: 30,
      completedIntervals: 12,
      status: "active",
    },
    {
      id: 2,
      tokenIn: FEATURED_TOKENS[0],
      tokenOut: FEATURED_TOKENS[2],
      amountPerInterval: "1,000 PLS",
      interval: "Weekly",
      totalIntervals: 12,
      completedIntervals: 4,
      status: "paused",
    },
  ];

  const statusColors: Record<string, string> = {
    active: "bg-[var(--hero-green)]/10 text-[var(--hero-green)] border-[var(--hero-green)]/20",
    paused: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    completed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  };

  const handleCreate = () => {
    toast.info("Connect wallet to create DCA order", {
      description: "Wallet integration coming soon",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">DCA Orders</h1>
          <p className="text-sm text-muted-foreground">Dollar Cost Average into your favorite tokens</p>
        </div>
        <Button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-gradient-to-r from-[var(--hero-orange)] to-[var(--hero-green)] text-foreground border-0"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New DCA
        </Button>
      </div>

      {/* Info banner */}
      <Card className="bg-[var(--hero-orange)]/5 border-[var(--hero-orange)]/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-[var(--hero-orange)] mt-0.5 shrink-0" />
          <div className="text-sm text-foreground">
            <p className="font-medium mb-1">How DCA Works</p>
            <p className="text-muted-foreground">
              Dollar Cost Averaging automatically buys a fixed amount of a token at regular intervals,
              reducing the impact of volatility. Set your budget, pick your interval, and let the system
              handle the rest.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Create form */}
      {showCreate && (
        <Card className="bg-card border-border hero-glow">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-[var(--hero-orange)]" />
              Create DCA Order
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Spend Token</Label>
                <Select value={tokenIn} onValueChange={setTokenIn}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {FEATURED_TOKENS.map((t) => (
                      <SelectItem key={t.address} value={t.address}>
                        <div className="flex items-center gap-2">
                          <img src={t.logoURI} alt={t.symbol} className="w-5 h-5 rounded-full" onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${t.symbol}&background=random&size=20`; }} />
                          {t.symbol}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Buy Token</Label>
                <Select value={tokenOut} onValueChange={setTokenOut}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {FEATURED_TOKENS.map((t) => (
                      <SelectItem key={t.address} value={t.address}>
                        <div className="flex items-center gap-2">
                          <img src={t.logoURI} alt={t.symbol} className="w-5 h-5 rounded-full" onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${t.symbol}&background=random&size=20`; }} />
                          {t.symbol}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Amount Per Order</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => { if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setAmount(e.target.value); }}
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Frequency</Label>
                <Select value={interval} onValueChange={setInterval}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Total Orders</Label>
                <Input
                  type="number"
                  placeholder="7"
                  value={totalOrders}
                  onChange={(e) => setTotalOrders(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
            </div>

            <Button onClick={handleCreate} className="w-full bg-gradient-to-r from-[var(--hero-orange)] to-[var(--hero-green)] text-foreground border-0 h-11">
              Create DCA Order
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Existing orders */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Active Orders</h2>
        {(isBase ? baseMockOrders : plsMockOrders).map((order) => (
          <Card key={order.id} className="bg-card border-border hover:border-[var(--hero-orange)]/20 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    <img src={order.tokenIn.logoURI} alt={order.tokenIn.symbol} className="w-8 h-8 rounded-full border-2 border-card" onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${order.tokenIn.symbol}&background=random&size=32`; }} />
                    <img src={order.tokenOut.logoURI} alt={order.tokenOut.symbol} className="w-8 h-8 rounded-full border-2 border-card" onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${order.tokenOut.symbol}&background=random&size=32`; }} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {order.tokenIn.symbol} → {order.tokenOut.symbol}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {order.amountPerInterval} · {order.interval}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">
                      {order.completedIntervals}/{order.totalIntervals}
                    </p>
                    <div className="w-24 h-1.5 bg-secondary rounded-full mt-1">
                      <div
                        className="h-full bg-gradient-to-r from-[var(--hero-orange)] to-[var(--hero-green)] rounded-full"
                        style={{ width: `${(order.completedIntervals / order.totalIntervals) * 100}%` }}
                      />
                    </div>
                  </div>
                  <Badge variant="outline" className={statusColors[order.status]}>
                    {order.status}
                  </Badge>
                  <div className="flex gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                          {order.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{order.status === "active" ? "Pause" : "Resume"}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Cancel Order</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
