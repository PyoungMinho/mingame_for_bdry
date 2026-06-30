/**
 * POST /api/listings/[id]/photos
 * 세입자 사진 업로드 초기화.
 *
 * 절대 제약:
 *  1. 업로더가 role=tenant + identity_verified=true 인지 서버에서 검증 (아니면 403).
 *  2. uploads row 생성 (status=processing).
 *  3. photos rows 생성 (status=processing, original_path 저장 경로).
 *  4. photo-pipeline Edge Function 트리거 (스텁 호출).
 *  5. 블러/EXIF는 여기서 하지 않음 — 워커 전담.
 *  6. 낙관적 응답 금지 — processing 상태 반환.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, getRequestUserId } from "@/lib/supabase/server";
import type { UploadResult } from "@/lib/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE_BUCKET = "listing-photos-original";

function json403(message = "본인인증 완료된 세입자만 사진을 업로드할 수 있습니다.") {
  return NextResponse.json(
    { success: false, data: null, error: { code: "FORBIDDEN", message }, meta: null },
    { status: 403 }
  );
}

function json400(message: string) {
  return NextResponse.json(
    { success: false, data: null, error: { code: "VALIDATION_ERROR", message }, meta: null },
    { status: 400 }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const listingId = params.id;

  // 1. 사용자 인증
  const userId = await getRequestUserId(request);
  if (!userId) return json403("로그인이 필요합니다.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient() as any;

  // 2. role=tenant + identity_verified 검증
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, identity_verified")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) return json403();
  const p = profile as { role: string; identity_verified: boolean };
  if (p.role !== "tenant" || !p.identity_verified) return json403();

  // 3. 매물 존재 확인
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, status")
    .eq("id", listingId)
    .is("deleted_at", null)
    .maybeSingle();

  if (listingError || !listing) {
    return NextResponse.json(
      { success: false, data: null, error: { code: "NOT_FOUND", message: "매물을 찾을 수 없습니다." }, meta: null },
      { status: 404 }
    );
  }
  const l = listing as { id: string; status: string };
  if (l.status === "reported" || l.status === "taken_down") {
    return json403("신고되거나 내려간 매물에는 사진을 업로드할 수 없습니다.");
  }

  // 4. FormData 파싱
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json400("FormData 파싱에 실패했습니다.");
  }

  const fileCountRaw = formData.get("fileCount");
  const fileCount = fileCountRaw ? parseInt(String(fileCountRaw), 10) : 0;
  if (isNaN(fileCount) || fileCount < 1 || fileCount > 10) {
    return json400("fileCount는 1~10 사이여야 합니다.");
  }

  // 5. uploads row 생성 (processing)
  const { data: uploadRow, error: uploadError } = await supabase
    .from("uploads")
    .insert({
      listing_id: listingId,
      uploader_id: userId,
      accepted_count: 0,
      rejected_count: 0,
      status: "processing",
      score_delta: null,
      badge_achieved: null,
    })
    .select("id")
    .single();

  if (uploadError || !uploadRow) {
    return NextResponse.json(
      { success: false, data: null, error: { code: "DB_ERROR", message: "업로드 세션 생성에 실패했습니다." }, meta: null },
      { status: 500 }
    );
  }

  const uploadId = (uploadRow as { id: string }).id;

  // 6. 파일별 photos row 생성 + 비공개 버킷 저장
  const photoInserts: Array<{
    listing_id: string;
    uploader_id: string;
    original_path: string;
    status: "processing";
  }> = [];

  for (let i = 0; i < fileCount; i++) {
    const file = formData.get(`file_${i}`) as File | null;
    if (!file) continue;

    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const originalPath = `listings/${listingId}/uploads/${uploadId}/${i}_${safeName}`;

    const { error: storageError } = await supabase.storage
      .from(PRIVATE_BUCKET)
      .upload(originalPath, file, { upsert: false });

    if (storageError) {
      console.error(`파일 ${i} 스토리지 업로드 실패: ${storageError.message}`);
      continue;
    }

    photoInserts.push({
      listing_id: listingId,
      uploader_id: userId,
      original_path: originalPath,
      status: "processing",
    });
  }

  if (photoInserts.length === 0) {
    await supabase.from("uploads").update({ status: "error" }).eq("id", uploadId);
    return NextResponse.json(
      { success: false, data: null, error: { code: "UPLOAD_ERROR", message: "파일 업로드에 모두 실패했습니다." }, meta: null },
      { status: 500 }
    );
  }

  const { error: photosError } = await supabase.from("photos").insert(photoInserts);
  if (photosError) {
    console.error(`photos rows 삽입 실패: ${photosError.message}`);
  }

  // 7. photo-pipeline Edge Function 트리거 (비동기 fire-and-forget)
  triggerPhotoPipeline(uploadId, listingId).catch((e) =>
    console.error("photo-pipeline 트리거 실패:", e)
  );

  // 8. processing 응답 반환 (낙관적 응답 금지)
  const result: UploadResult = {
    uploadId,
    listingId,
    acceptedCount: 0,
    rejectedCount: 0,
    status: "processing",
    done: false,
    message: "사진이 서버에 저장되었습니다. 처리 결과는 폴링으로 확인하세요.",
    scoreDelta: null,
    badgeAchieved: null,
  };

  return NextResponse.json(
    { success: true, data: result, error: null, meta: null },
    { status: 202 }
  );
}

async function triggerPhotoPipeline(uploadId: string, listingId: string): Promise<void> {
  const functionsUrl = process.env.SUPABASE_FUNCTIONS_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!functionsUrl || !serviceKey) {
    console.warn("photo-pipeline 트리거 스킵: SUPABASE_FUNCTIONS_URL 미설정 (로컬 개발)");
    return;
  }

  await fetch(`${functionsUrl}/photo-pipeline`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ uploadId, listingId }),
  });
}
