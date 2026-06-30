// 오후의 패 — 브라우저용 Supabase 클라이언트 (익명 인증 + Realtime 구독).
// 키가 없으면 null을 반환하므로, 호출부에서 봇 데모로 폴백할 수 있다.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/** 싱글턴 브라우저 클라이언트. 환경변수가 없으면 null. */
export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  if (!url || !anonKey) return null;
  client = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}

/** 실시간 멀티가 설정되어 있는지 (안 되어 있으면 봇 데모로 폴백). */
export const SUPABASE_READY = Boolean(url && anonKey);

/** 익명 로그인 보장 후 uid 반환. 무가입 신원 유지(RLS 기반). */
export async function ensureAnonUid(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: sessionData } = await sb.auth.getSession();
  if (sessionData.session?.user) return sessionData.session.user.id;
  const { data, error } = await sb.auth.signInAnonymously();
  if (error) return null;
  return data.user?.id ?? null;
}
