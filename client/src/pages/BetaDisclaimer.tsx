/**
 * BetaDisclaimer.tsx — HERO Dapp Beta Disclaimer
 * Route: /beta-disclaimer
 * Design: Dark military theme, legal/compliance tone
 */
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, ExternalLink, ArrowLeft, CheckCircle } from "lucide-react";

const HERO_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/hero-logo-official_808c9ab8.png";
const KYC_BADGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/KYC-certificate-badge_4bce12b5.png";

export default function BetaDisclaimer() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={HERO_LOGO} alt="HERO" className="w-9 h-9 rounded-full border border-[var(--hero-orange)]/40" />
            <span className="font-bold text-foreground">HERO Dapp</span>
            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/40 text-xs">BETA</Badge>
          </div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Back to App
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm font-semibold mb-6">
            <AlertTriangle className="w-4 h-4" />
            Beta Software — Please Read Before Using
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
            HERO Dapp Beta Disclaimer
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            HERO Dapp is currently in public beta. By using this application, you acknowledge and accept the following terms and risk disclosures.
          </p>
        </div>

        {/* KYC + Audit Badges */}
        <div className="flex items-center justify-center gap-4 mb-10 flex-wrap">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30">
            <img src={KYC_BADGE} alt="KYC" className="w-6 h-6" />
            <span className="text-green-400 text-sm font-semibold">KYC Certified</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-green-400 text-sm font-semibold">Smart Contract Audited</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/30">
            <Shield className="w-5 h-5 text-blue-400" />
            <span className="text-blue-400 text-sm font-semibold">501(c)(3) Nonprofit</span>
          </div>
        </div>

        {/* Disclaimer Sections */}
        <div className="space-y-6">
          <Card className="bg-card border-yellow-500/20">
            <CardContent className="p-6">
              <div className="flex items-start gap-3 mb-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                <h2 className="text-lg font-bold text-foreground">1. Beta Software Notice</h2>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                HERO Dapp is beta software under active development. Features may be incomplete, subject to change, or temporarily unavailable. The interface, smart contract integrations, and underlying protocols may contain bugs or vulnerabilities that have not yet been identified. Use at your own risk.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-start gap-3 mb-3">
                <Shield className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                <h2 className="text-lg font-bold text-foreground">2. Financial Risk Disclosure</h2>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Cryptocurrency and DeFi investments carry substantial risk of loss. Token prices are highly volatile. Past performance is not indicative of future results. HERO Dapp does not provide financial, investment, legal, or tax advice. Nothing on this platform constitutes a solicitation or offer to buy or sell any security. Always do your own research (DYOR) and consult a qualified financial advisor before making investment decisions.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-start gap-3 mb-3">
                <Shield className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <h2 className="text-lg font-bold text-foreground">3. Smart Contract Risk</h2>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                All DeFi interactions involve smart contract risk. While HERO token smart contracts have been audited, no audit guarantees the absence of vulnerabilities. Interactions with third-party protocols (PulseX, 9inch, Emit Farm, RhinoFi, TruFarms, Aerodrome) are subject to those protocols' own risks and terms. HERO Dapp is not responsible for losses arising from third-party protocol failures.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-start gap-3 mb-3">
                <Shield className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <h2 className="text-lg font-bold text-foreground">4. Wallet Security</h2>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                You are solely responsible for the security of your wallet and private keys. HERO Dapp never stores, transmits, or has access to your private keys or seed phrases. Never share your seed phrase with anyone. Use a hardware wallet for large holdings. Always verify transaction details before signing. Be aware of phishing sites — the official domain is <strong className="text-[var(--hero-orange)]">www.herobase.io</strong>.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-start gap-3 mb-3">
                <Shield className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                <h2 className="text-lg font-bold text-foreground">5. Regulatory Compliance</h2>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                HERO Dapp is not available to residents of jurisdictions where cryptocurrency trading or DeFi activities are prohibited or restricted by law. Users are solely responsible for compliance with applicable laws and regulations in their jurisdiction. The VIC Foundation is a registered 501(c)(3) nonprofit organization. HERO and VETS tokens are utility tokens and are not registered securities.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-start gap-3 mb-3">
                <Shield className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <h2 className="text-lg font-bold text-foreground">6. Limitation of Liability</h2>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, HERO DAPP, THE VIC FOUNDATION, AND THEIR CONTRIBUTORS SHALL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THIS APPLICATION. THIS INCLUDES BUT IS NOT LIMITED TO LOSS OF FUNDS, LOSS OF DATA, OR LOSS OF PROFITS.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Acceptance + Links */}
        <div className="mt-10 text-center space-y-4">
          <p className="text-muted-foreground text-sm">
            By using HERO Dapp, you confirm that you have read, understood, and agree to this disclaimer.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/">
              <Button className="bg-gradient-to-r from-[var(--hero-orange)] to-[var(--hero-green)] text-foreground border-0">
                I Understand — Enter App
              </Button>
            </Link>
            <a href="https://docs.vicfoundation.com" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="border-border text-foreground gap-1.5">
                Read Whitepaper <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </a>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Last updated: April 2026 · VIC Foundation 501(c)(3) · HERO Dapp Beta v1.0
          </p>
        </div>
      </div>
    </div>
  );
}
