// REDLINE: 타인 비교/외모 점수 UI 금지
import { api } from "@/lib/api/client";
import type {
  CheckinRequest,
  CheckinResponse,
  ScoreTodayResponse,
} from "@/lib/shared/schemas";

// ---------------------------------------------------------------------------
// POST /api/checkin
// ---------------------------------------------------------------------------

/**
 * 오늘 체크인 제출
 * @returns CheckinResponse (score 스냅샷 + delta + todayMission + streak)
 */
export async function submitCheckin(body: CheckinRequest): Promise<CheckinResponse> {
  return api.post<CheckinResponse>("/api/checkin", body);
}

// ---------------------------------------------------------------------------
// GET /api/score/today
// ---------------------------------------------------------------------------

/**
 * 오늘 점수 조회 (체크인 여부 포함)
 * TanStack Query key: ["score", "today"]
 */
export async function fetchScoreToday(): Promise<ScoreTodayResponse> {
  return api.get<ScoreTodayResponse>("/api/score/today");
}

// ---------------------------------------------------------------------------
// Mock (W1~W2 스텁 — 백엔드 API 완성 전 사용)
// ---------------------------------------------------------------------------

export const MOCK_SCORE_TODAY: ScoreTodayResponse = {
  score: {
    health: 70,
    learning: 65,
    relation: 55,
    achievement: 72,
    total: 66,
    ts: new Date().toISOString(),
    version: "v1.0.0",
  },
  hasCheckedInToday: false,
  delta: null,
};

export const MOCK_CHECKIN_RESPONSE: CheckinResponse = {
  checkinId: "00000000-0000-0000-0000-000000000001",
  score: {
    health: 75,
    learning: 68,
    relation: 60,
    achievement: 76,
    total: 70,
    ts: new Date().toISOString(),
    version: "v1.0.0",
  },
  delta: {
    health: 5,
    learning: 3,
    relation: 5,
    achievement: 4,
    total: 4,
  },
  todayMission: {
    id: "00000000-0000-0000-0000-000000000099",
    title: "물 2L 마시기",
    description: "하루 동안 물 2리터를 마셔보세요.",
    axis: "health",
    difficulty: "easy",
  },
  streak: {
    current: 3,
    isNewRecord: false,
    graceUntil: null,
  },
};
