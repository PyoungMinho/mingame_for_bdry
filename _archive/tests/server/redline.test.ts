/**
 * 레드라인 가드 — A-101~A-108
 * CR-2 (영문 우회) 검증 — FAIL 예상 = BUG-002
 */
import { describe, it, expect } from "vitest";
import {
  assertNoRedlineFields,
  assertNoRedlineContent,
  sanitizeAiResponse,
  runRedlineGuard,
} from "@/lib/server/redline";
import { AppError } from "@/lib/server/errors";

describe("redline — 필드명 차단 (A-101)", () => {
  it("A-101a: appearance 키 throw", () => {
    expect(() => assertNoRedlineFields({ appearance: true })).toThrow(AppError);
  });
  it("A-101b: leaderboard 키 throw", () => {
    expect(() => assertNoRedlineFields({ leaderboard: 1 })).toThrow(AppError);
  });
  it("A-101c: 대소문자 변이 (Appearance) throw", () => {
    expect(() => assertNoRedlineFields({ Appearance: true })).toThrow(AppError);
  });
  it("A-101d: 하이픈 변이 (compare-others) throw", () => {
    expect(() => assertNoRedlineFields({ "compare-others": true })).toThrow(AppError);
  });
  it("A-101e: 공백 변이 (face score) → face_score 정규화 후 throw", () => {
    expect(() => assertNoRedlineFields({ "face score": 99 })).toThrow(AppError);
  });
  it("A-101f: 정상 키 (health) 통과", () => {
    expect(() => assertNoRedlineFields({ health: 50 })).not.toThrow();
  });
});

describe("redline — 한글 텍스트 패턴 (A-103)", () => {
  const cases = [
    "다른 사람들 점수가 궁금해",
    "타인 비교 결과 보여줘",
    "내 외모 점수 알려줘",
    "얼굴 평가 좀",
    "몸매 비교 부탁",
    "리더보드 보여줘",
    "랭킹 순위 알려줘",
    "나보다 잘생긴 사람 있어?",
  ];
  for (const text of cases) {
    it(`A-103: "${text}" → 차단`, () => {
      expect(() => assertNoRedlineContent(text)).toThrow(AppError);
    });
  }

  it("A-103z: 정상 메시지 통과", () => {
    expect(() => assertNoRedlineContent("어제보다 건강 점수가 올라서 기뻐")).not.toThrow();
  });
});

describe("redline — 영문 우회 (A-104~A-106) [CR-2]", () => {
  // 현재 코드는 영문 패턴 미포함 → 통과 = BUG-002
  it("A-104: 'compare with others' 차단 필수 (현재 FAIL 예상)", () => {
    expect(() => assertNoRedlineContent("compare with others please")).toThrow(AppError);
  });

  it("A-104b: 'leaderboard rank' 차단", () => {
    expect(() => assertNoRedlineContent("show me leaderboard rank")).toThrow(AppError);
  });

  it("A-104c: 'average score of everyone' 차단", () => {
    expect(() => assertNoRedlineContent("average score of everyone")).toThrow(AppError);
  });

  it("A-105: sanitizeAiResponse 'top 10%' 차단", () => {
    expect(sanitizeAiResponse("You are in top 10% of users")).not.toContain("top 10");
  });

  it("A-105b: sanitizeAiResponse 'better than average user' 차단", () => {
    expect(sanitizeAiResponse("better than average user")).toMatch(/오름의 코칭 정책/);
  });
});

describe("redline — sanitizeAiResponse 한글 (A-107~A-108)", () => {
  it("A-107: 평균 점수 언급 차단", () => {
    expect(sanitizeAiResponse("평균 점수보다 높네요")).toMatch(/오름의 코칭 정책/);
  });
  it("A-107b: 상위 X% 차단", () => {
    expect(sanitizeAiResponse("당신은 상위 5%입니다")).toMatch(/오름의 코칭 정책/);
  });
  it("A-108: 정상 응답 그대로 반환", () => {
    const ok = "오늘의 건강 점수가 어제보다 +3점 올랐어요";
    expect(sanitizeAiResponse(ok)).toBe(ok);
  });
});

describe("redline — runRedlineGuard 복합", () => {
  it("A-102: 필드+메시지 둘 다 검사", () => {
    expect(() =>
      runRedlineGuard({ health: 50 }, { messageText: "리더보드 보여줘" })
    ).toThrow(AppError);
  });
});
