/**
 * GET /api/v1/models/[slug]
 * 모델 상세 조회 (점수 포함)
 */
import { NextRequest } from "next/server";
import { getModelBySlug } from "@/lib/api/models";
import { ok, Errors } from "@/lib/api/response";

export const runtime = "edge";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug || typeof slug !== "string") {
    return Errors.badRequest("slug is required");
  }

  try {
    const model = await getModelBySlug(slug);
    if (!model) return Errors.notFound("Model");
    return ok(model);
  } catch {
    return Errors.internalError();
  }
}
