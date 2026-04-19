import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Wallet, ExternalLink, TrendingUp, RefreshCw, Shield,
  DollarSign, Coins, Globe, Heart, BarChart3
} from "lucide-react";

interface TreasuryToken {
  symbol: string;
  balance: string;
  valueUsd: number;
  chain: string;
  address: string;
}

const HERO_PLS = "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27";
const HERO_BASE = "0xBe9462Fa2a960d9B14A5a3E2f0Fdb19F93433a43";
const VETS_PLS = "0x4013abBf94A745EfA7cc848989Ee83424A770060";

// Treasury wallet addresses
const TREASURY_WALLETS = {
  pulsechain: "0x...", // Main treasury wallet on PulseChain
  base: "0x...", // Main treasury wallet on BASE
};

export default function Treasury() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [totalValue, setTotalValue] = useState(0);
  const [pulseTokens, setPulseTokens] = useState<TreasuryToken[]>([]);
  const [baseTokens, setBaseTokens] = useState<TreasuryToken[]>([]);
  const [dashboardData, setDashboardData] = useState<any>(null);
  
  const fetchTreasuryData = async () => {
    setIsLoading(true);
    try {
      // Try to fetch from VIC Foundation dashboard
      const resp = await fetch('https://dashboard.vicfoundation.com/api/treasury', {
        mode: 'cors',
        headers: { 'Accept': 'application/json' },
      }).catch(() => null);
      
      if (resp && resp.ok) {
        const data = await resp.json();
        setDashboardData(data);
        if (data.totalValue) setTotalValue(data.totalValue);
        if (data.pulsechain) setPulseTokens(data.pulsechain);
        if (data.base) setBaseTokens(data.base);
      } else {
        // Fallback: fetch token prices from DexScreener and estimate
        const [heroResp, vetsResp] = await Promise.all([
          fetch(`https://api.dexscreener.com/latest/dex/tokens/${HERO_PLS}`).then(r => r.json()).catch(() => null),
          fetch(`https://api.dexscreener.com/latest/dex/tokens/${VETS_PLS}`).then(r => r.json()).catch(() => null),
        ]);
        
        const heroPrice = heroResp?.pairs?.[0]?.priceUsd ? parseFloat(heroResp.pairs[0].priceUsd) : 0;
        const vetsPrice = vetsResp?.pairs?.[0]?.priceUsd ? parseFloat(vetsResp.pairs[0].priceUsd) : 0;
        
        setPulseTokens([
          { symbol: 'HERO', balance: 'Loading...', valueUsd: 0, chain: 'PulseChain', address: HERO_PLS },
          { symbol: 'VETS', balance: 'Loading...', valueUsd: 0, chain: 'PulseChain', address: VETS_PLS },
          { symbol: 'PLS', balance: 'Loading...', valueUsd: 0, chain: 'PulseChain', address: '' },
        ]);
        
        setBaseTokens([
          { symbol: 'HERO', balance: 'Loading...', valueUsd: 0, chain: 'BASE', address: HERO_BASE },
          { symbol: 'ETH', balance: 'Loading...', valueUsd: 0, chain: 'BASE', address: '' },
        ]);
        
        // Set prices from DexScreener
        if (heroPrice > 0) {
          setPulseTokens(prev => prev.map(t => 
            t.symbol === 'HERO' ? { ...t, valueUsd: heroPrice } : t
          ));
        }
      }
      
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Treasury fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchTreasuryData();
    const interval = setInterval(fetchTreasuryData, 60000); // Refresh every 60s
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="w-6 h-6 text-orange-400" />
          <div>
            <h1 className="text-foreground font-bold text-2xl">DAO Treasury</h1>
            <p className="text-muted-foreground text-sm">Real-time treasury holdings across PulseChain & BASE</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-muted-foreground text-xs flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Updated {lastUpdate}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={fetchTreasuryData} disabled={isLoading}>
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      
      {/* Live Dashboard Embed */}
      <Card className="bg-card/60 border-border overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-foreground flex items-center gap-2 text-lg">
            <BarChart3 className="w-5 h-5 text-orange-400" />
            VIC Foundation Dashboard
            <Badge variant="outline" className="border-green-500/40 text-green-400 text-[10px] ml-2">LIVE</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full" style={{ minHeight: '600px' }}>
            <iframe
              src="https://dashboard.vicfoundation.com"
              width="100%"
              height="600"
              style={{ border: 'none' }}
              title="VIC Foundation Treasury Dashboard"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Total Treasury Value */}
      <Card className="bg-gradient-to-r from-orange-500/10 to-green-500/10 border-orange-500/20">
        <CardContent className="p-6 text-center">
          <DollarSign className="w-8 h-8 text-orange-400 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm mb-1">Total Treasury Value</p>
          <p className="text-foreground font-bold text-3xl">
            {totalValue > 0 ? `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'Loading...'}
          </p>
          <div className="flex justify-center gap-3 mt-3">
            <Badge variant="outline" className="border-orange-500/30 text-orange-400">PulseChain</Badge>
            <Badge variant="outline" className="border-blue-500/30 text-blue-400">BASE</Badge>
          </div>
        </CardContent>
      </Card>
      
      {/* Chain Breakdowns */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* PulseChain */}
        <Card className="bg-card/60 border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2 text-lg">
              <Coins className="w-5 h-5 text-orange-400" />
              PulseChain Treasury
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pulseTokens.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">Treasury snapshots will appear once recorded</p>
            ) : (
              <div className="space-y-2">
                {pulseTokens.map((token) => (
                  <div key={token.symbol} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                        <span className="text-orange-400 font-bold text-xs">{token.symbol.slice(0, 2)}</span>
                      </div>
                      <div>
                        <p className="text-foreground font-semibold text-sm">{token.symbol}</p>
                        <p className="text-muted-foreground text-xs">{token.balance}</p>
                      </div>
                    </div>
                    {token.address && (
                      <a href={`https://scan.pulsechain.com/token/${token.address}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-orange-400">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* BASE */}
        <Card className="bg-card/60 border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2 text-lg">
              <Globe className="w-5 h-5 text-blue-400" />
              BASE Treasury
            </CardTitle>
          </CardHeader>
          <CardContent>
            {baseTokens.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">Treasury snapshots will appear once recorded</p>
            ) : (
              <div className="space-y-2">
                {baseTokens.map((token) => (
                  <div key={token.symbol} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <span className="text-blue-400 font-bold text-xs">{token.symbol.slice(0, 2)}</span>
                      </div>
                      <div>
                        <p className="text-foreground font-semibold text-sm">{token.symbol}</p>
                        <p className="text-muted-foreground text-xs">{token.balance}</p>
                      </div>
                    </div>
                    {token.address && (
                      <a href={`https://basescan.org/token/${token.address}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-blue-400">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Info Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-card/60 border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <p className="text-foreground font-semibold text-sm">Revenue Sources</p>
            </div>
            <p className="text-muted-foreground text-xs">NFT sales (85% to treasury), swap fees, staking rewards, and protocol revenue all flow into the DAO treasury.</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-orange-400" />
              <p className="text-foreground font-semibold text-sm">Governance Control</p>
            </div>
            <p className="text-muted-foreground text-xs">Treasury spending is governed by HERO token holders through the DAO voting system. NFT holders get boosted voting power.</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-red-400" />
              <p className="text-foreground font-semibold text-sm">VIC Foundation</p>
            </div>
            <p className="text-muted-foreground text-xs">A portion of treasury funds supports veteran and first responder programs through the VIC Foundation 501(c)(3) nonprofit.</p>
          </CardContent>
        </Card>
      </div>
      
      {/* External Links */}
      <div className="flex flex-wrap gap-3">
        <a href="https://dashboard.vicfoundation.com" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" className="gap-2 border-orange-500/30 text-orange-400 hover:bg-orange-500/10">
            <BarChart3 className="w-4 h-4" /> Full Dashboard <ExternalLink className="w-3 h-3" />
          </Button>
        </a>
        <a href="https://docs.vicfoundation.com" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" className="gap-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10">
            Whitepaper <ExternalLink className="w-3 h-3" />
          </Button>
        </a>
      </div>
    </div>
  );
}
