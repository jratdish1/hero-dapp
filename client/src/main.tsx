import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { useLocation } from "wouter";
import DappLoadBoundary, {
  createRootErrorHandlers,
} from "./components/DappLoadBoundary";
import { installAnalytics } from "./lib/analytics";
import LandingApp from "./LandingApp";
import "./index.css";
import "./security-recovery.css";

const DappBootstrap = lazy(() => import("./DappBootstrap"));

function DappLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        <span className="font-mono text-sm text-amber-500/70">
          Loading secure DApp...
        </span>
      </div>
    </div>
  );
}

function BootstrapRouter() {
  const [location] = useLocation();

  if (location === "/") {
    return <LandingApp />;
  }

  return (
    <DappLoadBoundary>
      <Suspense fallback={<DappLoader />}>
        <DappBootstrap />
      </Suspense>
    </DappLoadBoundary>
  );
}

installAnalytics();

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root application mount");

createRoot(root, createRootErrorHandlers()).render(<BootstrapRouter />);
