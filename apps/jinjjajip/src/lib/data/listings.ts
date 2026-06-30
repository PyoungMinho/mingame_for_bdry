/**
 * RSC 서버 데이터 레이어 — 매물 조회.
 *
 * 절대 제약:
 *  - status in ('reported', 'taken_down') 는 리스트에서 필터 제외.
 *  - 정렬은 sort_rank desc (서버 사전계산값). 프론트 재정렬 금지.
 *  - earned null 은 그대로 null 로 전달(0 변환 금지).
 *  - 사진은 status='approved' & blurred_path IS NOT NULL 만.
 */

import type {
  ListingSummary,
  ListingDetail,
  ListingSearchQuery,
  Paginated,
  ScoreBreakdownItem,
  ScoreItemKey,
  TrustScore,
} from "@/lib/types/domain";
import { aggregateTrustScore, SCORE_WEIGHTS } from "@/lib/types/domain";
import { createServerClient } from "@/lib/supabase/server";

// ──────────────────────────────────────────────
// 내부 타입 (DB 로우 형태, Supabase 제네릭 없이)
// ──────────────────────────────────────────────

interface RawScoreItem {
  key: string;
  earned: number | null;
  max: number;
  status: string;
  verified_at: string | null;
  delta_if_reported: number;
}

interface RawListing {
  id: string;
  title: string;
  address: string;
  region: string;
  building_type: string;
  deposit_manwon: number;
  monthly_rent_manwon: number;
  status: string;
  natural_label: string | null;
  trust_score: number;
  trust_grade: string;
  sort_rank: number;
  thumbnail_url: string | null;
  description?: string | null;
  area_m2?: number | null;
  floor?: string | null;
  updated_at?: string;
  agent_id?: string | null;
  score_items: RawScoreItem[];
  photos?: Array<{ blurred_path: string | null; status: string }>;
}

// ──────────────────────────────────────────────
// 내부 헬퍼
// ──────────────────────────────────────────────

function mapScoreItemRow(row: RawScoreItem): ScoreBreakdownItem {
  return {
    key: row.key as ScoreItemKey,
    earned: row.earned, // null = pending, 절대 0으로 변환하지 않음
    max: row.max,
    status: row.status as ScoreBreakdownItem["status"],
    verifiedAt: row.verified_at ?? null,
    deltaIfReported: row.delta_if_reported !== 0 ? row.delta_if_reported : undefined,
  };
}

function buildGradeFilter(minGrade: ListingSearchQuery["minGrade"]) {
  if (!minGrade) return null;
  if (minGrade === "gold") return ["gold"];
  if (minGrade === "silver") return ["gold", "silver"];
  return ["gold", "silver", "unverified"];
}

// ──────────────────────────────────────────────
// getListings — 검색 리스트 (RSC / API route 공용)
// ──────────────────────────────────────────────

export async function getListings(
  query: ListingSearchQuery
): Promise<Paginated<ListingSummary>> {
  const supabase = createServerClient();
  const limit = query.limit ?? 20;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .from("listings")
    .select(
      `
      id,
      title,
      address,
      region,
      building_type,
      deposit_manwon,
      monthly_rent_manwon,
      status,
      natural_label,
      trust_score,
      trust_grade,
      sort_rank,
      thumbnail_url,
      score_items ( key, earned, max, status, verified_at, delta_if_reported )
      `
    )
    .not("status", "in", '("reported","taken_down")')
    .is("deleted_at", null);

  if (query.region) q = q.eq("region", query.region);
  if (query.buildingType) q = q.eq("building_type", query.buildingType);

  const gradeFilter = buildGradeFilter(query.minGrade);
  if (gradeFilter) q = q.in("trust_grade", gradeFilter);

  if (query.depositMax != null) q = q.lte("deposit_manwon", query.depositMax);
  if (query.rentMax != null) q = q.lte("monthly_rent_manwon", query.rentMax);

  // 정렬 — sort_rank desc 가 기본. 서버 사전계산 신뢰순.
  if (query.sort === "recent") {
    q = q.order("created_at", { ascending: false });
  } else if (query.sort === "price_low") {
    q = q.order("monthly_rent_manwon", { ascending: true }).order("deposit_manwon", { ascending: true });
  } else {
    q = q.order("sort_rank", { ascending: false });
  }

  // 커서 페이지네이션 (offset 금지)
  if (query.cursor) {
    const cursorNum = parseFloat(query.cursor);
    if (!isNaN(cursorNum)) {
      q = q.lt("sort_rank", cursorNum);
    }
  }

  q = q.limit(limit + 1);

  const { data, error } = await q;
  if (error) throw new Error(`getListings 쿼리 실패: ${error.message}`);

  const rows = (data ?? []) as RawListing[];
  const hasMore = rows.length > limit;
  const items = (hasMore ? rows.slice(0, limit) : rows).map((row): ListingSummary => {
    const scoreItems = (row.score_items ?? []).map(mapScoreItemRow);

    return {
      id: row.id,
      title: row.title,
      address: row.address,
      deposit: row.deposit_manwon,
      monthlyRent: row.monthly_rent_manwon,
      trustScore: row.trust_score,
      trustGrade: row.trust_grade as ListingSummary["trustGrade"],
      naturalLabel: row.natural_label ?? "",
      thumbnailUrl: row.thumbnail_url ?? null,
      scoreBreakdown: scoreItems,
      status: row.status as ListingSummary["status"],
      sortRank: row.sort_rank,
    };
  });

  const lastItem = items[items.length - 1];
  const nextCursor =
    hasMore && lastItem?.sortRank != null ? String(lastItem.sortRank) : null;

  return { items, nextCursor };
}

// ──────────────────────────────────────────────
// getListingById — 매물 상세 (RSC)
// ──────────────────────────────────────────────

export async function getListingById(id: string): Promise<ListingDetail | null> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error } = await (supabase as any)
    .from("listings")
    .select(
      `
      id,
      title,
      address,
      region,
      building_type,
      deposit_manwon,
      monthly_rent_manwon,
      status,
      natural_label,
      trust_score,
      trust_grade,
      sort_rank,
      thumbnail_url,
      description,
      area_m2,
      floor,
      updated_at,
      agent_id,
      score_items ( key, earned, max, status, verified_at, delta_if_reported ),
      photos ( blurred_path, status )
      `
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(`getListingById 쿼리 실패: ${error.message}`);
  if (!row) return null;

  const typedRow = row as RawListing;
  const scoreItems = (typedRow.score_items ?? []).map(mapScoreItemRow);

  // 공개 가능한 사진: status='approved' + blurred_path 있는 것만
  const photoUrls = (typedRow.photos ?? [])
    .filter((p) => p.status === "approved" && p.blurred_path != null)
    .map((p) => p.blurred_path as string);

  // trust: listings 사전계산값 + breakdown 집계로 isLowerBound 판정
  const aggregated: TrustScore = aggregateTrustScore(scoreItems);
  const trust: TrustScore = {
    ...aggregated,
    badgeAchieved: typedRow.trust_grade as TrustScore["badgeAchieved"],
    score: typedRow.trust_score,
  };

  // TODO(M1): profiles 조인으로 agent.name·verified 채우기
  const agent = typedRow.agent_id
    ? { name: "중개사", verified: false }
    : null;

  return {
    id: typedRow.id,
    title: typedRow.title,
    address: typedRow.address,
    deposit: typedRow.deposit_manwon,
    monthlyRent: typedRow.monthly_rent_manwon,
    trustScore: typedRow.trust_score,
    trustGrade: typedRow.trust_grade as ListingDetail["trustGrade"],
    naturalLabel: typedRow.natural_label ?? "",
    thumbnailUrl: typedRow.thumbnail_url ?? null,
    scoreBreakdown: scoreItems,
    status: typedRow.status as ListingDetail["status"],
    sortRank: typedRow.sort_rank,
    photoUrls,
    description: typedRow.description ?? undefined,
    areaM2: typedRow.area_m2 != null ? Number(typedRow.area_m2) : undefined,
    floor: typedRow.floor ?? undefined,
    buildingType: typedRow.building_type as ListingDetail["buildingType"],
    region: typedRow.region as ListingDetail["region"],
    trust,
    agent,
    updatedAt: typedRow.updated_at ?? "",
  };
}

export { SCORE_WEIGHTS };
