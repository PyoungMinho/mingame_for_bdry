/**
 * 결정론적 점수 산식 엔진
 * LLM 미사용 — 4축 가중치 하드코딩 (G항 부분 공개)
 * 산식 versioning: SCORE_VERSION 상수로 관리
 */

import type { FourAxis, ScoreSnapshot, ScoreDelta } from "../shared/schemas";

// ---------------------------------------------------------------------------
// 산식 버전 (공개 가능)
// ---------------------------------------------------------------------------

export const SCORE_VERSION = "v1.0.0";

// ---------------------------------------------------------------------------
// 4축 기본 가중치 (합계 = 1.0, 부분 공개)
// G항 공개 범위: 가중치만 공개, 보정 계수는 비공개
// ---------------------------------------------------------------------------

// 백엔드팀장 정합 수정 (2026-05-14):
// score_formula.md §2 와 일치 — 균등 0.25 (합=1.00)
const DEFAULT_WEIGHTS: FourAxis = {
  health: 0.25,
  learning: 0.25,
  relation: 0.25,
  achievement: 0.25,
};

// ---------------------------------------------------------------------------
// 사용자 가중치 조정 인터페이스
// 사용자는 ±5% 범위 내에서 미세조정 가능 (합산 1.0 강제)
// ---------------------------------------------------------------------------

export interface UserWeightOverride {
  health?: number;
  learning?: number;
  relation?: number;
  achievement?: number;
}

function mergeWeights(userOverride?: UserWeightOverride): FourAxis {
  if (!userOverride) return DEFAULT_WEIGHTS;

  // 백엔드팀장 정합 수정: score_formula.md §3 — 각 축 0.10~0.70, 합=1.00 (서버 검증)
  const merged: FourAxis = {
    health: clamp(userOverride.health ?? DEFAULT_WEIGHTS.health, 0.10, 0.70),
    learning: clamp(userOverride.learning ?? DEFAULT_WEIGHTS.learning, 0.10, 0.70),
    relation: clamp(userOverride.relation ?? DEFAULT_WEIGHTS.relation, 0.10, 0.70),
    achievement: clamp(userOverride.achievement ?? DEFAULT_WEIGHTS.achievement, 0.10, 0.70),
  };

  // 합산을 1.0으로 정규화
  const total = merged.health + merged.learning + merged.relation + merged.achievement;
  return {
    health: merged.health / total,
    learning: merged.learning / total,
    relation: merged.relation / total,
    achievement: merged.achievement / total,
  };
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

// ---------------------------------------------------------------------------
// 평활화 함수 (0~100 → 0~100, 비선형 보정)
// 낮은 점수는 약간 후하게, 높은 점수는 약간 엄격하게 (번아웃 예방)
// 비공개 보정 계수 영역
// ---------------------------------------------------------------------------

function smoothScore(raw: number): number {
  // sigmoid-like normalization, 50점 중앙값 유지
  const normalized = raw / 100;
  const smoothed = normalized < 0.5
    ? 0.5 * Math.pow(2 * normalized, 0.85)
    : 1 - 0.5 * Math.pow(2 * (1 - normalized), 0.85);
  return Math.round(smoothed * 100 * 10) / 10; // 소수점 1자리
}

// ---------------------------------------------------------------------------
// 핵심 산식: 4축 입력 → 총점
// ---------------------------------------------------------------------------

export interface ScoreInput {
  axes: FourAxis;
  userWeightOverride?: UserWeightOverride;
}

export interface ScoreResult {
  smoothed: FourAxis & { [K in keyof FourAxis]: number };
  weighted: FourAxis & { [K in keyof FourAxis]: number };
  total: number;
  version: typeof SCORE_VERSION;
}

export function calculateScore(input: ScoreInput): ScoreResult {
  const weights = mergeWeights(input.userWeightOverride);

  const smoothed = {
    health: smoothScore(input.axes.health),
    learning: smoothScore(input.axes.learning),
    relation: smoothScore(input.axes.relation),
    achievement: smoothScore(input.axes.achievement),
  };

  const weighted = {
    health: smoothed.health * weights.health,
    learning: smoothed.learning * weights.learning,
    relation: smoothed.relation * weights.relation,
    achievement: smoothed.achievement * weights.achievement,
  };

  const total = Math.round(
    (weighted.health + weighted.learning + weighted.relation + weighted.achievement) * 10
  ) / 10;

  return { smoothed, weighted, total, version: SCORE_VERSION };
}

// ---------------------------------------------------------------------------
// ScoreSnapshot 생성
// ---------------------------------------------------------------------------

export function buildScoreSnapshot(
  axes: FourAxis,
  userWeightOverride?: UserWeightOverride
): Omit<ScoreSnapshot, "ts"> {
  const result = calculateScore({ axes, userWeightOverride });
  return {
    health: result.smoothed.health,
    learning: result.smoothed.learning,
    relation: result.smoothed.relation,
    achievement: result.smoothed.achievement,
    total: result.total,
    version: result.version,
  };
}

// ---------------------------------------------------------------------------
// 변화량 계산
// ---------------------------------------------------------------------------

export function calculateDelta(
  today: Omit<ScoreSnapshot, "ts">,
  yesterday: Omit<ScoreSnapshot, "ts"> | null
): ScoreDelta {
  if (!yesterday) {
    return { health: 0, learning: 0, relation: 0, achievement: 0, total: 0 };
  }

  return {
    health: Math.round((today.health - yesterday.health) * 10) / 10,
    learning: Math.round((today.learning - yesterday.learning) * 10) / 10,
    relation: Math.round((today.relation - yesterday.relation) * 10) / 10,
    achievement: Math.round((today.achievement - yesterday.achievement) * 10) / 10,
    total: Math.round((today.total - yesterday.total) * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// 스트릭 계산 (24시 grace period 포함)
// ---------------------------------------------------------------------------

export interface StreakInfo {
  current: number;
  isNewRecord: boolean;
  graceUntil: Date | null;
}

/**
 * 스트릭 계산.
 * @param lastCheckinDate - 직전 체크인 날짜 (KST 기준 YYYY-MM-DD)
 * @param currentStreak - 현재 누적 스트릭
 * @param maxStreak - 역대 최고 스트릭
 */
export function calculateStreak(
  lastCheckinDate: string | null,
  currentStreak: number,
  maxStreak: number
): StreakInfo {
  const now = new Date();
  // KST 기준 오늘 날짜
  const todayKst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  if (!lastCheckinDate) {
    return { current: 1, isNewRecord: maxStreak === 0, graceUntil: null };
  }

  const yesterday = new Date(now.getTime() + 9 * 60 * 60 * 1000 - 86_400_000)
    .toISOString()
    .slice(0, 10);

  if (lastCheckinDate === yesterday || lastCheckinDate === todayKst) {
    // 연속 체크인
    const newStreak = currentStreak + (lastCheckinDate === yesterday ? 1 : 0);
    return {
      current: newStreak,
      isNewRecord: newStreak > maxStreak,
      graceUntil: null,
    };
  }

  // 스트릭 끊김 → 재시작 보너스 프레임 (부정 메시지 없음)
  // grace period: 끊긴 날 다음날 자정까지
  const graceUntil = new Date(now);
  graceUntil.setHours(23, 59, 59, 999);

  return {
    current: 1, // 재시작
    isNewRecord: false,
    graceUntil,
  };
}
