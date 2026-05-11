import { isValidAmount, isValidChainId, sanitizeString } from "../lib/validation";
import { useState, useEffect, useCallback, useRef } from "react";
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
import { createPublicClient, http, fallback, erc20Abi, formatUnits, isAddress } from "viem";
import { toast } from "sonner";
import DiscoverTab from "@/components/DiscoverTab";
import { Compass } from "lucide-react";

// ─── Error Boundary ─────────────────────────────────────────────────────────
import { Component, type ReactNode, type ErrorInfo } from "react";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="p-6 text-center text-red-500">
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-gray-400">Please refresh the page or try again later.</p>
          <button onClick={() => this.setState({ hasError: false })} className="mt-4 px-4 py-2 bg-green-600 text-white rounded">
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}


// Wallet API base URL (not yet deployed - balance reads use on-chain)
const WALLET_API = "";

// Cache for RPC clients by chain key
const rpcClientCache: Record<string, ReturnType<typeof createPublicClient>> = {};

// Helper to create or get cached RPC client with fallback transport
function getRpcClient(chainKey: string, rpcs: string[]) {
  if (rpcClientCache[chainKey]) return rpcClientCache[chainKey];
  const client = createPublicClient({
    transport: fallback(rpcs.map((r) => http(r, { timeout: 10000, retryCount: 1 }))),
  });
  rpcClientCache[chainKey] = client;
  return client;
}

// ─── Retry with exponential backoff ─────────────────────────────────────────
async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delays = [1000, 2000, 4000]): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (i < retries - 1) {
        await new Promise((res) => setTimeout(res, delays[i]));
      }
    }
  }
  throw lastError;
}

// ─── Error differentiation helper ───────────────────────────────────────────
function handleRpcError(error: unknown) {
  const err = error as any;
  if (err?.name === "AbortError") return; // Silently ignore aborts
  if (!navigator.onLine) {
    toast.error("Network error — check your connection");
  } else if (err?.code === 4001 || err?.message?.toLowerCase().includes("user rejected")) {
    toast.error("Transaction cancelled by user");
  } else if (err?.message?.toLowerCase().includes("rpc") || err?.message?.toLowerCase().includes("unavailable")) {
    toast.error("RPC unavailable — trying fallback");
  } else {
    toast.error("An unexpected error occurred");
    console.error("[HeroWallet] Unknown error:", error);
  }
}



// Hook to fetch balances with abort support and error handling
function useFetchBalances(address: string | undefined) {
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!address) return;
    if (!navigator.onLine) {
      toast.error("Network error — check your connection");
      return;
    }
    setLoading(true);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const BALANCE_CHAINS = {
      pulsechain: {
        rpcs: ["https://rpc-pulsechain.g4mm4.io", "https://rpc.pulsechain.com", "https://pulsechain-rpc.publicnode.com"],
        nativeSymbol: "PLS",
        nativeName: "Pulse",
        tokens: [
          { address: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27", symbol: "HERO", name: "HERO Token", decimals: 18 },
          { address: "0x4013abBf94A745EfA7cc848989Ee83424A770060", symbol: "VETS", name: "VETERANS", decimals: 18 },
        ],
      },
      base: {
        rpcs: ["https://mainnet.base.org", "https://base-rpc.publicnode.com", "https://1rpc.io/base"],
        nativeSymbol: "ETH",
        nativeName: "Ether",
        tokens: [
          { address: "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8", symbol: "HERO", name: "HERO Token", decimals: 18 },
        ],
      },
    };

    const allBalances: TokenBalance[] = [];

    try {
      for (const [chainKey, chain] of Object.entries(BALANCE_CHAINS)) {
        if (abortController.signal.aborted) break;
        const client = getRpcClient(chainKey, (chain as any).rpcs);

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
        } catch (e) {
          console.warn(`Native balance error on ${chainKey}:`, e);
        }

        // ERC20 balances with multicall and error handling
        try {
          const calls = chain.tokens.map((t: any) => ({
            address: t.address as `0x${string}`,
            abi: erc20Abi,
            functionName: "balanceOf" as const,
            args: [address as `0x${string}`],
          }));
          const results = await client.multicall({ contracts: calls });
          if (!Array.isArray(results)) {
            console.warn(`Multicall returned invalid results on ${chainKey}`);
            continue;
          }
          results.forEach((result: any, i: number) => {
            const token = chain.tokens[i];
            // Check if result is an object with status and result properties
            if (result && typeof result === "object" && "status" in result && "result" in result) {
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
            } else if (typeof result === "bigint" && result > 0n) {
              // Fallback if multicall returns array of bigints directly
              allBalances.push({
                symbol: token.symbol,
                name: token.name,
                balance: formatUnits(result, token.decimals),
                valueUsd: "0",
                address: token.address,
                decimals: token.decimals,
                chain: chainKey,
              });
            }
          });
        } catch (e) {
          console.warn(`Token balance error on ${chainKey}:`, e);
        }
      }
      if (!abortController.signal.aborted) {
        setBalances(allBalances);
      }
    } catch (e) {
      if (!abortController.signal.aborted) {
        console.error("Failed to fetch balances:", e);
      }
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [address]);

  useEffect(() => {
    fetchBalances();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchBalances]);

  return { balances, loading, refetch: fetchBalances };
}

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
  const [gasData, setGasData] = useState<GasPrice[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [privacyBalances, setPrivacyBalances] = useState<PrivacyBalance[]>([]);
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

  // Use reusable balances hook
  const { balances, loading, refetch: fetchBalances } = useFetchBalances(address);

  // AbortControllers for fetches
  const gasAbortController = useRef<AbortController | null>(null);
  const approvalsAbortController = useRef<AbortController | null>(null);
  const privacyAbortController = useRef<AbortController | null>(null);

  const fetchGas = useCallback(async () => {
    if (gasAbortController.current) gasAbortController.current.abort();
    const abortController = new AbortController();
    gasAbortController.current = abortController;
    try {
      const res = await fetch(`${WALLET_API}/api/wallet/gas`, { signal: abortController.signal });
      if (res.ok) {
        const data = await res.json();
        setGasData(data.gas || []);
      }
    } catch (e) {
      if ((e as any).name !== "AbortError") {
        console.error("Gas fetch error:", e);
      }
    }
  }, []);

  const fetchApprovals = useCallback(async () => {
    if (!address) return;
    if (approvalsAbortController.current) approvalsAbortController.current.abort();
    const abortController = new AbortController();
    approvalsAbortController.current = abortController;
    try {
      const res = await fetch(`${WALLET_API}/api/wallet/approvals?address=${encodeURIComponent(address)}`, { signal: abortController.signal });
      if (res.ok) {
        const data = await res.json();
        setApprovals(data.approvals || []);
      }
    } catch (e) {
      if ((e as any).name !== "AbortError") {
        console.error("Approvals fetch error:", e);
      }
    }
  }, [address]);

  const fetchPrivacyBalance = useCallback(async () => {
    if (!address) return;
    if (privacyAbortController.current) privacyAbortController.current.abort();
    const abortController = new AbortController();
    privacyAbortController.current = abortController;
    try {
      const res = await fetch(`${WALLET_API}/api/wallet/privacy/balance?address=${encodeURIComponent(address)}`, { signal: abortController.signal });
      if (res.ok) {
        const data = await res.json();
        setPrivacyBalances(data.balances || []);
      }
    } catch (e) {
      if ((e as any).name !== "AbortError") {
        console.error("Privacy balance error:", e);
      }
    }
  }, [address]);

  useEffect(() => {
    if (isConnected && address) {
      fetchGas();
      fetchApprovals();
      fetchPrivacyBalance();
    }
    return () => {
      gasAbortController.current?.abort();
      approvalsAbortController.current?.abort();
      privacyAbortController.current?.abort();
    };
  }, [isConnected, address, fetchGas, fetchApprovals, fetchPrivacyBalance]);

  // Validate and sanitize token symbol input (allow only alphanumeric uppercase, max length 10)
  const sanitizeTokenSymbol = (input: string) => {
    return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  };

  // Validate token symbol against known tokens in balances or allowlist (simple allowlist here)
  const isValidTokenSymbol = (symbol: string) => {
    if (!symbol) return false;
    const allowlist = balances.map((b) => b.symbol.toUpperCase());
    return allowlist.includes(symbol.toUpperCase());
  };

  const handleSend = async () => {
    // Validate recipient address
    if (!sendTo || !isAddress(sendTo)) {
      toast.error("Invalid recipient address");
      return;
    }
    // Validate amount positive number
    const amountNum = Number(sendAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Invalid amount");
      return;
    }
    // Validate token symbol sanitized and allowed
    const sanitizedToken = sanitizeTokenSymbol(sendToken);
    if (!sanitizedToken) {
      toast.error("Invalid token symbol");
      return;
    }
    if (!isValidTokenSymbol(sanitizedToken)) {
      toast.error("Token not supported or unknown");
      return;
    }
    // Validate amount within balance
    const tokenBalance = balances.find(b => b.symbol.toUpperCase() === sanitizedToken);
    if (!tokenBalance) {
      toast.error("Token balance not found");
      return;
    }
    const balanceNum = Number(tokenBalance.balance);
    if (amountNum > balanceNum) {
      toast.error("Amount exceeds balance");
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
          token: sanitizedToken,
          chain: sendChain
        })
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`TX sent: ${data.txHash?.slice(0, 10)}...`);
        setSendTo("");
        setSendAmount("");
        setSendToken("ETH");
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
    if (!shieldAmount || Number(shieldAmount) <= 0) {
      toast.error("Enter valid amount to shield");
      return;
    }
    const sanitizedToken = sanitizeTokenSymbol(shieldToken);
    if (!sanitizedToken) {
      toast.error("Invalid token symbol");
      return;
    }
    try {
      const res = await fetch(`${WALLET_API}/api/wallet/privacy/shield`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          amount: shieldAmount,
          token: sanitizedToken,
          chain: selectedNetwork
        })
      });
      if (res.ok) {
        toast.success("Tokens shielded successfully (Railgun)");
        setShieldAmount("");
        setShieldToken("HERO");
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
    if (!amount || Number(amount) <= 0) {
      toast.error("Invalid unshield amount");
      return;
    }
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
      } else {
        const err = await res.json();
        toast.error(err.error || "Unshield failed");
      }
    } catch (e) {
      toast.error("Unshield failed");
    }
  };

  const handleBridge = async () => {
    if (!bridgeAmount || Number(bridgeAmount) <= 0) {
      toast.error("Enter valid bridge amount");
      return;
    }
    const sanitizedToken = sanitizeTokenSymbol(bridgeToken);
    if (!sanitizedToken) {
      toast.error("Invalid token symbol");
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
          token: sanitizedToken
        })
      });
      if (res.ok) {
        toast.success("Bridge initiated!");
        setBridgeAmount("");
        setBridgeToken("HERO");
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
      } else {
        const err = await res.json();
        toast.error(err.error || "Revoke failed");
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
            <Wallet className="w-16 h-16 mx-auto mb-4 text-yellow-400" aria-hidden="true" />
            <h2 className="text-2xl font-bold text-white mb-2">HERO Wallet</h2>
            <p className="text-gray-400 mb-6">Connect your wallet to access full features</p>
            <p className="text-sm text-gray-500">
              Send, receive, bridge, swap, stake, and shield your tokens with Railgun privacy.
            </p>
          </CardContent>
        </Card>
        <div>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Compass className="w-5 h-5 text-yellow-400" aria-hidden="true" />
            Discover DApps
          </h2>
          <DiscoverTab />
        </div>
      </div>
    );
  }
  return (
    <ErrorBoundary>
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Wallet className="w-8 h-8 text-yellow-400" aria-hidden="true" />
            HERO Wallet
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-gray-400 font-mono text-sm" aria-label="Wallet address">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </span>
            <button onClick={copyAddress} className="text-gray-500 hover:text-yellow-400" aria-label="Copy wallet address">
              {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400">Total Portfolio</p>
          <p className="text-3xl font-bold text-white" aria-label={`Total portfolio value $${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}>
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Gas Bar */}
      {gasData.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2" role="list" aria-label="Gas prices">
          {gasData.map(g => (
            <Badge key={g.chain} variant="outline" className="border-gray-700 text-gray-300 whitespace-nowrap" role="listitem">
              <Fuel className="w-3 h-3 mr-1" aria-hidden="true" />
              {g.chain}: {g.standard} gwei
            </Badge>
          ))}
        </div>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" role="tablist" aria-label="Wallet main tabs">
        <TabsList className="bg-black/95 border border-gray-700 w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview" role="tab" aria-selected={activeTab === "overview"}>Overview</TabsTrigger>
          <TabsTrigger value="send" role="tab" aria-selected={activeTab === "send"}>Send</TabsTrigger>
          <TabsTrigger value="privacy" role="tab" aria-selected={activeTab === "privacy"}>Privacy</TabsTrigger>
          <TabsTrigger value="bridge" role="tab" aria-selected={activeTab === "bridge"}>Bridge</TabsTrigger>
          <TabsTrigger value="approvals" role="tab" aria-selected={activeTab === "approvals"}>Approvals</TabsTrigger>
          <TabsTrigger value="discover" role="tab" aria-selected={activeTab === "discover"}>🧭 Discover</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-4" role="tabpanel" tabIndex={0}>
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">Token Balances</h3>
            <Button variant="ghost" size="sm" onClick={fetchBalances} disabled={loading} aria-label="Refresh balances">
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </Button>
          </div>

          {balances.length === 0 ? (
            <Card className="bg-black/95 border-gray-700">
              <CardContent className="p-8 text-center text-gray-400">
                <Coins className="w-12 h-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
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
                        <Coins className="w-4 h-4 text-yellow-400" aria-hidden="true" />
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
        <TabsContent value="send" className="space-y-4" role="tabpanel" tabIndex={0}>
          <Card className="bg-black/95 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-yellow-400" aria-hidden="true" />
                Send Tokens
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="sendChain" className="text-sm text-gray-400 mb-1 block">Chain</label>
                <Select value={sendChain} onValueChange={setSendChain} aria-label="Select chain to send tokens">
                  <SelectTrigger id="sendChain" className="bg-gray-800 border-gray-600 text-white">
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
                <label htmlFor="sendToken" className="text-sm text-gray-400 mb-1 block">Token</label>
                <Input
                  id="sendToken"
                  value={sendToken}
                  onChange={(e) => setSendToken(sanitizeTokenSymbol(e.target.value))}
                  placeholder="ETH, HERO, USDC..."
                  className="bg-gray-800 border-gray-600 text-white"
                  aria-label="Token symbol to send"
                />
              </div>
              <div>
                <label htmlFor="sendTo" className="text-sm text-gray-400 mb-1 block">Recipient Address</label>
                <Input
                  id="sendTo"
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value.trim())}
                  placeholder="0x..."
                  className="bg-gray-800 border-gray-600 text-white font-mono"
                  aria-label="Recipient address"
                />
              </div>
              <div>
                <label htmlFor="sendAmount" className="text-sm text-gray-400 mb-1 block">Amount</label>
                <Input
                  id="sendAmount"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  placeholder="0.0"
                  type="number"
                  min="0"
                  step="any"
                  className="bg-gray-800 border-gray-600 text-white"
                  aria-label="Amount to send"
                />
              </div>
              <Button onClick={handleSend} className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold" aria-label="Send transaction">
                <Send className="w-4 h-4 mr-2" aria-hidden="true" />
                Send Transaction
              </Button>
            </CardContent>
          </Card>

          {/* Receive */}
          <Card className="bg-black/95 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <ArrowDownToLine className="w-5 h-5 text-green-400" aria-hidden="true" />
                Receive
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-400 mb-2">Your Address</p>
                <p className="font-mono text-white text-sm break-all" aria-label="Your wallet address">{address}</p>
                <Button variant="outline" size="sm" onClick={copyAddress} className="mt-3" aria-label="Copy wallet address">
                  {copied ? <Check className="w-4 h-4 mr-1" aria-hidden="true" /> : <Copy className="w-4 h-4 mr-1" aria-hidden="true" />}
                  {copied ? "Copied!" : "Copy Address"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRIVACY TAB (Railgun) */}
        <TabsContent value="privacy" className="space-y-4" role="tabpanel" tabIndex={0}>
          <Card className="bg-black/95 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-400" aria-hidden="true" />
                Railgun Privacy Shield
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-400">
                Shield your tokens using Railgun zero-knowledge proofs. Shielded tokens are invisible on-chain.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="shieldToken" className="text-sm text-gray-400 mb-1 block">Token</label>
                  <Input
                    id="shieldToken"
                    value={shieldToken}
                    onChange={(e) => setShieldToken(sanitizeTokenSymbol(e.target.value))}
                    placeholder="HERO"
                    className="bg-gray-800 border-gray-600 text-white"
                    aria-label="Token symbol to shield"
                  />
                </div>
                <div>
                  <label htmlFor="shieldAmount" className="text-sm text-gray-400 mb-1 block">Amount</label>
                  <Input
                    id="shieldAmount"
                    value={shieldAmount}
                    onChange={(e) => setShieldAmount(e.target.value)}
                    placeholder="0.0"
                    type="number"
                    min="0"
                    step="any"
                    className="bg-gray-800 border-gray-600 text-white"
                    aria-label="Amount to shield"
                  />
                </div>
              </div>
              <Button onClick={handleShield} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold" aria-label="Shield tokens">
                <Lock className="w-4 h-4 mr-2" aria-hidden="true" />
                Shield Tokens
              </Button>
            </CardContent>
          </Card>

          {/* Private Balances */}
          <Card className="bg-black/95 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <EyeOff className="w-5 h-5 text-purple-400" aria-hidden="true" />
                  Shielded Balances
                </span>
                <Button variant="ghost" size="sm" onClick={() => setShowPrivateBalances(!showPrivateBalances)} aria-label={showPrivateBalances ? "Hide shielded balances" : "Show shielded balances"}>
                  {showPrivateBalances ? <Eye className="w-4 h-4" aria-hidden="true" /> : <EyeOff className="w-4 h-4" aria-hidden="true" />}
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
                        <Shield className="w-4 h-4 text-purple-400" aria-hidden="true" />
                        <span className="text-white">{pb.symbol}</span>
                        <Badge variant="outline" className="text-xs">{pb.chain}</Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-white" aria-label={`Shielded amount of ${pb.symbol}`}>
                          {showPrivateBalances ? pb.shieldedAmount : "••••••"}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnshield(pb.symbol, pb.shieldedAmount)}
                          className="text-yellow-400 hover:text-yellow-300"
                          aria-label={`Unshield ${pb.symbol} tokens`}
                        >
                          <Unlock className="w-4 h-4" aria-hidden="true" />
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
        <TabsContent value="bridge" className="space-y-4" role="tabpanel" tabIndex={0}>
          <Card className="bg-black/95 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-blue-400" aria-hidden="true" />
                Cross-Chain Bridge
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="bridgeFrom" className="text-sm text-gray-400 mb-1 block">From</label>
                  <Select value={bridgeFrom} onValueChange={setBridgeFrom} aria-label="Select source chain for bridge">
                    <SelectTrigger id="bridgeFrom" className="bg-gray-800 border-gray-600 text-white">
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
                  <label htmlFor="bridgeTo" className="text-sm text-gray-400 mb-1 block">To</label>
                  <Select value={bridgeTo} onValueChange={setBridgeTo} aria-label="Select destination chain for bridge">
                    <SelectTrigger id="bridgeTo" className="bg-gray-800 border-gray-600 text-white">
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
                <label htmlFor="bridgeToken" className="text-sm text-gray-400 mb-1 block">Token</label>
                <Input
                  id="bridgeToken"
                  value={bridgeToken}
                  onChange={(e) => setBridgeToken(sanitizeTokenSymbol(e.target.value))}
                  placeholder="HERO"
                  className="bg-gray-800 border-gray-600 text-white"
                  aria-label="Token symbol to bridge"
                />
              </div>
              <div>
                <label htmlFor="bridgeAmount" className="text-sm text-gray-400 mb-1 block">Amount</label>
                <Input
                  id="bridgeAmount"
                  value={bridgeAmount}
                  onChange={(e) => setBridgeAmount(e.target.value)}
                  placeholder="0.0"
                  type="number"
                  min="0"
                  step="any"
                  className="bg-gray-800 border-gray-600 text-white"
                  aria-label="Amount to bridge"
                />
              </div>
              <Button onClick={handleBridge} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold" aria-label="Bridge tokens">
                <Globe className="w-4 h-4 mr-2" aria-hidden="true" />
                Bridge Tokens
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* APPROVALS TAB */}
        <TabsContent value="approvals" className="space-y-4" role="tabpanel" tabIndex={0}>
          <Card className="bg-black/95 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <FileWarning className="w-5 h-5 text-orange-400" aria-hidden="true" />
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
                          aria-label={`Revoke approval for ${a.token} spender ${a.spenderName || a.spender}`}
                        >
                          Revoke
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-4">
                <AlertTriangle className="w-3 h-3 inline mr-1" aria-hidden="true" />
                High-risk approvals allow unlimited token spending. Revoke unused approvals to protect your funds.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        {/* DISCOVER TAB */}
        <TabsContent value="discover" className="space-y-4" role="tabpanel" tabIndex={0}>
          <DiscoverTab />
        </TabsContent>
      </Tabs>
    </div>
    </ErrorBoundary>
  );
}