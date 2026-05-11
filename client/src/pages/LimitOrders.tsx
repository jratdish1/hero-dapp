import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, ExternalLink, Info } from "lucide-react";
import { useNetwork } from "../contexts/NetworkContext";

export default function LimitOrders() {
  const { chainId, isPulseChain, isBase } = useNetwork();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(700);
  const [isLoaded, setIsLoaded] = useState(false);

  // HERO token addresses per chain
  const HERO_PLS = "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27";
  const HERO_BASE = "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8";

  // Theme matching hero-dapp dark UI with HERO green accent
  const widgetTheme = {
    accentColor: "4ade80",      // HERO green
    bgColor: "transparent",     // blend with hero-dapp bg
    cardColor: "0a0c14",        // match hero-dapp card bg
    borderColor: "1a2332",      // subtle borders
    textColor: "e6edf3",        // light text
  };

  // Build widget URL based on active chain
  const buildWidgetUrl = () => {
    const baseUrl = "https://app.squirrelswap.pro/#/widget";
    const params = new URLSearchParams();
    
    // Enable swap + limit + DCA modes
    params.set("modes", "swap,limit,dca");
    
    // Theme params
    params.set("accentColor", widgetTheme.accentColor);
    params.set("bgColor", widgetTheme.bgColor);
    params.set("cardColor", widgetTheme.cardColor);
    params.set("borderColor", widgetTheme.borderColor);
    params.set("textColor", widgetTheme.textColor);
    
    // Pre-select HERO as output token (user likely wants to buy HERO)
    if (isPulseChain) {
      params.set("tokenOut", HERO_PLS);
    }
    // Note: SquirrelSwap widget is PulseChain only
    
    return `${baseUrl}?${params.toString()}`;
  };

  // Listen for auto-resize messages from widget
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "squirrelswap:resize") {
        setIframeHeight(e.data.height);
      }
      if (e.data?.type === "squirrelswap:ready") {
        setIsLoaded(true);
      }
      if (e.data?.type === "squirrelswap:swap") {
        // Could log successful swaps or show toast
        console.log("[SquirrelSwap] Swap completed:", e.data);
      }
    };
    
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // If user is on BASE chain, show info that SquirrelSwap is PulseChain only
  if (isBase) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Target className="h-8 w-8 text-[var(--hero-green)]" />
          <div>
            <h1 className="text-2xl font-bold">Limit Orders</h1>
            <p className="text-muted-foreground">On-chain limit orders powered by SquirrelSwap</p>
          </div>
        </div>
        
        <Card className="bg-[rgba(10,12,20,0.95)] border-[var(--hero-green)]/20">
          <CardContent className="p-8 text-center">
            <Info className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">BASE Chain Limit Orders</h2>
            <p className="text-muted-foreground mb-4">
              SquirrelSwap limit orders are currently available on PulseChain only.
              Switch to PulseChain using the network toggle to access limit orders.
            </p>
            <p className="text-sm text-muted-foreground">
              BASE chain limit order integration coming soon via 1inch Fusion or CoW Protocol.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="h-8 w-8 text-[var(--hero-green)]" />
          <div>
            <h1 className="text-2xl font-bold">Limit Orders</h1>
            <p className="text-muted-foreground text-sm">
              On-chain limit orders with keeper execution — powered by SquirrelSwap
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-[var(--hero-green)]/30 text-[var(--hero-green)]">
            PulseChain
          </Badge>
          <a
            href="https://app.squirrelswap.pro/#/?mode=limit"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-[var(--hero-green)] flex items-center gap-1 transition-colors"
          >
            Open Full App <ExternalLink aria-hidden="true" className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-[rgba(10,12,20,0.95)] border border-[var(--hero-green)]/10 rounded-lg p-3 flex items-start gap-2">
        <Info className="h-4 w-4 text-[var(--hero-green)] mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Set your target price and the SquirrelSwap keeper network will execute your order when the market hits your price.
          Supports all PulseChain tokens. Connect your wallet to get started.
        </p>
      </div>

      {/* SquirrelSwap Widget Iframe */}
      <div className="relative rounded-xl overflow-hidden border border-[var(--hero-green)]/10 bg-[rgba(10,12,20,0.95)]">
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-[rgba(10,12,20,0.95)] z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin h-8 w-8 border-2 border-[var(--hero-green)] border-t-transparent rounded-full" />
              <p className="text-sm text-muted-foreground">Loading SquirrelSwap...</p>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={buildWidgetUrl()}
          width="100%"
          height={iframeHeight}
          style={{ border: "none", borderRadius: "12px", minHeight: "650px" }}
          allow="clipboard-write" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setIsLoaded(true)}
          title="SquirrelSwap Limit Orders"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>Aggregating PulseX, 9mm, 9inch, PHUX, 0xTide & more</span>
        <a
          href="https://app.squirrelswap.pro/#/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[var(--hero-green)] transition-colors"
        >
          SquirrelSwap Docs
        </a>
      </div>
    </div>
  );
}
