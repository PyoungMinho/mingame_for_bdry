/**
 * Supabase 브라우저 클라이언트 (anon key 사용)
 * Client Components 및 브라우저 환경 전용
 *
 * 키 미설정 시(빌드/mock 모드)에는 throw 대신 null을 export.
 * 호출 측에서 null 체크 후 사용해야 함.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient<Database> | null =
  supabaseUrl && supabaseAnonKey
    ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;
