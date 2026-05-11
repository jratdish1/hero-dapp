import { usePageSEO } from "./hooks/usePageSEO";
import LoginPage from "./pages/LoginPage";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { NetworkProvider } from "./contexts/NetworkContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import Home from "./pages/Home";
import Farm from "./pages/Farm";
import Swap from "./pages/Swap";
import Dashboard from "./pages/Dashboard";
import Portfolio from "./pages/Portfolio";
import DcaOrders from "./pages/DcaOrders";
import LimitOrders from "./pages/LimitOrders";
import Approvals from "./pages/ApprovalsEnhanced";
import Stake from "./pages/Stake";
import Blog from "./pages/Blog";
import AiAssistant from "./pages/AiAssistant";
import Tokenomics from "./pages/Tokenomics";
import NftCollection from "./pages/NftCollection";
import Ecosystem from "./pages/Subdomains";
import MediaHub from "./pages/MediaHub";
import AppLayout from "./components/AppLayout";
import CommunityHub from "./pages/CommunityHub";
import { DaoDashboard, Proposals, ProposalDetail, CreateProposal, Treasury, Delegates } from "./pages/dao";
import Explainer from "./pages/Explainer";
import BaseStake from "./pages/BaseStake";
import HeroStake from "./pages/HeroStake";
import Onboarding from "./pages/Onboarding";
import ExplainerVideoModal from "./components/ExplainerVideoModal";
import BetaDisclaimer from "./pages/BetaDisclaimer";
import AbleBots from "./pages/AbleBots";
import FloatingSocial from "./components/FloatingSocial";
import EcosystemDirectory from "./pages/EcosystemDirectory";
import DexAnalytics from "./pages/DexAnalytics";
import BuyAndBurn from "./pages/BuyAndBurn";
import NFTMint from "./pages/NFTMint";
import DAOProposals from "./pages/DAOProposals";
import Giveaways from "./pages/Giveaways";
import HolderRewards from "./pages/HolderRewards";
import SpinWheel from "./pages/SpinWheel";
import HeroWallet from "./pages/HeroWallet";
// Route wrapper to avoid inline arrow functions (prevents unnecessary remounts)
function withLayout(Page: React.ComponentType) {
  return function LayoutWrapped() {
    return <AppLayout><Page /></AppLayout>;
  };
}
function Router() {
  usePageSEO();
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
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
      <Route path="/beta-disclaimer" component={BetaDisclaimer} />
      <Route path="/disclaimer" component={BetaDisclaimer} />
      {/* Redirect aliases for common URL variants */}
      <Route path="/stake-base">{() => <Redirect to="/stake/base" />}</Route>
      <Route path="/stake-dai">{() => <Redirect to="/stake/dai" />}</Route>
      <Route path="/nfts">{() => <Redirect to="/nft" />}</Route>
      <Route path="/farm">{() => <Redirect to="/bootcamp" />}</Route>
      <Route path="/dapp-farm">{() => <Redirect to="/bootcamp" />}</Route>
      <Route path="/ai-assistant">{() => <Redirect to="/ai" />}</Route>
      <Route path="/able-bots">{() => <Redirect to="/bots" />}</Route>
      <Route path="/liberty-swap">{() => <Redirect to="/swap" />}</Route>
      <Route path="/whitepaper">{() => <ExternalRedirect url="https://docs.vicfoundation.com" />}</Route>
      <Route path="/buy-and-burn">{() => <Redirect to="/burn" />}</Route>
      <Route path="/pools">{() => <Redirect to="/dex-analytics" />}</Route>
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
              <ExplainerVideoModal />
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
