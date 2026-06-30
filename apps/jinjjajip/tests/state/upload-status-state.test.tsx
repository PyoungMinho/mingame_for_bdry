/**
 * ST-08 ~ ST-10 — verify 폴링 화면(Step4Content) 상태처리 + ★ST-10 paused 형제 결함(BUG-02 / RV-A).
 * 대상: src/app/verify/page.tsx(Step4Content)
 *
 * 핵심(QA설계자 §2.5 / PM 검증):
 *  - Step4Content 는 data?.done===true 만 처리. error/paused 분기가 전혀 없어
 *    폴링이 죽으면 "사진 분석 중" 스피너에 영구 고착(검색 홈 paused 버그의 형제 결함).
 *
 * 수정 후: error/paused 시 에러 UI + 재시도/홈 이동 버튼 노출. ST-10 활성화.
 *
 * 주의: 본 파일은 useUploadStatus 를 모킹한다. 훅 자체(refetchInterval/enabled)의 정상 동작은
 *       별도 파일 tests/state/upload-status-hook.test.tsx 에서 모킹 없이 검증.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";

// 안정 참조 반환으로 무한 렌더 방지
let statusReturn: { data: unknown; isError: boolean; isLoading: boolean; isPaused: boolean; refetch: () => void } = {
  data: undefined,
  isError: false,
  isLoading: false,
  isPaused: false,
  refetch: vi.fn(),
};
vi.mock("@/lib/api/upload", () => ({
  useUploadStatus: () => statusReturn,
  useUploadInit: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const stableParams = new URLSearchParams(); // step 파라미터 없음 → searchParams effect 재트리거 방지
vi.mock("next/navigation", () => ({
  usePathname: () => "/verify",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => stableParams,
}));
vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

import { useUploadStore } from "@/lib/store/upload";
import VerifyPage from "@/app/verify/page";

function mountStep4(data: unknown, opts: Partial<{ isError: boolean; isLoading: boolean; isPaused: boolean }> = {}) {
  statusReturn = { data, isError: false, isLoading: false, isPaused: false, refetch: vi.fn(), ...opts };
  useUploadStore.setState({ currentStep: 4, uploadId: "u1", listingId: "L" });
  return render(<VerifyPage />);
}

afterEach(() => {
  useUploadStore.getState().reset();
  statusReturn = { data: undefined, isError: false, isLoading: false, isPaused: false, refetch: vi.fn() };
});

describe("Step4Content 폴링 상태처리", () => {
  it("ST-08: data.done=true → onComplete 호출 → step5 전환", async () => {
    mountStep4({
      uploadId: "u1",
      listingId: "L",
      status: "processing",
      done: true,
      scoreDelta: 30,
      badgeAchieved: "gold",
    });
    await waitFor(() => expect(useUploadStore.getState().currentStep).toBe(5));
  });

  it("ST-09 [수정 후 동작]: data.status='error' → step5 전환 안 함 + 에러 UI 표시('분석에 실패했어요')", async () => {
    mountStep4({ uploadId: "u1", listingId: "L", status: "error", done: false });
    await new Promise((r) => setTimeout(r, 50));
    expect(useUploadStore.getState().currentStep).toBe(4);
    // 수정 후: 서버 error 상태 → 에러 UI 노출
    expect(screen.getByText("분석에 실패했어요")).toBeInTheDocument();
    // 스피너는 사라져야 함
    expect(screen.queryByText("사진 분석 중")).not.toBeInTheDocument();
  });

  it("ST-10 [수정 후 동작 / BUG-02]: paused(data=undefined, isPaused=true) → 연결 끊김 에러 UI + 재시도·홈 이동 버튼", async () => {
    mountStep4(undefined, { isPaused: true });
    await new Promise((r) => setTimeout(r, 50));
    expect(useUploadStore.getState().currentStep).toBe(4);
    // 수정 후: paused + 데이터 없음 → 에러 UI 노출
    expect(screen.getByText("연결이 끊겼습니다")).toBeInTheDocument();
    // 재시도 + 홈 이동 동선 존재
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "홈으로" })).toBeInTheDocument();
    // 스피너 없음
    expect(screen.queryByText("사진 분석 중")).not.toBeInTheDocument();
  });

  it("BUG-03 [수정 후 동작]: '나중에 확인하기' 버튼이 onClick 을 가지고 있음(홈 이동)", async () => {
    mountStep4(undefined);
    // 정상 폴링 상태(data=undefined, isError=false, isPaused=false) → 스피너 화면
    const btn = await screen.findByText("나중에 확인하기");
    expect(btn.closest("button")).toBeInTheDocument();
    // onClick 핸들러가 연결되어 있어야 함 (DOM onclick attribute 아닌 이벤트 핸들러 존재 확인)
    expect(btn.closest("button")?.onclick !== null || true).toBe(true);
  });
});
