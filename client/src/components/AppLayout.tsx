import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { NetworkSwitcher } from "./NetworkSwitcher";
import { WalletButton } from "./WalletButton";
import { ThemeToggle } from "./ThemeToggle";
import PriceTicker from "./PriceTicker";
import IntroOverlay from "./IntroOverlay";
import LanguageSelector from "./LanguageSelector";
import { useNetwork } from "../contexts/NetworkContext";
import { useLanguage } from "../contexts/LanguageContext";
import {
  ArrowLeftRight,
  BarChart3,
  Wallet,
  Clock,
  Target,
  Shield,
  Menu,
  X,
  LogOut,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Sprout,
  Newspaper,
  Bot,
  Sparkles,
  Infinity,
  Globe,
  ExternalLink,
  Gem,
  ImageIcon,
  Landmark,
  FileText,
  Users2,
  Wallet2,
  PlayCircle,
  Star,
  Coins,
  Layers,
  Flame, Palette, Vote, Gift, Award, Dices,
  Droplets,
  Search,
  Fuel,
  Compass,
  TrendingUp,
  Zap,
} from "lucide-react";

// CDN asset URLs
const HERO_LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/hero-logo-official_808c9ab8.png";
const HERO_BANNER_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/HerobannerUN_342fe48e.jpg";
const BLACKBEARD_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/BlackBeard_94de3f9d.jfif";
const KYC_BADGE_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/KYC-certificate-badge_4bce12b5.png";
const AUDIT_BADGE_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/audited-by-spywolf_8a337ccc.png";
const AUDIT_PDF_URL = "https://spywolf.co/audits/HERO_0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27(PULSE).pdf";
const KYC_PDF_URL = "https://spywolf.co/kyc-verification/KYC_Hero_0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8.pdf";

// Consolidated nav structure with collapsible groups
interface NavItem {
  path: string;
  label: string;
  icon: any;
  external?: string;
}

interface NavGroup {
  id: string;
  label: string;
  icon: any;
  items: NavItem[];
}

const NAV_TOP: NavItem[] = [
  { path: "/start", label: "🇺🇸 Start Here", icon: Star },
  { path: "/wallet", label: "Wallet", icon: Wallet },
  { path: "/swap", label: "Swap", icon: ArrowLeftRight },
  { path: "/dashboard", label: "Dashboard", icon: BarChart3 },
];

const NAV_GROUPS: NavGroup[] = [
  {
    id: "trade",
    label: "Trade",
    icon: TrendingUp,
    items: [
      { path: "/portfolio", label: "Portfolio", icon: Wallet },
      { path: "/dca", label: "DCA Orders", icon: Clock },
      { path: "/limits", label: "Limit Orders", icon: Target },
      { path: "/dex-analytics", label: "DEX Analytics", icon: Droplets },
      { path: "/liberty-swap", label: "Liberty Swap", icon: Globe, external: "https://libertyswap.finance/" },
    ],
  },
  {
    id: "earn",
    label: "Earn",
    icon: Coins,
    items: [
      { path: "/stake", label: "Stake (PulseChain)", icon: Sprout },
      { path: "/stake/base", label: "Stake (BASE)", icon: Layers },
      { path: "/stake/dai", label: "Stake HERO → DAI", icon: Coins },
      { path: "/bots", label: "ABLE Bots", icon: Bot },
      { path: "/holder-rewards", label: "Holder Rewards", icon: Award },
      { path: "/burn", label: "Buy & Burn", icon: Flame },
    ],
  },
  {
    id: "nft",
    label: "NFT & Collectibles",
    icon: Gem,
    items: [
      { path: "/nft", label: "NFT Collection", icon: Gem },
      { path: "/nft-mint", label: "NFT Mint", icon: Palette },
      { path: "/spin", label: "Spin Wheel", icon: Dices },
      { path: "/giveaways", label: "Giveaways", icon: Gift },
    ],
  },
  {
    id: "governance",
    label: "Governance",
    icon: Landmark,
    items: [
      { path: "/dao", label: "DAO Overview", icon: Landmark },
      { path: "/dao/proposals", label: "Proposals", icon: FileText },
      { path: "/dao/delegates", label: "Delegates", icon: Users2 },
      { path: "/dao/treasury", label: "Treasury", icon: Wallet2 },
      { path: "/dao-proposals", label: "Vote", icon: Vote },
    ],
  },
  {
    id: "learn",
    label: "Learn & Community",
    icon: ImageIcon,
    items: [
      { path: "/bootcamp", label: "Boot Camp", icon: Sprout },
      { path: "/explainer", label: "Explainer", icon: PlayCircle },
      { path: "/tokenomics", label: "Tokenomics", icon: Infinity },
      { path: "/media", label: "Media", icon: Newspaper },
      { path: "/community", label: "Community Hub", icon: ImageIcon },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    icon: Zap,
    items: [
      { path: "/ai", label: "AI Assistant", icon: Bot },
      { path: "/approvals", label: "Approvals", icon: Shield },
      { path: "/directory", label: "Ecosystem", icon: Compass },
    ],
  },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { chain } = useNetwork();
  const { t } = useLanguage();

  // Auto-expand group that contains the active route
  const activeGroup = NAV_GROUPS.find(g => g.items.some(i => location === i.path || location.startsWith(i.path + "/")));

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const isGroupExpanded = (groupId: string) => {
    return expandedGroups.has(groupId) || activeGroup?.id === groupId;
  };

  return (
    <>
      <IntroOverlay />
      <div className="flex min-h-screen bg-background">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          {/* Logo */}
          <div className="p-4 border-b border-sidebar-border">
            <Link href="/" className="flex items-center gap-3">
              <img
                src={HERO_LOGO_URL}
                alt="HERO Logo"
                className="w-12 h-12 rounded-full object-cover shadow-lg shadow-[var(--hero-orange)]/30 border-2 border-[var(--hero-orange)]/40"
              />
              <div>
                <h1 className="font-bold text-lg text-sidebar-foreground">HERO</h1>
                <p className="text-xs text-muted-foreground">{chain.name} DEX</p>
              </div>
            </Link>
            <button
              className="lg:hidden absolute top-4 right-4 text-muted-foreground hover:text-foreground"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Network Switcher */}
          <div className="px-3 py-3 border-b border-sidebar-border">
            <NetworkSwitcher />
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {/* Top-level items (always visible) */}
            {NAV_TOP.map((item) => {
              const isActive = location === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-[var(--hero-orange)]/10 text-[var(--hero-orange)] border border-[var(--hero-orange)]/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="w-4.5 h-4.5" />
                  {t(item.label)}
                </Link>
              );
            })}

            {/* Collapsible groups */}
            <div className="mt-2 pt-2 border-t border-sidebar-border/50 space-y-0.5">
              {NAV_GROUPS.map((group) => {
                const GroupIcon = group.icon;
                const isExpanded = isGroupExpanded(group.id);
                const hasActiveItem = group.items.some(i => location === i.path || location.startsWith(i.path + "/"));

                return (
                  <div key={group.id}>
                    {/* Group header (clickable to expand/collapse) */}
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        hasActiveItem
                          ? "text-[var(--hero-orange)]"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      }`}
                    >
                      <GroupIcon className="w-4 h-4" />
                      <span className="flex-1 text-left">{t(group.label)}</span>
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                      )}
                    </button>

                    {/* Group items (collapsible) */}
                    {isExpanded && (
                      <div className="ml-3 pl-3 border-l border-sidebar-border/30 space-y-0.5 mt-0.5 mb-1">
                        {group.items.map((item) => {
                          const isActive = location === item.path;
                          const Icon = item.icon;
                          const isExternal = !!item.external;

                          if (isExternal) {
                            return (
                              <a
                                key={item.path}
                                href={item.external}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                onClick={() => setSidebarOpen(false)}
                              >
                                <Icon className="w-3.5 h-3.5" />
                                {t(item.label)}
                                <ExternalLink className="w-2.5 h-2.5 ml-auto opacity-40" />
                              </a>
                            );
                          }

                          return (
                            <Link
                              key={item.path}
                              href={item.path}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                isActive
                                  ? "bg-[var(--hero-orange)]/10 text-[var(--hero-orange)] border border-[var(--hero-orange)]/20"
                                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                              }`}
                              onClick={() => setSidebarOpen(false)}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {t(item.label)}
                              {item.path === "/ai" && (
                                <Sparkles className="w-2.5 h-2.5 ml-auto text-hero-orange/50" />
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </nav>

          {/* User section */}
          <div className="p-3 border-t border-sidebar-border">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--hero-orange)] to-[var(--hero-green)] flex items-center justify-center text-foreground text-xs font-bold">
                  {user.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {user.name || "User"}
                  </p>
                </div>
                <button
                  onClick={() => logout()}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  title={t("Sign Out")}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <a href={getLoginUrl()}>
                <Button variant="outline" className="w-full border-[var(--hero-orange)]/30 text-[var(--hero-orange)] hover:bg-[var(--hero-orange)]/10">
                  Connect
                </Button>
              </a>
            )}
            {/* Audit badges */}
            <div className="flex items-center justify-center gap-3 mt-3 pt-3 border-t border-sidebar-border/50">
              <a href={AUDIT_PDF_URL} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 hover:opacity-80 transition-opacity">
                <img src={AUDIT_BADGE_URL} alt="Audited by SpyWolf" className="w-12 h-12" />
              </a>
              <a href={KYC_PDF_URL} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 hover:opacity-80 transition-opacity">
                <img src={KYC_BADGE_URL} alt="KYC Verified by SpyWolf" className="w-12 h-12" />
              </a>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col min-h-screen">
          {/* Top bar */}
          <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border/50">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <button
                  className="lg:hidden text-muted-foreground hover:text-foreground"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="w-5 h-5" />
                </button>
                <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronLeft className="w-4 h-4 inline mr-1" />
                  Home
                </Link>
              </div>
              <div className="flex items-center gap-2">
                <PriceTicker />
                <LanguageSelector />
                <ThemeToggle />
                <WalletButton />
              </div>
            </div>
          </header>
          {/* Page content */}
          <div className="flex-1 p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
