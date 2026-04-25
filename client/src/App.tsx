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
function Router() {
  usePageSEO();
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/" component={Home} />
      <Route path="/swap" component={() => <AppLayout><Swap /></AppLayout>} />
      <Route path="/dashboard" component={() => <AppLayout><Dashboard /></AppLayout>} />
      <Route path="/portfolio" component={() => <AppLayout><Portfolio /></AppLayout>} />
      <Route path="/dca" component={() => <AppLayout><DcaOrders /></AppLayout>} />
      <Route path="/limits" component={() => <AppLayout><LimitOrders /></AppLayout>} />
      <Route path="/approvals" component={() => <AppLayout><Approvals /></AppLayout>} />
      <Route path="/bootcamp" component={() => <AppLayout><Farm /></AppLayout>} />
      <Route path="/stake" component={() => <AppLayout><Stake /></AppLayout>} />
      <Route path="/media" component={() => <AppLayout><MediaHub /></AppLayout>} />
      <Route path="/ai" component={() => <AppLayout><AiAssistant /></AppLayout>} />
      <Route path="/tokenomics" component={() => <AppLayout><Tokenomics /></AppLayout>} />
      <Route path="/nft" component={() => <AppLayout><NftCollection /></AppLayout>} />
      <Route path="/ecosystem" component={() => <AppLayout><Ecosystem /></AppLayout>} />
      <Route path="/community" component={() => <AppLayout><Blog /></AppLayout>} />
      <Route path="/dao" component={() => <AppLayout><DaoDashboard /></AppLayout>} />
      <Route path="/dao/proposals" component={() => <AppLayout><Proposals /></AppLayout>} />
      <Route path="/dao/proposals/create" component={() => <AppLayout><CreateProposal /></AppLayout>} />
      <Route path="/dao/proposals/:id" component={() => <AppLayout><ProposalDetail /></AppLayout>} />
      <Route path="/dao/treasury" component={() => <AppLayout><Treasury /></AppLayout>} />
      <Route path="/dao/delegates" component={() => <AppLayout><Delegates /></AppLayout>} />
      <Route path="/stake/base" component={() => <AppLayout><BaseStake /></AppLayout>} />
      <Route path="/stake/dai" component={() => <AppLayout><HeroStake /></AppLayout>} />
      <Route path="/bots" component={() => <AppLayout><AbleBots /></AppLayout>} />
      <Route path="/start" component={() => <AppLayout><Onboarding /></AppLayout>} />
      <Route path="/explainer" component={() => <AppLayout><Explainer /></AppLayout>} />
      <Route path="/directory" component={() => <AppLayout><EcosystemDirectory /></AppLayout>} />
      <Route path="/dex-analytics" component={() => <AppLayout><DexAnalytics /></AppLayout>} />
      <Route path="/burn" component={() => <AppLayout><BuyAndBurn /></AppLayout>} />
      <Route path="/nft-mint" component={() => <AppLayout><NFTMint /></AppLayout>} />
      <Route path="/dao-proposals" component={() => <AppLayout><DAOProposals /></AppLayout>} />
      <Route path="/giveaways" component={() => <AppLayout><Giveaways /></AppLayout>} />
      <Route path="/holder-rewards" component={() => <AppLayout><HolderRewards /></AppLayout>} />
      <Route path="/spin" component={() => <AppLayout><SpinWheel /></AppLayout>} />
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
      <Route path="/whitepaper">{() => { window.location.href = "https://docs.vicfoundation.com"; return null; }}</Route>
      <Route path="/buy-and-burn">{() => <Redirect to="/burn" />}</Route>
      <Route path="/pools">{() => <Redirect to="/dex-analytics" />}</Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
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
