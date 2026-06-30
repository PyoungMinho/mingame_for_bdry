/**
 * photo-pipeline — Supabase Edge Function (Deno)
 *
 * 역할:
 *  ① 원본 파일 수신 (비공개 버킷 경로 기반)
 *  ② EXIF 추출 + GPS·타임스탬프 정합 검증
 *  ③ AI 블러 게이트 (얼굴·송장·서류·개인정보 → 100% 서버 처리)
 *  ④ 생활흔적 스코어링
 *  ⑤ 블러 통과본 → 공개 버킷 게시
 *  ⑥ photos.status=approved/rejected, blurred_path 설정
 *  ⑦ score_items(photo, exif) earned 갱신
 *  ⑧ recompute_listing_score(listing_id) 호출
 *
 * 절대 제약:
 *  - 원본은 비공개 버킷에서 절대 삭제/공개하지 않음.
 *  - 블러 미통과본의 blurred_path는 null 유지.
 *  - earned null = pending. 검증 실패 = 0(pending 아님).
 *  - 모든 이미지 처리는 이 워커에서만. Route Handler에서 처리 금지.
 *
 * M0 스텁:
 *  실제 ML 모델 연동 대신 TODO 주석 + 인터페이스/흐름 구현.
 *  EXIF 파싱: exifr 라이브러리 연동 TODO.
 *  블러: face-api / Rekognition / Google Vision API 연동 TODO.
 *  생활흔적: 자체 모델 / OpenAI Vision API 연동 TODO.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PRIVATE_BUCKET = "listing-photos-original";
const PUBLIC_BUCKET = "listing-photos-blurred";

// 배점 상수 — domain.ts SCORE_WEIGHTS 미러
const SCORE_WEIGHTS = {
  photo: 35,
  exif: 20,
} as const;

interface PipelineRequest {
  uploadId: string;
  listingId: string;
}

interface ExifResult {
  /** GPS 좌표 존재 여부 */
  hasGps: boolean;
  /** 위도 */
  latitude?: number;
  /** 경도 */
  longitude?: number;
  /** 촬영 타임스탬프 (ISO 8601) */
  takenAt?: string;
  /** 기기 정보 */
  deviceModel?: string;
  /** 원본 EXIF JSON */
  raw: Record<string, unknown>;
}

interface BlurResult {
  /** 블러 처리 통과 여부 */
  passed: boolean;
  /** 공개 버킷에 저장된 블러 이미지 경로 */
  blurredPath?: string;
  /** 차단 사유 (실패 시) */
  rejectReason?: string;
}

interface LivenessResult {
  /** 생활흔적 스코어 0.0~1.0 */
  score: number;
}

// ──────────────────────────────────────────────
// EXIF 추출 (스텁)
// ──────────────────────────────────────────────

async function extractExif(imageBytes: Uint8Array): Promise<ExifResult> {
  // TODO(M0 PoC): exifr(Deno 호환) 또는 Sharp EXIF 연동
  //   const exifr = await import("https://esm.sh/exifr@7");
  //   const exif = await exifr.parse(imageBytes, { gps: true, tiff: true });
  //   return { hasGps: !!exif?.latitude, latitude: exif?.latitude, ... };

  console.log(`[photo-pipeline] EXIF 추출 스텁 실행 (이미지 크기: ${imageBytes.length}bytes)`);

  // 스텁: GPS 없음, 타임스탬프 없음
  return {
    hasGps: false,
    raw: { _stub: true, size: imageBytes.length },
  };
}

// ──────────────────────────────────────────────
// EXIF 점수 계산
// ──────────────────────────────────────────────

function computeExifScore(exif: ExifResult): number {
  // GPS + 타임스탬프 모두 있으면 만점
  if (exif.hasGps && exif.takenAt) return SCORE_WEIGHTS.exif;
  // GPS만 있으면 절반
  if (exif.hasGps) return Math.floor(SCORE_WEIGHTS.exif * 0.5);
  // 없으면 0 (pending 아님 — 검증했으나 0점)
  return 0;
}

// ──────────────────────────────────────────────
// AI 블러 게이트 (스텁)
// ──────────────────────────────────────────────

async function runBlurGate(
  imageBytes: Uint8Array,
  originalPath: string,
  supabase: ReturnType<typeof createClient>
): Promise<BlurResult> {
  // TODO(M0 PoC): AI 블러 파이프라인 연동
  //   옵션 A: AWS Rekognition (얼굴 감지) + sharp (블러 적용)
  //   옵션 B: Google Cloud Vision API
  //   옵션 C: 자체 경량 모델 (face-api.js Deno 포트)
  //
  //   흐름:
  //     1. 얼굴·개인정보 영역 감지 → BoundingBox 목록
  //     2. sharp로 해당 영역 가우시안 블러 적용
  //     3. 결과 이미지를 PUBLIC_BUCKET에 저장
  //     4. 거부 조건: 전체 이미지의 50% 이상이 얼굴로 덮임 (실내 사진 아닌 것)

  console.log(`[photo-pipeline] AI 블러 게이트 스텁 실행 (원본: ${originalPath})`);

  // 스텁: 블러 없이 동일 경로를 공개 버킷에 복사 (실제 운영 금지 — PoC용)
  const blurredPath = originalPath.replace(/^listings\//, "blurred/");

  // TODO: 실제 구현 시 sharp 변환 후 업로드
  const { error } = await supabase.storage
    .from(PUBLIC_BUCKET)
    .upload(blurredPath, imageBytes, { upsert: true, contentType: "image/jpeg" });

  if (error) {
    console.error(`[photo-pipeline] 공개 버킷 업로드 실패: ${error.message}`);
    return { passed: false, rejectReason: "storage_error" };
  }

  return { passed: true, blurredPath };
}

// ──────────────────────────────────────────────
// 생활흔적 스코어링 (스텁)
// ──────────────────────────────────────────────

async function scoreLiveness(imageBytes: Uint8Array): Promise<LivenessResult> {
  // TODO(M1): 자체 생활흔적 분류 모델 연동
  //   생활용품(칫솔/수건/화장품/식기) 감지 → 확률 기반 스코어링
  //   OpenAI Vision API: "이 이미지에 실제 거주 흔적이 있는지 판단해줘" (M0 PoC)

  console.log(`[photo-pipeline] 생활흔적 스코어링 스텁 실행 (크기: ${imageBytes.length}bytes)`);

  // 스텁: 중간값 반환
  return { score: 0.5 };
}

// ──────────────────────────────────────────────
// 사진 점수 집계 → score_items 갱신
// ──────────────────────────────────────────────

function computePhotoScore(approvedCount: number, totalCount: number): number {
  if (totalCount === 0) return 0;
  const ratio = approvedCount / totalCount;
  return Math.round(SCORE_WEIGHTS.photo * ratio);
}

// ──────────────────────────────────────────────
// 메인 핸들러
// ──────────────────────────────────────────────

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "환경변수 누락" }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  let body: PipelineRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON 파싱 실패" }), { status: 400 });
  }

  const { uploadId, listingId } = body;
  if (!uploadId || !listingId) {
    return new Response(JSON.stringify({ error: "uploadId, listingId 필수" }), { status: 400 });
  }

  console.log(`[photo-pipeline] 시작: uploadId=${uploadId}, listingId=${listingId}`);

  try {
    // 1. 해당 업로드의 photos 목록 조회
    const { data: photos, error: photosError } = await supabase
      .from("photos")
      .select("id, original_path, status")
      .eq("listing_id", listingId)
      .eq("status", "processing");

    if (photosError || !photos?.length) {
      console.error("[photo-pipeline] photos 조회 실패 또는 없음");
      await supabase.from("uploads").update({ status: "error" }).eq("id", uploadId);
      return new Response(JSON.stringify({ error: "처리할 사진 없음" }), { status: 404 });
    }

    let approvedCount = 0;
    let rejectedCount = 0;
    let totalExifScore = 0;
    let processedForExif = 0;

    // 2. 사진별 파이프라인 처리
    for (const photo of photos) {
      try {
        // 2-1. 원본 파일 다운로드 (비공개 버킷)
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(PRIVATE_BUCKET)
          .download(photo.original_path);

        if (downloadError || !fileData) {
          console.error(`[photo-pipeline] 원본 다운로드 실패: ${photo.id}`);
          await supabase.from("photos").update({ status: "rejected" }).eq("id", photo.id);
          rejectedCount++;
          continue;
        }

        const imageBytes = new Uint8Array(await fileData.arrayBuffer());

        // 2-2. EXIF 추출
        const exif = await extractExif(imageBytes);
        const exifScore = computeExifScore(exif);
        totalExifScore += exifScore;
        processedForExif++;

        // 2-3. AI 블러 게이트
        const blurResult = await runBlurGate(imageBytes, photo.original_path, supabase);

        if (!blurResult.passed) {
          await supabase
            .from("photos")
            .update({ status: "rejected", exif: exif.raw })
            .eq("id", photo.id);
          rejectedCount++;
          continue;
        }

        // 2-4. 생활흔적 스코어
        const liveness = await scoreLiveness(imageBytes);

        // 2-5. photos row 갱신 (approved)
        await supabase
          .from("photos")
          .update({
            status: "approved",
            blurred_path: blurResult.blurredPath!,
            exif: exif.raw,
            liveness_score: liveness.score,
          })
          .eq("id", photo.id);

        approvedCount++;
      } catch (photoErr) {
        console.error(`[photo-pipeline] 사진 처리 오류: ${photo.id}`, photoErr);
        await supabase.from("photos").update({ status: "rejected" }).eq("id", photo.id);
        rejectedCount++;
      }
    }

    // 3. score_items(photo) 갱신
    const photoEarned = computePhotoScore(approvedCount, photos.length);
    await supabase
      .from("score_items")
      .update({
        earned: photoEarned,
        status: "verified",
        verified_at: new Date().toISOString(),
      })
      .eq("listing_id", listingId)
      .eq("key", "photo");

    // 4. score_items(exif) 갱신
    //    여러 사진의 EXIF 평균 (단순화: 최대값 사용)
    const exifEarned =
      processedForExif > 0 ? Math.round(totalExifScore / processedForExif) : 0;
    await supabase
      .from("score_items")
      .update({
        earned: exifEarned,
        status: "verified",
        verified_at: new Date().toISOString(),
      })
      .eq("listing_id", listingId)
      .eq("key", "exif");

    // 5. uploads row 완료 갱신 (scoreDelta는 recompute 이후 채움)
    await supabase
      .from("uploads")
      .update({
        accepted_count: approvedCount,
        rejected_count: rejectedCount,
        status: approvedCount > 0 ? "done" : "error",
      })
      .eq("id", uploadId);

    // 6. recompute_listing_score 호출 (DB 함수, DB설계자 소유)
    const { error: recomputeError } = await supabase.rpc("recompute_listing_score", {
      listing_id: listingId,
    });
    if (recomputeError) {
      console.error(`[photo-pipeline] recompute_listing_score 실패: ${recomputeError.message}`);
    }

    // 7. score-engine 트리거 (선택 — recompute가 이미 처리하므로 추가 트리거는 M1에서)
    // TODO(M1): score-engine Edge Function 호출 or DB 트리거로 대체

    console.log(
      `[photo-pipeline] 완료: uploadId=${uploadId}, approved=${approvedCount}, rejected=${rejectedCount}`
    );

    return new Response(
      JSON.stringify({ success: true, uploadId, approvedCount, rejectedCount }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[photo-pipeline] 처리 중 치명적 오류:", err);
    await supabase.from("uploads").update({ status: "error" }).eq("id", uploadId);
    return new Response(
      JSON.stringify({ error: "파이프라인 처리 실패" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
