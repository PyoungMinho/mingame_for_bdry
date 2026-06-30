/**
 * PATCH /api/admin/models/[id]
 * 모델 수정 (관리자 전용)
 * 변경된 필드는 changelog에 자동 기록
 *
 * Headers:
 *   Authorization: Bearer <supabase_jwt>
 *
 * Body (JSON): AdminUpdateModelSchema (부분 업데이트)
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, isMockMode } from "@/lib/supabase/server";
import { AdminUpdateModelSchema } from "@/lib/api/schemas";
import { requireAdmin } from "@/lib/api/auth";
import { okNoCache, Errors, err } from "@/lib/api/response";
import type { Database, Json } from "@/lib/supabase/types";

type EntityUpdate = Database["public"]["Tables"]["entities"]["Update"];
type ChangelogInsert = Database["public"]["Tables"]["changelog"]["Insert"];

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 0. mock 모드 가드 (B-02)
  if (isMockMode()) {
    return err(
      "SERVICE_UNAVAILABLE",
      "Admin API is disabled in mock mode",
      503
    );
  }

  // 1. 인증
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult; // (B-01)

  // 2. 입력 검증
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest("Invalid JSON body");
  }

  const parsed = AdminUpdateModelSchema.safeParse(body);
  if (!parsed.success) {
    return Errors.validationError(
      parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return Errors.badRequest("No fields to update");
  }

  // 3. 기존 모델 조회 (changelog용 old 값)
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("entities")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return Errors.notFound("Model");
  }

  // 4. 업데이트
  const updateRow = parsed.data as unknown as EntityUpdate;
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("entities")
    .update(updateRow)
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    console.error("[admin/models PATCH]", updateError);
    return Errors.internalError();
  }

  // 5. changelog 기록 (변경된 필드만) — SQL 컬럼명: old_value, new_value
  const changelogInserts: ChangelogInsert[] = Object.keys(parsed.data).map(
    (field) => ({
      entity_id: id,
      field,
      old_value: ((existing as Record<string, unknown>)[field] ?? null) as Json,
      new_value: ((parsed.data as Record<string, unknown>)[field] ?? null) as Json,
      changed_at: new Date().toISOString(),
      changed_by: authResult.email,
    })
  );

  if (changelogInserts.length > 0) {
    const { error: clError } = await supabaseAdmin
      .from("changelog")
      .insert(changelogInserts);

    if (clError) {
      // changelog 실패는 치명적이지 않으므로 warn만
      console.warn("[admin/models PATCH] changelog insert failed:", clError);
    }
  }

  return okNoCache(updated);
}
