import { useState, useMemo, useCallback, useRef, useEffect } from "react";
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
  ChevronDown,
  ArrowLeft,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAccount,
  useBalance,
  useConnect,
  useDisconnect,
  useEnsName,
  useEnsAvatar,
} from "wagmi";
const MAINNET_CHAIN_ID = 1;
import { normalize } from "viem/ens";
import { getAddress, isAddress, formatUnits } from "viem";
import { hasWalletConnect } from "../lib/wagmi";
import { QRCodeSVG } from "qrcode.react";

// ─── Jazzicon-style gradient avatar ─────────────────────────────────────
function generateGradient(address: string): string {
  const checksummed = getAddress(address);
  const seed = parseInt(checksummed.slice(2, 10), 16);
  const hue1 = seed % 360;
  const hue2 = (seed * 7) % 360;
  return `linear-gradient(135deg, hsl(${hue1}, 70%, 50%), hsl(${hue2}, 60%, 40%))`;
}

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

// ─── Custom WalletConnect QR Modal ─────────────────────────────────────
// This renders a QR code locally using the WC pairing URI.
// No dependency on api.web3modal.com or cloud.reown.com.
// Works on ALL browsers: Chrome, Brave, Safari, Firefox, mobile & desktop.
function WcQrModal({
  uri,
  onBack,
  onClose,
}: {
  uri: string;
  onBack: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyUri = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(uri);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = uri;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      {/* Header with back button */}
      <div className="flex items-center w-full">
        <button
          onClick={onBack}
          className="p-1 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        <h3 className="flex-1 text-center text-lg font-bold text-foreground">
          WalletConnect
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* QR Code */}
      <div className="bg-white rounded-2xl p-4 shadow-lg">
        <QRCodeSVG
          value={uri}
          size={260}
          level="M"
          includeMargin={false}
          imageSettings={{
            src: "/hero-soldier.webp",
            x: undefined,
            y: undefined,
            height: 40,
            width: 40,
            excavate: true,
          }}
        />
      </div>

      {/* Instructions */}
      <p className="text-sm text-muted-foreground text-center">
        Scan this QR code with your mobile wallet
      </p>
      <p className="text-xs text-muted-foreground/70 text-center">
        Trust Wallet, MetaMask Mobile, Rainbow, Ledger Live, and 300+ wallets supported
      </p>

      {/* Copy link button */}
      <button
        onClick={copyUri}
        className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/50 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-card hover:border-hero-orange/30 transition-all"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 text-hero-green" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copy link
          </>
        )}
      </button>
    </div>
  );
}

export function WalletButton() {
  const { chain, chainId } = useNetwork();
  const [isOpen, setIsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [wcUri, setWcUri] = useState<string | null>(null);
  const [showWcQr, setShowWcQr] = useState(false);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectAttemptRef = useRef(0);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
    };
  }, []);

  // wagmi hooks
  const { address, isConnected, connector: activeConnector } = useAccount();
  // Validate chainId to prevent passing invalid values to hooks
  const validChainId = chainId === 369 || chainId === 8453 ? chainId : undefined;

  const { data: balanceData } = useBalance({
    address,
    chainId: validChainId,
    query: { enabled: !!address && !!validChainId },
  });
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const isSafeContext = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.parent !== window;
    } catch {
      return false;
    }
  }, []);

  // ─── Listen for WalletConnect URI ──────────────────────────────────────
  // When showQrModal is false, wagmi emits a 'message' event with the URI
  // that we use to render our own QR code locally.
  useEffect(() => {
    const wcConnector = connectors.find((c) => c.name === "WalletConnect");
    if (!wcConnector) return;

    const handleMessage = ({ type, data }: { type: string; data?: unknown }) => {
      if (type === "display_uri" && typeof data === "string") {
        setWcUri(data);
        setShowWcQr(true);
      }
    };

    wcConnector.emitter.on("message", handleMessage);
    return () => {
      wcConnector.emitter.off("message", handleMessage);
    };
  }, [connectors]);

  // ─── Identity Resolution ────────────────────────────────────────────
  const { data: ensName } = useEnsName({
    address,
    chainId: MAINNET_CHAIN_ID,
    query: { enabled: !!address, staleTime: 1000 * 60 * 60 },
  });

  const normalizedEnsName = useMemo(() => ensName ? normalize(ensName) : undefined, [ensName]);

  const { data: rawEnsAvatar } = useEnsAvatar({
    name: normalizedEnsName,
    chainId: MAINNET_CHAIN_ID,
    query: { enabled: !!ensName, staleTime: 1000 * 60 * 60 },
  });

  // SECURITY: Sanitize ENS avatar URL to prevent XSS via malicious URIs
  const ensAvatar = useMemo(() => {
    if (!rawEnsAvatar) return undefined;
    try {
      const url = new URL(rawEnsAvatar);
      if (url.protocol === 'https:' || url.protocol === 'http:') return rawEnsAvatar;
      return undefined; // Block javascript:, data:, and other protocols
    } catch {
      return undefined;
    }
  }, [rawEnsAvatar]);

  // Deduplicate and sort connectors
  const sortedConnectors = useMemo(() => {
    const seen = new Set<string>();
    return connectors
      .filter((c) => {
        if (c.name === "Injected" && connectors.some((x) => x.name === "MetaMask")) {
          return false;
        }
        if (c.name === "WalletConnect" && !hasWalletConnect) {
          return false;
        }
        if (c.name === "Safe" && !isSafeContext) {
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
  }, [connectors, isSafeContext]);
  const hasWalletConnectConnector = sortedConnectors.some(
    (connector) => connector.name === "WalletConnect"
  );

  const handleConnect = (connector: (typeof connectors)[number]) => {
    if (connectingId) return; // Prevent race condition — block while connecting
    const attemptId = connectAttemptRef.current + 1;
    connectAttemptRef.current = attemptId;
    setConnectingId(connector.uid);

    // Safety timeout: reset connectingId after 30s to prevent permanent blocking
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
    }
    const connectorUid = connector.uid;
    connectTimeoutRef.current = setTimeout(() => {
      setConnectingId((current) => {
        if (attemptId !== connectAttemptRef.current) {
          return current;
        }
        if (current === connectorUid) {
          toast.error("Connection timed out");
          setShowWcQr(false);
          setWcUri(null);
          return null;
        }
        return current;
      });
      connectTimeoutRef.current = null;
    }, 60000); // 60s timeout for WC (QR scanning takes time)

    try {
      connect(
        validChainId ? { connector, chainId: validChainId } : { connector },
        {
          onSuccess: () => {
            if (attemptId !== connectAttemptRef.current) return;
            if (connectTimeoutRef.current) {
              clearTimeout(connectTimeoutRef.current);
              connectTimeoutRef.current = null;
            }
            toast.success("Wallet connected", {
              description: `Connected via ${connector.name}`,
            });
            setIsOpen(false);
            setConnectingId(null);
            setShowWcQr(false);
            setWcUri(null);
          },
          onError: (err) => {
            if (attemptId !== connectAttemptRef.current) return;
            if (connectTimeoutRef.current) {
              clearTimeout(connectTimeoutRef.current);
              connectTimeoutRef.current = null;
            }
            setConnectingId(null);
            setShowWcQr(false);
            setWcUri(null);
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
      if (attemptId !== connectAttemptRef.current) return;
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      setConnectingId(null);
      setShowWcQr(false);
      setWcUri(null);
      toast.error("Could not connect wallet");
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setShowDetails(false);
      toast.success("Wallet disconnected");
    } catch {
      toast.error("Failed to disconnect wallet");
    }
  };

  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const copyAddress = async () => {
    if (!address || !isAddress(address)) return;
    const checksummedAddr = getAddress(address);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(checksummedAddr);
      } else {
        // Fallback for browsers without Clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = checksummedAddr;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (!copied) {
          throw new Error("Copy command was unsuccessful");
        }
      }
      setIsCopied(true);
      toast.success("Address copied to clipboard");
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      toast.error("Failed to copy address");
    }
  };

  const truncateAddress = (addr: string) => {
    if (!isAddress(addr)) return addr;
    const checksummed = getAddress(addr as `0x${string}`);
    return `${checksummed.slice(0, 6)}...${checksummed.slice(-4)}`;
  };

  const formatBalance = (val: bigint | undefined, decimals: number) => {
    if (val === undefined) return "0";
    // Use formatUnits (string-based) to avoid BigInt→Number precision loss
    const str = formatUnits(val, decimals);
    const num = parseFloat(str);
    if (num === 0) return "0";
    if (num < 0.001) return "<0.001";
    // For large numbers (>1M), show compact notation
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
    return num.toFixed(3);
  };

  // ─── Connected State (Enhanced with Identity) ──────────────────────────
  if (isConnected && address) {
    return (
      <div className="relative">
        {/* Main wallet pill */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm px-3 py-2 hover:border-hero-orange/30 hover:shadow-lg hover:shadow-hero-orange/10 transition-all duration-200 group"
        >
          {/* Avatar */}
          {ensAvatar && !avatarError ? (
            <img
              src={ensAvatar}
              alt="Avatar"
              className="h-7 w-7 rounded-full ring-2 ring-hero-orange/40 object-cover"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <div
              className="h-7 w-7 rounded-full ring-2 ring-hero-orange/40 flex items-center justify-center text-white font-bold text-[10px]"
              style={{ background: generateGradient(address) }}
            >
              {address.slice(2, 4).toUpperCase()}
            </div>
          )}

          {/* Name + Balance */}
          <div className="flex flex-col items-start">
            <span className="text-sm font-semibold text-foreground leading-tight">
              {ensName || truncateAddress(address)}
            </span>
            <span className="text-[10px] text-hero-green font-medium leading-tight">
              {formatBalance(balanceData?.value, balanceData?.decimals ?? 18)}{" "}
              {chain.nativeCurrency.symbol}
            </span>
          </div>

          {/* Network indicator */}
          <div className="flex items-center gap-1 ml-1">
            <div
              className={`h-2 w-2 rounded-full ${
                chainId === 8453 ? "bg-blue-400" : "bg-green-400"
              } animate-pulse`}
            />
            <ChevronDown
              className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${
                showDetails ? "rotate-180" : ""
              }`}
            />
          </div>
        </button>

        {/* Dropdown details panel */}
        {showDetails && (
          <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/30 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Identity header */}
            <div className="flex items-center gap-3 pb-3 border-b border-border/30">
              {ensAvatar && !avatarError ? (
                <img
                  src={ensAvatar}
                  alt="Avatar"
                  className="h-10 w-10 rounded-full ring-2 ring-hero-orange/40 object-cover"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <div
                  className="h-10 w-10 rounded-full ring-2 ring-hero-orange/40 flex items-center justify-center text-white font-bold text-sm"
                  style={{ background: generateGradient(address) }}
                >
                  {address.slice(2, 4).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                {ensName && (
                  <div className="text-sm font-bold text-foreground truncate">
                    {ensName}
                  </div>
                )}
                <button
                  onClick={copyAddress}
                  className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
                >
                  {truncateAddress(address)}
                  {isCopied ? (
                    <Check className="h-3 w-3 text-hero-green" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>

            {/* Balance & Network */}
            <div className="py-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Balance</span>
                <span className="text-sm font-semibold text-hero-green">
                  {formatBalance(balanceData?.value, balanceData?.decimals ?? 18)}{" "}
                  {chain.nativeCurrency.symbol}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Network</span>
                <div className="flex items-center gap-1.5">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      chainId === 8453 ? "bg-blue-400" : "bg-green-400"
                    }`}
                  />
                  <span className="text-xs font-medium text-foreground">
                    {chain.name}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Wallet</span>
                <span className="text-xs font-medium text-foreground">
                  {activeConnector?.name || "Unknown"}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-border/30 flex gap-2">
              <a
                href={
                  chainId === 8453
                    ? `https://basescan.org/address/${address}`
                    : `https://scan.pulsechain.com/address/${address}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-background/50 border border-border/30 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-hero-orange/30 transition-all"
              >
                <ExternalLink className="h-3 w-3" />
                Explorer
              </a>
              <button
                onClick={handleDisconnect}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-destructive/10 border border-destructive/20 py-2 text-xs font-medium text-destructive hover:bg-destructive/20 transition-all"
              >
                <LogOut className="h-3 w-3" />
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* Click-away overlay */}
        {showDetails && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDetails(false)}
          />
        )}
      </div>
    );
  }

  // ─── Disconnected State ─────────────────────────────────────────────
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          connectAttemptRef.current += 1;
          if (connectTimeoutRef.current) {
            clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = null;
          }
          setShowWcQr(false);
          setWcUri(null);
          setConnectingId(null);
        }
      }}
    >
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
        {/* ─── Custom WalletConnect QR View ─────────────────────────── */}
        {showWcQr && wcUri ? (
          <WcQrModal
            uri={wcUri}
            onBack={() => {
              setShowWcQr(false);
              setWcUri(null);
              setConnectingId(null);
            }}
            onClose={() => {
              setIsOpen(false);
              setShowWcQr(false);
              setWcUri(null);
              setConnectingId(null);
            }}
          />
        ) : (
          <>
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
                      disabled={connectingId !== null && connectingId !== connector.uid}
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

              <div className="flex items-center gap-3 rounded-xl border border-border/30 bg-background/30 p-3">
                <Smartphone className="h-6 w-6 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium text-foreground/70 text-sm">
                    Ledger / Trezor
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {hasWalletConnectConnector
                      ? "Connect via WalletConnect QR code above"
                      : "Connect via MetaMask (Ledger/Trezor integration)"}
                  </div>
                </div>
              </div>

              {sortedConnectors
                .filter((c) => c.name === "Safe")
                .map((connector) => {
                  const meta = getConnectorMeta(connector.name);
                  const isThisConnecting = connectingId === connector.uid;
                  return (
                    <button
                      key={connector.uid}
                      onClick={() => handleConnect(connector)}
                      disabled={connectingId !== null && connectingId !== connector.uid}
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
            {!hasWalletConnectConnector && (
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
