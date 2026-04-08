import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { NetworkProvider } from "./contexts/NetworkContext";
import Home from "./pages/Home";
import Swap from "./pages/Swap";
import Dashboard from "./pages/Dashboard";
import Portfolio from "./pages/Portfolio";
import DcaOrders from "./pages/DcaOrders";
import LimitOrders from "./pages/LimitOrders";
import Approvals from "./pages/Approvals";
import Farm from "./pages/Farm";
import Blog from "./pages/Blog";
import AiAssistant from "./pages/AiAssistant";
import Tokenomics from "./pages/Tokenomics";
import NftCollection from "./pages/NftCollection";
import Ecosystem from "./pages/Subdomains";
import MediaHub from "./pages/MediaHub";
import AppLayout from "./components/AppLayout";
import { DaoDashboard, Proposals, ProposalDetail, CreateProposal, Treasury, Delegates } from "./pages/dao";
import Explainer from "./pages/Explainer";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/swap" component={() => <AppLayout><Swap /></AppLayout>} />
      <Route path="/dashboard" component={() => <AppLayout><Dashboard /></AppLayout>} />
      <Route path="/portfolio" component={() => <AppLayout><Portfolio /></AppLayout>} />
      <Route path="/dca" component={() => <AppLayout><DcaOrders /></AppLayout>} />
      <Route path="/limits" component={() => <AppLayout><LimitOrders /></AppLayout>} />
      <Route path="/approvals" component={() => <AppLayout><Approvals /></AppLayout>} />
      <Route path="/farm" component={() => <AppLayout><Farm /></AppLayout>} />
      <Route path="/media" component={() => <AppLayout><Blog /></AppLayout>} />
      <Route path="/ai" component={() => <AppLayout><AiAssistant /></AppLayout>} />
      <Route path="/tokenomics" component={() => <AppLayout><Tokenomics /></AppLayout>} />
      <Route path="/nft" component={() => <AppLayout><NftCollection /></AppLayout>} />
      <Route path="/ecosystem" component={() => <AppLayout><Ecosystem /></AppLayout>} />
      <Route path="/community" component={() => <AppLayout><MediaHub /></AppLayout>} />
      <Route path="/dao" component={() => <AppLayout><DaoDashboard /></AppLayout>} />
      <Route path="/dao/proposals" component={() => <AppLayout><Proposals /></AppLayout>} />
      <Route path="/dao/proposals/create" component={() => <AppLayout><CreateProposal /></AppLayout>} />
      <Route path="/dao/proposals/:id" component={() => <AppLayout><ProposalDetail /></AppLayout>} />
      <Route path="/dao/treasury" component={() => <AppLayout><Treasury /></AppLayout>} />
      <Route path="/dao/delegates" component={() => <AppLayout><Delegates /></AppLayout>} />
      <Route path="/explainer" component={() => <AppLayout><Explainer /></AppLayout>} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <NetworkProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </NetworkProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
