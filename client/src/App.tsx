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

// Lazy-loaded pages (code-split chunks loaded on demand)
const LoginPage = React.lazy(() => import("./pages/LoginPage"));
const Farm = React.lazy(() => import("./pages/Farm"));
const Swap = React.lazy(() => import("./pages/Swap"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
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

// Lazy-load DAO pages
const DaoDashboard = React.lazy(() => import("./pages/dao").then(m => ({ default: m.DaoDashboard })));
const Proposals = React.lazy(() => import("./pages/dao").then(m => ({ default: m.Proposals })));
const ProposalDetail = React.lazy(() => import("./pages/dao").then(m => ({ default: m.ProposalDetail })));
const CreateProposal = React.lazy(() => import("./pages/dao").then(m => ({ default: m.CreateProposal })));
const Treasury = React.lazy(() => import("./pages/dao").then(m => ({ default: m.Treasury })));
const Delegates = React.lazy(() => import("./pages/dao").then(m => ({ default: m.Delegates })));

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
function withLayout(Page: React.LazyExoticComponent<React.ComponentType<any>>) {
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
      <Route path="/swap" component={withLayout(Swap)} />
      <Route path="/wallet" component={withLayout(HeroWallet)} />
      <Route path="/dashboard" component={withLayout(Dashboard)} />
      <Route path="/portfolio" component={withLayout(Portfolio)} />
      <Route path="/dca" component={withLayout(DcaOrders)} />
      <Route path="/limits" component={withLayout(LimitOrders)} />
      <Route path="/approvals" component={withLayout(Approvals)} />
      <Route path="/bootcamp" component={withLayout(Farm)} />
      <Route path="/stake" component={withLayout(Stake)} />
      <Route path="/media" component={withLayout(MediaHub)} />
      <Route path="/ai" component={withLayout(AiAssistant)} />
      <Route path="/tokenomics" component={withLayout(Tokenomics)} />
      <Route path="/nft" component={withLayout(NftCollection)} />
      <Route path="/ecosystem" component={withLayout(Ecosystem)} />
      <Route path="/community" component={withLayout(Blog)} />
      <Route path="/community-hub" component={withLayout(CommunityHub)} />
      <Route path="/dao" component={withLayout(DaoDashboard)} />
      <Route path="/dao/proposals" component={withLayout(Proposals)} />
      <Route path="/dao/proposals/create" component={withLayout(CreateProposal)} />
      <Route path="/dao/proposals/:id" component={withLayout(ProposalDetail)} />
      <Route path="/dao/treasury" component={withLayout(Treasury)} />
      <Route path="/dao/delegates" component={withLayout(Delegates)} />
      <Route path="/stake/base" component={withLayout(BaseStake)} />
      <Route path="/stake/dai" component={withLayout(HeroStake)} />
      <Route path="/bots" component={withLayout(AbleBots)} />
      <Route path="/start" component={withLayout(Onboarding)} />
      <Route path="/explainer" component={withLayout(Explainer)} />
      <Route path="/directory" component={withLayout(EcosystemDirectory)} />
      <Route path="/dex-analytics" component={withLayout(DexAnalytics)} />
      <Route path="/burn" component={withLayout(BuyAndBurn)} />
      <Route path="/nft-mint" component={withLayout(NFTMint)} />
      <Route path="/dao-proposals" component={withLayout(DAOProposals)} />
      <Route path="/giveaways" component={withLayout(Giveaways)} />
      <Route path="/holder-rewards" component={withLayout(HolderRewards)} />
      <Route path="/spin" component={withLayout(SpinWheel)} />
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
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Safe external redirect component (avoids side effects during render)
function ExternalRedirect({ url }: { url: string }) {
  React.useEffect(() => { window.location.href = url; }, [url]);
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
