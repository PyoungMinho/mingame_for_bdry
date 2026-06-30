// 오후의 패 — 서버 전용 Supabase 관리자 클라이언트 (service_role, RLS 우회).
// 절대 클라이언트 번들에 포함되면 안 된다 — API route 등 서버에서만 import할 것.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let admin: SupabaseClient | null = null;

/** service_role 클라이언트. 게임 상태 변이는 전부 이걸 통해서만 일어난다. */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (admin) return admin;
  if (!url || !serviceKey) return null;
  admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
