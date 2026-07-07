/**
 * engine.ts — 엣지 케이스 심화 테스트 (기존 engine.test.ts 보강).
 *
 * 트릭 종료 확장(멀티 패스·중간 컷·리드 복귀), 5장 족보로 라운드 종료,
 * play/pass 액션 거부 경로 전수, 라운드 벌점 정밀값(2 없음 그대로/2 있음 ×2/승자 0),
 * property(모든 벌점 ≥0 & 승자=0).
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  play,
  pass,
  roundPenalty,
  type GameState,
  type Player,
  type Lead,
} from "@/lib/pae/engine";
import { classify } from "@/lib/pae/combos";
import type { Tile, Suit } from "@/lib/pae/tiles";

const t = (n: number, s: Suit): Tile => ({ n, suit: s });
const players = (n: number): Player[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
const leadOf = (tiles: Tile[], by: number): Lead => ({ combo: classify(tiles)!, by });
function mk(hands: Tile[][], turn = 0, lead: Lead | null = null): GameState {
  return { config: { maxNumber: 15, perPlayer: 0 }, players: players(hands.length), hands, turn, lead, winner: null, phase: "playing", setRound: 1, totalRounds: 3, cumulative: new Array(hands.length).fill(0) };
}
function ok(r: ReturnType<typeof play>): GameState {
  if (!r.ok) throw new Error(`예상치 못한 실패: ${r.error}`);
  return r.state;
}

describe("engine.edge — 트릭 종료 확장", () => {
  it("ENG-E01: 4인 전원 패스 → 리드한 사람에게 돌아오면 트릭 종료·lead=null", () => {
    // P0 리드(by 0), 현재 P1. P1·P2·P3 패스 → P0 새 리드.
    const s = mk([[t(8, "moon")], [t(4, "cloud")], [t(5, "cloud")], [t(6, "cloud")]], 1, leadOf([t(9, "sun")], 0));
    let st = ok(pass(s, 1));
    expect(st.turn).toBe(2);
    expect(st.lead).not.toBeNull();
    st = ok(pass(st, 2));
    expect(st.turn).toBe(3);
    st = ok(pass(st, 3));
    expect(st.lead).toBeNull();
    expect(st.turn).toBe(0);
  });

  it("ENG-E02: 중간에 누가 받으면 트릭이 이어지고 새 리드가 by를 갱신", () => {
    // P0 리드(by0), P1 패스, P2가 더 센 조합으로 받음 → lead.by=2, 차례 P3
    // (P2는 손패가 남아야 트릭이 이어짐 — 마지막 패면 라운드 종료 분기로 감)
    const s = mk([[t(8, "moon")], [t(4, "cloud")], [t(2, "sun"), t(10, "star")], [t(6, "cloud")]], 1, leadOf([t(9, "sun")], 0));
    const afterPass = ok(pass(s, 1));
    expect(afterPass.turn).toBe(2);
    const afterBeat = ok(play(afterPass, 2, [t(2, "sun")])); // 싱글 2 > 싱글 9
    expect(afterBeat.lead?.by).toBe(2);
    expect(afterBeat.phase).toBe("playing"); // 아직 손패 남음
    expect(afterBeat.turn).toBe(3);
  });

  it("ENG-E03: 트릭을 딴 사람이 리드 차례가 되면 아무 조합이나 낼 수 있다", () => {
    // 트릭 종료 후 P0가 lead=null 상태에서 리드
    const s = mk([[t(8, "moon"), t(9, "cloud")], [t(4, "cloud")], [t(5, "cloud")]], 0, null);
    const st = ok(play(s, 0, [t(8, "moon")]));
    expect(st.lead?.by).toBe(0);
    expect(st.turn).toBe(1);
  });

  it("ENG-E04: 손패가 빈 플레이어는 트릭 순환에서 건너뛴다(nextAlive)", () => {
    // P1은 이미 손을 비움 → P0가 낸 뒤 차례는 P2
    const s = mk([[t(9, "sun"), t(4, "cloud")], [], [t(6, "cloud")]], 0, null);
    const st = ok(play(s, 0, [t(9, "sun")]));
    expect(st.turn).toBe(2);
  });

  it("ENG-E05: 리드보다 강한 같은 크기 조합만 받을 수 있다(약한 건 거부)", () => {
    const s = mk([[t(4, "cloud")], [t(6, "cloud")]], 0, leadOf([t(9, "sun")], 1));
    expect(play(s, 0, [t(4, "cloud")]).ok).toBe(false); // 4 < 9
  });

  it("ENG-E06: 패스는 비영구 — 다시 차례가 오면 낼 수 있다", () => {
    // P0 리드(by0), P1 패스(P2로), P2 패스 → 트릭종료 P0. 여기선 P1이 패스했어도 상태에 '패스 흔적' 없음
    const s = mk([[t(8, "moon")], [t(4, "cloud")], [t(5, "cloud")]], 1, leadOf([t(9, "sun")], 0));
    const afterP1 = ok(pass(s, 1));
    const afterP2 = ok(pass(afterP1, 2)); // 리드 P0로 복귀
    expect(afterP2.lead).toBeNull();
    expect(afterP2.turn).toBe(0);
  });
});

describe("engine.edge — 5장 족보로 라운드 종료", () => {
  it("ENG-E07: 5장 족보로 마지막 패를 내면 라운드 즉시 종료·승자 확정", () => {
    const five = [t(3, "sun"), t(4, "sun"), t(5, "sun"), t(6, "sun"), t(7, "sun")];
    const s = mk([five, [t(9, "cloud"), t(9, "moon")], [t(8, "star"), t(10, "star")]], 0, null);
    const st = ok(play(s, 0, five));
    expect(st.phase).toBe("ended");
    expect(st.winner).toBe(0);
    expect(st.hands[0]).toHaveLength(0);
    expect(st.lead?.combo.type).toBe("straightflush");
  });

  it("ENG-E08: 5장 리드를 5장 족보로 받아도 마지막 패면 종료", () => {
    // P1이 스트레이트 리드, P0가 더 센 플러시(=마지막 5장)로 받아 종료
    const straightLead = leadOf([t(3, "cloud"), t(4, "moon"), t(5, "star"), t(6, "cloud"), t(7, "moon")], 1);
    const flushFinish = [t(3, "sun"), t(6, "sun"), t(8, "sun"), t(10, "sun"), t(13, "sun")];
    const s = mk([flushFinish, [t(9, "cloud")]], 0, straightLead);
    const st = ok(play(s, 0, flushFinish));
    expect(st.phase).toBe("ended");
    expect(st.winner).toBe(0);
  });
});

describe("engine.edge — 액션 거부 경로 전수", () => {
  const base = mk([[t(5, "sun"), t(5, "moon")], [t(6, "cloud")]], 0, null);

  it("ENG-E09: 게임 종료 후에는 play·pass 모두 거부", () => {
    const ended: GameState = { ...base, phase: "ended", winner: 0 };
    expect(play(ended, 0, [t(5, "sun")])).toEqual({ ok: false, error: "게임이 끝났습니다" });
    expect(pass(ended, 0)).toEqual({ ok: false, error: "게임이 끝났습니다" });
  });

  it("ENG-E10: 내 차례가 아니면 거부", () => {
    expect(play(base, 1, [t(6, "cloud")])).toEqual({ ok: false, error: "당신 차례가 아닙니다" });
    const withLead = mk([[t(5, "sun")], [t(6, "cloud")]], 0, leadOf([t(9, "sun")], 1));
    expect(pass(withLead, 1)).toEqual({ ok: false, error: "당신 차례가 아닙니다" });
  });

  it("ENG-E11: 빈 선택으로 play 거부", () => {
    expect(play(base, 0, [])).toEqual({ ok: false, error: "낼 타일을 선택하세요" });
  });

  it("ENG-E12: 손에 없는 타일은 거부(수량 초과 포함)", () => {
    expect(play(base, 0, [t(9, "sun")]).ok).toBe(false); // 아예 없음
    // 5는 2장뿐인데 3장 요구 → 수량 초과 거부
    expect(play(base, 0, [t(5, "sun"), t(5, "moon"), t(5, "star")]).ok).toBe(false);
  });

  it("ENG-E13: 유효하지 않은 조합(투페어 5장 등)은 거부", () => {
    const hand = mk([[t(7, "sun"), t(7, "moon"), t(4, "sun"), t(4, "cloud"), t(9, "star")], [t(6, "cloud")]], 0, null);
    expect(play(hand, 0, [t(7, "sun"), t(7, "moon"), t(4, "sun"), t(4, "cloud"), t(9, "star")])).toEqual({
      ok: false,
      error: "유효하지 않은 조합입니다",
    });
  });

  it("ENG-E14: 리드 차례(바닥패 없음)엔 패스 불가", () => {
    expect(pass(base, 0)).toEqual({ ok: false, error: "리드 차례에는 패스할 수 없습니다" });
  });

  it("ENG-E15: 크기가 다른 조합으로는 받을 수 없다", () => {
    // 싱글 리드에 페어로 받기 시도 → 크기 불일치로 canBeat 실패
    const s = mk([[t(5, "sun"), t(5, "moon")], [t(9, "cloud")]], 0, leadOf([t(9, "sun")], 1));
    expect(play(s, 0, [t(5, "sun"), t(5, "moon")]).ok).toBe(false);
  });
});

describe("engine.edge — 라운드 벌점 정밀", () => {
  it("ENG-E16: 2 없으면 그대로 · 2 있으면 ×2 · 승자(빈손)=0", () => {
    // 승자 P0=0장 → 0. P1=3장 2 없음 → 3. P2=5장 2 보유(장수 무관) → ×2=10.
    const a = mk(
      [
        [],
        [t(6, "cloud"), t(7, "star"), t(8, "moon")],
        [t(2, "sun"), t(6, "cloud"), t(7, "cloud"), t(8, "cloud"), t(9, "cloud")],
      ],
      0,
      null,
    );
    expect(roundPenalty(a)).toEqual([0, 3, 10]);

    // 2를 여러 장 가져도 배수는 ×2로 동일(장수 무관): P2 4장 × 2 = 8
    const b = mk(
      [[], [t(5, "cloud")], [t(2, "sun"), t(2, "moon"), t(2, "star"), t(6, "sun")]],
      0,
      null,
    );
    expect(roundPenalty(b)).toEqual([0, 1, 8]);

    // 2가 하나도 없으면 전원 남은 장수 그대로가 벌점
    const c = mk(
      [[t(3, "cloud"), t(4, "cloud")], [t(5, "cloud"), t(6, "cloud")], [t(7, "cloud"), t(8, "cloud")]],
      0,
      null,
    );
    expect(roundPenalty(c)).toEqual([2, 2, 2]);

    // 라운드 종료 시 승자(마지막 패를 낸 사람)의 벌점은 0
    const finish = ok(play(mk([[t(2, "sun")], [t(6, "cloud"), t(7, "star")]], 0, null), 0, [t(2, "sun")]));
    expect(finish.phase).toBe("ended");
    expect(finish.winner).toBeGreaterThanOrEqual(0);
    expect(roundPenalty(finish)[finish.winner!]).toBe(0);
  });

  it("ENG-E17: property — ∀ (인원, 손패장수, 2 보유) : 모든 벌점 ≥0 & 빈손=0", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 5 }),
        fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 3, maxLength: 5 }),
        fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 3, maxLength: 5 }),
        (n, sizes, twoCounts) => {
          const hands: Tile[][] = Array.from({ length: n }, (_, i) => {
            const total = sizes[i % sizes.length];
            const twos = Math.min(twoCounts[i % twoCounts.length], total);
            const h: Tile[] = [];
            for (let k = 0; k < twos; k++) h.push(t(2, "cloud"));
            for (let k = twos; k < total; k++) h.push(t(5, "cloud")); // 2가 아닌 채움
            return h;
          });
          const pen = roundPenalty(mk(hands));
          // 모든 벌점은 음수가 아니고, 빈손(0장)은 정확히 0이어야 한다.
          return pen.every((p, i) => p >= 0 && (hands[i].length === 0 ? p === 0 : true));
        },
      ),
    );
  });
});
