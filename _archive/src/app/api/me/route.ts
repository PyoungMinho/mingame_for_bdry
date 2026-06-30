/**
 * GET /api/me
 * 유저 정보 + 페르소나 + 구독 상태
 * PATCH /api/me — 페르소나·북극성 다짐 업데이트
 */

import { type NextRequest } from "next/server";
import { requireAuth, assertNotAgeBlocked } from "@/lib/server/auth";
import { checkGeneralRateLimit } from "@/lib/server/rate-limit";
import { getFreeTrialStatus } from "@/lib/server/paywall";
import { getBudgetRatio } from "@/lib/server/ai-budget";
import { toErrorResponse, toSuccessResponse, Errors } from "@/lib/server/errors";
import { PersonaSchema } from "@/lib/shared/schemas";
import type { MeResponse } from "@/lib/shared/schemas";
import { z } from "zod";
import { SCORE_VERSION } from "@/lib/server/score-engine";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    // me 엔드포인트는 age blocked 유저도 접근 가능 (차단 화면 렌더링을 위해)
    await checkGeneralRateLimit(user.id);

    // TODO(DB): users 테이블에서 프로필 전체 조회
    // const profile = await db.users.findUnique({
    //   where: { id: user.id },
    //   include: { subscription: true },
    // });

    const aiBudgetRatio = await getBudgetRatio(user.id);
    const trialStatus = getFreeTrialStatus(user.coachFreeUntil);

    // --- Stub 응답 ---
    const responseData: MeResponse = {
      id: user.id,
      email: user.email,
      nickname: null,
      createdAt: new Date().toISOString(),
      persona: "mentor",
      subscription: {
        tier: user.subscriptionTier,
        expiresAt: null,
        coachFreeUntil: user.coachFreeUntil?.toISOString() ?? null,
        isCoachFreeActive: trialStatus.isActive,
      },
      aiBudgetUsageRatio: aiBudgetRatio,
      northStarStatement: null,
      isAgeBlocked: user.isAgeBlocked,
    };

    return toSuccessResponse(responseData);
  } catch (err) {
    return toErrorResponse(err);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/me — 페르소나, 북극성 다짐 업데이트
// ---------------------------------------------------------------------------

const MePatchSchema = z.object({
  persona: PersonaSchema.optional(),
  northStarStatement: z.string().min(5).max(200).optional(),
  nickname: z.string().min(1).max(30).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    assertNotAgeBlocked(user);
    await checkGeneralRateLimit(user.id);

    const rawBody = await req.json() as Record<string, unknown>;
    const parsed = MePatchSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw Errors.validation(parsed.error.flatten());
    }
    const updates = parsed.data;

    // TODO(DB): users 테이블 업데이트
    // await db.users.update({
    //   where: { id: user.id },
    //   data: {
    //     persona: updates.persona,
    //     north_star_statement: updates.northStarStatement,
    //     nickname: updates.nickname,
    //   },
    // });

    void updates; // stub

    return toSuccessResponse({ updated: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
