import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Tests laufen im Mock-Modus: @backend-impl → mock.ts. Komponenten-Tests
// mocken zusätzlich src/api/ direkt via vi.mock.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@backend-impl": resolve(__dirname, "src/api/mock.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
