import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, ExternalLink, Info, LockKeyhole, Shield, Wallet } from "lucide-react";

export default function Treasury() {
  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <Wallet className="w-6 h-6 text-orange-400" />
        <div>
          <h1 className="text-foreground font-bold text-2xl">Treasury Reference</h1>
          <p className="text-muted-foreground text-sm">Read-only external information. Advisory v1 has no treasury execution authority.</p>
        </div>
      </div>

      <Card className="bg-card/60 border-yellow-500/30">
        <CardContent className="p-5 flex items-start gap-3">
          <LockKeyhole className="w-5 h-5 text-yellow-400 mt-0.5" />
          <div>
            <p className="font-semibold">No DAO treasury control</p>
            <p className="text-sm text-muted-foreground mt-1">
              This application does not verify, hold, spend, transfer, queue, or execute treasury assets through advisory governance. No token-weighted or NFT-boosted treasury authority is enabled.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/60 border-border overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-foreground flex flex-wrap items-center gap-2 text-lg">
            <BarChart3 className="w-5 h-5 text-orange-400" />
            VIC Foundation External Dashboard
            <Badge variant="outline" className="text-[10px]">UNVERIFIED EXTERNAL SOURCE</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <p>Values, balances, wallet ownership, and update timing are supplied by the external site and are not governance receipts or application-verified treasury state.</p>
          </div>
          <div className="w-full overflow-hidden rounded-lg border border-border" style={{ minHeight: "600px" }}>
            <iframe
              src="https://dashboard.vicfoundation.com"
              width="100%"
              height="600"
              className="border-0"
              title="VIC Foundation external treasury dashboard"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-card/60 border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2"><Shield className="w-4 h-4 text-orange-400" /><p className="font-semibold">Advisory boundary</p></div>
            <p className="text-sm text-muted-foreground">Proposals and votes are non-binding community records. Queued and executed proposal states are blocked, and no wallet transaction is created.</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2"><Wallet className="w-4 h-4 text-blue-400" /><p className="font-semibold">External custody</p></div>
            <p className="text-sm text-muted-foreground">Any actual treasury wallets, custody policies, spending controls, and nonprofit operations exist outside this advisory application and require separate verification.</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <a href="https://dashboard.vicfoundation.com" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" className="gap-2"><BarChart3 className="w-4 h-4" />Open External Dashboard <ExternalLink className="w-3 h-3" /></Button>
        </a>
        <a href="https://docs.vicfoundation.com" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" className="gap-2">External Documentation <ExternalLink className="w-3 h-3" /></Button>
        </a>
      </div>
    </div>
  );
}
