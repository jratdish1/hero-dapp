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
import { Wallet, Copy, ExternalLink, LogOut, Check } from "lucide-react";
import { toast } from "sonner";

// Simulated wallet state (will be replaced with real wagmi hooks when on-chain)
interface WalletState {
  address: string | null;
  isConnected: boolean;
  balance: string;
  connector: string;
}

const WALLET_OPTIONS = [
  {
    id: "metamask",
    name: "MetaMask",
    icon: "🦊",
    description: "Connect using MetaMask browser extension",
  },
  {
    id: "trust",
    name: "Trust Wallet",
    icon: "🛡️",
    description: "Connect using Trust Wallet",
  },
  {
    id: "walletconnect",
    name: "WalletConnect",
    icon: "🔗",
    description: "Scan QR code with any compatible wallet",
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    icon: "🔵",
    description: "Connect using Coinbase Wallet",
  },
];

export function WalletButton() {
  const { chain } = useNetwork();
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    isConnected: false,
    balance: "0",
    connector: "",
  });
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const connectWallet = (connectorId: string) => {
    // Check if MetaMask or other wallet is available
    const hasProvider = typeof window !== "undefined" && (window as any).ethereum;

    if (connectorId === "metamask" && !hasProvider) {
      toast.error("MetaMask not detected", {
        description: "Please install MetaMask browser extension to connect.",
        action: {
          label: "Install",
          onClick: () => window.open("https://metamask.io/download/", "_blank"),
        },
      });
      return;
    }

    if (connectorId === "trust" && !hasProvider) {
      toast.error("Trust Wallet not detected", {
        description: "Please install Trust Wallet to connect.",
        action: {
          label: "Install",
          onClick: () => window.open("https://trustwallet.com/", "_blank"),
        },
      });
      return;
    }

    // For demo/preview: simulate connection
    toast.info("Wallet Connection", {
      description: `${connectorId === "walletconnect" ? "WalletConnect" : connectorId === "coinbase" ? "Coinbase Wallet" : connectorId === "metamask" ? "MetaMask" : "Trust Wallet"} integration ready. Connect your wallet on ${chain.name} to start trading.`,
    });
    setIsOpen(false);
  };

  const disconnectWallet = () => {
    setWallet({ address: null, isConnected: false, balance: "0", connector: "" });
    toast.success("Wallet disconnected");
  };

  const copyAddress = () => {
    if (wallet.address) {
      navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Address copied to clipboard");
    }
  };

  const truncateAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  if (wallet.isConnected && wallet.address) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/50 px-3 py-1.5">
          <span className="text-xs text-hero-green font-medium">
            {wallet.balance} {chain.nativeCurrency.symbol}
          </span>
          <div className="h-4 w-px bg-border/50" />
          <button
            onClick={copyAddress}
            className="flex items-center gap-1.5 text-sm font-mono text-foreground/80 hover:text-foreground transition-colors"
          >
            {truncateAddress(wallet.address)}
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
          onClick={disconnectWallet}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          title="Disconnect wallet"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

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
          {WALLET_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => connectWallet(opt.id)}
              className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/50 p-3 text-left transition-all hover:bg-card hover:border-hero-orange/30 hover:shadow-md group"
            >
              <span className="text-2xl">{opt.icon}</span>
              <div className="flex-1">
                <div className="font-medium text-foreground group-hover:text-hero-orange transition-colors">
                  {opt.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {opt.description}
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
        <div className="text-center text-xs text-muted-foreground">
          By connecting, you agree to the Terms of Service
        </div>
      </DialogContent>
    </Dialog>
  );
}
