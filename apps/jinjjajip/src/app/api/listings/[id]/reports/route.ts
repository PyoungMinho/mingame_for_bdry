/**
 * POST /api/listings/[id]/reports
 * 매물 신고. 응답: 204 No Content.
 *
 * 처리 흐름:
 *  1. reportPayloadSchema 검증.
 *  2. 인증된 사용자 확인.
 *  3. reports 테이블 insert.
 *  4. DB 트리거(DB설계자 소유)가 listings.status='reported' 로 즉시 전환.
 *     → notice-and-takedown: 신고 즉시 비공개.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, getRequestUserId } from "@/lib/supabase/server";
import { reportPayloadSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const listingId = params.id;

  // 1. 인증
  const userId = await getRequestUserId(request);
  if (!userId) {
    return NextResponse.json(
      { success: false, data: null, error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." }, meta: null },
      { status: 401 }
    );
  }

  // 2. body 파싱 + 검증
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, data: null, error: { code: "PARSE_ERROR", message: "요청 본문을 파싱할 수 없습니다." }, meta: null },
      { status: 400 }
    );
  }

  const parsed = reportPayloadSchema.safeParse({ ...(body as object), listingId });
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: "VALIDATION_ERROR", message: "신고 데이터가 올바르지 않습니다.", details: parsed.error.flatten() },
        meta: null,
      },
      { status: 400 }
    );
  }

  const { reason, detail, evidencePhotoId } = parsed.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient() as any;

  // 3. 매물 존재 여부 확인
  const { data: listing } = await supabase
    .from("listings")
    .select("id")
    .eq("id", listingId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!listing) {
    return NextResponse.json(
      { success: false, data: null, error: { code: "NOT_FOUND", message: "해당 매물을 찾을 수 없습니다." }, meta: null },
      { status: 404 }
    );
  }

  // 4. reports insert — DB 트리거가 listings.status='reported' 처리
  const { error: insertError } = await supabase.from("reports").insert({
    listing_id: listingId,
    reporter_id: userId,
    reason,
    detail: detail ?? null,
    evidence_photo_id: evidencePhotoId ?? null,
  });

  if (insertError) {
    console.error(`reports insert 실패: ${insertError.message}`);
    return NextResponse.json(
      { success: false, data: null, error: { code: "DB_ERROR", message: "신고 접수 중 오류가 발생했습니다." }, meta: null },
      { status: 500 }
    );
  }

  return new NextResponse(null, { status: 204 });
}
