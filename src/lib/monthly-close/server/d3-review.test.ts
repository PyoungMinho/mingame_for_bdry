/**
 * D3 통합 리뷰(백엔드팀장)에서 찾은 버그의 재현 테스트. 기록: docs/backend/monthly-close-d3-review.md
 *  R1 검산 배달 기록 누락 경로(join·액션 거부)로 받은 검산을 2초 안에 답하면 경과 0ms로 이긴다
 *  R2 경보 무보고 판정을 늦게 하면 판정 창 끝에 접속 중이던 사람이 '제외'로 빠진다
 *  R3 손님 자리 행 삭제가 실패하면 그 방은 영영 ROOM_FULL
 *  R4 비밀키는 공짜로 바꿀 수 있어서 키당 제한만으로는 방 번호 무차별 대입을 못 막는다(IP 메모리 제한)
 *  R5 재입장(join)에 일반 요청 제한이 없다
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ALARM_REPORT_WAIT_MS, PRESENCE_MS } from '../constants';
import { advance, applyAction, createRoomState, joinSeat, markDelivered, reportAlarm } from '../engine/core';
import { randomFleet } from '../engine/placement';
import { viewFor } from '../engine/project';
import { emptyCells, FLEET0, FLEET1, bothFresh, ctxOf, fresh, missTurn, mkClock, playing } from '../engine/testkit';
import { seededRng } from '../engine/rng';
import type { RoomState } from '../engine/types';
import type { ApiErr, RoomView, Seat } from '../protocol';
import { hashKey, type Identity } from './auth';
import { actionFlow, createRoomFlow, joinFlow, syncFlow, type Out, type PipelineDeps } from './pipeline';
import { RateLimiter } from './rate';
import { MemoryStore } from './store-memory';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ident = (c: string, ip = '9.9.9.9'): Identity => ({ keyHash: hashKey(c.repeat(32)), isTest: true, ip });
const hexKey = (n: number) => n.toString(16).padStart(32, '0');

function mkDeps(store: MemoryStore = new MemoryStore()) {
  const t = { now: 50_000_000 };
  let n = 0;
  let code = 20000;
  const deps: PipelineDeps = {
    store,
    env: 'development',
    now: () => t.now,
    rng: seededRng(77),
    newId: () => uuid(++n),
    randomCode: () => String(++code),
    bell: async () => undefined,
    limiter: new RateLimiter(),
  };
  return { deps, store, t };
}

const okBody = <T>(out: Out<T>) => {
  const b = out.body as { ok: boolean };
  if (!b.ok) throw new Error(`expected ok, got ${(out.body as ApiErr).error} ${(out.body as ApiErr).reason ?? ''}`);
  return out.body as Extract<T, { ok: true }>;
};
const errOf = (out: Out<unknown>) => out.body as ApiErr;

class G {
  readonly m: ReturnType<typeof mkDeps>;
  readonly A = ident('a');
  readonly B = ident('b');
  code = '';
  private aid = 0;
  constructor(store?: MemoryStore) {
    this.m = mkDeps(store);
  }
  get deps() {
    return this.m.deps;
  }
  id(seat: Seat) {
    return seat === 0 ? this.A : this.B;
  }
  async create(alarmOn = false) {
    this.code = okBody(await createRoomFlow(this.deps, this.A, { nickname: '가나', industry: 0, alarmOn })).code;
  }
  async join(who: Identity = this.B) {
    this.deps.limiter.reset();
    return joinFlow(this.deps, this.code, who, { nickname: '다라', industry: 1 });
  }
  async sync(seat: Seat, view: 'game' | 'disguise' = 'game') {
    this.deps.limiter.reset();
    return syncFlow(this.deps, this.code, this.id(seat), { knownVersion: -1, view });
  }
  async act(seat: Seat, body: Record<string, unknown>) {
    this.deps.limiter.reset();
    return actionFlow(this.deps, this.code, this.id(seat), { actionId: `d3-${++this.aid}`, ...body });
  }
  async raw(): Promise<RoomState> {
    return (await this.m.store.load(this.code, this.m.t.now))!.room.state as unknown as RoomState;
  }
  async start() {
    await this.create();
    okBody(await this.join());
    okBody(await this.act(0, { type: 'place', ships: FLEET0, confirm: true }));
    okBody(await this.act(1, { type: 'place', ships: FLEET1, confirm: true }));
  }
  /** 차례인 사람이 미스 한 발(두 사람 다 직전에 sync해 접속 중) */
  async miss() {
    await this.sync(0);
    await this.sync(1);
    const raw = await this.raw();
    const seat = raw.game!.turn;
    const fired = raw.game!.shots[seat].map((x) => x.cell);
    const cell = emptyCells(seat === 0 ? FLEET1 : FLEET0).find((c) => !fired.includes(c))!;
    this.m.t.now += 1000;
    okBody(await this.act(seat, { type: 'fire', cell }));
  }
}

// ─── R1 ──────────────────────────────────────────────────────────────────────

describe('R1 검산 배달 기록: 화면에 실린 검산은 반드시 배달 시각이 기록된다', () => {
  async function toQuiz() {
    const g = new G();
    await g.start();
    for (let i = 0; i < 12 && !(await g.raw()).game?.quiz; i++) await g.miss();
    const raw = await g.raw();
    expect(raw.game!.phase).toBe('quiz');
    return { g, raw };
  }

  it('재입장(join) 응답에 검산이 실리면 그 시각을 배달 시각으로 저장한다 → 2초 안에 답해도 경과 0ms가 아니다', async () => {
    const { g, raw } = await toQuiz();
    const q = raw.game!.quiz!;
    const ans = raw.secret.quiz!.answer;
    const early = (q.deliveredAt[0] !== null ? 0 : 1) as Seat; // 발사한 사람(이미 배달됨)
    const late = (early === 0 ? 1 : 0) as Seat;
    expect(q.deliveredAt[late]).toBeNull();
    const t = g.m.t;

    t.now = q.issuedAt + 100;
    const j = okBody(await g.join(g.id(late)));
    expect(j.view.status === 'playing' && j.view.game.quiz).toBeTruthy();
    expect((await g.raw()).game!.quiz!.deliveredAt[late]).toBe(q.issuedAt + 100);

    t.now = q.issuedAt + 1500;
    okBody(await g.act(early, { type: 'answer', quizId: q.id, value: ans })); // 경과 1500 → 확정 시각 = 배달(+100) + 1700
    t.now = q.issuedAt + 1900;
    // late의 경과는 1800(차 300 > 200)이라 이미 확정 창이 지났다. 수정 전에는 배달 기록이 없어 경과 0ms로 late가 이겼다
    expect(errOf(await g.act(late, { type: 'answer', quizId: q.id, value: ans }))).toMatchObject({ error: 'INVALID', reason: 'quiz_stale' });
    const settled = (await g.raw()).events.find((e) => e.type === 'quizSettled') as unknown as { awarded: Seat[] };
    expect(settled.awarded).toEqual([early]);
  });

  it('액션이 거부돼도 그 응답에 검산이 실렸으면 배달 시각을 저장한다', async () => {
    const { g, raw } = await toQuiz();
    const q = raw.game!.quiz!;
    const late = (q.deliveredAt[0] !== null ? 1 : 0) as Seat;
    g.m.t.now = q.issuedAt + 300;
    const out = await g.act(late, { type: 'fire', cell: 'H8' }); // 검산 중 발사 → WRONG_PHASE
    expect(errOf(out).error).toBe('WRONG_PHASE');
    const v = errOf(out).view as RoomView;
    expect(v.status === 'playing' && v.game.quiz).toBeTruthy();
    expect((await g.raw()).game!.quiz!.deliveredAt[late]).toBe(q.issuedAt + 300);
  });

  it('엔진 방어: 배달 기록 없이 도착한 답은 출제 시각부터 잰다(경과 0 금지)', () => {
    const c = mkClock(9);
    c.presence = bothFresh(c.now);
    let s = playing(c);
    while (!s.game!.quiz) {
      c.presence = bothFresh(c.now);
      s = missTurn(c, s);
    }
    const q = s.game!.quiz!;
    s = markDelivered(s, 0, { ...ctxOf(c), now: q.issuedAt }).state;
    c.now = q.issuedAt + 1200;
    const r = applyAction(s, 1, { actionId: 'x', type: 'answer', quizId: q.id, value: s.secret.quiz!.answer }, ctxOf(c));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.game!.quiz!.elapsedMs[1]).toBe(1200);
  });
});

// ─── R2 ──────────────────────────────────────────────────────────────────────

describe('R2 경보 무보고 판정은 판정 창 끝 시점의 접속으로 본다', () => {
  function toAlarm() {
    const c = mkClock(11);
    c.presence = bothFresh(c.now);
    let s = playing(c, { alarmOn: true });
    s.secret.alarmRound = 2;
    while (!s.game!.alarm) {
      c.presence = bothFresh(c.now);
      s = missTurn(c, s);
    }
    return { c, s };
  }

  it('창 끝(issuedAt+10초) 1초 전까지 접속 중이던 무보고자는, 판정이 30초 뒤에 돌아도 실패', () => {
    const { c, s: s0 } = toAlarm();
    const at = s0.game!.alarm!.issuedAt;
    let s = reportAlarm(s0, 0, { issuedAt: at, reactionMs: 500 }, ctxOf(c)).state;
    c.now = at + 30_000;
    c.presence = [fresh(c.now), fresh(at + ALARM_REPORT_WAIT_MS - 1000)];
    s = advance(s, ctxOf(c)).state;
    expect(s.events.find((e) => e.type === 'alarmResult')).toMatchObject({ outcomes: ['pass', 'fail'] });
  });

  it('창 끝 기준으로 PRESENCE_MS 넘게 끊겨 있었으면 제외(기존 동작 유지)', () => {
    const { c, s: s0 } = toAlarm();
    const at = s0.game!.alarm!.issuedAt;
    let s = reportAlarm(s0, 0, { issuedAt: at, reactionMs: 500 }, ctxOf(c)).state;
    c.now = at + ALARM_REPORT_WAIT_MS;
    c.presence = [fresh(c.now), fresh(c.now - PRESENCE_MS - 1)];
    s = advance(s, ctxOf(c)).state;
    expect(s.events.find((e) => e.type === 'alarmResult')).toMatchObject({ outcomes: ['pass', 'excluded'] });
  });
});

// ─── R3 ──────────────────────────────────────────────────────────────────────

class FlakyRemoveStore extends MemoryStore {
  failRemoves = 0;
  override async removePlayer(roomId: string, seat: Seat, onlyKey?: string): Promise<void> {
    if (this.failRemoves > 0) {
      this.failRemoves -= 1;
      throw new Error('network');
    }
    return super.removePlayer(roomId, seat, onlyKey);
  }
}

describe('R3 손님 자리 행이 남아도(삭제 실패) 다음 사람이 들어올 수 있다', () => {
  it('배치 중 손님이 나가고 행 삭제가 실패 → 새 손님 입장 성공', async () => {
    const store = new FlakyRemoveStore();
    const g = new G(store);
    await g.create();
    okBody(await g.join());
    store.failRemoves = 1;
    expect(errOf(await g.act(1, { type: 'leave' })).error).toBe('NOT_JOINED'); // R6: 나간 뒤에는 자리 없음
    expect((await store.load(g.code, g.m.t.now))!.players[1]).not.toBeNull(); // 남은 행
    g.m.t.now += PRESENCE_MS + 1000;
    const C = ident('c');
    const j = await g.join(C);
    expect(okBody(j)).toMatchObject({ seat: 1, rejoined: false });
    const snap = (await store.load(g.code, g.m.t.now))!;
    expect(snap.players[1]!.playerKey).toBe(C.keyHash);
  });

  it('방금 들어온(접속 신호가 최신인) 행은 지우지 않는다 — 동시 입장 경합은 그대로 ROOM_FULL', async () => {
    const g = new G();
    await g.create();
    const snap = (await g.m.store.load(g.code, g.m.t.now))!;
    // 다른 사람이 행만 넣고 상태 저장 직전인 상황
    const X = ident('e');
    await g.m.store.addPlayer({ roomId: snap.room.id, seat: 1, playerKey: X.keyHash, nickname: '마', industry: 0 }, g.m.t.now);
    g.m.t.now += 500;
    const j = await g.join(ident('c'));
    expect(errOf(j).error).toBe('ROOM_FULL');
    expect((await g.m.store.load(g.code, g.m.t.now))!.players[1]!.playerKey).toBe(X.keyHash);
  });
});

// ─── R4·R5 ───────────────────────────────────────────────────────────────────

describe('R4 방 번호 무차별 대입: 같은 IP의 접근 실패는 키를 바꿔도 센다', () => {
  it('키 100개로 없는 방을 두드리면 IP 단위로 RATE_LIMITED', async () => {
    const { deps } = mkDeps();
    const seen: string[] = [];
    for (let i = 0; i < 100; i++) {
      const who: Identity = { keyHash: hashKey(hexKey(i + 1)), isTest: false, ip: '1.2.3.4' };
      const out = i % 2 ? await joinFlow(deps, String(30000 + i), who, { nickname: '가', industry: 0 }) : await syncFlow(deps, String(30000 + i), who, { knownVersion: -1, view: 'game' });
      seen.push(errOf(out).error);
    }
    expect(seen).toContain('RATE_LIMITED');
    expect(seen.filter((e) => e === 'ROOM_NOT_FOUND').length).toBeLessThanOrEqual(60);
    // 다른 IP는 영향 없음
    const other: Identity = { keyHash: hashKey(hexKey(999)), isTest: false, ip: '5.6.7.8' };
    expect(errOf(await syncFlow(deps, '31111', other, { knownVersion: -1, view: 'game' })).error).toBe('ROOM_NOT_FOUND');
  });

  it('남의 방(꽉 참)·자리 없는 sync/action 실패도 같은 IP 버킷에 센다', async () => {
    const g = new G();
    await g.create();
    okBody(await g.join());
    let limited = false;
    for (let i = 0; i < 80 && !limited; i++) {
      const who: Identity = { keyHash: hashKey(hexKey(5000 + i)), isTest: false, ip: '7.7.7.7' };
      const out = await actionFlow(g.deps, g.code, who, { actionId: `x${i}`, type: 'resign' });
      limited = errOf(out).error === 'RATE_LIMITED';
    }
    expect(limited).toBe(true);
  });
});

describe('R5 재입장(join)도 비밀키당 요청 제한을 받는다', () => {
  it('같은 키로 join 연타 → RATE_LIMITED', async () => {
    const g = new G();
    await g.create();
    const codes: string[] = [];
    for (let i = 0; i < 40; i++) {
      const out = await joinFlow(g.deps, g.code, g.A, { nickname: '가나', industry: 0 });
      codes.push((out.body as { ok: boolean }).ok ? 'ok' : errOf(out).error);
    }
    expect(codes[0]).toBe('ok');
    expect(codes).toContain('RATE_LIMITED');
  });
});

// ─── R6 ──────────────────────────────────────────────────────────────────────

describe('R6 대기·배치 중 손님 나가기는 500 없이 끝난다', () => {
  it('leave → NOT_JOINED(자리 없음), 상태는 waiting으로 저장, 재전송도 NOT_JOINED, 방장 화면은 정상', async () => {
    const g = new G();
    await g.create();
    okBody(await g.join());
    const out = await actionFlow(g.deps, g.code, g.B, { actionId: 'leave-1', type: 'leave' });
    expect(out.status).toBe(403);
    expect(errOf(out)).toMatchObject({ ok: false, error: 'NOT_JOINED' });
    expect(errOf(out).view).toBeUndefined();
    expect((await g.raw()).status).toBe('waiting');
    expect((await g.raw()).seats[1]).toBeNull();
    expect(errOf(await actionFlow(g.deps, g.code, g.B, { actionId: 'leave-1', type: 'leave' })).error).toBe('NOT_JOINED');
    const host = okBody(await g.sync(0));
    expect(host.changed && host.view.status).toBe('waiting');
    // 같은 손님이 다시 들어올 수 있다
    expect(okBody(await g.join())).toMatchObject({ seat: 1, rejoined: false });
  });
});

// ─── 투영 보강(D3): 기존 1,000판 속성 테스트가 덮지 않던 두 구간 ─────────────────────

const PV = (s: RoomState, seat: Seat, now: number) =>
  viewFor(s, seat, { version: 3, serverNow: now, bellTopic: 'mc:x', oppLastSeenAt: now, oppHidden: false });

describe('투영 보강', () => {
  it('B3 비간섭: 내가 아직 풀이 중이면 상대가 맞혔든 틀렸든(경과·마감·잠금) 내 화면이 같다 — 300판', () => {
    let checked = 0;
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 30 }), (seed) => {
        const c = mkClock(seed);
        c.presence = bothFresh(c.now);
        let s = playing(c, { fleets: [randomFleet(seededRng(seed)), randomFleet(seededRng(seed + 1))] });
        while (!s.game!.quiz && s.status === 'playing') {
          c.presence = bothFresh(c.now);
          s = missTurn(c, s);
        }
        if (!s.game?.quiz) return;
        for (const seat of [0, 1] as const) s = markDelivered(s, seat, ctxOf(c)).state;
        c.now += 1500;
        for (const me of [0, 1] as const) {
          const o = (me === 0 ? 1 : 0) as Seat;
          const base = JSON.stringify(PV(s, me, c.now));
          for (const mut of ['correct', 'expired', 'locked'] as const) {
            const m = structuredClone(s);
            if (mut === 'correct') m.game!.quiz!.elapsedMs[o] = 1400;
            if (mut === 'expired') m.game!.quiz!.expired[o] = true;
            if (mut === 'locked') m.seats[o]!.quizLockUntil = c.now + 2000;
            expect(JSON.stringify(PV(m, me, c.now)), `${mut}`).toBe(base);
            checked++;
          }
        }
      }),
      { numRuns: 300 },
    );
    expect(checked).toBeGreaterThan(1000);
  });

  it('배치 단계: 상대의 초안·완료 배치는 화면 어디에도 없다(placed 표시만) — 300판', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 30 }), fc.boolean(), (seed, confirm) => {
        const c = mkClock(seed);
        let s = createRoomState({ code: '12345', keyHash: 'a'.repeat(64), nickname: '가', industry: 0, alarmOn: true });
        const j = joinSeat(s, { keyHash: 'b'.repeat(64), nickname: '나', industry: 1 }, ctxOf(c));
        if (!j.ok) throw new Error('join');
        s = j.stepped.state;
        const rng = seededRng(seed);
        const draft = randomFleet(rng).slice(0, confirm ? 3 : 1 + Math.floor(rng() * 3));
        const r = applyAction(s, 0, { actionId: 'p', type: 'place', ships: draft, confirm: confirm && draft.length === 3 }, ctxOf(c));
        if (!r.ok) throw new Error(r.error);
        s = r.state;
        expect(s.status).toBe('placing');
        const guest = PV(s, 1, c.now);
        const json = JSON.stringify(guest);
        for (const p of draft) {
          const mine = s.secret.boards[1].some((q) => q.slot === p.slot && q.start === p.start && q.dir === p.dir);
          if (!mine) expect(json).not.toContain(`"slot":"${p.slot}","start":"${p.start}","dir":"${p.dir}"`);
        }
        expect(guest.status === 'placing' && guest.opp.placed).toBe(confirm && draft.length === 3);
        expect(json).not.toContain('a'.repeat(64));
      }),
      { numRuns: 300 },
    );
  });
});
