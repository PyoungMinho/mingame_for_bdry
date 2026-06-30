/**
 * GET /api/v1/compare
 * 모델 비교 (2~4개)
 *
 * Query:
 *   ids — 콤마 구분 모델 슬러그 (예: gpt-5,claude-opus-4-7)
 */
import { NextRequest } from "next/server";
import { getCompareData } from "@/lib/api/compare";
import { CompareQuerySchema } from "@/lib/api/schemas";
import { ok, Errors } from "@/lib/api/response";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get("ids");
  if (!idsParam) {
    return Errors.badRequest("ids query parameter is required (comma-separated slugs)");
  }

  const parsed = CompareQuerySchema.safeParse({ ids: idsParam });
  if (!parsed.success) {
    return Errors.validationError(parsed.error.issues[0].message);
  }

  try {
    const result = await getCompareData(parsed.data.ids);
    if (!result) return Errors.notFound("One or more models");
    return ok(result);
  } catch {
    return Errors.internalError();
  }
}
