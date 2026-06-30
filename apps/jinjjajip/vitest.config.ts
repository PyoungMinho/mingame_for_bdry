import { defineConfig, type UserConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// vite(6) 와 vitest 내부 vite(5) 의 Plugin 타입이 중복 설치로 구조적 비호환.
// 런타임은 정상(테스트 통과). npm install 재실행 없이 타입만 해소.
// vitest/config 가 재노출하는 UserConfig 에서 plugin 요소 타입을 끌어와 버전 정합을 맞춘다.
type VitestPlugin = NonNullable<UserConfig["plugins"]>[number];
const reactPlugin = react() as unknown as VitestPlugin;

export default defineConfig({
  plugins: [reactPlugin],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
  },
});
