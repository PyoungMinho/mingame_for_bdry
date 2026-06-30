/**
 * 룰 엔진 속성 기반(fast-check) 테스트.
 *
 * 셔플 멀티셋 보존·딜 합 보존·비교 반대칭성 등 "어떤 입력에도" 성립해야 하는 불변식.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  buildDeck,
  shuffle,
  makeRng,
  deal,
  tileStrength,
  tileId,
  SUITS,
  type Suit,
} from "@/lib/pae/tiles";
import { classify, compareCombos, canBeat } from "@/lib/pae/combos";

const suitArb = fc.constantFrom<Suit>(...SUITS);
const tileArb = fc.record({ n: fc.integer({ min: 1, max: 15 }), suit: suitArb });

describe("rules.property — 타일·셔플·딜 불변식", () => {
  it("RP-01: 전체 덱 강함은 0~59 고유", () => {
    expect(new Set(buildDeck(15).map(tileStrength)).size).toBe(60);
  });
  it("RP-02: ∀ seed : shuffle은 멀티셋 보존", () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const deck = buildDeck(15);
        const sh = shuffle(deck, makeRng(seed));
        return (
          JSON.stringify(sh.map(tileId).sort()) === JSON.stringify(deck.map(tileId).sort())
        );
      }),
    );
  });
  it("RP-03: ∀ (인원, seed) : 딜 합=덱, 각자 perPlayer장", () => {
    fc.assert(
      fc.property(fc.constantFrom(3, 4, 5), fc.integer(), (pc, seed) => {
        const { hands, config } = deal(pc, makeRng(seed));
        const all = hands.flat();
        if (all.length !== config.maxNumber * 4) return false;
        if (hands.some((h) => h.length !== config.perPlayer)) return false;
        return new Set(all.map(tileId)).size === config.maxNumber * 4;
      }),
    );
  });
});

describe("rules.property — 비교 일관성", () => {
  it("RP-04: ∀ 두 싱글 : sign(cmp(a,b)) === -sign(cmp(b,a)) (반대칭)", () => {
    fc.assert(
      fc.property(tileArb, tileArb, (x, y) => {
        const a = classify([x])!;
        const b = classify([y])!;
        return Math.sign(compareCombos(a, b)) === -Math.sign(compareCombos(b, a));
      }),
    );
  });
  it("RP-05: ∀ 싱글 : 자기 자신은 못 이긴다", () => {
    fc.assert(
      fc.property(tileArb, (x) => {
        const a = classify([x])!;
        const b = classify([x])!;
        return !canBeat(a, b) && !canBeat(b, a);
      }),
    );
  });
  it("RP-06: ∀ 서로 다른 두 싱글 : 정확히 한 쪽만 이긴다", () => {
    fc.assert(
      fc.property(tileArb, tileArb, (x, y) => {
        if (tileStrength(x) === tileStrength(y)) return true; // 동일 타일은 건너뜀
        const a = classify([x])!;
        const b = classify([y])!;
        return canBeat(a, b) !== canBeat(b, a);
      }),
    );
  });
});
