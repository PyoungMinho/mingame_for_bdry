/**
 * QA 수정 회귀(프론트 클라, STEP 5 버그 리포트): BUG-06(배치 묶음), BUG-17(첫 sync 숨김 보고), BUG-21(공유 시트 예외 = 이탈 1번).
 * 가짜 fetch·가짜 시계. QA 재현 테스트(../qa/liveroom.qa.test.ts)를 보강한다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayingView } from '../protocol';
import { LiveRoom } from './liveRoom';
import { ViewStore } from './viewStore';
import { mockPlayingView } from './mockViews';

const BASE_T = 1_760_000_000_000;
interface Req { url: string; body: Record<string, unknown> | null }
let requests: Req[];
let gate: Promise<void> | null;
let release: () => void;

const playing = (version: number): PlayingView => ({ ...mockPlayingView(0, BASE_T), room: { ...mockPlayingView(0, BASE_T).room, version } });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(BASE_T);
  requests = [];
  gate = null;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const body = typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null;
    requests.push({ url, body });
    if (url.endsWith('/action')) {
      if (gate) await gate;
      return { status: 200, json: async () => ({ ok: true, serverNow: Date.now(), view: playing(10 + requests.length), duplicate: false }) };
    }
    if (url.endsWith('/sync')) return { status: 200, json: async () => ({ ok: true, serverNow: Date.now(), presence: null, changed: true, view: playing(5) }) };
    return { status: 204, json: async () => null };
  }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function flush(n = 16) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}
const actions = () => requests.filter((q) => q.url.endsWith('/action'));
const syncs = () => requests.filter((q) => q.url.endsWith('/sync'));

describe('BUG-06 place 응답 대기 중 배치 묶기', () => {
  it('대기 중 place 3개 → 마지막 1개만 앞 응답 뒤에 보낸다(요청 2건, 마지막 초안이 이긴다)', async () => {
    const room = new LiveRoom('48291', { getView: () => 'game', isTabVisible: () => true });
    room.start();
    await flush();
    gate = new Promise((r) => (release = r));
    const p1 = room.place([{ slot: 'L4', start: 'B2', dir: 'h' }], false);
    const r2 = await room.place([{ slot: 'L4', start: 'B2', dir: 'h' }, { slot: 'L3', start: 'B4', dir: 'h' }], false);
    const r3 = await room.place([{ slot: 'L4', start: 'B2', dir: 'h' }, { slot: 'L3', start: 'B5', dir: 'h' }], false);
    expect(r2.ok && r3.ok).toBe(true);
    expect(actions()).toHaveLength(1);
    release();
    await p1;
    await flush();
    expect(actions()).toHaveLength(2);
    expect(actions()[1]!.body).toMatchObject({ type: 'place', ships: [{ slot: 'L4' }, { slot: 'L3', start: 'B5' }], confirm: false });
    room.dispose();
  });
  it('place 대기 중 fire 등 다른 액션은 예전처럼 WRONG_PHASE(요청 없음)', async () => {
    const room = new LiveRoom('48291', { getView: () => 'game', isTabVisible: () => true });
    room.start();
    await flush();
    gate = new Promise((r) => (release = r));
    const p1 = room.place([{ slot: 'L4', start: 'B2', dir: 'h' }], false);
    expect(await room.fire('B3')).toEqual({ ok: false, error: 'WRONG_PHASE' });
    release();
    await p1;
    await flush();
    expect(actions()).toHaveLength(1);
    room.dispose();
  });
});

describe('BUG-17 첫 sync가 보고하는 화면 상태', () => {
  it('firstSyncView = disguise → 첫 sync 본문 view "disguise", 그다음부터는 getView()', async () => {
    const store = new ViewStore('game');
    const room = new LiveRoom('48291', { getView: () => store.view, firstSyncView: () => 'disguise', isTabVisible: () => true });
    room.start();
    await flush();
    expect(syncs()[0]?.body?.view).toBe('disguise');
    room.refresh();
    await flush();
    expect(syncs()[1]?.body?.view).toBe('game');
    room.dispose();
  });
  it('홈에서 방금 만든 방(firstSyncView = game)은 그대로 game', async () => {
    const room = new LiveRoom('48291', { getView: () => 'game', firstSyncView: () => 'game', isTabVisible: () => true });
    room.start();
    await flush();
    expect(syncs()[0]?.body?.view).toBe('game');
    room.dispose();
  });
});

describe('BUG-21 공유 시트 예외 = 이탈 1번 분량', () => {
  it('blur 직후 visibility(짝)도 함께 소비, 그다음 이탈은 숨김', () => {
    const s = new ViewStore();
    s.graceNextLeave();
    expect(s.consumeLeaveGrace('blur')).toBe(true);
    expect(s.consumeLeaveGrace('visibility')).toBe(true);
    expect(s.consumeLeaveGrace('blur')).toBe(false);
  });
  it('같은 종류가 다시 오면 새 이탈(숨김), 짝 창(1초)이 지나면 다른 종류도 숨김', () => {
    const a = new ViewStore();
    a.graceNextLeave();
    expect(a.consumeLeaveGrace('blur')).toBe(true);
    expect(a.consumeLeaveGrace('blur')).toBe(false);
    const b = new ViewStore();
    b.graceNextLeave();
    expect(b.consumeLeaveGrace('visibility')).toBe(true);
    vi.advanceTimersByTime(1200);
    expect(b.consumeLeaveGrace('blur')).toBe(false);
  });
  it('pagehide는 짝으로 소비하지 않는다(돌아왔을 때 게임 화면이 남지 않게)', () => {
    const s = new ViewStore();
    s.graceNextLeave();
    expect(s.consumeLeaveGrace('blur')).toBe(true);
    expect(s.consumeLeaveGrace('pagehide')).toBe(false);
  });
});
