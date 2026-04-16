import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Wallet, ExternalLink, TrendingUp, TrendingDown, Copy, Check,
  Search, Star, Edit2, Save, RefreshCw, Coins, Droplets, Clock,
  ArrowUpRight, ArrowDownRight, Flame
} from "lucide-react";
import { useNetwork } from "../contexts/NetworkContext";
import { useAccount, useBalance } from "wagmi";
import { toast } from "sonner";

interface TokenHolding {
  symbol: string;
  name: string;
  balance: string;
  valueUsd: string;
  change24h: number;
  logoURI: string;
}

interface LPPosition {
  pair: string;
  dex: string;
  lpTokens: string;
  valueUsd: string;
  token0Amount: string;
  token1Amount: string;
}

interface HexStake {
  stakeId: string;
  stakedHex: string;
  shares: string;
  startDay: number;
  endDay: number;
  progress: number;
  valueUsd: string;
}

interface Transaction {
  hash: string;
  type: string;
  from: string;
  to: string;
  value: string;
  timestamp: string;
  status: 'success' | 'failed';
}

const SAVED_WALLETS_KEY = 'hero-portfolio-wallets';

function shortenAddress(addr: string) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';
}

export default function Portfolio() {
  const { chainId, isPulseChain, isBase } = useNetwork();
  const { address: connectedAddress, isConnected } = useAccount();
  const { data: nativeBalance } = useBalance({ address: connectedAddress });
  
  const [searchAddress, setSearchAddress] = useState('');
  const [activeAddress, setActiveAddress] = useState('');
  const [nickname, setNickname] = useState('');
  const [editingNickname, setEditingNickname] = useState(false);
  const [savedWallets, setSavedWallets] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('holdings');
  
  // Token holdings state
  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [lpPositions, setLpPositions] = useState<LPPosition[]>([]);
  const [hexStakes, setHexStakes] = useState<HexStake[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalValue, setTotalValue] = useState('0.00');
  
  // Load saved wallets
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_WALLETS_KEY);
      if (saved) setSavedWallets(JSON.parse(saved));
    } catch {}
  }, []);
  
  // Auto-load connected wallet
  useEffect(() => {
    if (isConnected && connectedAddress && !activeAddress) {
      loadPortfolio(connectedAddress);
    }
  }, [isConnected, connectedAddress]);
  
  const saveNickname = () => {
    if (!activeAddress) return;
    const updated = { ...savedWallets, [activeAddress]: nickname };
    setSavedWallets(updated);
    localStorage.setItem(SAVED_WALLETS_KEY, JSON.stringify(updated));
    setEditingNickname(false);
    toast.success('Nickname saved!');
  };
  
  const copyAddress = () => {
    navigator.clipboard.writeText(activeAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const loadPortfolio = async (addr: string) => {
    if (!addr || addr.length !== 42) {
      toast.error('Please enter a valid Ethereum address');
      return;
    }
    setActiveAddress(addr);
    setNickname(savedWallets[addr] || '');
    setIsLoading(true);
    
    try {
      // Fetch token balances from DexScreener/chain explorer
      const chain = isBase ? 'base' : 'pulsechain';
      const explorerApi = isBase 
        ? `https://api.basescan.org/api?module=account&action=tokentx&address=${addr}&sort=desc&page=1&offset=50`
        : `https://api.scan.pulsechain.com/api/v2/addresses/${addr}/tokens`;
      
      // Try to fetch real data
      try {
        const resp = await fetch(explorerApi);
        if (resp.ok) {
          const data = await resp.json();
          // Process real token data if available
          if (data.items || data.result) {
            const tokens = (data.items || []).slice(0, 20).map((t: any) => ({
              symbol: t.token?.symbol || t.tokenSymbol || '???',
              name: t.token?.name || t.tokenName || 'Unknown',
              balance: t.value ? (parseFloat(t.value) / Math.pow(10, parseInt(t.token?.decimals || t.tokenDecimal || '18'))).toFixed(4) : '0',
              valueUsd: '—',
              change24h: 0,
              logoURI: `https://ui-avatars.com/api/?name=${t.token?.symbol || t.tokenSymbol || '?'}&background=random&size=32`,
            }));
            if (tokens.length > 0) setHoldings(tokens);
          }
        }
      } catch {
        // Fallback to mock data for demo
      }
      
      // If no real data, show demo holdings
      if (holdings.length === 0) {
        const demoHoldings: TokenHolding[] = isBase ? [
          { symbol: 'ETH', name: 'Ethereum', balance: '0.0000', valueUsd: '$0.00', change24h: 1.67, logoURI: 'https://ui-avatars.com/api/?name=ETH&background=627EEA&color=fff&size=32' },
          { symbol: 'HERO', name: 'HERO Token', balance: '0', valueUsd: '$0.00', change24h: 3.5, logoURI: 'https://ui-avatars.com/api/?name=HERO&background=FF6B00&color=fff&size=32' },
          { symbol: 'USDC', name: 'USD Coin', balance: '0', valueUsd: '$0.00', change24h: 0.01, logoURI: 'https://ui-avatars.com/api/?name=USDC&background=2775CA&color=fff&size=32' },
        ] : [
          { symbol: 'PLS', name: 'PulseChain', balance: '0', valueUsd: '$0.00', change24h: 4.85, logoURI: 'https://ui-avatars.com/api/?name=PLS&background=FF6B00&color=fff&size=32' },
          { symbol: 'HERO', name: 'HERO Token', balance: '0', valueUsd: '$0.00', change24h: 3.5, logoURI: 'https://ui-avatars.com/api/?name=HERO&background=FF6B00&color=fff&size=32' },
          { symbol: 'VETS', name: 'VETS Token', balance: '0', valueUsd: '$0.00', change24h: 4.05, logoURI: 'https://ui-avatars.com/api/?name=VETS&background=22C55E&color=fff&size=32' },
          { symbol: 'HEX', name: 'HEX', balance: '0', valueUsd: '$0.00', change24h: -1.2, logoURI: 'https://ui-avatars.com/api/?name=HEX&background=FF6600&color=fff&size=32' },
        ];
        setHoldings(demoHoldings);
      }
      
      // Demo LP positions
      setLpPositions(isBase ? [
        { pair: 'HERO/WETH', dex: 'Aerodrome', lpTokens: '0', valueUsd: '$0.00', token0Amount: '0 HERO', token1Amount: '0 WETH' },
        { pair: 'HERO/USDC', dex: 'Uniswap V3', lpTokens: '0', valueUsd: '$0.00', token0Amount: '0 HERO', token1Amount: '0 USDC' },
      ] : [
        { pair: 'HERO/PLS', dex: 'PulseX', lpTokens: '0', valueUsd: '$0.00', token0Amount: '0 HERO', token1Amount: '0 PLS' },
        { pair: 'HERO/TruFarm', dex: 'TruDefi', lpTokens: '0', valueUsd: '$0.00', token0Amount: '0 HERO', token1Amount: '0 TruFarm' },
        { pair: 'VETS/WPLS', dex: 'PulseX', lpTokens: '0', valueUsd: '$0.00', token0Amount: '0 VETS', token1Amount: '0 WPLS' },
      ]);
      
      // Demo HEX stakes (PulseChain only)
      if (!isBase) {
        setHexStakes([
          { stakeId: '—', stakedHex: '0', shares: '0', startDay: 0, endDay: 0, progress: 0, valueUsd: '$0.00' },
        ]);
      } else {
        setHexStakes([]);
      }
      
      setTotalValue('$0.00');
      
    } catch (err) {
      toast.error('Failed to load portfolio data');
    } finally {
      setIsLoading(false);
    }
  };
  
  const explorerUrl = isBase 
    ? `https://basescan.org/address/${activeAddress}`
    : `https://scan.pulsechain.com/address/${activeAddress}`;
  
  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="w-6 h-6 text-orange-400" />
          <div>
            <h1 className="text-foreground font-bold text-2xl">Portfolio Tracker</h1>
            <p className="text-muted-foreground text-sm">View token holdings, LP positions, HEX stakes & transactions</p>
          </div>
        </div>
        <Badge variant="outline" className={isBase ? "border-blue-500/40 text-blue-400" : "border-orange-500/40 text-orange-400"}>
          {isBase ? 'BASE' : 'PulseChain'}
        </Badge>
      </div>
      
      {/* Address Input */}
      <Card className="bg-card/60 border-border">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Enter wallet address (0x...)"
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                className="pl-10 bg-secondary/50 border-border"
                onKeyDown={(e) => e.key === 'Enter' && loadPortfolio(searchAddress)}
              />
            </div>
            <Button 
              onClick={() => loadPortfolio(searchAddress)}
              className="bg-gradient-to-r from-[var(--hero-orange)] to-[var(--hero-green)] text-foreground border-0"
              disabled={isLoading}
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Load Portfolio'}
            </Button>
          </div>
          
          {/* Saved wallets */}
          {Object.keys(savedWallets).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-muted-foreground text-xs self-center">Saved:</span>
              {Object.entries(savedWallets).map(([addr, name]) => (
                <button
                  key={addr}
                  onClick={() => { setSearchAddress(addr); loadPortfolio(addr); }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/50 border border-border hover:border-orange-500/30 text-xs transition-colors"
                >
                  <Star className="w-3 h-3 text-yellow-400" />
                  <span className="text-foreground font-medium">{name || shortenAddress(addr)}</span>
                </button>
              ))}
            </div>
          )}
          
          {isConnected && connectedAddress && !activeAddress && (
            <button
              onClick={() => { setSearchAddress(connectedAddress); loadPortfolio(connectedAddress); }}
              className="mt-3 flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300"
            >
              <Wallet className="w-4 h-4" /> Load connected wallet ({shortenAddress(connectedAddress)})
            </button>
          )}
        </CardContent>
      </Card>
      
      {/* Active Portfolio */}
      {activeAddress && (
        <>
          {/* Address Header */}
          <Card className="bg-card/60 border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-green-500 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    {editingNickname ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={nickname}
                          onChange={(e) => setNickname(e.target.value)}
                          placeholder="Enter nickname"
                          className="h-7 w-40 text-sm bg-secondary/50"
                          onKeyDown={(e) => e.key === 'Enter' && saveNickname()}
                        />
                        <button onClick={saveNickname}><Save className="w-4 h-4 text-green-400" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-foreground font-semibold">{nickname || shortenAddress(activeAddress)}</p>
                        <button onClick={() => setEditingNickname(true)}><Edit2 className="w-3 h-3 text-muted-foreground hover:text-foreground" /></button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <code className="text-muted-foreground text-xs">{shortenAddress(activeAddress)}</code>
                      <button onClick={copyAddress}>
                        {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-muted-foreground text-xs">Total Value</p>
                    <p className="text-foreground font-bold text-xl">{totalValue}</p>
                  </div>
                  <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-1">
                      Explorer <ExternalLink className="w-3 h-3" />
                    </Button>
                  </a>
                  <Button variant="outline" size="sm" onClick={() => loadPortfolio(activeAddress)} disabled={isLoading}>
                    <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-card border border-border w-full justify-start flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="holdings" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
                <Coins className="w-4 h-4 mr-1" /> Holdings
              </TabsTrigger>
              <TabsTrigger value="lp" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
                <Droplets className="w-4 h-4 mr-1" /> LP Positions
              </TabsTrigger>
              {!isBase && (
                <TabsTrigger value="hex" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
                  <Flame className="w-4 h-4 mr-1" /> HEX Stakes
                </TabsTrigger>
              )}
              <TabsTrigger value="history" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
                <Clock className="w-4 h-4 mr-1" /> Transactions
              </TabsTrigger>
            </TabsList>
            
            {/* Holdings */}
            <TabsContent value="holdings" className="mt-4">
              <Card className="bg-card/40 border-border">
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {holdings.map((token) => (
                      <div key={token.symbol} className="flex items-center gap-3 p-4 hover:bg-secondary/20 transition-colors">
                        <img src={token.logoURI} alt={token.symbol} className="w-8 h-8 rounded-full" />
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground font-semibold text-sm">{token.symbol}</p>
                          <p className="text-muted-foreground text-xs">{token.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-foreground text-sm font-medium">{token.balance}</p>
                          <p className="text-muted-foreground text-xs">{token.valueUsd}</p>
                        </div>
                        <div className={`flex items-center gap-1 text-xs ${token.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {token.change24h >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {Math.abs(token.change24h).toFixed(2)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* LP Positions */}
            <TabsContent value="lp" className="mt-4">
              <Card className="bg-card/40 border-border">
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {lpPositions.map((lp) => (
                      <div key={lp.pair} className="p-4 hover:bg-secondary/20 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Droplets className="w-4 h-4 text-blue-400" />
                            <p className="text-foreground font-semibold text-sm">{lp.pair}</p>
                            <Badge variant="outline" className="text-[9px] border-blue-500/30 text-blue-400">{lp.dex}</Badge>
                          </div>
                          <p className="text-foreground font-medium text-sm">{lp.valueUsd}</p>
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>LP Tokens: {lp.lpTokens}</span>
                          <span>{lp.token0Amount}</span>
                          <span>{lp.token1Amount}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* HEX Stakes */}
            {!isBase && (
              <TabsContent value="hex" className="mt-4">
                <Card className="bg-card/40 border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2 text-lg">
                      <Flame className="w-5 h-5 text-orange-400" /> HEX Stakes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {hexStakes.length === 0 ? (
                      <p className="text-muted-foreground text-sm text-center py-8">No HEX stakes found for this address</p>
                    ) : (
                      <div className="space-y-3">
                        {hexStakes.map((stake) => (
                          <div key={stake.stakeId} className="p-4 rounded-lg bg-secondary/30 border border-border">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-foreground font-semibold text-sm">Stake #{stake.stakeId}</p>
                              <p className="text-foreground font-medium">{stake.valueUsd}</p>
                            </div>
                            <div className="flex gap-4 text-xs text-muted-foreground mb-2">
                              <span>Staked: {stake.stakedHex} HEX</span>
                              <span>Shares: {stake.shares}</span>
                            </div>
                            <div className="w-full bg-secondary rounded-full h-2">
                              <div className="bg-gradient-to-r from-orange-500 to-green-500 h-2 rounded-full" style={{ width: `${stake.progress}%` }} />
                            </div>
                            <p className="text-muted-foreground text-[10px] mt-1">{stake.progress}% complete</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-4 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                      <p className="text-muted-foreground text-xs">Connect your wallet and load your address to view your active HEX stakes, T-shares, and estimated payout values.</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
            
            {/* Transactions */}
            <TabsContent value="history" className="mt-4">
              <Card className="bg-card/40 border-border">
                <CardContent className="p-6 text-center">
                  <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-foreground font-semibold mb-1">Transaction History</p>
                  <p className="text-muted-foreground text-sm mb-4">View your full transaction history on the block explorer</p>
                  <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="gap-2">
                      View on {isBase ? 'BaseScan' : 'PulseScan'} <ExternalLink className="w-4 h-4" />
                    </Button>
                  </a>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
      
      {/* Empty state when no address loaded */}
      {!activeAddress && !isConnected && (
        <Card className="bg-card/40 border-border">
          <CardContent className="p-12 text-center">
            <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-foreground font-semibold text-lg mb-2">Track Any Wallet</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
              Enter any wallet address above to view token holdings, LP positions, HEX stakes, and transaction history. 
              Or connect your wallet to auto-load your portfolio.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Badge variant="outline" className="border-orange-500/30 text-orange-400">Token Holdings</Badge>
              <Badge variant="outline" className="border-blue-500/30 text-blue-400">LP Positions</Badge>
              <Badge variant="outline" className="border-orange-500/30 text-orange-400">HEX Stakes</Badge>
              <Badge variant="outline" className="border-green-500/30 text-green-400">Transactions</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
