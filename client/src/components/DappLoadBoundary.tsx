import React, {
  Component,
  createRef,
  type ReactNode,
} from "react";

interface DappLoadBoundaryProps {
  children: ReactNode;
}

interface DappLoadBoundaryState {
  hasError: boolean;
  error: Error;
}

interface DappRecoveryViewProps {
  error: Error;
}

export interface ReactErrorInfo {
  componentStack?: string | null;
}

type ErrorLogger = (...args: unknown[]) => void;

export interface ReactRootErrorHandlers {
  onCaughtError(error: unknown, errorInfo: ReactErrorInfo): void;
  onUncaughtError(error: unknown, errorInfo: ReactErrorInfo): void;
  onRecoverableError(error: unknown, errorInfo: ReactErrorInfo): void;
}

/** Normalize every JavaScript throw/rejection, including falsy non-Error values. */
export function normalizeThrownValue(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === "string") return new Error(value || "Empty string was thrown");

  let serialized = "";
  try {
    serialized = JSON.stringify(value);
  } catch {
    serialized = "[unserializable value]";
  }
  if (!serialized) serialized = String(value);
  return new Error(`Non-Error thrown value: ${serialized}`);
}

/**
 * Identifies browser errors commonly raised when a lazy JavaScript module
 * cannot be fetched. The wording deliberately does not assume a deployment:
 * offline clients, CDN failures, and policy blocks can produce the same text.
 */
export function isDappLoadFailure(error: unknown): boolean {
  return /chunkloaderror|loading chunk|dynamically imported module|importing a module script failed|failed to fetch/i.test(
    normalizeThrownValue(error).message,
  );
}

/**
 * React 19 logs caught errors at the root independently of component
 * boundaries. Production receives only a generic event; development preserves
 * the original value and component stack.
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

/**
 * Returns the exact callback object passed to createRoot. Keeping all three
 * callbacks in one tested factory prevents an unreviewed inline logger from
 * reintroducing production details.
 */
export function createRootErrorHandlers(
  isDevelopment = import.meta.env.DEV,
  logger: ErrorLogger = console.error,
): ReactRootErrorHandlers {
  const report = (error: unknown, errorInfo: ReactErrorInfo = {}) => {
    reportReactRuntimeError(error, errorInfo, isDevelopment, logger);
  };

  return {
    onCaughtError: report,
    onUncaughtError: report,
    onRecoverableError: report,
  };
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
            className="mt-4 text-2xl font-bold focus:outline focus:outline-2 focus:outline-offset-4 focus:outline-amber-400"
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
  state: DappLoadBoundaryState = {
    hasError: false,
    error: new Error("No DApp runtime error has been captured"),
  };

  static getDerivedStateFromError(error: unknown): DappLoadBoundaryState {
    return { hasError: true, error: normalizeThrownValue(error) };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return <DappRecoveryView error={this.state.error} />;
  }
}
