/**
 * 판정 엔진 (lib/score.ts) — 도메인 무지(domain-agnostic)
 *
 * docs/design/office-archetype-design-final.md §4-4 인터페이스 제안을 구현한다.
 * 답변 배열 → 축(x/y) 정수 합산 → 4상한 → 상한 내 서브규칙으로 8유형 중 1개 확정.
 *
 * 이 파일은 "직장"·"동료" 같은 도메인 단어를 전혀 모른다. 축 id(x/y)와
 * types.json 이 제공하는 axis.{x,y} 라벨 문자열 + 등록 순서만으로 동작하므로,
 * questions.json/types.json 만 교체하면 hsp-test·dating-balance 등
 * 후속 시리즈에도 그대로 재사용된다. 유형 id(bulldozer 등)는 이 파일 어디에도
 * 하드코딩하지 않는다.
 *
 * ── 판정 규칙 (data/questions.json `resolveEngineNote`, data/types.json
 *    `axisMappingNote` 와 반드시 동기화 유지) ─────────────────────────────
 * 1) 전 문항 x·y 점수를 합산한다.
 * 2) sign(x), sign(y)로 4상한을 결정한다.
 *    x>=0 & y>=0 → (xLabels[0], yLabels[0])
 *    x>=0 & y<0  → (xLabels[0], yLabels[1])
 *    x<0  & y>=0 → (xLabels[1], yLabels[0])
 *    x<0  & y<0  → (xLabels[1], yLabels[1])
 *    (xLabels/yLabels = types.json에 axis.x/axis.y로 등장하는 라벨을 등록 순서대로
 *     중복 제거한 배열. 즉 각 축의 "첫 번째로 등장하는 라벨"이 pos, 나머지가 neg.
 *     0은 pos로 귀속 — 완전 중립 응답을 소극적 방향으로 과다 분류하지 않기 위함.)
 * 3) 한 상한에는 정상 데이터 기준 정확히 2유형이 배정된다(디자인 §3 확정).
 *    그 2유형 중 **|x| >= |y|(일/관계 축이 더 강하게 확정)면 그 상한에서
 *    먼저 등록된 유형("액션·직진형")**을, **|y| > |x|(주도/순응 축이 더 강함)면
 *    두 번째로 등록된 유형("구조·조율형")**을 채택한다.
 *    → types.json 저작 규칙: 각 상한 내 2유형은 반드시 "액션형을 먼저, 구조형을
 *      나중에" 등록한다(현재 8유형: bulldozer→architect, finisher→steady,
 *      sparker→mediator, listener→tuner 순서로 이미 이 규칙을 따름).
 * 4) tie-break: |x| === |y|(축 강도 동률)면 x축 우선 → 먼저 등록된(액션형) 유형 채택.
 * 5) 해당 상한에 유형이 1개만 있으면 그대로 반환. 0개면(데이터 누락) types 배열의
 *    첫 유형으로 안전 폴백 + 개발 모드 console.warn(운영 데이터 누락을 조용히
 *    삼키지 않기 위함).
 * ────────────────────────────────────────────────────────────────────
 */

import type { Answer, AxisScores, OaType, Question, ResolveResult } from "./types";

/**
 * 답변 배열을 축별 정수 합계로 환산한다.
 * - 문항/옵션이 존재하지 않는 답변(qid/oid 불일치)은 무시한다(방어적, throw하지 않음).
 * - scores에 없는 축은 0으로 취급.
 */
export function sumScores(answers: Answer[], questions: Question[]): AxisScores {
  const totals: AxisScores = { x: 0, y: 0 };
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  for (const answer of answers) {
    const question = questionMap.get(answer.qid);
    if (!question) continue;
    const option = question.options.find((o) => o.id === answer.oid);
    if (!option) continue;

    (["x", "y"] as const).forEach((axisId) => {
      const delta = option.scores[axisId];
      if (typeof delta === "number") {
        totals[axisId] += delta;
      }
    });
  }

  return totals;
}

/** 배열에서 처음 등장하는 값들을 등장 순서 그대로 중복 제거해 반환한다. */
function uniqueInOrder(values: string[]): string[] {
  const seen: string[] = [];
  for (const v of values) {
    if (!seen.includes(v)) seen.push(v);
  }
  return seen;
}

/** 4상한 중 하나를 (xLabel, yLabel) 문자열 쌍으로 결정한다. 0은 pos(첫 라벨)로 귀속(규칙 2). */
function quadrantLabels(
  scores: AxisScores,
  xLabels: string[],
  yLabels: string[],
): { x: string; y: string } {
  const x = scores.x >= 0 ? xLabels[0] : xLabels[1];
  const y = scores.y >= 0 ? yLabels[0] : yLabels[1];
  return { x, y };
}

/**
 * 답변 → 최종 유형 판정.
 * @param answers 사용자가 선택한 답변 배열 (qid + oid)
 * @param questions data/questions.json의 questions 배열
 * @param types data/types.json의 types 배열 (상한 내 "액션형→구조형" 등록 순서가
 *              서브규칙에 사용되므로 원본 배열 순서를 그대로 유지해서 넘겨야 한다)
 */
export function resolveType(
  answers: Answer[],
  questions: Question[],
  types: OaType[],
): ResolveResult {
  if (types.length === 0) {
    throw new Error("resolveType: types 데이터가 비어 있습니다.");
  }

  const scores = sumScores(answers, questions);

  const xLabels = uniqueInOrder(types.map((t) => t.axis.x));
  const yLabels = uniqueInOrder(types.map((t) => t.axis.y));
  const quadrant = quadrantLabels(scores, xLabels, yLabels);

  const inQuadrant = types.filter(
    (t) => t.axis.x === quadrant.x && t.axis.y === quadrant.y,
  );

  if (inQuadrant.length === 0) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(
        "[office-archetype/score] 상한에 해당하는 유형을 찾지 못해 첫 유형으로 폴백합니다.",
        { scores, quadrant },
      );
    }
    return { type: types[0], scores };
  }

  if (inQuadrant.length === 1) {
    return { type: inQuadrant[0], scores };
  }

  // 서브규칙(규칙 3, 4): |x| >= |y| → 먼저 등록된 유형(액션형), 아니면 두 번째(구조형).
  const [actionType, structureType] = inQuadrant; // 상한 내 등록 순서 = [액션형, 구조형]
  const chosen = Math.abs(scores.x) >= Math.abs(scores.y) ? actionType : structureType;

  return { type: chosen ?? inQuadrant[0], scores };
}

/** matchBestId로 상성 유형을 찾는다. 없으면 undefined(REDLINE: 임의 fallback 생성 금지). */
export function findMatchType(type: OaType, types: OaType[]): OaType | undefined {
  return types.find((t) => t.id === type.matchBestId);
}

/** slug(=type.id, 콘텐츠에 별도 slug 필드가 있으면 그것도 함께 매칭)로 유형을 찾는다.
 *  결과 딥링크 라우팅(`/result/[typeSlug]`)에 사용. */
export function findTypeBySlug(slug: string, types: OaType[]): OaType | undefined {
  return types.find((t) => t.id === slug || t.slug === slug);
}
