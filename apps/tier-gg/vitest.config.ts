import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.spec.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    environmentMatchGlobs: [
      ["tests/components/**", "happy-dom"],
    ],
    globals: true,
  },
});
