/**
 * ST-11 ~ ST-13 — useUploadStatus 훅의 폴링 제어(정상 동작 확인).
 * 대상: src/lib/api/upload.ts — useUploadStatus
 * done/error → refetchInterval=false(폴링 중단), uploadId=null → enabled=false.
 *
 * 이 파일은 훅을 모킹하지 않는다(실제 동작 검증). 화면 분기는 upload-status-state.test.tsx 참조.
 */
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useUploadStatus } from "@/lib/api/upload";

const wrap =
  (client: QueryClient) =>
  ({ children }: { children: React.ReactNode }) =>
    <QueryClientProvider client={client}>{children}</QueryClientProvider>;

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, networkMode: "always", staleTime: 0 } },
  });
}

function refetchIntervalValue(client: QueryClient): unknown {
  const q = client.getQueryCache().getAll()[0];
  // refetchInterval 은 옵저버 레벨 옵션 → QueryOptions 타입에 없어 캐스팅으로 접근.
  const opts = q?.options as {
    refetchInterval?: number | false | ((q: unknown) => number | false);
  };
  const ri = opts?.refetchInterval;
  return typeof ri === "function" ? ri(q) : ri;
}

function okResponse(data: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, data, error: null, meta: null }),
  } as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useUploadStatus 폴링 제어", () => {
  it("ST-11: data.done=true → refetchInterval=false (폴링 중단)", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(okResponse({ uploadId: "u1", listingId: "L", status: "processing", done: true })),
    ) as unknown as typeof fetch;
    const client = makeClient();
    const { result } = renderHook(() => useUploadStatus("u1"), { wrapper: wrap(client) });
    await waitFor(() => expect(result.current.data?.done).toBe(true));
    expect(refetchIntervalValue(client)).toBe(false);
  });

  it("ST-12: data.status='error' → refetchInterval=false (폴링 중단)", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(okResponse({ uploadId: "u1", listingId: "L", status: "error", done: false })),
    ) as unknown as typeof fetch;
    const client = makeClient();
    const { result } = renderHook(() => useUploadStatus("u1"), { wrapper: wrap(client) });
    await waitFor(() => expect(result.current.data?.status).toBe("error"));
    expect(refetchIntervalValue(client)).toBe(false);
  });

  it("ST-13: uploadId=null → enabled=false (쿼리 미실행, fetch 0회)", async () => {
    const f = vi.fn();
    global.fetch = f as unknown as typeof fetch;
    const client = makeClient();
    renderHook(() => useUploadStatus(null), { wrapper: wrap(client) });
    await new Promise((r) => setTimeout(r, 40));
    expect(f).not.toHaveBeenCalled();
  });

  it("processing(미완료) → refetchInterval=3000 (폴링 지속)", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(okResponse({ uploadId: "u1", listingId: "L", status: "processing", done: false })),
    ) as unknown as typeof fetch;
    const client = makeClient();
    const { result } = renderHook(() => useUploadStatus("u1"), { wrapper: wrap(client) });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(refetchIntervalValue(client)).toBe(3000);
  });
});
