"use client";

/**
 * 클라이언트 React Query 훅 — 매물 조회 + 신고.
 * 프론트 컴포넌트에서 import 해 사용.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { ListingSearchQuery, Paginated, ListingSummary, ReportPayload } from "@/lib/types/domain";

// ──────────────────────────────────────────────
// fetch 헬퍼
// ──────────────────────────────────────────────

function buildSearchParams(query: ListingSearchQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.region) params.set("region", query.region);
  if (query.buildingType) params.set("buildingType", query.buildingType);
  if (query.minGrade) params.set("minGrade", query.minGrade);
  if (query.depositMax != null) params.set("depositMax", String(query.depositMax));
  if (query.rentMax != null) params.set("rentMax", String(query.rentMax));
  if (query.sort) params.set("sort", query.sort);
  if (query.limit != null) params.set("limit", String(query.limit));
  return params;
}

async function fetchListings(
  query: ListingSearchQuery,
  cursor?: string
): Promise<Paginated<ListingSummary>> {
  const params = buildSearchParams(query);
  if (cursor) params.set("cursor", cursor);

  const res = await fetch(`/api/listings?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `listings 조회 실패: ${res.status}`);
  }
  const json = await res.json();
  return json.data as Paginated<ListingSummary>;
}

async function postReport(payload: ReportPayload): Promise<void> {
  const res = await fetch(`/api/listings/${payload.listingId}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `신고 실패: ${res.status}`);
  }
}

// ──────────────────────────────────────────────
// 매물 목록 쿼리 (검색 홈)
//
// M0: 일반 useQuery — 첫 페이지(Paginated<ListingSummary>)를 그대로 반환.
//     page.tsx 는 data.items / data.total 로 접근. 계약 시그니처 = UseQueryResult<Paginated>.
// M1(연기): 무한 스크롤 필요 시 useInfiniteQuery 로 교체 + page.tsx 의 data.pages 평탄화.
//           getNextPageParam 은 fetchListings 의 nextCursor 를 그대로 사용하면 됨.
// ──────────────────────────────────────────────

export function useListingsQuery(
  query: ListingSearchQuery
): UseQueryResult<Paginated<ListingSummary>> {
  return useQuery({
    queryKey: ["listings", query],
    queryFn: () => fetchListings(query),
    staleTime: 30_000,
  });
}

// ──────────────────────────────────────────────
// 신고 뮤테이션
// ──────────────────────────────────────────────

export function useReportMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postReport,
    onSuccess: (_data, variables) => {
      // 신고 즉시 비공개 전환 → 캐시 무효화(낙관적 제거 금지)
      qc.invalidateQueries({ queryKey: ["listings"] });
      qc.invalidateQueries({ queryKey: ["listing", variables.listingId] });
    },
  });
}
