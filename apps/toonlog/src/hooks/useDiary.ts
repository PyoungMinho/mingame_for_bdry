/**
 * 단일 일기 조회 훅.
 * GET /api/diary/:id
 * API 미가동 시 mock 폴백.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import type { Diary } from "@/lib/contract";
import { MOCK_DIARY } from "@/lib/mock";

async function fetchDiary(id: string): Promise<Diary> {
  const res = await fetch(`/api/diary/${id}`);
  if (!res.ok) throw new Error("diary fetch failed");
  const json = await res.json();
  if (!json.ok) throw new Error(json.error?.message ?? "diary error");
  return json.data as Diary;
}

export function useDiary(id: string | null) {
  return useQuery<Diary, Error>({
    queryKey: ["diary", id],
    queryFn: () => fetchDiary(id!),
    enabled: !!id,
    staleTime: 5 * 60_000,
    placeholderData: MOCK_DIARY,
  });
}
