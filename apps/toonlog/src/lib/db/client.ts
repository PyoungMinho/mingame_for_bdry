/**
 * Supabase 클라이언트 팩토리
 * - supabaseServer(): service role — 서버 컴포넌트 / Route Handler / Server Action 전용
 * - supabaseBrowser(): anon key — 클라이언트 컴포넌트 전용 (RLS 적용)
 *
 * 환경변수 미설정 시 in-memory mock 폴백 (개발 편의).
 * 실제 운영에서는 .env.local 에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY 필수.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// ──────────────────────────────────────────
// 환경변수
// ──────────────────────────────────────────
const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "";

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

// ──────────────────────────────────────────
// in-memory mock 폴백 (환경변수 미설정 시)
// ──────────────────────────────────────────
function isMockMode(): boolean {
  return !SUPABASE_URL || SUPABASE_URL === "";
}

/** 개발용 mock 클라이언트 — 쿼리는 항상 빈 data 반환 */
function createMockClient(): SupabaseClient<Database> {
  const noop = () => Promise.resolve({ data: null, error: null });
  const builder: Record<string, unknown> = {};
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      if (typeof prop === "string") {
        if (prop === "then") return undefined; // thenable 방지
        return () => new Proxy(builder, handler);
      }
      return undefined;
    },
    apply() {
      return new Proxy(builder, handler);
    },
  };
  const proxy = new Proxy({} as SupabaseClient<Database>, {
    get(_t, prop) {
      if (prop === "auth") return { getUser: noop, signOut: noop };
      return () => new Proxy(builder, handler);
    },
  });
  return proxy;
}

// ──────────────────────────────────────────
// 서버 클라이언트 — 싱글톤 (서버사이드)
// ──────────────────────────────────────────
let _serverClient: SupabaseClient<Database> | null = null;

/**
 * Service Role 클라이언트. RLS bypass.
 * Next.js App Router 서버 컴포넌트 / Route Handler / Server Action 에서 사용.
 * 클라이언트 컴포넌트에서 호출 절대 금지.
 */
export function supabaseServer(): SupabaseClient<Database> {
  if (isMockMode()) {
    console.warn("[toonlog] SUPABASE_URL not set — using in-memory mock client");
    return createMockClient();
  }
  if (!_serverClient) {
    _serverClient = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _serverClient;
}

// ──────────────────────────────────────────
// 브라우저 클라이언트 — 싱글톤 (클라이언트사이드)
// ──────────────────────────────────────────
let _browserClient: SupabaseClient<Database> | null = null;

/**
 * Anon Key 클라이언트. RLS 적용.
 * 클라이언트 컴포넌트에서만 사용 (use client 파일).
 */
export function supabaseBrowser(): SupabaseClient<Database> {
  if (isMockMode()) {
    return createMockClient();
  }
  if (!_browserClient) {
    _browserClient = createClient<Database>(SUPABASE_URL, ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return _browserClient;
}
