/**
 * fairness.ts — 등급·격차·평균·카피·스타일 (설계서 §2-4).
 *
 * 색=공평도 불변식. 등급 경계(10/11/20/21)가 제품 의미의 전부.
 */
import { describe, it, expect } from "vitest";
import {
  gapOf,
  avgOf,
  fairLevel,
  fairCopy,
  FAIR_STYLE,
  type MemberTime,
} from "@/lib/moira/fairness";

const mt = (minutes: number, transfers?: number): MemberTime => ({
  name: "x",
  minutes,
  ...(transfers !== undefined ? { transfers } : {}),
});

describe("fairness — fairLevel 경계 (§2-4)", () => {
  it("FA-01: gap=10 → good (≤10)", () => {
    expect(fairLevel(10)).toBe("good");
  });
  it("FA-02: gap=11 → mid", () => {
    expect(fairLevel(11)).toBe("mid");
  });
  it("FA-03: gap=20 → mid (≤20)", () => {
    expect(fairLevel(20)).toBe("mid");
  });
  it("FA-04: gap=21 → bad (>20)", () => {
    expect(fairLevel(21)).toBe("bad");
  });
  it("FA-05: gap=0 → good", () => {
    expect(fairLevel(0)).toBe("good");
  });
  it("FA-06: gap=-5 → good (≤10 분기, 함수 계약 회귀가드)", () => {
    expect(fairLevel(-5)).toBe("good");
  });
});

describe("fairness — gapOf (§2-4)", () => {
  it("FA-07: [22,28,26,24] → 6 (28-22)", () => {
    expect(gapOf([mt(22), mt(28), mt(26), mt(24)])).toBe(6);
  });
  it("FA-08: 단일 멤버 [30] → 0 (max==min)", () => {
    expect(gapOf([mt(30)])).toBe(0);
  });
  it("FA-09: 빈 배열 [] → 0 (length===0 가드)", () => {
    expect(gapOf([])).toBe(0);
  });
  it("FA-10: 전원 동일시간 [20,20,20] → 0", () => {
    expect(gapOf([mt(20), mt(20), mt(20)])).toBe(0);
  });
});

describe("fairness — avgOf (§2-4)", () => {
  it("FA-11: [20,21] → 21 (평균20.5, Math.round .5 올림)", () => {
    expect(avgOf([mt(20), mt(21)])).toBe(21);
  });
  it("FA-12: 빈 배열 [] → 0", () => {
    expect(avgOf([])).toBe(0);
  });
  it("FA-13: nogari(22,28,26,24) → 25 (평균25)", () => {
    expect(avgOf([mt(22), mt(28), mt(26), mt(24)])).toBe(25);
  });
});

describe("fairness — fairCopy (§2-4)", () => {
  it('FA-14: gap6 → "격차 6분 · 가장 공평"(good label)', () => {
    expect(fairCopy([mt(22), mt(28)])).toBe("격차 6분 · 가장 공평");
  });
  it('FA-15: gap25 → "격차 25분 · 격차 큼"(bad label)', () => {
    expect(fairCopy([mt(20), mt(45)])).toBe("격차 25분 · 격차 큼");
  });
});

describe("fairness — FAIR_STYLE (§2-4)", () => {
  it("FA-16: 키 완전성 + 각 객체 7필드", () => {
    expect(Object.keys(FAIR_STYLE).sort()).toEqual(["bad", "good", "mid"]);
    const fields = ["bar", "barSoft", "text", "chipBg", "chipText", "ring", "label"] as const;
    (["good", "mid", "bad"] as const).forEach((lvl) => {
      fields.forEach((f) => {
        expect(FAIR_STYLE[lvl]).toHaveProperty(f);
        expect(typeof FAIR_STYLE[lvl][f]).toBe("string");
      });
    });
  });
  it("FA-17: 색=공평도 매핑 불변 — label 의미 회귀가드", () => {
    expect(FAIR_STYLE.good.label).toBe("가장 공평");
    expect(FAIR_STYLE.mid.label).toBe("공평한 편");
    expect(FAIR_STYLE.bad.label).toBe("격차 큼");
  });
});

describe("fairness — transfers 무시 (§2-4)", () => {
  it("FA-18: transfers는 gap에 영향 없음 → gapOf=4", () => {
    expect(gapOf([mt(20, 5), mt(24, 0)])).toBe(4);
  });
});
