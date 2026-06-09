/**
 * 엔진 ↔ 교육과정 연동 (해자 1·2): 배점(points) 정규화 + 단원(unitId) 보존.
 *
 * 시험지의 [N점] 표기와 해설지 단원 꼬리표는 이 두 필드에 전적으로 의존한다.
 * normalizeVariant(LLM 경로)·demoResult(데모 경로) 양쪽에서
 * points가 항상 2~4로 보장되고 unitId가 그대로 흘러가는지 못박는다.
 */
import { describe, it, expect } from "vitest";
import { normalizeVariant, generateVariants } from "@/lib/server/exam-engine";
import { makeBody, withExamKey } from "./_helpers";
import { CURRICULUM } from "@/lib/exam/curriculum";
import type { GenerateRequestBody } from "@/lib/exam/types";

async function gen(body: Partial<GenerateRequestBody>) {
  return withExamKey(undefined, () => generateVariants(makeBody(body)));
}

/** 실제 존재하는 단원 id(데이터에서 추출 — 하드코딩 오타 방지) */
const SAMPLE_UNIT = CURRICULUM[0].units[0].id;

describe("배점(points) — normalizeVariant 정규화", () => {
  it("PT-01: LLM이 준 정수 배점 보존", () => {
    expect(normalizeVariant({ stem: "q", points: 4 }, makeBody())!.points).toBe(4);
  });

  it("PT-02: 문자열 숫자도 파싱 ('3' → 3)", () => {
    expect(normalizeVariant({ stem: "q", points: "3" }, makeBody())!.points).toBe(3);
  });

  it("PT-03: 범위 밖 값은 2~4로 클램프 (7 → 4, 1 → 2)", () => {
    expect(normalizeVariant({ stem: "q", points: 7 }, makeBody())!.points).toBe(4);
    expect(normalizeVariant({ stem: "q", points: 1 }, makeBody())!.points).toBe(2);
  });

  it("PT-04: 배점 없으면 난이도 기본값 (easy=2, medium=3, hard=4)", () => {
    expect(normalizeVariant({ stem: "q" }, makeBody({ difficulty: "easy" }))!.points).toBe(2);
    expect(normalizeVariant({ stem: "q" }, makeBody({ difficulty: "medium" }))!.points).toBe(3);
    expect(normalizeVariant({ stem: "q" }, makeBody({ difficulty: "hard" }))!.points).toBe(4);
  });

  it("PT-05: 파싱 불가 문자열은 난이도 기본값으로 폴백", () => {
    expect(
      normalizeVariant({ stem: "q", points: "abc" }, makeBody({ difficulty: "hard" }))!.points
    ).toBe(4);
    expect(
      normalizeVariant({ stem: "q", points: "" }, makeBody({ difficulty: "easy" }))!.points
    ).toBe(2);
  });
});

describe("배점(points) — demoResult 경로", () => {
  it("PT-10: demo 변형 전부 2~4점 정수", async () => {
    const r = await gen({ count: 5 });
    r.variants.forEach((v) => {
      expect(Number.isInteger(v.points)).toBe(true);
      expect(v.points!).toBeGreaterThanOrEqual(2);
      expect(v.points!).toBeLessThanOrEqual(4);
    });
  });

  it("PT-11: demo 배점이 난이도를 따름 (easy=2, hard=4)", async () => {
    const easy = await gen({ difficulty: "easy", count: 2 });
    easy.variants.forEach((v) => expect(v.points).toBe(2));
    const hard = await gen({ difficulty: "hard", count: 2 });
    hard.variants.forEach((v) => expect(v.points).toBe(4));
  });
});

describe("단원(unitId) — 주입/에코", () => {
  it("UN-01: body.unitId가 normalizeVariant 결과에 보존", () => {
    const v = normalizeVariant({ stem: "q" }, makeBody({ unitId: SAMPLE_UNIT }));
    expect(v!.unitId).toBe(SAMPLE_UNIT);
  });

  it("UN-02: unitId 미지정이면 undefined", () => {
    expect(normalizeVariant({ stem: "q" }, makeBody())!.unitId).toBeUndefined();
  });

  it("UN-03: demo 변형이 unitId를 에코백", async () => {
    const r = await gen({ subject: CURRICULUM[0].subject, unitId: SAMPLE_UNIT, count: 3 });
    r.variants.forEach((v) => expect(v.unitId).toBe(SAMPLE_UNIT));
  });

  it("UN-04: unitId 미지정 demo 변형은 unitId undefined", async () => {
    const r = await gen({ count: 2 });
    r.variants.forEach((v) => expect(v.unitId).toBeUndefined());
  });
});
