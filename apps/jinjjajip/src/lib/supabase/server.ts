import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * 서버(RSC / Route Handler) 전용 Supabase 클라이언트.
 *
 * M0 단순화 주석:
 *   현재 service role 키(SUPABASE_SERVICE_ROLE_KEY)를 직접 사용해 RLS를 우회한다.
 *   이 방식은 서버 환경에서만 안전하며, 클라이언트 번들에 절대 포함되어선 안 된다.
 *   M1 이후 @supabase/ssr 의 createServerClient(cookies()) 패턴으로 교체 권장:
 *   → 각 요청의 Supabase 세션(쿠키)을 읽어 사용자 컨텍스트를 전달 가능.
 *   현재는 서버 행위자(service role)가 직접 필터링 책임을 진다.
 */
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다."
    );
  }

  return createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Route Handler에서 요청 사용자 ID를 가져오는 헬퍼.
 * Authorization: Bearer <access_token> 헤더에서 추출.
 * 인증 실패 시 null 반환 → 호출부에서 403 처리.
 */
export async function getRequestUserId(
  request: Request
): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) return null;

  const { createClient: _c } = await import("@supabase/supabase-js");
  const client = _c<Database>(url, anon);
  const { data } = await client.auth.getUser(token);
  return data.user?.id ?? null;
}
