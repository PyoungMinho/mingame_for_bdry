/**
 * POST /api/checkin
 * 4축 입력(0~100) → 점수 스냅샷 + 변화량 + 오늘의 미션 1개 (1 RTT)
 * 인증 필요, 만16세 미만 차단, 하루 1회 제한
 */

import { type NextRequest } from "next/server";
import { requireAuth, assertNotAgeBlocked } from "@/lib/server/auth";
import { runRedlineGuard } from "@/lib/server/redline";
import { checkGeneralRateLimit } from "@/lib/server/rate-limit";
import { buildScoreSnapshot, calculateDelta, calculateStreak } from "@/lib/server/score-engine";
import { toErrorResponse, toSuccessResponse, Errors } from "@/lib/server/errors";
import { CheckinRequestSchema } from "@/lib/shared/schemas";
import type { CheckinResponse } from "@/lib/shared/schemas";

export async function POST(req: NextRequest) {
  try {
    // 1. 인증 + 레이트리밋
    const user = await requireAuth(req);
    assertNotAgeBlocked(user);
    await checkGeneralRateLimit(user.id);

    // 2. Body 파싱 + 레드라인 필드 검사
    const rawBody = await req.json() as Record<string, unknown>;
    runRedlineGuard(rawBody, { checkFields: true });

    // 3. Zod 검증
    const parsed = CheckinRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw Errors.validation(parsed.error.flatten());
    }
    const body = parsed.data;

    // 4. 오늘 이미 체크인했는지 확인
    // TODO(DB): checkins 테이블에서 오늘(KST) user_id + date 중복 조회
    // const existingCheckin = await db.checkins.findFirst({
    //   where: { user_id: user.id, date: todayKst() },
    // });
    // if (existingCheckin) throw Errors.checkinAlreadyDone();

    // 5. 점수 계산 (결정론 산식 — LLM 미사용)
    // TODO(DB): users 테이블에서 userWeightOverride 조회
    const snapshot = buildScoreSnapshot({
      health: body.health,
      learning: body.learning,
      relation: body.relation,
      achievement: body.achievement,
    });

    // 6. 어제 점수 조회 → 변화량 계산
    // TODO(DB): score_snapshots 테이블에서 어제(KST) 스냅샷 조회
    // const yesterdaySnapshot = await db.scoreSnapshots.findFirst({...});
    const yesterdaySnapshot = null;
    const delta = calculateDelta(snapshot, yesterdaySnapshot);

    // 7. 체크인 저장
    // TODO(DB): checkins 테이블 INSERT + score_snapshots 테이블 INSERT
    const checkinId = crypto.randomUUID();

    // 8. 스트릭 계산
    // TODO(DB): user_streaks 테이블에서 last_checkin_date, current_streak, max_streak 조회
    const streakInfo = calculateStreak(null, 0, 0);

    // 9. 오늘의 미션 1개 결정 (규칙 기반, LLM 미사용)
    // TODO(DB): missions 풀에서 오늘 점수 기반 1개 선택 + user_missions 테이블 INSERT
    const todayMission = {
      id: crypto.randomUUID(),
      title: "10분 스트레칭하기",
      description: "건강 점수 향상을 위한 오늘의 미션",
      axis: "health" as const,
      difficulty: "easy" as const,
    };

    const responseData: CheckinResponse = {
      checkinId,
      score: { ...snapshot, ts: new Date().toISOString() },
      delta,
      todayMission,
      streak: {
        current: streakInfo.current,
        isNewRecord: streakInfo.isNewRecord,
        graceUntil: streakInfo.graceUntil?.toISOString() ?? null,
      },
    };

    return toSuccessResponse(responseData, 201);
  } catch (err) {
    return toErrorResponse(err);
  }
}
