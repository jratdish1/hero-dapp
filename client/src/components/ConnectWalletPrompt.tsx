/**
 * ConnectWalletPrompt — Inline wallet connection prompt
 *
 * Renders a full-featured "Connect Wallet" call-to-action with the
 * WalletButton modal trigger, supporting injected wallets (MetaMask,
 * Rabby, Brave, Frame, etc.) and WalletConnect (Trust Wallet, Ledger,
 * Rainbow, 300+ mobile wallets via QR code).
 *
 * Usage:
 *   import { ConnectWalletPrompt } from "@/components/ConnectWalletPrompt";
 *   {!isConnected && <ConnectWalletPrompt message="Connect your wallet to vote." />}
 */
import { Wallet, QrCode, Shield } from "lucide-react";
import { WalletButton } from "./WalletButton";
import { hasWalletConnect } from "../lib/wagmi";

interface ConnectWalletPromptProps {
  /** Context-specific message shown above the connect button */
  message?: string;
  /** Optional sub-message shown below the connect button */
  subMessage?: string;
  /** Visual variant — "card" (default) or "inline" */
  variant?: "card" | "inline";
  /** Icon to show at top — defaults to Wallet */
  icon?: "wallet" | "shield" | "qr";
}

export function ConnectWalletPrompt({
  message = "Connect your wallet to continue.",
  subMessage,
  variant = "card",
  icon = "wallet",
}: ConnectWalletPromptProps) {
  const IconComponent =
    icon === "shield" ? Shield : icon === "qr" ? QrCode : Wallet;

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/50">
        <IconComponent className="h-5 w-5 text-hero-orange flex-shrink-0" />
        <p className="text-sm text-muted-foreground flex-1">{message}</p>
        <WalletButton />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 rounded-2xl border border-border/50 bg-card/30 text-center space-y-4">
      {/* Icon */}
      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-hero-orange/10 border border-hero-orange/20">
        <IconComponent className="h-7 w-7 text-hero-orange" />
      </div>

      {/* Message */}
      <div className="space-y-1.5">
        <p className="font-semibold text-foreground text-base">{message}</p>
        {subMessage && (
          <p className="text-sm text-muted-foreground max-w-xs">{subMessage}</p>
        )}
      </div>

      {/* Wallet connect button */}
      <WalletButton />

      {/* Supported wallets hint */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        <span className="text-xs text-muted-foreground">Supports:</span>
        <span className="text-xs bg-muted/50 rounded-full px-2 py-0.5 text-muted-foreground">
          🦊 MetaMask
        </span>
        <span className="text-xs bg-muted/50 rounded-full px-2 py-0.5 text-muted-foreground">
          🔵 Coinbase
        </span>
        <span className="text-xs bg-muted/50 rounded-full px-2 py-0.5 text-muted-foreground">
          🌐 Rabby / Brave
        </span>
        {hasWalletConnect && (
          <span className="text-xs bg-blue-500/10 border border-blue-500/20 rounded-full px-2 py-0.5 text-blue-400">
            <QrCode className="inline h-3 w-3 mr-1" />
            WalletConnect
          </span>
        )}
      </div>
    </div>
  );
}
