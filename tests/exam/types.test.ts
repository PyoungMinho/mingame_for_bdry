/**
 * 타입/상수 일관성 (설계서 §2.10)
 * SUBJECTS/DIFFICULTIES/QUESTION_TYPES가 zod enum·엔진 라벨 키와 동기화되는지,
 * 모든 과목에 demoResult 빌더가 존재하는지(런타임 undefined 방지) 검증.
 */
import { describe, it, expect } from "vitest";
import {
  SUBJECTS,
  DIFFICULTIES,
  QUESTION_TYPES,
  type Subject,
} from "@/lib/exam/types";
import { generateVariants } from "@/lib/server/exam-engine";
import { withExamKey, makeBody } from "./_helpers";

// route.ts BodySchema의 enum과 동기화되어야 하는 진실값(설계서에 명시된 집합)
const ZOD_SUBJECTS = ["english", "math", "korean", "science", "social"];
const ZOD_DIFFICULTIES = ["easy", "medium", "hard"];
const ZOD_TYPES = ["multiple_choice", "short_answer"];

describe("타입/상수 일관성", () => {
  it("TY-01: SUBJECTS id 집합 == zod subject enum", () => {
    const ids = SUBJECTS.map((s) => s.id).sort();
    expect(ids).toEqual([...ZOD_SUBJECTS].sort());
  });

  it("TY-02: DIFFICULTIES id 집합 == zod difficulty enum", () => {
    const ids = DIFFICULTIES.map((d) => d.id).sort();
    expect(ids).toEqual([...ZOD_DIFFICULTIES].sort());
  });

  it("TY-03: QUESTION_TYPES id 집합 == zod type enum", () => {
    const ids = QUESTION_TYPES.map((t) => t.id).sort();
    expect(ids).toEqual([...ZOD_TYPES].sort());
  });

  it("TY-04: 모든 SUBJECTS에 demoResult 빌더 존재 (런타임 undefined 방지)", async () => {
    // 빌더가 없으면 make(i)가 undefined로 spread → 크래시. 전 과목 throw 없이 생성되면 OK.
    await withExamKey(undefined, async () => {
      for (const { id } of SUBJECTS) {
        const subject = id as Subject;
        const r = await generateVariants(makeBody({ subject, count: 1 }));
        expect(r.variants).toHaveLength(1);
        expect(r.variants[0].subject).toBe(subject);
      }
    });
  });

  it("TY-라벨매핑: SUBJECTS의 label이 비어있지 않음", () => {
    SUBJECTS.forEach((s) => expect(s.label.length).toBeGreaterThan(0));
    DIFFICULTIES.forEach((d) => expect(d.label.length).toBeGreaterThan(0));
    QUESTION_TYPES.forEach((t) => expect(t.label.length).toBeGreaterThan(0));
  });
});
