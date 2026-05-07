/**
 * DiscoverTab — Embedded DApp browser for the HERO Wallet
 * Shows ecosystem DApps filtered by the currently selected chain.
 * Auto-switches when user toggles PulseChain/BASE via NetworkSwitcher.
 */
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search, Star, ExternalLink, Globe, ArrowLeftRight,
  BarChart3, Shield, Wallet, Image, Wrench, Users,
  Zap, ShoppingCart, Bot, Lock, Landmark, Coins, Layers,
  Compass,
} from "lucide-react";
import { toast } from "sonner";
import { useNetwork } from "../contexts/NetworkContext";
import { PULSECHAIN_ID } from "@shared/tokens";

interface EcosystemProject {
  id: string;
  name: string;
  description: string;
  url: string;
  category: string;
  chain: "pulsechain" | "base" | "both";
  featured?: boolean;
}

const PROJECTS: EcosystemProject[] = [
  // DEXs
  { id: "pulsex", name: "PulseX", description: "Largest PulseChain DEX — V1 + V2 AMM with deep liquidity", url: "https://pulsex.mypinata.cloud", category: "dex", chain: "pulsechain", featured: true },
  { id: "9mm", name: "9mm", description: "Uniswap V3-fork concentrated liquidity DEX", url: "https://9mm.pro", category: "dex", chain: "pulsechain" },
  { id: "9inch", name: "9inch", description: "V3 DEX with limit orders and advanced trading", url: "https://9inch.io", category: "dex", chain: "pulsechain" },
  { id: "phux", name: "PHUX", description: "Balancer-style weighted pool DEX", url: "https://phux.io", category: "dex", chain: "pulsechain" },
  { id: "aerodrome", name: "Aerodrome", description: "Leading BASE DEX — HERO/WETH pool available", url: "https://aerodrome.finance", category: "dex", chain: "base", featured: true },
  { id: "uniswap-base", name: "Uniswap (BASE)", description: "Uniswap V3 on BASE chain", url: "https://app.uniswap.org", category: "dex", chain: "base" },
  { id: "squirrelswap", name: "SquirrelSwap", description: "PulseChain Toolbox — aggregator, DCA, limits, portfolio & more", url: "https://squirrels.pro", category: "dex", chain: "pulsechain", featured: true },
  { id: "0xtide", name: "0xTide", description: "Balancer-fork DEX with dynamic fees", url: "https://0xtide.com", category: "dex", chain: "pulsechain" },
  { id: "dextop", name: "Dextop", description: "Uniswap V3-style DEX with privacy features", url: "https://dextop.pro", category: "dex", chain: "pulsechain" },
  { id: "curv", name: "CURV", description: "OTC swap + aggregator", url: "https://curv.fi", category: "dex", chain: "pulsechain" },
  // DeFi
  { id: "emitfarm", name: "Emit Farm", description: "HERO yield farming with LP staking rewards", url: "https://emit.farm", category: "defi", chain: "pulsechain", featured: true },
  { id: "rhinofi", name: "RhinoFi", description: "Cross-chain DeFi aggregator with HERO pairs", url: "https://rhino.fi", category: "defi", chain: "both" },
  { id: "trufarms", name: "TruFarms", description: "HERO/DAI farming pool on PulseChain", url: "https://trufarms.com", category: "defi", chain: "pulsechain" },
  { id: "hex", name: "HEX", description: "Certificate of deposit on PulseChain — stake and earn", url: "https://hex.com", category: "defi", chain: "pulsechain" },
  { id: "liquidloans", name: "Liquid Loans", description: "Decentralized borrowing protocol on PulseChain", url: "https://liquidloans.io", category: "defi", chain: "pulsechain" },
  { id: "sparkswap", name: "Spark Swap", description: "DeFi lending and borrowing on PulseChain", url: "https://sparkswap.xyz", category: "defi", chain: "pulsechain" },
  // Staking
  { id: "hero-stake", name: "HERO Staking", description: "Stake HERO tokens for rewards on PulseChain", url: "https://herobase.io/stake", category: "staking", chain: "pulsechain", featured: true },
  { id: "hero-base-stake", name: "HERO BASE Staking", description: "Stake HERO on BASE chain for rewards", url: "https://herobase.io/stake/base", category: "staking", chain: "base", featured: true },
  { id: "vouch", name: "Vouch", description: "LSD staking dashboard for PulseChain", url: "https://vouch.run", category: "staking", chain: "pulsechain" },
  // Analytics
  { id: "dexscreener", name: "DexScreener", description: "Multi-chain DEX analytics with HERO/VETS pairs", url: "https://dexscreener.com", category: "analytics", chain: "both", featured: true },
  { id: "geckoterminal", name: "GeckoTerminal", description: "Multi-chain DEX analytics by CoinGecko", url: "https://geckoterminal.com", category: "analytics", chain: "both" },
  { id: "pulsechaininfo", name: "PulseChain Info", description: "PulseX analytics dashboard", url: "https://info.pulsex.mypinata.cloud", category: "analytics", chain: "pulsechain" },
  { id: "pulsescan", name: "PulseScan", description: "PulseChain block explorer", url: "https://scan.pulsechain.com", category: "analytics", chain: "pulsechain" },
  { id: "basescan", name: "BaseScan", description: "BASE chain block explorer", url: "https://basescan.org", category: "analytics", chain: "base" },
  { id: "plscharts", name: "PlsCharts", description: "PulseChain token charts and analytics", url: "https://plscharts.com", category: "analytics", chain: "pulsechain" },
  { id: "hexpulse", name: "HEXPulse.info", description: "HEX and PulseChain stats", url: "https://hexpulse.info", category: "analytics", chain: "pulsechain" },
  { id: "plsfolio", name: "PLSFolio", description: "PulseChain portfolio tracker", url: "https://plsfolio.com", category: "analytics", chain: "pulsechain" },
  { id: "provex", name: "ProveX", description: "PulseChain market cap rankings", url: "https://provex.io", category: "analytics", chain: "pulsechain" },
  // Wallets
  { id: "rabby", name: "Rabby Wallet", description: "Multi-chain wallet with PulseChain + BASE support", url: "https://rabby.io", category: "wallets", chain: "both", featured: true },
  { id: "metamask", name: "MetaMask", description: "Most popular EVM wallet — add PulseChain RPC", url: "https://metamask.io", category: "wallets", chain: "both" },
  { id: "coinbase-wallet", name: "Coinbase Wallet", description: "Native BASE chain wallet support", url: "https://wallet.coinbase.com", category: "wallets", chain: "base" },
  { id: "tokenpocket", name: "TokenPocket", description: "Multi-chain mobile wallet", url: "https://tokenpocket.pro", category: "wallets", chain: "both" },
  // NFTs
  { id: "hero-nft", name: "HERO NFT Collection", description: "Official HERO NFT collection on PulseChain", url: "https://herobase.io/nft", category: "nft", chain: "pulsechain", featured: true },
  { id: "nftnutters", name: "NFT Nutters", description: "PulseChain NFT marketplace and tools", url: "https://nftnutters.com", category: "nft", chain: "pulsechain" },
  // Tools
  { id: "herobase", name: "HeroBase.io", description: "HERO/VETS ecosystem hub — swap, farm, stake, analytics", url: "https://herobase.io", category: "tools", chain: "both", featured: true },
  { id: "plstart", name: "PLStart.me", description: "PulseChain getting started guide", url: "https://plstart.me", category: "tools", chain: "pulsechain" },
  { id: "revoke-cash", name: "Revoke.cash", description: "Token approval checker and revoker", url: "https://revoke.cash", category: "tools", chain: "both" },
  // Bridges
  { id: "pulsechain-bridge", name: "PulseChain Bridge", description: "Official Ethereum ↔ PulseChain bridge", url: "https://bridge.pulsechain.com", category: "bridges", chain: "pulsechain" },
  { id: "base-bridge", name: "BASE Bridge", description: "Official Ethereum ↔ BASE bridge", url: "https://bridge.base.org", category: "bridges", chain: "base" },
  { id: "portalbridge", name: "Portal Bridge", description: "Cross-chain bridge supporting PulseChain", url: "https://portalbridge.com", category: "bridges", chain: "both" },
  // Community
  { id: "hero-telegram", name: "HERO Telegram", description: "Official HERO community Telegram group", url: "https://t.me/HeroTokenPulseChain", category: "community", chain: "both", featured: true },
  { id: "vets-telegram", name: "VETS Telegram", description: "Official VETS community Telegram group", url: "https://t.me/VETSToken", category: "community", chain: "both" },
  { id: "pulsetube", name: "The Pulse Tube", description: "PulseChain video content hub", url: "https://thepulsetube.com", category: "community", chain: "pulsechain" },
  // Security
  { id: "hero-approvals", name: "HERO Approval Manager", description: "View and revoke token approvals for HERO ecosystem", url: "https://herobase.io/approvals", category: "security", chain: "both", featured: true },
  // Bots
  { id: "able-bots", name: "ABLE Bots", description: "Automated HERO/VETS arbitrage and market-making bots", url: "https://herobase.io/bots", category: "bots", chain: "both", featured: true },
  { id: "bandox", name: "BandoX", description: "Telegram portfolio tracker bot", url: "https://t.me/BandoXBot", category: "bots", chain: "pulsechain" },
  // On/Off Ramps
  { id: "changeangel", name: "ChangeAngel", description: "Fiat on-ramp supporting PulseChain", url: "https://changeangel.io", category: "onramp", chain: "pulsechain" },
  { id: "coinbase", name: "Coinbase", description: "Major exchange with BASE chain support", url: "https://coinbase.com", category: "onramp", chain: "base" },
  // Privacy
  { id: "dextop-privacy", name: "Dextop Privacy", description: "Privacy-focused DEX features on PulseChain", url: "https://dextop.pro", category: "privacy", chain: "pulsechain" },
];

const CATEGORIES = [
  { id: "all", label: "All", icon: Globe },
  { id: "dex", label: "DEXs", icon: ArrowLeftRight },
  { id: "defi", label: "DeFi", icon: Coins },
  { id: "staking", label: "Staking", icon: Layers },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "wallets", label: "Wallets", icon: Wallet },
  { id: "nft", label: "NFTs", icon: Image },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "bridges", label: "Bridges", icon: Zap },
  { id: "community", label: "Community", icon: Users },
  { id: "security", label: "Security", icon: Shield },
  { id: "bots", label: "Bots", icon: Bot },
  { id: "privacy", label: "Privacy", icon: Lock },
  { id: "onramp", label: "On/Off Ramps", icon: Landmark },
];

function getFavoritesKey() { return "herobase_discover_favorites"; }

export default function DiscoverTab() {
  const { chainId, chain } = useNetwork();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(getFavoritesKey());
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  useEffect(() => {
    localStorage.setItem(getFavoritesKey(), JSON.stringify([...favorites]));
  }, [favorites]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); toast.info("Removed from favorites"); }
      else { next.add(id); toast.success("Added to favorites ⭐"); }
      return next;
    });
  };

  // Auto-filter by current chain from NetworkSwitcher
  const currentChainFilter = chainId === PULSECHAIN_ID ? "pulsechain" : "base";

  const filtered = useMemo(() => {
    return PROJECTS.filter(p => {
      if (showFavoritesOnly && !favorites.has(p.id)) return false;
      if (activeCategory !== "all" && p.category !== activeCategory) return false;
      // Auto-filter by selected chain (show "both" chain items always)
      if (p.chain !== currentChainFilter && p.chain !== "both") return false;
      if (search) {
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [search, activeCategory, currentChainFilter, favorites, showFavoritesOnly]);

  const featuredApps = useMemo(() => {
    return PROJECTS.filter(p => p.featured && (p.chain === currentChainFilter || p.chain === "both"));
  }, [currentChainFilter]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-[var(--hero-orange)]" />
            Discover DApps
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {filtered.length} apps on {chain.name} — auto-filtered by your active chain
          </p>
        </div>
        <Badge variant="outline" className="border-[var(--hero-orange)]/30 text-[var(--hero-orange)]">
          {chain.icon} {chain.shortName}
        </Badge>
      </div>

      {/* Featured Row */}
      {featuredApps.length > 0 && !search && activeCategory === "all" && !showFavoritesOnly && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-yellow-400" />
            Featured
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {featuredApps.slice(0, 8).map(app => (
              <a
                key={app.id}
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2 p-2.5 rounded-lg bg-gradient-to-r from-[var(--hero-orange)]/5 to-transparent border border-[var(--hero-orange)]/20 hover:border-[var(--hero-orange)]/40 transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-[var(--hero-orange)]/10 flex items-center justify-center text-[var(--hero-orange)] text-sm font-bold shrink-0">
                  {app.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white truncate group-hover:text-[var(--hero-orange)] transition-colors">{app.name}</p>
                  <p className="text-[10px] text-gray-500 truncate">{app.category}</p>
                </div>
                <ExternalLink className="w-3 h-3 text-gray-600 group-hover:text-[var(--hero-orange)] transition-colors shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search DApps..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--hero-orange)]/50 text-sm"
          />
        </div>
        <Button
          variant={showFavoritesOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={showFavoritesOnly ? "bg-yellow-500 text-black hover:bg-yellow-600" : "border-gray-700 text-gray-300"}
        >
          <Star className="w-3.5 h-3.5 mr-1" />
          Favorites
        </Button>
      </div>

      {/* Category pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? "bg-[var(--hero-orange)] text-white shadow-sm"
                  : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
              }`}
            >
              <Icon className="w-3 h-3" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* DApp Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-8">
          <Globe className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No DApps found for this filter</p>
          <p className="text-gray-600 text-xs mt-1">Try switching chains or clearing filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filtered.map(app => (
            <div
              key={app.id}
              className="group flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:border-gray-600 transition-all"
            >
              {/* App icon */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-white font-bold text-sm shrink-0 border border-gray-600/50">
                {app.name.charAt(0)}
              </div>
              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-white truncate">{app.name}</p>
                  {app.featured && (
                    <Star className="w-3 h-3 text-yellow-400 shrink-0 fill-yellow-400" />
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate">{app.description}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-gray-600 text-gray-400">
                    {app.category}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-gray-600 text-gray-400">
                    {app.chain === "both" ? "Multi" : app.chain === "pulsechain" ? "PLS" : "BASE"}
                  </Badge>
                </div>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={(e) => { e.preventDefault(); toggleFavorite(app.id); }}
                  className={`p-1.5 rounded-lg transition-all ${
                    favorites.has(app.id)
                      ? "text-yellow-400 bg-yellow-400/10"
                      : "text-gray-600 hover:text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${favorites.has(app.id) ? "fill-yellow-400" : ""}`} />
                </button>
                <a
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-gray-500 hover:text-[var(--hero-orange)] hover:bg-[var(--hero-orange)]/10 transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <p className="text-[10px] text-gray-600 text-center pt-2">
        {PROJECTS.length} total DApps • Auto-filtered to {chain.name} • Toggle chain in sidebar to switch
      </p>
    </div>
  );
}
