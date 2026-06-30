/**
 * POST /api/goal
 * 90일 목표 등록 → AI 마일스톤 분해 (Pro 전용)
 * GET /api/goal — 목표 목록 조회
 */

import { type NextRequest } from "next/server";
import { requireAuth, assertNotAgeBlocked } from "@/lib/server/auth";
import { checkGeneralRateLimit, checkAiRateLimit } from "@/lib/server/rate-limit";
import { assertFeatureAccess } from "@/lib/server/paywall";
import { resolveAiModel, recordAiUsage } from "@/lib/server/ai-budget";
import { toErrorResponse, toSuccessResponse, Errors } from "@/lib/server/errors";
import { GoalRequestSchema, MilestoneSchema } from "@/lib/shared/schemas";
import type { GoalResponse } from "@/lib/shared/schemas";
import { z } from "zod";

type Milestone = z.infer<typeof MilestoneSchema>;

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    assertNotAgeBlocked(user);
    assertFeatureAccess(user, "goal_milestones");
    await checkGeneralRateLimit(user.id);
    await checkAiRateLimit(user.id);

    // Zod 검증
    const rawBody = await req.json() as Record<string, unknown>;
    const parsed = GoalRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw Errors.validation(parsed.error.flatten());
    }
    const body = parsed.data;

    // AI 모델 결정
    const model = await resolveAiModel(user.id);

    // TODO(실제 LLM 호출 — W7~8 활성화):
    // AI에게 목표를 전달하고 13주 마일스톤 분해 요청
    // const prompt = `다음 90일 목표를 주차별 마일스톤 13개로 분해해주세요:
    // 목표: ${body.title}
    // 설명: ${body.description ?? "없음"}
    // 축: ${body.axis ?? "전반적"}
    // JSON 형식으로 반환: [{week, title, description, targetScore}]`;
    //
    // const completion = await callAi(model, prompt);
    // const milestones = JSON.parse(completion.text);

    // --- Stub: 13주 마일스톤 자동 생성 ---
    void model;
    const milestones: Milestone[] = Array.from({ length: 13 }, (_, i) => ({
      id: crypto.randomUUID(),
      week: i + 1,
      title: `${i + 1}주차: ${body.title} 중간 목표`,
      description: `${body.title}를 향한 ${i + 1}주차 마일스톤`,
      targetScore: Math.min(50 + i * 4, 90),
    }));

    // TODO(DB): goals 테이블 INSERT + goal_milestones 테이블 bulk INSERT
    const goalId = crypto.randomUUID();

    // 비용 기록 (stub 토큰 수)
    await recordAiUsage(user.id, model, 200, 400);

    const responseData: GoalResponse = {
      goalId,
      title: body.title,
      milestones,
      createdAt: new Date().toISOString(),
    };

    return toSuccessResponse(responseData, 201);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    assertNotAgeBlocked(user);
    await checkGeneralRateLimit(user.id);

    // TODO(DB): goals 테이블에서 user_id 기준 조회
    // const goals = await db.goals.findMany({
    //   where: { user_id: user.id, is_active: true },
    //   include: { milestones: true },
    //   orderBy: { created_at: "desc" },
    // });

    return toSuccessResponse({ goals: [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}
