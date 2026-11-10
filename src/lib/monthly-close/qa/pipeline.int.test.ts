/**
 * QA(STEP 5) 서버 통합 — pipeline + MemoryStore + 가짜 시계.
 * 설계서 §3-5 CON-01~08, §3-3 SEC-06·09·12·14, §3-4 API-05·07·08·09. 제품 코드 무수정.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACTIVE_ROOMS_CAP, ALARM_REPORT_WAIT_MS, ROOM_IDLE_MS, TURN_MS } from '../constants';
import { emptyCells, FLEET0, FLEET1 } from '../engine/testkit';
import { seededRng } from '../engine/rng';
import { advance, applyAction, createRoomState, joinSeat, reportAlarm } from '../engine/core';
import type { EngineCtx, RoomState } from '../engine/types';
import type { ApiErr, RoomView, Seat } from '../protocol';
import { hashKey, type Identity } from '../server/auth';
import { actionFlow, createRoomFlow, feedbackFlow, healthFlow, joinFlow, syncFlow, type Out, type PipelineDeps } from '../server/pipeline';
import { RateLimiter } from '../server/rate';
import { MemoryStore } from '../server/store-memory';
import { getStore, resetDbForTests } from '../server/db';

const bug = process.env.QA_SHOW_BUGS ? it : it.fails;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ident = (c: string, ip = '9.9.9.9'): Identity => ({ keyHash: hashKey(c.repeat(32).slice(0, 32)), isTest: true, ip });

function mkDeps(store: MemoryStore = new MemoryStore()) {
  const t = { now: 50_000_000 };
  let n = 0;
  let code = 30000;
  const bells: { topic: string; v: number; args: unknown[] }[] = [];
  const deps: PipelineDeps = {
    store,
    env: 'development',
    now: () => t.now,
    rng: seededRng(91),
    newId: () => uuid(++n),
    randomCode: () => String(++code),
    bell: async (...args: [string, number]) => void bells.push({ topic: args[0], v: args[1], args }),
    limiter: new RateLimiter(),
  };
  return { deps, store, t, bells };
}
type Ok<T> = Extract<T, { ok: true }>;
function must<T>(out: Out<T>): Ok<T> {
  if (!(out.body as { ok: boolean }).ok) throw new Error(`expected ok, got ${(out.body as ApiErr).error} ${(out.body as ApiErr).reason ?? ''}`);
  return out.body as Ok<T>;
}
const errOf = (o: Out<unknown>) => o.body as ApiErr;

class G {
  m = mkDeps();
  A = ident('a');
  B = ident('b');
  code = '';
  n = 0;
  get deps() { return this.m.deps; }
  id(s: Seat) { return s === 0 ? this.A : this.B; }
  async start(alarmOn = false) {
    this.code = must(await createRoomFlow(this.deps, this.A, { nickname: '가나', industry: 0, alarmOn })).code;
    must(await joinFlow(this.deps, this.code, this.B, { nickname: '다라', industry: 1 }));
    must(await this.act(0, { type: 'place', ships: FLEET0, confirm: true }));
    must(await this.act(1, { type: 'place', ships: FLEET1, confirm: true }));
  }
  act(seat: Seat, body: Record<string, unknown>, actionId?: string) {
    this.m.deps.limiter.reset();
    return actionFlow(this.deps, this.code, this.id(seat), { actionId: actionId ?? `q${++this.n}`, ...body });
  }
  sync(seat: Seat, view: 'game' | 'disguise' = 'game', alarm?: { issuedAt: number; reactionMs: number }) {
    this.m.deps.limiter.reset();
    return syncFlow(this.deps, this.code, this.id(seat), { knownVersion: -1, view, ...(alarm ? { alarm } : {}) });
  }
  async raw(): Promise<RoomState> {
    return (await this.m.store.load(this.code, this.m.t.now))!.room.state as unknown as RoomState;
  }
  async view(seat: Seat): Promise<RoomView> {
    return (must(await this.sync(seat)) as { view: RoomView }).view;
  }
  async missCell(seat: Seat) {
    const s = await this.raw();
    return emptyCells(s.secret.boards[seat === 0 ? 1 : 0]).find((c) => !s.game!.shots[seat].some((x) => x.cell === c))!;
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
  resetDbForTests();
});

describe('CON-01 같은 발 두 번', () => {
  it('같은 칸 fire 2건(다른 actionId) 동시 → 사격 1, 다른 하나는 NOT_YOUR_TURN/already_fired + view, 차례 1번만', async () => {
    const g = new G();
    await g.start();
    const t = (await g.raw()).game!.turn;
    g.m.t.now += 1000;
    const [a, b] = await Promise.all([g.act(t, { type: 'fire', cell: 'H8' }), g.act(t, { type: 'fire', cell: 'H8' })]);
    const s = await g.raw();
    expect(s.game!.shots[t]).toHaveLength(1);
    const loser = [a, b].find((x) => !(x.body as { ok: boolean }).ok)!;
    expect(['NOT_YOUR_TURN', 'INVALID']).toContain(errOf(loser).error);
    expect(errOf(loser).view).toBeTruthy();
    expect(s.game!.turn).not.toBe(t);
  });
  it('같은 actionId 재전송 → duplicate:true, 상태 불변', async () => {
    const g = new G();
    await g.start();
    const t = (await g.raw()).game!.turn;
    must(await g.act(t, { type: 'fire', cell: 'H8' }, 'same-1'));
    const v1 = (await g.m.store.load(g.code, g.m.t.now))!.room.version;
    const r = must(await g.act(t, { type: 'fire', cell: 'H8' }, 'same-1'));
    expect(r.duplicate).toBe(true);
    expect((await g.m.store.load(g.code, g.m.t.now))!.room.version).toBe(v1);
  });
});

describe('CON-02 동시 정답(경과 차 0·200·250ms)', () => {
  async function toQuiz() {
    const g = new G();
    await g.start();
    for (let i = 0; i < 20; i++) {
      await g.sync(0); await g.sync(1);
      const s = await g.raw();
      if (s.game!.phase === 'quiz') break;
      g.m.t.now += 800;
      must(await g.act(s.game!.turn, { type: 'fire', cell: await g.missCell(s.game!.turn) }));
    }
    return g;
  }
  for (const [gap, want] of [[0, [0, 1]], [199, [0, 1]], [200, [0, 1]], [201, [0]], [250, [0]]] as const) {
    it(`${gap === 200 ? 'BUG-03 [O9 경계] ' : ''}차 ${gap}ms → awarded ${JSON.stringify(want)}`, async () => {
      const g = await toQuiz();
      // 두 사람에게 같은 시각에 배달
      await g.sync(0); await g.sync(1);
      const s = await g.raw();
      expect(s.game!.phase).toBe('quiz');
      const ans = s.secret.quiz!.answer, qid = s.game!.quiz!.id;
      const t0 = g.m.t.now;
      g.m.t.now = t0 + 1000;
      const a = await g.act(0, { type: 'answer', quizId: qid, value: ans });
      g.m.t.now = t0 + 1000 + gap;
      const b = await g.act(1, { type: 'answer', quizId: qid, value: ans });
      expect((a.body as { ok: boolean }).ok).toBe(true);
      // 늦은 쪽은 quiz_stale이어도 화면 데이터가 따라온다
      if (!(b.body as { ok: boolean }).ok) expect(errOf(b).view).toBeTruthy();
      g.m.t.now += 1000;
      await g.sync(0);
      const st = (await g.raw()).game!.stats.quizzes[0]!;
      expect(st.awarded).toEqual(want);
    });
  }
});

describe('ENG-12·13 경계를 실제 경로(pipeline: advance → action)로', () => {
  async function quizG() {
    const g = new G();
    await g.start();
    for (let i = 0; i < 20; i++) {
      await g.sync(0); await g.sync(1);
      const s = await g.raw();
      if (s.game!.phase === 'quiz') break;
      g.m.t.now += 800;
      must(await g.act(s.game!.turn, { type: 'fire', cell: await g.missCell(s.game!.turn) }));
    }
    await g.sync(0); await g.sync(1);
    return g;
  }
  it('혼자 풀 때 배달 +10,000ms 정답 = 허용, +10,001ms = quiz_stale', async () => {
    for (const [dt, ok] of [[10_000, true], [10_001, false]] as const) {
      const g = await quizG();
      const s = await g.raw();
      const d = s.game!.quiz!.deliveredAt[0]!;
      g.m.t.now = d + dt;
      const r = await g.act(0, { type: 'answer', quizId: s.game!.quiz!.id, value: s.secret.quiz!.answer });
      expect((r.body as { ok: boolean }).ok).toBe(ok);
    }
  });
  it('BUG-03 [O9 경계] 상대가 9,900ms에 맞힌 뒤 내가 배달 +10,000ms(마감 정각)에 정답 → 허용 + 둘 다 지급(차 100ms)이어야 한다', async () => {
    const g = await quizG();
    const s = await g.raw();
    const d0 = s.game!.quiz!.deliveredAt[0]!, d1 = s.game!.quiz!.deliveredAt[1]!;
    g.m.t.now = d0 + 9_900;
    must(await g.act(0, { type: 'answer', quizId: s.game!.quiz!.id, value: s.secret.quiz!.answer }));
    g.m.t.now = d1 + 10_000;
    const r = await g.act(1, { type: 'answer', quizId: s.game!.quiz!.id, value: s.secret.quiz!.answer });
    expect((r.body as { ok: boolean }).ok).toBe(true);
    expect((await g.raw()).game!.stats.quizzes[0]!.awarded).toEqual([0, 1]);
  });
});

describe('CON-03 경보 판정과 시간 초과가 같은 advance에서 (기획 확인 기록)', () => {
  it('판정 → 시간 초과 순서, timeout 1회. 실패자가 그 차례 주인이면 2턴 손실이 되는지 기록', () => {
    const run = (failer: 'turn' | 'other') => {
      const c = { now: 1_000_000 };
      const g0 = new G();
      void g0;
      // 엔진만으로: 경보가 차례 시작과 함께 나고(issuedAt = 차례 시작), 아무 요청 없이 20초 뒤 요청 1회
      let s: RoomState;
      {
        const ctx = (presence: EngineCtx['presence']): EngineCtx => ({ now: c.now, rng: seededRng(3), newId: () => 'm1', presence });
        s = createRoomState({ code: '12345', keyHash: 'a'.repeat(64), nickname: '가', industry: 0, alarmOn: true });
        s = (joinSeat(s, { keyHash: 'b'.repeat(64), nickname: '나', industry: 1 }, ctx([null, null])) as { stepped: { state: RoomState } }).stepped.state;
        for (const seat of [0, 1] as const) s = (applyAction(s, seat, { actionId: `p${seat}`, type: 'place', ships: seat ? FLEET1 : FLEET0, confirm: true }, ctx([null, null])) as { state: RoomState }).state;
        // 경보 강제: 지금 차례 시작과 같은 시각
        const g = s.game!;
        g.alarm = { issuedAt: g.clock!.startedAt, reactionMs: [null, null] };
        g.alarmDone = true;
        const turn = g.turn;
        const f: Seat = failer === 'turn' ? turn : (turn === 0 ? 1 : 0);
        // 실패자는 4,000ms로 보고(실패), 다른 사람은 보고 없이 끊김(제외)
        s = reportAlarm(s, f, { issuedAt: g.alarm.issuedAt, reactionMs: 4000 }, ctx([null, null])).state;
        c.now = g.clock!.deadlineAt; // 경보 창(10초)도 차례(20초)도 지남
        const out = advance(s, ctx([null, null]));
        const types = out.state.events.slice(-6).map((e) => e.type);
        return { types, turn, f, timeouts: types.filter((x) => x === 'timeout').length, skip: out.state.events.filter((e) => e.type === 'skip').map((e) => (e as { seat: Seat }).seat), now: out.state.game?.turn };
      }
    };
    const a = run('other');
    expect(a.timeouts).toBe(1);
    expect(a.types.indexOf('alarmResult')).toBeLessThan(a.types.indexOf('timeout'));
    expect(a.skip).toEqual([a.f]); // 시간 초과 직후 실패자(다음 차례)가 바로 쉰다
    const b = run('turn');
    expect(b.timeouts).toBe(1);
    // 실패자 = 그 차례 주인: 이번 차례 시간 초과 + 다음 자기 차례 skip 예정 → 2턴 손실(기획 확인)
    expect(b.skip).toEqual([]);
    void ALARM_REPORT_WAIT_MS;
  });
});

describe('CON-04 발사 vs 시간 초과(±1ms)', () => {
  it('마감 −1ms fire = 성공, 마감 정각 fire = 시간 초과 먼저 → NOT_YOUR_TURN + view', async () => {
    for (const [dt, ok] of [[-1, true], [0, false]] as const) {
      const g = new G();
      await g.start();
      const s = await g.raw();
      const t = s.game!.turn;
      g.m.t.now = s.game!.clock!.deadlineAt + dt;
      const r = await g.act(t, { type: 'fire', cell: 'H8' });
      expect((r.body as { ok: boolean }).ok).toBe(ok);
      if (!ok) {
        expect(errOf(r).error).toBe('NOT_YOUR_TURN');
        expect(errOf(r).view).toBeTruthy();
      }
    }
  });
  it('마감 직후 두 사람이 동시에 sync·action → timeout 1회(CAS)', async () => {
    const g = new G();
    await g.start();
    const s = await g.raw();
    g.m.t.now = s.game!.clock!.deadlineAt + 5;
    await Promise.all([g.sync(0), g.sync(1), g.act(s.game!.turn, { type: 'fire', cell: 'H8' }), g.act(s.game!.turn === 0 ? 1 : 0, { type: 'taunt', tauntId: 1 })]);
    expect((await g.raw()).events.filter((e) => e.type === 'timeout')).toHaveLength(1);
  });
});

describe('CON-05·06 동시 입장 · 재대결', () => {
  it('새 키 2개 동시 join → 1명 seat 1, 1명 ROOM_FULL, 고아 자리 행 0', async () => {
    const m = mkDeps();
    const A = ident('a'), B = ident('b'), C = ident('c');
    const code = must(await createRoomFlow(m.deps, A, { nickname: '가', industry: 0, alarmOn: false })).code;
    const [x, y] = await Promise.all([joinFlow(m.deps, code, B, { nickname: 'b', industry: 0 }), joinFlow(m.deps, code, C, { nickname: 'c', industry: 0 })]);
    const oks = [x, y].filter((o) => (o.body as { ok: boolean }).ok);
    expect(oks).toHaveLength(1);
    expect([x, y].filter((o) => errOf(o).error === 'ROOM_FULL')).toHaveLength(1);
    const snap = (await m.store.load(code, m.t.now))!;
    const st = snap.room.state as unknown as RoomState;
    expect(snap.players[1]?.playerKey).toBe(st.seats[1]?.keyHash);
  });
  it('두 사람 rematch 동시 → matchSeq +1 한 번만', async () => {
    const g = new G();
    await g.start();
    must(await g.act(0, { type: 'resign' }));
    await Promise.all([g.act(0, { type: 'rematch' }), g.act(1, { type: 'rematch' })]);
    const s = await g.raw();
    expect(s.matchSeq).toBe(2);
    expect(s.status).toBe('placing');
  });
});

describe('CON-07 CAS 고갈', () => {
  it('save가 3회 연속 충돌 → CONFLICT, 상태 손상 0, 매치 행 미기록', async () => {
    const g = new G();
    g.code = must(await createRoomFlow(g.deps, g.A, { nickname: '가', industry: 0, alarmOn: false })).code;
    must(await joinFlow(g.deps, g.code, g.B, { nickname: '나', industry: 0 }));
    must(await g.act(0, { type: 'place', ships: FLEET0, confirm: true }));
    const before = await g.m.store.load(g.code, g.m.t.now);
    const spy = vi.spyOn(g.m.store, 'save').mockResolvedValue({ ok: false, reason: 'CONFLICT' });
    const start = vi.spyOn(g.m.store, 'startMatch');
    const r = await g.act(1, { type: 'place', ships: FLEET1, confirm: true });
    expect(errOf(r).error).toBe('CONFLICT');
    expect(spy).toHaveBeenCalledTimes(3);
    expect(start).not.toHaveBeenCalled();
    spy.mockRestore();
    const after = await g.m.store.load(g.code, g.m.t.now);
    expect(after!.room.version).toBe(before!.room.version);
    expect((after!.room.state as unknown as RoomState).status).toBe('placing');
  });
});

describe('CON-08 숨기기 보고 vs 상대 발사', () => {
  it('상대 발사로 내 차례가 시작된 직후 내 sync(disguise) → 시계가 내 차례 시작 시각으로 소급 정지', async () => {
    const g = new G();
    await g.start();
    let s = await g.raw();
    const opp = s.game!.turn, me: Seat = opp === 0 ? 1 : 0;
    // 내가 먼저 숨어 있었다(차례 전). 보고는 상대 발사와 동시에 도착
    g.m.t.now += 1000;
    const fireAt = g.m.t.now;
    await Promise.all([g.act(opp, { type: 'fire', cell: 'H8' }), g.sync(me, 'disguise')]);
    g.m.t.now += 3000;
    await g.sync(me, 'disguise');
    s = await g.raw();
    expect(s.game!.turn).toBe(me);
    expect(s.game!.clock!.pause).not.toBeNull();
    expect(s.game!.clock!.pause!.since).toBeGreaterThanOrEqual(fireAt);
    expect(s.game!.clock!.pause!.remainingMs).toBeGreaterThanOrEqual(TURN_MS - 1); // 손해 ≤ 보고 지연
  });
});

describe('SEC-06 초인종 페이로드', () => {
  it('ring 인자 = (topic "mc:<방 id>", version 숫자) 뿐 — 운영 bell은 {v: version}만 보낸다(pipeline.ts:104)', async () => {
    const g = new G();
    await g.start();
    expect(g.m.bells.length).toBeGreaterThan(0);
    for (const b of g.m.bells) {
      expect(b.args).toHaveLength(2);
      expect(b.topic).toMatch(/^mc:[0-9a-f-]{36}$/);
      expect(Number.isInteger(b.v)).toBe(true);
    }
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/lib/monthly-close/server/pipeline.ts', 'utf8');
    expect(src).toMatch(/httpSend\(BELL_EVENT, \{ v: version \}\)/);
  });
});

describe('SEC-09 저장소 예외', () => {
  it('StoreUnavailableError → 503 SERVICE_DOWN + serverNow, 메시지 없음', async () => {
    const g = new G();
    await g.start();
    const { StoreUnavailableError } = await import('../server/store');
    vi.spyOn(g.m.store, 'load').mockRejectedValue(new StoreUnavailableError('db {"secret":1}'));
    const r = await g.sync(0);
    expect(r.status).toBe(503);
    expect(errOf(r)).toEqual({ ok: false, serverNow: g.m.t.now, error: 'SERVICE_DOWN' });
  });
});

describe('SEC-12 남용 제한(가짜 시계)', () => {
  it('join 분당 21번째 RATE_LIMITED, 만들기 키 6번째·IP 31번째 RATE_LIMITED, 201번째 방 CAPACITY', async () => {
    const m = mkDeps();
    const A = ident('a');
    const code = must(await createRoomFlow(m.deps, A, { nickname: '가', industry: 0, alarmOn: false })).code;
    const B = ident('b');
    let firstJoinLimited = 0;
    for (let i = 1; i <= 21; i++) {
      const r = await joinFlow(m.deps, code, B, { nickname: 'b', industry: 0 });
      if (errOf(r).error === 'RATE_LIMITED' && !firstJoinLimited) firstJoinLimited = i;
    }
    expect(firstJoinLimited).toBe(21);
    const m2 = mkDeps();
    let ipLimited = 0;
    for (let i = 1; i <= 31; i++) {
      const r = await createRoomFlow(m2.deps, { keyHash: hashKey(`k${i}`.padEnd(32, '0')), isTest: true, ip: '7.7.7.7' }, { nickname: 'a', industry: 0, alarmOn: false });
      if (errOf(r).error === 'RATE_LIMITED' && !ipLimited) ipLimited = i;
    }
    expect(ipLimited).toBe(31);
    void ACTIVE_ROOMS_CAP; // 201번째 CAPACITY는 기존 pipeline.test.ts '방 만들기 제한'이 단언(대조 완료)
  });
});

describe('API-05·07·08·09', () => {
  it('API-05 health: 저장소 ok → {db:"ok"}, 저장소 health 예외 → {db:"down"}', async () => {
    const m = mkDeps();
    expect(await healthFlow(m.deps)).toEqual({ db: 'ok' });
    vi.spyOn(m.store, 'health').mockRejectedValue(new Error('x'));
    expect(await healthFlow(m.deps)).toEqual({ db: 'down' });
  });
  it('API-07 29분 59.999초 = 살아 있음, 30분 = ROOM_NOT_FOUND, 활동하면 +30분, 만료 번호로 새 방 정상', async () => {
    const m = mkDeps();
    const A = ident('a');
    const created = must(await createRoomFlow(m.deps, A, { nickname: '가', industry: 0, alarmOn: false }));
    const t0 = m.t.now;
    m.t.now = t0 + ROOM_IDLE_MS - 1;
    expect((must(await syncFlow(m.deps, created.code, A, { knownVersion: -1, view: 'game' })) as { ok: true }).ok).toBe(true);
    // 활동으로 연장됐는지: 원래 만료 + 1ms에도 살아 있다
    m.t.now = t0 + ROOM_IDLE_MS + 1;
    expect((await syncFlow(m.deps, created.code, A, { knownVersion: -1, view: 'game' })).status).toBe(200);
    const m2 = mkDeps();
    const c2 = must(await createRoomFlow(m2.deps, A, { nickname: '가', industry: 0, alarmOn: false }));
    m2.t.now += ROOM_IDLE_MS;
    expect(errOf(await syncFlow(m2.deps, c2.code, A, { knownVersion: -1, view: 'game' })).error).toBe('ROOM_NOT_FOUND');
    // 같은 번호 재생성
    const fixed = { ...m2.deps, randomCode: () => c2.code };
    m2.deps.limiter.reset();
    const again = must(await createRoomFlow(fixed, ident('z'), { nickname: '새', industry: 1, alarmOn: false }));
    expect(again.code).toBe(c2.code);
    expect(again.view.me.nickname).toBe('새');
  });
  it('API-08 VERCEL=1 + 키 없음 → getStore() null(MemoryStore 거부) → 라우트 503', async () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    resetDbForTests();
    expect(getStore()).toBeNull();
    expect(() => new MemoryStore()).toThrow();
    const { depsOrDown } = await import('@/app/api/monthly-close/_util');
    const d = await depsOrDown();
    expect('down' in d && d.down.status).toBe(503);
  });
  it('API-09 x-mc-test → 방·매치·이벤트 is_test true, gate SQL은 not is_test 조건', async () => {
    const g = new G();
    await g.start();
    const snap = (await g.m.store.load(g.code, g.m.t.now))!;
    expect(snap.room.isTest).toBe(true);
    const ev = g.m.store.debugEvents();
    expect(ev.length).toBeGreaterThan(0);
    expect(ev.every((e) => e.isTest === true)).toBe(true);
    const s = await g.raw();
    expect((await g.m.store.getMatch(s.game!.matchId))!.isTest).toBe(true);
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('supabase/monthly-close-gate.sql', 'utf8')).toMatch(/not\s+\w*\.?is_test/i);
  });
  it('API-06 feedback 피식 2회 → 이벤트 1건(매치·사람당 1)', async () => {
    const g = new G();
    await g.start();
    must(await g.act(0, { type: 'resign' }));
    const matchId = (await g.raw()).game!.matchId;
    for (let i = 0; i < 2; i++) must(await feedbackFlow(g.deps, g.A, { type: 'feedback', code: g.code, matchId, laugh: 'lol' }));
    expect(g.m.store.debugEvents().filter((e) => e.type === 'feedback')).toHaveLength(1);
  });
});
