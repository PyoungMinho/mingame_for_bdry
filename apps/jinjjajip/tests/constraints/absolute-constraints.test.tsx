/**
 * 7대 절대 제약 회귀 — RV-01 ~ RV-15 (라이브 불필요 항목, 동작 기반).
 * 라이브 필요(RV-06/10/11, RLS/트리거/Edge)는 bug-report.md 정적 리뷰로 분리.
 *
 * 원칙: 소스 문자열 매칭이 아니라 "실제 동작"으로 제약 준수를 증명한다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ──────────────────────────────────────────────
// 데이터 레이어 제약 (제약 1·5·6·7)
// ──────────────────────────────────────────────
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn() }));
import { getListings, getListingById } from "@/lib/data/listings";
import { createServerClient } from "@/lib/supabase/server";

function dataMock(rows: unknown[]) {
  const calls: Record<string, unknown> = {};
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    not: vi.fn((c: string, op: string, v: string) => {
      calls.not = [c, op, v];
      return builder;
    }),
    is: vi.fn((c: string) => {
      (calls.is ??= [] as string[]);
      (calls.is as string[]).push(c);
      return builder;
    }),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    order: vi.fn((c: string, o: unknown) => {
      (calls.order ??= [] as unknown[]);
      (calls.order as unknown[]).push([c, o]);
      return builder;
    }),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data: (rows[0] as unknown) ?? null, error: null })),
    then: (res: (v: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(res),
  };
  return { client: { from: vi.fn(() => builder) }, calls };
}

const baseRow = {
  id: "L1",
  title: "관악 원룸",
  address: "서울 관악구",
  region: "gwanak",
  building_type: "oneroom",
  deposit_manwon: 1000,
  monthly_rent_manwon: 0,
  status: "verified",
  natural_label: null,
  trust_score: 65,
  trust_grade: "silver",
  sort_rank: 123,
  thumbnail_url: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("제약1: 정렬=서버 사전계산값 (RV-01·RV-02)", () => {
  it("RV-02: getListings 기본 정렬은 order(sort_rank desc)", async () => {
    const m = dataMock([]);
    vi.mocked(createServerClient).mockReturnValue(m.client as never);
    await getListings({ sort: "trust" } as never);
    expect(m.calls.order).toContainEqual(["sort_rank", { ascending: false }]);
  });

  it("RV-01: getListings 는 DB 반환 순서를 프론트에서 재정렬하지 않고 그대로 보존", async () => {
    // 의도적으로 trust_score 역순(낮은 점수 먼저)으로 주입 → 결과 순서가 입력과 동일해야 함
    const rows = [
      { ...baseRow, id: "low", trust_score: 10, sort_rank: 10, score_items: [] },
      { ...baseRow, id: "high", trust_score: 99, sort_rank: 999, score_items: [] },
    ];
    const m = dataMock(rows);
    vi.mocked(createServerClient).mockReturnValue(m.client as never);
    const r = await getListings({ sort: "trust" } as never);
    expect(r.items.map((i) => i.id)).toEqual(["low", "high"]); // 서버 순서 그대로(재정렬 없음)
  });
});

describe("제약5: 원본 비공개 / 공개=블러통과본만 (RV-09)", () => {
  it("RV-09: getListingById.photoUrls 는 status='approved' && blurred_path!=null 만 포함", async () => {
    const row = {
      ...baseRow,
      score_items: [],
      photos: [
        { blurred_path: "blur-ok.jpg", status: "approved" }, // 포함
        { blurred_path: null, status: "approved" }, // 제외(블러 없음)
        { blurred_path: "blur-proc.jpg", status: "processing" }, // 제외(미승인)
        { blurred_path: "blur-rej.jpg", status: "rejected" }, // 제외
      ],
    };
    const m = dataMock([row]);
    vi.mocked(createServerClient).mockReturnValue(m.client as never);
    const r = await getListingById("L1");
    expect(r?.photoUrls).toEqual(["blur-ok.jpg"]);
  });
});

describe("제약6: 신고/내림 매물 리스트 제외 (RV-12·RV-13)", () => {
  it("RV-12: getListings 쿼리에 .not(status in ('reported','taken_down')) + deleted_at null 필터 존재", async () => {
    const m = dataMock([]);
    vi.mocked(createServerClient).mockReturnValue(m.client as never);
    await getListings({} as never);
    expect(m.calls.not).toEqual(["status", "in", '("reported","taken_down")']);
    expect(m.calls.is as string[]).toContain("deleted_at");
  });

  it("RV-13: 쿼리 필터 체인을 신뢰 — 필터 통과 로우만 매핑되어 반환(필터 외 로우 가정 부재)", async () => {
    // 모킹은 '쿼리가 이미 필터링한 결과'를 돌려줌. getListings 가 그 결과를 그대로 매핑하는지 확인.
    const m = dataMock([{ ...baseRow, id: "visible", score_items: [] }]);
    vi.mocked(createServerClient).mockReturnValue(m.client as never);
    const r = await getListings({} as never);
    expect(r.items.map((i) => i.id)).toEqual(["visible"]);
  });
});

describe("제약7: pending(null) ≠ 0점 (RV-14)", () => {
  it("RV-14: mapScoreItemRow 가 earned=null 을 0 으로 변환하지 않고 null 보존, earned=0 은 0 유지", async () => {
    const row = {
      ...baseRow,
      score_items: [
        { key: "photo", earned: null, max: 35, status: "pending", verified_at: null, delta_if_reported: 0 },
        { key: "exif", earned: 0, max: 20, status: "verified", verified_at: null, delta_if_reported: 0 },
        { key: "community", earned: 18, max: 20, status: "verified", verified_at: null, delta_if_reported: -5 },
      ],
    };
    const m = dataMock([row]);
    vi.mocked(createServerClient).mockReturnValue(m.client as never);
    const r = await getListings({} as never);
    const bd = r.items[0].scoreBreakdown;
    expect(bd[0].earned).toBeNull(); // pending 보존
    expect(bd[1].earned).toBe(0); // 0점 보존
    expect(bd[2].deltaIfReported).toBe(-5); // delta!=0 이면 전달
    expect(bd[1].deltaIfReported).toBeUndefined(); // delta=0 이면 undefined
  });
});

// ──────────────────────────────────────────────
// 제약2: 낙관적 UI 금지 (RV-03)
// ──────────────────────────────────────────────
describe("제약2: 낙관적 UI 금지 (RV-03)", () => {
  const wrap =
    (c: QueryClient) =>
    ({ children }: { children: React.ReactNode }) =>
      <QueryClientProvider client={c}>{children}</QueryClientProvider>;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("RV-03: useReportMutation onSuccess 는 invalidateQueries 만 하고 setQueryData(낙관적 캐시조작) 미사용", async () => {
    // 동적 import (위 모듈 모킹과 무관한 listings 훅)
    const { useReportMutation } = await import("@/lib/api/listings");
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve({}) } as Response),
    ) as unknown as typeof fetch;
    const c = new QueryClient({
      defaultOptions: {
        queries: { retry: false, networkMode: "always" },
        mutations: { networkMode: "always" },
      },
    });
    const invSpy = vi.spyOn(c, "invalidateQueries");
    const setSpy = vi.spyOn(c, "setQueryData");
    const { result } = renderHook(() => useReportMutation(), { wrapper: wrap(c) });
    await act(async () => {
      await result.current.mutateAsync({
        listingId: "11111111-1111-4111-8111-111111111111",
        reason: "fake_listing",
      } as never);
    });
    expect(invSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(setSpy).not.toHaveBeenCalled();
  });
});
