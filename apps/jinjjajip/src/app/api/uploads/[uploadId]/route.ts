/**
 * GET /api/uploads/[uploadId]
 * 업로드 처리 상태 폴링.
 * 프론트 useUploadStatus(uploadId) 훅이 3초 간격으로 호출.
 * done/error 시 프론트가 폴링을 중단한다.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, getRequestUserId } from "@/lib/supabase/server";
import type { UploadResult } from "@/lib/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RawUpload {
  id: string;
  listing_id: string;
  accepted_count: number;
  rejected_count: number;
  status: "processing" | "error" | "done";
  score_delta: number | null;
  badge_achieved: "gold" | "silver" | "unverified" | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { uploadId: string } }
) {
  const uploadId = params.uploadId;

  const userId = await getRequestUserId(request);
  if (!userId) {
    return NextResponse.json(
      { success: false, data: null, error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." }, meta: null },
      { status: 401 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient() as any;

  const { data: upload, error } = await supabase
    .from("uploads")
    .select("id, listing_id, accepted_count, rejected_count, status, score_delta, badge_achieved")
    .eq("id", uploadId)
    .eq("uploader_id", userId)
    .maybeSingle();

  if (error || !upload) {
    return NextResponse.json(
      { success: false, data: null, error: { code: "NOT_FOUND", message: "업로드 정보를 찾을 수 없습니다." }, meta: null },
      { status: 404 }
    );
  }

  const u = upload as RawUpload;
  const isDone = u.status === "done";

  // domain.ts UploadResult 와 정합: status 는 'processing'|'error' 유지, 완료는 done 필드로 전달.
  const result: UploadResult = {
    uploadId: u.id,
    listingId: u.listing_id,
    acceptedCount: u.accepted_count,
    rejectedCount: u.rejected_count,
    status: u.status === "error" ? "error" : "processing",
    done: isDone,
    scoreDelta: isDone ? (u.score_delta ?? null) : null,
    badgeAchieved: isDone ? (u.badge_achieved ?? null) : null,
  };

  return NextResponse.json({ success: true, data: result, error: null, meta: null });
}
