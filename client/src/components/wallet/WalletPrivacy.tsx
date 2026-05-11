import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Shield, Eye, EyeOff, Unlock, Lock } from "lucide-react";
import { PrivacyBalance, WALLET_API, retryWithBackoff, sanitizeTokenSymbol } from "./WalletUtils";
import { toast } from "sonner";

interface WalletPrivacyProps {
  address: string | undefined;
  selectedNetwork: string;
  onBalancesRefresh: () => void;
  onPrivacyBalancesRefresh: () => void;
  privacyBalances: PrivacyBalance[];
  setPrivacyBalances: React.Dispatch<React.SetStateAction<PrivacyBalance[]>>;
}

export function WalletPrivacy({
  address,
  selectedNetwork,
  onBalancesRefresh,
  onPrivacyBalancesRefresh,
  privacyBalances,
  setPrivacyBalances,
}: WalletPrivacyProps) {
  const [shieldAmount, setShieldAmount] = useState("");
  const [shieldToken, setShieldToken] = useState("HERO");
  const [showPrivateBalances, setShowPrivateBalances] = useState(false);
  const privacyAbortController = useRef<AbortController | null>(null);

  const fetchPrivacyBalance = useCallback(async () => {
    if (!address) return;
    if (privacyAbortController.current) privacyAbortController.current.abort();
    const abortController = new AbortController();
    privacyAbortController.current = abortController;
    try {
      await retryWithBackoff(async () => {
        const res = await fetch(`${WALLET_API}/api/wallet/privacy/balance?address=${encodeURIComponent(address)}`, { signal: abortController.signal });
        if (!res.ok) {
          throw new Error("Failed to fetch privacy balances");
        }
        const data = await res.json();
        setPrivacyBalances(data.balances || []);
      });
    } catch (e) {
      if ((e as any).name !== "AbortError") {
        console.error("Privacy balance error:", e);
      }
    }
  }, [address, setPrivacyBalances]);

  useEffect(() => {
    fetchPrivacyBalance();
    return () => {
      privacyAbortController.current?.abort();
    };
  }, [fetchPrivacyBalance]);

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
      await retryWithBackoff(async () => {
        const res = await fetch(`${WALLET_API}/api/wallet/privacy/shield`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            amount: shieldAmount,
            token: sanitizedToken,
            chain: selectedNetwork,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Shield failed");
        }
        toast.success("Tokens shielded successfully (Railgun)");
        setShieldAmount("");
        setShieldToken("HERO");
        fetchPrivacyBalance();
      });
    } catch (e) {
      toast.error((e as Error).message || "Network error");
    }
  };

  const handleUnshield = async (token: string, amount: string) => {
    if (!amount || Number(amount) <= 0) {
      toast.error("Invalid unshield amount");
      return;
    }
    try {
      await retryWithBackoff(async () => {
        const res = await fetch(`${WALLET_API}/api/wallet/privacy/unshield`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, amount, token, chain: selectedNetwork }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Unshield failed");
        }
        toast.success("Tokens unshielded");
        fetchPrivacyBalance();
        onBalancesRefresh();
      });
    } catch (e) {
      toast.error((e as Error).message || "Unshield failed");
    }
  };

  return (
    <>
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
              <label htmlFor="shieldToken" className="text-sm text-gray-400 mb-1 block">
                Token
              </label>
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
              <label htmlFor="shieldAmount" className="text-sm text-gray-400 mb-1 block">
                Amount
              </label>
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
      <Card className="bg-black/95 border-gray-700 mt-4">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <span className="flex items-center gap-2">
              <EyeOff className="w-5 h-5 text-purple-400" aria-hidden="true" />
              Shielded Balances
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPrivateBalances(!showPrivateBalances)}
              aria-label={showPrivateBalances ? "Hide shielded balances" : "Show shielded balances"}
            >
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
                    <Badge variant="outline" className="text-xs">
                      {pb.chain}
                    </Badge>
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
    </>
  );
}
