import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { NetworkSwitcher } from "./NetworkSwitcher";
import { WalletButton } from "./WalletButton";
import { ThemeToggle } from "./ThemeToggle";
import PriceTicker from "./PriceTicker";
import { useNetwork } from "../contexts/NetworkContext";
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
} from "lucide-react";

// CDN asset URLs
const HERO_LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/hero-logo-official_808c9ab8.png";
const HERO_BANNER_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/HerobannerUN_342fe48e.jpg";
const BLACKBEARD_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/BlackBeard_94de3f9d.jfif";
const KYC_BADGE_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/KYC-certificate-badge_4bce12b5.png";

const NAV_ITEMS = [
  { path: "/swap", label: "Swap", icon: ArrowLeftRight },
  { path: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { path: "/portfolio", label: "Portfolio", icon: Wallet },
  { path: "/dca", label: "DCA Orders", icon: Clock },
  { path: "/limits", label: "Limit Orders", icon: Target },
  { path: "/farm", label: "Farm", icon: Sprout },
  { path: "/approvals", label: "Approvals", icon: Shield },
  { path: "/tokenomics", label: "Tokenomics", icon: Infinity },
  { path: "/nft", label: "NFT Collection", icon: Gem },
  { path: "/media", label: "Media", icon: Newspaper },
  { path: "/community", label: "Community Hub", icon: ImageIcon },
  { path: "/explainer", label: "Explainer", icon: PlayCircle },
  { path: "/ai", label: "AI Assistant", icon: Bot },
];

const DAO_NAV_ITEMS = [
  { path: "/dao", label: "DAO Overview", icon: Landmark },
  { path: "/dao/proposals", label: "Proposals", icon: FileText },
  { path: "/dao/delegates", label: "Delegates", icon: Users2 },
  { path: "/dao/treasury", label: "Treasury", icon: Wallet2 },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { chain } = useNetwork();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
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

        {/* Network Switcher in sidebar */}
        <div className="px-3 py-3 border-b border-sidebar-border">
          <NetworkSwitcher />
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.path;
            const Icon = item.icon;
            const isAi = item.path === "/ai";
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-[var(--hero-orange)]/10 text-[var(--hero-orange)] border border-[var(--hero-orange)]/20"
                    : isAi
                    ? "text-hero-orange/70 hover:text-hero-orange hover:bg-hero-orange/5 border border-transparent hover:border-hero-orange/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className="w-4.5 h-4.5" />
                {item.label}
                {isAi && (
                  <Sparkles className="w-3 h-3 ml-auto text-hero-orange/50" />
                )}
              </Link>
            );
          })}
          {/* DAO Section Divider */}
          <div className="mt-3 pt-3 border-t border-sidebar-border">
            <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Governance</p>
            {DAO_NAV_ITEMS.map((item) => {
              const isActive = location === item.path || (item.path === "/dao" && location.startsWith("/dao") && location !== "/dao/proposals" && location !== "/dao/delegates" && location !== "/dao/treasury");
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
                  {item.label}
                </Link>
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
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <a href={getLoginUrl()}>
              <Button variant="outline" className="w-full border-[var(--hero-orange)]/30 text-[var(--hero-orange)] hover:bg-[var(--hero-orange)]/10">
                Sign In
              </Button>
            </a>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* HERO UN Banner Header - shown across all app tabs */}
        <div className="w-full relative overflow-hidden" style={{maxHeight: '120px'}}>
          <img
            src={HERO_BANNER_URL}
            alt="HERO United Nations Banner"
            className="w-full object-cover object-center"
            style={{height: '120px'}}
          />
          {/* KYC Badge top-right */}
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 rounded-full px-2 py-1">
            <img src={KYC_BADGE_URL} alt="KYC Certified" className="w-8 h-8" />
            <span className="text-xs text-green-400 font-bold">KYC</span>
          </div>
        </div>
        {/* Price Ticker */}
        <PriceTicker />
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-14 bg-background/80 backdrop-blur-md border-b border-border flex items-center px-4 gap-3">
          <button
            className="lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-4 h-4 inline mr-1" />
            <span className="text-sm">Home</span>
          </Link>
          <div className="flex-1" />
          <div className="hidden sm:block">
            <NetworkSwitcher compact />
          </div>
          <ThemeToggle />
          <WalletButton />
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>

        {/* Blackbeard Footer Banner - shown across all app tabs */}
        <footer className="w-full mt-auto">
          {/* KYC Badge row above footer */}
          <div className="flex items-center justify-center gap-3 bg-black/80 py-2 border-t border-[var(--hero-orange)]/20">
            <img src={KYC_BADGE_URL} alt="KYC Certified" className="w-8 h-8" />
            <span className="text-xs text-green-400 font-semibold tracking-wider">KYC CERTIFIED — VETS IN CRYPTO PROTOCOL</span>
            <img src={KYC_BADGE_URL} alt="KYC Certified" className="w-8 h-8" />
          </div>
          {/* Blackbeard banner */}
          <div className="w-full relative overflow-hidden" style={{maxHeight: '100px'}}>
            <img
              src={BLACKBEARD_URL}
              alt="Black Bear Footer Banner"
              className="w-full object-cover object-top"
              style={{height: '100px', filter: 'brightness(0.85)'}}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white/80 text-xs font-bold tracking-widest uppercase">HERO Dapp — Built for Veterans, by Veterans</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
