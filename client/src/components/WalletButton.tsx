import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useNetwork } from "../contexts/NetworkContext";
import {
  Wallet,
  Copy,
  ExternalLink,
  LogOut,
  Check,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAccount,
  useBalance,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";

export function WalletButton() {
  const { chain, chainId } = useNetwork();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // wagmi hooks
  const { address, isConnected, connector: activeConnector } = useAccount();
  const { data: balanceData } = useBalance({
    address,
    chainId: chainId as 369 | 8453,
  });
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const handleConnect = (connector: (typeof connectors)[number]) => {
    try {
      connect(
        { connector, chainId: chainId as 369 | 8453 },
        {
          onSuccess: () => {
            toast.success("Wallet connected", {
              description: `Connected to ${chain.name} via ${connector.name}`,
            });
            setIsOpen(false);
          },
          onError: (err) => {
            const msg = (err as Error)?.message ?? "Connection failed";
            if (msg.includes("User rejected") || msg.includes("rejected")) {
              toast.info("Connection cancelled");
            } else {
              toast.error("Connection failed", { description: msg });
            }
          },
        }
      );
    } catch {
      toast.error("Could not connect wallet");
    }
  };

  const handleDisconnect = () => {
    disconnect();
    toast.success("Wallet disconnected");
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Address copied to clipboard");
    }
  };

  const truncateAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const formatBalance = (val: bigint | undefined, decimals: number) => {
    if (val === undefined) return "0";
    const num = Number(val) / 10 ** decimals;
    return num < 0.001 ? "<0.001" : num.toFixed(3);
  };

  // ─── Connected State ────────────────────────────────────────────────
  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/50 px-3 py-1.5">
          <span className="text-xs text-hero-green font-medium">
            {formatBalance(balanceData?.value, balanceData?.decimals ?? 18)}{" "}
            {chain.nativeCurrency.symbol}
          </span>
          <div className="h-4 w-px bg-border/50" />
          <button
            onClick={copyAddress}
            className="flex items-center gap-1.5 text-sm font-mono text-foreground/80 hover:text-foreground transition-colors"
          >
            {truncateAddress(address)}
            {copied ? (
              <Check className="h-3 w-3 text-hero-green" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDisconnect}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          title="Disconnect wallet"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // ─── Disconnected State ─────────────────────────────────────────────
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          className="bg-gradient-to-r from-hero-orange to-hero-green text-black font-semibold hover:opacity-90 transition-opacity"
          size="sm"
        >
          <Wallet className="mr-2 h-4 w-4" />
          Connect Wallet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            Connect to {chain.name}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-2 py-4">
          {connectors.map((connector) => {
            // Deduplicate — wagmi can list injected + metaMask as separate entries
            const icon =
              connector.name === "MetaMask"
                ? "🦊"
                : connector.name === "Coinbase Wallet"
                  ? "🔵"
                  : connector.name === "WalletConnect"
                    ? "🔗"
                    : connector.name === "Trust Wallet"
                      ? "🛡️"
                      : "🔌";

            return (
              <button
                key={connector.uid}
                onClick={() => handleConnect(connector)}
                disabled={isConnecting}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/50 p-3 text-left transition-all hover:bg-card hover:border-hero-orange/30 hover:shadow-md group disabled:opacity-50"
              >
                <span className="text-2xl">{icon}</span>
                <div className="flex-1">
                  <div className="font-medium text-foreground group-hover:text-hero-orange transition-colors">
                    {connector.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {connector.name === "MetaMask"
                      ? "Connect using MetaMask browser extension"
                      : connector.name === "Coinbase Wallet"
                        ? "Connect using Coinbase Wallet"
                        : connector.name === "WalletConnect"
                          ? "Scan QR code with any compatible wallet"
                          : `Connect using ${connector.name}`}
                  </div>
                </div>
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin text-hero-orange" />
                ) : (
                  <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            );
          })}
        </div>
        <div className="text-center text-xs text-muted-foreground">
          By connecting, you agree to the Terms of Service
        </div>
      </DialogContent>
    </Dialog>
  );
}
