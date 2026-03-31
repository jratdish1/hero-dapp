import { useState, useMemo } from "react";
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
  Shield,
  QrCode,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAccount,
  useBalance,
  useConnect,
  useDisconnect,
} from "wagmi";
import { hasWalletConnect } from "../lib/wagmi";

// ─── Connector metadata ─────────────────────────────────────────────────
const CONNECTOR_META: Record<
  string,
  { icon: React.ReactNode; label: string; description: string; priority: number }
> = {
  MetaMask: {
    icon: <span className="text-2xl">🦊</span>,
    label: "MetaMask",
    description: "Browser extension or mobile app",
    priority: 1,
  },
  "Coinbase Wallet": {
    icon: <span className="text-2xl">🔵</span>,
    label: "Coinbase Wallet",
    description: "Coinbase Wallet extension or mobile",
    priority: 2,
  },
  WalletConnect: {
    icon: <QrCode className="h-6 w-6 text-blue-400" />,
    label: "WalletConnect",
    description: "Scan QR — Trust Wallet, Ledger, Rainbow, 300+ wallets",
    priority: 3,
  },
  Safe: {
    icon: <Shield className="h-6 w-6 text-green-400" />,
    label: "Gnosis Safe",
    description: "Multisig wallet for DAO treasury management",
    priority: 5,
  },
  Injected: {
    icon: <Wallet className="h-6 w-6 text-hero-orange" />,
    label: "Browser Wallet",
    description: "Any injected EVM wallet (Rabby, Brave, Frame, etc.)",
    priority: 4,
  },
};

function getConnectorMeta(name: string) {
  return (
    CONNECTOR_META[name] ?? {
      icon: <Wallet className="h-6 w-6 text-muted-foreground" />,
      label: name,
      description: `Connect using ${name}`,
      priority: 10,
    }
  );
}

export function WalletButton() {
  const { chain, chainId } = useNetwork();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  // wagmi hooks
  const { address, isConnected, connector: activeConnector } = useAccount();
  const { data: balanceData } = useBalance({
    address,
    chainId: chainId as 369 | 8453,
  });
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();

  // Deduplicate and sort connectors
  const sortedConnectors = useMemo(() => {
    const seen = new Set<string>();
    return connectors
      .filter((c) => {
        // Skip duplicate injected if MetaMask is present
        if (c.name === "Injected" && connectors.some((x) => x.name === "MetaMask")) {
          return false;
        }
        // Skip Safe in non-Safe environments
        if (c.name === "Safe" && typeof window !== "undefined" && !window.parent) {
          return false;
        }
        if (seen.has(c.name)) return false;
        seen.add(c.name);
        return true;
      })
      .sort((a, b) => {
        const aMeta = getConnectorMeta(a.name);
        const bMeta = getConnectorMeta(b.name);
        return aMeta.priority - bMeta.priority;
      });
  }, [connectors]);

  const handleConnect = (connector: (typeof connectors)[number]) => {
    setConnectingId(connector.uid);
    try {
      connect(
        { connector, chainId: chainId as 369 | 8453 },
        {
          onSuccess: () => {
            toast.success("Wallet connected", {
              description: `Connected to ${chain.name} via ${connector.name}`,
            });
            setIsOpen(false);
            setConnectingId(null);
          },
          onError: (err) => {
            setConnectingId(null);
            const msg = (err as Error)?.message ?? "Connection failed";
            if (msg.includes("User rejected") || msg.includes("rejected")) {
              toast.info("Connection cancelled");
            } else if (msg.includes("Already processing")) {
              toast.info("Check your wallet — a connection request is pending");
            } else {
              toast.error("Connection failed", {
                description: msg.length > 100 ? msg.slice(0, 100) + "..." : msg,
              });
            }
          },
        }
      );
    } catch {
      setConnectingId(null);
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
    return num < 0.001 && num > 0 ? "<0.001" : num.toFixed(3);
  };

  // ─── Connected State ────────────────────────────────────────────────
  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/50 px-3 py-1.5">
          {activeConnector && (
            <span className="text-xs text-muted-foreground" title={`Connected via ${activeConnector.name}`}>
              {activeConnector.name === "MetaMask"
                ? "🦊"
                : activeConnector.name === "WalletConnect"
                  ? "🔗"
                  : activeConnector.name === "Coinbase Wallet"
                    ? "🔵"
                    : activeConnector.name === "Safe"
                      ? "🛡️"
                      : "🔌"}
            </span>
          )}
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
          className="bg-hero-orange text-white font-bold shadow-lg shadow-hero-orange/25 hover:bg-hero-orange/90 hover:shadow-hero-orange/40 transition-all border-0"
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
          <p className="text-sm text-muted-foreground mt-1">
            Choose your wallet to connect to the HERO Dapp
          </p>
        </DialogHeader>

        {/* ─── Hot Wallets ─────────────────────────────────────────── */}
        <div className="space-y-1.5 py-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
            Hot Wallets
          </p>
          {sortedConnectors
            .filter((c) => c.name !== "Safe")
            .map((connector) => {
              const meta = getConnectorMeta(connector.name);
              const isThisConnecting = connectingId === connector.uid;
              return (
                <button
                  key={connector.uid}
                  onClick={() => handleConnect(connector)}
                  disabled={isConnecting}
                  className="flex items-center gap-3 w-full rounded-xl border border-border/50 bg-background/50 p-3 text-left transition-all hover:bg-card hover:border-hero-orange/30 hover:shadow-md group disabled:opacity-50"
                >
                  {meta.icon}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground group-hover:text-hero-orange transition-colors">
                      {meta.label}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {meta.description}
                    </div>
                  </div>
                  {isThisConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin text-hero-orange flex-shrink-0" />
                  ) : (
                    <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  )}
                </button>
              );
            })}
        </div>

        {/* ─── Hardware / Multisig ─────────────────────────────────── */}
        <div className="space-y-1.5 py-2 border-t border-border/30">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 pt-1">
            Hardware & Multisig
          </p>

          {/* Hardware wallet info — connects via WalletConnect or MetaMask */}
          <div className="flex items-center gap-3 rounded-xl border border-border/30 bg-background/30 p-3">
            <Smartphone className="h-6 w-6 text-muted-foreground" />
            <div className="flex-1">
              <div className="font-medium text-foreground/70 text-sm">
                Ledger / Trezor
              </div>
              <div className="text-xs text-muted-foreground">
                {hasWalletConnect
                  ? "Connect via WalletConnect QR code above"
                  : "Connect via MetaMask (Ledger/Trezor integration)"}
              </div>
            </div>
          </div>

          {/* Safe connector — only shows if in Safe app context */}
          {sortedConnectors
            .filter((c) => c.name === "Safe")
            .map((connector) => {
              const meta = getConnectorMeta(connector.name);
              const isThisConnecting = connectingId === connector.uid;
              return (
                <button
                  key={connector.uid}
                  onClick={() => handleConnect(connector)}
                  disabled={isConnecting}
                  className="flex items-center gap-3 w-full rounded-xl border border-border/50 bg-background/50 p-3 text-left transition-all hover:bg-card hover:border-hero-green/30 hover:shadow-md group disabled:opacity-50"
                >
                  {meta.icon}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground group-hover:text-hero-green transition-colors">
                      {meta.label}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {meta.description}
                    </div>
                  </div>
                  {isThisConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin text-hero-green flex-shrink-0" />
                  ) : (
                    <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  )}
                </button>
              );
            })}
        </div>

        {/* ─── WalletConnect status ────────────────────────────────── */}
        {!hasWalletConnect && (
          <div className="rounded-lg bg-muted/50 p-2.5 text-center">
            <p className="text-xs text-muted-foreground">
              <QrCode className="inline h-3 w-3 mr-1" />
              WalletConnect QR scanning available once Project ID is configured
            </p>
          </div>
        )}

        <div className="text-center text-xs text-muted-foreground pt-1">
          By connecting, you agree to the Terms of Service
        </div>
      </DialogContent>
    </Dialog>
  );
}
