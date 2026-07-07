/**
 * room-state.ts — toPublic 순수 변환 테스트 (치팅 방지의 핵심).
 *
 * 절대 불변식: 공개 상태(rooms.public_state)에는 손패(hands)가 절대 실리지 않는다.
 * 대신 handCounts(장수)만 노출하고, 점수는 라운드 종료 시에만 포함한다.
 * toPublic은 순수 함수라 Supabase admin 없이 검증 가능하다.
 */
import { describe, it, expect } from "vitest";
import { toPublic } from "@/lib/pae/room-state";
import { roundPenalty, type GameState, type Player } from "@/lib/pae/engine";
import type { Tile, Suit } from "@/lib/pae/tiles";

const t = (n: number, s: Suit): Tile => ({ n, suit: s });
const players = (n: number): Player[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
function mk(
  hands: Tile[][],
  phase: "playing" | "ended",
  winner: number | null = null,
  setRound = 1,
  cumulative: number[] = new Array(hands.length).fill(0),
): GameState {
  return { config: { maxNumber: 15, perPlayer: 12 }, players: players(hands.length), hands, turn: 0, lead: null, winner, phase, setRound, totalRounds: 3, cumulative };
}

describe("room-state — toPublic (치팅 방지)", () => {
  const hands: Tile[][] = [
    [t(3, "cloud"), t(5, "sun"), t(9, "moon")],
    [t(2, "sun"), t(6, "cloud")],
    [t(7, "star"), t(8, "moon"), t(10, "sun"), t(11, "cloud")],
  ];

  it("RS-01: 공개 상태에 hands 필드가 절대 포함되지 않는다", () => {
    const pub = toPublic(mk(hands, "playing"));
    expect("hands" in pub).toBe(false);
    // 직렬화 결과에도 실제 타일 정보가 새 나가지 않아야 한다
    const json = JSON.stringify(pub);
    expect(json).not.toContain('"hands"');
    // 손패에만 있는 타일 정보(예: 상대 손의 특정 타일)가 노출되지 않음 — key 목록 화이트리스트
    // (scores 키는 playing 중에도 존재하되 값은 undefined — RS-03에서 별도 검증)
    expect(Object.keys(pub).sort()).toEqual(
      ["config", "cumulative", "handCounts", "lead", "phase", "players", "scores", "setRound", "totalRounds", "turn", "winner"].sort(),
    );
  });

  it("RS-02: handCounts가 각 플레이어 손패 장수와 정확히 일치", () => {
    const pub = toPublic(mk(hands, "playing"));
    expect(pub.handCounts).toEqual([3, 2, 4]);
    expect(pub.handCounts).toEqual(hands.map((h) => h.length));
  });

  it("RS-03: playing 중에는 scores가 undefined(정산 미노출)", () => {
    const pub = toPublic(mk(hands, "playing"));
    expect(pub.scores).toBeUndefined();
  });

  it("RS-04: ended 시에만 scores 포함, roundPenalty와 동일", () => {
    // P0 승(0장)=0, P1 1장(2 없음)=1, P2 2장(2 없음)=2 → 벌점 [0,1,2]
    const ended = mk([[], [t(6, "cloud")], [t(7, "star"), t(8, "moon")]], "ended", 0);
    const pub = toPublic(ended);
    expect(pub.scores).toBeDefined();
    expect(pub.scores).toEqual(roundPenalty(ended));
    expect(pub.scores).toEqual([0, 1, 2]);
    // 벌점은 승자 0 + 나머지 ≥0 (더 이상 zero-sum 아님)
    expect(pub.scores!.every((s) => s >= 0)).toBe(true);
    expect(pub.scores![ended.winner!]).toBe(0);
  });

  it("RS-05: setRound·cumulative가 공개 상태에 그대로 실린다", () => {
    // 세트 2라운드, 직전까지 누적 벌점 [3,0,5]인 진행 중 상태
    const s = mk(hands, "playing", null, 2, [3, 0, 5]);
    const pub = toPublic(s);
    expect(pub.setRound).toBe(2);
    expect(pub.cumulative).toEqual([3, 0, 5]);
    // 직렬화(DB 저장 형태)에도 살아남는다
    const round = JSON.parse(JSON.stringify(pub));
    expect(round.setRound).toBe(2);
    expect(round.cumulative).toEqual([3, 0, 5]);
  });
});
