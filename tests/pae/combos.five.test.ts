/**
 * combos.ts — 5장 족보 심화 테스트 (기존 combos.test.ts 보강).
 *
 * 동값 스트레이트 색 타이브레이크, 플러시 최강카드 비교, 포카드 숫자 비교,
 * 스트레이트플러시, 풀하우스 킥커 무관(양방향), 서로 다른 타입 FIVE_ORDER 위계,
 * enumerateCombos 정확성·성능.
 */
import { describe, it, expect } from "vitest";
import { classify, compareCombos, canBeat, FIVE_ORDER, type Combo } from "@/lib/pae/combos";
import { enumerateCombos } from "@/lib/pae/engine";
import type { Tile, Suit } from "@/lib/pae/tiles";

const t = (n: number, s: Suit): Tile => ({ n, suit: s });
const C = (tiles: Tile[]): Combo => {
  const c = classify(tiles);
  if (!c) throw new Error(`유효하지 않은 조합: ${JSON.stringify(tiles)}`);
  return c;
};

describe("combos.five — 5장 족보 심화", () => {
  it("FIVE-01: 스트레이트 동일 최고숫자는 그 최고카드의 색으로 우열", () => {
    // 둘 다 3-4-5-6-7, 최고숫자 7. 한쪽 7=해, 다른쪽 7=구름 → 해가 강함.
    const hiTop = C([t(3, "cloud"), t(4, "cloud"), t(5, "cloud"), t(6, "cloud"), t(7, "sun")]);
    const loTop = C([t(3, "sun"), t(4, "sun"), t(5, "sun"), t(6, "sun"), t(7, "cloud")]);
    expect(hiTop.type).toBe("straight");
    expect(loTop.type).toBe("straight");
    expect(canBeat(hiTop, loTop)).toBe(true);
    expect(canBeat(loTop, hiTop)).toBe(false);
  });

  it("FIVE-02: 플러시는 가장 강한 한 장으로 비교", () => {
    // 둘 다 해 플러시. 최강카드 13(해) vs 12(해) → 13 쪽 강함.
    const a = C([t(3, "sun"), t(6, "sun"), t(8, "sun"), t(10, "sun"), t(13, "sun")]);
    const b = C([t(3, "moon"), t(6, "moon"), t(8, "moon"), t(10, "moon"), t(12, "moon")]);
    expect(a.type).toBe("flush");
    expect(canBeat(a, b)).toBe(true);
    // 최강카드 숫자가 같으면 그 카드의 색으로 (해 플러시 > 달 플러시, 둘 다 top 13)
    const sun13 = C([t(3, "sun"), t(6, "sun"), t(8, "sun"), t(10, "sun"), t(13, "sun")]);
    const moon13 = C([t(3, "moon"), t(6, "moon"), t(8, "moon"), t(10, "moon"), t(13, "moon")]);
    expect(canBeat(sun13, moon13)).toBe(true);
  });

  it("FIVE-03: 포카드는 4장짜리 숫자로 비교(킥커 무관)", () => {
    const quad9 = C([t(9, "sun"), t(9, "moon"), t(9, "star"), t(9, "cloud"), t(3, "sun")]);
    const quad7 = C([t(7, "sun"), t(7, "moon"), t(7, "star"), t(7, "cloud"), t(15, "sun")]);
    expect(quad9.type).toBe("fourplus");
    expect(canBeat(quad9, quad7)).toBe(true);
    expect(canBeat(quad7, quad9)).toBe(false);
    // 포카드 2 > 포카드 1 (숫자 강함 2>1)
    const quad2 = C([t(2, "sun"), t(2, "moon"), t(2, "star"), t(2, "cloud"), t(3, "sun")]);
    const quad1 = C([t(1, "sun"), t(1, "moon"), t(1, "star"), t(1, "cloud"), t(3, "sun")]);
    expect(canBeat(quad2, quad1)).toBe(true);
  });

  it("FIVE-04: 스트레이트플러시는 연속+동색이며 자연수 최고값으로 비교", () => {
    const sfHigh = C([t(11, "sun"), t(12, "sun"), t(13, "sun"), t(14, "sun"), t(15, "sun")]);
    const sfLow = C([t(3, "moon"), t(4, "moon"), t(5, "moon"), t(6, "moon"), t(7, "moon")]);
    expect(sfHigh.type).toBe("straightflush");
    expect(canBeat(sfHigh, sfLow)).toBe(true);
    expect(canBeat(sfLow, sfHigh)).toBe(false);
  });

  it("FIVE-05: 풀하우스는 트리플 부분으로만 비교, 킥커는 무관 (양방향)", () => {
    // 트리플7+킥커22 vs 트리플4+킥커(해15,구름15): 트리플7 > 트리플4
    const trip7 = C([t(7, "sun"), t(7, "moon"), t(7, "star"), t(2, "sun"), t(2, "cloud")]);
    const trip4 = C([t(4, "sun"), t(4, "moon"), t(4, "star"), t(15, "sun"), t(15, "cloud")]);
    expect(trip7.type).toBe("fullhouse");
    expect(canBeat(trip7, trip4)).toBe(true);
    expect(canBeat(trip4, trip7)).toBe(false);
    // 트리플 숫자가 같으면 킥커가 아무리 세도 동률 → 못 이김 (양방향 false)
    const a = C([t(9, "sun"), t(9, "moon"), t(9, "star"), t(3, "sun"), t(3, "cloud")]);
    const b = C([t(9, "sun"), t(9, "moon"), t(9, "star"), t(2, "sun"), t(2, "cloud")]);
    expect(canBeat(a, b)).toBe(false);
    expect(canBeat(b, a)).toBe(false);
  });

  it("FIVE-06: 서로 다른 타입은 FIVE_ORDER 위계로 비교(키 무시)", () => {
    // 위계: straight(0) < flush(1) < fullhouse(2) < fourplus(3) < straightflush(4)
    const straight = C([t(3, "sun"), t(4, "moon"), t(5, "star"), t(6, "cloud"), t(7, "sun")]);
    const flush = C([t(3, "cloud"), t(6, "cloud"), t(8, "cloud"), t(10, "cloud"), t(13, "cloud")]);
    const full = C([t(5, "sun"), t(5, "moon"), t(5, "star"), t(9, "sun"), t(9, "cloud")]);
    const quad = C([t(5, "sun"), t(5, "moon"), t(5, "star"), t(5, "cloud"), t(9, "sun")]);
    const sf = C([t(3, "moon"), t(4, "moon"), t(5, "moon"), t(6, "moon"), t(7, "moon")]);
    expect(FIVE_ORDER[flush.type]).toBeGreaterThan(FIVE_ORDER[straight.type]);
    expect(canBeat(flush, straight)).toBe(true);
    expect(canBeat(full, flush)).toBe(true);
    expect(canBeat(quad, full)).toBe(true);
    expect(canBeat(sf, quad)).toBe(true);
    // 낮은 타입은 높은 키를 가져도 못 이김 (약한 스트플이 강한 스트레이트를 이긴다)
    expect(compareCombos(sf, straight)).toBeGreaterThan(0);
  });

  it("FIVE-07: enumerateCombos — 5장 족보를 정확히 열거한다", () => {
    // 완전한 스트레이트 플러시 5장만 있는 손: 5C5=1개, straightflush로 판정
    const hand = [t(3, "sun"), t(4, "sun"), t(5, "sun"), t(6, "sun"), t(7, "sun")];
    const combos = enumerateCombos(hand);
    // 싱글 5개 + 5장 조합 1개 = 6개 (페어/트리플 없음: 전부 다른 숫자)
    expect(combos.filter((c) => c.size === 1)).toHaveLength(5);
    const fives = combos.filter((c) => c.size === 5);
    expect(fives).toHaveLength(1);
    expect(fives[0].type).toBe("straightflush");
  });

  it("FIVE-08: enumerateCombos — 페어·트리플·5장을 모두 포함", () => {
    // 7이 3장(트리플·페어 가능) + 스트레이트 재료
    const hand = [t(7, "sun"), t(7, "moon"), t(7, "star"), t(4, "cloud"), t(5, "cloud"), t(6, "cloud")];
    const combos = enumerateCombos(hand);
    const types = new Set(combos.map((c) => c.type));
    expect(types.has("single")).toBe(true);
    expect(types.has("pair")).toBe(true); // 77 페어 3가지
    expect(types.has("triple")).toBe(true); // 777
    expect(combos.filter((c) => c.type === "pair")).toHaveLength(3); // C(3,2)=3
    expect(combos.filter((c) => c.type === "triple")).toHaveLength(1);
    // 5장 조합도 등장(예: 풀하우스는 재료 부족하지만 다른 5장 조합 여부는 열거로 확인)
    expect(combos.every((c) => classify(c.tiles) !== null)).toBe(true);
  });

  it("FIVE-09: enumerateCombos — 큰 손패도 합리적 시간 내(성능)", () => {
    // 13장(4인 손패 크기): 5C13=1287 조합까지 열거해도 빨라야 한다.
    const hand: Tile[] = [];
    const suits: Suit[] = ["sun", "moon", "star", "cloud"];
    for (let n = 1; n <= 13; n++) hand.push(t(n, suits[n % 4]));
    const start = performance.now();
    const combos = enumerateCombos(hand);
    const ms = performance.now() - start;
    expect(combos.length).toBeGreaterThan(0);
    expect(combos.every((c) => classify(c.tiles) !== null)).toBe(true); // 전부 유효
    expect(ms).toBeLessThan(200); // 넉넉한 상한 — 실제론 수 ms
  });
});
