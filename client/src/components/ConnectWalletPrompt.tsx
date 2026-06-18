/**
 * ConnectWalletPrompt — minimal build-compatibility stub.
 *
 * The original ConnectWalletPrompt source was removed in a prior commit.
 * This stub restores build compatibility by rendering a minimal
 * "connect wallet" prompt card.
 *
 * NO wallet custody logic.
 * NO private key handling.
 * NO contract writes.
 * NO new API calls.
 *
 * build-hotfix: stale ConnectWalletPrompt source restored as minimal stub.
 */
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { getLoginUrl } from "@/const";

interface ConnectWalletPromptProps {
  message?: string;
}

export function ConnectWalletPrompt({
  message = "Connect your wallet to continue",
}: ConnectWalletPromptProps) {
  return (
    <Card className="border-amber-500/20 bg-amber-500/5">
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Wallet className="w-6 h-6 text-amber-400" />
        </div>
        <p className="text-muted-foreground text-sm max-w-xs">{message}</p>
        <Link href={getLoginUrl()}>
          <Button
            variant="outline"
            className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
          >
            Connect Wallet
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export default ConnectWalletPrompt;
