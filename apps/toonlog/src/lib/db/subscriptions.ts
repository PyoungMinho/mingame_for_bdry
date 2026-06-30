/**
 * subscriptions 쿼리 헬퍼
 * Toss Payments 빌링키 기반 정기 결제 연동.
 * 빌링키는 서버사이드 보관 — 클라이언트 컴포넌트에 노출 금지.
 */

import type { Tier } from "../contract";
import { supabaseServer } from "./client";
import type { SubscriptionRow } from "./types";

export interface SubscriptionInput {
  userId: string;
  tier: "basic" | "pro";
  period: "monthly" | "yearly";
  tossBillingKey?: string;
  startsAt?: string;
  expiresAt?: string;
}

// ──────────────────────────────────────────
// 공개 API
// ──────────────────────────────────────────

/**
 * 활성 구독 조회. 없으면 null.
 */
export async function getSubscription(
  userId: string
): Promise<SubscriptionRow | null> {
  const db = supabaseServer();
  const { data, error } = await db
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as SubscriptionRow;
}

/**
 * 구독 생성 또는 갱신 (upsert).
 * 결제 서버 webhook에서 호출.
 * 구독 변경 시 기존 active 구독은 cancelled 처리 후 새 행 삽입.
 */
export async function upsertSubscription(
  input: SubscriptionInput
): Promise<SubscriptionRow> {
  const db = supabaseServer();

  // 기존 active 구독 cancel
  await db
    .from("subscriptions")
    .update({ status: "cancelled" })
    .eq("user_id", input.userId)
    .eq("status", "active");

  const { data, error } = await db
    .from("subscriptions")
    .insert({
      user_id: input.userId,
      tier: input.tier,
      period: input.period,
      toss_billing_key: input.tossBillingKey ?? null,
      status: "active",
      started_at: input.startsAt ?? new Date().toISOString(),
      expires_at: input.expiresAt ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`upsertSubscription failed: ${error?.message ?? "unknown"}`);
  }

  // profiles.tier 동기화
  await db
    .from("profiles")
    .update({ tier: input.tier as Tier })
    .eq("id", input.userId);

  return data as SubscriptionRow;
}

/**
 * 구독 해지 (soft cancel). expires_at 까지는 서비스 유지.
 */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  const db = supabaseServer();
  const { error } = await db
    .from("subscriptions")
    .update({ status: "cancelled" })
    .eq("id", subscriptionId);

  if (error) throw new Error(`cancelSubscription failed: ${error.message}`);
}

/**
 * 구독 만료 처리 (스케줄러 배치에서 호출).
 * expires_at 이 지난 active 구독을 expired 로 변경하고 profiles.tier = 'free' 로 다운그레이드.
 */
export async function expireSubscriptions(): Promise<number> {
  const db = supabaseServer();
  const now = new Date().toISOString();

  const { data: expiredSubs, error: fetchErr } = await db
    .from("subscriptions")
    .select("id, user_id")
    .eq("status", "active")
    .lt("expires_at", now);

  if (fetchErr || !expiredSubs || expiredSubs.length === 0) return 0;

  const ids = (expiredSubs as Pick<SubscriptionRow, "id" | "user_id">[]).map((s) => s.id);
  const userIds = (expiredSubs as Pick<SubscriptionRow, "id" | "user_id">[]).map((s) => s.user_id);

  await db.from("subscriptions").update({ status: "expired" }).in("id", ids);
  await db.from("profiles").update({ tier: "free" }).in("id", userIds);

  return ids.length;
}
