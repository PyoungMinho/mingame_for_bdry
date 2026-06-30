/**
 * Pro Paywall 게이트 (Q5=B: 가입 후 3일 무료 후 코치챗 게이트)
 */

import type { AuthUser } from "./auth";
import { Errors } from "./errors";

// ---------------------------------------------------------------------------
// 코치챗 접근 권한 검사
// ---------------------------------------------------------------------------

/**
 * 코치챗 접근 가능 여부 검사.
 * - Pro 구독자: 항상 허용
 * - 3일 무료 체험 중: 허용
 * - 무료 체험 만료 + 비구독: E_PAYWALL_REQUIRED throw
 */
export function assertCoachChatAccess(user: AuthUser): void {
  // Pro 구독자는 항상 통과
  if (user.subscriptionTier === "pro") return;

  // 3일 무료 체험 기간 내
  if (user.coachFreeUntil && new Date() < user.coachFreeUntil) return;

  // 무료 체험 만료 여부 판단
  const reason = user.coachFreeUntil
    ? "free_trial_ended"
    : "not_subscribed";

  throw Errors.paywallRequired(reason);
}

// ---------------------------------------------------------------------------
// 무료 체험 만료 시각 계산 (온보딩 시 설정)
// ---------------------------------------------------------------------------

/**
 * 가입일로부터 3일 후 자정 (KST) 계산.
 * users 테이블 coach_free_until 컬럼에 저장.
 */
export function calcCoachFreeUntil(joinedAt: Date): Date {
  const freeUntil = new Date(joinedAt.getTime() + 3 * 24 * 60 * 60 * 1000);
  // KST 자정으로 반올림
  freeUntil.setHours(23, 59, 59, 999);
  return freeUntil;
}

// ---------------------------------------------------------------------------
// 남은 무료 시간 계산 (프론트 카운터 UI용)
// ---------------------------------------------------------------------------

export interface FreeTrialStatus {
  isActive: boolean;
  hoursRemaining: number;
  expiresAt: Date | null;
}

export function getFreeTrialStatus(coachFreeUntil: Date | null): FreeTrialStatus {
  if (!coachFreeUntil) {
    return { isActive: false, hoursRemaining: 0, expiresAt: null };
  }

  const now = new Date();
  if (now >= coachFreeUntil) {
    return { isActive: false, hoursRemaining: 0, expiresAt: coachFreeUntil };
  }

  const msRemaining = coachFreeUntil.getTime() - now.getTime();
  const hoursRemaining = Math.ceil(msRemaining / (1000 * 60 * 60));

  return { isActive: true, hoursRemaining, expiresAt: coachFreeUntil };
}

// ---------------------------------------------------------------------------
// 기능별 권한 매핑
// ---------------------------------------------------------------------------

type FeatureKey =
  | "coach_chat_unlimited"  // 무제한 코치챗
  | "score_history_90d"     // 90일 그래프
  | "goal_milestones"       // 90일 목표 + AI 마일스톤 분해
  | "export_report";        // 회고 내보내기

const PRO_ONLY_FEATURES: ReadonlySet<FeatureKey> = new Set([
  "coach_chat_unlimited",
  "score_history_90d",
  "goal_milestones",
  "export_report",
]);

export function assertFeatureAccess(user: AuthUser, feature: FeatureKey): void {
  if (!PRO_ONLY_FEATURES.has(feature)) return; // 무료 기능

  if (user.subscriptionTier === "pro") return;

  throw Errors.paywallRequired("not_subscribed");
}
