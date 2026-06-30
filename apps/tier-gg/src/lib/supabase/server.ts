/**
 * Supabase 서버 클라이언트 (service role key 사용)
 * Server Components, Route Handlers, 관리자 API 전용
 * !! 절대 브라우저에 노출하지 말 것 !!
 *
 * USE_MOCK_DATA=true 또는 키 누락 시 — isMockMode()가 true.
 * Repository는 isMockMode() 분기 후에만 supabaseAdmin을 사용해야 함.
 * (mock 모드에서는 supabaseAdmin 호출 시 더미 client가 반환되며 실 호출 시 에러)
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** mock 모드 판정: 명시적 플래그 OR Supabase 키 누락 */
export function isMockMode(): boolean {
  if (process.env.USE_MOCK_DATA === "true") return true;
  if (!supabaseUrl || !serviceRoleKey) return true;
  return false;
}

/**
 * 어드민 권한 서버 클라이언트 — RLS 우회 가능
 * Route Handler나 RSC에서만 호출할 것.
 * 키 누락 시에도 빌드/import는 통과하도록 dummy URL/key로 생성.
 * 실제 호출은 isMockMode() 가드 뒤에서만 수행해야 함.
 */
export const supabaseAdmin: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl || "https://mock.invalid.supabase.co",
  serviceRoleKey || "mock-service-role-key",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/**
 * 요청별 JWT 검증용 클라이언트
 * 관리자 API에서 Authorization 헤더의 JWT를 검증할 때 사용
 */
export function createServerClientWithToken(accessToken: string) {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server env vars");
  }
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
