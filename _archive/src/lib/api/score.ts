// REDLINE: 타인 비교/외모 점수 UI 금지
// 그래프 데이터는 본인 과거치만 조회 가능. "전체 사용자 평균", "동년배 비교" 차단됨.
import { api } from "@/lib/api/client";
import type {
  ScoreHistoryResponse,
  HistoryPeriod,
} from "@/lib/shared/schemas";

// ---------------------------------------------------------------------------
// 점수 응답 타입 재export (백엔드팀 인터페이스 정의)
// ---------------------------------------------------------------------------

export type {
  ScoreSnapshot,
  ScoreDelta,
  ScoreHistoryResponse,
  HistoryPeriod,
} from "@/lib/shared/schemas";

/** 점수 히스토리 단일 포인트 (schemas.ts ScoreHistoryPointSchema 인라인 타입) */
export interface ScoreHistoryPoint {
  date: string;
  score: {
    health: number;
    learning: number;
    relation: number;
    achievement: number;
    total: number;
    ts: string;
    version: string;
  };
}

// ---------------------------------------------------------------------------
// GET /api/score/history
// 본인 과거치만. period: "7" | "30" | "90"
// ---------------------------------------------------------------------------

/**
 * 점수 히스토리 조회
 * TanStack Query key: ["score", "history", period]
 *
 * REDLINE: cursor에 "compare", "peer", "average-all" 파라미터 추가 금지
 */
export async function fetchScoreHistory(
  period: HistoryPeriod,
  cursor?: string
): Promise<ScoreHistoryResponse> {
  return api.get<ScoreHistoryResponse>("/api/score/history", {
    period,
    ...(cursor ? { cursor } : {}),
  });
}

// ---------------------------------------------------------------------------
// Mock 데이터 (W1~W2 스텁)
// ---------------------------------------------------------------------------

function generateMockPoints(days: number) {
  const points = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    const base = 60 + Math.round(Math.random() * 20);
    points.push({
      date: date.toISOString().split("T")[0],
      score: {
        health: base + Math.round(Math.random() * 10 - 5),
        learning: base + Math.round(Math.random() * 10 - 5),
        relation: base + Math.round(Math.random() * 10 - 5),
        achievement: base + Math.round(Math.random() * 10 - 5),
        total: base,
        ts: date.toISOString(),
        version: "v1.0.0",
      },
    });
  }
  return points;
}

export const MOCK_SCORE_HISTORY: Record<HistoryPeriod, ScoreHistoryResponse> = {
  "7": { period: "7", points: generateMockPoints(7), nextCursor: null },
  "30": { period: "30", points: generateMockPoints(30), nextCursor: null },
  "90": { period: "90", points: generateMockPoints(90), nextCursor: null },
};
