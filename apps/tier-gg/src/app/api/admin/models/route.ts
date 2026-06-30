/**
 * POST /api/admin/models
 * 신규 모델 등록 (관리자 전용)
 *
 * Headers:
 *   Authorization: Bearer <supabase_jwt>
 *
 * Body (JSON): AdminCreateModelSchema
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, isMockMode } from "@/lib/supabase/server";
import { AdminCreateModelSchema } from "@/lib/api/schemas";
import { requireAdmin } from "@/lib/api/auth";
import { okNoCache, Errors, err } from "@/lib/api/response";
import type { Database } from "@/lib/supabase/types";

type EntityInsert = Database["public"]["Tables"]["entities"]["Insert"];

export const runtime = "nodejs"; // service role 필요 → edge 불가

export async function POST(req: NextRequest) {
  // 0. mock 모드 가드 — supabaseAdmin 호출 차단 (B-02)
  if (isMockMode()) {
    return err(
      "SERVICE_UNAVAILABLE",
      "Admin API is disabled in mock mode",
      503
    );
  }

  // 1. 인증
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult; // 인증 실패 (B-01)

  // 2. 입력 검증
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest("Invalid JSON body");
  }

  const parsed = AdminCreateModelSchema.safeParse(body);
  if (!parsed.success) {
    return Errors.validationError(
      parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")
    );
  }

  // 3. 중복 slug 체크
  const { data: existing } = await supabaseAdmin
    .from("entities")
    .select("id")
    .eq("slug", parsed.data.slug)
    .single();

  if (existing) {
    return Errors.badRequest(`slug '${parsed.data.slug}' already exists`);
  }

  // 4. 등록
  const insertRow: EntityInsert = {
    category_id: parsed.data.category_id,
    slug: parsed.data.slug,
    name: parsed.data.name,
    provider_id: parsed.data.provider_id ?? null,
    status: parsed.data.status,
    released_at: parsed.data.released_at ?? null,
    summary: parsed.data.summary ?? null,
    attrs: parsed.data.attrs as EntityInsert["attrs"],
  };
  const { data: created, error } = await supabaseAdmin
    .from("entities")
    .insert(insertRow)
    .select()
    .single();

  if (error) {
    console.error("[admin/models POST]", error);
    return Errors.internalError();
  }

  return okNoCache(created, undefined, 201);
}
