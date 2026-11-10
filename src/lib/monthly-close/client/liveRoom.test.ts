/**
 * LiveRoom(실전 방 클라) 단위 테스트 — 가짜 fetch·가짜 시계.
 * version 규칙, presence 덮어쓰기, 오류 코드 → entry 매핑, serverNow 보정, 기한 refresh, 초인종, 숨기기 보고, 액션 pending.
 * (실서버 HTTP 한 판은 docs/frontend/monthly-close-d3.md의 스크립트로 확인)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYNC_MS } from '../constants';
import type { ApiErr, PlacingView, PlayingView, RoomView, SyncOk } from '../protocol';
import { LiveRoom, type LiveRoomDeps } from './liveRoom';
import { mockEndedView, mockPlayingView } from './mockViews';

type Reply = { status?: number; body: unknown } | 'network';
interface Req {
  url: string;
  body: Record<string, unknown> | null;
  keepalive?: boolean;
  headers: Record<string, string>;
}

let replies: Map<string, Reply[]>;
let requests: Req[];
let serverOffset = 0;

const BASE_T = 1_760_000_000_000;

function route(url: string): string {
  if (url.endsWith('/sync')) return 'sync';
  if (url.endsWith('/action')) return 'action';
  if (url.endsWith('/join')) return 'join';
  if (url.endsWith('/feedback')) return 'feedback';
  return url;
}

function queue(kind: string, ...rs: Reply[]) {
  replies.set(kind, [...(replies.get(kind) ?? []), ...rs]);
}

const withVersion = <V extends RoomView>(v: V, version: number): V => ({ ...v, room: { ...v.room, version } });
const playing = (version: number, patch: Partial<PlayingView> = {}): PlayingView => ({ ...withVersion(mockPlayingView(0, BASE_T), version), ...patch });
const syncFull = (view: RoomView, presence: SyncOk['presence'] = null): SyncOk => ({ ok: true, serverNow: Date.now() + serverOffset, presence, changed: true, view });
const syncSame = (version: number, presence: SyncOk['presence'] = null): SyncOk => ({ ok: true, serverNow: Date.now() + serverOffset, presence, changed: false, version });
const apiErr = (error: ApiErr['error'], extra: Partial<ApiErr> = {}): ApiErr => ({ ok: false, serverNow: Date.now() + serverOffset, error, ...extra });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(BASE_T);
  replies = new Map();
  requests = [];
  serverOffset = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const kind = route(url);
      const body = typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null;
      requests.push({ url, body, keepalive: init.keepalive, headers: init.headers as Record<string, string> });
      const list = replies.get(kind) ?? [];
      const r = list.length > 1 ? list.shift()! : list[0];
      if (!r) return { status: 204, json: async () => null };
      if (r === 'network') throw new TypeError('fetch failed');
      const payload = JSON.parse(JSON.stringify(r.body)) as Record<string, unknown>;
      // 서버 시각은 응답 시점 값(같은 응답을 되풀이해도 시계가 흐른다)
      if (payload && typeof payload.serverNow === 'number') payload.serverNow = Date.now() + serverOffset;
      return { status: r.status ?? 200, json: async () => payload };
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** 마이크로태스크(가짜 fetch의 await 사슬)를 흘려보낸다 */
async function flush(n = 12) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}
const syncs = () => requests.filter((r) => r.url.endsWith('/sync'));
async function tick(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
  await flush();
}

function mk(opts: { view?: () => 'game' | 'disguise'; bell?: LiveRoomDeps['subscribeBell'] } = {}) {
  const room = new LiveRoom('48291', { getView: opts.view ?? (() => 'game'), isTabVisible: () => true, subscribeBell: opts.bell });
  return room;
}

describe('LiveRoom — version 규칙', () => {
  it('더 큰 version만 반영하고, 작은 version 응답은 무시한다', async () => {
    queue('sync', { body: syncFull(playing(5)) }, { body: syncFull(playing(4)) }, { body: syncFull(playing(7)) });
    const room = mk();
    room.start();
    await flush();
    expect(room.getState().view?.room.version).toBe(5);
    expect(room.getState().entry).toEqual({ kind: 'seated', seat: 0 });
    room.refresh();
    await flush();
    expect(room.getState().view?.room.version).toBe(5);
    room.refresh();
    await flush();
    expect(room.getState().view?.room.version).toBe(7);
    room.dispose();
  });

  it('같은 version 전체 응답은 view 객체를 바꾸지 않는다(불필요한 렌더 없음)', async () => {
    queue('sync', { body: syncFull(playing(5)) }, { body: syncFull(playing(5)) });
    const room = mk();
    room.start();
    await flush();
    const first = room.getState().view;
    const c1 = room.controller();
    room.refresh();
    await flush();
    expect(room.getState().view).toBe(first);
    expect(room.controller()).toBe(c1);
    room.dispose();
  });

  it('sync 본문에 knownVersion·view(숨김 여부)를 싣는다', async () => {
    let v: 'game' | 'disguise' = 'game';
    queue('sync', { body: syncFull(playing(5)) }, { body: syncSame(5) });
    const room = mk({ view: () => v });
    room.start();
    await flush();
    v = 'disguise';
    room.refresh();
    await flush();
    expect(syncs()[0]!.body).toEqual({ knownVersion: -1, view: 'game' });
    expect(syncs()[1]!.body).toEqual({ knownVersion: 5, view: 'disguise' });
    room.dispose();
  });
});

describe('LiveRoom — presence 덮어쓰기(규칙 7)', () => {
  it('changed:false 응답의 presence를 같은 version의 opp에 덮어쓴다', async () => {
    queue('sync', { body: syncFull(playing(5)) }, { body: syncSame(5, { oppLastSeenAt: BASE_T + 4321, oppHidden: true }) });
    const room = mk();
    room.start();
    await flush();
    const before = room.getState().view!;
    room.refresh();
    await flush();
    const after = room.getState().view!;
    expect(after).not.toBe(before);
    expect(after.room.version).toBe(5);
    expect(after.opp).toMatchObject({ lastSeenAt: BASE_T + 4321, hidden: true });
    room.dispose();
  });

  it('presence가 같으면 새 객체를 만들지 않고, 상대가 없으면(waiting) 무시한다', async () => {
    const p = playing(5);
    queue('sync', { body: syncFull(p) }, { body: syncSame(5, { oppLastSeenAt: p.opp.lastSeenAt, oppHidden: p.opp.hidden }) });
    const room = mk();
    room.start();
    await flush();
    const before = room.getState().view;
    room.refresh();
    await flush();
    expect(room.getState().view).toBe(before);
    room.dispose();
  });

  it('changed:true 응답에도 presence가 있으면 그 값이 이긴다', async () => {
    queue('sync', { body: syncFull(playing(5), { oppLastSeenAt: BASE_T + 99, oppHidden: true }) });
    const room = mk();
    room.start();
    await flush();
    expect(room.getState().view!.opp).toMatchObject({ lastSeenAt: BASE_T + 99, hidden: true });
    room.dispose();
  });
});

describe('LiveRoom — 오류 코드 → 화면(entry) 매핑(규칙 9)', () => {
  it.each([
    ['ROOM_NOT_FOUND', 404, 'notFound'],
    ['ROOM_FULL', 409, 'full'],
    ['NOT_JOINED', 403, 'needJoin'],
  ] as const)('%s → %s, 폴링을 멈춘다', async (code, status, kind) => {
    queue('sync', { status, body: apiErr(code) });
    const room = mk();
    room.start();
    await flush();
    expect(room.getState().entry.kind).toBe(kind);
    expect(room.getState().lastError?.code).toBe(code);
    const n = requests.length;
    await tick(30_000);
    expect(requests.length).toBe(n);
    room.dispose();
  });

  it.each(['SERVICE_DOWN', 'CAPACITY'] as const)('%s → down, 재시도는 계속한다', async (code) => {
    queue('sync', { status: 503, body: apiErr(code) });
    const room = mk();
    room.start();
    await flush();
    expect(room.getState().entry.kind).toBe('down');
    expect(room.getState().connection).toBe('down');
    const n = requests.length;
    await tick(SYNC_MS.idleNoBell + 10);
    expect(requests.length).toBeGreaterThan(n);
    room.dispose();
  });

  it('네트워크 실패: 2회 연속 → reconnecting(5초 간격 재시도), 8회 → down, 성공하면 live', async () => {
    queue('sync', { body: syncFull(playing(5)) }, 'network', 'network', 'network', 'network', 'network', 'network', 'network', 'network', { body: syncSame(5) });
    const room = mk();
    room.start();
    await flush();
    expect(room.getState().connection).toBe('live');
    room.refresh();
    await flush();
    expect(room.getState().connection).toBe('live'); // 1회는 아직
    await tick(5000);
    expect(room.getState().connection).toBe('reconnecting');
    expect(room.getState().entry.kind).toBe('seated'); // 화면은 그대로
    for (let i = 0; i < 6; i++) await tick(5000);
    expect(room.getState().connection).toBe('down');
    await tick(5000);
    expect(room.getState().connection).toBe('live');
    room.dispose();
  });

  it('액션 거부 응답의 view를 반영하고 lastError를 남긴다(자리 유지)', async () => {
    queue('sync', { body: syncFull(playing(5)) });
    queue('action', { status: 409, body: apiErr('NOT_YOUR_TURN', { view: playing(6) }) });
    const room = mk();
    room.start();
    await flush();
    const r = await room.fire('B2');
    expect(r).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });
    expect(room.getState().view?.room.version).toBe(6);
    expect(room.getState().entry.kind).toBe('seated');
    expect(room.getState().lastError?.code).toBe('NOT_YOUR_TURN');
    expect(room.getState().pending).toBe(false);
    room.dispose();
  });

  it('LOCKED·INVALID 사유가 ActionOutcome으로 그대로 온다', async () => {
    queue('sync', { body: syncFull(playing(5)) });
    queue('action', { status: 423, body: apiErr('LOCKED', { view: playing(5) }) }, { status: 400, body: apiErr('INVALID', { reason: 'already_fired', view: playing(5) }) });
    const room = mk();
    room.start();
    await flush();
    expect(await room.answer('q4-1', 3)).toEqual({ ok: false, error: 'LOCKED' });
    expect(await room.fire('B2')).toEqual({ ok: false, error: 'INVALID', reason: 'already_fired' });
    room.dispose();
  });

  it('액션 중 다른 액션은 보내지 않는다(pending)', async () => {
    queue('sync', { body: syncFull(playing(5)) });
    queue('action', { body: { ok: true, serverNow: BASE_T, duplicate: false, view: playing(6) } });
    const room = mk();
    room.start();
    await flush();
    const p1 = room.fire('B2');
    expect(room.getState().pending).toBe(true);
    expect(await room.fire('B3')).toEqual({ ok: false, error: 'WRONG_PHASE' });
    expect((await p1).ok).toBe(true);
    expect(room.getState().pending).toBe(false);
    expect(requests.filter((r) => r.url.endsWith('/action'))).toHaveLength(1);
    const body = requests.find((r) => r.url.endsWith('/action'))!.body!;
    expect(body).toMatchObject({ type: 'fire', cell: 'B2' });
    expect(String(body.actionId)).toMatch(/^[0-9a-f]{24}$/);
    room.dispose();
  });

  it('비밀키는 헤더로만 보낸다(본문·URL 없음)', async () => {
    queue('sync', { body: syncFull(playing(5)) });
    const room = mk();
    room.start();
    await flush();
    const r = syncs()[0]!;
    expect(r.headers['x-mc-key']).toMatch(/^[0-9a-f]{32}$/);
    expect(r.url).not.toContain(r.headers['x-mc-key']!);
    expect(JSON.stringify(r.body)).not.toContain(r.headers['x-mc-key']!);
    room.dispose();
  });

  it('needJoin → join 성공하면 seated로 바뀌고 폴링을 다시 시작한다', async () => {
    const placing: PlacingView = { ...(withVersion(mockPlayingView(1, BASE_T), 3) as unknown as PlacingView), status: 'placing', placeDeadlineAt: BASE_T + 90_000 };
    queue('sync', { status: 403, body: apiErr('NOT_JOINED') }, { body: syncSame(3) });
    queue('join', { body: { ok: true, serverNow: BASE_T, seat: 1, rejoined: false, view: placing } });
    const room = mk();
    room.start();
    await flush();
    expect(room.getState().entry.kind).toBe('needJoin');
    const r = await room.join({ nickname: '박과장', industry: 1 });
    expect(r.ok).toBe(true);
    expect(room.getState().entry).toEqual({ kind: 'seated', seat: 1 });
    const n = requests.length;
    await tick(SYNC_MS.playNoBell + 10);
    expect(requests.length).toBeGreaterThan(n);
    room.dispose();
  });
});

describe('LiveRoom — 서버 시각 보정(serverNow)', () => {
  it('now()는 서버 시각(왕복 절반 보정)을 따른다', async () => {
    serverOffset = 42_000;
    queue('sync', { body: syncFull(playing(5)) });
    const room = mk();
    room.start();
    await flush();
    expect(Math.abs(room.now() - (Date.now() + 42_000))).toBeLessThan(5);
    await tick(10_000);
    expect(Math.abs(room.now() - (Date.now() + 42_000))).toBeLessThan(5);
    room.dispose();
  });

  it('기한(서버 시각) + 150ms에 refresh 1회를 예약한다', async () => {
    serverOffset = 10_000; // 서버가 10초 앞
    const v = playing(5);
    const due = Date.now() + serverOffset + 3_000;
    const pv = { ...v, game: { ...v.game, clock: { state: 'running' as const, deadlineAt: due } } };
    queue('sync', { body: syncFull(pv) }, { body: syncSame(5) });
    const room = mk({ bell: (_t, _v, onStatus) => (onStatus(true), () => undefined) }); // 폴링 2초
    room.start();
    await flush();
    const n = requests.length;
    await tick(1_000); // 폴링(2초) 전, 기한(3초) 전
    expect(requests.length).toBe(n);
    await tick(1_000); // 폴링 1회
    const afterPoll = requests.length;
    await tick(1_200); // 3.2초: 기한+150ms 지남 → refresh
    expect(requests.length).toBeGreaterThan(afterPoll);
    room.dispose();
  });
});

describe('LiveRoom — 초인종·지표·숨기기 보고', () => {
  it('초인종 v가 내 version보다 클 때만 refresh하고, 300ms 안의 연속 알림은 몰아서 한 번', async () => {
    let ring: ((v: number) => void) | null = null;
    queue('sync', { body: syncFull(playing(5)) }, { body: syncFull(playing(6)) });
    const room = mk({
      bell: (topic, onVersion, onStatus) => {
        expect(topic).toBe('mc:mock');
        ring = onVersion;
        onStatus(true);
        return () => undefined;
      },
    });
    room.start();
    await flush();
    expect(room.getState().transport).toBe('bell');
    const n = requests.filter((r) => r.url.endsWith('/sync')).length;
    ring!(5);
    await flush();
    expect(requests.filter((r) => r.url.endsWith('/sync')).length).toBe(n);
    ring!(6);
    await flush();
    expect(requests.filter((r) => r.url.endsWith('/sync')).length).toBe(n + 1);
    expect(room.getState().view?.room.version).toBe(6);
    room.dispose();
  });

  it('transport 지표는 초인종 연결 결과가 정해진 뒤 세션당 1회', async () => {
    let status: ((ok: boolean) => void) | null = null;
    queue('sync', { body: syncFull(playing(5)) }, { body: syncSame(5) });
    const room = mk({ bell: (_t, _v, s) => ((status = s), () => undefined) });
    room.start();
    await flush();
    room.refresh();
    await flush();
    expect(requests.filter((r) => r.url.endsWith('/feedback'))).toHaveLength(0);
    status!(true);
    await flush();
    status!(false);
    await flush();
    const fb = requests.filter((r) => r.url.endsWith('/feedback'));
    expect(fb).toHaveLength(1);
    expect(fb[0]!.body).toEqual({ type: 'transport', code: '48291', bell: true });
    room.dispose();
  });

  it('dispose 후 다시 start하면(StrictMode) 초인종을 다시 구독한다', async () => {
    const subs: string[] = [];
    queue('sync', { body: syncFull(playing(5)) });
    const room = mk({ bell: (t, _v, s) => (subs.push(t), s(false), () => undefined) });
    room.start();
    await flush();
    room.dispose();
    room.start();
    await flush();
    expect(subs).toEqual(['mc:mock', 'mc:mock']);
    room.dispose();
  });

  it('reportView: keepalive sync로 보기 상태를 즉시 보내고, 250ms 뒤 한 번 더 sync', async () => {
    queue('sync', { body: syncFull(playing(5)) }, { body: syncSame(5) });
    const room = mk();
    room.start();
    await flush();
    room.reportView('disguise');
    await flush();
    const last = syncs()[syncs().length - 1]!;
    expect(last.keepalive).toBe(true);
    expect(last.body).toEqual({ knownVersion: 5, view: 'disguise' });
    const n = syncs().length;
    await tick(260);
    expect(syncs().length).toBe(n + 1);
    room.dispose();
  });

  it('reportView는 자리가 없으면(입장 전) 보내지 않는다', async () => {
    queue('sync', { status: 403, body: apiErr('NOT_JOINED') });
    const room = mk();
    room.start();
    await flush();
    const n = requests.length;
    room.reportView('disguise');
    await flush();
    expect(requests.length).toBe(n);
    room.dispose();
  });

  it('경보 반응 ms는 다음 sync 본문에 실리고 성공하면 지운다', async () => {
    queue('sync', { body: syncFull(playing(5)) }, { body: syncSame(5) }, { body: syncSame(5) });
    const room = mk();
    room.start();
    await flush();
    room.reportAlarm(BASE_T + 1, 812.6);
    await flush();
    expect(syncs()[1]!.body).toEqual({ knownVersion: 5, view: 'game', alarm: { issuedAt: BASE_T + 1, reactionMs: 813 } });
    room.refresh();
    await flush();
    expect(syncs()[2]!.body).toEqual({ knownVersion: 5, view: 'game' });
    room.dispose();
  });

  it('결과 화면의 재대결 만료 시각에도 refresh를 예약한다', async () => {
    const e = withVersion(mockEndedView(0, BASE_T), 9);
    const ended = { ...e, rematch: { requested: [true, false] as const, expiresAt: BASE_T + 4_000 } };
    queue('sync', { body: syncFull(ended) }, { body: syncSame(9) });
    const room = mk({ bell: (_t, _v, s) => (s(true), () => undefined) }); // idle 폴링 5초
    room.start();
    await flush();
    const n = requests.filter((r) => r.url.endsWith('/sync')).length;
    await tick(4_200);
    expect(requests.filter((r) => r.url.endsWith('/sync')).length).toBe(n + 1);
    room.dispose();
  });
});

describe('LiveRoom — D3 백엔드 반영', () => {
  it('대기·배치 중 손님 leave가 403 NOT_JOINED로 와도 성공으로 보고 입장 대화상자로 바꾸지 않는다', async () => {
    const placing = { ...(withVersion(mockPlayingView(1, BASE_T), 3) as unknown as PlacingView), status: 'placing' as const, placeDeadlineAt: BASE_T + 90_000 };
    queue('sync', { body: syncFull(placing) });
    queue('action', { status: 403, body: apiErr('NOT_JOINED') });
    const room = mk();
    room.start();
    await flush();
    const r = await room.leave();
    expect(r.ok).toBe(true);
    expect(room.getState().entry.kind).toBe('seated');
    expect(room.getState().lastError).toBeNull();
    const n = syncs().length;
    await tick(30_000);
    expect(syncs().length).toBe(n); // 나간 뒤 폴링 없음
    room.dispose();
  });

  it('sync RATE_LIMITED는 retryAfterMs 뒤에 다시 시도한다', async () => {
    queue('sync', { body: syncFull(playing(5)) }, { status: 429, body: apiErr('RATE_LIMITED', { retryAfterMs: 9_000 }) }, { body: syncSame(5) });
    const room = mk();
    room.start();
    await flush();
    room.refresh();
    await flush();
    const n = syncs().length;
    await tick(8_000);
    expect(syncs().length).toBe(n);
    await tick(1_100);
    expect(syncs().length).toBe(n + 1);
    room.dispose();
  });

  it('crypto가 없으면 새 난수(actionId)를 만들지 않고 보내지 않는다 → SERVICE_DOWN(E4)', async () => {
    queue('sync', { body: syncFull(playing(5)) });
    const room = mk();
    room.start(); // 이미 저장된 비밀키는 그대로 쓴다(이전 테스트에서 만든 키)
    await flush();
    vi.stubGlobal('crypto', undefined);
    expect(await room.fire('B2')).toEqual({ ok: false, error: 'SERVICE_DOWN' });
    expect(requests.filter((r) => r.url.endsWith('/action'))).toHaveLength(0);
    expect(room.getState().entry.kind).toBe('down');
    room.dispose();
  });
});

