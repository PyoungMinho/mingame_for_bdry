/**
 * GET /api/v1/changelog
 * 최근 변경 이력 조회
 *
 * Query:
 *   limit — 반환 수 (기본 20, 최대 100)
 */
import { NextRequest } from "next/server";
import { recentChangelog } from "@/lib/api/changelog";
import { ok, Errors } from "@/lib/api/response";
import { z } from "zod";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limitParsed = z.coerce.number().int().min(1).max(100).default(20).safeParse(
    limitParam ?? undefined
  );
  const limit = limitParsed.success ? limitParsed.data : 20;

  try {
    const data = await recentChangelog(limit);
    return ok(data, { total: data.length });
  } catch {
    return Errors.internalError();
  }
}
