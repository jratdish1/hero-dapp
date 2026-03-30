import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Swap from "./pages/Swap";
import Dashboard from "./pages/Dashboard";
import Portfolio from "./pages/Portfolio";
import DcaOrders from "./pages/DcaOrders";
import LimitOrders from "./pages/LimitOrders";
import Approvals from "./pages/Approvals";
import AppLayout from "./components/AppLayout";

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
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
