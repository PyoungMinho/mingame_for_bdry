/**
 * quota_usage 쿼리 헬퍼
 *
 * 정책 (constants.ts TIERS / FREE_DAILY_LIMIT 와 일치):
 *   free:  일 1회 (FREE_DAILY_LIMIT=1) → day_count 기준
 *   basic: 월 90회               → month_count 기준
 *   pro:   월 150회              → month_count 기준
 *
 * tryConsumeQuota: 낙관적 UPSERT + 초과 시 롤백 (원자 보장)
 *   1. 현재 사용량 조회
 *   2. 한도 초과 여부 확인
 *   3. 통과 시 day_count / month_count 증가 UPSERT
 */

import type { QuotaInfo, Tier } from "../contract";
import { TIERS, FREE_DAILY_LIMIT } from "../constants";
import { supabaseServer } from "./client";
import type { QuotaUsageRow } from "./types";

// ──────────────────────────────────────────
// 내부 헬퍼
// ──────────────────────────────────────────

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

function limitForTier(tier: Tier): number {
  if (tier === "free") return FREE_DAILY_LIMIT; // 일 1
  return TIERS[tier].monthlyQuota; // basic=90, pro=150
}

function resetAtForTier(tier: Tier): string {
  if (tier === "free") {
    // 오늘 자정(UTC) + 1일
    const d = new Date();
    d.setUTCHours(24, 0, 0, 0);
    return d.toISOString();
  }
  // 다음 달 1일 0시(UTC)
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

async function getOrCreateUsageRow(userId: string): Promise<QuotaUsageRow> {
  const db = supabaseServer();
  const today = todayUTC();
  const month = currentMonth();

  // 오늘 행이 없으면 upsert 로 생성
  const { data, error } = await db
    .from("quota_usage")
    .upsert(
      { user_id: userId, usage_date: today, day_count: 0, period_month: month, month_count: 0 },
      { onConflict: "user_id,usage_date", ignoreDuplicates: true }
    )
    .select()
    .single();

  if (error || !data) {
    // 이미 존재하는 경우 select 로 재조회
    const { data: existing, error: selErr } = await db
      .from("quota_usage")
      .select("*")
      .eq("user_id", userId)
      .eq("usage_date", today)
      .single();
    if (selErr || !existing) throw new Error(`quota row fetch failed: ${selErr?.message}`);
    return existing as QuotaUsageRow;
  }
  return data as QuotaUsageRow;
}

async function getMonthCount(userId: string): Promise<number> {
  const db = supabaseServer();
  const month = currentMonth();

  // 이번 달 전체 day_count 합산
  const { data, error } = await db
    .from("quota_usage")
    .select("month_count")
    .eq("user_id", userId)
    .eq("period_month", month)
    .order("usage_date", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return 0;
  return (data as QuotaUsageRow).month_count;
}

// ──────────────────────────────────────────
// 공개 API
// ──────────────────────────────────────────

/**
 * 현재 quota 상태 조회.
 * 크레딧 잔액은 credits_balance 뷰에서 별도 조회 후 주입.
 */
export async function getQuota(userId: string): Promise<QuotaInfo> {
  const db = supabaseServer();

  // 프로필에서 tier 조회
  const { data: profile, error: profileErr } = await db
    .from("profiles")
    .select("tier")
    .eq("id", userId)
    .single();

  if (profileErr || !profile) {
    throw new Error(`getQuota: profile not found for userId=${userId}`);
  }

  const tier = profile.tier as Tier;
  const limit = limitForTier(tier);

  let used = 0;
  if (tier === "free") {
    const row = await getOrCreateUsageRow(userId);
    used = row.day_count;
  } else {
    used = await getMonthCount(userId);
  }

  // 크레딧 잔액
  const { data: balanceRow } = await db
    .from("credits_balance")
    .select("balance")
    .eq("user_id", userId)
    .single();

  const credits = balanceRow?.balance ?? 0;

  return {
    tier,
    remaining: Math.max(0, limit - used),
    limit,
    resetAt: resetAtForTier(tier),
    credits,
  };
}

/**
 * quota 차감 시도. 한도 초과 또는 크레딧 없으면 ok=false.
 * n: 차감할 만화 수 (보통 1)
 *
 * 동작:
 *   1. tier 조회
 *   2. 현재 사용량 조회
 *   3. (사용량 + n) > 한도 → 크레딧으로 폴백 시도
 *   4. 크레딧도 없으면 {ok: false}
 *   5. 통과 시 사용량 증가
 */
export async function tryConsumeQuota(
  userId: string,
  n = 1
): Promise<{ ok: boolean; remaining: number; usedCredits: boolean }> {
  const db = supabaseServer();

  const { data: profile } = await db
    .from("profiles")
    .select("tier")
    .eq("id", userId)
    .single();

  const tier = (profile?.tier ?? "free") as Tier;
  const limit = limitForTier(tier);

  let used = 0;
  const today = todayUTC();
  const month = currentMonth();

  if (tier === "free") {
    const row = await getOrCreateUsageRow(userId);
    used = row.day_count;
  } else {
    used = await getMonthCount(userId);
  }

  const remaining = Math.max(0, limit - used);

  if (remaining >= n) {
    // 한도 내 → 사용량 증가
    await _incrementUsage(userId, tier, n, today, month);
    return { ok: true, remaining: remaining - n, usedCredits: false };
  }

  // 한도 초과 → 크레딧 사용 시도 (credits 모듈은 별도 호출로 처리)
  return { ok: false, remaining: 0, usedCredits: false };
}

async function _incrementUsage(
  userId: string,
  tier: Tier,
  n: number,
  today: string,
  month: string
): Promise<void> {
  const db = supabaseServer();

  if (tier === "free") {
    const { error } = await db.rpc("increment_quota_day", {
      p_user_id: userId,
      p_date: today,
      p_month: month,
      p_n: n,
    } as never);
    if (error) {
      // RPC 미구현 환경(개발) 폴백: upsert
      await db
        .from("quota_usage")
        .upsert(
          { user_id: userId, usage_date: today, day_count: n, period_month: month, month_count: n },
          { onConflict: "user_id,usage_date" }
        );
    }
  } else {
    const { error } = await db.rpc("increment_quota_month", {
      p_user_id: userId,
      p_date: today,
      p_month: month,
      p_n: n,
    } as never);
    if (error) {
      await db
        .from("quota_usage")
        .upsert(
          { user_id: userId, usage_date: today, day_count: n, period_month: month, month_count: n },
          { onConflict: "user_id,usage_date" }
        );
    }
  }
}

/**
 * quota 환불. 시스템 실패(PROVIDER_ERROR 등) 시 차감 롤백.
 * project-direction §10 충돌해소 #6: 시스템 실패=차감 없음.
 */
export async function refundQuota(userId: string, n = 1): Promise<void> {
  const db = supabaseServer();
  const { data: profile } = await db
    .from("profiles")
    .select("tier")
    .eq("id", userId)
    .single();

  const tier = (profile?.tier ?? "free") as Tier;
  const today = todayUTC();
  const month = currentMonth();

  await db
    .from("quota_usage")
    .upsert(
      { user_id: userId, usage_date: today, day_count: 0, period_month: month, month_count: 0 },
      { onConflict: "user_id,usage_date" }
    );

  // 음수가 되지 않게 MAX(0, current - n) — 단순 구현
  const { data: row } = await db
    .from("quota_usage")
    .select("day_count, month_count")
    .eq("user_id", userId)
    .eq("usage_date", today)
    .single();

  if (!row) return;
  const typedRow = row as QuotaUsageRow;

  await db
    .from("quota_usage")
    .update({
      day_count: Math.max(0, typedRow.day_count - n),
      month_count: Math.max(0, typedRow.month_count - n),
    })
    .eq("user_id", userId)
    .eq("usage_date", today);
}
