/**
 * 일기 생성 뮤테이션 훅.
 * POST /api/diary → { diaryId, jobId, streamUrl }
 * 성공 시 quota 캐시 무효화.
 */
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateDiaryRequest, CreateDiaryResponse } from "@/lib/contract";

async function createDiary(
  body: CreateDiaryRequest
): Promise<CreateDiaryResponse> {
  const res = await fetch("/api/diary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error?.message ?? "일기 생성 실패");
  }
  const json = await res.json();
  if (!json.ok) throw new Error(json.error?.message ?? "일기 생성 실패");
  return json.data as CreateDiaryResponse;
}

export function useCreateDiary() {
  const qc = useQueryClient();
  return useMutation<CreateDiaryResponse, Error, CreateDiaryRequest>({
    mutationFn: createDiary,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quota"] });
      qc.invalidateQueries({ queryKey: ["archive"] });
    },
  });
}
