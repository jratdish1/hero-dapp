import { useEffect } from "react";
import { useLocation } from "wouter";

interface PageSEO {
  title: string;
  description: string;
}

const PAGE_SEO_MAP: Record<string, PageSEO> = {
  "/": {
    title: "HERO Dapp — PulseChain & BASE DEX Aggregator | Trade $HERO & $VETS",
    description: "Trade $HERO and $VETS on PulseChain and BASE. DEX aggregator with gasless swaps, DCA orders, limit orders, portfolio tracking, and LP staking. Built for veterans, by veterans.",
  },
  "/swap": {
    title: "Swap — Best DEX Rates on PulseChain & BASE | HERO Dapp",
    description: "Swap tokens at the best rates across PulseX, 9inch, Liberty Swap and more. Gasless transactions with ERC-4337 Paymaster.",
  },
  "/dashboard": {
    title: "Live Dashboard — PulseChain Stats & Analytics | HERO Dapp",
    description: "Real-time PulseChain stats: gas prices, TVL, volume, and network activity. Track $HERO and $VETS performance live.",
  },
  "/portfolio": {
    title: "Portfolio Tracker — Track Your PulseChain & BASE Holdings | HERO Dapp",
    description: "Track your PulseChain and BASE token holdings, LP positions, and portfolio performance in one place.",
  },
  "/dca": {
    title: "DCA Orders — Dollar Cost Average into $HERO & $VETS | HERO Dapp",
    description: "Set up automated Dollar Cost Averaging into HERO, VETS, or any PulseChain token. Automate your investment strategy.",
  },
  "/limits": {
    title: "Limit Orders — Set Target Prices on PulseChain | HERO Dapp",
    description: "Set your target price and let the system execute when the market hits it. Limit orders for PulseChain and BASE tokens.",
  },
  "/approvals": {
    title: "Approval Manager — Revoke Token Approvals | HERO Dapp",
    description: "Review and revoke token approvals to protect your wallet from exploits. Manage your PulseChain and BASE token permissions.",
  },
  "/stake": {
    title: "Stake $HERO — Earn Rewards on PulseChain | HERO Dapp",
    description: "Stake HERO and VETS across Emit Farm, RhinoFi, and TruFarms. All staking pairs in one place. Earn passive income.",
  },
  "/stake/base": {
    title: "Stake on BASE — HERO LP Staking | HERO Dapp",
    description: "Stake HERO tokens on BASE network. Provide liquidity and earn rewards on BASE chain.",
  },
  "/stake/dai": {
    title: "Stake HERO to DAI — Earn Stablecoins | HERO Dapp",
    description: "Stake HERO tokens and earn DAI stablecoin rewards. Stable yield from your HERO holdings.",
  },
  "/tokenomics": {
    title: "Tokenomics — $HERO & $VETS Token Economics | HERO Dapp",
    description: "Closed-loop flywheel: farm, stake, earn stablecoins, buy HERO. Explore the HERO and VETS token economics, supply, and distribution.",
  },
  "/nft": {
    title: "NFT Collection — 1,000 Military-Themed NFTs | HERO Dapp",
    description: "1,000 military-themed NFTs with rank-based utility. Hold more HERO, earn higher rank. Exclusive veteran-inspired digital collectibles.",
  },
  "/media": {
    title: "Media Hub — Press, Influencers & Coverage | HERO Dapp",
    description: "Influencer mentions, guest posts, and press coverage of the HERO ecosystem. Stay updated with the latest HERO media.",
  },
  "/ai": {
    title: "AI Assistant — Smart Trading Helper | HERO Dapp",
    description: "AI-powered trading assistant for PulseChain and BASE. Get market insights, token analysis, and trading suggestions.",
  },
  "/ecosystem": {
    title: "Ecosystem — HERO Partners & Integrations | HERO Dapp",
    description: "Explore the HERO ecosystem: partner protocols, integrations, and the growing network of veteran-focused DeFi projects.",
  },
  "/community": {
    title: "Community — Blog & Updates | HERO Dapp",
    description: "Latest news, updates, and community posts from the HERO ecosystem. Stay connected with the veteran crypto community.",
  },
  "/dao": {
    title: "DAO Dashboard — HERO Governance | HERO Dapp",
    description: "Participate in HERO DAO governance. Vote on proposals, delegate voting power, and shape the future of the HERO ecosystem.",
  },
  "/dao/proposals": {
    title: "DAO Proposals — Vote on HERO Governance | HERO Dapp",
    description: "Browse and vote on active HERO DAO governance proposals. Your voice matters in shaping the ecosystem.",
  },
  "/dao/treasury": {
    title: "DAO Treasury — HERO Fund Management | HERO Dapp",
    description: "View the HERO DAO treasury holdings, allocations, and spending. Full transparency on community funds.",
  },
  "/dao/delegates": {
    title: "DAO Delegates — HERO Voting Power | HERO Dapp",
    description: "Delegate your HERO voting power or become a delegate. Participate in governance without voting on every proposal.",
  },
  "/bots": {
    title: "ABLE Bots — Automated Trading on PulseChain | HERO Dapp",
    description: "ABLE automated trading bots for PulseChain. Arbitrage and market-making bots supporting the HERO ecosystem.",
  },
  "/start": {
    title: "Get Started — Onboarding Guide | HERO Dapp",
    description: "New to HERO Dapp? Follow our step-by-step onboarding guide to start trading on PulseChain and BASE.",
  },
  "/explainer": {
    title: "Explainer — How HERO Dapp Works | HERO Dapp",
    description: "Learn how HERO Dapp works. Video explainer covering the DEX aggregator, staking, DCA, limit orders, and the veteran mission.",
  },
};

export function usePageSEO() {
  const [location] = useLocation();

  useEffect(() => {
    const seo = PAGE_SEO_MAP[location];
    if (seo) {
      document.title = seo.title;
      const metaDesc = document.querySelector("meta[name=description]");
      if (metaDesc) metaDesc.setAttribute("content", seo.description);
      const ogTitle = document.querySelector("meta[property=\"og:title\"]");
      if (ogTitle) ogTitle.setAttribute("content", seo.title);
      const ogDesc = document.querySelector("meta[property=\"og:description\"]");
      if (ogDesc) ogDesc.setAttribute("content", seo.description);
      const ogUrl = document.querySelector("meta[property=\"og:url\"]");
      if (ogUrl) ogUrl.setAttribute("content", "https://herobase.io" + (location === "/" ? "" : location));
      const twTitle = document.querySelector("meta[name=\"twitter:title\"]");
      if (twTitle) twTitle.setAttribute("content", seo.title);
      const twDesc = document.querySelector("meta[name=\"twitter:description\"]");
      if (twDesc) twDesc.setAttribute("content", seo.description);
      const canonical = document.querySelector("link[rel=canonical]");
      if (canonical) canonical.setAttribute("href", "https://herobase.io" + (location === "/" ? "/" : location));
    }
  }, [location]);
}

export default usePageSEO;
