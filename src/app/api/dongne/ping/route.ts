// POST /api/dongne/ping — 오늘(KST) 순 방문자(anon_id) 1행 기록.
//
// DAU 게이트(방향서 §2·§5-1 · 기획서 §5-1)의 유일한 쓰기 경로.
// 요청 바디: { "anonId": "<클라 localStorage 무작위 UUID>" } (키 anon_id 도 허용).
// 서버는 anon_id만 저장한다 — IP·User-Agent·쿠키·계정은 읽지도 저장하지도 않는다(개인정보 미저장).
//   anon_id 는 특정 개인을 식별할 수 없는 익명 난수 토큰(스키마 주석 참고). 이걸로 "순 방문자 수"만 센다.
// 절대 규칙(non-blocking): 이 라우트는 게임을 막지 않는다. Supabase 미설정·테이블 미배포·바디 누락·
//   네트워크 에러 등 어떤 실패 경로에서도 500을 던지지 않고 조용히 204를 반환한다.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/dongne/supabase-admin';
import { getDateForGame, getTodayGameNo } from '@/lib/dongne/queue';

const NO_CONTENT = () => new NextResponse(null, { status: 204 });

// anon_id 형식 가드: 8~64자 [A-Za-z0-9_-] (crypto.randomUUID()=36자를 포용, 쓰레기값 차단).
const ANON_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * 같은 anon_id의 초단기 재전송(더블파이어·리마운트 등)에 대한 최소 방어.
 * IP가 아니라 클라가 이미 보낸 anon_id로만 키를 잡는다 → 서버가 IP를 만질 일이 아예 없다.
 * DB PK(day_kst, anon_id)가 최종 dedup을 보장하므로 이건 불필요한 DB 왕복만 아끼는 베스트에포트다.
 * 한계(의도적 감수): 서버리스 인스턴스별 독립 메모리라 콜드스타트/스케일아웃 시 리셋된다(정합성은 DB PK가 담보).
 */
const DEDUP_WINDOW_MS = 60_000;
const MAX_TRACKED = 10_000;
const lastSeen = new Map<string, number>();

function seenRecently(anonId: string, now: number): boolean {
  const last = lastSeen.get(anonId);
  if (last !== undefined && now - last < DEDUP_WINDOW_MS) return true;
  lastSeen.set(anonId, now);
  if (lastSeen.size > MAX_TRACKED) {
    const cutoff = now - DEDUP_WINDOW_MS;
    for (const [k, t] of lastSeen) {
      if (t < cutoff) lastSeen.delete(k);
    }
  }
  return false;
}

async function readAnonId(req: NextRequest): Promise<string | null> {
  try {
    const body = (await req.json()) as unknown;
    if (!body || typeof body !== 'object') return null;
    const raw = (body as Record<string, unknown>).anonId ?? (body as Record<string, unknown>).anon_id;
    if (typeof raw !== 'string' || !ANON_ID_RE.test(raw)) return null;
    return raw;
  } catch {
    return null; // 바디 없음/비-JSON — 조용히 스킵(게임 무관)
  }
}

export async function POST(req: NextRequest) {
  try {
    const anonId = await readAnonId(req);
    if (!anonId) return NO_CONTENT(); // 유효한 anon_id 없음 → 카운트 스킵, 여전히 204

    if (seenRecently(anonId, Date.now())) return NO_CONTENT(); // 초단기 재전송 — DB PK가 어차피 dedup

    const admin = getSupabaseAdmin();
    if (!admin) return NO_CONTENT(); // env 미설정(로컬 등) — 게이트 미가동일 뿐, 게임엔 영향 없음

    // queue.ts 단일 소스 재사용 — KST 고정 UTC+9 산술(서버 스탬프, toLocaleString 미사용).
    // getDateForGame∘getTodayGameNo 는 EPOCH가 상쇄되어 "오늘의 실제 KST 날짜"를 돌려준다(게임·아카이브·OG와 동일 경계).
    const dayKst = getDateForGame(getTodayGameNo());

    // insert ... on conflict (day_kst, anon_id) do nothing — 하루 1인 1행. 중복은 에러 없이 무시.
    const { error } = await admin
      .from('dongne_dau')
      .upsert({ day_kst: dayKst, anon_id: anonId }, {
        onConflict: 'day_kst,anon_id',
        ignoreDuplicates: true,
      });
    if (error) {
      // 테이블 미배포(PM이 dongne-schema.sql 미실행)이거나 일시 오류. 로그만 남기고 204 유지.
      console.error('[dongne/ping] upsert failed (non-blocking):', error.message);
    }

    return NO_CONTENT();
  } catch (err) {
    console.error('[dongne/ping] unexpected error (non-blocking):', err);
    return NO_CONTENT();
  }
}
