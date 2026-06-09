// REDLINE: 타인 비교/외모 점수 UI 금지
/**
 * 단답형 즉시채점 회귀 테스트 — QA에서 발견된 동치성 버그 방지.
 *
 * 발견: 데모/라이브 단답형에서 학생이 의미상 정답을 입력해도
 *  - 과학 "1.50" 정답을 "1.5"로 입력 → 소수점 trailing 0 때문에 오답 처리
 *  - 공백/대소문자 차이로 오답 처리
 * 이던 문제. answersMatch가 숫자는 수치로, 텍스트는 정규화 비교로 막는다.
 */
import { describe, it, expect } from "vitest";
import { answersMatch, normAnswer, parseNumeric } from "@/lib/grading";

describe("answersMatch — 숫자 동치 (과학/수학 단답)", () => {
  it("1.50 정답을 1.5로 입력해도 정답", () => {
    expect(answersMatch("1.50", "1.5")).toBe(true);
  });
  it("6.00 == 6, 0.67 == .67, 2.00 == 2", () => {
    expect(answersMatch("6.00", "6")).toBe(true);
    expect(answersMatch("0.67", ".67")).toBe(true);
    expect(answersMatch("2.00", "2")).toBe(true);
  });
  it("앞뒤 공백·천단위 콤마 허용", () => {
    expect(answersMatch("1.50", "  1.5 ")).toBe(true);
    expect(answersMatch("1000", "1,000")).toBe(true);
  });
  it("수치가 다르면 오답", () => {
    expect(answersMatch("1.50", "2.0")).toBe(false);
    expect(answersMatch("0.67", "0.68")).toBe(false);
  });
});

describe("answersMatch — 텍스트 정규화 (용어/단어 단답)", () => {
  it("대소문자·공백 차이를 무시", () => {
    expect(answersMatch("decide", " Decide ")).toBe(true);
    expect(answersMatch("기회비용", " 기회비용 ")).toBe(true);
  });
  it("의미가 다른 답은 오답", () => {
    expect(answersMatch("기회비용", "매몰비용")).toBe(false);
    expect(answersMatch("decide", "decides")).toBe(false);
  });
  it("숫자 정답에 문자 입력은 오답 (수치비교 경로로 빠지지 않음)", () => {
    expect(answersMatch("1.50", "약 1.5")).toBe(false);
  });
});

describe("parseNumeric — 숫자 판별 경계", () => {
  it("순수 숫자만 number로", () => {
    expect(parseNumeric("3.14")).toBe(3.14);
    expect(parseNumeric(".5")).toBe(0.5);
    expect(parseNumeric("-3")).toBe(-3);
  });
  it("빈 문자열·기호·단위는 null", () => {
    expect(parseNumeric("")).toBeNull();
    expect(parseNumeric("-")).toBeNull();
    expect(parseNumeric("5m/s")).toBeNull();
    expect(parseNumeric("1.2.3")).toBeNull();
  });
});

describe("normAnswer", () => {
  it("공백·대소문자·마침표/쉼표 제거", () => {
    expect(normAnswer(" A, b. C ")).toBe("abc");
  });
});
