// REDLINE: 타인 비교/외모 점수 UI 금지
// API 클라이언트 화이트리스트: 타인 비교 엔드포인트 차단

import { useAuthStore } from "@/lib/store/auth";

// ---------------------------------------------------------------------------
// 레드라인 화이트리스트 — 허용된 경로 패턴만 통과
// 타인 비교("leaderboard", "ranking", "compare", "average-all", "peer") 요청 차단
// ---------------------------------------------------------------------------

const ALLOWED_PATH_PATTERNS = [
  /^\/api\/checkin/,
  /^\/api\/score\/today/,
  /^\/api\/score\/history/,    // 본인 과거치만
  /^\/api\/coach\/chat/,
  /^\/api\/mission/,
  /^\/api\/goal/,
  /^\/api\/me/,
  /^\/api\/onboarding/,
  /^\/api\/health/,
  /^\/api\/paywall/,
];

/** 요청 경로가 레드라인 차단 대상인지 확인 */
function isBlockedPath(path: string): boolean {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return !ALLOWED_PATH_PATTERNS.some((pattern) => pattern.test(normalizedPath));
}

// ---------------------------------------------------------------------------
// 표준 에러 타입
// ---------------------------------------------------------------------------

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  httpStatus: number;
}

export class OreumApiError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(error: ApiError) {
    super(error.message);
    this.name = "OreumApiError";
    this.code = error.code;
    this.httpStatus = error.httpStatus;
    this.details = error.details;
  }
}

// ---------------------------------------------------------------------------
// fetch 래퍼
// ---------------------------------------------------------------------------

interface FetchOptions extends RequestInit {
  /** 쿼리 파라미터 객체 */
  params?: Record<string, string | number | boolean | undefined>;
}

export async function apiClient<T>(path: string, options: FetchOptions = {}): Promise<T> {
  // 레드라인 차단
  if (isBlockedPath(path)) {
    console.error(`[REDLINE] 차단된 API 경로: ${path}`);
    throw new OreumApiError({
      code: "E_REDLINE_REJECT",
      message: "요청이 차단되었습니다. 오름은 타인 비교·외모 점수를 지원하지 않습니다.",
      httpStatus: 422,
    });
  }

  // 쿼리 파라미터 조합
  const { params, ...fetchOptions } = options;
  let url = path;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined) searchParams.set(key, String(val));
    }
    const qs = searchParams.toString();
    if (qs) url = `${path}?${qs}`;
  }

  // Authorization 헤더 자동 주입
  const token = useAuthStore.getState().accessToken;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  // 응답 파싱
  let body: unknown;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    body = await response.json();
  } else {
    body = await response.text();
  }

  if (!response.ok) {
    const errBody = body as {
      error?: { code?: string; message?: string; details?: unknown };
    };
    throw new OreumApiError({
      code: errBody?.error?.code ?? "E_UNKNOWN",
      message: errBody?.error?.message ?? "알 수 없는 오류가 발생했습니다",
      details: errBody?.error?.details,
      httpStatus: response.status,
    });
  }

  const successBody = body as { success: true; data: T };
  return successBody.data;
}

// ---------------------------------------------------------------------------
// 메서드 단축 헬퍼
// ---------------------------------------------------------------------------

export const api = {
  get: <T>(path: string, params?: FetchOptions["params"]) =>
    apiClient<T>(path, { method: "GET", params }),

  post: <T>(path: string, data?: unknown) =>
    apiClient<T>(path, {
      method: "POST",
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(path: string, data?: unknown) =>
    apiClient<T>(path, {
      method: "PATCH",
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(path: string) => apiClient<T>(path, { method: "DELETE" }),
};
