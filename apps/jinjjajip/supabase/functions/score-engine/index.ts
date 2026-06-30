/**
 * score-engine — Supabase Edge Function (Deno)
 *
 * 역할:
 *  score_items 전체 집계 → listings.trust_score / trust_grade / sort_rank / natural_label 갱신.
 *  domain.ts 의 aggregateTrustScore 로직을 서버(Deno)에서 미러.
 *
 * 호출 시점:
 *  - photo-pipeline 완료 후 (직접 호출 또는 DB 트리거)
 *  - 신고 처리 후 (reports insert 트리거 → 이 함수)
 *  - 외부 ACL 배치 완료 후 (M1)
 *
 * 외부 ACL 원칙 (direction.md §3):
 *  - owner/transaction 항목의 외부 조회 실패 = earned null(pending) 유지.
 *  - 0점으로 변환하지 않음. "미검증 ≠ 위반".
 *
 * M0 스텁:
 *  owner/transaction 항목은 earned null(pending) 유지.
 *  community(신고) 항목은 reports 수 기반 단순 계산.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// SCORE_WEIGHTS 미러 (domain.ts 동일값)
const SCORE_WEIGHTS = {
  photo: 35,
  exif: 20,
  community: 20,
  owner: 15,
  transaction: 10,
} as const;

const GRADE_CUTOFFS = { gold: 80, silver: 55 } as const;

type ScoreItemKey = "photo" | "exif" | "community" | "owner" | "transaction";
type TrustGrade = "gold" | "silver" | "unverified";

interface ScoreItem {
  key: ScoreItemKey;
  earned: number | null;
  max: number;
  status: string;
  delta_if_reported: number;
}

function computeGrade(score: number): TrustGrade {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  if (s >= GRADE_CUTOFFS.gold) return "gold";
  if (s >= GRADE_CUTOFFS.silver) return "silver";
  return "unverified";
}

function computeNaturalLabel(grade: TrustGrade): string {
  if (grade === "gold") return "실거주 세입자가 직접 찍음";
  if (grade === "silver") return "현장에서 촬영한 사진 있음";
  return "현장 미검증 매물";
}

/**
 * score_items → 총점 집계 (aggregateTrustScore 미러)
 * pending(null)은 점수에서 제외하되 maxPossible에는 포함.
 */
function aggregateScore(items: ScoreItem[]): { score: number; isLowerBound: boolean } {
  let score = 0;
  let hasPending = false;

  for (const item of items) {
    if (item.earned === null || item.status === "pending" || item.status === "processing") {
      hasPending = true;
      continue;
    }
    let earned = item.earned;
    if (item.status === "reported" && item.delta_if_reported < 0) {
      earned = Math.max(0, earned + item.delta_if_reported);
    }
    score += earned;
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), isLowerBound: hasPending };
}

/**
 * sort_rank 계산:
 *  - Gold 매물이 최상단
 *  - 같은 등급 내에서 trust_score 기준
 *  - processing 매물(사진 분석 중)은 최하단
 */
function computeSortRank(score: number, grade: TrustGrade, status: string): number {
  if (status === "processing") return 0;
  const gradeBonus = grade === "gold" ? 200 : grade === "silver" ? 100 : 0;
  return gradeBonus + score;
}

/**
 * 커뮤니티 신뢰 점수: 신고 수 기반 계산.
 * 신고 0건=만점, 1건=절반, 2건 이상=0점.
 */
function computeCommunityScore(reportCount: number): number {
  if (reportCount === 0) return SCORE_WEIGHTS.community;
  if (reportCount === 1) return Math.floor(SCORE_WEIGHTS.community * 0.5);
  return 0;
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

  let body: { listingId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON 파싱 실패" }), { status: 400 });
  }

  const listingId = body.listingId;
  if (!listingId) {
    return new Response(JSON.stringify({ error: "listingId 필수" }), { status: 400 });
  }

  console.log(`[score-engine] 시작: listingId=${listingId}`);

  try {
    // 1. score_items 조회
    const { data: items, error: itemsError } = await supabase
      .from("score_items")
      .select("key, earned, max, status, delta_if_reported")
      .eq("listing_id", listingId);

    if (itemsError) throw new Error(`score_items 조회 실패: ${itemsError.message}`);

    // 2. community 점수 현행화
    const { count: reportCount } = await supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listingId)
      .in("status", ["received", "reviewing"]);

    const communityEarned = computeCommunityScore(reportCount ?? 0);

    // community score_item 갱신 (이미 verified 인 경우도 재계산)
    const communityItem = (items ?? []).find((i) => i.key === "community");
    if (communityItem) {
      await supabase
        .from("score_items")
        .update({
          earned: communityEarned,
          status: "verified",
          verified_at: new Date().toISOString(),
        })
        .eq("listing_id", listingId)
        .eq("key", "community");
    }

    // owner/transaction 항목: 외부 ACL 미연동 → earned null(pending) 유지
    // "실패=0점"이 아니라 "미검증=pending" 원칙 보장
    // TODO(M1 ACL PoC): owner = CODEF 등기 조회, transaction = 공공데이터 거래 정황

    // 3. 최신 score_items로 재집계
    const updatedItems = (items ?? []).map((i): ScoreItem => {
      if (i.key === "community") {
        return { ...i as ScoreItem, earned: communityEarned, status: "verified" };
      }
      return i as ScoreItem;
    });

    const { score } = aggregateScore(updatedItems);
    const grade = computeGrade(score);

    // 4. listings 상태 확인 (신고 여부 반영)
    const { data: listing } = await supabase
      .from("listings")
      .select("status")
      .eq("id", listingId)
      .maybeSingle();

    const currentStatus = listing?.status ?? "pending";
    const sortRank = computeSortRank(score, grade, currentStatus);
    const naturalLabel = computeNaturalLabel(grade);

    // 5. listings 갱신
    await supabase
      .from("listings")
      .update({
        trust_score: score,
        trust_grade: grade,
        sort_rank: sortRank,
        natural_label: naturalLabel,
      })
      .eq("id", listingId);

    console.log(
      `[score-engine] 완료: listingId=${listingId}, score=${score}, grade=${grade}, sort_rank=${sortRank}`
    );

    return new Response(
      JSON.stringify({ success: true, listingId, score, grade, sortRank }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[score-engine] 처리 오류:", err);
    return new Response(
      JSON.stringify({ error: "스코어 엔진 처리 실패" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
