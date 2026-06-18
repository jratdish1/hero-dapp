/**
 * WalletButton — minimal build-compatibility stub.
 *
 * The original WalletButton source was removed in a prior commit.
 * This stub restores build compatibility by rendering a login/connect
 * prompt using the existing auth system.
 *
 * NO wallet custody logic.
 * NO private key handling.
 * NO contract writes.
 * NO new API calls.
 *
 * build-hotfix: stale WalletButton source restored as minimal stub.
 */
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { LogIn, Wallet } from "lucide-react";

export function WalletButton() {
  const { user, isAuthenticated } = useAuth();

  if (isAuthenticated && user) {
    // User is logged in — show a minimal wallet indicator
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono">
        <Wallet className="w-3.5 h-3.5" />
        <span className="hidden sm:inline max-w-[80px] truncate">
          {user.username ?? "Connected"}
        </span>
      </div>
    );
  }

  // Not logged in — show connect/login button
  return (
    <Link href={getLoginUrl()}>
      <Button
        size="sm"
        variant="outline"
        className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 text-xs h-7 px-2 gap-1"
      >
        <LogIn className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Connect</span>
      </Button>
    </Link>
  );
}

export default WalletButton;
