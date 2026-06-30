import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * 브라우저(클라이언트 컴포넌트) 전용 Supabase 클라이언트.
 * React Query 훅, 클라이언트 뮤테이션에서 사용.
 * 서버 컴포넌트(RSC)/Route Handler에서는 server.ts 사용.
 */
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다."
    );
  }

  return createClient<Database>(url, anon);
}
