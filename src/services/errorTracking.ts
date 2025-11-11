import * as Sentry from "@sentry/react";

interface InitOptions {
  dsn?: string;
  release?: string;
  environment?: string;
}

let initialized = false;

function safeEnvString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

export function initErrorTracking(options: InitOptions = {}): void {
  if (initialized) return;
  const dsn = options.dsn || safeEnvString(import.meta.env.VITE_SENTRY_DSN);
  if (!dsn) return; // no-op if not configured

  Sentry.init({
    dsn,
    release: options.release || safeEnvString(import.meta.env.VITE_APP_VERSION),
    environment: options.environment || safeEnvString(import.meta.env.MODE),
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 0.05,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 0.5,
    beforeSend(event) {
      // scrub potentially sensitive transaction/friend identifying info
      if (event.request && typeof event.request === "object") {
        const req = event.request as Sentry.Event["request"];
        if (req && "headers" in req) {
          (req as { headers?: unknown }).headers = undefined;
        }
      }
      if (event.user) {
        // avoid storing PII
        const user = event.user as Sentry.Event["user"];
        if (user) {
          if ("email" in user) delete (user as { email?: unknown }).email;
          if ("username" in user)
            delete (user as { username?: unknown }).username;
        }
      }
      // Remove breadcrumbs containing transaction payloads if mistakenly logged
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.filter((b) => {
          const data = b.data as unknown;
          if (!data || typeof data !== "object") return true;
          return !("transactions" in data);
        });
      }
      return event;
    },
  });
  initialized = true;
}

export function captureError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (!initialized) return;
  Sentry.captureException(error, { extra: context });
}

export function captureMessage(
  message: string,
  context?: Record<string, unknown>
): void {
  if (!initialized) return;
  Sentry.captureMessage(message, { level: "info", extra: context });
}
