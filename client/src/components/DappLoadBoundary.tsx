import React, {
  Component,
  createRef,
  type ReactNode,
} from "react";

interface DappLoadBoundaryProps {
  children: ReactNode;
}

interface DappLoadBoundaryState {
  error: Error | null;
}

interface DappRecoveryViewProps {
  error: Error;
}

interface ReactErrorInfo {
  componentStack?: string | null;
}

type ErrorLogger = (...args: unknown[]) => void;

/**
 * Identifies browser errors commonly raised when a lazy JavaScript module
 * cannot be fetched. The wording deliberately does not assume a deployment:
 * offline clients, CDN failures, and policy blocks can produce the same text.
 */
export function isDappLoadFailure(error: Error): boolean {
  return /chunkloaderror|loading chunk|dynamically imported module|importing a module script failed|failed to fetch/i.test(
    error.message,
  );
}

/**
 * React 19 logs caught errors at the root independently of component
 * boundaries. Override the root callbacks with this helper so production
 * consoles receive only a generic event while development retains detail.
 */
export function reportReactRuntimeError(
  error: unknown,
  errorInfo: ReactErrorInfo = {},
  isDevelopment = import.meta.env.DEV,
  logger: ErrorLogger = console.error,
): void {
  if (isDevelopment) {
    logger("[React runtime error]", {
      error,
      componentStack: errorInfo.componentStack,
    });
    return;
  }

  logger("[React runtime error]");
}

/** Shared recovery view for the bootstrap import and route-level lazy chunks. */
export class DappRecoveryView extends Component<DappRecoveryViewProps> {
  private readonly headingRef = createRef<HTMLHeadingElement>();

  componentDidMount() {
    this.headingRef.current?.focus();
  }

  render() {
    const moduleLoadFailure = isDappLoadFailure(this.props.error);

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
            {moduleLoadFailure
              ? "The secure DApp could not load."
              : "The secure DApp encountered an error."}
          </h1>
          <p
            id="dapp-recovery-description"
            role="alert"
            aria-live="assertive"
            className="mt-3 text-sm leading-6 text-zinc-300"
          >
            Reload to request the current application files. If you are offline
            or the service is temporarily unavailable, reconnect and try again.
            Before retrying any wallet action, confirm its status in your wallet
            or on the appropriate block explorer.
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

/**
 * Boundary around the initial dynamic DApp bootstrap. Route-level boundaries
 * reuse DappRecoveryView for later lazy chunk failures.
 */
export default class DappLoadBoundary extends Component<
  DappLoadBoundaryProps,
  DappLoadBoundaryState
> {
  state: DappLoadBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): DappLoadBoundaryState {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <DappRecoveryView error={this.state.error} />;
  }
}
