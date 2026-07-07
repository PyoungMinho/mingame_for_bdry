import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "tests/**/*.test.{ts,tsx}",
      "tests/**/*.spec.{ts,tsx}",
      "src/**/*.test.{ts,tsx}",
    ],
    // jsdom는 RTL 컴포넌트 파일별 환경 디렉티브로 전환
    coverage: {
      provider: "v8",
      include: ["src/lib/server/**", "src/lib/shared/**", "src/lib/api/**"],
      thresholds: { lines: 60, functions: 70, branches: 50 },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
