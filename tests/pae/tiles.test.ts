/**
 * tiles.ts — 타일 강함·덱·셔플·딜 단위 테스트.
 *
 * 불변식: 숫자 강함 2>1>15>…>3, 색 강함 해>달>별>구름,
 * 딜은 (인원 × 장수)에 딱 맞게 높은 숫자를 제거한다.
 */
import { describe, it, expect } from "vitest";
import {
  numberRank,
  tileStrength,
  buildDeck,
  makeRng,
  shuffle,
  deal,
  startingPlayer,
  tileId,
  tileEquals,
  DEAL_CONFIG,
} from "@/lib/pae/tiles";

describe("tiles — 숫자 강함 (numberRank)", () => {
  it("TILE-01: 3이 최약(0)", () => expect(numberRank(3)).toBe(0));
  it("TILE-02: 15 → 12", () => expect(numberRank(15)).toBe(12));
  it("TILE-03: 1 → 13", () => expect(numberRank(1)).toBe(13));
  it("TILE-04: 2가 최강(14)", () => expect(numberRank(2)).toBe(14));
  it("TILE-05: 순서 2>1>15>3", () => {
    expect(numberRank(2)).toBeGreaterThan(numberRank(1));
    expect(numberRank(1)).toBeGreaterThan(numberRank(15));
    expect(numberRank(15)).toBeGreaterThan(numberRank(3));
  });
});

describe("tiles — 타일 강함 (tileStrength)", () => {
  it("TILE-06: 구름3이 절대 최약(0)", () => expect(tileStrength({ n: 3, suit: "cloud" })).toBe(0));
  it("TILE-07: 해2가 절대 최강(59)", () => expect(tileStrength({ n: 2, suit: "sun" })).toBe(59));
  it("TILE-08: 같은 숫자는 색으로 (해>달>별>구름)", () => {
    expect(tileStrength({ n: 7, suit: "sun" })).toBeGreaterThan(tileStrength({ n: 7, suit: "moon" }));
    expect(tileStrength({ n: 7, suit: "moon" })).toBeGreaterThan(tileStrength({ n: 7, suit: "star" }));
    expect(tileStrength({ n: 7, suit: "star" })).toBeGreaterThan(tileStrength({ n: 7, suit: "cloud" }));
  });
  it("TILE-09: 전체 덱 60종 강함이 0~59 고유", () => {
    const s = buildDeck(15).map(tileStrength);
    expect(new Set(s).size).toBe(60);
    expect(Math.min(...s)).toBe(0);
    expect(Math.max(...s)).toBe(59);
  });
});

describe("tiles — 덱·셔플", () => {
  it("TILE-10: buildDeck(15)=60장, 중복 없음", () => {
    const d = buildDeck(15);
    expect(d).toHaveLength(60);
    expect(new Set(d.map(tileId)).size).toBe(60);
  });
  it("TILE-11: makeRng 결정적(같은 시드 같은 수열)", () => {
    const a = makeRng(42);
    const b = makeRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it("TILE-12: shuffle은 멀티셋 보존·비파괴", () => {
    const deck = buildDeck(15);
    const sh = shuffle(deck, makeRng(7));
    expect(sh).toHaveLength(60);
    expect(new Set(sh.map(tileId))).toEqual(new Set(deck.map(tileId)));
    expect(deck.map(tileId)).toEqual(buildDeck(15).map(tileId)); // 원본 불변
  });
});

describe("tiles — 딜", () => {
  for (const [pc, cfg] of Object.entries(DEAL_CONFIG)) {
    it(`TILE-13(${pc}인): 각자 ${cfg.perPlayer}장`, () => {
      const { hands } = deal(Number(pc), makeRng(1));
      expect(hands).toHaveLength(Number(pc));
      hands.forEach((h) => expect(h).toHaveLength(cfg.perPlayer));
    });
  }
  it("TILE-14: 분배 합 = 덱 전체(누락·중복 없음)", () => {
    const { hands, config } = deal(5, makeRng(99));
    const all = hands.flat().map(tileId);
    expect(all).toHaveLength(60);
    expect(new Set(all)).toEqual(new Set(buildDeck(config.maxNumber).map(tileId)));
  });
  it("TILE-15: 4인은 14·15 미사용(최대 숫자 13)", () => {
    const { hands } = deal(4, makeRng(3));
    expect(Math.max(...hands.flat().map((t) => t.n))).toBe(13);
  });
  it("TILE-16: 지원 안 하는 인원수는 예외", () => {
    expect(() => deal(2, makeRng(1))).toThrow();
    expect(() => deal(6, makeRng(1))).toThrow();
  });
  it("TILE-17: 손패는 약→강 정렬", () => {
    const { hands } = deal(5, makeRng(5));
    hands.forEach((h) => {
      const s = h.map(tileStrength);
      expect(s).toEqual([...s].sort((a, b) => a - b));
    });
  });
  it("TILE-18: 구름3 보유자가 시작 플레이어", () => {
    const { hands } = deal(5, makeRng(5));
    const idx = startingPlayer(hands);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(hands[idx].some((t) => tileEquals(t, { n: 3, suit: "cloud" }))).toBe(true);
  });
});
