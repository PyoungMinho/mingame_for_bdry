/**
 * GET /api/score/today
 * 오늘 점수 snapshot 반환 (체크인 완료 여부 + 변화량 포함)
 * 인증 필요
 */

import { type NextRequest } from "next/server";
import { requireAuth, assertNotAgeBlocked } from "@/lib/server/auth";
import { checkGeneralRateLimit } from "@/lib/server/rate-limit";
import { calculateDelta } from "@/lib/server/score-engine";
import { toErrorResponse, toSuccessResponse } from "@/lib/server/errors";
import type { ScoreTodayResponse, ScoreSnapshot } from "@/lib/shared/schemas";
import { SCORE_VERSION } from "@/lib/server/score-engine";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    assertNotAgeBlocked(user);
    await checkGeneralRateLimit(user.id);

    // TODO(DB): score_snapshots 테이블에서 오늘(KST) 최신 스냅샷 조회
    // const todaySnapshot = await db.scoreSnapshots.findFirst({
    //   where: { user_id: user.id, date: todayKst() },
    //   orderBy: { created_at: "desc" },
    // });

    // TODO(DB): checkins 테이블에서 오늘 체크인 여부 조회
    // const hasCheckedIn = !!await db.checkins.findFirst({
    //   where: { user_id: user.id, date: todayKst() },
    // });

    // TODO(DB): 어제 스냅샷 조회 → delta 계산
    // const yesterdaySnapshot = await db.scoreSnapshots.findFirst({...});

    // --- Stub 응답 ---
    const hasCheckedInToday = false;
    const todaySnapshot: ScoreSnapshot | null = hasCheckedInToday
      ? {
          health: 72,
          learning: 65,
          relation: 58,
          achievement: 80,
          total: 69.5,
          ts: new Date().toISOString(),
          version: SCORE_VERSION,
        }
      : null;

    const delta = todaySnapshot ? calculateDelta(todaySnapshot, null) : null;

    const responseData: ScoreTodayResponse = {
      score: todaySnapshot ?? {
        health: 0,
        learning: 0,
        relation: 0,
        achievement: 0,
        total: 0,
        ts: new Date().toISOString(),
        version: SCORE_VERSION,
      },
      hasCheckedInToday,
      delta,
    };

    return toSuccessResponse(responseData);
  } catch (err) {
    return toErrorResponse(err);
  }
}
