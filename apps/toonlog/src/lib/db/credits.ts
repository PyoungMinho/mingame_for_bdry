/**
 * credits_ledger 쿼리 헬퍼
 * 크레딧 원장 원칙:
 *   - 불변 레코드 (update/delete 없음)
 *   - 잔액 = credits_balance 뷰의 SUM(delta)
 *   - balance_after 컬럼: 삽입 시점 스냅샷 (감사 추적용)
 *   - 모든 쓰기는 service role (클라이언트 직접 쓰기 차단)
 */

import { supabaseServer } from "./client";
import type { CreditsLedgerRow } from "./types";

// ──────────────────────────────────────────
// 내부 헬퍼
// ──────────────────────────────────────────

async function _insertLedger(
  userId: string,
  delta: number,
  reason: string
): Promise<number> {
  const db = supabaseServer();

  // 현재 잔액 조회
  const current = await getCredits(userId);
  const balanceAfter = current + delta;

  if (balanceAfter < 0) {
    throw new Error(`credits_ledger: insufficient credits (current=${current}, delta=${delta})`);
  }

  const { error } = await db.from("credits_ledger").insert({
    user_id: userId,
    delta,
    reason,
    balance_after: balanceAfter,
  });

  if (error) throw new Error(`credits_ledger insert failed: ${error.message}`);
  return balanceAfter;
}

// ──────────────────────────────────────────
// 공개 API
// ──────────────────────────────────────────

/**
 * 현재 크레딧 잔액 조회.
 * credits_balance 뷰(SUM 집계) 사용.
 */
export async function getCredits(userId: string): Promise<number> {
  const db = supabaseServer();
  const { data, error } = await db
    .from("credits_balance")
    .select("balance")
    .eq("user_id", userId)
    .single();

  if (error || !data) return 0;
  return (data as { balance: number }).balance ?? 0;
}

/**
 * 크레딧 차감. n 컷 생성 비용.
 * 잔액 부족 시 Error 던짐 → API 레이어에서 QUOTA_EXCEEDED 로 변환.
 */
export async function consumeCredits(userId: string, n: number): Promise<number> {
  return _insertLedger(userId, -n, "consume");
}

/**
 * 크레딧 추가. 팩 구매 / 관리자 지급.
 */
export async function addCredits(
  userId: string,
  n: number,
  reason: "purchase" | "refund" | "admin_adjust"
): Promise<number> {
  return _insertLedger(userId, +n, reason);
}

/**
 * 최근 N개 원장 조회 (마이페이지 내역 표시용).
 */
export async function listCreditHistory(
  userId: string,
  limit = 20
): Promise<CreditsLedgerRow[]> {
  const db = supabaseServer();
  const { data, error } = await db
    .from("credits_ledger")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listCreditHistory failed: ${error.message}`);
  return (data ?? []) as CreditsLedgerRow[];
}
