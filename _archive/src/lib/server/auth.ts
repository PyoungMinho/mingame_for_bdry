/**
 * Supabase JWT 검증 + user_id 추출
 * RLS 보장: 모든 DB 호출 전 반드시 이 함수를 통과
 */

import { createClient } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { Errors } from "./errors";

// ---------------------------------------------------------------------------
// Supabase 클라이언트 (서버 전용 — Service Role)
// ---------------------------------------------------------------------------

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// 인증된 유저 정보 타입
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
  /** 만16세 미만 차단 플래그 — DB users 테이블에서 조회 */
  isAgeBlocked: boolean;
  /** 구독 티어 */
  subscriptionTier: "free" | "basic" | "pro";
  /** 코치챗 3일 무료 만료 시각 */
  coachFreeUntil: Date | null;
}

// ---------------------------------------------------------------------------
// JWT 검증 + 유저 정보 조회
// ---------------------------------------------------------------------------

/**
 * Authorization: Bearer <supabase_jwt> 헤더를 검증하고 AuthUser를 반환.
 * 유효하지 않으면 AppError(E_AUTH_REQUIRED) throw.
 */
export async function requireAuth(req: NextRequest): Promise<AuthUser> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw Errors.authRequired();
  }

  const token = authHeader.slice(7);
  const supabase = getSupabaseAdmin();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw Errors.authRequired();
  }

  // TODO(DB): users 테이블에서 is_age_blocked, subscription_tier, coach_free_until 조회
  // const { data: profile } = await supabase
  //   .from("users")
  //   .select("is_age_blocked, subscription_tier, coach_free_until")
  //   .eq("id", user.id)
  //   .single();

  const profile = {
    is_age_blocked: false,
    subscription_tier: "free" as const,
    coach_free_until: null as string | null,
  };

  return {
    id: user.id,
    email: user.email ?? "",
    isAgeBlocked: profile.is_age_blocked,
    subscriptionTier: profile.subscription_tier,
    coachFreeUntil: profile.coach_free_until ? new Date(profile.coach_free_until) : null,
  };
}

/**
 * 만16세 미만 차단 검증.
 * requireAuth 이후 호출. isAgeBlocked=true이면 E_AGE_BLOCKED throw.
 */
export function assertNotAgeBlocked(user: AuthUser): void {
  if (user.isAgeBlocked) {
    throw Errors.ageBlocked(0); // 정확한 age는 users 테이블에서 계산
  }
}

/**
 * Service Role로 특정 user_id의 age_blocked 상태 강제 업데이트 (온보딩 시 호출)
 */
export async function setAgeBlockedFlag(userId: string, blocked: boolean): Promise<void> {
  const supabase = getSupabaseAdmin();
  // TODO(DB): users 테이블 is_age_blocked 컬럼 업데이트
  // await supabase.from("users").update({ is_age_blocked: blocked }).eq("id", userId);
  void supabase;
  void userId;
  void blocked;
}
