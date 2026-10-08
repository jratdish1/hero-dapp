import React, { Suspense } from "react";
import { usePageSEO } from "./hooks/usePageSEO";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { NetworkProvider } from "./contexts/NetworkContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import FloatingSocial from "./components/FloatingSocial";

// Critical path: Home loads eagerly (landing page)
import Home from "./pages/Home";
import NotFound from "@/pages/NotFound";
import { HERO_INCIDENT_MAINTENANCE } from "./lib/incident-flags";

// Lazy-loaded pages (code-split chunks loaded on demand)
const LoginPage = React.lazy(() => import("./pages/LoginPage"));
const Farm = React.lazy(() => import("./pages/Farm"));
const Swap = React.lazy(() => import("./pages/Swap"));
const Portfolio = React.lazy(() => import("./pages/Portfolio"));
const DcaOrders = React.lazy(() => import("./pages/DcaOrders"));
const LimitOrders = React.lazy(() => import("./pages/LimitOrders"));
const Approvals = React.lazy(() => import("./pages/ApprovalsEnhanced"));
const Stake = React.lazy(() => import("./pages/Stake"));
const Blog = React.lazy(() => import("./pages/Blog"));
const AiAssistant = React.lazy(() => import("./pages/AiAssistant"));
const Tokenomics = React.lazy(() => import("./pages/Tokenomics"));
const NftCollection = React.lazy(() => import("./pages/NftCollection"));
const Ecosystem = React.lazy(() => import("./pages/Subdomains"));
const MediaHub = React.lazy(() => import("./pages/MediaHub"));
const AppLayout = React.lazy(() => import("./components/AppLayout"));
const CommunityHub = React.lazy(() => import("./pages/CommunityHub"));
const Explainer = React.lazy(() => import("./pages/Explainer"));
const BaseStake = React.lazy(() => import("./pages/BaseStake"));
const HeroStake = React.lazy(() => import("./pages/HeroStake"));
const Onboarding = React.lazy(() => import("./pages/Onboarding"));
const ExplainerVideoModal = React.lazy(() => import("./components/ExplainerVideoModal"));
const BetaDisclaimer = React.lazy(() => import("./pages/BetaDisclaimer"));
const AbleBots = React.lazy(() => import("./pages/AbleBots"));
const EcosystemDirectory = React.lazy(() => import("./pages/EcosystemDirectory"));
const DexAnalytics = React.lazy(() => import("./pages/DexAnalytics"));
const BuyAndBurn = React.lazy(() => import("./pages/BuyAndBurn"));
const NFTMint = React.lazy(() => import("./pages/NFTMint"));
const DAOProposals = React.lazy(() => import("./pages/DAOProposals"));
const Giveaways = React.lazy(() => import("./pages/Giveaways"));
const HolderRewards = React.lazy(() => import("./pages/HolderRewards"));
const SpinWheel = React.lazy(() => import("./pages/SpinWheel"));
const HeroWallet = React.lazy(() => import("./pages/HeroWallet"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));

// Lazy-load DAO pages
const Proposals = React.lazy(() => import("./pages/dao").then(m => ({ default: m.Proposals })));
const ProposalDetail = React.lazy(() => import("./pages/dao").then(m => ({ default: m.ProposalDetail })));
const CreateProposal = React.lazy(() => import("./pages/dao").then(m => ({ default: m.CreateProposal })));
const Treasury = React.lazy(() => import("./pages/dao").then(m => ({ default: m.Treasury })));
const Delegates = React.lazy(() => import("./pages/dao").then(m => ({ default: m.Delegates })));
const DaoDashboard = React.lazy(() => import("./pages/dao").then(m => ({ default: m.DaoDashboard })));
const IncidentMaintenancePage = React.lazy(() => import("./components/IncidentMaintenancePage"));

// Incident kill-switch: while maintenance is on, every route that can start a
// wallet write, signature, or approval renders the maintenance page (titled
// with the paused feature) instead of the feature itself.
function paused(
  Page: React.LazyExoticComponent<React.ComponentType<any>>,
  feature: string,
): React.ComponentType<any> {
  if (!HERO_INCIDENT_MAINTENANCE) return Page;
  return function PausedFeature() {
    return <IncidentMaintenancePage feature={feature} />;
  };
}

// Loading fallback for lazy-loaded routes
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-black">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-amber-500/70 text-sm font-mono">Loading...</span>
      </div>
    </div>
  );
}

// Route wrapper with Suspense for lazy-loaded pages
function withLayout(Page: React.ComponentType<any>) {
  return function LayoutWrapped() {
    return (
      <Suspense fallback={<PageLoader />}>
        <AppLayout><Page /></AppLayout>
      </Suspense>
    );
  };
}

// Wrapper for lazy pages without layout
function withSuspense(Page: React.LazyExoticComponent<React.ComponentType<any>>) {
  return function SuspenseWrapped() {
    return (
      <Suspense fallback={<PageLoader />}>
        <Page />
      </Suspense>
    );
  };
}

function Router() {
  usePageSEO();
  return (
    <Switch>
      <Route path="/login" component={withSuspense(LoginPage)} />
      <Route path="/" component={Home} />
      {/* /swap stays reachable: it performs no in-app wallet write (external DEX handoff links only) and shows the incident banner. */}
      <Route path="/swap" component={withLayout(Swap)} />
      <Route path="/wallet" component={withLayout(paused(HeroWallet, "HERO Wallet"))} />
      <Route path="/portfolio" component={withLayout(Portfolio)} />
      <Route path="/dashboard" component={withLayout(Dashboard)} />
      <Route path="/dca" component={withLayout(paused(DcaOrders, "DCA Orders"))} />
      <Route path="/limits" component={withLayout(paused(LimitOrders, "Limit Orders"))} />
      <Route path="/approvals" component={withLayout(paused(Approvals, "Token Approvals"))} />
      <Route path="/bootcamp" component={withLayout(paused(Farm, "Boot Camp"))} />
      <Route path="/stake" component={withLayout(paused(Stake, "HERO Stake"))} />
      <Route path="/media" component={withLayout(MediaHub)} />
      <Route path="/ai" component={withLayout(AiAssistant)} />
      <Route path="/tokenomics" component={withLayout(Tokenomics)} />
      <Route path="/nft" component={withLayout(NftCollection)} />
      <Route path="/ecosystem" component={withLayout(Ecosystem)} />
      <Route path="/community" component={withLayout(Blog)} />
      <Route path="/community-hub" component={withLayout(CommunityHub)} />
      <Route path="/dao" component={withLayout(paused(DaoDashboard, "HERO Advisory Governance"))} />
      <Route path="/dao/proposals" component={withLayout(paused(Proposals, "DAO Proposals"))} />
      <Route path="/dao/proposals/create" component={withLayout(paused(CreateProposal, "Create DAO Proposal"))} />
      <Route path="/dao/proposals/:id" component={withLayout(paused(ProposalDetail, "DAO Proposal Voting"))} />
      <Route path="/dao/treasury" component={withLayout(paused(Treasury, "DAO Treasury"))} />
      <Route path="/dao/delegates" component={withLayout(paused(Delegates, "DAO Delegates"))} />
      <Route path="/stake/base" component={withLayout(paused(BaseStake, "HERO Stake (Base)"))} />
      <Route path="/stake/dai" component={withLayout(paused(HeroStake, "HERO Stake → DAI"))} />
      <Route path="/bots" component={withLayout(paused(AbleBots, "ABLE Bots"))} />
      <Route path="/start" component={withLayout(Onboarding)} />
      <Route path="/explainer" component={withLayout(Explainer)} />
      <Route path="/directory" component={withLayout(EcosystemDirectory)} />
      <Route path="/dex-analytics" component={withLayout(DexAnalytics)} />
      <Route path="/burn" component={withLayout(paused(BuyAndBurn, "Buy & Burn"))} />
      <Route path="/nft-mint" component={withLayout(paused(NFTMint, "HERO Cards NFT Mint"))} />
      <Route path="/dao-proposals" component={withLayout(paused(DAOProposals, "DAO Voting"))} />
      <Route path="/giveaways" component={withLayout(paused(Giveaways, "Giveaways"))} />
      <Route path="/holder-rewards" component={withLayout(paused(HolderRewards, "Holder Rewards"))} />
      <Route path="/spin" component={withLayout(paused(SpinWheel, "Spin the Wheel"))} />
      <Route path="/beta-disclaimer" component={withSuspense(BetaDisclaimer)} />
      <Route path="/disclaimer" component={withSuspense(BetaDisclaimer)} />
      {/* Redirect aliases for common URL variants */}
      <Route path="/stake-base"><Redirect to="/stake/base" /></Route>
      <Route path="/stake-dai"><Redirect to="/stake/dai" /></Route>
      <Route path="/nfts"><Redirect to="/nft" /></Route>
      <Route path="/farm"><Redirect to="/bootcamp" /></Route>
      <Route path="/dapp-farm"><Redirect to="/bootcamp" /></Route>
      <Route path="/ai-assistant"><Redirect to="/ai" /></Route>
      <Route path="/able-bots"><Redirect to="/bots" /></Route>
      <Route path="/liberty-swap"><Redirect to="/swap" /></Route>
      <Route path="/whitepaper"><ExternalRedirect url="https://docs.vicfoundation.com" /></Route>
      <Route path="/buy-and-burn"><Redirect to="/burn" /></Route>
      <Route path="/pools"><Redirect to="/dex-analytics" /></Route>
      <Route path="/stake/hero"><Redirect to="/stake/dai" /></Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Safe external redirect component with domain whitelist validation
const ALLOWED_REDIRECT_DOMAINS = ["docs.vicfoundation.com", "vicfoundation.com", "herobase.io"];
function ExternalRedirect({ url }: { url: string }) {
  React.useEffect(() => {
    try {
      const parsed = new URL(url);
      if (ALLOWED_REDIRECT_DOMAINS.includes(parsed.hostname)) {
        window.location.href = url;
      } else {
        console.error("[Security] Blocked redirect to untrusted domain:", parsed.hostname);
      }
    } catch {
      console.error("[Security] Invalid redirect URL:", url);
    }
  }, [url]);
  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <LanguageProvider>
          <NetworkProvider>
            <TooltipProvider>
              <Toaster />
              <Suspense fallback={null}>
                <ExplainerVideoModal />
              </Suspense>
              <FloatingSocial />
              <Router />
            </TooltipProvider>
          </NetworkProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
export default App;
