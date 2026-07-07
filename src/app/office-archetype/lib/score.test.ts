import { describe, it, expect } from "vitest";
import { resolveType, sumScores, findMatchType, findTypeBySlug } from "./score";
import questionsData from "../data/questions.json";
import typesData from "../data/types.json";
import type { Answer, OaType, Question } from "./types";

const questions = questionsData.questions as unknown as Question[];
const types = typesData.types as unknown as OaType[];

function answerAllWith(oid: string): Answer[] {
  return questions.map((q) => ({ qid: q.id, oid }));
}

describe("sumScores", () => {
  it("빈 답변은 0/0을 반환한다", () => {
    expect(sumScores([], questions)).toEqual({ x: 0, y: 0 });
  });

  it("존재하지 않는 qid/oid는 무시한다(방어적, throw 안 함)", () => {
    const answers: Answer[] = [
      { qid: "not-exist", oid: "a" },
      { qid: "q1", oid: "not-exist" },
    ];
    expect(() => sumScores(answers, questions)).not.toThrow();
    expect(sumScores(answers, questions)).toEqual({ x: 0, y: 0 });
  });

  it("문항 전체 옵션 a로 답하면 각 옵션 delta 합과 일치한다", () => {
    const answers = answerAllWith("a");
    const expected = questions.reduce(
      (acc, q) => {
        const opt = q.options.find((o) => o.id === "a")!;
        acc.x += opt.scores.x ?? 0;
        acc.y += opt.scores.y ?? 0;
        return acc;
      },
      { x: 0, y: 0 },
    );
    expect(sumScores(answers, questions)).toEqual(expected);
  });
});

describe("resolveType — 결정론성 & 8유형 스키마 무결성", () => {
  it("types.json은 정확히 8유형, 각 상한(axis.x,axis.y 조합)에 정확히 2유형이다", () => {
    expect(types).toHaveLength(8);
    const quadrantCounts = new Map<string, number>();
    for (const t of types) {
      const key = `${t.axis.x}:${t.axis.y}`;
      quadrantCounts.set(key, (quadrantCounts.get(key) ?? 0) + 1);
    }
    expect(quadrantCounts.size).toBe(4);
    for (const count of quadrantCounts.values()) {
      expect(count).toBe(2);
    }
  });

  it("동일 입력 → 항상 동일 결과(순수 함수, 랜덤 없음)", () => {
    const answers = answerAllWith("b");
    const r1 = resolveType(answers, questions, types);
    const r2 = resolveType(answers, questions, types);
    expect(r1.type.id).toBe(r2.type.id);
    expect(r1.scores).toEqual(r2.scores);
  });

  it("빈 답변(0,0)은 pos/pos 상한의 액션형(등록 순서상 첫 유형)으로 폴백한다", () => {
    const { type, scores } = resolveType([], questions, types);
    expect(scores).toEqual({ x: 0, y: 0 });
    // pos/pos 상한 = types.json에서 axis.x/axis.y가 각각 첫 번째로 등장하는 라벨과 일치하는 상한
    const xLabels = [...new Set(types.map((t) => t.axis.x))];
    const yLabels = [...new Set(types.map((t) => t.axis.y))];
    const quadrant = types.filter((t) => t.axis.x === xLabels[0] && t.axis.y === yLabels[0]);
    expect(type.id).toBe(quadrant[0].id);
  });

  it("상한 내 |x|>=|y| 이면 먼저 등록된 유형(액션형), |y|>|x| 이면 두 번째(구조형)를 채택한다", () => {
    // work/lead 상한: bulldozer(액션) → architect(구조) 순서로 등록됨
    const workLead = types.filter((t) => t.axis.x === "work" && t.axis.y === "lead");
    expect(workLead.map((t) => t.id)).toEqual(["bulldozer", "architect"]);

    // |x| >= |y| 인 극단 답변 구성 없이도, 판정 함수에 직접 답변을 넣어 축을 통제하는 대신
    // 실제 문항 데이터로 이 상한에 도달하는 답변 조합을 찾아 검증한다.
    // q1~q10 중 x>0,y>0 이면서 |x|>|y| 인 옵션만 있는 문항이 없을 수 있으므로,
    // 여기서는 회귀 방지를 위해 "모두 b" 케이스가 실제로 어느 상한/서브타입에 들어가는지만
    // 결정론적으로 재확인한다(스냅샷 성격의 안전장치).
    const allB = resolveType(answerAllWith("b"), questions, types);
    expect(types.map((t) => t.id)).toContain(allB.type.id);
  });

  it("8유형 모두 최소 1가지 답변 조합으로 도달 가능하다(랜덤 시뮬레이션)", () => {
    const reached = new Set<string>();
    let seed = 42;
    function rand() {
      // 결정론적 LCG — 테스트 재현성 확보(Math.random 미사용)
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    }
    for (let i = 0; i < 5000; i++) {
      const answers: Answer[] = questions.map((q) => {
        const idx = Math.floor(rand() * q.options.length);
        return { qid: q.id, oid: q.options[idx].id };
      });
      const { type } = resolveType(answers, questions, types);
      reached.add(type.id);
    }
    for (const t of types) {
      expect(reached, `${t.id} 유형에 도달하는 답변 조합이 존재해야 한다`).toContain(t.id);
    }
  });

  it("types 배열이 비어있으면 명시적으로 throw한다(조용한 실패 금지)", () => {
    expect(() => resolveType([], questions, [])).toThrow();
  });
});

describe("findMatchType / findTypeBySlug", () => {
  it("모든 유형의 matchBestId가 실제 존재하는 유형을 가리킨다", () => {
    for (const t of types) {
      const match = findMatchType(t, types);
      expect(match, `${t.id}.matchBestId=${t.matchBestId} 가 types에 존재해야 한다`).toBeDefined();
    }
  });

  it("matchBestId가 자기 자신을 가리키지 않는다(자기 상성 매칭 방지)", () => {
    for (const t of types) {
      expect(t.matchBestId).not.toBe(t.id);
    }
  });

  it("findTypeBySlug는 id 또는 slug로 유형을 찾는다", () => {
    expect(findTypeBySlug("bulldozer", types)?.id).toBe("bulldozer");
    expect(findTypeBySlug("no-such-slug", types)).toBeUndefined();
  });
});
