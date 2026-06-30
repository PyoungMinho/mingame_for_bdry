"use client";

/**
 * 클라이언트 React Query 훅 — 업로드 초기화 + 상태 폴링.
 * PhotoUploader 컴포넌트에서 사용.
 *
 * 비낙관 처리 원칙:
 *  - useUploadInit: processing 상태 즉시 반환(서버 확정값). 낙관적 success 표시 금지.
 *  - useUploadStatus: uploadId 있을 때만 폴링. done/error 시 폴링 중단.
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import type { UploadResult } from "@/lib/types/domain";

// ──────────────────────────────────────────────
// 업로드 초기화 뮤테이션
// ──────────────────────────────────────────────

interface UploadInitRequest {
  listingId: string;
  files: File[];
}

async function initUpload(req: UploadInitRequest): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("listingId", req.listingId);
  formData.append("fileCount", String(req.files.length));

  req.files.forEach((file, idx) => {
    formData.append(`file_${idx}`, file);
    formData.append(
      `meta_${idx}`,
      JSON.stringify({ name: file.name, size: file.size, mimeType: file.type })
    );
  });

  const authToken =
    typeof window !== "undefined"
      ? localStorage.getItem("sb-access-token")
      : null;

  const headers: HeadersInit = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const res = await fetch(`/api/listings/${req.listingId}/photos`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `업로드 초기화 실패: ${res.status}`);
  }

  const json = await res.json();
  return json.data as UploadResult;
}

export function useUploadInit() {
  return useMutation({
    mutationFn: initUpload,
  });
}

// ──────────────────────────────────────────────
// 업로드 상태 폴링
// ──────────────────────────────────────────────

async function fetchUploadStatus(uploadId: string): Promise<UploadResult> {
  const authToken =
    typeof window !== "undefined"
      ? localStorage.getItem("sb-access-token")
      : null;

  const headers: HeadersInit = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const res = await fetch(`/api/uploads/${uploadId}`, { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `업로드 상태 조회 실패: ${res.status}`);
  }
  const json = await res.json();
  return json.data as UploadResult;
}

/**
 * 업로드 상태 결과 — 서버 완료 신호 `done` 포함.
 * domain.ts 의 UploadResult 에 `done?: boolean` 이 추가되면 그 필드를 그대로 받지만,
 * 계약 추가 전에도 컴파일/동작하도록 로컬에서 교차 타입으로 보강한다(프론트 소유).
 */
export type UploadResultWithDone = UploadResult & { done?: boolean };

export function useUploadStatus(uploadId: string | null) {
  return useQuery<UploadResultWithDone>({
    queryKey: ["upload-status", uploadId],
    queryFn: () => fetchUploadStatus(uploadId!) as Promise<UploadResultWithDone>,
    enabled: uploadId != null,
    refetchInterval: (query) => {
      const data = query.state.data as UploadResultWithDone | undefined;
      if (data?.done || data?.status === "error") return false;
      return 3_000;
    },
    staleTime: 0,
  });
}
