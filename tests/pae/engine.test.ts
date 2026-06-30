/**
 * engine.ts — 게임 진행 엔진 단위 테스트.
 *
 * 턴 순환 · 패스(비영구) · 트릭 종료(리드 복귀) · 라운드 즉시 종료 ·
 * pairwise 점수 정산(2 배수) · 낼 수 있는 조합 탐색.
 */
import { describe, it, expect } from "vitest";
import {
  startGame,
  play,
  pass,
  scoreRound,
  playableAgainst,
  hasPlayable,
  type GameState,
  type Player,
  type Lead,
} from "@/lib/pae/engine";
import { classify } from "@/lib/pae/combos";
import { makeRng, startingPlayer, tileEquals, type Tile, type Suit } from "@/lib/pae/tiles";

const t = (n: number, suit: Suit): Tile => ({ n, suit });
const players = (n: number): Player[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));

const leadOf = (tiles: Tile[], by: number): Lead => ({ combo: classify(tiles)!, by });

/** 테스트용 상태 직접 구성 */
function mkState(hands: Tile[][], turn = 0, lead: Lead | null = null): GameState {
  return {
    config: { maxNumber: 15, perPlayer: 0 },
    players: players(hands.length),
    hands,
    turn,
    lead,
    winner: null,
    phase: "playing",
  };
}

function okState(r: ReturnType<typeof play>): GameState {
  if (!r.ok) throw new Error(`예상치 못한 실패: ${r.error}`);
  return r.state;
}

describe("engine — startGame", () => {
  it("ENG-01: 구름3 보유자가 첫 리드, 바닥패 없음", () => {
    const s = startGame(players(5), makeRng(5));
    expect(s.phase).toBe("playing");
    expect(s.lead).toBeNull();
    expect(s.turn).toBe(startingPlayer(s.hands));
    expect(s.hands[s.turn].some((x) => tileEquals(x, { n: 3, suit: "cloud" }))).toBe(true);
    s.hands.forEach((h) => expect(h).toHaveLength(12));
  });
});

describe("engine — play 검증", () => {
  it("ENG-02: 유효한 수 → 바닥패 갱신·손패 감소·턴 이동", () => {
    const s = mkState([[t(5, "sun"), t(9, "moon")], [t(6, "cloud")], [t(7, "star")]], 0, null);
    const r = okState(play(s, 0, [t(5, "sun")]));
    expect(r.lead?.combo.type).toBe("single");
    expect(r.lead?.by).toBe(0);
    expect(r.hands[0]).toHaveLength(1);
    expect(r.turn).toBe(1);
  });
  it("ENG-03: 차례가 아니면 거부", () => {
    const s = mkState([[t(5, "sun")], [t(6, "cloud")]], 0, null);
    const r = play(s, 1, [t(6, "cloud")]);
    expect(r.ok).toBe(false);
  });
  it("ENG-04: 손에 없는 타일 거부", () => {
    const s = mkState([[t(5, "sun")], [t(6, "cloud")]], 0, null);
    const r = play(s, 0, [t(9, "sun")]);
    expect(r.ok).toBe(false);
  });
  it("ENG-05: 바닥패를 못 이기는 조합 거부", () => {
    const s = mkState([[t(4, "cloud")], [t(6, "cloud")]], 0, leadOf([t(9, "sun")], 1));
    const r = play(s, 0, [t(4, "cloud")]); // 싱글 4 < 싱글 9
    expect(r.ok).toBe(false);
  });
  it("ENG-06: 더 강한 조합으로 받기 성공", () => {
    const s = mkState([[t(2, "cloud")], [t(6, "cloud")]], 0, leadOf([t(9, "sun")], 1));
    const r = play(s, 0, [t(2, "cloud")]); // 싱글 2 > 싱글 9
    expect(r.ok).toBe(true);
  });
});

describe("engine — pass·트릭 종료", () => {
  it("ENG-07: 리드 차례(바닥패 없음)엔 패스 불가", () => {
    const s = mkState([[t(5, "sun")], [t(6, "cloud")]], 0, null);
    expect(pass(s, 0).ok).toBe(false);
  });
  it("ENG-08: 전원 패스 → 리드한 사람에게 돌아오면 트릭 종료·새 리드", () => {
    // 3인: P0가 리드(by 0), 현재 차례 P1. P1·P2 패스 → P0 새 리드.
    const s = mkState(
      [[t(5, "sun")], [t(6, "cloud")], [t(7, "star")]],
      1,
      leadOf([t(8, "moon")], 0),
    );
    const afterP1 = okState(pass(s, 1));
    expect(afterP1.turn).toBe(2);
    expect(afterP1.lead).not.toBeNull();
    const afterP2 = okState(pass(afterP1, 2));
    expect(afterP2.lead).toBeNull(); // 트릭 종료
    expect(afterP2.turn).toBe(0); // 리드한 P0가 새 리드
  });
});

describe("engine — 라운드 종료·점수", () => {
  it("ENG-09: 마지막 타일을 내면 라운드 즉시 종료·승자 확정", () => {
    const s = mkState([[t(2, "sun")], [t(6, "cloud"), t(7, "star")]], 0, null);
    const r = okState(play(s, 0, [t(2, "sun")]));
    expect(r.phase).toBe("ended");
    expect(r.winner).toBe(0);
    expect(r.hands[0]).toHaveLength(0);
  });
  it("ENG-10: 점수는 pairwise 차이 정산 + 2 배수, 합은 0", () => {
    // 남은: P0=0, P1=3장(2 없음), P2=5장(2 한 장)
    const s = mkState(
      [
        [],
        [t(6, "cloud"), t(7, "star"), t(8, "moon")],
        [t(2, "cloud"), t(6, "sun"), t(7, "sun"), t(8, "sun"), t(9, "sun")],
      ],
      0,
      null,
    );
    const sc = scoreRound(s);
    expect(sc).toEqual([13, 1, -14]);
    expect(sc.reduce((a, b) => a + b, 0)).toBe(0); // zero-sum
  });
});

describe("engine — 낼 수 있는 조합 탐색", () => {
  it("ENG-11: 바닥패를 받을 수 있는 조합만 반환", () => {
    const hand = [t(2, "cloud"), t(4, "sun"), t(4, "moon"), t(9, "star")];
    const lead = leadOf([t(7, "sun")], 1); // 싱글 7
    const got = playableAgainst(hand, lead);
    // 싱글 중 7을 이기는 것: 2(최강), 9 → 2개. 페어 44는 크기 달라 제외.
    expect(got.every((c) => c.size === 1)).toBe(true);
    expect(got).toHaveLength(2);
  });
  it("ENG-12: 받을 수 있는 게 없으면 hasPlayable=false", () => {
    const hand = [t(3, "cloud"), t(4, "cloud")];
    const lead = leadOf([t(2, "sun")], 1); // 싱글 2(최강) — 못 이김
    expect(hasPlayable(hand, lead)).toBe(false);
    expect(playableAgainst(hand, lead)).toHaveLength(0);
  });
  it("ENG-13: 리드 차례(바닥패 없음)면 만들 수 있는 모든 조합", () => {
    const hand = [t(5, "sun"), t(5, "moon"), t(9, "star")];
    const got = playableAgainst(hand, null);
    // 싱글3 + 페어(5,5)1 = 4개
    expect(got).toHaveLength(4);
  });
});
