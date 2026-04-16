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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, Plus, Trash2, ArrowUpRight, ArrowDownRight, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNetwork } from "../contexts/NetworkContext";
import { FEATURED_TOKENS, type TokenInfo } from "@shared/tokens";
import { toast } from "sonner";

interface LimitOrderUI {
  id: number;
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  amountIn: string;
  targetPrice: string;
  orderType: "buy" | "sell";
  status: "pending" | "filled" | "cancelled" | "expired";
  createdAt: string;
}

export default function LimitOrders() {
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
    { id: 1, type: 'buy' as const, tokenIn: BASE_TOKENS.find((t: any) => t.symbol === 'USDC') || BASE_TOKENS[0], tokenOut: BASE_TOKENS.find((t: any) => t.symbol === 'HERO') || BASE_TOKENS[1], amount: '100', targetPrice: '0.000085', status: 'pending' as const, created: '2026-04-15' },
    { id: 2, type: 'sell' as const, tokenIn: BASE_TOKENS.find((t: any) => t.symbol === 'HERO') || BASE_TOKENS[0], tokenOut: BASE_TOKENS.find((t: any) => t.symbol === 'WETH') || BASE_TOKENS[1], amount: '500000', targetPrice: '0.00012', status: 'pending' as const, created: '2026-04-14' },
    { id: 3, type: 'buy' as const, tokenIn: BASE_TOKENS.find((t: any) => t.symbol === 'USDC') || BASE_TOKENS[0], tokenOut: BASE_TOKENS.find((t: any) => t.symbol === 'BRETT') || BASE_TOKENS[1], amount: '50', targetPrice: '0.08', status: 'filled' as const, created: '2026-04-13' },
  ];
  const [showCreate, setShowCreate] = useState(false);
  const [orderType, setOrderType] = useState<"buy" | "sell">("buy");
  const [tokenIn, setTokenIn] = useState<string>(FEATURED_TOKENS[5].address);
  const [tokenOut, setTokenOut] = useState<string>(FEATURED_TOKENS[1].address);
  const [amount, setAmount] = useState("");
  const [targetPrice, setTargetPrice] = useState("");

  const mockOrders: LimitOrderUI[] = [
    {
      id: 1, tokenIn: FEATURED_TOKENS[5], tokenOut: FEATURED_TOKENS[1],
      amountIn: "100 USDC", targetPrice: "$0.000035", orderType: "buy",
      status: "pending", createdAt: "2 hours ago",
    },
    {
      id: 2, tokenIn: FEATURED_TOKENS[1], tokenOut: FEATURED_TOKENS[5],
      amountIn: "500,000 HERO", targetPrice: "$0.000055", orderType: "sell",
      status: "pending", createdAt: "1 day ago",
    },
    {
      id: 3, tokenIn: FEATURED_TOKENS[5], tokenOut: FEATURED_TOKENS[2],
      amountIn: "50 USDC", targetPrice: "$0.000015", orderType: "buy",
      status: "filled", createdAt: "3 days ago",
    },
  ];

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    filled: "bg-[var(--hero-green)]/10 text-[var(--hero-green)] border-[var(--hero-green)]/20",
    cancelled: "bg-destructive/10 text-destructive border-destructive/20",
    expired: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Limit Orders</h1>
          <p className="text-sm text-muted-foreground">Set target prices for automatic execution</p>
        </div>
        <Button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-gradient-to-r from-[var(--hero-orange)] to-[var(--hero-green)] text-foreground border-0"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New Limit Order
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="bg-card border-border hero-glow">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-[var(--hero-orange)]" />
              Create Limit Order
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={orderType} onValueChange={(v) => setOrderType(v as "buy" | "sell")}>
              <TabsList className="bg-secondary border border-border w-full">
                <TabsTrigger value="buy" className="flex-1 data-[state=active]:bg-[var(--hero-green)]/10 data-[state=active]:text-[var(--hero-green)]">
                  <ArrowUpRight className="w-4 h-4 mr-1" /> Buy
                </TabsTrigger>
                <TabsTrigger value="sell" className="flex-1 data-[state=active]:bg-destructive/10 data-[state=active]:text-destructive">
                  <ArrowDownRight className="w-4 h-4 mr-1" /> Sell
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">{orderType === "buy" ? "Spend" : "Sell"} Token</Label>
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
                <Label className="text-foreground">{orderType === "buy" ? "Buy" : "Receive"} Token</Label>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Amount</Label>
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
                <Label className="text-foreground">Target Price (USD)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="$0.000000"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
            </div>

            <Button
              onClick={() => toast.info("Connect wallet to create limit order")}
              className="w-full bg-gradient-to-r from-[var(--hero-orange)] to-[var(--hero-green)] text-foreground border-0 h-11"
            >
              Create {orderType === "buy" ? "Buy" : "Sell"} Limit Order
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Orders list */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Your Orders</h2>
        {(isBase ? baseMockOrders : mockOrders).map((order: any) => (
          <Card key={order.id} className="bg-card border-border hover:border-[var(--hero-orange)]/20 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    order.orderType === "buy" ? "bg-[var(--hero-green)]/10" : "bg-destructive/10"
                  }`}>
                    {order.orderType === "buy" ? (
                      <ArrowUpRight className="w-5 h-5 text-[var(--hero-green)]" />
                    ) : (
                      <ArrowDownRight className="w-5 h-5 text-destructive" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {order.orderType === "buy" ? "Buy" : "Sell"} {order.tokenOut.symbol}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {order.amountIn} @ {order.targetPrice}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{order.createdAt}</span>
                  <Badge variant="outline" className={statusColors[order.status]}>
                    {order.status}
                  </Badge>
                  {order.status === "pending" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Cancel Order</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
