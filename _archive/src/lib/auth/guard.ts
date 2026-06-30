// REDLINE: 타인 비교/외모 점수 UI 금지
// 만 16세 미만 차단 + 미인증 리다이렉트 가드
import { isAgeEligible } from "@/lib/utils";

// ---------------------------------------------------------------------------
// 나이 검증 (클라이언트 사이드 선행 검사 — 서버 재검증 필수)
// ---------------------------------------------------------------------------

export interface AgeCheckResult {
  allowed: boolean;
  /** E_AGE_BLOCKED 사유 메시지 */
  reason?: string;
}

/**
 * 생년월일 문자열(YYYY-MM-DD)로 만 16세 이상 여부 확인
 * 온보딩 Step 1에서 호출. 서버 /api/onboarding/age-verify 와 이중 검증.
 */
export function checkAgeEligibility(birthDateStr: string): AgeCheckResult {
  if (!birthDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(birthDateStr)) {
    return { allowed: false, reason: "유효한 생년월일을 입력해주세요." };
  }

  const birthDate = new Date(birthDateStr);
  if (isNaN(birthDate.getTime())) {
    return { allowed: false, reason: "유효한 생년월일을 입력해주세요." };
  }

  if (!isAgeEligible(birthDate)) {
    return {
      allowed: false,
      reason: "만 16세 이상부터 이용 가능합니다.",
    };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 인증 상태 기반 리다이렉트 결정
// ---------------------------------------------------------------------------

export type AuthRedirectTarget =
  | { type: "allowed" }
  | { type: "redirect"; to: string };

/**
 * 페이지 접근 시 인증 상태 확인
 * - 미인증: /login 리다이렉트
 * - 온보딩 미완료: /onboarding 리다이렉트
 * - 만 16세 미만: /onboarding?blocked=age (차단 화면)
 */
export function resolveAuthRedirect(options: {
  isLoggedIn: boolean;
  onboardingDone: boolean;
  isAgeBlocked: boolean;
  currentPath: string;
}): AuthRedirectTarget {
  const { isLoggedIn, onboardingDone, isAgeBlocked, currentPath } = options;

  // 비인증 사용자는 /login으로
  if (!isLoggedIn) {
    if (currentPath !== "/login") {
      return { type: "redirect", to: "/login" };
    }
    return { type: "allowed" };
  }

  // 만 16세 미만 차단 — 어느 경로든 차단 화면 유지
  if (isAgeBlocked) {
    if (currentPath !== "/onboarding?blocked=age") {
      return { type: "redirect", to: "/onboarding?blocked=age" };
    }
    return { type: "allowed" };
  }

  // 온보딩 미완료
  if (!onboardingDone) {
    if (!currentPath.startsWith("/onboarding")) {
      return { type: "redirect", to: "/onboarding" };
    }
    return { type: "allowed" };
  }

  // 이미 인증 완료된 사용자가 /login 접근 시 /home으로
  if (currentPath === "/login" || currentPath === "/") {
    return { type: "redirect", to: "/home" };
  }

  return { type: "allowed" };
}

// ---------------------------------------------------------------------------
// 연령 차단 메시지
// ---------------------------------------------------------------------------

export const AGE_BLOCK_MESSAGE = "만 16세 이상부터 이용 가능합니다." as const;
