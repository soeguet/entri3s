import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { resolve } from "node:path";

// `mode === 'mock'` swaps the backend implementation to fixtures (browser dev),
// otherwise the real Electrobun RPC bridge is used.
// React Compiler läuft als Babel-Preset (React 19).
export default defineConfig(({ mode }) => ({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  root: __dirname,
  resolve: {
    alias: {
      "@backend-impl": resolve(__dirname, mode === "mock" ? "src/api/mock.ts" : "src/api/real.ts"),
    },
  },
  build: {
    outDir: resolve(__dirname, "../../../dist"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
}));
