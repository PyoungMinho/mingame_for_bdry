/**
 * STEP 6 리뷰 수정 — LiveRoom.
 *  - 백엔드 리뷰 F1: 판이 끝난 뒤(ended) 폴링을 늦추고 멈춘다(결과 화면을 열어 둔 탭 하나가 시간당 720~1,200회 sync).
 *    대전·배치·대기 중 간격은 그대로.
 *  - MC-FE-02: 화면이 사라진(dispose) 뒤 도착한 액션 응답이 초인종을 다시 구독하지 않는다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REMATCH_WAIT_MS, SYNC_MS } from '../constants';
import type { EndedView, PlayingView, RoomView, SyncOk } from '../protocol';
import { ENDED_IDLE_STOP_MS, ENDED_POLL_MS, LiveRoom, type LiveRoomDeps } from './liveRoom';
import { mockEndedView, mockPlayingView } from './mockViews';

const BASE_T = 1_760_000_000_000;
type Reply = { status?: number; body: unknown };
let replies: Map<string, Reply[]>;
let urls: string[];
let actionGate: Promise<void> | null;

const kindOf = (url: string) => (url.endsWith('/sync') ? 'sync' : url.endsWith('/action') ? 'action' : url.endsWith('/feedback') ? 'feedback' : url);
const queue = (kind: string, ...rs: Reply[]) => replies.set(kind, [...(replies.get(kind) ?? []), ...rs]);
const withVersion = <V extends RoomView>(v: V, version: number): V => ({ ...v, room: { ...v.room, version } });
const full = (view: RoomView): SyncOk => ({ ok: true, serverNow: Date.now(), presence: null, changed: true, view });
const same = (version: number): SyncOk => ({ ok: true, serverNow: Date.now(), presence: null, changed: false, version });
const ended = (version: number, patch: Partial<EndedView> = {}): EndedView => ({ ...withVersion(mockEndedView(0, BASE_T), version), ...patch });
const playing = (version: number): PlayingView => withVersion(mockPlayingView(0, BASE_T), version);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(BASE_T);
  replies = new Map();
  urls = [];
  actionGate = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const kind = kindOf(url);
      urls.push(kind);
      if (kind === 'action' && actionGate) await actionGate;
      const list = replies.get(kind) ?? [];
      const r = list.length > 1 ? list.shift()! : list[0];
      if (!r) return { status: 204, json: async () => null };
      const payload = JSON.parse(JSON.stringify(r.body)) as Record<string, unknown>;
      if (typeof payload.serverNow === 'number') payload.serverNow = Date.now();
      return { status: r.status ?? 200, json: async () => payload };
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function flush(n = 12) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}
async function tick(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
  await flush();
}
const syncCount = () => urls.filter((u) => u === 'sync').length;

function mk(o: { view?: () => 'game' | 'disguise'; visible?: () => boolean; bell?: LiveRoomDeps['subscribeBell'] } = {}) {
  return new LiveRoom('48291', {
    getView: o.view ?? (() => 'game'),
    isTabVisible: o.visible ?? (() => true),
    subscribeBell: o.bell ?? ((_t, _v, s) => (s(true), () => undefined)),
  });
}

describe('F1 결과 화면(ended) 폴링', () => {
  it('재대결 요청 전: 30초 간격(보이는 게임 화면), 10분 뒤 멈춤 → 1시간 sync ≤ 21회(예전 초인종 5초 = 720회)', async () => {
    queue('sync', { body: full(ended(20)) }, { body: same(20) });
    const room = mk();
    room.start();
    await flush();
    expect(syncCount()).toBe(1);
    await tick(ENDED_POLL_MS.visible - 100);
    expect(syncCount()).toBe(1);
    await tick(200);
    expect(syncCount()).toBe(2);
    for (let i = 0; i < 120; i++) await tick(30_000); // 1시간
    const hour = syncCount();
    expect(hour).toBeLessThanOrEqual(1 + ENDED_IDLE_STOP_MS / ENDED_POLL_MS.visible);
    await tick(60 * 60_000);
    expect(syncCount()).toBe(hour); // 멈춘 뒤 0
    room.dispose();
  });

  it('숨기기·탭 비활성이면 60초 간격', async () => {
    queue('sync', { body: full(ended(20)) }, { body: same(20) });
    let visible = true;
    const room = mk({ view: () => 'disguise', visible: () => visible });
    room.start();
    await flush();
    await tick(ENDED_POLL_MS.visible + 100);
    expect(syncCount()).toBe(1);
    await tick(ENDED_POLL_MS.hidden - ENDED_POLL_MS.visible);
    expect(syncCount()).toBe(2);
    visible = false;
    await tick(ENDED_POLL_MS.hidden);
    expect(syncCount()).toBe(3);
    room.dispose();
  });

  it('상대가 나갔으면(opp.present false) 폴링하지 않는다 — 초인종이 오면 그때만 sync', async () => {
    let ring: ((v: number) => void) | null = null;
    const gone = ended(20);
    queue('sync', { body: full({ ...gone, opp: { ...gone.opp, present: false } }) }, { body: same(20) });
    const room = mk({ bell: (_t, v, s) => ((ring = v), s(true), () => undefined) });
    room.start();
    await flush();
    await tick(60 * 60_000);
    expect(syncCount()).toBe(1);
    ring!(21);
    await flush();
    expect(syncCount()).toBe(2);
    await tick(10 * 60_000);
    expect(syncCount()).toBe(2);
    room.dispose();
  });

  it('재대결 요청 대기 중에는 예전 간격(초인종 5초), 기한이 지나면(rematchExpired) 멈춘다', async () => {
    const waiting = ended(21, { rematch: { requested: [false, true], expiresAt: BASE_T + REMATCH_WAIT_MS } });
    const expired = ended(22, { events: [...waiting.events, { seq: 3, at: BASE_T + REMATCH_WAIT_MS, round: 9, type: 'rematchExpired' }] });
    queue('sync', { body: full(waiting) });
    const room = mk();
    room.start();
    await flush();
    await tick(SYNC_MS.idle + 50);
    expect(syncCount()).toBe(2);
    await tick(SYNC_MS.idle);
    expect(syncCount()).toBe(3);
    // 기한 도달 → 서버가 만료 처리한 view
    replies.set('sync', [{ body: full(expired) }]);
    await tick(REMATCH_WAIT_MS);
    const n = syncCount();
    await tick(30 * 60_000);
    expect(syncCount()).toBe(n);
    room.dispose();
  });

  it('멈춘 뒤 내가 [v8로 저장]을 누르면(재대결 요청 응답) 다시 5초 간격으로 돈다', async () => {
    const e = ended(20);
    queue('sync', { body: full(e) }, { body: same(21) });
    const room = mk();
    room.start();
    await flush();
    await tick(ENDED_IDLE_STOP_MS + 60_000);
    const stopped = syncCount();
    await tick(10 * 60_000);
    expect(syncCount()).toBe(stopped);
    queue('action', { body: { ok: true, serverNow: Date.now(), view: ended(21, { rematch: { requested: [true, false], expiresAt: Date.now() + REMATCH_WAIT_MS } }) } });
    await room.rematch();
    await flush();
    await tick(SYNC_MS.idle + 50);
    expect(syncCount()).toBe(stopped + 1);
    room.dispose();
  });

  it('결과 30초 대기 중 재대결 요청이 오면(초인종 → view) 예정을 5초로 당긴다', async () => {
    let ring: ((v: number) => void) | null = null;
    queue('sync', { body: full(ended(20)) }, { body: full(ended(21, { rematch: { requested: [false, true], expiresAt: BASE_T + REMATCH_WAIT_MS } })) }, { body: same(21) });
    const room = mk({ bell: (_t, v, s) => ((ring = v), s(true), () => undefined) });
    room.start();
    await flush();
    await tick(1_000);
    ring!(21);
    await flush();
    expect(syncCount()).toBe(2);
    await tick(SYNC_MS.idle + 50);
    expect(syncCount()).toBe(3);
    room.dispose();
  });

  it('(회귀) 대전 중 간격은 그대로: 초인종 2초, 초인종 없음 1초, 탭 비활성 5초', async () => {
    queue('sync', { body: full(playing(5)) }, { body: same(5) });
    const a = mk();
    a.start();
    await flush();
    await tick(SYNC_MS.play * 5 + 10);
    expect(syncCount()).toBe(6);
    a.dispose();
    urls = [];
    replies.set('sync', [{ body: full(playing(5)) }, { body: same(5) }]);
    const b = mk({ bell: (_t, _v, s) => (s(false), () => undefined) });
    b.start();
    await flush();
    await tick(SYNC_MS.playNoBell * 5 + 10);
    expect(syncCount()).toBe(6);
    b.dispose();
    urls = [];
    replies.set('sync', [{ body: full(playing(5)) }, { body: same(5) }]);
    const c = mk({ visible: () => false });
    c.start();
    await flush();
    await tick(SYNC_MS.hiddenTab * 2 + 10);
    expect(syncCount()).toBe(3);
    c.dispose();
  });
});

describe('MC-FE-02 dispose 뒤 도착한 응답', () => {
  it('액션 응답이 dispose 뒤에 오면 view를 반영하지 않고 초인종도 다시 구독하지 않는다', async () => {
    const subs: string[] = [];
    queue('sync', { body: full(playing(5)) });
    const room = mk({ bell: (t, _v, s) => (subs.push(t), s(true), () => undefined) });
    room.start();
    await flush();
    expect(subs).toEqual(['mc:mock']);
    let open!: () => void;
    actionGate = new Promise<void>((r) => (open = r));
    queue('action', { body: { ok: true, serverNow: Date.now(), view: playing(6) } });
    const pending = room.fire('B2');
    await flush();
    room.dispose();
    open();
    await pending;
    await flush();
    expect(subs).toEqual(['mc:mock']);
    expect(room.getState().view?.room.version).toBe(5);
    await tick(60_000);
    expect(syncCount()).toBe(1);
  });
});
