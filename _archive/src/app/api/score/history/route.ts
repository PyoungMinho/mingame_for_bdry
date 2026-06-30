/**
 * GET /api/score/history?period=7|30|90&cursor=<opaque>
 * 산 능선 그래프 데이터 반환 (cursor 기반 페이지네이션)
 * 인증 필요. 90일은 Pro 전용.
 */

import { type NextRequest } from "next/server";
import { requireAuth, assertNotAgeBlocked } from "@/lib/server/auth";
import { checkGeneralRateLimit } from "@/lib/server/rate-limit";
import { assertFeatureAccess } from "@/lib/server/paywall";
import { toErrorResponse, toSuccessResponse, Errors } from "@/lib/server/errors";
import { HistoryPeriodSchema } from "@/lib/shared/schemas";
import type { ScoreHistoryResponse } from "@/lib/shared/schemas";
import { SCORE_VERSION } from "@/lib/server/score-engine";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    assertNotAgeBlocked(user);
    await checkGeneralRateLimit(user.id);

    const { searchParams } = req.nextUrl;
    const periodRaw = searchParams.get("period") ?? "7";
    const cursor = searchParams.get("cursor") ?? null;

    // period 검증
    const periodResult = HistoryPeriodSchema.safeParse(periodRaw);
    if (!periodResult.success) {
      throw Errors.validation({ period: "7, 30, 90 중 하나여야 합니다" });
    }
    const period = periodResult.data;

    // 90일 그래프는 Pro 전용
    if (period === "90") {
      assertFeatureAccess(user, "score_history_90d");
    }

    // TODO(DB): score_snapshots 테이블에서 기간 내 데이터 조회 (cursor 기반)
    // const { data, nextCursor } = await db.scoreSnapshots.findMany({
    //   where: {
    //     user_id: user.id,
    //     date: { gte: subDays(today, parseInt(period)) },
    //   },
    //   orderBy: { date: "asc" },
    //   cursor: cursor ? { date: decodeCursor(cursor) } : undefined,
    //   take: parseInt(period),
    // });

    // --- Stub 응답 ---
    const today = new Date();
    const stubPoints = Array.from({ length: parseInt(period) }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (parseInt(period) - 1 - i));
      const date = d.toISOString().slice(0, 10);
      const base = 50 + Math.round(Math.sin(i * 0.3) * 15);
      return {
        date,
        score: {
          health: base + 5,
          learning: base - 3,
          relation: base - 8,
          achievement: base + 10,
          total: base + 1,
          ts: d.toISOString(),
          version: SCORE_VERSION,
        },
      };
    });

    const responseData: ScoreHistoryResponse = {
      period,
      points: stubPoints,
      nextCursor: null, // 전체 데이터 한 번에 반환 (W1~W2 분량)
    };

    return toSuccessResponse(responseData);
  } catch (err) {
    return toErrorResponse(err);
  }
}
