/**
 * UT-01 ~ UT-07 — 금액 포맷 유틸 (한국식 억/만원).
 * 대상: src/lib/utils.ts — formatManwon / formatDepositRent
 * QA설계자 케이스 매트릭스 §2.2.
 */
import { describe, it, expect } from "vitest";
import { formatManwon, formatDepositRent } from "@/lib/utils";

describe("formatManwon — 만원 단위 한국식 표기", () => {
  it("UT-01: 0 → '0'", () => {
    expect(formatManwon(0)).toBe("0");
  });
  it("UT-02: 500 → '500만'", () => {
    expect(formatManwon(500)).toBe("500만");
  });
  it("UT-03: 10000 → '1억'", () => {
    expect(formatManwon(10000)).toBe("1억");
  });
  it("UT-04: 11500 → '1억 1,500만'", () => {
    expect(formatManwon(11500)).toBe("1억 1,500만");
  });
  it("추가: 20000 → '2억' (만원 단위 0이면 만 생략)", () => {
    expect(formatManwon(20000)).toBe("2억");
  });
  it("추가: 9999 → '9,999만' (천단위 콤마)", () => {
    expect(formatManwon(9999)).toBe("9,999만");
  });

  it("UT-07 [현재동작 고정 / BUG: BUG-06]: 음수 -100 → '' (빈 문자열)", () => {
    // ⚠ 실측: -100 은 truthy 라 falsy 가드를 통과하지만,
    //   eok=Math.floor(-100/10000)=0(>0 아님), rest=-100%10000=-100(>0 아님) → 두 파트 모두 스킵 → "".
    //   기대상으로는 음수 입력 자체가 발생해선 안 되지만, 발생 시 "0" 또는 명시적 처리가 안전.
    //   본 테스트는 "현재 동작(빈 문자열)"을 회귀 고정. docs/qa/bug-report.md BUG-06 참조.
    expect(formatManwon(-100)).toBe("");
  });
});

describe("formatDepositRent — 보증금/월세 표기", () => {
  it("UT-05: (1000, 0) → '전세 1,000만' (월세 0 = 전세)", () => {
    expect(formatDepositRent(1000, 0)).toBe("전세 1,000만");
  });
  it("UT-06: (1000, 50) → '1,000만 / 월 50'", () => {
    expect(formatDepositRent(1000, 50)).toBe("1,000만 / 월 50");
  });
  it("추가: (10000, 0) → '전세 1억'", () => {
    expect(formatDepositRent(10000, 0)).toBe("전세 1억");
  });
  it("추가: (5000, 70) → '5,000만 / 월 70'", () => {
    expect(formatDepositRent(5000, 70)).toBe("5,000만 / 월 70");
  });
});
