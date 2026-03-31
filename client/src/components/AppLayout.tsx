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
} from "lucide-react";

const NAV_ITEMS = [
  { path: "/swap", label: "Swap", icon: ArrowLeftRight },
  { path: "/farm", label: "Farm", icon: Sprout },
  { path: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { path: "/portfolio", label: "Portfolio", icon: Wallet },
  { path: "/dca", label: "DCA Orders", icon: Clock },
  { path: "/limits", label: "Limit Orders", icon: Target },
  { path: "/approvals", label: "Approvals", icon: Shield },
  { path: "/tokenomics", label: "Tokenomics", icon: Infinity },
  { path: "/nft", label: "NFT Collection", icon: Gem },
  { path: "/media", label: "Media", icon: Newspaper },
  { path: "/community", label: "Community Hub", icon: ImageIcon },
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
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--hero-orange)] to-[var(--hero-green)] flex items-center justify-center shadow-lg shadow-[var(--hero-orange)]/20">
              <span className="text-foreground font-bold text-lg">H</span>
            </div>
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
      </div>
    </div>
  );
}
