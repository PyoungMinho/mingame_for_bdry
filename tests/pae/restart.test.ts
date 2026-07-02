/**
 * restart — "한 판 더"(B-1)가 의존하는 재초기화 불변식 테스트.
 *
 * restart 라우트는 Supabase admin이 필요하므로(수동 QA 항목), 여기서는 라우트가
 * 의존하는 순수 로직을 검증한다: startGame이 turn/lead/hands를 완전히 재초기화하고,
 * 구름3 보유자를 매 판 다시 계산하며, 이전 손패를 대체한다는 것.
 * (이 재초기화가 B-6 "종료 후 turn stale" 도 함께 해결함.)
 */
import { describe, it, expect } from "vitest";
import {
  startGame,
  play,
  nextRound,
  cumulativeWithRound,
  isSetOver,
  SET_ROUNDS,
  type GameState,
  type Player,
} from "@/lib/pae/engine";
import { makeRng, startingPlayer, tileEquals, tileId, buildDeck } from "@/lib/pae/tiles";

const players = (n: number): Player[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
const CLOUD3 = { n: 3, suit: "cloud" as const };

describe("restart — startGame 재초기화 (B-1)", () => {
  it("RESTART-01: 새 판은 lead=null·winner=null·phase=playing로 완전 초기화", () => {
    const s = startGame(players(4), makeRng(123));
    expect(s.phase).toBe("playing");
    expect(s.lead).toBeNull();
    expect(s.winner).toBeNull();
    // 이전 판이 ended였더라도 turn은 stale가 아니라 구름3 보유자로 재설정
    expect(s.turn).toBe(startingPlayer(s.hands));
    s.hands.forEach((h) => expect(h).toHaveLength(13));
  });

  it("RESTART-02: 구름3 리더를 매 판 다시 계산한다 (시드별로 달라질 수 있음)", () => {
    // 여러 시드에서 turn은 항상 그 판의 구름3 보유자와 일치해야 한다.
    for (const seed of [1, 2, 7, 42, 999, 2 ** 30]) {
      const s = startGame(players(5), makeRng(seed));
      expect(s.turn).toBe(startingPlayer(s.hands));
      expect(s.hands[s.turn].some((t) => tileEquals(t, CLOUD3))).toBe(true);
    }
    // 서로 다른 시드는 서로 다른 리더/딜을 낼 수 있다(재딜이 실제로 일어남을 확인)
    const a = startGame(players(5), makeRng(1));
    const b = startGame(players(5), makeRng(2));
    expect(a.hands.map((h) => h.map(tileId).join(","))).not.toEqual(
      b.hands.map((h) => h.map(tileId).join(",")),
    );
  });

  it("RESTART-03: 종료된 판 위에서 다시 시작하면 손패가 새 딜로 대체된다", () => {
    // 1판: P0가 마지막 한 장을 내며 종료 → hands[0] 비어 있음, phase ended
    const ended = play(
      { config: { maxNumber: 15, perPlayer: 0 }, players: players(3), hands: [[{ n: 5, suit: "sun" }], [{ n: 6, suit: "cloud" }], [{ n: 7, suit: "star" }]], turn: 0, lead: null, winner: null, phase: "playing", setRound: 1, cumulative: [0, 0, 0] },
      0,
      [{ n: 5, suit: "sun" }],
    );
    expect(ended.ok && ended.state.phase).toBe("ended");

    // restart → startGame이 전원 손패를 새로 채운다(빈 손패 stale 없음)
    const fresh = startGame(players(3), makeRng(55));
    expect(fresh.phase).toBe("playing");
    fresh.hands.forEach((h) => expect(h.length).toBeGreaterThan(0));
    fresh.hands.forEach((h) => expect(h).toHaveLength(12)); // 3인 = 12장
  });

  it("RESTART-04: 재시작 딜도 덱 전체를 누락·중복 없이 배분", () => {
    const s = startGame(players(4), makeRng(321));
    const all = s.hands.flat().map(tileId);
    expect(all).toHaveLength(52); // 4인 = 52장
    expect(new Set(all)).toEqual(new Set(buildDeck(13).map(tileId)));
  });
});

describe("nextRound — 세트 진행(누적)·세트 종료 후 리셋", () => {
  /** 종료 상태를 직접 구성: setRound·cumulative·남은 손패로 벌점을 결정한다. */
  const ended = (
    setRound: number,
    cumulative: number[],
    hands: { n: number; suit: "sun" | "moon" | "star" | "cloud" }[][],
    winner: number,
  ): GameState => ({
    config: { maxNumber: 15, perPlayer: 0 },
    players: players(hands.length),
    hands,
    turn: 0,
    lead: null,
    winner,
    phase: "ended",
    setRound,
    cumulative,
  });

  it("SET-01: setRound 1→2→3에서 벌점이 cumulative에 누적된다", () => {
    // R1 종료: P0 승(0장), P1 2장(2 없음→2), P2 1장(2 보유→×2=2)
    const r1 = ended(1, [0, 0, 0], [[], [{ n: 6, suit: "cloud" }, { n: 7, suit: "star" }], [{ n: 2, suit: "sun" }]], 0);
    expect(cumulativeWithRound(r1)).toEqual([0, 2, 2]);
    expect(isSetOver(r1)).toBe(false);

    // nextRound → 새 R2: setRound=2, cumulative가 R1 누적을 이어받음
    const r2start = nextRound(r1, makeRng(11));
    expect(r2start.setRound).toBe(2);
    expect(r2start.cumulative).toEqual([0, 2, 2]);
    expect(r2start.phase).toBe("playing");
    // 새 딜이므로 손패가 다시 채워진다(3인=12장)
    r2start.hands.forEach((h) => expect(h).toHaveLength(12));

    // R2 종료를 모사: 위 누적 위에 P1 승, P0 3장(2 없음→3), P2 2장(2 보유→×2=4)
    const r2 = ended(2, r2start.cumulative, [[{ n: 5, suit: "sun" }, { n: 6, suit: "sun" }, { n: 7, suit: "sun" }], [], [{ n: 2, suit: "moon" }, { n: 9, suit: "cloud" }]], 1);
    expect(cumulativeWithRound(r2)).toEqual([3, 2, 6]); // [0+3, 2+0, 2+4]
    expect(isSetOver(r2)).toBe(false);

    // nextRound → R3: setRound=3, 누적 이어받음
    const r3start = nextRound(r2, makeRng(22));
    expect(r3start.setRound).toBe(3);
    expect(r3start.cumulative).toEqual([3, 2, 6]);
  });

  it("SET-02: 3라운드(SET_ROUNDS) 종료 후 nextRound는 새 세트(setRound=1·cumulative 리셋)", () => {
    // 마지막 라운드(setRound=SET_ROUNDS) 종료 상태
    const last = ended(SET_ROUNDS, [3, 2, 6], [[], [{ n: 6, suit: "cloud" }], [{ n: 2, suit: "sun" }, { n: 8, suit: "moon" }]], 0);
    expect(isSetOver(last)).toBe(true);

    const nextSet = nextRound(last, makeRng(33));
    expect(nextSet.setRound).toBe(1); // 새 세트로 리셋
    expect(nextSet.cumulative).toEqual([0, 0, 0]); // 누적 초기화
    expect(nextSet.phase).toBe("playing");
    expect(nextSet.winner).toBeNull();
    nextSet.hands.forEach((h) => expect(h).toHaveLength(12));
  });
});
