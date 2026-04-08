import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ExternalLink,
  Loader2,
} from "lucide-react";
import { ConnectWalletPrompt } from "@/components/ConnectWalletPrompt";
import { useNetwork } from "../contexts/NetworkContext";
import { useAccount, useBalance } from "wagmi";
import { useTokenBalance, formatTokenBalance } from "../hooks/useTokenBalance";
import { type TokenInfo } from "../../../shared/tokens";

function TokenRow({ token, chainId }: { token: TokenInfo; chainId: number }) {
  const { balance, isLoading } = useTokenBalance(
    token.address,
    chainId,
    token.isNative
  );

  const formattedBalance = formatTokenBalance(balance, token.decimals);
  const hasBalance = balance !== undefined && balance > BigInt(0);

  return (
    <tr className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <img
            src={token.logoURI}
            alt={token.symbol}
            className="w-8 h-8 rounded-full"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${token.symbol}&background=random&size=32`;
            }}
          />
          <div>
            <p className="font-semibold text-foreground">{token.symbol}</p>
            <p className="text-xs text-muted-foreground">{token.name}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-right">
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-auto" />
        ) : (
          <span className={hasBalance ? "text-foreground font-medium" : "text-muted-foreground"}>
            {formattedBalance}
          </span>
        )}
      </td>
      <td className="py-3 px-4 text-right text-muted-foreground text-sm">
        —
      </td>
      <td className="py-3 px-4 text-right text-muted-foreground text-sm">
        —
      </td>
    </tr>
  );
}

export default function Portfolio() {
  const { tokens, chain, chainId } = useNetwork();
  const { address, isConnected } = useAccount();
  const { data: nativeBalance } = useBalance({
    address,
    chainId: chainId as 369 | 8453,
  });

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-2">Portfolio</h1>
        <p className="text-muted-foreground mb-8">
          Track your token holdings and transaction history on {chain.name}
        </p>
        <ConnectWalletPrompt
          message="Connect your wallet to view your portfolio."
          subMessage="See your token balances, holdings, and transaction history across PulseChain and Base."
          icon="wallet"
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Portfolio</h1>
          <p className="text-sm text-muted-foreground">
            {address?.slice(0, 6)}...{address?.slice(-4)} on {chain.name}
          </p>
        </div>
        <a
          href={`${chain.blockExplorers.default.url}/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-[var(--hero-orange)] hover:underline"
        >
          View on {chain.blockExplorers.default.name}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Native Balance</p>
            <p className="text-lg font-bold text-foreground">
              {nativeBalance
                ? `${formatTokenBalance(nativeBalance.value, nativeBalance.decimals)} ${nativeBalance.symbol}`
                : "Loading..."}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Tokens Tracked</p>
            <p className="text-lg font-bold text-foreground">{tokens.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Network</p>
            <p className="text-lg font-bold text-foreground">{chain.name}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="holdings">
        <TabsList className="bg-secondary mb-4">
          <TabsTrigger value="holdings">Holdings</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="holdings">
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="py-3 px-4 text-left font-medium">Token</th>
                    <th className="py-3 px-4 text-right font-medium">Balance</th>
                    <th className="py-3 px-4 text-right font-medium">Value</th>
                    <th className="py-3 px-4 text-right font-medium">24h</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token) => (
                    <TokenRow
                      key={token.address}
                      token={token}
                      chainId={chainId}
                    />
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Price data and USD values coming soon via DEX price feeds
          </p>
        </TabsContent>

        <TabsContent value="history">
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground mb-2">
                Transaction history will be available once on-chain indexing is connected.
              </p>
              <a
                href={`${chain.blockExplorers.default.url}/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--hero-orange)] hover:underline inline-flex items-center gap-1"
              >
                View full history on {chain.blockExplorers.default.name}
                <ExternalLink className="w-3 h-3" />
              </a>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
