import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import React, { Component, createRef, type ReactNode } from "react";
import {
  DappRecoveryView,
  isDappLoadFailure,
  normalizeThrownValue,
} from "./DappLoadBoundary";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error;
}

/**
 * Application-level boundary for route and render failures. Lazy route chunk
 * failures delegate to the same focused recovery view as the outer bootstrap
 * boundary so already-open tabs recover safely after releases or outages.
 */
export class ErrorBoundary extends Component<Props, State> {
  private readonly headingRef = createRef<HTMLHeadingElement>();

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: new Error("No application error has been captured"),
    };
  }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error: normalizeThrownValue(error) };
  }

  private focusHeading() {
    this.headingRef.current?.focus();
  }

  componentDidMount() {
    if (this.state.hasError) {
      this.focusHeading();
    }
  }

  componentDidUpdate(_previousProps: Props, previousState: State) {
    if (!previousState.hasError && this.state.hasError) {
      this.focusHeading();
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (isDappLoadFailure(this.state.error)) {
      return <DappRecoveryView error={this.state.error} />;
    }

    return (
      <main
        role="alert"
        aria-labelledby="application-error-title"
        className="flex min-h-screen items-center justify-center bg-background p-8"
      >
        <section className="flex w-full max-w-2xl flex-col items-center p-8 text-center">
          <AlertTriangle
            size={48}
            className="mb-6 flex-shrink-0 text-destructive"
          />

          <h1
            id="application-error-title"
            ref={this.headingRef}
            tabIndex={-1}
            className="vets-recovery-heading mb-4 rounded-sm text-xl focus:outline"
          >
            An unexpected application error occurred.
          </h1>

          <p className="mb-6 text-sm text-muted-foreground">
            Reload the page to retry. Before repeating any wallet action,
            confirm its status in your wallet or on the appropriate block
            explorer.
          </p>

          {import.meta.env.DEV && (
            <div className="mb-6 w-full overflow-auto rounded bg-muted p-4 text-left">
              <pre className="whitespace-break-spaces text-sm text-muted-foreground">
                {this.state.error.stack ?? this.state.error.message}
              </pre>
            </div>
          )}

          <button
            type="button"
            onClick={() => window.location.reload()}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2",
              "bg-primary text-primary-foreground",
              "hover:opacity-90",
            )}
          >
            <RotateCcw size={16} />
            Reload Page
          </button>
        </section>
      </main>
    );
  }
}

export default ErrorBoundary;
