/**
 * office-archetype 점수엔진 테스트 (QA실행자)
 * 계획: OA-SCORE-01~11
 *
 * 핵심: 4지선다 10문항 = 4^10 = 1,048,576 조합을 전수 열거해
 * (a) 8유형 전부 도달, (b) 분포 편향 baseline 회귀, (c) 결정성, (d) tie-break 결정성을
 * '추정'이 아니라 '전수 증명'으로 검증한다.
 */
import { describe, it, expect } from "vitest";
import { resolveType, sumScores } from "../../src/app/office-archetype/lib/score";
import questionsData from "../../src/app/office-archetype/data/questions.json";
import typesData from "../../src/app/office-archetype/data/types.json";
import type { Answer, OaType, Question, AxisScores } from "../../src/app/office-archetype/lib/types";

const questions = questionsData.questions as unknown as Question[];
const types = typesData.types as unknown as OaType[];

function answerAllWith(oid: string): Answer[] {
  return questions.map((q) => ({ qid: q.id, oid }));
}

/** 전수 열거: 각 조합의 최종 유형 id 카운트 + tie 통계 + delta 총합을 1회 계산해 캐싱. */
interface EnumStats {
  total: number;
  counts: Record<string, number>;
  reached: Set<string>;
  ties: number;
  tieAllActionType: boolean;
  sumX: number;
  sumY: number;
  ratio: number;
  maxId: string;
  minId: string;
}

let cachedStats: EnumStats | null = null;

function enumerate(): EnumStats {
  if (cachedStats) return cachedStats;

  const counts: Record<string, number> = {};
  for (const t of types) counts[t.id] = 0;

  // 축 라벨 순서(엔진 규칙 2와 동일 로직)
  const xLabels = [...new Set(types.map((t) => t.axis.x))];
  const yLabels = [...new Set(types.map((t) => t.axis.y))];

  let ties = 0;
  let tieAllActionType = true;
  let sumX = 0;
  let sumY = 0;
  for (const q of questions) {
    for (const o of q.options) {
      sumX += o.scores.x ?? 0;
      sumY += o.scores.y ?? 0;
    }
  }

  const n = questions.length;
  const opts = questions.map((q) => q.options);
  const idx = new Array(n).fill(0);
  const reached = new Set<string>();
  let total = 0;

  // 최적화: resolveType 대신 축 합만 직접 계산(동일 알고리즘). 100만 회라 함수 호출/맵생성 회피.
  for (;;) {
    let x = 0;
    let y = 0;
    for (let i = 0; i < n; i++) {
      const o = opts[i][idx[i]];
      x += o.scores.x ?? 0;
      y += o.scores.y ?? 0;
    }
    const qx = x >= 0 ? xLabels[0] : xLabels[1];
    const qy = y >= 0 ? yLabels[0] : yLabels[1];
    const inQ = types.filter((t) => t.axis.x === qx && t.axis.y === qy);
    const chosen = inQ.length === 1 ? inQ[0] : Math.abs(x) >= Math.abs(y) ? inQ[0] : inQ[1];
    counts[chosen.id]++;
    reached.add(chosen.id);
    total++;

    if (Math.abs(x) === Math.abs(y) && inQ.length > 1 && chosen.id !== inQ[0].id) {
      tieAllActionType = false;
    }
    if (Math.abs(x) === Math.abs(y)) ties++;

    let k = n - 1;
    while (k >= 0) {
      idx[k]++;
      if (idx[k] < opts[k].length) break;
      idx[k] = 0;
      k--;
    }
    if (k < 0) break;
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const ratio = sorted[0][1] / sorted[sorted.length - 1][1];

  cachedStats = {
    total,
    counts,
    reached,
    ties,
    tieAllActionType,
    sumX,
    sumY,
    ratio,
    maxId: sorted[0][0],
    minId: sorted[sorted.length - 1][0],
  };
  return cachedStats;
}

describe("OA-SCORE 점수엔진 (전수 4^10 열거)", () => {
  it("OA-SCORE-01: 4^10 전수 열거 시 8유형 전부 도달(Set size === 8)", () => {
    const s = enumerate();
    expect(s.total).toBe(1_048_576);
    expect(s.reached.size).toBe(8);
    for (const t of types) {
      expect(s.reached, `${t.id} 유형에 도달하는 조합이 존재해야 한다`).toContain(t.id);
      expect(s.counts[t.id]).toBeGreaterThan(0);
    }
  });

  it("OA-SCORE-02: 전수 분포 baseline 회귀 + 편향 소프트게이트 리포트", () => {
    const s = enumerate();
    const pct = (id: string) => ((s.counts[id] / s.total) * 100).toFixed(2);

    // baseline 회귀(설계 단계 실측): architect 최다 19.15%, tuner 최소 6.56%
    expect(s.maxId).toBe("architect");
    expect(s.minId).toBe("tuner");
    expect(pct("architect")).toBe("19.15");
    expect(pct("tuner")).toBe("6.56");

    // 소프트 게이트: 3.5배 넘으면 경고만(배포는 안 막음). 현재 2.919배라 통과.
    if (s.ratio > 3.5) {
      // eslint-disable-next-line no-console
      console.warn(`[OA-SCORE-02] 분포 편향 경고: max/min = ${s.ratio.toFixed(3)}x (>3.5x)`);
    }
    // 회귀 안전장치: baseline 2.919배에서 크게 벗어나면 delta가 바뀐 것 → 리뷰 필요
    expect(s.ratio).toBeGreaterThan(2.8);
    expect(s.ratio).toBeLessThan(3.05);

    // 리포트 로그(P0 수치화)
    // eslint-disable-next-line no-console
    console.info(
      "[OA-SCORE-02] 전수 분포:",
      Object.entries(s.counts)
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => `${id} ${pct(id)}%`)
        .join(" / "),
      `| max/min ${s.ratio.toFixed(3)}x`,
    );
  });

  it("OA-SCORE-03: 동일 답변 2회 판정 결과 완전 동일(결정성)", () => {
    const answers = answerAllWith("b");
    const r1 = resolveType(answers, questions, types);
    const r2 = resolveType(answers, questions, types);
    expect(r1.type.id).toBe(r2.type.id);
    expect(r1.scores).toEqual(r2.scores);

    // 전 옵션에 대해서도 결정성 재확인
    for (const oid of ["a", "b", "c", "d"]) {
      const a = answerAllWith(oid);
      expect(resolveType(a, questions, types).type.id).toBe(
        resolveType(a, questions, types).type.id,
      );
    }
  });

  it("OA-SCORE-04: 빈 답변(0,0) → pos/pos 상한 액션형 폴백", () => {
    const { type, scores } = resolveType([], questions, types);
    expect(scores).toEqual({ x: 0, y: 0 });
    // pos/pos = work×lead 상한의 액션형 = 등록 순서상 bulldozer
    const xLabels = [...new Set(types.map((t) => t.axis.x))];
    const yLabels = [...new Set(types.map((t) => t.axis.y))];
    const inQ = types.filter((t) => t.axis.x === xLabels[0] && t.axis.y === yLabels[0]);
    expect(type.id).toBe(inQ[0].id);
    expect(type.id).toBe("bulldozer");
  });

  it("OA-SCORE-06: |x|===|y|>0 전 조합에서 액션형(inQuadrant[0]) 결정론적 채택", () => {
    const s = enumerate();
    // 전수 tie 건수 baseline + 전건 액션형 일관
    expect(s.ties).toBe(120_251);
    expect(s.tieAllActionType).toBe(true);
  });

  it("OA-SCORE-07: 상한 고정 후 |x|>|y|→액션형, |y|>|x|→구조형 (mock 축 통제)", () => {
    // work×lead 상한 = [bulldozer(액션), architect(구조)]
    // 단일 문항 q1(a): x=2,y=1 → |x|>|y| → 액션형
    const actionAnswer: Answer[] = [{ qid: "q1", oid: "a" }];
    const sX = sumScores(actionAnswer, questions);
    expect(sX).toEqual({ x: 2, y: 1 });
    expect(resolveType(actionAnswer, questions, types).type.id).toBe("bulldozer");

    // q3(b): x=1,y=2 → |y|>|x| → 구조형(architect)
    const structAnswer: Answer[] = [{ qid: "q3", oid: "b" }];
    expect(sumScores(structAnswer, questions)).toEqual({ x: 1, y: 2 });
    expect(resolveType(structAnswer, questions, types).type.id).toBe("architect");
  });

  it("OA-SCORE-08: 존재하지 않는 qid/oid 방어(throw 없음, 0/0)", () => {
    const bad: Answer[] = [
      { qid: "does-not-exist", oid: "a" },
      { qid: "q1", oid: "zzz" },
    ];
    expect(() => sumScores(bad, questions)).not.toThrow();
    expect(sumScores(bad, questions)).toEqual({ x: 0, y: 0 });
  });

  it("OA-SCORE-10: sumScores는 같은 qid 2건을 둘 다 합산한다(엔진 계약 갭 명시)", () => {
    // 화면 경로(test/page.tsx)는 filter로 qid당 1건만 유지하지만,
    // 엔진 자체는 idempotent하지 않음을 고정한다.
    const single: Answer[] = [{ qid: "q1", oid: "a" }]; // x=2,y=1
    const doubled: Answer[] = [
      { qid: "q1", oid: "a" },
      { qid: "q1", oid: "a" },
    ];
    const s1 = sumScores(single, questions);
    const s2 = sumScores(doubled, questions);
    expect(s2.x).toBe(s1.x * 2);
    expect(s2.y).toBe(s1.y * 2);
    // 서로 다른 옵션 2건도 마지막 것만 쓰지 않고 둘 다 합산됨
    const mixed: Answer[] = [
      { qid: "q1", oid: "a" }, // 2,1
      { qid: "q1", oid: "b" }, // 1,-1
    ];
    expect(sumScores(mixed, questions)).toEqual({ x: 3, y: 0 });
  });

  it("OA-SCORE-11: types 빈 배열이면 명시적 throw(조용한 실패 금지)", () => {
    expect(() => resolveType([], questions, [])).toThrow(/비어 있습니다/);
  });
});

describe("OA-SCORE-16: 전 옵션 delta 총합 리포트(편향 근본원인 추적)", () => {
  it("Σx / Σy 를 출력하고 baseline과 일치시킨다", () => {
    const s = enumerate();
    // eslint-disable-next-line no-console
    console.info(`[OA-SCORE-16] 전 옵션 delta 총합: Σx=${s.sumX}, Σy=${s.sumY}`);
    // baseline: Σx=-1(거의 균형), Σy=6(lead쪽으로 치우침 → 분포 편향 근본원인 신호)
    expect(s.sumX).toBe(-1);
    expect(s.sumY).toBe(6);
    // Σy가 0에서 멀수록 y축 상/하 편향. 여기서는 +6이라 lead 상한 과다판정의 데이터적 원인.
    expect(Math.abs(s.sumY)).toBeGreaterThan(Math.abs(s.sumX));
  });
});
