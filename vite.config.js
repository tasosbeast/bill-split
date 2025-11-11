import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// https://vite.dev/config/
export default defineConfig(() => {
  const plugins = [
    react(),
    visualizer({
      filename: "./dist/stats.html",
      open: false,
      gzipSize: true,
      brotliSize: true,
      template: "treemap", // or "sunburst", "network"
    }),
  ];

  // Conditionally enable Sentry source map upload if env is configured
  // Access Node env safely for plugin configuration without assuming globals
  // Read env vars via import.meta.env for Vite (Sentry CLI vars still read from real env when running build)
  /* eslint-disable no-undef */
  const SENTRY_AUTH_TOKEN = process?.env?.SENTRY_AUTH_TOKEN;
  const SENTRY_ORG = process?.env?.SENTRY_ORG;
  const SENTRY_PROJECT = process?.env?.SENTRY_PROJECT;
  const SENTRY_RELEASE = process?.env?.SENTRY_RELEASE;
  /* eslint-enable no-undef */
  const hasSentry = Boolean(SENTRY_AUTH_TOKEN && SENTRY_ORG && SENTRY_PROJECT);
  if (hasSentry) {
    plugins.push(
      sentryVitePlugin({
        org: SENTRY_ORG,
        project: SENTRY_PROJECT,
        authToken: SENTRY_AUTH_TOKEN,
        release: SENTRY_RELEASE,
        telemetry: false,
        include: "./dist",
        sourcemaps: {
          assets: "./dist/assets/**",
        },
      })
    );
  }

  return {
    plugins,
    test: {
      environment: "jsdom",
    },
    build: {
      sourcemap: "hidden", // Generate source maps but don't reference them in built files
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes("node_modules/react") ||
              id.includes("node_modules/react-dom") ||
              id.includes("node_modules/scheduler")
            ) {
              return "react";
            }
            if (id.includes("src/lib/transactions")) {
              return "transactions";
            }
          },
        },
      },
    },
  };
});

