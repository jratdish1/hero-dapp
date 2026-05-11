import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Compass, Check, Copy } from "lucide-react";
import { useNetwork } from "../contexts/NetworkContext";
import { useAccount } from "wagmi";
import DiscoverTab from "../components/DiscoverTab";
import { ErrorBoundary } from "../components/wallet/ErrorBoundary";
import { TokenBalance, GasPrice, Approval, PrivacyBalance, WALLET_API, retryWithBackoff } from "../components/wallet/WalletUtils";
import { toast } from "sonner";
import { WalletOverview } from "../components/wallet/WalletOverview";
import { WalletSend } from "../components/wallet/WalletSend";
import { WalletApprovals } from "../components/wallet/WalletApprovals";
import { WalletPrivacy } from "../components/wallet/WalletPrivacy";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function HeroWallet() {
  const { address, isConnected } = useAccount();
  const { selectedNetwork } = useNetwork();
  const [activeTab, setActiveTab] = useState("overview");
  const [gasData, setGasData] = useState<GasPrice[]>([]);
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [privacyBalances, setPrivacyBalances] = useState<PrivacyBalance[]>([]);
  const [copied, setCopied] = useState(false);

  // AbortControllers for fetches
  const gasAbortController = useRef<AbortController | null>(null);

  const fetchGas = useCallback(async () => {
    if (gasAbortController.current) gasAbortController.current.abort();
    const abortController = new AbortController();
    gasAbortController.current = abortController;
    try {
      await retryWithBackoff(async () => {
        const res = await fetch(`${WALLET_API}/api/wallet/gas`, { signal: abortController.signal });
        if (!res.ok) {
          throw new Error("Failed to fetch gas data");
        }
        const data = await res.json();
        setGasData(data.gas || []);
      });
    } catch (e) {
      if ((e as any).name !== "AbortError") {
        console.error("Gas fetch error:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (isConnected && address) {
      fetchGas();
    }
    return () => {
      gasAbortController.current?.abort();
    };
  }, [isConnected, address, fetchGas]);

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
            <p
              className="text-3xl font-bold text-white"
              aria-label={`Total portfolio value $${balances.reduce((sum, b) => sum + parseFloat(b.valueUsd || "0"), 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}`}
            >
              $
              {balances
                .reduce((sum, b) => sum + parseFloat(b.valueUsd || "0"), 0)
                .toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" role="tablist" aria-label="Wallet main tabs">
          <TabsList className="bg-black/95 border border-gray-700 w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview" role="tab" aria-selected={activeTab === "overview"}>
              Overview
            </TabsTrigger>
            <TabsTrigger value="send" role="tab" aria-selected={activeTab === "send"}>
              Send
            </TabsTrigger>
            <TabsTrigger value="privacy" role="tab" aria-selected={activeTab === "privacy"}>
              Privacy
            </TabsTrigger>
            <TabsTrigger value="approvals" role="tab" aria-selected={activeTab === "approvals"}>
              Approvals
            </TabsTrigger>
            <TabsTrigger value="discover" role="tab" aria-selected={activeTab === "discover"}>
              🧭 Discover
            </TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-4" role="tabpanel" tabIndex={0}>
            <WalletOverview balances={balances} loading={false} onRefresh={() => {}} gasData={gasData} />
          </TabsContent>

          {/* SEND TAB */}
          <TabsContent value="send" className="space-y-4" role="tabpanel" tabIndex={0}>
            <WalletSend address={address} balances={balances} onBalancesRefresh={() => {}} />
          </TabsContent>

          {/* PRIVACY TAB */}
          <TabsContent value="privacy" className="space-y-4" role="tabpanel" tabIndex={0}>
            <WalletPrivacy
              address={address}
              selectedNetwork={selectedNetwork}
              onBalancesRefresh={() => {}}
              onPrivacyBalancesRefresh={() => {}}
              privacyBalances={privacyBalances}
              setPrivacyBalances={setPrivacyBalances}
            />
          </TabsContent>

          {/* APPROVALS TAB */}
          <TabsContent value="approvals" className="space-y-4" role="tabpanel" tabIndex={0}>
            <WalletApprovals address={address} selectedNetwork={selectedNetwork} />
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

// ErrorBoundary moved to separate file for clarity
// client/src/components/wallet/ErrorBoundary.tsx
// (See below)
