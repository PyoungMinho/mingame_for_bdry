/**
 * 잔여 한도 조회 훅.
 * 캐시 staleTime 30s — 생성 완료/결제 후 invalidate.
 * API 미가동 시 mock 폴백.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import type { QuotaInfo } from "@/lib/contract";
import { MOCK_QUOTA } from "@/lib/mock";

async function fetchQuota(): Promise<QuotaInfo> {
  const res = await fetch("/api/quota");
  if (!res.ok) throw new Error("quota fetch failed");
  const json = await res.json();
  if (!json.ok) throw new Error(json.error?.message ?? "quota error");
  return json.data as QuotaInfo;
}

export function useQuota() {
  return useQuery<QuotaInfo, Error>({
    queryKey: ["quota"],
    queryFn: fetchQuota,
    staleTime: 30_000,
    gcTime: 2 * 60_000,
    placeholderData: MOCK_QUOTA,
    // API 미가동이어도 placeholder로 렌더 가능
  });
}
