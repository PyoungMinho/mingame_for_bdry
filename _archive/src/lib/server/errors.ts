/**
 * 오름(Oreum) 에러 코드 표준화
 * 모든 API 핸들러는 이 파일의 AppError를 throw
 */

import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// 에러 코드 열거형
// ---------------------------------------------------------------------------

export const ErrorCode = {
  // 인증
  E_AUTH_REQUIRED: "E_AUTH_REQUIRED",
  E_AUTH_INVALID_TOKEN: "E_AUTH_INVALID_TOKEN",

  // 연령 차단
  E_AGE_BLOCKED: "E_AGE_BLOCKED",

  // 레드라인
  E_REDLINE_REJECT: "E_REDLINE_REJECT",

  // AI 예산
  E_AI_QUOTA_EXCEEDED: "E_AI_QUOTA_EXCEEDED",

  // 유료 기능 게이트
  E_PAYWALL_REQUIRED: "E_PAYWALL_REQUIRED",

  // 입력 검증
  E_VALIDATION: "E_VALIDATION",

  // 체크인 중복
  E_CHECKIN_ALREADY_DONE: "E_CHECKIN_ALREADY_DONE",

  // 리소스 없음
  E_NOT_FOUND: "E_NOT_FOUND",

  // 레이트리밋
  E_RATE_LIMIT: "E_RATE_LIMIT",

  // 서버 내부
  E_INTERNAL: "E_INTERNAL",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// ---------------------------------------------------------------------------
// HTTP 상태코드 매핑
// ---------------------------------------------------------------------------

const HTTP_STATUS: Record<ErrorCode, number> = {
  E_AUTH_REQUIRED: 401,
  E_AUTH_INVALID_TOKEN: 401,
  E_AGE_BLOCKED: 403,
  E_REDLINE_REJECT: 422,
  E_AI_QUOTA_EXCEEDED: 429,
  E_PAYWALL_REQUIRED: 402,
  E_VALIDATION: 400,
  E_CHECKIN_ALREADY_DONE: 409,
  E_NOT_FOUND: 404,
  E_RATE_LIMIT: 429,
  E_INTERNAL: 500,
};

// ---------------------------------------------------------------------------
// AppError 클래스
// ---------------------------------------------------------------------------

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message?: string, details?: unknown) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// 편의 팩토리
// ---------------------------------------------------------------------------

export const Errors = {
  authRequired: () => new AppError(ErrorCode.E_AUTH_REQUIRED, "인증이 필요합니다"),
  ageBlocked: (age: number) =>
    new AppError(
      ErrorCode.E_AGE_BLOCKED,
      `만 16세 미만은 오름 서비스를 이용할 수 없습니다 (현재 ${age}세)`,
      { age }
    ),
  redlineReject: (field: string) =>
    new AppError(
      ErrorCode.E_REDLINE_REJECT,
      "오름은 외모·타인 비교 요청을 지원하지 않습니다",
      { field }
    ),
  aiQuotaExceeded: (usedKrw: number) =>
    new AppError(
      ErrorCode.E_AI_QUOTA_EXCEEDED,
      `이번 달 AI 사용 한도(₩200)를 초과했습니다. 경량 모드로 전환됩니다`,
      { usedKrw }
    ),
  paywallRequired: (reason: "free_trial_ended" | "not_subscribed") =>
    new AppError(
      ErrorCode.E_PAYWALL_REQUIRED,
      reason === "free_trial_ended"
        ? "3일 무료 체험이 종료되었습니다. Pro 구독 후 이용 가능합니다"
        : "Pro 구독이 필요한 기능입니다",
      { reason }
    ),
  validation: (details: unknown) =>
    new AppError(ErrorCode.E_VALIDATION, "요청 값이 올바르지 않습니다", details),
  checkinAlreadyDone: () =>
    new AppError(ErrorCode.E_CHECKIN_ALREADY_DONE, "오늘 이미 체크인하셨습니다"),
  notFound: (resource: string) =>
    new AppError(ErrorCode.E_NOT_FOUND, `${resource}을(를) 찾을 수 없습니다`),
  rateLimit: () =>
    new AppError(ErrorCode.E_RATE_LIMIT, "요청이 너무 많습니다. 잠시 후 다시 시도해주세요"),
  internal: (message?: string) =>
    new AppError(ErrorCode.E_INTERNAL, message ?? "서버 내부 오류가 발생했습니다"),
};

// ---------------------------------------------------------------------------
// NextResponse 변환 헬퍼
// ---------------------------------------------------------------------------

export function toErrorResponse(err: unknown): NextResponse {
  const requestId = crypto.randomUUID();
  const ts = new Date().toISOString();

  if (err instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
        meta: { requestId, ts },
      },
      { status: err.httpStatus }
    );
  }

  console.error("[UnhandledError]", err);
  return NextResponse.json(
    {
      success: false,
      error: {
        code: ErrorCode.E_INTERNAL,
        message: "서버 내부 오류가 발생했습니다",
      },
      meta: { requestId, ts },
    },
    { status: 500 }
  );
}

/** 성공 응답 헬퍼 */
export function toSuccessResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: { requestId: crypto.randomUUID(), ts: new Date().toISOString() },
    },
    { status }
  );
}
