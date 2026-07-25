import {
  Component,
  createRef,
  type ErrorInfo,
  type ReactNode,
} from "react";

interface DappLoadBoundaryProps {
  children: ReactNode;
}

interface DappLoadBoundaryState {
  error: Error | null;
}

/**
 * Identifies the common browser errors raised when a previously opened page
 * requests a hashed JavaScript chunk that no longer exists after deployment.
 */
export function isDappLoadFailure(error: Error): boolean {
  return /chunkloaderror|loading chunk|dynamically imported module|importing a module script failed|failed to fetch/i.test(
    error.message,
  );
}

/**
 * The full DApp is lazy-loaded outside App's internal error boundary. This
 * boundary prevents a rejected dynamic import from leaving a blank root and
 * gives visitors an explicit reload or public-home recovery path.
 */
export default class DappLoadBoundary extends Component<
  DappLoadBoundaryProps,
  DappLoadBoundaryState
> {
  state: DappLoadBoundaryState = { error: null };
  private readonly headingRef = createRef<HTMLHeadingElement>();

  static getDerivedStateFromError(error: Error): DappLoadBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("[DApp bootstrap load failure]", {
        name: error.name,
        message: error.message,
        componentStack: errorInfo.componentStack,
      });
      return;
    }

    // Do not expose provider endpoints, error messages, or component internals
    // in production visitor consoles.
    console.error("[DApp bootstrap load failure]");
  }

  componentDidUpdate(
    _previousProps: DappLoadBoundaryProps,
    previousState: DappLoadBoundaryState,
  ) {
    if (!previousState.error && this.state.error) {
      this.headingRef.current?.focus();
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    const staleChunk = isDappLoadFailure(this.state.error);
    return (
      <main
        aria-labelledby="dapp-recovery-title"
        aria-describedby="dapp-recovery-description"
        className="flex min-h-screen items-center justify-center bg-black px-6 text-white"
      >
        <section className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-zinc-950 p-8 text-center shadow-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-500">
            HERO DApp recovery
          </p>
          <h1
            id="dapp-recovery-title"
            ref={this.headingRef}
            tabIndex={-1}
            className="mt-4 text-2xl font-bold focus:outline-none"
          >
            {staleChunk
              ? "A fresh application version is ready."
              : "The secure DApp did not load."}
          </h1>
          <p
            id="dapp-recovery-description"
            role="alert"
            aria-live="assertive"
            className="mt-3 text-sm leading-6 text-zinc-300"
          >
            Reload to fetch the current verified application files. Before
            retrying any wallet action, confirm its status in your wallet or on
            the appropriate block explorer.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-amber-500 px-5 py-3 font-semibold text-black hover:bg-amber-400"
            >
              Reload secure DApp
            </button>
            <a
              href="/"
              className="rounded-lg border border-zinc-700 px-5 py-3 font-semibold text-zinc-200 hover:border-zinc-500"
            >
              Return to public home
            </a>
          </div>
        </section>
      </main>
    );
  }
}
