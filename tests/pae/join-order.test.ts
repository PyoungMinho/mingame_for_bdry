/**
 * join-logic.ts — resolveJoin 순수 함수 테스트 (B-2 재접속 버그 회귀 방지).
 *
 * 핵심 불변식: "기존 참가자 통과"가 status·정원 체크보다 먼저다.
 * → 새로고침/재접속(playing·ended 상태)에서 정당한 참가자가 튕기면 안 된다.
 */
import { describe, it, expect } from "vitest";
import { resolveJoin, nextSeat, type JoinPlayer } from "@/lib/pae/join-logic";

const P = (uid: string, seat: number): JoinPlayer => ({ uid, seat });
const MAX = 5;

describe("join-logic — resolveJoin (B-2)", () => {
  it("JOIN-01: 기존 참가자는 status·정원과 무관하게 ok (재접속 허용)", () => {
    const players = [P("a", 0), P("b", 1), P("c", 2)];
    // playing 상태에서 기존 참가자 재접속
    expect(resolveJoin("playing", players, "b", MAX)).toEqual({ action: "ok" });
    // ended 상태에서도 재접속 허용
    expect(resolveJoin("ended", players, "a", MAX)).toEqual({ action: "ok" });
    // 정원이 꽉 찬 방이라도 기존 참가자는 통과
    const full = [P("a", 0), P("b", 1), P("c", 2), P("d", 3), P("e", 4)];
    expect(resolveJoin("waiting", full, "e", MAX)).toEqual({ action: "ok" });
  });

  it("JOIN-02: waiting·정원 미만인 신규 참가자는 insert (seat = max+1)", () => {
    expect(resolveJoin("waiting", [], "a", MAX)).toEqual({ action: "insert", seat: 0 });
    expect(resolveJoin("waiting", [P("a", 0), P("b", 1)], "c", MAX)).toEqual({ action: "insert", seat: 2 });
  });

  it("JOIN-03: 신규 참가자인데 waiting이 아니면 reject (409 대상)", () => {
    const d = resolveJoin("playing", [P("a", 0), P("b", 1), P("c", 2)], "z", MAX);
    expect(d.action).toBe("reject");
    if (d.action === "reject") expect(d.reason).toBe("이미 시작된 방입니다");
  });

  it("JOIN-04: 신규 참가자인데 정원이 찼으면 reject", () => {
    const full = [P("a", 0), P("b", 1), P("c", 2), P("d", 3), P("e", 4)];
    const d = resolveJoin("waiting", full, "z", MAX);
    expect(d.action).toBe("reject");
    if (d.action === "reject") expect(d.reason).toBe("정원이 찼습니다");
  });

  it("JOIN-05: nextSeat은 max(seat)+1 (빈방 0, 구멍 나도 중복 안 나게)", () => {
    expect(nextSeat([])).toBe(0);
    expect(nextSeat([P("a", 0), P("b", 1)])).toBe(2);
    // seat 0,2가 남아있으면(1이 나감) 다음은 3 — 재사용하지 않아 중복 방지
    expect(nextSeat([P("a", 0), P("c", 2)])).toBe(3);
    // seat가 null인 레거시 행이 섞여도 안전
    expect(nextSeat([{ uid: "a", seat: null }, P("b", 1)])).toBe(2);
  });
});
