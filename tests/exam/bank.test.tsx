// @vitest-environment jsdom
/**
 * useProblemBank — localStorage 영속 훅 (설계서 §2.9)
 * RTL renderHook + act. 각 테스트 전 localStorage.clear().
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useProblemBank } from "@/lib/exam/useProblemBank";
import type { Variant } from "@/lib/exam/types";

const KEY = "munje-factory:bank:v1";

function makeVariant(id: string, stem = "문제"): Variant {
  return {
    id,
    stem,
    type: "multiple_choice",
    choices: [{ label: "①", text: "a" }],
    answer: "①",
    explanation: "해설",
    difficulty: "medium",
    subject: "math",
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("useProblemBank — 기본 동작", () => {
  it("PB-01: 빈 스토리지 초기 마운트 → items [], loaded true", async () => {
    const { result } = renderHook(() => useProblemBank());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.items).toEqual([]);
  });

  it("PB-02: add([v1,v2]) → 길이2, prepend 순서, localStorage 직렬화", async () => {
    const { result } = renderHook(() => useProblemBank());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => {
      result.current.add([makeVariant("v1"), makeVariant("v2")]);
    });
    expect(result.current.items).toHaveLength(2);
    // additions가 [...additions, ...prev] 로 앞에 붙는다. add 내부 순서는 [v1,v2] 그대로.
    expect(result.current.items.map((i) => i.id)).toEqual(["v1", "v2"]);
    const stored = JSON.parse(localStorage.getItem(KEY)!);
    expect(stored).toHaveLength(2);
    expect(stored[0].savedAt).toBeTypeOf("number");
  });

  it("PB-03: 같은 id 두 번 add → 중복 제거, 길이1", async () => {
    const { result } = renderHook(() => useProblemBank());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.add([makeVariant("dup")]));
    act(() => result.current.add([makeVariant("dup")]));
    expect(result.current.items).toHaveLength(1);
  });

  it("PB-04: add([]) → items 변화 없음", async () => {
    const { result } = renderHook(() => useProblemBank());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.add([makeVariant("v1")]));
    const before = result.current.items;
    act(() => result.current.add([]));
    expect(result.current.items).toBe(before); // 동일 참조(prev 반환)
  });

  it("PB-05: add 후 remove(id) → 제거 + localStorage 반영", async () => {
    const { result } = renderHook(() => useProblemBank());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.add([makeVariant("v1"), makeVariant("v2")]));
    act(() => result.current.remove("v1"));
    expect(result.current.items.map((i) => i.id)).toEqual(["v2"]);
    const stored = JSON.parse(localStorage.getItem(KEY)!);
    expect(stored.map((i: Variant) => i.id)).toEqual(["v2"]);
  });

  it("PB-06: 존재 안하는 id remove → 변화 없음, 크래시 없음", async () => {
    const { result } = renderHook(() => useProblemBank());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.add([makeVariant("v1")]));
    act(() => result.current.remove("nope"));
    expect(result.current.items).toHaveLength(1);
  });

  it("PB-07: clear() → items [], localStorage '[]'", async () => {
    const { result } = renderHook(() => useProblemBank());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.add([makeVariant("v1")]));
    act(() => result.current.clear());
    expect(result.current.items).toEqual([]);
    expect(localStorage.getItem(KEY)).toBe("[]");
  });

  it("PB-08: add 후 새 훅 인스턴스 마운트 → 데이터 복원(영속성)", async () => {
    const first = renderHook(() => useProblemBank());
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    act(() => first.result.current.add([makeVariant("persist")]));
    // 새 인스턴스
    const second = renderHook(() => useProblemBank());
    await waitFor(() => expect(second.result.current.loaded).toBe(true));
    expect(second.result.current.items.map((i) => i.id)).toEqual(["persist"]);
  });
});

describe("useProblemBank — 견고성", () => {
  it("PB-09: 깨진 JSON 주입 후 마운트 → items [] (크래시 없음)", async () => {
    localStorage.setItem(KEY, "{not valid json");
    const { result } = renderHook(() => useProblemBank());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.items).toEqual([]);
  });

  it("PB-10: setItem QuotaExceeded → 롤백(ok:false, 메모리 미반영) → 디스크와 일관", async () => {
    const { result } = renderHook(() => useProblemBank());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    let res: { added: number; ok: boolean } | undefined;
    act(() => {
      // M-5 수정: 디스크 쓰기를 먼저 시도하고 실패 시 메모리를 갱신하지 않는다(throw 전파 없음).
      res = result.current.add([makeVariant("v1")]);
    });
    // 반환값으로 실패를 동기 통지 → 호출부가 토스트로 안내한다.
    expect(res).toEqual({ added: 0, ok: false });
    // 롤백: 메모리(state)도 갱신되지 않아 "저장된 것처럼 보이는" 착시가 없다.
    expect(result.current.items).toHaveLength(0);
    spy.mockRestore();
    // 새 마운트도 [] — 메모리와 디스크가 일관(데이터 유실 착시 제거).
    const second = renderHook(() => useProblemBank());
    await waitFor(() => expect(second.result.current.loaded).toBe(true));
    expect(second.result.current.items).toEqual([]);
  });

  it("PB-11: savedAt — fake timers로 고정 시각 단언", async () => {
    vi.useFakeTimers();
    const fixed = new Date("2026-06-05T00:00:00Z").getTime();
    vi.setSystemTime(fixed);
    const { result } = renderHook(() => useProblemBank());
    // effect 실행
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    act(() => result.current.add([makeVariant("v1")]));
    expect(result.current.items[0].savedAt).toBe(fixed);
    vi.useRealTimers();
  });

  it("PB-12: prepend 결과 — 최신 add가 index 0", async () => {
    const { result } = renderHook(() => useProblemBank());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.add([makeVariant("old")]));
    act(() => result.current.add([makeVariant("new")]));
    expect(result.current.items[0].id).toBe("new"); // 최신이 앞
    expect(result.current.items[1].id).toBe("old");
  });
});
