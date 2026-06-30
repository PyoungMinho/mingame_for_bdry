/**
 * GET /api/mission/today
 * 오늘의 미션 1개 반환
 * 인증 필요
 */

import { type NextRequest } from "next/server";
import { requireAuth, assertNotAgeBlocked } from "@/lib/server/auth";
import { checkGeneralRateLimit } from "@/lib/server/rate-limit";
import { toErrorResponse, toSuccessResponse } from "@/lib/server/errors";
import type { MissionTodayResponse } from "@/lib/shared/schemas";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    assertNotAgeBlocked(user);
    await checkGeneralRateLimit(user.id);

    // TODO(DB): user_missions 테이블에서 오늘(KST) 미션 조회
    // const todayMission = await db.userMissions.findFirst({
    //   where: { user_id: user.id, date: todayKst() },
    //   include: { mission: true },
    // });

    // 체크인 완료 시 미션이 이미 생성됨 (POST /api/checkin 에서)
    // 미션이 없다면 체크인 전 상태 → 체크인 유도
    // TODO(DB): stub
    const responseData: MissionTodayResponse = {
      mission: null, // 체크인 완료 후 채워짐
      completedAt: null,
    };

    return toSuccessResponse(responseData);
  } catch (err) {
    return toErrorResponse(err);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/mission/today  — 미션 완료 처리
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    assertNotAgeBlocked(user);
    await checkGeneralRateLimit(user.id);

    // TODO(DB): user_missions 테이블 completed_at 업데이트
    // await db.userMissions.update({
    //   where: { user_id: user.id, date: todayKst() },
    //   data: { completed_at: new Date() },
    // });

    const responseData: MissionTodayResponse = {
      mission: null, // TODO(DB): 업데이트 후 반환
      completedAt: new Date().toISOString(),
    };

    return toSuccessResponse(responseData);
  } catch (err) {
    return toErrorResponse(err);
  }
}
