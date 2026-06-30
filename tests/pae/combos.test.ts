/**
 * combos.ts — 조합 판정·비교 단위 테스트.
 *
 * 핵심: 5장 족보 위계(스트<플러시<풀하<포카드<스플),
 * 스트레이트는 자연수 최고값으로 비교(11-15가 최강, 1 wrap 없음),
 * 풀하우스/포카드는 트리플/포카드 부분으로만 비교.
 */
import { describe, it, expect } from "vitest";
import { classify, compareCombos, canBeat, type Combo } from "@/lib/pae/combos";
import type { Tile, Suit } from "@/lib/pae/tiles";

const t = (n: number, suit: Suit): Tile => ({ n, suit });
const C = (tiles: Tile[]): Combo => {
  const c = classify(tiles);
  if (!c) throw new Error(`테스트 오류: 유효하지 않은 조합 ${JSON.stringify(tiles)}`);
  return c;
};

describe("combos — 기본 조합 판정", () => {
  it("COMBO-01: 싱글", () => expect(classify([t(5, "sun")])?.type).toBe("single"));
  it("COMBO-02: 페어(같은 숫자)", () => expect(classify([t(9, "sun"), t(9, "cloud")])?.type).toBe("pair"));
  it("COMBO-03: 다른 숫자 2장 = 무효", () => expect(classify([t(9, "sun"), t(8, "cloud")])).toBeNull());
  it("COMBO-04: 트리플", () => expect(classify([t(9, "sun"), t(9, "cloud"), t(9, "star")])?.type).toBe("triple"));
  it("COMBO-05: 2+1 = 무효", () => expect(classify([t(9, "sun"), t(9, "cloud"), t(8, "star")])).toBeNull());
  it("COMBO-06: 4장 단독 = 무효", () =>
    expect(classify([t(9, "sun"), t(9, "cloud"), t(9, "star"), t(9, "moon")])).toBeNull());
});

describe("combos — 5장 족보 판정", () => {
  it("COMBO-07: 스트레이트 1-2-3-4-5", () =>
    expect(classify([t(1, "sun"), t(2, "moon"), t(3, "star"), t(4, "cloud"), t(5, "sun")])?.type).toBe("straight"));
  it("COMBO-08: 스트레이트 11-12-13-14-15", () =>
    expect(classify([t(11, "sun"), t(12, "moon"), t(13, "star"), t(14, "cloud"), t(15, "sun")])?.type).toBe(
      "straight",
    ));
  it("COMBO-09: wrap(12-13-14-15-1)은 스트레이트 아님 → 무효", () =>
    expect(classify([t(12, "sun"), t(13, "moon"), t(14, "star"), t(15, "cloud"), t(1, "sun")])).toBeNull());
  it("COMBO-10: 비연속 = 무효", () =>
    expect(classify([t(3, "sun"), t(4, "moon"), t(5, "star"), t(6, "cloud"), t(8, "sun")])).toBeNull());
  it("COMBO-11: 플러시(같은 색·비연속)", () =>
    expect(classify([t(3, "sun"), t(6, "sun"), t(8, "sun"), t(10, "sun"), t(13, "sun")])?.type).toBe("flush"));
  it("COMBO-12: 풀하우스(3+2)", () =>
    expect(classify([t(7, "sun"), t(7, "moon"), t(7, "star"), t(4, "sun"), t(4, "cloud")])?.type).toBe("fullhouse"));
  it("COMBO-13: 포카드+1", () =>
    expect(classify([t(7, "sun"), t(7, "moon"), t(7, "star"), t(7, "cloud"), t(4, "sun")])?.type).toBe("fourplus"));
  it("COMBO-14: 스트레이트 플러시(연속+같은색)", () =>
    expect(classify([t(3, "sun"), t(4, "sun"), t(5, "sun"), t(6, "sun"), t(7, "sun")])?.type).toBe("straightflush"));
  it("COMBO-15: 투페어 = 무효", () =>
    expect(classify([t(7, "sun"), t(7, "moon"), t(4, "sun"), t(4, "cloud"), t(9, "star")])).toBeNull());
});

describe("combos — 같은 종류 비교", () => {
  it("COMBO-16: 싱글 2>1>15>3", () => {
    expect(canBeat(C([t(2, "cloud")]), C([t(1, "cloud")]))).toBe(true);
    expect(canBeat(C([t(1, "cloud")]), C([t(15, "cloud")]))).toBe(true);
    expect(canBeat(C([t(15, "cloud")]), C([t(3, "cloud")]))).toBe(true);
  });
  it("COMBO-17: 싱글 같은 숫자는 색으로(해>구름)", () =>
    expect(canBeat(C([t(7, "sun")]), C([t(7, "cloud")]))).toBe(true));
  it("COMBO-18: 트리플 9 > 트리플 7", () =>
    expect(
      canBeat(C([t(9, "sun"), t(9, "moon"), t(9, "star")]), C([t(7, "sun"), t(7, "moon"), t(7, "star")])),
    ).toBe(true));
  it("COMBO-19: 스트레이트 11-15 > 1-5 (자연수 최고값)", () => {
    const high = C([t(11, "sun"), t(12, "moon"), t(13, "star"), t(14, "cloud"), t(15, "sun")]);
    const low = C([t(1, "sun"), t(2, "moon"), t(3, "star"), t(4, "cloud"), t(5, "sun")]);
    expect(canBeat(high, low)).toBe(true);
    expect(canBeat(low, high)).toBe(false);
  });
  it("COMBO-20: 풀하우스는 트리플로 비교(킥커 무관)", () => {
    const a = C([t(7, "sun"), t(7, "moon"), t(7, "star"), t(2, "sun"), t(2, "cloud")]); // 트리플7 + 킥커22
    const b = C([t(4, "sun"), t(4, "moon"), t(4, "star"), t(15, "sun"), t(15, "cloud")]); // 트리플4 + 킥커15
    expect(canBeat(a, b)).toBe(true);
  });
});

describe("combos — 5장 족보 위계", () => {
  const straight = C([t(3, "sun"), t(4, "moon"), t(5, "star"), t(6, "cloud"), t(7, "sun")]);
  const flush = C([t(3, "sun"), t(6, "sun"), t(8, "sun"), t(10, "sun"), t(13, "sun")]);
  const full = C([t(5, "sun"), t(5, "moon"), t(5, "star"), t(9, "sun"), t(9, "cloud")]);
  const quad = C([t(5, "sun"), t(5, "moon"), t(5, "star"), t(5, "cloud"), t(9, "sun")]);
  const sf = C([t(3, "sun"), t(4, "sun"), t(5, "sun"), t(6, "sun"), t(7, "sun")]);
  it("COMBO-21: 플러시 > 스트레이트", () => expect(canBeat(flush, straight)).toBe(true));
  it("COMBO-22: 풀하우스 > 플러시", () => expect(canBeat(full, flush)).toBe(true));
  it("COMBO-23: 포카드 > 풀하우스", () => expect(canBeat(quad, full)).toBe(true));
  it("COMBO-24: 스트레이트플러시 > 포카드", () => expect(canBeat(sf, quad)).toBe(true));
});

describe("combos — canBeat 규칙", () => {
  it("COMBO-25: 크기 다르면 못 받음", () => {
    const single = C([t(9, "sun")]);
    const pair = C([t(9, "sun"), t(9, "cloud")]);
    expect(canBeat(pair, single)).toBe(false);
    expect(canBeat(single, pair)).toBe(false);
  });
  it("COMBO-26: 동률(자기 자신)은 못 받음", () =>
    expect(canBeat(C([t(9, "sun"), t(9, "cloud")]), C([t(9, "sun"), t(9, "cloud")]))).toBe(false));
  it("COMBO-27: 크기 다른 비교는 예외", () =>
    expect(() => compareCombos(C([t(9, "sun")]), C([t(9, "sun"), t(9, "cloud")]))).toThrow());
});
