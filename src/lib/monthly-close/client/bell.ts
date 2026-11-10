/**
 * Supabase Realtime Broadcast 초인종 구독 (브라우저). 내용은 {v}뿐이다 — 숨긴 정보는 오지 않는다.
 * supabase-js는 처음 쓸 때 동적 import한다(홈·연습 번들에 싣지 않음). 키가 없거나 연결이 안 되면 onStatus(false) → 폴링.
 */

import { BELL_EVENT, type BellPayload } from '../protocol';

const URL_ENV = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY_ENV = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function subscribeBell(topic: string, onVersion: (v: number) => void, onStatus: (ok: boolean) => void): () => void {
  if (!URL_ENV || !KEY_ENV) {
    onStatus(false);
    return () => undefined;
  }
  let cancelled = false;
  let cleanup: (() => void) | null = null;
  const failTimer = setTimeout(() => {
    if (!cancelled) onStatus(false);
  }, 4000);

  void import('@supabase/supabase-js')
    .then(({ createClient }) => {
      if (cancelled) return;
      const sb = createClient(URL_ENV, KEY_ENV, { auth: { persistSession: false, autoRefreshToken: false } });
      const ch = sb
        .channel(topic, { config: { broadcast: { self: false } } })
        .on('broadcast', { event: BELL_EVENT }, ({ payload }: { payload: unknown }) => {
          const v = (payload as BellPayload | null)?.v;
          if (typeof v === 'number' && Number.isFinite(v)) onVersion(v);
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(failTimer);
            onStatus(true);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            onStatus(false);
          }
        });
      cleanup = () => {
        void sb.removeChannel(ch);
      };
    })
    .catch(() => onStatus(false));

  return () => {
    cancelled = true;
    clearTimeout(failTimer);
    cleanup?.();
  };
}
