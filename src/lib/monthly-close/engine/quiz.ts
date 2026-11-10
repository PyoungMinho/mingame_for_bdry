/**
 * 검산(퀴즈) 생성·채점·확정 계산. 순수 TS.
 *  - 암산 수준: 합계(두 자리 3개) / 부가세 10%(만 원 단위 금액) / 차액(두 자리 2개). 정답은 항상 정수.
 *  - 사람별 경과 시간 비교: 경과 = 수신 시각 − 그 사람의 배달 시각. 차이가 QUIZ_TIE_MS 이내면 둘 다 지급.
 */

import { QUIZ_DELIVERY_GRACE_MS, QUIZ_MS, QUIZ_TIE_MS, QUIZ_VALUE_COUNT } from '../constants';
import type { QuizKind, Seat } from '../protocol';
import type { QuizState, Rng } from './types';

const KINDS: readonly QuizKind[] = ['sum', 'vat', 'diff'];

function int(rng: Rng, lo: number, hi: number): number {
  return lo + Math.min(hi - lo, Math.floor(rng() * (hi - lo + 1)));
}

export interface GeneratedQuiz {
  kind: QuizKind;
  values: number[];
  answer: number;
  labelSeed: number;
}

export function generateQuiz(rng: Rng, avoidKind: QuizKind | null = null): GeneratedQuiz {
  const kinds = KINDS.filter((k) => k !== avoidKind);
  const kind = kinds[int(rng, 0, kinds.length - 1)];
  const labelSeed = int(rng, 0, 9999);
  if (kind === 'sum') {
    const values = [int(rng, 11, 98), int(rng, 11, 98), int(rng, 11, 98)];
    return { kind, values, answer: values[0] + values[1] + values[2], labelSeed };
  }
  if (kind === 'vat') {
    // 만 원 단위 금액(예: 370,000원) → 부가세 10%는 37,000원. 항상 정수.
    const amount = int(rng, 2, 99) * 10_000;
    return { kind, values: [amount], answer: amount / 10, labelSeed };
  }
  const a = int(rng, 30, 99);
  const b = int(rng, 11, a - 5);
  return { kind, values: [a, b], answer: a - b, labelSeed };
}

/** 값 개수가 종류별 규격(QUIZ_VALUE_COUNT)과 맞는지 — 테스트용. */
export function quizShapeOk(kind: QuizKind, values: readonly number[]): boolean {
  return values.length === QUIZ_VALUE_COUNT[kind];
}

export function gradeAnswer(answer: number, value: number): boolean {
  return Number.isInteger(value) && value === answer;
}

/** 자리의 마감 시각(배달 전이면 null). */
export function seatDeadline(q: QuizState, seat: Seat): number | null {
  const d = q.deliveredAt[seat];
  return d === null ? null : d + QUIZ_MS;
}

/** 자리의 상태: 풀 수 없음 / 정답 / 마감 / 풀이 중 */
export function seatQuizState(q: QuizState, seat: Seat): 'none' | 'correct' | 'expired' | 'open' {
  if (!q.eligible[seat]) return 'none';
  if (q.elapsedMs[seat] !== null) return 'correct';
  if (q.expired[seat]) return 'expired';
  return 'open';
}

/**
 * 확정 시점 계산.
 *  - 정답자가 없으면 null(아무도 못 맞혔고 마감을 기다리는 중).
 *  - 아직 풀이 중인 사람이 없으면 { open: false }(지금 확정 가능).
 *  - 풀이 중인 사람이 있으면 at = 그 사람이 앞선 정답자를 이기거나 비길 수 있는 마지막 시각(포함 — 이 시각 정각의 정답은 인정).
 *    확정은 at 다음 ms부터(core.stepQuiz `now > at`). 화면의 settleAt도 이 값이다.
 *    (배달 전이면 최악 = 출제 + QUIZ_DELIVERY_GRACE_MS를 배달 시각으로 가정)
 */
export function settlePlan(q: QuizState): null | { open: false } | { open: true; at: number } {
  const correct = ([0, 1] as const).filter((s) => seatQuizState(q, s) === 'correct');
  if (correct.length === 0) return null;
  const best = Math.min(...correct.map((s) => q.elapsedMs[s] as number));
  const open = ([0, 1] as const).filter((s) => seatQuizState(q, s) === 'open');
  if (open.length === 0) return { open: false };
  let at = 0;
  for (const s of open) {
    const d = q.deliveredAt[s] ?? q.issuedAt + QUIZ_DELIVERY_GRACE_MS;
    at = Math.max(at, d + Math.min(QUIZ_MS, best + QUIZ_TIE_MS));
  }
  return { open: true, at };
}

/** 확정 지급: 가장 빠른 사람 + 그와 QUIZ_TIE_MS 이내 차이인 사람. */
export function awardedSeats(q: QuizState): Seat[] {
  const correct = ([0, 1] as const).filter((s) => seatQuizState(q, s) === 'correct');
  if (correct.length === 0) return [];
  const best = Math.min(...correct.map((s) => q.elapsedMs[s] as number));
  return correct.filter((s) => (q.elapsedMs[s] as number) - best <= QUIZ_TIE_MS);
}
