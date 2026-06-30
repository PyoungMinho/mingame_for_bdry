import { describe, it, expect } from "vitest";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3001";

// 사장님 스모크: 사이트 어디서든 클릭 시 404 안 떠야 함
const PAGES: Array<{ url: string; contains?: string }> = [
  { url: "/", contains: "Tier" },
  { url: "/ko", contains: "Tier" },
  { url: "/models" },
  { url: "/ko/models" },
  { url: "/models/gpt-5" },
  { url: "/models/claude-opus-4-7" },
  { url: "/models/gemini-2-0-pro" },
  { url: "/models/o1" },
  { url: "/models/deepseek-r1" },
  { url: "/compare/claude-opus-4-7_vs_gpt-5" },
  { url: "/compare/claude-haiku-4-5_vs_gpt-4o-mini" },
  { url: "/find" },
  { url: "/ko/find" },
  { url: "/leaderboard/overall" },
  { url: "/leaderboard/coding" },
  { url: "/leaderboard/reasoning" },
  { url: "/leaderboard/writing" },
  { url: "/leaderboard/price" },
  { url: "/admin" },
  { url: "/about" },
  { url: "/ko/about" },
  { url: "/changelog" },
  { url: "/sources" },
  { url: "/ad-policy" },
  // API
  { url: "/api/v1/models" },
  { url: "/api/v1/models/gpt-5" },
  { url: "/api/v1/leaderboard/coding" },
  { url: "/api/v1/changelog" },
  { url: "/api/v1/search?q=gpt" },
];

// 알려진 404 — 정확히 404를 반환해야 함
const NOT_FOUND: string[] = [
  "/leaderboard/nonexistent",
  "/models/this-slug-does-not-exist",
];

describe("smoke: every page returns 200", () => {
  for (const { url, contains } of PAGES) {
    it(`GET ${url} -> 200`, async () => {
      const res = await fetch(`${BASE}${url}`, { redirect: "follow" });
      expect(res.status, `expected 200 for ${url}, got ${res.status}`).toBe(200);
      if (contains) {
        const body = await res.text();
        expect(body).toContain(contains);
      }
    });
  }
});

describe("smoke: invalid routes return 404", () => {
  for (const url of NOT_FOUND) {
    it(`GET ${url} -> 404`, async () => {
      const res = await fetch(`${BASE}${url}`, { redirect: "follow" });
      expect(res.status).toBe(404);
    });
  }
});

describe("smoke: no dead compare buttons on pages", () => {
  // 리더보드와 모델 상세에 _vs_ 가 dangling (뒷부분 빈) 링크가 없어야 함
  const targets = [
    "/leaderboard/overall",
    "/leaderboard/coding",
    "/models/gpt-5",
    "/models/claude-opus-4-7",
  ];
  for (const url of targets) {
    it(`${url} has no dangling /compare/*_vs_ links`, async () => {
      const res = await fetch(`${BASE}${url}`, { redirect: "follow" });
      const html = await res.text();
      // _vs_ 직후 따옴표(끝) 패턴 = 비어있는 페어
      expect(html, `dangling compare pair found on ${url}`).not.toMatch(
        /\/compare\/[a-z0-9-]+_vs_"/
      );
    });
  }
});

describe("smoke: no onClick=undefined buttons leak through SSR", () => {
  it("/compare page does not serialize onClick=undefined", async () => {
    const res = await fetch(
      `${BASE}/compare/claude-opus-4-7_vs_gpt-5`,
      { redirect: "follow" }
    );
    const html = await res.text();
    expect(html).not.toContain('onClick="undefined"');
  });
});
