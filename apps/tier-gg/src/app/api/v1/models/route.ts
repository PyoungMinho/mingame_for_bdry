/**
 * GET /api/v1/models
 * 모델 목록 조회 (cursor 기반 페이지네이션)
 *
 * Query:
 *   provider  — provider slug 필터
 *   modality  — modality 필터 (text, image, audio, code)
 *   status    — active | deprecated | preview
 *   cursor    — 다음 페이지 커서 (name 기준)
 *   limit     — 페이지 크기 (기본 20, 최대 100)
 */
import { NextRequest } from "next/server";
import { listModels } from "@/lib/api/models";
import { ListModelsQuerySchema } from "@/lib/api/schemas";
import { ok, Errors } from "@/lib/api/response";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());

  const parsed = ListModelsQuerySchema.safeParse(searchParams);
  if (!parsed.success) {
    return Errors.validationError(parsed.error.issues[0].message);
  }

  try {
    const result = await listModels(parsed.data);
    return ok(result.data, {
      cursor: result.cursor,
      hasMore: result.hasMore,
    });
  } catch {
    return Errors.internalError();
  }
}
