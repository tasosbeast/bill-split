import { StrictMode, Suspense, lazy } from "react";
import { initErrorTracking } from "./services/errorTracking";
import ErrorBoundary from "./components/ErrorBoundary";
import { createRoot } from "react-dom/client";
import "./index.css";

const App = lazy(() => import("./App.jsx"));

// Initialize error tracking (no-op if VITE_SENTRY_DSN not provided)
initErrorTracking();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="app-loading" aria-busy="true" aria-live="polite">
            Loading Bill Split…
          </div>
        }
      >
        <App />
      </Suspense>
    </ErrorBoundary>
  </StrictMode>
);
