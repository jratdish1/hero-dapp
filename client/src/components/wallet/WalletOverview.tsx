import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Coins, Fuel } from "lucide-react";
import { TokenBalance, GasPrice } from "./WalletUtils";

interface WalletOverviewProps {
  balances: TokenBalance[];
  loading: boolean;
  onRefresh: () => void;
  gasData: GasPrice[];
}

export function WalletOverview({ balances, loading, onRefresh, gasData }: WalletOverviewProps) {
  const totalValue = balances.reduce((sum, b) => sum + parseFloat(b.valueUsd || "0"), 0);

  return (
    <>
      {/* Gas Bar */}
      {gasData.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2" role="list" aria-label="Gas prices">
          {gasData.map((g) => (
            <Badge key={g.chain} variant="outline" className="border-gray-700 text-gray-300 whitespace-nowrap" role="listitem">
              <Fuel className="w-3 h-3 mr-1" aria-hidden="true" />
              {g.chain}: {g.standard} gwei
            </Badge>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Token Balances</h3>
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading} aria-label="Refresh balances">
          <Fuel className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
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

      <div className="text-right mt-4">
        <p className="text-sm text-gray-400">Total Portfolio</p>
        <p
          className="text-3xl font-bold text-white"
          aria-label={`Total portfolio value $${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
        >
          ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
      </div>
    </>
  );
}
