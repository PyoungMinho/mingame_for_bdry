/**
 * Paywall 게이트 — B-015~B-019 (Q5=B 3일 무료)
 */
import { describe, it, expect } from "vitest";
import {
  assertCoachChatAccess,
  calcCoachFreeUntil,
  getFreeTrialStatus,
  assertFeatureAccess,
} from "@/lib/server/paywall";
import { AppError } from "@/lib/server/errors";
import type { AuthUser } from "@/lib/server/auth";

function user(over: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u1",
    email: "u@test",
    isAgeBlocked: false,
    subscriptionTier: "free",
    coachFreeUntil: null,
    ...over,
  };
}

describe("paywall — assertCoachChatAccess (B-015~B-019)", () => {
  it("B-015: Pro 구독자는 항상 통과", () => {
    expect(() => assertCoachChatAccess(user({ subscriptionTier: "pro" }))).not.toThrow();
  });

  it("B-016: free + coachFreeUntil 미래 → 통과 (3일 무료 중)", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60);
    expect(() => assertCoachChatAccess(user({ coachFreeUntil: future }))).not.toThrow();
  });

  it("B-017: free + coachFreeUntil 과거 → E_PAYWALL_REQUIRED (free_trial_ended)", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60);
    try {
      assertCoachChatAccess(user({ coachFreeUntil: past }));
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("E_PAYWALL_REQUIRED");
      expect((e as AppError).details).toMatchObject({ reason: "free_trial_ended" });
    }
  });

  it("B-018: free + coachFreeUntil null → E_PAYWALL_REQUIRED (not_subscribed)", () => {
    try {
      assertCoachChatAccess(user());
      expect.fail("should throw");
    } catch (e) {
      expect((e as AppError).details).toMatchObject({ reason: "not_subscribed" });
    }
  });

  it("B-019: basic tier (Pro 아님) → 게이트 적용", () => {
    expect(() =>
      assertCoachChatAccess(user({ subscriptionTier: "basic" }))
    ).toThrow(AppError);
  });
});

describe("paywall — calcCoachFreeUntil + getFreeTrialStatus", () => {
  it("calcCoachFreeUntil: 가입일 + 3일", () => {
    const joined = new Date("2026-05-14T00:00:00+09:00");
    const until = calcCoachFreeUntil(joined);
    const diffMs = until.getTime() - joined.getTime();
    expect(diffMs).toBeGreaterThanOrEqual(3 * 24 * 60 * 60 * 1000 - 1);
  });

  it("getFreeTrialStatus: null → inactive", () => {
    expect(getFreeTrialStatus(null).isActive).toBe(false);
  });

  it("getFreeTrialStatus: 미래 → active", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24);
    const s = getFreeTrialStatus(future);
    expect(s.isActive).toBe(true);
    expect(s.hoursRemaining).toBeGreaterThan(0);
  });

  it("getFreeTrialStatus: 과거 → expired", () => {
    const past = new Date(Date.now() - 1000);
    const s = getFreeTrialStatus(past);
    expect(s.isActive).toBe(false);
  });
});

describe("paywall — assertFeatureAccess", () => {
  it("Pro 전용 기능은 free 차단", () => {
    expect(() => assertFeatureAccess(user(), "score_history_90d")).toThrow(AppError);
  });
  it("Pro 구독자는 통과", () => {
    expect(() =>
      assertFeatureAccess(user({ subscriptionTier: "pro" }), "goal_milestones")
    ).not.toThrow();
  });
});
