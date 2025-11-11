import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: "./dist/stats.html",
      open: false,
      gzipSize: true,
      brotliSize: true,
      template: "treemap", // or "sunburst", "network"
    }),
  ],
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
});
