import { describe, expect, it } from 'vitest';
import { ACTIVE_ROOMS_CAP, HIDE_BUDGET_MS, QUIZ_LOCK_MS, TURN_MS } from '../constants';
import { emptyCells, FLEET0, FLEET1 } from '../engine/testkit';
import { seededRng } from '../engine/rng';
import type { RoomState } from '../engine/types';
import { VIEW_FORBIDDEN_KEYS, type ApiErr, type RoomView, type Seat } from '../protocol';
import { hashKey, type Identity } from './auth';
import {
  actionFlow,
  createRoomFlow,
  feedbackFlow,
  healthFlow,
  joinFlow,
  syncFlow,
  type Out,
  type PipelineDeps,
} from './pipeline';
import { RateLimiter } from './rate';
import { MemoryStore } from './store-memory';

// ─── 테스트 보조 ──────────────────────────────────────────────────────────────

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ident = (c: string): Identity => ({ keyHash: hashKey(c.repeat(32)), isTest: true, ip: '9.9.9.9' });

function mkDeps() {
  const store = new MemoryStore();
  const t = { now: 50_000_000 };
  let n = 0;
  let code = 20000;
  const bells: { topic: string; v: number }[] = [];
  const deps: PipelineDeps = {
    store,
    env: 'development',
    now: () => t.now,
    rng: seededRng(77),
    newId: () => uuid(++n),
    randomCode: () => String(++code),
    bell: async (topic, v) => void bells.push({ topic, v }),
    limiter: new RateLimiter(),
  };
  return { deps, store, t, bells };
}

type Ok<T> = Extract<T, { ok: true }>;
function must<T>(out: Out<T>): Ok<T> {
  if (!(out.body as { ok: boolean }).ok) throw new Error(`expected ok, got ${JSON.stringify((out.body as ApiErr).error)} ${(out.body as ApiErr).reason ?? ''}`);
  return out.body as Ok<T>;
}
const errOf = (out: Out<unknown>) => out.body as ApiErr;

class Game {
  readonly m = mkDeps();
  readonly A = ident('a');
  readonly B = ident('b');
  code = '';
  private aid = 0;
  views: [RoomView | null, RoomView | null] = [null, null];
  version = -1;

  get deps() {
    return this.m.deps;
  }
  async create(alarmOn = false) {
    const out = must(await createRoomFlow(this.deps, this.A, { nickname: '가나', industry: 0, alarmOn }));
    this.code = out.code;
    this.views[0] = out.view;
    return out;
  }
  async join(who = this.B) {
    return joinFlow(this.deps, this.code, who, { nickname: '다라', industry: 1 });
  }
  id(seat: Seat) {
    return seat === 0 ? this.A : this.B;
  }
  async sync(seat: Seat, view: 'game' | 'disguise' = 'game', known = -1, alarm?: { issuedAt: number; reactionMs: number }) {
    this.m.deps.limiter.reset();
    const out = await syncFlow(this.deps, this.code, this.id(seat), { knownVersion: known, view, ...(alarm ? { alarm } : {}) });
    if ((out.body as { ok: boolean }).ok) {
      const b = out.body as Extract<typeof out.body, { ok: true }>;
      if (b.changed) this.views[seat] = b.view;
    }
    return out;
  }
  async syncBoth() {
    await this.sync(0);
    await this.sync(1);
  }
  async act(seat: Seat, body: Record<string, unknown>, actionId?: string) {
    this.m.deps.limiter.reset();
    const out = await actionFlow(this.deps, this.code, this.id(seat), { actionId: actionId ?? `act${++this.aid}`, ...body });
    const b = out.body as { ok: boolean; view?: RoomView };
    if (b.view) this.views[seat] = b.view;
    return out;
  }
  async raw(): Promise<RoomState> {
    return (await this.m.store.load(this.code, this.m.t.now))!.room.state as unknown as RoomState;
  }
  async rawVersion(): Promise<number> {
    return (await this.m.store.load(this.code, this.m.t.now))!.room.version;
  }
  async start(alarmOn = false) {
    await this.create(alarmOn);
    must(await this.join());
    must(await this.act(0, { type: 'place', ships: FLEET0, confirm: true }));
    must(await this.act(1, { type: 'place', ships: FLEET1, confirm: true }));
    await this.syncBoth();
  }
  async turn(): Promise<Seat> {
    await this.syncBoth();
    const v = this.views[0]!;
    if (v.status !== 'playing') throw new Error(`status ${v.status}`);
    return v.game.turn;
  }
  /** 미스 한 발(차례인 사람) */
  async miss() {
    const seat = await this.turn();
    const v = this.views[seat]!;
    const fired = v.status === 'playing' ? v.game.myShots.map((x) => x.cell) : [];
    const fleet = seat === 0 ? FLEET1 : FLEET0;
    const cell = emptyCells(fleet).find((c) => !fired.includes(c))!;
    this.m.t.now += 1000;
    return must(await this.act(seat, { type: 'fire', cell }));
  }
}

const noForbidden = (v: unknown, allowReveal: boolean) => {
  const json = JSON.stringify(v);
  for (const k of VIEW_FORBIDDEN_KEYS) {
    if (k === 'reveal' && allowReveal) continue;
    expect(json.includes(`"${k}"`), `금지 키 ${k}`).toBe(false);
  }
  expect(json).not.toContain(hashKey('a'.repeat(32)));
  expect(json).not.toContain(hashKey('b'.repeat(32)));
  expect(json).not.toContain('a'.repeat(32));
};

// ─── 방 만들기·입장 ────────────────────────────────────────────────────────────

describe('방 만들기·입장', () => {
  it('만들기 → 입장 → 재입장, 세 번째는 ROOM_FULL, 자리 없는 키 sync는 NOT_JOINED/ROOM_FULL', async () => {
    const g = new Game();
    const created = await g.create();
    expect(created.seat).toBe(0);
    expect(created.view.status).toBe('waiting');
    expect(created.view.room.bellTopic.startsWith('mc:')).toBe(true);
    // 빈자리가 있을 때 자리 없는 사람
    const stranger = ident('c');
    const s1 = await syncFlow(g.deps, g.code, stranger, { knownVersion: -1, view: 'game' });
    expect(errOf(s1)).toMatchObject({ error: 'NOT_JOINED' });
    expect(errOf(s1).view).toBeUndefined();
    const j = must(await g.join());
    expect(j).toMatchObject({ seat: 1, rejoined: false });
    expect(j.view.status).toBe('placing');
    const again = must(await g.join());
    expect(again.rejoined).toBe(true);
    const third = await g.join(stranger);
    expect(errOf(third)).toMatchObject({ error: 'ROOM_FULL' });
    expect(errOf(third).view).toBeUndefined();
    expect(errOf(await syncFlow(g.deps, g.code, stranger, { knownVersion: -1, view: 'game' })).error).toBe('ROOM_FULL');
    expect(g.m.bells.length).toBeGreaterThan(0);
  });

  it('없는 방·형식 오류 번호·키 없음·잘못된 본문', async () => {
    const g = new Game();
    await g.create();
    expect(errOf(await joinFlow(g.deps, '99999', g.B, { nickname: 'x', industry: 0 })).error).toBe('ROOM_NOT_FOUND');
    expect(errOf(await joinFlow(g.deps, '0123', g.B, { nickname: 'x', industry: 0 })).error).toBe('ROOM_NOT_FOUND');
    expect(errOf(await joinFlow(g.deps, g.code, null, {})).reason).toBe('key');
    expect(errOf(await joinFlow(g.deps, g.code, g.B, { nickname: '', industry: 0 })).reason).toBe('nickname');
    expect(errOf(await joinFlow(g.deps, g.code, g.B, { nickname: '123456789', industry: 0 })).reason).toBe('nickname');
    expect(errOf(await joinFlow(g.deps, g.code, g.B, { nickname: 'x', industry: 5 })).reason).toBe('body');
    expect(errOf(await createRoomFlow(g.deps, g.A, undefined)).reason).toBe('body');
  });

  it('30분이 지난 방은 ROOM_NOT_FOUND', async () => {
    const g = new Game();
    await g.create();
    g.m.t.now += 31 * 60_000;
    expect(errOf(await g.join()).error).toBe('ROOM_NOT_FOUND');
  });

  it('방 만들기 제한: 키당 10분 5회, 활성 방 상한 → CAPACITY', async () => {
    const g = new Game();
    for (let i = 0; i < 5; i++) must(await createRoomFlow(g.deps, g.A, { nickname: 'a', industry: 0, alarmOn: false }));
    const out = await createRoomFlow(g.deps, g.A, { nickname: 'a', industry: 0, alarmOn: false });
    expect(errOf(out).error).toBe('RATE_LIMITED');
    expect(out.retryAfterSec).toBeGreaterThan(0);
    const cap = mkDeps();
    for (let i = 0; i < ACTIVE_ROOMS_CAP; i++) {
      const id = ident(String.fromCharCode(97 + (i % 20)));
      cap.deps.limiter.reset();
      must(await createRoomFlow(cap.deps, { ...id, keyHash: hashKey(`${i}`.padStart(32, '0')) }, { nickname: 'a', industry: 0, alarmOn: false }));
    }
    cap.deps.limiter.reset();
    expect(errOf(await createRoomFlow(cap.deps, ident('z'), { nickname: 'a', industry: 0, alarmOn: false })).error).toBe('CAPACITY');
  });

  it('health', async () => {
    const g = new Game();
    expect(await healthFlow(g.deps)).toEqual({ db: 'ok' });
    expect(await healthFlow(null)).toEqual({ db: 'down' });
  });
});

// ─── 한 판 전체 ───────────────────────────────────────────────────────────────

describe('한 판 통합: 배치 → 대전 → 검산(오답 잠금) → 힌트 → 경보 → 종료 → v8 재대결 → 재접속', () => {
  it('끝까지', async () => {
    const g = new Game();
    await g.start(true);
    const t = g.m.t;
    // 배치 직후 대전 시작
    expect(g.views[0]!.status).toBe('playing');
    // 경보 라운드를 2로(비밀 상태를 직접 고쳐 저장 — 테스트 전용)
    {
      const snap = (await g.m.store.load(g.code, t.now))!;
      const st = structuredClone(snap.room.state) as unknown as RoomState;
      st.secret.alarmRound = 6;
      expect((await g.m.store.save(snap.room.id, snap.room.version, { state: st as never, status: st.status, expiresAt: t.now + 1e6 }, t.now)).ok).toBe(true);
    }
    let sawQuiz = false;
    let hintsUsed = false;
    let sawAlarm = false;
    for (let i = 0; i < 40; i++) {
      const v0 = g.views[0]!;
      if (v0.status === 'ended') break;
      // 검산
      await g.syncBoth();
      const cur = g.views[0]!;
      if (cur.status !== 'playing') break;
      if (cur.game.phase === 'quiz') {
        sawQuiz = true;
        const q = (g.views[0] as Extract<RoomView, { status: 'playing' }>).game.quiz!;
        const raw = await g.raw();
        const ans = raw.secret.quiz!.answer;
        // 두 화면 모두 정답 필드가 없다
        noForbidden(g.views[0], false);
        noForbidden(g.views[1], false);
        // 오답 → 잠금 → 잠금 중 정답은 LOCKED
        t.now += 1000;
        const wrong = await g.act(0, { type: 'answer', quizId: q.id, value: ans + 1 });
        const wv = must(wrong).view;
        expect(wv.me.quizLockUntil).toBe(t.now + QUIZ_LOCK_MS);
        // 상대 화면에는 아무 흔적이 없다
        const ov = (await g.sync(1, 'game', -1)).body as { view: RoomView };
        expect(ov.view.me.quizLockUntil).toBeNull();
        t.now += 200;
        const locked = await g.act(0, { type: 'answer', quizId: q.id, value: ans });
        expect(errOf(locked)).toMatchObject({ error: 'LOCKED' });
        expect(errOf(locked).view).toBeDefined();
        t.now += QUIZ_LOCK_MS;
        must(await g.act(0, { type: 'answer', quizId: q.id, value: ans }));
        // 상대는 아직 풀이 중 → 결과가 settling이어도 B에게는 안 보임
        await g.sync(1, 'game', -1);
        const bv = g.views[1]!;
        expect(bv.status === 'playing' && bv.game.quiz?.mine).toBe('open');
        expect(bv.status === 'playing' && bv.game.quiz?.settleAt).toBeNull();
        t.now += 100;
        must(await g.act(1, { type: 'answer', quizId: q.id, value: ans }));
        t.now += 12_000;
        await g.syncBoth();
        const after = g.views[0]!;
        expect(after.status === 'playing' && after.game.phase).toBe('fire');
        continue;
      }
      if (cur.game.alarm) {
        sawAlarm = true;
        const issuedAt = cur.game.alarm.issuedAt;
        t.now += 500;
        await g.sync(0, 'disguise', -1, { issuedAt, reactionMs: 600 });
        await g.sync(1, 'game', -1, { issuedAt, reactionMs: 4000 });
        await g.sync(0, 'game');
        const raw = await g.raw();
        expect(raw.seats[1]!.skipNextFire).toBe(true);
        expect(raw.seats[0]!.skipNextFire).toBe(false);
      }
      // 힌트: 가진 사람이 쓴다
      for (const seat of [0, 1] as const) {
        const me = g.views[seat]!.me;
        if (me.hintsAvailable > 0) {
          const out = must(await g.act(seat, { type: 'hint', target: { kind: 'col', col: 'E' } }));
          hintsUsed = true;
          expect(out.view.me.hints.at(-1)).toMatchObject({ target: { kind: 'col', col: 'E' } });
          const opp = (seat === 0 ? g.views[1] : g.views[0])!;
          void opp;
        }
      }
      await g.miss();
    }
    expect(sawQuiz).toBe(true);
    expect(hintsUsed).toBe(true);
    expect(sawAlarm).toBe(true);
    // 힌트 값은 사용자 비공개: 상대 화면 로그에는 범위만
    await g.syncBoth();
    const logOpp = JSON.stringify((g.views[1] as Extract<RoomView, { status: 'playing' }>).game.log);
    expect(logOpp).not.toContain('"value"');

    // 종료: 차례인 사람이 상대 2척 격침 — 치트로 실제 칸을 쏜다
    for (let guard = 0; guard < 60; guard++) {
      const seat = await g.turn().catch(() => null as never);
      if (seat === null) break;
      const raw = await g.raw();
      const g0 = raw.game!;
      if (raw.status !== 'playing') break;
      const fleet = seat === 0 ? FLEET1 : FLEET0;
      const fired = new Set(g0.shots[seat].map((x) => x.cell));
      const target = ['G1', 'G2', 'G3', 'F6', 'G6', 'A5', 'B5', 'A3', 'B3', 'C3'].find((c) => !fired.has(c as never) && fleetHas(fleet, c));
      t.now += 1000;
      if (!target) await g.miss();
      else await g.act(seat, { type: 'fire', cell: target });
      if ((await g.raw()).status === 'ended') break;
    }
    await g.syncBoth();
    const endedA = g.views[0]!;
    expect(endedA.status).toBe('ended');
    if (endedA.status !== 'ended') return;
    expect(endedA.reveal).toHaveLength(3);
    noForbidden(g.views[0], true);
    const endedB = g.views[1]!;
    expect(endedB.status).toBe('ended');
    const winner = endedA.result.winner;
    expect(winner).not.toBeNull();
    expect(endedA.room.record.wins[winner as Seat]).toBe(1);

    // v8 재대결
    must(await g.act(0, { type: 'rematch' }));
    const half = g.views[0]!;
    expect(half.status === 'ended' && half.rematch.requested).toEqual([true, false]);
    must(await g.act(1, { type: 'rematch' }));
    const next = g.views[1]!;
    expect(next.status).toBe('placing');
    expect(next.room.matchSeq).toBe(2);
    expect(next.room.record.wins[winner as Seat]).toBe(1);
    must(await g.act(0, { type: 'place', ships: FLEET0, confirm: true }));
    must(await g.act(1, { type: 'place', ships: FLEET1, confirm: true }));
    await g.syncBoth();
    const second = g.views[0]!;
    expect(second.status).toBe('playing');
    // 선공 교대
    const firstOfMatch1 = endedA.game.firstSeat;
    expect(second.status === 'playing' && second.game.firstSeat).toBe(firstOfMatch1 === 0 ? 1 : 0);
    expect(second.status === 'playing' && second.game.matchId).not.toBe(endedA.game.matchId);

    // 재접속: 같은 키 join → 같은 자리, 같은 화면(서버 시각 제외)
    const rejoin = must(await g.join());
    expect(rejoin.rejoined).toBe(true);
    const fullSync = (await g.sync(1, 'game', -1)).body as { view: RoomView };
    expect(JSON.stringify(rejoin.view)).toBe(JSON.stringify(fullSync.view));
    // 변경 없음 응답
    const unchanged = (await g.sync(1, 'game', fullSync.view.room.version)).body as { changed: boolean; version: number };
    expect(unchanged).toMatchObject({ changed: false, version: fullSync.view.room.version });
  }, 60_000);
});

function fleetHas(fleet: typeof FLEET0, cell: string): boolean {
  return fleet.some((p) => {
    const n = p.slot === 'L4' ? 4 : p.slot === 'L3' ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const c = p.dir === 'h' ? `${String.fromCharCode(p.start.charCodeAt(0) + i)}${p.start.slice(1)}` : `${p.start[0]}${Number(p.start.slice(1)) + i}`;
      if (c === cell) return true;
    }
    return false;
  });
}

// ─── 시계·숨기기 (sync가 기한을 처리) ──────────────────────────────────────────

describe('시계', () => {
  it('시간 초과는 sync 요청이 처리하고, 오래 끊겼다 와도 1회만', async () => {
    const g = new Game();
    await g.start();
    const first = await g.turn();
    g.m.t.now += TURN_MS * 30;
    const out = must(await g.sync(1));
    void out;
    const raw = await g.raw();
    expect(raw.events.filter((e) => e.type === 'timeout')).toHaveLength(1);
    expect(raw.game!.turn).not.toBe(first);
  });

  it('차례인 사람이 숨으면(sync disguise) 발사 시계가 서고, 복귀하면 이어진다', async () => {
    const g = new Game();
    await g.start();
    const seat = await g.turn();
    const t = g.m.t;
    const T = (await g.raw()).game!.clock!.startedAt;
    t.now += 4000;
    await g.sync(seat, 'disguise');
    t.now += 60_000;
    await g.sync((seat === 0 ? 1 : 0) as Seat);
    const raw = await g.raw();
    expect(raw.events.some((e) => e.type === 'timeout')).toBe(false);
    expect(raw.game!.clock!.pause).toMatchObject({ since: T + 4000, remainingMs: TURN_MS - 4000 });
    const oppView = g.views[seat === 0 ? 1 : 0]!;
    expect(oppView.status === 'playing' && oppView.game.clock).toMatchObject({ state: 'paused', reason: 'hidden', remainingMs: TURN_MS - 4000, budgetEndsAt: T + 4000 + HIDE_BUDGET_MS });
    expect(oppView.opp!.hidden).toBe(true);
    t.now += 1000;
    await g.sync(seat, 'game');
    const after = await g.raw();
    expect(after.game!.clock!.pause).toBeNull();
    expect(after.game!.clock!.deadlineAt).toBe(t.now + TURN_MS - 4000);
  });
});

// ─── 동시성 ───────────────────────────────────────────────────────────────────

describe('동시성', () => {
  it('같은 version에서 같은 사람의 동시 발사: 하나만 반영', async () => {
    const g = new Game();
    await g.start();
    const seat = await g.turn();
    g.deps.limiter.reset();
    const results = await Promise.all([
      actionFlow(g.deps, g.code, g.id(seat), { actionId: 'c1', type: 'fire', cell: 'A1' }),
      actionFlow(g.deps, g.code, g.id(seat), { actionId: 'c2', type: 'fire', cell: 'A2' }),
      actionFlow(g.deps, g.code, g.id(seat), { actionId: 'c3', type: 'fire', cell: 'A3' }),
    ]);
    const oks = results.filter((r) => (r.body as { ok: boolean }).ok);
    expect(oks).toHaveLength(1);
    const raw = await g.raw();
    expect(raw.game!.shots[seat]).toHaveLength(1);
    for (const r of results.filter((x) => !(x.body as { ok: boolean }).ok)) {
      expect(['NOT_YOUR_TURN', 'CONFLICT']).toContain(errOf(r).error);
    }
  });

  it('같은 actionId 동시 재전송은 한 번만 적용', async () => {
    const g = new Game();
    await g.start();
    const seat = await g.turn();
    g.deps.limiter.reset();
    const rs = await Promise.all([
      actionFlow(g.deps, g.code, g.id(seat), { actionId: 'same', type: 'fire', cell: 'H8' }),
      actionFlow(g.deps, g.code, g.id(seat), { actionId: 'same', type: 'fire', cell: 'H8' }),
    ]);
    expect((await g.raw()).game!.shots[seat]).toHaveLength(1);
    expect(rs.some((r) => (r.body as { ok: boolean }).ok)).toBe(true);
  });

  it('서로 다른 두 사람의 동시 입력(검산 두 답)은 둘 다 반영된다(재시도)', async () => {
    const g = new Game();
    await g.start();
    while (!(await g.raw()).game!.quiz) await g.miss();
    await g.syncBoth();
    const raw = await g.raw();
    const q = raw.game!.quiz!;
    const ans = raw.secret.quiz!.answer;
    g.m.t.now += 2000;
    g.deps.limiter.reset();
    const rs = await Promise.all([
      actionFlow(g.deps, g.code, g.A, { actionId: 'qa', type: 'answer', quizId: q.id, value: ans }),
      actionFlow(g.deps, g.code, g.B, { actionId: 'qb', type: 'answer', quizId: q.id, value: ans }),
    ]);
    expect(rs.every((r) => (r.body as { ok: boolean }).ok)).toBe(true);
    const after = await g.raw();
    expect(after.events.find((e) => e.type === 'quizSettled')).toMatchObject({ awarded: [0, 1] });
  });
});

// ─── 유출·입력·제한 ───────────────────────────────────────────────────────────

describe('응답 안전', () => {
  it('판 내내 모든 응답에 금지 키·키 해시가 없다(종료 전)', async () => {
    const g = new Game();
    await g.start(true);
    for (let i = 0; i < 12; i++) {
      await g.syncBoth();
      for (const s of [0, 1] as const) noForbidden(g.views[s], false);
      const v = g.views[0]!;
      if (v.status !== 'playing') break;
      if (v.game.phase === 'quiz') {
        g.m.t.now += 11_000;
        await g.syncBoth();
        continue;
      }
      await g.miss();
    }
  });

  it('잘못된 본문은 INVALID, 비밀키 없는 요청은 INVALID key, 거부 응답에는 최신 view가 따라온다', async () => {
    const g = new Game();
    await g.start();
    expect(errOf(await actionFlow(g.deps, g.code, g.A, { type: 'fire', cell: 'A1' })).error).toBe('INVALID');
    expect(errOf(await actionFlow(g.deps, g.code, g.A, { actionId: 'x', type: 'fire', cell: 'Z9' })).reason).toBe('cell');
    expect(errOf(await actionFlow(g.deps, g.code, g.A, { actionId: 'x', type: 'fire', cell: 'A1', extra: 1 })).error).toBe('INVALID');
    expect(errOf(await actionFlow(g.deps, g.code, null, {})).reason).toBe('key');
    const seat = await g.turn();
    const wrongTurn = (seat === 0 ? 1 : 0) as Seat;
    const out = await g.act(wrongTurn, { type: 'fire', cell: 'A1' });
    expect(errOf(out)).toMatchObject({ error: 'NOT_YOUR_TURN' });
    expect(errOf(out).view?.status).toBe('playing');
    expect(out.status).toBe(409);
  });

  it('액션 초당 10회 제한', async () => {
    const g = new Game();
    await g.start();
    const seat = await g.turn();
    let limited: Out<unknown> | null = null;
    g.deps.limiter.reset();
    for (let i = 0; i < 12; i++) {
      const o = await actionFlow(g.deps, g.code, g.id(seat), { actionId: `rl${i}`, type: 'taunt', tauntId: 1 });
      if (errOf(o).error === 'RATE_LIMITED') limited = o;
    }
    expect(limited).not.toBeNull();
  });
});

describe('feedback', () => {
  it('참가자만, 매치·사람당 1건, 방 번호와 매치가 맞아야 함', async () => {
    const g = new Game();
    await g.start();
    const raw = await g.raw();
    const matchId = raw.game!.matchId;
    const f = await feedbackFlow(g.deps, g.A, { type: 'feedback', code: g.code, matchId, laugh: 'some' });
    expect((f.body as { ok: boolean }).ok).toBe(true);
    await feedbackFlow(g.deps, g.A, { type: 'feedback', code: g.code, matchId, laugh: 'lol' });
    const rows = (g.m.store as unknown as { events: { type: string }[] }).events.filter((e) => e.type === 'feedback');
    expect(rows).toHaveLength(1);
    expect(errOf(await feedbackFlow(g.deps, ident('c'), { type: 'feedback', code: g.code, matchId, laugh: 'some' })).error).toBe('ROOM_NOT_FOUND');
    expect(errOf(await feedbackFlow(g.deps, g.A, { type: 'feedback', code: g.code, matchId: uuid(999), laugh: 'some' })).error).toBe('ROOM_NOT_FOUND');
    expect((await feedbackFlow(g.deps, g.A, { type: 'transport', code: null, bell: true })).status).toBe(200);
  });
});

describe('지표·매치 기록', () => {
  it('판 시작·종료가 매치 행과 이벤트로 남고 is_test가 붙는다', async () => {
    const g = new Game();
    await g.start();
    const raw = await g.raw();
    const m = await g.m.store.getMatch(raw.game!.matchId);
    expect(m).toMatchObject({ seq: 1, isTest: true, endedAt: null });
    await g.act(0, { type: 'resign' });
    const m2 = await g.m.store.getMatch(raw.game!.matchId);
    expect(m2).toMatchObject({ endReason: 'resign', winnerSeat: 1 });
    const types = (g.m.store as unknown as { events: { type: string; isTest: boolean }[] }).events.map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(['room_created', 'room_joined', 'match_started', 'match_ended']));
    expect((g.m.store as unknown as { events: { isTest: boolean }[] }).events.every((e) => e.isTest)).toBe(true);
  });
});
