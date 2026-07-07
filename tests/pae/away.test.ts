// 오후의 패 — 자리비움(이탈) 좌석 대리 진행 forceAdvance 검증.
import { describe, it, expect } from "vitest";
import { forceAdvance, type GameState } from "@/lib/pae/engine";
import { classify } from "@/lib/pae/combos";
import type { Tile, Suit } from "@/lib/pae/tiles";

const t = (n: number, suit: Suit): Tile => ({ n, suit });

function mkState(over: Partial<GameState>): GameState {
  return {
    config: { maxNumber: 13, perPlayer: 13 },
    players: [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
      { id: "c", name: "C" },
      { id: "d", name: "D" },
    ],
    hands: [[], [], [], []],
    turn: 0,
    lead: null,
    winner: null,
    phase: "playing",
    setRound: 1,
    totalRounds: 3,
    cumulative: [0, 0, 0, 0],
    ...over,
  };
}

describe("forceAdvance — 자리비움 좌석 대리 진행", () => {
  it("응수 차례: 자동 패스 — 손패 유지, 턴만 다음으로", () => {
    const lead = { combo: classify([t(5, "sun")])!, by: 2 };
    const s = mkState({
      turn: 0,
      lead,
      hands: [[t(7, "cloud"), t(9, "moon")], [t(3, "cloud")], [t(4, "star")], [t(6, "sun")]],
    });
    const r = forceAdvance(s);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.turn).toBe(1);
    expect(r.state.hands[0].length).toBe(2); // 손패 안 줄음
    expect(r.state.lead).toEqual(lead); // 리드 유지
  });

  it("응수 차례: 다음이 리드 주인 → 트릭 종료, 리드권 이양", () => {
    const lead = { combo: classify([t(5, "sun")])!, by: 1 };
    const s = mkState({
      turn: 0,
      lead,
      hands: [[t(7, "cloud")], [t(3, "cloud")], [t(4, "star")], [t(6, "moon")]],
    });
    const r = forceAdvance(s);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.lead).toBeNull();
    expect(r.state.turn).toBe(1);
  });

  it("리드 차례: 가장 약한 싱글 자동 제출 — 손패 1장 감소, 턴 넘어감", () => {
    const s = mkState({
      turn: 0,
      lead: null,
      hands: [[t(9, "sun"), t(3, "cloud"), t(7, "moon")], [t(4, "star")], [t(5, "star")], [t(6, "star")]],
    });
    const r = forceAdvance(s);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // 가장 약한 = 구름3 (strength 0)
    expect(r.state.lead?.combo.tiles).toEqual([t(3, "cloud")]);
    expect(r.state.lead?.by).toBe(0);
    expect(r.state.hands[0]).toEqual([t(9, "sun"), t(7, "moon")]);
    expect(r.state.turn).toBe(1);
  });

  it("리드 차례 + 마지막 1장 → 그 좌석 승리, 라운드 종료", () => {
    const s = mkState({
      turn: 0,
      lead: null,
      hands: [[t(3, "cloud")], [t(4, "star")], [t(5, "star")], [t(6, "star")]],
    });
    const r = forceAdvance(s);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.phase).toBe("ended");
    expect(r.state.winner).toBe(0);
  });

  it("게임 종료 상태에서는 거부", () => {
    const s = mkState({ phase: "ended", winner: 1 });
    const r = forceAdvance(s);
    expect(r.ok).toBe(false);
  });
});
