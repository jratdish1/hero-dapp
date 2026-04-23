/**
 * Ecosystem Directory — PulseChain + BASE project directory
 * Searchable, categorized, with favorites (localStorage).
 * Inspired by squirrels.pro but tailored for HERO/VETS ecosystem.
 */
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search, Star, ExternalLink, Globe, ArrowLeftRight,
  BarChart3, Shield, Wallet, Image, Wrench, Users,
  Zap, ShoppingCart, Bot, Lock, Landmark, Coins, Layers,
} from "lucide-react";
import { toast } from "sonner";

interface EcosystemProject {
  id: string;
  name: string;
  description: string;
  url: string;
  category: string;
  chain: "pulsechain" | "base" | "both";
  tags?: string[];
  featured?: boolean;
}

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
  { id: "shopping", label: "Shopping", icon: ShoppingCart },
];

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

function getFavoritesKey() { return "herobase_ecosystem_favorites"; }

export default function EcosystemDirectory() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [chainFilter, setChainFilter] = useState<"all" | "pulsechain" | "base">("all");
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(getFavoritesKey());
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  useEffect(() => {
    localStorage.setItem(getFavoritesKey(), JSON.stringify([...favorites]));
  }, [favorites]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); toast.info("Removed from favorites"); }
      else { next.add(id); toast.success("Added to favorites"); }
      return next;
    });
  };

  const filtered = useMemo(() => {
    return PROJECTS.filter(p => {
      if (showFavoritesOnly && !favorites.has(p.id)) return false;
      if (activeCategory !== "all" && p.category !== activeCategory) return false;
      if (chainFilter !== "all" && p.chain !== chainFilter && p.chain !== "both") return false;
      if (search) {
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [search, activeCategory, chainFilter, favorites, showFavoritesOnly]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: PROJECTS.length };
    PROJECTS.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
    return counts;
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Globe className="w-6 h-6 text-[var(--hero-orange)]" />
          Ecosystem Directory
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {PROJECTS.length} projects across PulseChain &amp; BASE — the HERO/VETS ecosystem at your fingertips
        </p>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--hero-orange)]/50"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "pulsechain", "base"] as const).map(chain => (
            <Button
              key={chain}
              variant={chainFilter === chain ? "default" : "outline"}
              size="sm"
              onClick={() => setChainFilter(chain)}
              className={chainFilter === chain ? "bg-[var(--hero-orange)] text-white" : ""}
            >
              {chain === "all" ? "All Chains" : chain === "pulsechain" ? "PulseChain" : "BASE"}
            </Button>
          ))}
          <Button
            variant={showFavoritesOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={showFavoritesOnly ? "bg-yellow-500 text-black" : ""}
          >
            <Star className="w-4 h-4 mr-1" />
            {favorites.size}
          </Button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const count = categoryCounts[cat.id] || 0;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? "bg-[var(--hero-orange)] text-white shadow-md"
                  : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.label}
              <span className={`ml-0.5 ${isActive ? "text-white/80" : "text-muted-foreground/60"}`}>
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Project Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(project => (
          <Card
            key={project.id}
            className={`bg-card border-border hover:border-[var(--hero-orange)]/40 transition-all group ${
              project.featured ? "ring-1 ring-[var(--hero-orange)]/20" : ""
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-[var(--hero-orange)]">
                      {project.name.charAt(0)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground truncate">{project.name}</h3>
                    <div className="flex items-center gap-1">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1 py-0 ${
                          project.chain === "pulsechain"
                            ? "border-purple-500/30 text-purple-400"
                            : project.chain === "base"
                            ? "border-blue-500/30 text-blue-400"
                            : "border-green-500/30 text-green-400"
                        }`}
                      >
                        {project.chain === "both" ? "Multi" : project.chain === "pulsechain" ? "PLS" : "BASE"}
                      </Badge>
                      {project.featured && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 border-[var(--hero-orange)]/30 text-[var(--hero-orange)]">
                          Featured
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => toggleFavorite(project.id)}
                  className="p-1 rounded hover:bg-secondary transition-colors"
                  title={favorites.has(project.id) ? "Remove from favorites" : "Add to favorites"}
                >
                  <Star
                    className={`w-4 h-4 ${
                      favorites.has(project.id) ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"
                    }`}
                  />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                {project.description}
              </p>
              <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[var(--hero-orange)] hover:underline"
              >
                Visit <ExternalLink className="w-3 h-3" />
              </a>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Globe className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No projects found matching your filters</p>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border">
        Know a project that should be listed? Join our{" "}
        <a href="https://t.me/HeroTokenPulseChain" target="_blank" rel="noopener noreferrer" className="text-[var(--hero-orange)] hover:underline">
          Telegram
        </a>{" "}
        and let us know!
      </div>
    </div>
  );
}
