import ErrorBoundary from "./components/ErrorBoundary";
import FloatingSocial from "./components/FloatingSocial";
import { ThemeProvider } from "./contexts/ThemeContext";
import { usePageSEO } from "./hooks/usePageSEO";
import Home from "./pages/Home";

/**
 * Lightweight public bootstrap for the unauthenticated landing page.
 *
 * Keep wallet, RPC, tRPC, and query-client providers out of this module so the
 * public homepage can render without downloading the full DApp runtime.
 */
export default function LandingApp() {
  usePageSEO();

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <FloatingSocial />
        <Home />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
