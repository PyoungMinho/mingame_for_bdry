/**
 * /api/monthly-close/* 호출 (fetch). 네트워크 실패는 reject하지 않고 {ok:false, error:'NETWORK'}로 돌려준다.
 * 비밀키는 헤더 x-mc-key로만 보낸다(URL·본문 금지). 테스트 표시는 x-mc-test.
 */

import {
  MC_KEY_HEADER,
  MC_TEST_HEADER,
  type ActionBody,
  type ActionOk,
  type ActionPayload,
  type ApiErr,
  type CreateRoomBody,
  type CreateRoomOk,
  type FeedbackBody,
  type HealthOk,
  type JoinBody,
  type JoinOk,
  type SyncBody,
  type SyncOk,
} from '../protocol';
import { cryptoAvailable, getPlayerKey, isTestMode, newActionId, NoCryptoError } from './identity';

export const API_BASE = '/api/monthly-close';

export type NetErr = { readonly ok: false; readonly error: 'NETWORK'; readonly serverNow?: undefined; readonly view?: undefined; readonly reason?: undefined; readonly retryAfterMs?: undefined };
export type ApiOutcome<T> = (T & { readonly ok: true }) | ApiErr | NetErr;

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'content-type': 'application/json', [MC_KEY_HEADER]: getPlayerKey() };
  if (isTestMode()) h[MC_TEST_HEADER] = '1';
  return h;
}

/** 비밀키를 만들 수 없는 환경(crypto 없음) → 서버에 보내지 않고 E4(SERVICE_DOWN)로 */
function noCrypto(): ApiErr {
  return { ok: false, serverNow: Date.now(), error: 'SERVICE_DOWN' };
}

async function call<T>(path: string, init: { method: 'GET' | 'POST'; body?: unknown | (() => unknown); keepalive?: boolean; signal?: AbortSignal }): Promise<ApiOutcome<T>> {
  let h: Record<string, string>;
  let body: unknown;
  try {
    h = headers();
    body = typeof init.body === 'function' ? (init.body as () => unknown)() : init.body;
  } catch (e) {
    if (e instanceof NoCryptoError) return noCrypto();
    throw e;
  }
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: init.method,
      headers: h,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      keepalive: init.keepalive,
      signal: init.signal,
    });
    const json = (await res.json()) as unknown;
    if (json && typeof json === 'object' && 'ok' in json) return json as ApiOutcome<T>;
    return { ok: false, error: 'NETWORK' };
  } catch {
    return { ok: false, error: 'NETWORK' };
  }
}

/**
 * GET /health 는 봉투(ok·serverNow) 없이 `{db}`만 돌려준다(protocol HealthOk). call()은 'ok' 키가 없으면 NETWORK로
 * 보므로 여기서 따로 읽는다(D3: 이전에는 홈이 늘 "공유 서버 연결 불가"를 띄웠다).
 */
async function health(): Promise<HealthOk | NetErr> {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: 'GET', cache: 'no-store' });
    const json = (await res.json()) as unknown;
    if (json && typeof json === 'object' && 'db' in json) {
      const db = (json as { db: unknown }).db;
      if (db === 'ok' || db === 'down') return { db };
    }
    return { ok: false, error: 'NETWORK' };
  } catch {
    return { ok: false, error: 'NETWORK' };
  }
}

/** health 결과 → 홈 "공유 서버에 연결할 수 없습니다" 배너를 띄울지 */
export function healthIsDown(r: HealthOk | NetErr): boolean {
  return !('db' in r) || r.db !== 'ok';
}

export const mcApi = {
  health,
  createRoom: (body: CreateRoomBody) => call<CreateRoomOk>('/rooms', { method: 'POST', body }),
  join: (code: string, body: JoinBody) => call<JoinOk>(`/rooms/${code}/join`, { method: 'POST', body }),
  sync: (code: string, body: SyncBody, opts: { keepalive?: boolean; signal?: AbortSignal } = {}) =>
    call<SyncOk>(`/rooms/${code}/sync`, { method: 'POST', body, ...opts }),
  action: (code: string, payload: ActionPayload, actionId?: string) =>
    // actionId도 crypto로 만든다 → call 안에서 만들어 crypto 없음을 E4로 돌린다
    call<ActionOk>(`/rooms/${code}/action`, { method: 'POST', body: (): ActionBody => ({ actionId: actionId ?? newActionId(), ...payload }) }),
  /** 반환 본문 없음(204). 실패해도 무시한다 */
  feedback: async (body: FeedbackBody): Promise<void> => {
    try {
      if (!cryptoAvailable()) return;
      await fetch(`${API_BASE}/feedback`, { method: 'POST', headers: headers(), body: JSON.stringify(body), keepalive: true });
    } catch {
      /* 지표는 베스트 에포트 */
    }
  },
};
