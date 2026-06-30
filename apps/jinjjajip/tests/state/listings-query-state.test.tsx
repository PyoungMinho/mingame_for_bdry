/**
 * ST-01 ~ ST-07 — 검색 홈(app/page.tsx) 상태처리 + ★ST-05 paused 회귀(BUG-01).
 * 대상: src/app/page.tsx + useListingsQuery + src/app/providers.tsx(networkMode 수정점)
 *
 * 핵심(QA설계자 §2.5 / PM 검증):
 *  - React Query 기본 networkMode='online' → 오프라인/실패 후 paused 진입 시
 *    isLoading=false·isError=false·data=undefined 가 되어 page 분기가 EmptyState 로 낙하(버그).
 *  - 단일 수정점: providers.tsx 의 networkMode='always'. 이 파일은 "수정 후 동작(ErrorState)" 을 회귀로 고정한다.
 *
 * 검증 전략: 실제 QueryClient + global.fetch 모킹 + onlineManager 로 4상태 직접 재현.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import React from "react";

// Next 의존성 모킹 (jsdom 라우터 컨텍스트 부재 대응)
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: unknown }) => (
    <a href={typeof href === "string" ? href : "#"}>{children}</a>
  ),
}));

import SearchHomePage from "@/app/page";

function makeOk(items: unknown[], total = items.length) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, data: { items, total, nextCursor: null }, meta: {} }),
  } as Response;
}

function makeClient(extra: Record<string, unknown> = {}) {
  // 실제 운영 providers 와 동일하게 networkMode 'always' 적용(수정점 반영).
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, networkMode: "always", ...extra },
    },
  });
}
const wrap =
  (client: QueryClient) =>
  ({ children }: { children: React.ReactNode }) =>
    <QueryClientProvider client={client}>{children}</QueryClientProvider>;

afterEach(() => {
  onlineManager.setOnline(true);
  vi.restoreAllMocks();
});

describe("검색 홈 상태처리 (ST-01~ST-04)", () => {
  it("ST-01: 로딩 중 → 스켈레톤 6개 렌더, EmptyState/ErrorState 없음", async () => {
    global.fetch = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    render(<SearchHomePage />, { wrapper: wrap(makeClient()) });
    const loadingList = await screen.findByLabelText("매물 목록 로딩 중");
    expect(loadingList.querySelectorAll("li")).toHaveLength(6);
    expect(screen.queryByText(/서비스 중입니다/)).not.toBeInTheDocument();
    expect(screen.queryByText(/연결이 끊겼습니다/)).not.toBeInTheDocument();
  });

  it("ST-02: isError → ErrorState('잠시 연결이 끊겼습니다') + 재시도 버튼", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) } as Response),
    ) as unknown as typeof fetch;
    render(<SearchHomePage />, { wrapper: wrap(makeClient()) });
    expect(await screen.findByText("잠시 연결이 끊겼습니다")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  it("ST-03: 빈 items + 필터없음 → EmptyState '현재 관악구·마포구에서 서비스 중입니다'", async () => {
    global.fetch = vi.fn(() => Promise.resolve(makeOk([]))) as unknown as typeof fetch;
    render(<SearchHomePage />, { wrapper: wrap(makeClient()) });
    expect(await screen.findByText("현재 관악구·마포구에서 서비스 중입니다")).toBeInTheDocument();
  });

  it("ST-04: 빈 items + 필터있음 → '조건에 맞는 매물이 없어요' + 필터 초기화", async () => {
    global.fetch = vi.fn(() => Promise.resolve(makeOk([]))) as unknown as typeof fetch;
    render(<SearchHomePage />, { wrapper: wrap(makeClient()) });
    // 지역 필터 적용
    fireEvent.click(await screen.findByRole("button", { name: "관악구" }));
    expect(await screen.findByText("조건에 맞는 매물이 없어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "필터 초기화" })).toBeInTheDocument();
  });

  it("정상 데이터 → 매물 목록 렌더 + 서버 total 표기", async () => {
    const items = [
      {
        id: "a",
        title: "관악 원룸",
        address: "서울 관악구",
        deposit: 1000,
        monthlyRent: 50,
        trustScore: 85,
        trustGrade: "gold",
        naturalLabel: "실거주 인증",
        thumbnailUrl: null,
        scoreBreakdown: [{ key: "photo", earned: 30, max: 35, status: "verified" }],
        status: "verified",
      },
    ];
    global.fetch = vi.fn(() => Promise.resolve(makeOk(items, 1))) as unknown as typeof fetch;
    render(<SearchHomePage />, { wrapper: wrap(makeClient()) });
    expect(await screen.findByLabelText("매물 목록")).toBeInTheDocument();
    expect(screen.getByText("1개 매물")).toBeInTheDocument();
  });
});

describe("★ST-05/ST-06 paused 회귀 (BUG-01 — 검색 홈 핵심)", () => {
  it("ST-05 [수정 검증]: 오프라인 + 500 실패 시 networkMode='always' 면 EmptyState 가 아닌 ErrorState 표시", async () => {
    onlineManager.setOnline(false);
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) } as Response),
    ) as unknown as typeof fetch;
    const client = makeClient(); // networkMode 'always'
    render(<SearchHomePage />, { wrapper: wrap(client) });

    // 수정 후: 실패가 정상적으로 isError 로 귀결 → ErrorState
    expect(await screen.findByText("잠시 연결이 끊겼습니다")).toBeInTheDocument();
    // 버그였던 EmptyState 오표시가 없어야 함(핵심 회귀)
    expect(screen.queryByText("현재 관악구·마포구에서 서비스 중입니다")).not.toBeInTheDocument();
  });

  it("ST-05b [수정 후 동작]: networkMode='online'(기본) + isPaused + data없음 → page 분기가 ErrorState 표시 (EmptyState 아님)", async () => {
    // 이 케이스는 page.tsx 의 `(isPaused && !data)` 분기를 검증한다.
    // networkMode='online' 환경에서 paused 가 발생해도, page 가 올바르게 ErrorState 로 렌더해야 함.
    // makeClient() = networkMode:'always' → paused 가 아닌 error 로 귀결(ST-05). 여기서는
    // networkMode:'online' + setOnline(false) 로 paused 상태를 강제, page 분기 단독 검증.
    onlineManager.setOnline(false);
    global.fetch = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0 } }, // networkMode 미설정 = 'online'
    });
    render(<SearchHomePage />, { wrapper: wrap(client) });

    await waitFor(() => {
      const q = client.getQueryCache().getAll()[0];
      expect(q?.state.fetchStatus).toBe("paused");
    });
    const q = client.getQueryCache().getAll()[0];
    expect(q?.state.status).toBe("pending");
    expect(q?.state.data).toBeUndefined();
    // 수정 후 올바른 동작: isPaused && !data → ErrorState (EmptyState 가 뜨면 버그)
    expect(screen.getByText("잠시 연결이 끊겼습니다")).toBeInTheDocument();
    expect(screen.queryByText("현재 관악구·마포구에서 서비스 중입니다")).not.toBeInTheDocument();
  });

  it("ST-06: 정상 네트워크에서 fetch reject → 최종 isError=true (paused 아님)", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("network"))) as unknown as typeof fetch;
    const client = makeClient();
    render(<SearchHomePage />, { wrapper: wrap(client) });
    expect(await screen.findByText("잠시 연결이 끊겼습니다")).toBeInTheDocument();
  });
});

describe("ST-07: 에러 시 카운트/정렬바 미노출", () => {
  it("ST-07: isError → 'N개 매물' 카운트바 미노출", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) } as Response),
    ) as unknown as typeof fetch;
    render(<SearchHomePage />, { wrapper: wrap(makeClient()) });
    await screen.findByText("잠시 연결이 끊겼습니다");
    expect(screen.queryByText(/개 매물$/)).not.toBeInTheDocument();
  });
});

describe("재시도 버튼 동작", () => {
  it("ErrorState 재시도 클릭 → refetch 발생(두 번째 성공 시 목록 표시)", async () => {
    let call = 0;
    global.fetch = vi.fn(() => {
      call += 1;
      if (call === 1) {
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) } as Response);
      }
      return Promise.resolve(
        makeOk(
          [
            {
              id: "x",
              title: "재시도 성공 매물",
              address: "서울 관악구 재시도동 1",
              deposit: 500,
              monthlyRent: 0,
              trustScore: 60,
              trustGrade: "silver",
              naturalLabel: "현장 인증",
              thumbnailUrl: null,
              scoreBreakdown: [],
              status: "verified",
            },
          ],
          1,
        ),
      );
    }) as unknown as typeof fetch;

    render(<SearchHomePage />, { wrapper: wrap(makeClient()) });
    fireEvent.click(await screen.findByRole("button", { name: "다시 시도" }));
    // 재시도 성공 → 목록 렌더(주소는 카드의 가시 텍스트). 제목은 article aria-label 에만 존재.
    expect(await screen.findByLabelText("매물 목록")).toBeInTheDocument();
    expect(screen.getByText("서울 관악구 재시도동 1")).toBeInTheDocument();
  });
});
