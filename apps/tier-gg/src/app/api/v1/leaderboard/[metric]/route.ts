/**
 * GET /api/v1/leaderboard/[metric]
 * 메트릭별 리더보드
 *
 * Params:
 *   metric — price | coding | speed | quality
 *
 * Query:
 *   limit — 최대 반환 수 (기본 20)
 */
import { NextRequest } from "next/server";
import { getLeaderboard } from "@/lib/api/models";
import { LeaderboardMetricSchema } from "@/lib/api/schemas";
import { ok, Errors } from "@/lib/api/response";
import { z } from "zod";

export const runtime = "edge";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ metric: string }> }
) {
  const { metric } = await params;

  const metricParsed = LeaderboardMetricSchema.safeParse(metric);
  if (!metricParsed.success) {
    return Errors.badRequest(
      `Invalid metric. Must be one of: price, coding, speed, quality`
    );
  }

  const limitParam = req.nextUrl.searchParams.get("limit");
  const limitParsed = z.coerce.number().int().min(1).max(100).default(20).safeParse(
    limitParam ?? undefined
  );
  const limit = limitParsed.success ? limitParsed.data : 20;

  try {
    const data = await getLeaderboard(metricParsed.data, limit);
    return ok(data, { total: data.length });
  } catch {
    return Errors.internalError();
  }
}
