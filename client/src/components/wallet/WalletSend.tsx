import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Send, ArrowDownToLine, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { TokenBalance, WALLET_API, sanitizeTokenSymbol, isValidTokenSymbol, isValidAddress, retryWithBackoff } from "./WalletUtils";

interface WalletSendProps {
  address: string | undefined;
  balances: TokenBalance[];
  onBalancesRefresh: () => void;
}

export function WalletSend({ address, balances, onBalancesRefresh }: WalletSendProps) {
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendToken, setSendToken] = useState("ETH");
  const [sendChain, setSendChain] = useState("base");
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSend = async () => {
    if (!sendTo || !isValidAddress(sendTo)) {
      toast.error("Invalid recipient address");
      return;
    }
    const amountNum = Number(sendAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Invalid amount");
      return;
    }
    const sanitizedToken = sanitizeTokenSymbol(sendToken);
    if (!sanitizedToken) {
      toast.error("Invalid token symbol");
      return;
    }
    if (!isValidTokenSymbol(sanitizedToken, balances)) {
      toast.error("Token not supported or unknown");
      return;
    }
    const tokenBalance = balances.find((b) => b.symbol.toUpperCase() === sanitizedToken);
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
      await retryWithBackoff(async () => {
        const res = await fetch(`${WALLET_API}/api/wallet/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from: address,
            to: sendTo,
            amount: sendAmount,
            token: sanitizedToken,
            chain: sendChain,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Send failed");
        }
        const data = await res.json();
        toast.success(`TX sent: ${data.txHash?.slice(0, 10)}...`);
        setSendTo("");
        setSendAmount("");
        setSendToken("ETH");
        onBalancesRefresh();
      });
    } catch (e: unknown) {
      toast.error((e as Error).message || "Network error");
    }
  };

  return (
    <>
      <Card className="bg-black/95 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Send className="w-5 h-5 text-yellow-400" aria-hidden="true" />
            Send Tokens
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="sendChain" className="text-sm text-gray-400 mb-1 block">
              Chain
            </label>
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
            <label htmlFor="sendToken" className="text-sm text-gray-400 mb-1 block">
              Token
            </label>
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
            <label htmlFor="sendTo" className="text-sm text-gray-400 mb-1 block">
              Recipient Address
            </label>
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
            <label htmlFor="sendAmount" className="text-sm text-gray-400 mb-1 block">
              Amount
            </label>
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
      <Card className="bg-black/95 border-gray-700 mt-6">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5 text-green-400" aria-hidden="true" />
            Receive
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-400 mb-2">Your Address</p>
            <p className="font-mono text-white text-sm break-all" aria-label="Your wallet address">
              {address}
            </p>
            <Button variant="outline" size="sm" onClick={copyAddress} className="mt-3" aria-label="Copy wallet address">
              {copied ? <Check className="w-4 h-4 mr-1" aria-hidden="true" /> : <Copy className="w-4 h-4 mr-1" aria-hidden="true" />}
              {copied ? "Copied!" : "Copy Address"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
