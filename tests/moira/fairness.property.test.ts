/**
 * fairness.ts — 속성 기반(fast-check) (설계서 §2-5).
 *
 * gap 비음수·정의·avg 범위·level 단조성·전역 정의역·단일멤버 good.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { gapOf, avgOf, fairLevel, type MemberTime } from "@/lib/moira/fairness";

// 멤버: minutes∈int[0,300], 1~8명
const membersArb = (min = 1) =>
  fc.array(
    fc.integer({ min: 0, max: 300 }).map((minutes): MemberTime => ({ name: "x", minutes })),
    { minLength: min, maxLength: 8 }
  );

const severity: Record<string, number> = { good: 0, mid: 1, bad: 2 };

describe("fairness.property (§2-5)", () => {
  it("FAP-01: ∀ members(1~8명) : gapOf >= 0", () => {
    fc.assert(
      fc.property(membersArb(1), (members) => gapOf(members) >= 0)
    );
  });

  it("FAP-02: ∀ members : gapOf === max-min", () => {
    fc.assert(
      fc.property(membersArb(1), (members) => {
        const xs = members.map((m) => m.minutes);
        return gapOf(members) === Math.max(...xs) - Math.min(...xs);
      })
    );
  });

  it("FAP-03: ∀ members(비어있지 않음) : min <= avg <= max (정수 minutes)", () => {
    fc.assert(
      fc.property(membersArb(1), (members) => {
        const xs = members.map((m) => m.minutes);
        const a = avgOf(members);
        return a >= Math.min(...xs) && a <= Math.max(...xs);
      })
    );
  });

  it("FAP-04: ∀ g1<g2 (정수) : severity(level(g1)) <= severity(level(g2)) — 단조성", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10, max: 1000 }),
        fc.integer({ min: -10, max: 1000 }),
        (a, b) => {
          const g1 = Math.min(a, b);
          const g2 = Math.max(a, b);
          return severity[fairLevel(g1)] <= severity[fairLevel(g2)];
        }
      )
    );
  });

  it("FAP-05: ∀ g∈int[-10,1000] : fairLevel(g)∈{good,mid,bad}", () => {
    fc.assert(
      fc.property(fc.integer({ min: -10, max: 1000 }), (g) =>
        ["good", "mid", "bad"].includes(fairLevel(g))
      )
    );
  });

  it("FAP-06: ∀ 단일멤버 : gapOf===0 且 fairLevel(0)==='good'", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 300 }), (m) => {
        const g = gapOf([{ name: "x", minutes: m }]);
        return g === 0 && fairLevel(g) === "good";
      })
    );
  });
});
