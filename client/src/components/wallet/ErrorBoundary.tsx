import React, { Component, type ReactNode, type ErrorInfo } from "react";

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="p-6 text-center text-red-500">
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-gray-400">Please refresh the page or try again later.</p>
          <button onClick={() => this.setState({ hasError: false })} className="mt-4 px-4 py-2 bg-green-600 text-white rounded">
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
