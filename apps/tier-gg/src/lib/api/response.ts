/**
 * API 응답 헬퍼 — 모든 Route Handler에서 공유
 */
import { NextResponse } from "next/server";
import type { ApiResponse, ApiErrorResponse, ApiMeta } from "@/lib/types/model";

/** GET 응답 캐시 헤더 (공개, 5분 CDN, 1시간 stale) */
export const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
};

/** 성공 응답 */
export function ok<T>(
  data: T,
  meta?: ApiMeta,
  status = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    { success: true, data, error: null, ...(meta ? { meta } : {}) },
    { status, headers: CACHE_HEADERS }
  );
}

/** 성공 응답 (캐시 없음 — POST용) */
export function okNoCache<T>(
  data: T,
  meta?: ApiMeta,
  status = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    { success: true, data, error: null, ...(meta ? { meta } : {}) },
    { status }
  );
}

/** 에러 응답 */
export function err(
  code: string,
  message: string,
  status: number
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { success: false, data: null, error: { code, message } },
    { status }
  );
}

/** 공통 에러 */
export const Errors = {
  notFound: (entity = "Resource") =>
    err("NOT_FOUND", `${entity} not found`, 404),
  badRequest: (msg: string) => err("BAD_REQUEST", msg, 400),
  unauthorized: () =>
    err("UNAUTHORIZED", "Authentication required", 401),
  forbidden: () =>
    err("FORBIDDEN", "Insufficient permissions", 403),
  internalError: () =>
    err("INTERNAL_ERROR", "Internal server error", 500),
  validationError: (msg: string) =>
    err("VALIDATION_ERROR", msg, 422),
};
