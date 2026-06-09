/**
 * exam-engine.ts 유닛 테스트 (demo 경로 — 키 불필요, 결정적)
 * 대상: detectMode, extractJson, normalizeVariant, demoResult 빌더 5종, generateVariants clamp
 * 설계서 §2.1~§2.5
 *
 * 결정성 규칙(설계서 §1.3): id 값 비교 금지 — 존재/유일/문자열만. env는 withExamKey로 격리.
 */
import { describe, it, expect } from "vitest";
import {
  detectMode,
  extractJson,
  normalizeVariant,
  generateVariants,
} from "@/lib/server/exam-engine";
import { makeBody, withExamKey, choiceText } from "./_helpers";
import type { GenerateRequestBody, Subject } from "@/lib/exam/types";

// ---------------------------------------------------------------------------
// §2.1 detectMode()
// ---------------------------------------------------------------------------
describe("detectMode() — 모드 판별", () => {
  it("DM-01: env 미설정이면 demo", async () => {
    await withExamKey(undefined, () => expect(detectMode()).toBe("demo"));
  });
  it("DM-02: 빈 문자열이면 demo (falsy)", async () => {
    await withExamKey("", () => expect(detectMode()).toBe("demo"));
  });
  it("DM-03: 공백만이면 demo (trim 후 빈값)", async () => {
    await withExamKey("   ", () => expect(detectMode()).toBe("demo"));
  });
  it("DM-04: 'demo' placeholder면 demo", async () => {
    await withExamKey("demo", () => expect(detectMode()).toBe("demo"));
  });
  it("DM-05: 'sk-ant-your-key-here'면 demo (startsWith sk-ant-your)", async () => {
    await withExamKey("sk-ant-your-key-here", () => expect(detectMode()).toBe("demo"));
  });
  it("DM-06: 실키 형식이면 live", async () => {
    await withExamKey("sk-ant-api03-REALKEYxxxxxxxx", () =>
      expect(detectMode()).toBe("live")
    );
  });
  it("DM-07: 앞뒤 공백 있는 실키도 trim 후 live", async () => {
    await withExamKey("  sk-ant-api03-x  ", () => expect(detectMode()).toBe("live"));
  });
  it("DM-08: 'sk-ant-yourxxx'는 보수적 폴백으로 demo", async () => {
    await withExamKey("sk-ant-yourxxx", () => expect(detectMode()).toBe("demo"));
  });
});

// ---------------------------------------------------------------------------
// §2.2 extractJson(text)  ※ M-3로 export됨
// ---------------------------------------------------------------------------
describe("extractJson(text) — LLM 응답 파싱", () => {
  it("EJ-01: 순수 JSON 객체를 그대로 파싱", () => {
    expect(extractJson('{"variants":[]}')).toEqual({ variants: [] });
  });
  it("EJ-02: 앞뒤 공백은 trim 후 파싱", () => {
    expect(extractJson('  {"a":1}  ')).toEqual({ a: 1 });
  });
  it("EJ-03: live 프리필 재현 ('{' + 본문)", () => {
    const raw = "{" + '"variants":[{"stem":"q"}]}';
    expect(extractJson(raw)).toEqual({ variants: [{ stem: "q" }] });
  });
  it("EJ-04: 코드펜스로 감싼 JSON 복구", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("EJ-05: 머리말+JSON 복구", () => {
    expect(extractJson('결과: {"a":1}')).toEqual({ a: 1 });
  });
  it("EJ-06: 중첩객체 — lastIndexOf '}' 정확", () => {
    expect(extractJson('pre {"v":{"x":1}} post')).toEqual({ v: { x: 1 } });
  });

  // --- BUG H-2 구역 ---
  it("EJ-07: JSON + 한글 꼬리텍스트 — 실측상 정상 복구된다 (설계서 예측과 다름)", () => {
    // 설계서는 throw를 예측했으나, 한글 꼬리에는 '}'가 없어 lastIndexOf가 JSON 끝을
    // 정확히 잡으므로 실제로는 정상 복구된다. → H-2의 진짜 재현 케이스는 EJ-08.
    expect(extractJson('{"a":1} 추가설명')).toEqual({ a: 1 });
  });
  it("EJ-08: 두 객체 사이 junk — H-2 수정: 첫 완결 객체 복구", () => {
    // H-2 FIXED: firstBalancedObject 가 중괄호 균형을 추적해 첫 완결 객체만 잘라낸다.
    // '{"a":1} junk {"b":2}' → 첫 객체 {a:1} 반환 (뒤쪽 junk/2번째 객체 무시).
    expect(extractJson('{"a":1} junk {"b":2}')).toEqual({ a: 1 });
  });

  it("EJ-09: 빈 문자열이면 throw", () => {
    expect(() => extractJson("")).toThrow("AI 응답을 해석하지 못했습니다");
  });
  it("EJ-10: 순수 텍스트면 throw", () => {
    expect(() => extractJson("hello")).toThrow();
  });
  it("EJ-11: 닫힘 없는 미완성 JSON이면 throw (end<start)", () => {
    expect(() => extractJson('{"a":1')).toThrow();
  });

  // --- BUG M-1 구역: 비-객체 JSON (수정 후 전부 throw) ---
  it("EJ-12: 배열 '[1,2,3]'은 M-1 수정 후 throw (객체 계약 강제)", () => {
    // M-1 FIXED: asExamObject 가 배열을 거부(Array.isArray) → 완결 객체 없음 → throw.
    expect(() => extractJson("[1,2,3]")).toThrow("AI 응답을 해석하지 못했습니다");
  });
  it("EJ-13: 'null'은 M-1 수정 후 throw (하류 null.variants 크래시 차단)", () => {
    // M-1 FIXED: JSON.parse("null")===null 을 asExamObject 가 거부 → throw.
    // 하류 (parsed.variants || []) 의 null.variants TypeError 가 원천 차단된다.
    expect(() => extractJson("null")).toThrow("AI 응답을 해석하지 못했습니다");
  });
  it("EJ-12b: 숫자 '42'도 M-1 수정 후 throw (동일 근본원인)", () => {
    expect(() => extractJson("42")).toThrow("AI 응답을 해석하지 못했습니다");
  });
  it("EJ-14: 매우 큰 비-JSON(10만자)도 행오버 없이 throw", () => {
    const huge = "x".repeat(100_000);
    const t0 = Date.now();
    expect(() => extractJson(huge)).toThrow();
    expect(Date.now() - t0).toBeLessThan(1000); // 성능: 즉시 반환
  });
});

// ---------------------------------------------------------------------------
// §2.3 normalizeVariant(raw, body)  ※ M-3로 export됨
// ---------------------------------------------------------------------------
describe("normalizeVariant(raw, body) — 변형 정규화", () => {
  const body = makeBody({ subject: "math", difficulty: "hard" });

  it("NV-01: 정상 raw → 모든 필드 보존 + difficulty/subject 주입", () => {
    const raw = {
      stem: "문제",
      type: "multiple_choice",
      choices: [{ label: "①", text: "a" }],
      answer: "①",
      explanation: "해설",
    };
    const v = normalizeVariant(raw, body);
    expect(v).not.toBeNull();
    expect(v!.stem).toBe("문제");
    expect(v!.type).toBe("multiple_choice");
    expect(v!.choices).toEqual([{ label: "①", text: "a" }]);
    expect(v!.answer).toBe("①");
    expect(v!.explanation).toBe("해설");
    expect(v!.difficulty).toBe("hard"); // body값 주입
    expect(v!.subject).toBe("math");
    expect(typeof v!.id).toBe("string"); // id는 존재/문자열만
  });
  it("NV-02: stem이 공백만이면 null", () => {
    expect(normalizeVariant({ stem: "  " }, body)).toBeNull();
  });
  it("NV-03: stem 키 자체 없으면 null", () => {
    expect(normalizeVariant({}, body)).toBeNull();
  });
  it("NV-04: type undefined면 multiple_choice 기본값", () => {
    const v = normalizeVariant({ stem: "q", type: undefined }, body);
    expect(v!.type).toBe("multiple_choice");
  });
  it("NV-05: 미지원 타입(essay)은 multiple_choice로", () => {
    const v = normalizeVariant({ stem: "q", type: "essay" }, body);
    expect(v!.type).toBe("multiple_choice");
  });
  it("NV-06: short_answer면 choices === undefined", () => {
    const v = normalizeVariant({ stem: "q", type: "short_answer" }, body);
    expect(v!.type).toBe("short_answer");
    expect(v!.choices).toBeUndefined();
  });
  it("NV-07: MC인데 choices:[] → 빈 배열 유지(undefined 아님)", () => {
    const v = normalizeVariant({ stem: "q", type: "multiple_choice", choices: [] }, body);
    expect(v!.choices).toEqual([]);
  });
  it("NV-08: 빈 text 보기는 필터 — text 있는 것만 남음", () => {
    const v = normalizeVariant(
      {
        stem: "q",
        type: "multiple_choice",
        choices: [
          { label: "①", text: "a" },
          { label: "②", text: "" },
          { text: "  " },
        ],
      },
      body
    );
    expect(v!.choices).toHaveLength(1);
    expect(v!.choices![0].text).toBe("a");
  });
  it("NV-09: answer 빈값/누락이면 '(정답 미상)' 폴백", () => {
    expect(normalizeVariant({ stem: "q", answer: "" }, body)!.answer).toBe("(정답 미상)");
    expect(normalizeVariant({ stem: "q" }, body)!.answer).toBe("(정답 미상)");
  });
  it("NV-10: explanation 빈값이면 '(해설 없음)' 폴백", () => {
    expect(normalizeVariant({ stem: "q", explanation: "" }, body)!.explanation).toBe(
      "(해설 없음)"
    );
  });
  it("NV-11: passage는 trim, 빈 passage면 undefined", () => {
    expect(normalizeVariant({ stem: "q", passage: "  지문  " }, body)!.passage).toBe("지문");
    expect(normalizeVariant({ stem: "q", passage: "   " }, body)!.passage).toBeUndefined();
  });
  it("NV-12: label/text의 <script>는 그대로 보존(이스케이프는 렌더 책임)", () => {
    const v = normalizeVariant(
      { stem: "q", choices: [{ label: "<script>", text: "x" }] },
      body
    );
    expect(v!.choices![0].label).toBe("<script>");
    expect(v!.choices![0].text).toBe("x");
  });
  it("NV-13: MC인데 모든 text 빈값이면 choices === [] (length 0 → 빈배열 유지)", () => {
    const v = normalizeVariant(
      {
        stem: "q",
        type: "multiple_choice",
        choices: [{ label: "①", text: "" }, { text: "  " }],
      },
      body
    );
    expect(v!.choices).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// §2.4 demoResult 빌더 — 정합성 (generateVariants demo 경로 경유)
// generateVariants는 async지만 demo는 동기 반환. count clamp가 빌더에 적용되므로
// 빌더만 떼어 호출하는 대신 generateVariants(demo)로 e2e 검증한다.
// ---------------------------------------------------------------------------
async function gen(body: Partial<GenerateRequestBody>) {
  return withExamKey(undefined, () => generateVariants(makeBody(body)));
}

describe("demoResult — math 빌더 정합성", () => {
  it("DM-MATH-01: count1, i=0 → 정답 ③ 텍스트 = a*x+b = 5", async () => {
    const r = await gen({ subject: "math", type: "multiple_choice", count: 1 });
    const v = r.variants[0];
    expect(v.answer).toBe("③");
    expect(choiceText(v.choices, "③")).toBe("5"); // 2*1+3
  });
  it("DM-MATH-02: count10 — 모든 i에서 ③ 텍스트 == a*(i+1)+b == 정답값", async () => {
    const r = await gen({ subject: "math", type: "multiple_choice", count: 10 });
    r.variants.forEach((v, i) => {
      const a = 2 + i;
      const b = 3 + i * 2;
      const expected = String(a * (i + 1) + b);
      expect(v.answer).toBe("③");
      expect(choiceText(v.choices, "③")).toBe(expected);
    });
    // 검증완료 값: i=0→5, i=9→131
    expect(choiceText(r.variants[0].choices, "③")).toBe("5");
    expect(choiceText(r.variants[9].choices, "③")).toBe("131");
  });
  it("DM-MATH-03: count10 — 각 문항 보기 5개 텍스트 전부 상이(유일정답)", async () => {
    const r = await gen({ subject: "math", type: "multiple_choice", count: 10 });
    r.variants.forEach((v) => {
      const texts = v.choices!.map((c) => c.text);
      expect(new Set(texts).size).toBe(5);
    });
  });
  it("DM-MATH-04: short_answer — choices undefined, answer = String(a*(i+1)+b)", async () => {
    const r = await gen({ subject: "math", type: "short_answer", count: 3 });
    r.variants.forEach((v, i) => {
      const a = 2 + i;
      const b = 3 + i * 2;
      expect(v.choices).toBeUndefined();
      expect(v.answer).toBe(String(a * (i + 1) + b));
    });
    expect(r.variants[0].answer).toBe("5");
  });
  it("DM-MATH-05: SA answer가 stem 계산값과 문자열 일치", async () => {
    const r = await gen({ subject: "math", type: "short_answer", count: 5 });
    r.variants.forEach((v, i) => {
      const a = 2 + i;
      const b = 3 + i * 2;
      expect(v.answer).toBe(String(a * (i + 1) + b));
    });
  });
  it("DM-MATH-06: explanation에 a*(i+1)과 최종값 포함(해설-정답 일관성)", async () => {
    const r = await gen({ subject: "math", type: "multiple_choice", count: 1 });
    const v = r.variants[0];
    expect(v.explanation).toContain("= 5"); // 2*1+3 최종값
    expect(v.explanation).toContain("2×1");
  });
});

describe("demoResult — science 빌더 (결함 구역 H-1)", () => {
  it("DM-SCI-01: count1, i=0 → 정답 ① 텍스트 = 1.50 (a=F/m)", async () => {
    const r = await gen({ subject: "science", type: "multiple_choice", count: 1 });
    const v = r.variants[0];
    expect(v.answer).toBe("①");
    expect(choiceText(v.choices, "①")).toBe("1.50"); // (3+0)/(2+0)
  });

  // --- H-1 FIXED: 시드를 m=2+i, F=3+i 로 올려 m≥2 보장 → ①(F/m)이 ②(F)와 절대 안 겹침 ---
  it("DM-SCI-02: H-1 수정 — i=0 보기 5개가 전부 상이(유일정답)", async () => {
    // H-1 FIXED: i=0 → ①=3/2=1.50, ②=3.00, ③=2.00, ④=2/3=0.67, ⑤=6.00. 전부 상이.
    const r = await gen({ subject: "science", type: "multiple_choice", count: 1 });
    const v = r.variants[0];
    expect(choiceText(v.choices, "①")).toBe("1.50");
    expect(choiceText(v.choices, "②")).toBe("3.00"); // 정답과 더 이상 중복 안 됨
    const texts = v.choices!.map((c) => c.text);
    expect(new Set(texts).size).toBe(5); // 유일정답 — 5개 전부 상이
  });

  it("DM-SCI-02b: [불변식] i=0 보기 5개가 전부 상이해야 한다 — H-1 수정 후 회귀 감지", async () => {
    await withExamKey(undefined, async () => {
      const r = await generateVariants(
        makeBody({ subject: "science", type: "multiple_choice", count: 1 })
      );
      const texts = r.variants[0].choices!.map((c) => c.text);
      expect(new Set(texts).size).toBe(5);
    });
  });

  it("DM-SCI-03: count10 — 모든 i에서 정답 ① 텍스트 == (F/m).toFixed(2)", async () => {
    const r = await gen({ subject: "science", type: "multiple_choice", count: 10 });
    r.variants.forEach((v, i) => {
      const expected = ((3 + i) / (2 + i)).toFixed(2);
      expect(v.answer).toBe("①");
      expect(choiceText(v.choices, "①")).toBe(expected);
    });
  });
  it("DM-SCI-04: SA — answer == ((3+i)/(2+i)).toFixed(2), choices undefined", async () => {
    const r = await gen({ subject: "science", type: "short_answer", count: 3 });
    r.variants.forEach((v, i) => {
      expect(v.choices).toBeUndefined();
      expect(v.answer).toBe(((3 + i) / (2 + i)).toFixed(2));
    });
  });
  it("DM-SCI-05: 모든 i에서 보기 5개가 전부 상이 — 복수정답 인덱스 없음", async () => {
    const r = await gen({ subject: "science", type: "multiple_choice", count: 10 });
    const dupIndexes: number[] = [];
    r.variants.forEach((v, i) => {
      const texts = v.choices!.map((c) => c.text);
      if (new Set(texts).size !== 5) dupIndexes.push(i);
    });
    expect(dupIndexes).toEqual([]); // H-1 FIXED: 어떤 i에서도 중복 없음
  });
});

describe("demoResult — english/korean/social 빌더", () => {
  it("DM-ENG-01: 정답 ② == 'decides', passage 존재, 보기 5개", async () => {
    const r = await gen({ subject: "english", type: "multiple_choice", count: 1 });
    const v = r.variants[0];
    expect(v.answer).toBe("②");
    expect(choiceText(v.choices, "②")).toBe("decides");
    expect(v.passage).toBeTruthy();
    expect(v.choices).toHaveLength(5);
  });
  it("DM-ENG-02: SA — answer 'decide'(타이핑 가능), choices undefined, passage 존재", async () => {
    const r = await gen({ subject: "english", type: "short_answer", count: 1 });
    const v = r.variants[0];
    // QA H-1: 'decides → decide'(화살표)는 학생이 입력 불가 → 단어 'decide'로 변경
    expect(v.answer).toBe("decide");
    expect(v.choices).toBeUndefined();
    expect(v.passage).toBeTruthy();
  });
  it("DM-ENG-03: 보기 5개 텍스트 상이", async () => {
    const r = await gen({ subject: "english", type: "multiple_choice", count: 1 });
    const texts = r.variants[0].choices!.map((c) => c.text);
    expect(new Set(texts).size).toBe(5);
  });
  it("DM-KOR-01: 정답 ② == 멸종 영향 문장, passage 존재", async () => {
    const r = await gen({ subject: "korean", type: "multiple_choice", count: 1 });
    const v = r.variants[0];
    expect(v.answer).toBe("②");
    expect(choiceText(v.choices, "②")).toBe(
      "한 종의 멸종이 생태계 전체에 영향을 줄 수 있다."
    );
    expect(v.passage).toBeTruthy();
  });
  it("DM-KOR-02: SA — answer '연쇄'(두 글자, 타이핑 가능), choices undefined, passage 존재 + MC 보기 5개 상이", async () => {
    const mc = await gen({ subject: "korean", type: "multiple_choice", count: 1 });
    const sa = await gen({ subject: "korean", type: "short_answer", count: 1 });
    const texts = mc.variants[0].choices!.map((c) => c.text);
    expect(new Set(texts).size).toBe(5);
    // QA H-1: 단답형은 본문 전체 문장이 아니라 타이핑 가능한 두 글자 정답으로 변경
    expect(sa.variants[0].answer).toBe("연쇄");
    expect(sa.variants[0].choices).toBeUndefined();
    expect(sa.variants[0].passage).toBeTruthy();
  });
  it("DM-SOC-01: 정답 ② == 기회비용 사례", async () => {
    const r = await gen({ subject: "social", type: "multiple_choice", count: 1 });
    const v = r.variants[0];
    expect(v.answer).toBe("②");
    expect(choiceText(v.choices, "②")).toBe("영화를 보느라 포기한 아르바이트 수입");
  });
  it("DM-SOC-02: SA — answer '기회비용'(용어, 타이핑 가능), choices undefined", async () => {
    const r = await gen({ subject: "social", type: "short_answer", count: 1 });
    const v = r.variants[0];
    // QA H-1: 본문 사례 문장이 아니라 학생이 입력 가능한 경제 용어로 변경
    expect(v.answer).toBe("기회비용");
    expect(v.choices).toBeUndefined();
  });
});

describe("demoResult — 전 과목 매트릭스", () => {
  const subjects: Subject[] = ["english", "math", "korean", "science", "social"];

  it("DM-ALL-01: 5과목 × {MC,SA}, count2 — throw 없이 length 2, sourceSummary '[데모]' 접두", async () => {
    for (const subject of subjects) {
      for (const type of ["multiple_choice", "short_answer"] as const) {
        const r = await gen({ subject, type, count: 2 });
        expect(r.variants).toHaveLength(2);
        expect(r.sourceSummary.startsWith("[데모]")).toBe(true);
        r.variants.forEach((v) => {
          expect(v.subject).toBe(subject);
          expect(v.type).toBe(type);
          expect(v.difficulty).toBe("medium");
        });
      }
    }
  });
  it("DM-ALL-02: 5과목 MC count1 — answer 기호가 실제 choices label 집합에 존재", async () => {
    for (const subject of subjects) {
      const r = await gen({ subject, type: "multiple_choice", count: 1 });
      const v = r.variants[0];
      const labels = v.choices!.map((c) => c.label);
      expect(labels).toContain(v.answer); // 답이 "⑥"같이 없는 라벨이면 안됨
    }
  });
});

// ---------------------------------------------------------------------------
// §2.5 generateVariants(body) — clamp 통합 (demo 경로)
// ---------------------------------------------------------------------------
describe("generateVariants — count clamp (demo)", () => {
  it("GV-01: count3 → mode demo, length 3", async () => {
    const r = await gen({ count: 3 });
    expect(r.mode).toBe("demo");
    expect(r.variants).toHaveLength(3);
  });
  it("GV-02: count1 → length 1", async () => {
    expect((await gen({ count: 1 })).variants).toHaveLength(1);
  });
  it("GV-03: count10 → length 10", async () => {
    expect((await gen({ count: 10 })).variants).toHaveLength(10);
  });
  it("GV-04: H-3 수정 — 엔진 직접 count0 → length 1 (하한 clamp)", async () => {
    // H-3 FIXED: Number.isFinite(round)? clamp(1,10) : 3. count0 은 falsy→3 이 아니라
    // 하한 clamp 로 1 이 된다. 라우트(zod min1)와도 의미가 일치(0은 최소 1로).
    const r = await gen({ count: 0 });
    expect(r.variants).toHaveLength(1);
  });
  it("GV-05: count11 → length 10 (상한 clamp)", async () => {
    expect((await gen({ count: 11 })).variants).toHaveLength(10);
  });
  it("GV-06: count NaN → length 3 (||3 폴백)", async () => {
    expect((await gen({ count: NaN })).variants).toHaveLength(3);
  });
  it("GV-07: count2.4 → length 2 (Math.round)", async () => {
    expect((await gen({ count: 2.4 })).variants).toHaveLength(2);
  });
  it("GV-08: count2.6 → length 3 (Math.round)", async () => {
    expect((await gen({ count: 2.6 })).variants).toHaveLength(3);
  });
  it("GV-09: count-5 → length 1 (하한 clamp)", async () => {
    expect((await gen({ count: -5 })).variants).toHaveLength(1);
  });
  it("GV-11: GenerateResult 형태 — mode/sourceSummary/variants 키 존재", async () => {
    const r = await gen({ subject: "math", type: "multiple_choice", count: 3 });
    expect(r).toHaveProperty("mode");
    expect(r).toHaveProperty("sourceSummary");
    expect(r).toHaveProperty("variants");
  });
  it("GV-12: source 빈값+이미지 없어도 demo는 throw 없이 variants 반환", async () => {
    const r = await withExamKey(undefined, () =>
      generateVariants(makeBody({ source: "", count: 2 }))
    );
    expect(r.variants).toHaveLength(2); // demo는 라우트 refine과 분리됨(H-3 관련)
  });
  it("GV-id-uniq: 생성된 variant id는 문자열이며 서로 유일", async () => {
    const r = await gen({ count: 5 });
    const ids = r.variants.map((v) => v.id);
    ids.forEach((id) => expect(typeof id).toBe("string"));
    expect(new Set(ids).size).toBe(5);
  });
});
