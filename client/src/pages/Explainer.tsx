/**
 * Explainer Page — HERO Ecosystem
 * Design: Dark military theme, orange/green accents, visual breakdowns with infographics
 * Purpose: Onboard new users with video, ecosystem overview, and step-by-step guides
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Play, Shield, Zap, Leaf, Crown, Heart, Globe, ArrowRight,
  Wallet, TrendingUp, Users, Lock, ExternalLink, ChevronRight,
  Repeat, BarChart3, Coins, Award, Star, Flame
} from "lucide-react";

const HERO_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/hero-logo-official_808c9ab8.png";
const HERO_BANNER = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/HerobannerUN_342fe48e.jpg";
const HERO_SUNSET = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/herouniversalgoodstonesunset_905fb0ba.webp";
const HERO_TRUDEFI = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/HeroTruDefi_4b9604ff.jpg";
const VIC_INFOCHART = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/Vetsincryptoinfochartforvets,hero_c1479748.jpg";
const KYC_BADGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/KYC-certificate-badge_4bce12b5.png";

// YouTube channel link
const YOUTUBE_URL = "https://www.youtube.com/@LIFEWAVEPATCH1";

const ECOSYSTEM_PILLARS = [
  {
    icon: Repeat,
    title: "Swap",
    subtitle: "DEX Aggregator",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    desc: "Best-price token swaps across PulseChain and BASE. Routes through multiple DEXes to find the lowest slippage and best rates for HERO, VETS, and all major tokens.",
    link: "/swap",
    badge: "Live",
    badgeColor: "text-green-400 border-green-500/40",
  },
  {
    icon: Leaf,
    title: "Farm",
    subtitle: "Yield Farming",
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    desc: "Stake LP tokens and earn HERO rewards. Multiple pools across PulseChain and BASE with competitive APY. Diamond hands multiplier rewards long-term holders.",
    link: "/farm",
    badge: "Live",
    badgeColor: "text-green-400 border-green-500/40",
  },
  {
    icon: Crown,
    title: "NFTs",
    subtitle: "Military Trading Cards",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    desc: "555 unique steampunk-military trading cards across 10 categories and 5 rarity tiers. Holders get fee reductions, governance power, and exclusive airdrops.",
    link: "/nft",
    badge: "Minting Soon",
    badgeColor: "text-yellow-400 border-yellow-500/40",
  },
  {
    icon: Users,
    title: "DAO",
    subtitle: "Community Governance",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    desc: "HERO token holders vote on protocol upgrades, treasury spending, and community initiatives. NFT holders get boosted voting power.",
    link: "/dao",
    badge: "Active",
    badgeColor: "text-blue-400 border-blue-500/40",
  },
  {
    icon: Heart,
    title: "501(c)(3)",
    subtitle: "Veteran Support",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    desc: "HERO is a registered nonprofit. 25% of all NFT mint revenue goes directly to veteran support programs through the VIC Foundation.",
    link: "https://vicfoundation.com",
    badge: "Nonprofit",
    badgeColor: "text-red-400 border-red-500/40",
    external: true,
  },
  {
    icon: Globe,
    title: "Ecosystem",
    subtitle: "Multi-Chain Presence",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    desc: "HERO on BASE + PulseChain. VETS on PulseChain. Integrated with TruDefi, PulseX, and major DEX aggregators across both chains.",
    link: "/ecosystem",
    badge: "Dual-Chain",
    badgeColor: "text-cyan-400 border-cyan-500/40",
  },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Connect Your Wallet", desc: "Connect MetaMask, Coinbase Wallet, or any Web3 wallet. Switch between PulseChain (369) and BASE (8453) with one click.", icon: Wallet, color: "text-orange-400", bg: "bg-orange-500/10" },
  { step: "02", title: "Get HERO Tokens", desc: "Swap any token for HERO using the built-in DEX aggregator. Best rates across PulseX, 9inch, and all major DEXes.", icon: Repeat, color: "text-green-400", bg: "bg-green-500/10" },
  { step: "03", title: "Farm & Earn", desc: "Add liquidity to HERO pools and stake your LP tokens. Earn HERO rewards with boosted APY for long-term holders.", icon: Leaf, color: "text-blue-400", bg: "bg-blue-500/10" },
  { step: "04", title: "Mint an NFT", desc: "Mint one of 555 unique military trading cards. Your NFT rank unlocks fee reductions, governance power, and exclusive airdrops.", icon: Crown, color: "text-purple-400", bg: "bg-purple-500/10" },
  { step: "05", title: "Vote in the DAO", desc: "Use your HERO tokens and NFT to vote on protocol proposals. Shape the future of the ecosystem.", icon: Users, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  { step: "06", title: "Support Veterans", desc: "Every transaction, every mint, every farm contributes to veteran support through the VIC Foundation 501(c)(3).", icon: Heart, color: "text-red-400", bg: "bg-red-500/10" },
];

const TOKEN_FACTS = [
  { label: "HERO on BASE", value: "ERC-20", sub: "Base Network (8453)", color: "text-blue-400", icon: Coins },
  { label: "HERO on PulseChain", value: "PRC-20", sub: "PulseChain (369)", color: "text-orange-400", icon: Coins },
  { label: "VETS on PulseChain", value: "PRC-20", sub: "PulseChain (369)", color: "text-green-400", icon: Coins },
  { label: "NFT Standard", value: "ERC-721", sub: "Dual-chain deployment", color: "text-purple-400", icon: Award },
  { label: "Charity Allocation", value: "25%", sub: "Of all NFT mint revenue", color: "text-red-400", icon: Heart },
  { label: "NFT Collection Size", value: "555", sub: "Unique military cards", color: "text-yellow-400", icon: Star },
];

export default function Explainer() {
  const [videoPlaying, setVideoPlaying] = useState(false);

  return (
    <div className="space-y-8 pb-10">
      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden border border-border">
        <img src={HERO_BANNER} alt="HERO Banner" className="w-full h-48 md:h-64 object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent flex items-center px-6 md:px-10">
          <div className="flex items-center gap-4">
            <img src={HERO_LOGO} alt="HERO" className="w-16 h-16 rounded-full border-2 border-orange-500/60 object-cover shadow-lg shadow-orange-500/20" />
            <div>
              <h1 className="text-white font-bold text-2xl md:text-4xl">$HERO Ecosystem</h1>
              <p className="text-orange-300 text-sm md:text-base mt-1">DeFi for Veterans. Powered by PulseChain &amp; BASE.</p>
              <div className="flex gap-2 mt-2">
                <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/40 text-xs">KYC Verified</Badge>
                <Badge className="bg-green-500/20 text-green-300 border-green-500/40 text-xs">501(c)(3) Nonprofit</Badge>
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-xs">Dual-Chain</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KYC Badge */}
      <div className="flex items-center justify-center gap-4 p-4 rounded-xl bg-card/60 border border-green-500/20">
        <img src={KYC_BADGE} alt="KYC Verified" className="h-16 object-contain" />
        <div>
          <p className="text-foreground font-semibold">KYC Verified Project</p>
          <p className="text-muted-foreground text-sm">HERO has completed full Know Your Customer verification. Transparent, accountable, and compliant.</p>
        </div>
      </div>

      {/* Video Section */}
      <Card className="bg-card/60 border-border overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground flex items-center gap-2">
            <Play className="w-5 h-5 text-orange-400" />
            HERO Ecosystem Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="aspect-video bg-black relative">
            {videoPlaying ? (
              <iframe
                src="https://www.youtube.com/embed/zpwKPiA1r20?autoplay=1&rel=0"
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="HERO Ecosystem Video"
              />
            ) : (
              <div
                className="w-full h-full relative cursor-pointer group"
                onClick={() => setVideoPlaying(true)}
              >
                <img src={HERO_SUNSET} alt="Video Thumbnail" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-orange-500/90 hover:bg-orange-400 flex items-center justify-center transition-all group-hover:scale-110 shadow-xl shadow-orange-500/30">
                    <Play className="w-10 h-10 text-white ml-1" />
                  </div>
                </div>
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                  <Badge className="bg-black/70 text-white border-0">Watch on YouTube</Badge>
                  <a
                    href={YOUTUBE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-400 text-xs flex items-center gap-1 hover:text-orange-300"
                    onClick={(e) => e.stopPropagation()}
                  >
                    @LIFEWAVEPATCH1 <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}
          </div>
          <div className="p-4 flex items-center justify-between border-t border-border">
            <p className="text-muted-foreground text-sm">Full ecosystem explainer, tutorials, and community updates</p>
            <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-2">
                <Play className="w-4 h-4 text-red-500" />
                YouTube Channel
                <ExternalLink className="w-3 h-3" />
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Ecosystem Pillars */}
      <div>
        <h2 className="text-foreground font-bold text-xl mb-4 flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-400" />
          The 6 Pillars of HERO
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ECOSYSTEM_PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <Card key={pillar.title} className={`bg-card/60 ${pillar.border} hover:shadow-lg transition-all group`}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg ${pillar.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-5 h-5 ${pillar.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-bold text-sm ${pillar.color}`}>{pillar.title}</h3>
                        <Badge variant="outline" className={`text-[9px] ${pillar.badgeColor}`}>{pillar.badge}</Badge>
                      </div>
                      <p className="text-muted-foreground text-xs">{pillar.subtitle}</p>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed mb-3">{pillar.desc}</p>
                  {pillar.external ? (
                    <a href={pillar.link} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 text-xs ${pillar.color} hover:opacity-80`}>
                      Learn more <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <a href={pillar.link} className={`inline-flex items-center gap-1 text-xs ${pillar.color} hover:opacity-80`}>
                      Explore <ArrowRight className="w-3 h-3" />
                    </a>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* How It Works */}
      <div>
        <h2 className="text-foreground font-bold text-xl mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-orange-400" />
          How It Works — 6 Steps
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {HOW_IT_WORKS.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.step} className="flex gap-4 p-4 rounded-xl bg-card/60 border border-border hover:border-orange-500/20 transition-all">
                <div className={`w-10 h-10 rounded-lg ${step.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 ${step.color}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-muted-foreground/50 text-xs font-mono">{step.step}</span>
                    <h3 className="text-foreground font-semibold text-sm">{step.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Token Facts */}
      <div>
        <h2 className="text-foreground font-bold text-xl mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-orange-400" />
          Token &amp; Protocol Facts
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {TOKEN_FACTS.map((fact) => {
            const Icon = fact.icon;
            return (
              <Card key={fact.label} className="bg-card/60 border-border text-center">
                <CardContent className="p-4">
                  <Icon className={`w-5 h-5 mx-auto mb-2 ${fact.color}`} />
                  <p className={`font-bold text-lg ${fact.color}`}>{fact.value}</p>
                  <p className="text-foreground text-xs font-medium">{fact.label}</p>
                  <p className="text-muted-foreground/60 text-[10px] mt-0.5">{fact.sub}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Visual Infochart */}
      <Card className="bg-card/60 border-border overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground text-base flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-400" />
            VETS &amp; HERO Ecosystem Infographic
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <img src={VIC_INFOCHART} alt="VetsInCrypto Infographic" className="w-full object-contain" />
        </CardContent>
      </Card>

      {/* TruDefi Integration */}
      <Card className="bg-card/60 border-border overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground text-base flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            TruDefi Integration
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <img src={HERO_TRUDEFI} alt="HERO TruDefi" className="w-full object-contain" />
          <div className="p-4 border-t border-border">
            <p className="text-muted-foreground text-sm">HERO is integrated with TruDefi for advanced DeFi analytics, portfolio tracking, and yield optimization across PulseChain and BASE.</p>
          </div>
        </CardContent>
      </Card>

      {/* CTA Section */}
      <Card className="bg-gradient-to-r from-orange-500/10 via-card to-green-500/10 border-orange-500/20">
        <CardContent className="p-6 text-center">
          <img src={HERO_LOGO} alt="HERO" className="w-16 h-16 rounded-full mx-auto mb-4 border-2 border-orange-500/40 object-cover" />
          <h3 className="text-foreground font-bold text-xl mb-2">Ready to Join the Mission?</h3>
          <p className="text-muted-foreground text-sm mb-4 max-w-md mx-auto">Connect your wallet, get HERO tokens, and start earning while supporting veterans and first responders worldwide.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a href="/swap">
              <Button className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
                <Repeat className="w-4 h-4" />
                Swap HERO
              </Button>
            </a>
            <a href="/farm">
              <Button variant="outline" className="gap-2 border-green-500/40 text-green-400 hover:bg-green-500/10">
                <Leaf className="w-4 h-4" />
                Start Farming
              </Button>
            </a>
            <a href="/nft">
              <Button variant="outline" className="gap-2 border-purple-500/40 text-purple-400 hover:bg-purple-500/10">
                <Crown className="w-4 h-4" />
                Mint NFT
              </Button>
            </a>
            <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2 border-red-500/40 text-red-400 hover:bg-red-500/10">
                <Play className="w-4 h-4" />
                Watch Videos
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Community Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { name: "Telegram", url: "https://t.me/VetsInCrypto/1", color: "text-blue-400", border: "border-blue-500/30", bg: "bg-blue-500/10" },
          { name: "X / Twitter", url: "https://x.com/hero501c3", color: "text-foreground", border: "border-border", bg: "bg-card/60" },
          { name: "YouTube", url: YOUTUBE_URL, color: "text-red-400", border: "border-red-500/30", bg: "bg-red-500/10" },
          { name: "VIC Foundation", url: "https://vicfoundation.com", color: "text-orange-400", border: "border-orange-500/30", bg: "bg-orange-500/10" },
        ].map((link) => (
          <a key={link.name} href={link.url} target="_blank" rel="noopener noreferrer"
            className={`flex items-center justify-center gap-2 p-3 rounded-xl ${link.bg} border ${link.border} hover:opacity-80 transition-all`}>
            <span className={`font-semibold text-sm ${link.color}`}>{link.name}</span>
            <ExternalLink className={`w-3 h-3 ${link.color}`} />
          </a>
        ))}
      </div>
    </div>
  );
}
