import { Component, type ReactNode } from "react";
import * as Sentry from "@sentry/react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Capture with Sentry if initialized
    Sentry.captureException(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="error-fallback" role="alert" aria-live="assertive">
            Something went wrong. Please reload.
          </div>
        )
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
