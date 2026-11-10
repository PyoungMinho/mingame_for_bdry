/**
 * 월마감 서버 DB 연결 — 서비스 키는 이 폴더(server/) 안에서만 읽는다(boundaries.test.ts ④).
 *
 * 저장소 선택 규칙 (getStore)
 *  1. NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY가 있으면 SupabaseStore.
 *  2. 없고 Vercel 밖(로컬·테스트)이면 MemoryStore(프로세스 안 싱글톤).
 *  3. 없고 Vercel 안이면 null → API는 SERVICE_DOWN(503). 몰래 메모리 저장소로 바꾸지 않는다.
 *  주의: 로컬에 운영 키를 넣으면 로컬이 운영 DB에 쓴다. 그 기록은 env='development'로 남아 게이트에서 제외된다.
 *
 * 새 환경변수 0개: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VERCEL_ENV만 읽는다.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { McEnv, RoomStore } from './store';
import { MemoryStore, isOnVercel } from './store-memory';
import { SupabaseStore } from './store-supabase';

/** 기록에 찍는 환경. VERCEL_ENV가 production/preview가 아니면(로컬 포함) development */
export function currentEnv(env: NodeJS.ProcessEnv = process.env): McEnv {
  const v = env.VERCEL_ENV;
  return v === 'production' || v === 'preview' ? v : 'development';
}

let admin: SupabaseClient | null = null;
let supabaseStore: SupabaseStore | null = null;

const MEMORY_KEY = Symbol.for('mc.memoryStore');
type GlobalWithStore = typeof globalThis & { [MEMORY_KEY]?: MemoryStore };

/** service_role 클라이언트. 키가 없으면 null */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

/** 로컬 dev는 라우트마다 모듈이 따로 로드될 수 있어 globalThis에 둔다 */
function memorySingleton(): MemoryStore {
  const g = globalThis as GlobalWithStore;
  g[MEMORY_KEY] ??= new MemoryStore();
  return g[MEMORY_KEY];
}

export function getStore(): RoomStore | null {
  const db = getSupabaseAdmin();
  if (db) {
    supabaseStore ??= new SupabaseStore(db);
    return supabaseStore;
  }
  if (isOnVercel()) return null;
  return memorySingleton();
}

/** 테스트 전용: 캐시 초기화 */
export function resetDbForTests(): void {
  admin = null;
  supabaseStore = null;
  delete (globalThis as GlobalWithStore)[MEMORY_KEY];
}
