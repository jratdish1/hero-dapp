import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Wallet, Send, ArrowDownToLine, Shield, ShieldOff, ArrowLeftRight,
  RefreshCw, Eye, EyeOff, Copy, Check, AlertTriangle, Fuel,
  Lock, Unlock, Globe, Coins, Activity, FileWarning
} from "lucide-react";
import { useNetwork } from "../contexts/NetworkContext";
import { useAccount } from "wagmi";
import { createPublicClient, http, erc20Abi, formatUnits } from "viem";
import { toast } from "sonner";
import DiscoverTab from "@/components/DiscoverTab";
import { Compass } from "lucide-react";

// Wallet API base URL (not yet deployed - balance reads use on-chain)
const WALLET_API = "";

interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  valueUsd: string;
  address: string;
  decimals: number;
  chain: string;
}

interface GasPrice {
  chain: string;
  fast: string;
  standard: string;
  slow: string;
  nativePrice: string;
}

interface Approval {
  token: string;
  spender: string;
  spenderName: string;
  allowance: string;
  risk: 'low' | 'medium' | 'high';
}

interface PrivacyBalance {
  symbol: string;
  shieldedAmount: string;
  chain: string;
}

export default function HeroWallet() {
  const { address, isConnected } = useAccount();
  const { selectedNetwork } = useNetwork();
  const [activeTab, setActiveTab] = useState("overview");
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [gasData, setGasData] = useState<GasPrice[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [privacyBalances, setPrivacyBalances] = useState<PrivacyBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPrivateBalances, setShowPrivateBalances] = useState(false);
  const [copied, setCopied] = useState(false);

  // Send form
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendToken, setSendToken] = useState("ETH");
  const [sendChain, setSendChain] = useState("base");

  // Shield form
  const [shieldAmount, setShieldAmount] = useState("");
  const [shieldToken, setShieldToken] = useState("HERO");

  // Bridge form
  const [bridgeFrom, setBridgeFrom] = useState("base");
  const [bridgeTo, setBridgeTo] = useState("pulsechain");
  const [bridgeAmount, setBridgeAmount] = useState("");
  const [bridgeToken, setBridgeToken] = useState("HERO");

  const fetchBalances = useCallback(async () => {
    setLoading(true);
    try {
      const BALANCE_CHAINS = {
        pulsechain: {
          rpc: "https://rpc.pulsechain.com",
          nativeSymbol: "PLS",
          nativeName: "Pulse",
          tokens: [
            { address: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27", symbol: "HERO", name: "HERO Token", decimals: 18 },
            { address: "0x4013abBf94A745EfA7cc848989Ee83424A770060", symbol: "VETS", name: "VETERANS", decimals: 18 },
          ],
        },
        base: {
          rpc: "https://mainnet.base.org",
          nativeSymbol: "ETH",
          nativeName: "Ether",
          tokens: [
            { address: "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8", symbol: "HERO", name: "HERO Token", decimals: 18 },
          ],
        },
      };
      const allBalances: TokenBalance[] = [];
      for (const [chainKey, chain] of Object.entries(BALANCE_CHAINS)) {
        const client = createPublicClient({ transport: http(chain.rpc) });
        // Native balance
        try {
          const nativeBal = await client.getBalance({ address: address as `0x${string}` });
          if (nativeBal > 0n) {
            allBalances.push({
              symbol: chain.nativeSymbol,
              name: chain.nativeName,
              balance: formatUnits(nativeBal, 18),
              valueUsd: "0",
              address: "0x0000000000000000000000000000000000000000",
              decimals: 18,
              chain: chainKey,
            });
          }
        } catch (e) { console.warn(`Native balance error on ${chainKey}:`, e); }
        // ERC20 balances
        try {
          const calls = chain.tokens.map((t: any) => ({
            address: t.address as `0x${string}`,
            abi: erc20Abi,
            functionName: "balanceOf" as const,
            args: [address as `0x${string}`],
          }));
          const results = await client.multicall({ contracts: calls });
          results.forEach((result: any, i: number) => {
            const token = chain.tokens[i];
            if (result.status === "success" && result.result > 0n) {
              allBalances.push({
                symbol: token.symbol,
                name: token.name,
                balance: formatUnits(result.result as bigint, token.decimals),
                valueUsd: "0",
                address: token.address,
                decimals: token.decimals,
                chain: chainKey,
              });
            }
          });
        } catch (e) { console.warn(`Token balance error on ${chainKey}:`, e); }
      }
      setBalances(allBalances);
    } catch (e) {
      console.error("Failed to fetch balances:", e);
    }
    setLoading(false);
  }, [address]);

  const fetchGas = useCallback(async () => {
    try {
      const res = await fetch(`${WALLET_API}/api/wallet/gas`);
      if (res.ok) {
        const data = await res.json();
        setGasData(data.gas || []);
      }
    } catch (e) { console.error("Gas fetch error:", e); }
  }, []);

  const fetchApprovals = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`${WALLET_API}/api/wallet/approvals?address=${address}`);
      if (res.ok) {
        const data = await res.json();
        setApprovals(data.approvals || []);
      }
    } catch (e) { console.error("Approvals fetch error:", e); }
  }, [address]);

  const fetchPrivacyBalance = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`${WALLET_API}/api/wallet/privacy/balance?address=${address}`);
      if (res.ok) {
        const data = await res.json();
        setPrivacyBalances(data.balances || []);
      }
    } catch (e) { console.error("Privacy balance error:", e); }
  }, [address]);

  useEffect(() => {
    if (isConnected && address) {
      fetchBalances();
      fetchGas();
      fetchApprovals();
      fetchPrivacyBalance();
    }
  }, [isConnected, address, fetchBalances, fetchGas, fetchApprovals, fetchPrivacyBalance]);

  const handleSend = async () => {
    if (!sendTo || !sendAmount) {
      toast.error("Please fill in recipient and amount");
      return;
    }
    try {
      const res = await fetch(`${WALLET_API}/api/wallet/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: address,
          to: sendTo,
          amount: sendAmount,
          token: sendToken,
          chain: sendChain
        })
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`TX sent: ${data.txHash?.slice(0, 10)}...`);
        setSendTo(""); setSendAmount("");
        fetchBalances();
      } else {
        const err = await res.json();
        toast.error(err.error || "Send failed");
      }
    } catch (e) {
      toast.error("Network error");
    }
  };

  const handleShield = async () => {
    if (!shieldAmount) {
      toast.error("Enter amount to shield");
      return;
    }
    try {
      const res = await fetch(`${WALLET_API}/api/wallet/privacy/shield`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          amount: shieldAmount,
          token: shieldToken,
          chain: selectedNetwork
        })
      });
      if (res.ok) {
        toast.success("Tokens shielded successfully (Railgun)");
        setShieldAmount("");
        fetchPrivacyBalance();
      } else {
        const err = await res.json();
        toast.error(err.error || "Shield failed");
      }
    } catch (e) {
      toast.error("Network error");
    }
  };

  const handleUnshield = async (token: string, amount: string) => {
    try {
      const res = await fetch(`${WALLET_API}/api/wallet/privacy/unshield`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, amount, token, chain: selectedNetwork })
      });
      if (res.ok) {
        toast.success("Tokens unshielded");
        fetchPrivacyBalance();
        fetchBalances();
      }
    } catch (e) {
      toast.error("Unshield failed");
    }
  };

  const handleBridge = async () => {
    if (!bridgeAmount) {
      toast.error("Enter bridge amount");
      return;
    }
    try {
      const res = await fetch(`${WALLET_API}/api/wallet/bridge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          fromChain: bridgeFrom,
          toChain: bridgeTo,
          amount: bridgeAmount,
          token: bridgeToken
        })
      });
      if (res.ok) {
        toast.success("Bridge initiated!");
        setBridgeAmount("");
      } else {
        const err = await res.json();
        toast.error(err.error || "Bridge failed");
      }
    } catch (e) {
      toast.error("Network error");
    }
  };

  const handleRevoke = async (token: string, spender: string) => {
    try {
      const res = await fetch(`${WALLET_API}/api/wallet/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, token, spender, chain: selectedNetwork })
      });
      if (res.ok) {
        toast.success("Approval revoked");
        fetchApprovals();
      }
    } catch (e) {
      toast.error("Revoke failed");
    }
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const totalValue = balances.reduce((sum, b) => sum + parseFloat(b.valueUsd || "0"), 0);

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-8">
        <Card className="max-w-md mx-auto bg-black/95 border-yellow-500/30">
          <CardContent className="p-8 text-center">
            <Wallet className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
            <h2 className="text-2xl font-bold text-white mb-2">HERO Wallet</h2>
            <p className="text-gray-400 mb-6">Connect your wallet to access full features</p>
            <p className="text-sm text-gray-500">
              Send, receive, bridge, swap, stake, and shield your tokens with Railgun privacy.
            </p>
          </CardContent>
        </Card>
        <div>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Compass className="w-5 h-5 text-yellow-400" />
            Discover DApps
          </h2>
          <DiscoverTab />
        </div>
      </div>
    );
  }
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Wallet className="w-8 h-8 text-yellow-400" />
            HERO Wallet
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-gray-400 font-mono text-sm">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </span>
            <button onClick={copyAddress} className="text-gray-500 hover:text-yellow-400">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400">Total Portfolio</p>
          <p className="text-3xl font-bold text-white">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Gas Bar */}
      {gasData.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {gasData.map(g => (
            <Badge key={g.chain} variant="outline" className="border-gray-700 text-gray-300 whitespace-nowrap">
              <Fuel className="w-3 h-3 mr-1" />
              {g.chain}: {g.standard} gwei
            </Badge>
          ))}
        </div>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-black/95 border border-gray-700 w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="send">Send</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
          <TabsTrigger value="bridge">Bridge</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="discover">🧭 Discover</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">Token Balances</h3>
            <Button variant="ghost" size="sm" onClick={fetchBalances} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          
          {balances.length === 0 ? (
            <Card className="bg-black/95 border-gray-700">
              <CardContent className="p-8 text-center text-gray-400">
                <Coins className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No balances found. Connect wallet and refresh.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2">
              {balances.map((token, i) => (
                <Card key={i} className="bg-black/95 border-gray-700 hover:border-yellow-500/30 transition-colors">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                        <Coins className="w-4 h-4 text-yellow-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">{token.symbol}</p>
                        <p className="text-xs text-gray-500">{token.chain}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-white">{parseFloat(token.balance).toLocaleString()}</p>
                      <p className="text-xs text-gray-400">${parseFloat(token.valueUsd).toFixed(2)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* SEND TAB */}
        <TabsContent value="send" className="space-y-4">
          <Card className="bg-black/95 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-yellow-400" />
                Send Tokens
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Chain</label>
                <Select value={sendChain} onValueChange={setSendChain}>
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="base">BASE</SelectItem>
                    <SelectItem value="pulsechain">PulseChain</SelectItem>
                    <SelectItem value="ethereum">Ethereum</SelectItem>
                    <SelectItem value="arbitrum">Arbitrum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Token</label>
                <Input
                  value={sendToken}
                  onChange={(e) => setSendToken(e.target.value)}
                  placeholder="ETH, HERO, USDC..."
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Recipient Address</label>
                <Input
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value)}
                  placeholder="0x..."
                  className="bg-gray-800 border-gray-600 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Amount</label>
                <Input
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  placeholder="0.0"
                  type="number"
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
              <Button onClick={handleSend} className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold">
                <Send className="w-4 h-4 mr-2" />
                Send Transaction
              </Button>
            </CardContent>
          </Card>

          {/* Receive */}
          <Card className="bg-black/95 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <ArrowDownToLine className="w-5 h-5 text-green-400" />
                Receive
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-400 mb-2">Your Address</p>
                <p className="font-mono text-white text-sm break-all">{address}</p>
                <Button variant="outline" size="sm" onClick={copyAddress} className="mt-3">
                  {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                  {copied ? "Copied!" : "Copy Address"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRIVACY TAB (Railgun) */}
        <TabsContent value="privacy" className="space-y-4">
          <Card className="bg-black/95 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-400" />
                Railgun Privacy Shield
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-400">
                Shield your tokens using Railgun zero-knowledge proofs. Shielded tokens are invisible on-chain.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Token</label>
                  <Input
                    value={shieldToken}
                    onChange={(e) => setShieldToken(e.target.value)}
                    placeholder="HERO"
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Amount</label>
                  <Input
                    value={shieldAmount}
                    onChange={(e) => setShieldAmount(e.target.value)}
                    placeholder="0.0"
                    type="number"
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                </div>
              </div>
              <Button onClick={handleShield} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold">
                <Lock className="w-4 h-4 mr-2" />
                Shield Tokens
              </Button>
            </CardContent>
          </Card>

          {/* Private Balances */}
          <Card className="bg-black/95 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <EyeOff className="w-5 h-5 text-purple-400" />
                  Shielded Balances
                </span>
                <Button variant="ghost" size="sm" onClick={() => setShowPrivateBalances(!showPrivateBalances)}>
                  {showPrivateBalances ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {privacyBalances.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No shielded balances</p>
              ) : (
                <div className="space-y-2">
                  {privacyBalances.map((pb, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-purple-400" />
                        <span className="text-white">{pb.symbol}</span>
                        <Badge variant="outline" className="text-xs">{pb.chain}</Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-white">
                          {showPrivateBalances ? pb.shieldedAmount : "••••••"}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnshield(pb.symbol, pb.shieldedAmount)}
                          className="text-yellow-400 hover:text-yellow-300"
                        >
                          <Unlock className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* BRIDGE TAB */}
        <TabsContent value="bridge" className="space-y-4">
          <Card className="bg-black/95 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-blue-400" />
                Cross-Chain Bridge
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">From</label>
                  <Select value={bridgeFrom} onValueChange={setBridgeFrom}>
                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="base">BASE</SelectItem>
                      <SelectItem value="pulsechain">PulseChain</SelectItem>
                      <SelectItem value="ethereum">Ethereum</SelectItem>
                      <SelectItem value="arbitrum">Arbitrum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">To</label>
                  <Select value={bridgeTo} onValueChange={setBridgeTo}>
                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="base">BASE</SelectItem>
                      <SelectItem value="pulsechain">PulseChain</SelectItem>
                      <SelectItem value="ethereum">Ethereum</SelectItem>
                      <SelectItem value="arbitrum">Arbitrum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Token</label>
                <Input
                  value={bridgeToken}
                  onChange={(e) => setBridgeToken(e.target.value)}
                  placeholder="HERO"
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Amount</label>
                <Input
                  value={bridgeAmount}
                  onChange={(e) => setBridgeAmount(e.target.value)}
                  placeholder="0.0"
                  type="number"
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
              <Button onClick={handleBridge} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold">
                <Globe className="w-4 h-4 mr-2" />
                Bridge Tokens
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* APPROVALS TAB */}
        <TabsContent value="approvals" className="space-y-4">
          <Card className="bg-black/95 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <FileWarning className="w-5 h-5 text-orange-400" />
                Token Approvals Audit
              </CardTitle>
            </CardHeader>
            <CardContent>
              {approvals.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No active approvals found</p>
              ) : (
                <div className="space-y-2">
                  {approvals.map((a, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <div>
                        <p className="text-white font-medium">{a.token}</p>
                        <p className="text-xs text-gray-400">Spender: {a.spenderName || a.spender.slice(0, 10) + "..."}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={a.risk === 'high' ? 'destructive' : a.risk === 'medium' ? 'default' : 'secondary'}>
                          {a.risk}
                        </Badge>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRevoke(a.token, a.spender)}
                        >
                          Revoke
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-4">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                High-risk approvals allow unlimited token spending. Revoke unused approvals to protect your funds.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        {/* DISCOVER TAB */}
        <TabsContent value="discover" className="space-y-4">
          <DiscoverTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
