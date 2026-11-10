/**
 * QA(STEP 5) 실전 방 클라(LiveRoom) — CR-5 근거(액션 대기 중 다음 액션 처리), CR-3 근거(첫 sync가 보고하는 view), CR-10(초인종 묶음).
 * 가짜 fetch·가짜 시계. 제품 코드 무수정.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayingView, RoomView } from '../protocol';
import { LiveRoom } from '../client/liveRoom';
import { ViewStore } from '../client/viewStore';
import { mockPlayingView } from '../client/mockViews';

const bug = process.env.QA_SHOW_BUGS ? it : it.fails;
const BASE_T = 1_760_000_000_000;
interface Req { url: string; body: Record<string, unknown> | null }
let requests: Req[];
let actionGate: Promise<void> | null;
let releaseAction: () => void;

const playing = (version: number): PlayingView => ({ ...mockPlayingView(0, BASE_T), room: { ...mockPlayingView(0, BASE_T).room, version } });
const syncFull = (view: RoomView) => ({ ok: true, serverNow: Date.now(), presence: null, changed: true, view });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(BASE_T);
  requests = [];
  actionGate = null;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const body = typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null;
    requests.push({ url, body });
    if (url.endsWith('/action')) {
      if (actionGate) await actionGate;
      return { status: 200, json: async () => ({ ok: true, serverNow: Date.now(), view: playing(10 + requests.length), duplicate: false }) };
    }
    if (url.endsWith('/sync')) return { status: 200, json: async () => syncFull(playing(5)) };
    return { status: 204, json: async () => null };
  }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function flush(n = 12) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

describe('CR-5 근거: 액션 응답 대기 중 들어온 두 번째 액션', () => {
  it('BUG-06 [CR-5] place 응답 대기 중 두 번째 place는 버리지 말고 순서대로 보내야 한다(지금: 요청 없이 WRONG_PHASE)', async () => {
    const room = new LiveRoom('48291', { getView: () => 'game', isTabVisible: () => true });
    room.start();
    await flush();
    actionGate = new Promise((r) => (releaseAction = r));
    const p1 = room.place([{ slot: 'L4', start: 'B2', dir: 'h' }], false);
    const r2 = await room.place([{ slot: 'L4', start: 'B2', dir: 'h' }, { slot: 'L3', start: 'B4', dir: 'h' }], false);
    releaseAction();
    await p1;
    await flush();
    expect(r2.ok).toBe(true);
    expect(requests.filter((q) => q.url.endsWith('/action'))).toHaveLength(2);
    room.dispose();
  });
});

describe('CR-3 근거: 새로고침 첫 sync가 서버에 알리는 화면 상태', () => {
  it('기록: RoomApp처럼 ViewStore("game")로 시작하면 첫 sync 본문 view = "game"(숨김 시작은 응답 뒤 effect)', async () => {
    const store = new ViewStore('game');
    const room = new LiveRoom('48291', { getView: () => store.view, isTabVisible: () => true });
    room.start();
    await flush();
    const first = requests.find((q) => q.url.endsWith('/sync'));
    expect(first?.body?.view).toBe('game');
    room.dispose();
  });
});

describe('CR-10 초인종 간격 제한 중 메시지마다 refresh 예약', () => {
  it('BUG-13 [CR-10] 300ms 안에 초인종 20개가 와도 sync는 묶여서 초당 8회(서버 한도) 이하여야 한다 — 지금: 메시지마다 refresh 예약(응답이 빠르면 20회)', async () => {
    let onV: (v: number) => void = () => undefined;
    const room = new LiveRoom('48291', {
      getView: () => 'game',
      isTabVisible: () => true,
      subscribeBell: (_t, cb, status) => {
        onV = cb;
        status(true);
        return () => undefined;
      },
    });
    room.start();
    await flush();
    const before = requests.filter((q) => q.url.endsWith('/sync')).length;
    for (let i = 0; i < 20; i++) onV(100 + i);
    await vi.advanceTimersByTimeAsync(400);
    await flush();
    const after = requests.filter((q) => q.url.endsWith('/sync')).length;
    // refresh()가 진행 중 sync를 건너뛰는지에 따라 실제 요청 수는 줄 수 있다. 상한 8/초(서버 syncByKey)를 넘는지만 본다
    expect(after - before).toBeLessThanOrEqual(8);
    room.dispose();
  });
});
