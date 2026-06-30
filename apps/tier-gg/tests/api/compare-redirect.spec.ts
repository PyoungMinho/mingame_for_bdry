/**
 * CP-01: 역순 입력 → 알파벳 정렬로 redirect
 * CP-03: 동일 slug → 상세 페이지로 redirect (B-05 수정 검증)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// next/navigation mock — redirect/notFound을 throw로 변환
const redirectMock = vi.fn((path: string) => {
  const e = new Error(`__REDIRECT__:${path}`);
  (e as Error & { __redirect?: string }).__redirect = path;
  throw e;
});
const notFoundMock = vi.fn(() => {
  throw new Error("__NOT_FOUND__");
});

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

beforeEach(() => {
  redirectMock.mockClear();
  notFoundMock.mockClear();
});

describe("/compare/[pair] redirect 로직", () => {
  it("CP-01: 역순 slug 입력 시 알파벳 정렬 경로로 redirect", async () => {
    const mod = await import("@/app/[locale]/compare/[pair]/page");
    const Page = mod.default;
    await expect(
      Page({
        params: Promise.resolve({
          locale: "en",
          pair: "gpt-4o_vs_claude-sonnet-4-6",
        }),
      })
    ).rejects.toThrow(/__REDIRECT__/);
    expect(redirectMock).toHaveBeenCalledWith(
      "/compare/claude-sonnet-4-6_vs_gpt-4o"
    );
  });

  it("CP-03 (B-05 수정 검증): 동일 slug 비교는 모델 상세로 redirect", async () => {
    const mod = await import("@/app/[locale]/compare/[pair]/page");
    const Page = mod.default;
    await expect(
      Page({
        params: Promise.resolve({ locale: "en", pair: "gpt-4o_vs_gpt-4o" }),
      })
    ).rejects.toThrow(/__REDIRECT__/);
    expect(redirectMock).toHaveBeenCalledWith("/models/gpt-4o");
  });

  it("CP-04: _vs_ 구분자 없는 pair는 notFound 호출", async () => {
    const mod = await import("@/app/[locale]/compare/[pair]/page");
    const Page = mod.default;
    await expect(
      Page({
        params: Promise.resolve({ locale: "en", pair: "gpt-4o" }),
      })
    ).rejects.toThrow(/__NOT_FOUND__/);
  });
});
