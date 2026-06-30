// REDLINE: 타인 비교/외모 점수 UI 금지
// Pro Paywall 게이트 — Q5=B: 3일 무료 체험 후 코치챗 게이트
import { daysSince } from "@/lib/utils";
import type { AuthUser } from "@/lib/store/auth";

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

export type GateResult =
  | { access: "allowed"; reason: "pro_subscriber" | "free_trial_active" }
  | { access: "blocked"; reason: "free_trial_ended" | "not_subscribed"; redirectTo: "/paywall" };

// ---------------------------------------------------------------------------
// 코치챗 접근 게이트 (Q5=B 반영)
// 가입 후 3일간 무료 → D+3 이후 Pro 구독자만 접근 가능
// ---------------------------------------------------------------------------

/**
 * 코치챗 진입 시 호출.
 * 결과가 "blocked"이면 /paywall 으로 리다이렉트.
 */
export function checkCoachAccess(user: AuthUser | null): GateResult {
  if (!user) {
    return { access: "blocked", reason: "not_subscribed", redirectTo: "/paywall" };
  }

  // Pro 구독자는 무조건 통과
  if (user.subscription.tier === "pro") {
    return { access: "allowed", reason: "pro_subscriber" };
  }

  // 서버가 계산한 무료 체험 활성 여부 우선 사용
  if (user.subscription.isCoachFreeActive) {
    return { access: "allowed", reason: "free_trial_active" };
  }

  // coachFreeUntil이 있고 아직 만료되지 않은 경우 (클라이언트 보조 체크)
  if (user.subscription.coachFreeUntil) {
    const freeUntil = new Date(user.subscription.coachFreeUntil);
    if (freeUntil > new Date()) {
      return { access: "allowed", reason: "free_trial_active" };
    }
    return { access: "blocked", reason: "free_trial_ended", redirectTo: "/paywall" };
  }

  // coachFreeUntil 없음 — 가입 후 3일 직접 계산 (폴백)
  const signupDays = daysSince(user.createdAt);
  if (signupDays <= 3) {
    return { access: "allowed", reason: "free_trial_active" };
  }

  return { access: "blocked", reason: "free_trial_ended", redirectTo: "/paywall" };
}

// ---------------------------------------------------------------------------
// 남은 무료 체험 일수 계산 (UI 카운터용)
// ---------------------------------------------------------------------------

export function getFreeTrialDaysLeft(user: AuthUser | null): number {
  if (!user) return 0;
  if (user.subscription.tier === "pro") return 0;

  if (user.subscription.coachFreeUntil) {
    const freeUntil = new Date(user.subscription.coachFreeUntil);
    const msLeft = freeUntil.getTime() - Date.now();
    return Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
  }

  const elapsed = daysSince(user.createdAt);
  return Math.max(0, 3 - elapsed);
}

// ---------------------------------------------------------------------------
// 페이월 메시지
// ---------------------------------------------------------------------------

export const PAYWALL_MESSAGES = {
  free_trial_ended: "3일 무료 체험이 종료되었습니다. Pro 구독 후 코치와 대화해보세요.",
  not_subscribed: "코치챗은 Pro 기능입니다. 7일 무료로 시작해보세요.",
} as const;
