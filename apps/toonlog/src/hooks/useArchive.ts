/**
 * 아카이브(일기 목록) 조회 훅.
 * GET /api/diary?page=N
 * API 미가동 시 mock 폴백.
 */
"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import type { Diary } from "@/lib/contract";
import { MOCK_DIARY_LIST } from "@/lib/mock";

interface ArchivePage {
  items: Diary[];
  nextCursor: string | null;
  total: number;
}

async function fetchArchivePage(cursor: string | null): Promise<ArchivePage> {
  const url = cursor
    ? `/api/diary?cursor=${cursor}`
    : "/api/diary";
  const res = await fetch(url);
  if (!res.ok) throw new Error("archive fetch failed");
  const json = await res.json();
  if (!json.ok) throw new Error(json.error?.message ?? "archive error");
  return json.data as ArchivePage;
}

export function useArchive() {
  return useInfiniteQuery<ArchivePage, Error>({
    queryKey: ["archive"],
    queryFn: ({ pageParam }) =>
      fetchArchivePage(pageParam as string | null).catch(() => ({
        items: MOCK_DIARY_LIST,
        nextCursor: null,
        total: MOCK_DIARY_LIST.length,
      })),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 60_000,
  });
}
