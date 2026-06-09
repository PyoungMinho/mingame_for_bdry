import { beforeEach, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// jsdom 폴리필 — matchMedia, ResizeObserver, DOMRect (레이아웃 측정 컴포넌트 대비)
if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
  if (typeof (globalThis as { ResizeObserver?: unknown }).ResizeObserver === "undefined") {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
  }
  if (typeof (globalThis as { DOMRect?: unknown }).DOMRect === "undefined") {
    (globalThis as { DOMRect?: unknown }).DOMRect = class {
      static fromRect() {
        return new DOMRect();
      }
    };
  }
}

// KST + 환경변수 고정 — 테스트 결정론
beforeEach(() => {
  process.env.APP_TIMEZONE = "Asia/Seoul";
  process.env.AI_BUDGET_KRW_MONTHLY = "200";
  process.env.SCORE_FORMULA_VERSION = "v1.0.0";
  process.env.COACH_FREE_TRIAL_DAYS = "3";
  process.env.UPSTASH_REDIS_REST_URL = "https://test-redis.local";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  process.env.SUPABASE_URL = "https://test.supabase.local";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
