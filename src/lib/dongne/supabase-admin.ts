// 동네고수 — 서버 전용 Supabase 관리자 클라이언트 (service_role, RLS 우회).
// 절대 클라이언트 번들에 포함되면 안 된다 — API route 등 서버에서만 import할 것.
//
// 패턴 출처: src/lib/pae/supabase-admin.ts (오후의 패, 레포에 이미 wired된 유일 영속 저장소).
// 방향서 §2 "v1 shared-file 변경 0건 — Supabase ping은 기존 env·기존 dep 재사용" 준수를 위해
// pae의 파일을 import하지 않고(격리) 동일 패턴만 복제한다. 신규 env·신규 의존성 0.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let admin: SupabaseClient | null = null;

/**
 * service_role 클라이언트. dongne_dau 테이블 변이는 전부 이걸 통해서만 일어난다.
 * env 미설정(로컬 등) 시 null — 호출부는 이를 "DAU 게이트 미설정" 신호로 취급하고
 * 절대 게임 진행을 막지 않는다(non-blocking 원칙, 방향서 §3 백엔드 산출물).
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (admin) return admin;
  if (!url || !serviceKey) return null;
  admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
