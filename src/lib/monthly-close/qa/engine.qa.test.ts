/**
 * QA(STEP 5) 엔진 경계값·속성 — 설계서 §3-1 ENG-02~27(기존 테스트에 없는 ±1ms 경계와 속성 위주), §3-3 SEC-01 보강.
 * 시각은 가짜 시계(testkit Clock)만 쓴다. 제품 코드 무수정. 오라클이 모호한 것은 "기획 확인"으로 값만 기록한다.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ALARM_HIDE_MS, ALARM_REPORT_WAIT_MS, HIDE_BUDGET_MS, PLACE_MS, QUIZ_LOCK_MS, QUIZ_MS, REMATCH_WAIT_MS, TURN_MS,
} from '../constants';
import { ALL_CELLS, hintRange, placementCells, type CellAddr, type ShipPlacement } from '../coords';
import { VIEW_FORBIDDEN_KEYS, type Seat } from '../protocol';
import { advance, applyAction, createRoomState, joinSeat, markDelivered, reportAlarm } from '../engine/core';
import { checkFleet, completeFleet, countShipCellsInHint, randomFleet } from '../engine/placement';
import { generateQuiz, quizShapeOk } from '../engine/quiz';
import { viewFor } from '../engine/project';
import { seededRng } from '../engine/rng';
import { FLEET0, FLEET1, K0, K1, bothFresh, ctxOf, emptyCells, fresh, mkClock, playing, type Clock } from '../engine/testkit';
import type { EngineCtx, RoomState } from '../engine/types';

let aid = 0;
const id = () => `qa${++aid}`;
const other = (s: Seat): Seat => (s === 0 ? 1 : 0);
function must(c: Clock, s: RoomState, seat: Seat, body: Record<string, unknown>, ctx?: EngineCtx): RoomState {
  const r = applyAction(s, seat, { actionId: id(), ...body } as never, ctx ?? ctxOf(c));
  if (!r.ok) throw new Error(`${String(body.type)}: ${r.error} ${r.reason ?? ''}`);
  return advance(r.state, ctx ?? ctxOf(c)).state;
}
const tryA = (c: Clock, s: RoomState, seat: Seat, body: Record<string, unknown>) => applyAction(s, seat, { actionId: id(), ...body } as never, ctxOf(c));
const adv = (c: Clock, s: RoomState) => advance(s, ctxOf(c)).state;
/** 지금 차례인 사람이 미스 한 발(접속 신호 새로) */
function miss(c: Clock, s: RoomState, presence: 'fresh' | 'none' = 'fresh', dt = 1000): RoomState {
  const g = s.game!;
  const seat = g.turn;
  const free = emptyCells(s.secret.boards[other(seat)]).filter((x) => !g.shots[seat].some((y) => y.cell === x));
  c.now += dt;
  c.presence = presence === 'fresh' ? bothFresh(c.now) : [null, null];
  return must(c, s, seat, { type: 'fire', cell: free[0] });
}
function toRound(c: Clock, s: RoomState, round: number, presence: 'fresh' | 'none' = 'none'): RoomState {
  while (s.status === 'playing' && (s.game!.round < round || s.game!.turn !== s.game!.firstSeat)) {
    if (s.game!.phase === 'quiz') throw new Error('quiz');
    s = miss(c, s, presence);
  }
  return s;
}
function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
}
const cellsOf = (fleet: readonly ShipPlacement[]) => fleet.flatMap((p) => placementCells(p) ?? []);

// ─── ENG-02·03 배치 속성 ─────────────────────────────────────────────────────

describe('ENG-02 checkFleet vs 독립 구현(1만 무작위 입력)', () => {
  const ref = (ships: ShipPlacement[], complete: boolean) => {
    if (ships.length > 3 || (complete && ships.length !== 3)) return false;
    const slots = new Set(ships.map((s) => s.slot));
    if (slots.size !== ships.length) return false;
    const used = new Set<string>();
    for (const p of ships) {
      const n = p.slot === 'L4' ? 4 : p.slot === 'L3' ? 3 : 2;
      const c0 = p.start.charCodeAt(0) - 65, r0 = Number(p.start.slice(1)) - 1;
      for (let i = 0; i < n; i++) {
        const c = p.dir === 'h' ? c0 + i : c0, r = p.dir === 'v' ? r0 + i : r0;
        if (c > 7 || r > 7) return false;
        const k = `${c},${r}`;
        if (used.has(k)) return false;
        used.add(k);
      }
    }
    return true;
  };
  it('두 판정이 모두 일치', () => {
    const ship = fc.record({ slot: fc.constantFrom('L4', 'L3', 'L2'), start: fc.constantFrom(...ALL_CELLS), dir: fc.constantFrom('h', 'v') }) as fc.Arbitrary<ShipPlacement>;
    fc.assert(fc.property(fc.array(ship, { maxLength: 4 }), fc.boolean(), (ships, complete) => checkFleet(ships, complete).ok === ref(ships, complete)), { numRuns: 10_000 });
  });
  it('맞닿음은 허용, 겹침은 거부', () => {
    expect(checkFleet([{ slot: 'L4', start: 'A1', dir: 'h' }, { slot: 'L3', start: 'A2', dir: 'h' }, { slot: 'L2', start: 'E1', dir: 'h' }], true).ok).toBe(true);
    expect(checkFleet([{ slot: 'L4', start: 'A1', dir: 'h' }, { slot: 'L3', start: 'B1', dir: 'v' }], false).ok).toBe(false);
  });
});

describe('ENG-03 completeFleet 1만 회', () => {
  it('기존 초안 유지, 3척 유효, 슬롯 순서 L4·L3·L2', () => {
    const rng = seededRng(3);
    for (let i = 0; i < 10_000; i++) {
      const full = randomFleet(rng);
      const keep = full.slice(0, Math.floor(rng() * 3));
      const out = completeFleet(keep, rng);
      expect(checkFleet(out, true).ok).toBe(true);
      expect(out.map((s) => s.slot)).toEqual(['L4', 'L3', 'L2']);
      for (const k of keep) expect(out.find((s) => s.slot === k.slot)).toEqual(k);
    }
  });
});

// ─── ENG-04~08 판정 ──────────────────────────────────────────────────────────

describe('ENG-04 발사 판정·사건', () => {
  it('miss/hit/sunk, fire 사건 slot은 sunk일 때만, 이미 쏜 칸은 INVALID already_fired + 차례 유지', () => {
    const c = mkClock(1);
    let s = playing(c);
    const f = s.game!.firstSeat;
    const target = f === 0 ? FLEET1 : FLEET0;
    const L2 = placementCells(target.find((x) => x.slot === 'L2')!)!;
    c.now += 1000;
    s = must(c, s, f, { type: 'fire', cell: L2[0] });
    const e1 = s.events.filter((e) => e.type === 'fire').pop()!;
    expect(e1).toMatchObject({ result: 'hit' });
    expect('slot' in e1).toBe(false);
    s = miss(c, s, 'none');
    c.now += 1000;
    const dup = tryA(c, s, f, { type: 'fire', cell: L2[0] });
    expect(dup).toEqual({ ok: false, error: 'INVALID', reason: 'already_fired' });
    s = must(c, s, f, { type: 'fire', cell: L2[1] });
    const e2 = s.events.filter((e) => e.type === 'fire').pop()!;
    expect(e2).toMatchObject({ result: 'sunk', slot: 'L2' });
  });
});

describe('ENG-05·06 승리·무승부·추가 발사 없음', () => {
  /** 선공 F, 후공 S. 각자 상대 L2(2칸)+L3(3칸) = 5발로 2척. 4라운드 검산을 피하려 접속 없음 */
  function scenario(kind: 'a' | 'b' | 'c') {
    const c = mkClock(5);
    let s = playing(c);
    const F = s.game!.firstSeat;
    const S = other(F);
    const plan = (seat: Seat) => {
      const t = seat === 0 ? FLEET1 : FLEET0;
      return [...placementCells(t.find((x) => x.slot === 'L2')!)!, ...placementCells(t.find((x) => x.slot === 'L3')!)!];
    };
    const pf = plan(F), ps = plan(S);
    const missF = emptyCells(F === 0 ? FLEET1 : FLEET0), missS = emptyCells(S === 0 ? FLEET1 : FLEET0);
    const sAll = kind === 'a' ? [...ps.slice(0, 4), missS[0]] : ps;
    const fAll = kind === 'c' ? [...pf.slice(0, 4), missF[0]] : pf;
    let afterF5: string | null = null;
    for (let i = 0; i < 5; i++) {
      c.now += 1000;
      s = must(c, s, F, { type: 'fire', cell: fAll[i] });
      if (i === 4) afterF5 = s.status;
      if (s.status !== 'playing') break;
      if (i === 4 && kind !== 'c') {
        // 선공이 2척째를 침몰시킨 직후에도 즉시 끝나지 않는다
      }
      c.now += 1000;
      s = must(c, s, S, { type: 'fire', cell: sAll[i] });
    }
    return { s, F, S, afterF5 };
  }
  it('(a) 선공이 2척째 침몰, 후공 실패 → 후공이 그 라운드에 쏜 뒤 선공 승(sunk2)', () => {
    const { s, F, afterF5 } = scenario('a');
    expect(afterF5).toBe('playing');
    expect(s.result).toEqual({ winner: F, reason: 'sunk2', round: 5 });
  });
  it('(b) 같은 라운드에 둘 다 2척째 → draw', () => {
    const { s } = scenario('b');
    expect(s.result).toEqual({ winner: null, reason: 'draw', round: 5 });
  });
  it('(c) 후공만 2척째 → 후공 승', () => {
    const { s, S } = scenario('c');
    expect(s.result).toEqual({ winner: S, reason: 'sunk2', round: 5 });
  });
  it('ENG-06 명중 직후 같은 사람이 다시 fire → NOT_YOUR_TURN', () => {
    const c = mkClock(5);
    let s = playing(c);
    const F = s.game!.firstSeat;
    c.now += 1000;
    s = must(c, s, F, { type: 'fire', cell: (F === 0 ? 'E1' : 'A1') as CellAddr });
    expect(s.game!.shots[F][0]!.result).toBe('hit');
    expect(tryA(c, s, F, { type: 'fire', cell: 'H8' })).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });
  });
});

describe('ENG-07 30라운드 상한', () => {
  function capGame(hitsF: CellAddr[], hitsS: CellAddr[]) {
    const c = mkClock(7);
    let s = playing(c);
    const F = s.game!.firstSeat, S = other(F);
    const mF = emptyCells(F === 0 ? FLEET1 : FLEET0), mS = emptyCells(S === 0 ? FLEET1 : FLEET0);
    const seqF = [...hitsF, ...mF].slice(0, 30), seqS = [...hitsS, ...mS].slice(0, 30);
    let at29: string | null = null;
    for (let r = 0; r < 30; r++) {
      c.now += 1000; c.presence = [null, null];
      s = must(c, s, F, { type: 'fire', cell: seqF[r] });
      c.now += 1000;
      s = must(c, s, S, { type: 'fire', cell: seqS[r] });
      if (r === 28) at29 = `${s.status}:${s.game!.round}`;
    }
    return { s, F, S, at29 };
  }
  it('29라운드 끝 = 계속, 30라운드 끝 = cap. 3:2(침몰 포함)는 승자, 2:2는 무승부', () => {
    // 좌석 0이 쏘는 상대(FLEET1) L2=F6,G6 / 좌석 1이 쏘는 상대(FLEET0) A1,B1(L4 일부)
    const hitsFor = (seat: Seat, n: number): CellAddr[] => (seat === 0 ? (['F6', 'G6', 'E1'] as CellAddr[]) : (['A1', 'B1', 'C1'] as CellAddr[])).slice(0, n);
    const probe = playing(mkClock(7));
    const F = probe.game!.firstSeat;
    const a = capGame(hitsFor(F, 3), hitsFor(other(F), 2));
    expect(a.at29).toBe('playing:30');
    expect(a.s.result).toEqual({ winner: a.F, reason: 'cap', round: 30 });
    const b = capGame(hitsFor(F, 2), hitsFor(other(F), 2));
    expect(b.s.result).toEqual({ winner: null, reason: 'cap', round: 30 });
  });
});

describe('ENG-08 선공', () => {
  const start = (r: number) => {
    let s = createRoomState({ code: '12345', keyHash: K0, nickname: '가', industry: 0, alarmOn: false });
    const ctx: EngineCtx = { now: 1, rng: () => r, newId: () => 'm', presence: [null, null] };
    s = (joinSeat(s, { keyHash: K1, nickname: '나', industry: 1 }, ctx) as { stepped: { state: RoomState } }).stepped.state;
    for (const seat of [0, 1] as const) {
      const out = applyAction(s, seat, { actionId: `p${seat}`, type: 'place', ships: seat ? FLEET1 : FLEET0, confirm: true }, ctx);
      if (!out.ok) throw new Error('place');
      s = out.state;
    }
    return { s, ctx };
  };
  it('rng 0.49 → 0, 0.5 → 1, 이후 재대결 교대(v8·v9·v10)', () => {
    expect(start(0.49).s.game!.firstSeat).toBe(0);
    const { s: s0, ctx } = start(0.5);
    expect(s0.game!.firstSeat).toBe(1);
    let s = s0;
    const seen: number[] = [s.game!.firstSeat];
    for (let i = 0; i < 3; i++) {
      s = (applyAction(s, 0, { actionId: `res${i}`, type: 'resign' }, ctx) as { state: RoomState }).state;
      s = (applyAction(s, 0, { actionId: `rm0${i}`, type: 'rematch' }, ctx) as { state: RoomState }).state;
      s = (applyAction(s, 1, { actionId: `rm1${i}`, type: 'rematch' }, ctx) as { state: RoomState }).state;
      for (const seat of [0, 1] as const) s = (applyAction(s, seat, { actionId: `pp${i}${seat}`, type: 'place', ships: seat ? FLEET1 : FLEET0, confirm: true }, ctx) as { state: RoomState }).state;
      seen.push(s.game!.firstSeat);
      expect(s.matchSeq).toBe(2 + i);
    }
    expect(seen).toEqual([1, 0, 1, 0]);
  });
});

// ─── ENG-09~14 검산 ──────────────────────────────────────────────────────────

describe('ENG-09 검산 출제 조건(3라운드 끝)', () => {
  /** 3라운드 마지막 발사 직전 상태 + 그 발사의 ctx를 바꿔 출제 여부를 본다 */
  function at3end(mut?: (s: RoomState) => void) {
    const c = mkClock(9);
    let s = playing(c);
    s = toRound(c, s, 3, 'none');
    s = miss(c, s, 'none'); // 3라운드 선공 발사 → 후공 차례
    mut?.(s);
    const seat = s.game!.turn;
    const free = emptyCells(s.secret.boards[other(seat)]).filter((x) => !s.game!.shots[seat].some((y) => y.cell === x));
    c.now += 1000;
    return (presence: EngineCtx['presence']) => {
      const r = applyAction(s, seat, { actionId: id(), type: 'fire', cell: free[0] }, { ...ctxOf(c), presence });
      if (!r.ok) throw new Error('fire');
      return r.state;
    };
  }
  it('lastSeen 6,000ms 전 = 출제, 6,001ms 전 = 다음 라운드로, 한쪽 disguise = 다음 라운드로', () => {
    const run = at3end();
    const c = mkClock(9);
    void c;
    const probe = (lag0: number, lag1: number, v1: 'game' | 'disguise' = 'game') => {
      const r = at3end();
      // 같은 c.now를 다시 계산하기 어려우므로 함수 내부 시각을 쓴다: lastSeen = now - lag
      return r;
    };
    void run; void probe;
    // 직접 계산: 각 경우 새로 만든다
    const mk = (lag: [number, number], vs: ['game' | 'disguise', 'game' | 'disguise'] = ['game', 'game']) => {
      const cc = mkClock(9);
      let s = playing(cc);
      s = toRound(cc, s, 3, 'none');
      s = miss(cc, s, 'none');
      const seat = s.game!.turn;
      const free = emptyCells(s.secret.boards[other(seat)]).filter((x) => !s.game!.shots[seat].some((y) => y.cell === x));
      cc.now += 1000;
      const presence = [fresh(cc.now - lag[0], vs[0]), fresh(cc.now - lag[1], vs[1])] as const;
      const r = applyAction(s, seat, { actionId: id(), type: 'fire', cell: free[0] }, { ...ctxOf(cc), presence });
      if (!r.ok) throw new Error('fire');
      return r.state.game!;
    };
    expect(mk([6000, 6000]).phase).toBe('quiz');
    const late = mk([6001, 0]);
    expect(late.phase).toBe('fire');
    expect(late.pendingQuiz).toBe(true);
    const hid = mk([0, 0], ['game', 'disguise']);
    expect(hid.phase).toBe('fire');
    expect(hid.pendingQuiz).toBe(true);
  });
  it('둘 다 힌트 2개 = 출제 안 함(미룸 해제), 한쪽 2개 = 그 사람 eligible false', () => {
    const both = at3end((s) => { s.seats[0]!.hintsEarned = 2; s.seats[1]!.hintsEarned = 2; });
    const c = mkClock(9);
    void c;
    const g1 = both([fresh(Number.MAX_SAFE_INTEGER / 2), fresh(Number.MAX_SAFE_INTEGER / 2)]).game!;
    expect(g1.phase).toBe('fire');
    expect(g1.pendingQuiz).toBe(false);
    const one = at3end((s) => { s.seats[0]!.hintsEarned = 2; });
    // presence는 '지금' 기준이어야 하므로 큰 now 대신 아래처럼 ctxOf 시각을 재사용
    const cc = mkClock(9);
    let s = playing(cc);
    s = toRound(cc, s, 3, 'none');
    s = miss(cc, s, 'none');
    s.seats[0]!.hintsEarned = 2;
    const seat = s.game!.turn;
    const free = emptyCells(s.secret.boards[other(seat)]).filter((x) => !s.game!.shots[seat].some((y) => y.cell === x));
    cc.now += 1000;
    cc.presence = bothFresh(cc.now);
    const g2 = must(cc, s, seat, { type: 'fire', cell: free[0] }).game!;
    void one;
    expect(g2.phase).toBe('quiz');
    expect(g2.quiz!.eligible).toEqual([false, true]);
    const v0 = viewFor(must(cc, s, seat, { type: 'fire', cell: free[1] }), 0, { version: 1, serverNow: cc.now, bellTopic: '', oppLastSeenAt: 0, oppHidden: false });
    expect(v0.status === 'playing' && v0.game.quiz).toBeNull();
  });
  it('경보 진행 중이면 검산은 다음 라운드로', () => {
    const cc = mkClock(9);
    let s = playing(cc, { alarmOn: true });
    s.secret.alarmRound = 15;
    s = toRound(cc, s, 3, 'none');
    s = miss(cc, s, 'none');
    s.game!.alarm = { issuedAt: cc.now, reactionMs: [null, null] };
    const seat = s.game!.turn;
    const free = emptyCells(s.secret.boards[other(seat)]).filter((x) => !s.game!.shots[seat].some((y) => y.cell === x));
    cc.now += 500;
    cc.presence = bothFresh(cc.now);
    const r = applyAction(s, seat, { actionId: id(), type: 'fire', cell: free[0] }, ctxOf(cc));
    expect(r.ok && r.state.game!.phase).toBe('fire');
    expect(r.ok && r.state.game!.pendingQuiz).toBe(true);
  });
  it('CR-11 → BUG-15 수정(기획 판단: 판당 3회 유지): 4라운드 검산이 8라운드까지 밀려도 합치지 않고 조건이 되는 라운드(9·10)와 12에 하나씩 낸다', () => {
    const cc = mkClock(19);
    let s = playing(cc);
    s = toRound(cc, s, 8, 'none'); // 1~7라운드 접속 신호 없음 → 4라운드 검산 미룸
    // 8라운드 시작 시점엔 아직 접속 없음 → 8라운드 마지막 발사부터 접속 신호
    let quizzes = 0;
    for (let i = 0; i < 200 && s.status === 'playing' && s.game!.round <= 14; i++) {
      if (s.game!.phase === 'quiz') {
        quizzes++;
        cc.now += QUIZ_MS + 2_500;
        cc.presence = bothFresh(cc.now);
        s = adv(cc, s);
        continue;
      }
      s = miss(cc, s, 'fresh');
    }
    // [백엔드 QA 수정] 기획 판단 "판당 3회 유지" → 3회(미뤄진 4라운드분 + 8 + 12). 수정 전 구현은 2회(8·12)였다
    expect(quizzes).toBe(3);
  });
});

describe('ENG-10 generateQuiz 1만 회', () => {
  it('합계 11~98×3, 부가세 정수, 차액 ≥ 5, 직전 종류와 다름, 모양', () => {
    const rng = seededRng(10);
    let prev: 'sum' | 'vat' | 'diff' | null = null;
    for (let i = 0; i < 10_000; i++) {
      const q = generateQuiz(rng, prev);
      expect(q.kind).not.toBe(prev);
      expect(quizShapeOk(q.kind, q.values)).toBe(true);
      expect(Number.isInteger(q.answer)).toBe(true);
      if (q.kind === 'sum') q.values.forEach((v) => expect(v >= 11 && v <= 98).toBe(true));
      if (q.kind === 'diff') expect(q.answer).toBeGreaterThanOrEqual(5);
      prev = q.kind;
    }
  });
});

describe('ENG-11~13 채점·잠금·마감·먼저 맞힘 (±1ms)', () => {
  function toQuiz(seed = 13) {
    const c = mkClock(seed);
    c.presence = bothFresh(c.now);
    let s = playing(c);
    while (s.game!.phase !== 'quiz') s = miss(c, s, 'fresh');
    return { c, s };
  }
  it('ENG-11 오답 → +2,999ms 재제출 LOCKED, +3,000ms 정답 인정. 오답은 events·상대 화면에 없음', () => {
    const { c, s: s0 } = toQuiz();
    let s = markDelivered(markDelivered(s0, 0, ctxOf(c)).state, 1, ctxOf(c)).state;
    const q = s.game!.quiz!, ans = s.secret.quiz!.answer;
    const oppBefore = JSON.stringify(viewFor(s, 1, { version: 1, serverNow: c.now, bellTopic: '', oppLastSeenAt: 0, oppHidden: false }));
    const evBefore = s.events.length;
    s = must(c, s, 0, { type: 'answer', quizId: q.id, value: ans + 1 });
    expect(s.events.length).toBe(evBefore);
    expect(JSON.stringify(viewFor(s, 1, { version: 1, serverNow: c.now, bellTopic: '', oppLastSeenAt: 0, oppHidden: false }))).toBe(oppBefore);
    const t = c.now;
    c.now = t + QUIZ_LOCK_MS - 1;
    expect(tryA(c, s, 0, { type: 'answer', quizId: q.id, value: ans })).toEqual({ ok: false, error: 'LOCKED' });
    c.now = t + QUIZ_LOCK_MS;
    s = must(c, s, 0, { type: 'answer', quizId: q.id, value: ans });
    expect(s.game!.quiz?.elapsedMs[0] ?? s.game!.stats.quizzes[0]?.elapsedMs[0]).not.toBeNull();
  });
  it('ENG-12 배달 +10,000ms 허용, +10,001ms 만료. 배달 미기록 + 2초 → 출제+1,000을 배달로', () => {
    for (const [dt, ok] of [[QUIZ_MS, true], [QUIZ_MS + 1, false]] as const) {
      const { c, s: s0 } = toQuiz();
      const d = c.now;
      const s = markDelivered(markDelivered(s0, 0, ctxOf(c)).state, 1, ctxOf(c)).state;
      c.now = d + dt;
      const r = applyAction(s, 0, { actionId: id(), type: 'answer', quizId: s.game!.quiz!.id, value: s.secret.quiz!.answer }, { ...ctxOf(c) });
      expect(r.ok).toBe(ok);
      if (!ok) expect(r).toMatchObject({ error: 'INVALID', reason: 'quiz_stale' });
    }
    const { c, s } = toQuiz();
    const issued = s.game!.quiz!.issuedAt;
    c.now = issued + 2000;
    const s2 = adv(c, s);
    expect(s2.game!.quiz!.deliveredAt).toEqual([issued + 1000, issued + 1000]);
  });
  function race(elapsedA: number, elapsedB: number | null) {
    const { c, s: s0 } = toQuiz();
    const t0 = c.now;
    let s = markDelivered(markDelivered(s0, 0, ctxOf(c)).state, 1, ctxOf(c)).state;
    const q = s.game!.quiz!, ans = s.secret.quiz!.answer;
    const evs: [number, Seat][] = [[elapsedA, 0]];
    if (elapsedB !== null) evs.push([elapsedB, 1]);
    evs.sort((a, b) => a[0] - b[0]);
    for (const [e, seat] of evs) {
      c.now = t0 + e;
      c.presence = bothFresh(c.now);
      if (s.game!.phase !== 'quiz') break;
      const r = applyAction(s, seat, { actionId: id(), type: 'answer', quizId: q.id, value: ans }, ctxOf(c));
      if (r.ok) s = r.state;
      s = adv(c, s);
    }
    c.now = t0 + QUIZ_MS + 3000;
    s = adv(c, s);
    return s.game!.stats.quizzes[0]!;
  }
  it('ENG-13 경과 1,000 vs 1,200 → 둘 다, 1,000 vs 1,201 → 빠른 쪽만, 한 사람만 → 그 사람, 아무도 → expired', () => {
    expect(race(1000, 1200).awarded).toEqual([0, 1]);
    expect(race(1000, 1201).awarded).toEqual([0]);
    expect(race(1000, null).awarded).toEqual([0]);
    const { c, s } = toQuiz();
    c.now += QUIZ_MS + 3000;
    const s2 = adv(c, s);
    expect(s2.events.find((e) => e.type === 'quizSettled')).toMatchObject({ awarded: [], expired: true });
  });
  it('ENG-13 늦게 오는 사람을 settleAt까지 기다렸다 확정(그 전엔 phase quiz, 내 화면 settling)', () => {
    const { c, s: s0 } = toQuiz();
    const t0 = c.now;
    let s = markDelivered(markDelivered(s0, 0, ctxOf(c)).state, 1, ctxOf(c)).state;
    c.now = t0 + 1000;
    s = must(c, s, 0, { type: 'answer', quizId: s.game!.quiz!.id, value: s.secret.quiz!.answer });
    expect(s.game!.phase).toBe('quiz');
    const v = viewFor(s, 0, { version: 1, serverNow: c.now, bellTopic: '', oppLastSeenAt: 0, oppHidden: false });
    expect(v.status === 'playing' && v.game.quiz).toMatchObject({ mine: 'correct', status: 'settling', settleAt: t0 + 1200 });
    // [백엔드 QA 수정 BUG-03] settleAt(t0+1200)은 상대가 비길 수 있는 마지막 시각(포함) → 그 정각엔 아직 확정하지 않고 +1ms에 확정
    c.now = t0 + 1200; s = adv(c, s);
    expect(s.game!.phase).toBe('quiz');
    c.now = t0 + 1201; s = adv(c, s);
    expect(s.game!.phase).toBe('fire');
  });
});

describe('ENG-14 힌트 한도', () => {
  it('같은 사람이 검산 3회 모두 정답 → hintsEarned 최대 2, 세 번째 검산에서 eligible false', () => {
    const c = mkClock(14);
    c.presence = bothFresh(c.now);
    let s = playing(c);
    const eligibles: [boolean, boolean][] = [];
    for (let i = 0; i < 400 && s.status === 'playing' && s.game!.round <= 13; i++) {
      if (s.game!.phase === 'quiz') {
        eligibles.push([...s.game!.quiz!.eligible] as [boolean, boolean]);
        if (s.game!.quiz!.eligible[0]) {
          s = markDelivered(s, 0, ctxOf(c)).state;
          c.now += 500;
          s = must(c, s, 0, { type: 'answer', quizId: s.game!.quiz!.id, value: s.secret.quiz!.answer });
        }
        c.now += QUIZ_MS + 3000;
        c.presence = bothFresh(c.now);
        s = adv(c, s);
        continue;
      }
      s = miss(c, s, 'fresh');
    }
    expect(eligibles.length).toBe(3);
    expect(eligibles[2]).toEqual([false, true]);
    expect(s.seats[0]!.hintsEarned).toBe(2);
  });
});

// ─── ENG-15·16 힌트 ─────────────────────────────────────────────────────────

describe('ENG-15 힌트 값(1만 무작위 판) + 범위', () => {
  it('값 = 범위 안 배 칸 수(독립 구현), A1→A1:C3, H8→F6:H8, D4→C3:E5', () => {
    expect(hintRange({ kind: 'block', cell: 'A1' })).toMatchObject({ from: 'A1', to: 'C3' });
    expect(hintRange({ kind: 'block', cell: 'H8' })).toMatchObject({ from: 'F6', to: 'H8' });
    expect(hintRange({ kind: 'block', cell: 'D4' })).toMatchObject({ from: 'C3', to: 'E5' });
    const rng = seededRng(15);
    for (let i = 0; i < 10_000; i++) {
      const fleet = randomFleet(rng);
      const occ = new Set(cellsOf(fleet));
      const kind = Math.floor(rng() * 3);
      const col = 'ABCDEFGH'[Math.floor(rng() * 8)] as 'A';
      const row = (1 + Math.floor(rng() * 8)) as 1;
      const cell = ALL_CELLS[Math.floor(rng() * 64)];
      const target = kind === 0 ? ({ kind: 'col', col } as const) : kind === 1 ? ({ kind: 'row', row } as const) : ({ kind: 'block', cell } as const);
      let want = 0;
      for (const a of ALL_CELLS) {
        const ac = a.charCodeAt(0) - 65, ar = Number(a.slice(1));
        let inside: boolean;
        if (target.kind === 'col') inside = a[0] === target.col;
        else if (target.kind === 'row') inside = ar === target.row;
        else {
          const cc = Math.min(5, Math.max(0, target.cell.charCodeAt(0) - 65 - 1));
          const rr = Math.min(6, Math.max(1, Number(target.cell.slice(1)) - 1));
          inside = ac >= cc && ac <= cc + 2 && ar >= rr && ar <= rr + 2;
        }
        if (inside && occ.has(a)) want++;
      }
      expect(countShipCellsInHint(fleet, target)).toBe(want);
    }
  });
  it('힌트 사용은 차례·시계 불변, 상대 차례에도 사용 가능, 이미 맞은 칸 포함', () => {
    const c = mkClock(16);
    let s = playing(c);
    const F = s.game!.firstSeat, S = other(F);
    s.seats[S]!.hintsEarned = 1;
    s = miss(c, s, 'none'); // F 미스 → S 차례
    c.now += 1000;
    const fFleetCol = F === 0 ? 'A' : 'E'; // F의 배: FLEET0 A열 3칸(A1·A3·A5) / FLEET1 E열 4칸(E1~E4)
    s = must(c, s, S, { type: 'fire', cell: `${fFleetCol}1` as CellAddr }); // S가 F의 배 한 칸 명중 → F 차례
    expect(s.game!.turn).toBe(F);
    const before = { turn: s.game!.turn, clock: JSON.stringify(s.game!.clock) };
    c.now += 10;
    const r = applyAction(s, S, { actionId: id(), type: 'hint', target: { kind: 'col', col: fFleetCol } }, ctxOf(c));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.game!.turn).toBe(before.turn);
    expect(JSON.stringify(r.state.game!.clock)).toBe(before.clock);
    expect(r.state.seats[S]!.hints[0]!.value).toBe(F === 0 ? 3 : 4);
  });
});

describe('ENG-16 힌트 차단', () => {
  it('검산 중 hint_blocked, 경보 중 hint_blocked, 보유 0 no_hint', () => {
    const c = mkClock(13);
    c.presence = bothFresh(c.now);
    let s = playing(c);
    while (s.game!.phase !== 'quiz') s = miss(c, s, 'fresh');
    s.seats[0]!.hintsEarned = 1;
    expect(tryA(c, s, 0, { type: 'hint', target: { kind: 'row', row: 1 } })).toEqual({ ok: false, error: 'INVALID', reason: 'hint_blocked' });
    expect(tryA(c, s, 1, { type: 'hint', target: { kind: 'row', row: 1 } })).toEqual({ ok: false, error: 'INVALID', reason: 'no_hint' });
    const c2 = mkClock(2);
    let a = playing(c2, { alarmOn: true });
    a.seats[0]!.hintsEarned = 1;
    a.game!.alarm = { issuedAt: c2.now, reactionMs: [null, null] };
    expect(tryA(c2, a, 0, { type: 'hint', target: { kind: 'row', row: 1 } })).toEqual({ ok: false, error: 'INVALID', reason: 'hint_blocked' });
    void a;
  });
  it('기록: 엔진은 "숨기기 중 사용 불가"를 검사하지 않는다(숨긴 사람의 hint 요청도 성공) — 차단은 클라 몫(BUG-01과 함께)', () => {
    const c = mkClock(2);
    let s = playing(c);
    s.seats[0]!.hintsEarned = 1;
    c.presence = [fresh(c.now, 'disguise', c.now), fresh(c.now)];
    const r = tryA(c, s, 0, { type: 'hint', target: { kind: 'row', row: 1 } });
    expect(r.ok).toBe(true);
  });
});

// ─── ENG-18 경보 판정 ────────────────────────────────────────────────────────

describe('ENG-18 경보 판정 경계', () => {
  function withAlarm() {
    const c = mkClock(18);
    c.presence = bothFresh(c.now);
    let s = playing(c, { alarmOn: true });
    s.secret.alarmRound = 6;
    while (!s.game!.alarm) {
      if (s.game!.phase === 'quiz') {
        c.now += QUIZ_MS + 3000;
        c.presence = bothFresh(c.now);
        s = adv(c, s);
        continue;
      }
      s = miss(c, s, 'fresh');
    }
    return { c, s, at: s.game!.alarm!.issuedAt };
  }
  it('보고 3,000ms = pass, 3,001ms = fail, 0ms = pass, 둘 다 fail 가능 → 각자 다음 차례 skip', () => {
    const { c, s, at } = withAlarm();
    const r1 = reportAlarm(reportAlarm(s, 0, { issuedAt: at, reactionMs: ALARM_HIDE_MS }, ctxOf(c)).state, 1, { issuedAt: at, reactionMs: ALARM_HIDE_MS + 1 }, ctxOf(c)).state;
    expect(r1.events.find((e) => e.type === 'alarmResult')).toMatchObject({ outcomes: ['pass', 'fail'] });
    const r2 = reportAlarm(reportAlarm(s, 0, { issuedAt: at, reactionMs: 0 }, ctxOf(c)).state, 1, { issuedAt: at, reactionMs: 0 }, ctxOf(c)).state;
    expect(r2.events.find((e) => e.type === 'alarmResult')).toMatchObject({ outcomes: ['pass', 'pass'] });
    let r3 = reportAlarm(reportAlarm(s, 0, { issuedAt: at, reactionMs: 5000 }, ctxOf(c)).state, 1, { issuedAt: at, reactionMs: 9000 }, ctxOf(c)).state;
    expect(r3.events.find((e) => e.type === 'alarmResult')).toMatchObject({ outcomes: ['fail', 'fail'] });
    expect([r3.seats[0]!.skipNextFire, r3.seats[1]!.skipNextFire]).toEqual([true, true]);
    // 지금 차례인 사람의 현재 차례는 그대로, 그 사람의 "다음" 차례가 skip
    const t = r3.game!.turn;
    c.now += 500;
    r3 = must(c, r3, t, { type: 'fire', cell: emptyCells(r3.secret.boards[other(t)]).find((x) => !r3.game!.shots[t].some((y) => y.cell === x))! });
    expect(r3.events.some((e) => e.type === 'skip')).toBe(true);
  });
  it('무보고 + 접속 중 = fail(창 끝 판정), 창 끝 기준 6초 넘게 끊김 = excluded', () => {
    const { c, s, at } = withAlarm();
    c.now = at + ALARM_REPORT_WAIT_MS;
    c.presence = [fresh(at + ALARM_REPORT_WAIT_MS - 6000), fresh(at + ALARM_REPORT_WAIT_MS - 6001)];
    const s2 = adv(c, s);
    expect(s2.events.find((e) => e.type === 'alarmResult')).toMatchObject({ outcomes: ['fail', 'excluded'] });
  });
  it('ENG-17 경보 출제: 6~15 밖이면 없음(16라운드 도달 시 alarmDone), 끈 방 0회', () => {
    const c = mkClock(17);
    let s = playing(c, { alarmOn: true });
    s.secret.alarmRound = 6;
    s = toRound(c, s, 16, 'none'); // 6~15 내내 접속 없음 → 출제 불가
    expect(s.game!.alarm).toBeNull();
    expect(s.game!.alarmDone).toBe(true);
    const off = playing(mkClock(1));
    expect(off.secret.alarmRound).toBeNull();
    expect(off.game!.alarmDone).toBe(true);
  });
});

// ─── ENG-19~21 시계 ─────────────────────────────────────────────────────────

describe('ENG-19 숨기기 시계(±1ms)', () => {
  it('정지 시작 = max(숨은 시각, 차례 시작), 남은 시간 보존, 누적 119,999 → 정지 유지 / 120,000 → hideBudgetOut 후 재개', () => {
    const c = mkClock(19);
    let s = playing(c);
    const t = s.game!.turn;
    const start = s.game!.clock!.startedAt;
    // 차례 시작 5초 전에 숨음 → 정지 시작 = 차례 시작
    c.now = start + 1000;
    const pres = (view: 'game' | 'disguise', at: number) => (t === 0 ? [fresh(c.now, view, at), fresh(c.now)] : [fresh(c.now), fresh(c.now, view, at)]) as unknown as EngineCtx['presence'];
    c.presence = pres('disguise', start - 5000);
    s = adv(c, s);
    expect(s.game!.clock!.pause).toEqual({ since: start, remainingMs: TURN_MS });
    c.now = start + HIDE_BUDGET_MS - 1;
    c.presence = pres('disguise', start - 5000);
    s = adv(c, s);
    expect(s.game!.clock!.pause).not.toBeNull();
    c.now = start + HIDE_BUDGET_MS;
    s = adv(c, s);
    expect(s.game!.clock!.pause).toBeNull();
    expect(s.events.some((e) => e.type === 'hideBudgetOut')).toBe(true);
    expect(s.seats[t]!.hideUsedMs).toBe(HIDE_BUDGET_MS);
    expect(s.game!.clock!.deadlineAt).toBe(start + HIDE_BUDGET_MS + TURN_MS);
  });
  it('차례 아닌 사람의 숨기기는 예산을 쓰지 않는다, 다음 판엔 0으로', () => {
    const c = mkClock(19);
    let s = playing(c);
    const t = s.game!.turn, o = other(t);
    c.now += 5000;
    c.presence = (o === 0 ? [fresh(c.now, 'disguise', c.now - 4000), fresh(c.now)] : [fresh(c.now), fresh(c.now, 'disguise', c.now - 4000)]) as unknown as EngineCtx['presence'];
    s = adv(c, s);
    expect(s.game!.clock!.pause).toBeNull();
    expect(s.seats[o]!.hideUsedMs).toBe(0);
    s.seats[t]!.hideUsedMs = 50_000;
    s = must(c, s, 0, { type: 'resign' });
    s = must(c, s, 0, { type: 'rematch' });
    s = must(c, s, 1, { type: 'rematch' });
    expect([s.seats[0]!.hideUsedMs, s.seats[1]!.hideUsedMs]).toEqual([0, 0]);
  });
});

describe('ENG-20 시간 초과·부재(±1ms)', () => {
  it('19,999 = 계속, 20,000 = timeout. 두 사람 다 끊긴 채 100초 뒤 요청 1회 = timeout 1회', () => {
    const c = mkClock(20);
    let s = playing(c);
    const dl = s.game!.clock!.deadlineAt;
    c.now = dl - 1;
    expect(adv(c, s).events.some((e) => e.type === 'timeout')).toBe(false);
    c.now = dl;
    const s1 = adv(c, s);
    expect(s1.events.filter((e) => e.type === 'timeout')).toHaveLength(1);
    c.now = dl + 100_000;
    const s2 = adv(c, s);
    expect(s2.events.filter((e) => e.type === 'timeout')).toHaveLength(1);
    void s;
  });
  it('연속 2회 = absent_not_allowed, 3회 = absent 승리, 발사하면 0으로', () => {
    const c = mkClock(21);
    let s = playing(c);
    const F = s.game!.firstSeat, S = other(F);
    const step = () => {
      // F 발사, S는 시간 초과
      c.now += 1000;
      s = must(c, s, F, { type: 'fire', cell: emptyCells(s.secret.boards[S]).find((x) => !s.game!.shots[F].some((y) => y.cell === x))! });
      c.now = s.game!.clock!.deadlineAt;
      s = adv(c, s);
    };
    step(); step();
    expect(s.seats[S]!.consecutiveTimeouts).toBe(2);
    expect(tryA(c, s, F, { type: 'claimAbsent' })).toEqual({ ok: false, error: 'INVALID', reason: 'absent_not_allowed' });
    step();
    expect(s.seats[S]!.consecutiveTimeouts).toBe(3);
    const won = must(c, s, F, { type: 'claimAbsent' });
    expect(won.result).toMatchObject({ winner: F, reason: 'absent' });
    // 발사로 초기화
    c.now += 1000;
    const reset = must(c, s, F, { type: 'fire', cell: emptyCells(s.secret.boards[S]).find((x) => !s.game!.shots[F].some((y) => y.cell === x))! });
    c.now += 1000;
    const r2 = must(c, reset, S, { type: 'fire', cell: emptyCells(reset.secret.boards[F]).find((x) => !reset.game!.shots[S].some((y) => y.cell === x))! });
    expect(r2.seats[S]!.consecutiveTimeouts).toBe(0);
  });
});

describe('ENG-21 검산 중 발사 시계', () => {
  it('phase quiz에서 fire = WRONG_PHASE, 확정 시각부터 20초', () => {
    const c = mkClock(13);
    c.presence = bothFresh(c.now);
    let s = playing(c);
    while (s.game!.phase !== 'quiz') s = miss(c, s, 'fresh');
    expect(tryA(c, s, s.game!.turn, { type: 'fire', cell: 'H8' })).toEqual({ ok: false, error: 'WRONG_PHASE' });
    s = markDelivered(markDelivered(s, 0, ctxOf(c)).state, 1, ctxOf(c)).state;
    c.now += 700;
    s = must(c, s, 0, { type: 'answer', quizId: s.game!.quiz!.id, value: s.secret.quiz!.answer });
    c.now += 50;
    s = must(c, s, 1, { type: 'answer', quizId: s.game!.quiz!.id, value: s.secret.quiz!.answer });
    expect(s.game!.phase).toBe('fire');
    expect(s.game!.clock!.deadlineAt).toBe(c.now + TURN_MS);
  });
});

// ─── ENG-22~25 ──────────────────────────────────────────────────────────────

describe('ENG-22 도발', () => {
  it('1라운드 도발 → 2·3라운드 taunt_cooldown, 4라운드 가능. id −1/10/1.5 = taunt_id, 종료 후 WRONG_PHASE', () => {
    const c = mkClock(22);
    let s = playing(c);
    s = must(c, s, 0, { type: 'taunt', tauntId: 0 });
    for (const r of [2, 3]) {
      s = toRound(c, s, r);
      expect(tryA(c, s, 0, { type: 'taunt', tauntId: 1 })).toEqual({ ok: false, error: 'INVALID', reason: 'taunt_cooldown' });
    }
    s = toRound(c, s, 4);
    s = must(c, s, 0, { type: 'taunt', tauntId: 9 });
    for (const bad of [-1, 10, 1.5]) expect(tryA(c, s, 1, { type: 'taunt', tauntId: bad })).toEqual({ ok: false, error: 'INVALID', reason: 'taunt_id' });
    s = must(c, s, 1, { type: 'resign' });
    expect(tryA(c, s, 0, { type: 'taunt', tauntId: 1 })).toEqual({ ok: false, error: 'WRONG_PHASE' });
  });
});

describe('ENG-23 배치 90초', () => {
  it('방장 대기 중 배치·확정 → 손님 입장 시점부터 90초, 89,999 = 대기, 90,000 = 손님 초안 유지 + 보충 + autoPlaced → 대전', () => {
    const c = mkClock(23);
    let s = createRoomState({ code: '12345', keyHash: K0, nickname: '가', industry: 0, alarmOn: false });
    s = must(c, s, 0, { type: 'place', ships: FLEET0, confirm: true });
    expect(s.status).toBe('waiting');
    c.now += 30_000;
    const joinAt = c.now;
    s = (joinSeat(s, { keyHash: K1, nickname: '나', industry: 1 }, ctxOf(c)) as { stepped: { state: RoomState } }).stepped.state;
    expect(s.placeDeadlineAt).toBe(joinAt + PLACE_MS);
    const draft = [FLEET1[0]];
    s = must(c, s, 1, { type: 'place', ships: draft, confirm: false });
    c.now = joinAt + PLACE_MS - 1;
    expect(adv(c, s).status).toBe('placing');
    c.now = joinAt + PLACE_MS;
    const s2 = adv(c, s);
    expect(s2.status).toBe('playing');
    expect(s2.events.find((e) => e.type === 'autoPlaced')).toMatchObject({ seats: [1] });
    expect(s2.secret.boards[1][0]).toEqual(FLEET1[0]);
    expect(s2.secret.boards[1]).toHaveLength(3);
    expect(s2.secret.boards[0]).toEqual(FLEET0);
  });
});

describe('ENG-24 이탈', () => {
  it('대전 중 leave = 기권 + left, 대기·배치 중 손님 = 자리 비움, 방장 = present false, 종료 후 = 재대결 rematch_closed', () => {
    const c = mkClock(24);
    const p = playing(c);
    const l = must(c, p, 1, { type: 'leave' });
    expect(l.result).toMatchObject({ winner: 0, reason: 'resign' });
    expect(l.events.some((e) => e.type === 'left')).toBe(true);
    let w = createRoomState({ code: '12345', keyHash: K0, nickname: '가', industry: 0, alarmOn: false });
    w = (joinSeat(w, { keyHash: K1, nickname: '나', industry: 1 }, ctxOf(c)) as { stepped: { state: RoomState } }).stepped.state;
    const g = must(c, w, 1, { type: 'leave' });
    expect(g.seats[1]).toBeNull();
    expect(g.status).toBe('waiting');
    const h = must(c, w, 0, { type: 'leave' });
    expect(h.seats[0]!.present).toBe(false);
    const e = must(c, must(c, p, 0, { type: 'resign' }), 1, { type: 'leave' });
    expect(tryA(c, e, 0, { type: 'rematch' })).toEqual({ ok: false, error: 'INVALID', reason: 'rematch_closed' });
  });
});

describe('ENG-25 재대결', () => {
  it('한쪽만 → 정확히 2분(120,000ms)에 만료 사건, 둘 다 → matchSeq+1·좌석 초기화·새 matchId·선공 교대', () => {
    const c = mkClock(25);
    let s = must(c, playing(c), 0, { type: 'resign' });
    const m1 = s.game!.matchId, f1 = s.game!.firstSeat;
    s.seats[0]!.hintsEarned = 2; s.seats[0]!.hints = [{ target: { kind: 'row', row: 1 }, value: 1, round: 1, at: 1 }];
    s.seats[1]!.skipNextFire = true; s.seats[1]!.lastTauntRound = 3; s.seats[1]!.hideUsedMs = 9000;
    const at = c.now;
    const one = must(c, s, 0, { type: 'rematch' });
    c.now = at + REMATCH_WAIT_MS - 1;
    expect(adv(c, one).events.some((e) => e.type === 'rematchExpired')).toBe(false);
    c.now = at + REMATCH_WAIT_MS;
    expect(adv(c, one).events.some((e) => e.type === 'rematchExpired')).toBe(true);
    c.now = at + 1000;
    let both = must(c, one, 1, { type: 'rematch' });
    expect(both.status).toBe('placing');
    expect(both.matchSeq).toBe(2);
    for (const st of both.seats) expect(st).toMatchObject({ hintsEarned: 0, hints: [], skipNextFire: false, lastTauntRound: null, hideUsedMs: 0, placed: false });
    for (const seat of [0, 1] as const) both = must(c, both, seat, { type: 'place', ships: seat ? FLEET1 : FLEET0, confirm: true });
    expect(both.game!.matchId).not.toBe(m1);
    expect(both.game!.firstSeat).toBe(other(f1));
  });
});

// ─── ENG-26·27 순수성 + 상태기계 불변식 ──────────────────────────────────────

describe('ENG-27 상태기계 불변식(fast-check 5,000 시퀀스) + ENG-26 deep-freeze + SEC-01 투영 금지 키', () => {
  type Op =
    | { k: 'fire'; cell: number }
    | { k: 'answer'; seat: Seat; right: boolean }
    | { k: 'hint'; seat: Seat; cell: number }
    | { k: 'taunt'; seat: Seat; id: number }
    | { k: 'alarm'; seat: Seat; ms: number }
    | { k: 'wait'; ms: number; hide0: boolean; hide1: boolean; gone: number }
    | { k: 'resign'; seat: Seat }
    | { k: 'rematch'; seat: Seat };
  const op: fc.Arbitrary<Op> = fc.oneof(
    { weight: 8, arbitrary: fc.record({ k: fc.constant('fire' as const), cell: fc.integer({ min: 0, max: 63 }) }) },
    { weight: 2, arbitrary: fc.record({ k: fc.constant('answer' as const), seat: fc.constantFrom(0, 1) as fc.Arbitrary<Seat>, right: fc.boolean() }) },
    { weight: 1, arbitrary: fc.record({ k: fc.constant('hint' as const), seat: fc.constantFrom(0, 1) as fc.Arbitrary<Seat>, cell: fc.integer({ min: 0, max: 63 }) }) },
    { weight: 1, arbitrary: fc.record({ k: fc.constant('taunt' as const), seat: fc.constantFrom(0, 1) as fc.Arbitrary<Seat>, id: fc.integer({ min: -1, max: 10 }) }) },
    { weight: 1, arbitrary: fc.record({ k: fc.constant('alarm' as const), seat: fc.constantFrom(0, 1) as fc.Arbitrary<Seat>, ms: fc.integer({ min: 0, max: 10_000 }) }) },
    { weight: 4, arbitrary: fc.record({ k: fc.constant('wait' as const), ms: fc.integer({ min: 0, max: 25_000 }), hide0: fc.boolean(), hide1: fc.boolean(), gone: fc.integer({ min: 0, max: 3 }) }) },
    { weight: 1, arbitrary: fc.record({ k: fc.constant('resign' as const), seat: fc.constantFrom(0, 1) as fc.Arbitrary<Seat> }) },
    { weight: 1, arbitrary: fc.record({ k: fc.constant('rematch' as const), seat: fc.constantFrom(0, 1) as fc.Arbitrary<Seat> }) },
  );
  const forbidden = (v: unknown) => {
    const j = JSON.stringify(v);
    return VIEW_FORBIDDEN_KEYS.filter((k) => k !== 'reveal' && j.includes(`"${k}"`));
  };
  it('라운드 ≤ 30, 중복 사격 0, hintsEarned ≤ 2, hints ≤ earned, ended ⇔ result, 침몰 ≤ 3, 경보 ≤ 1(6~15·검산 중 0), throw 0, 입력 불변, 투영 금지 키 0', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1e9 }), fc.array(op, { minLength: 20, maxLength: 120 }), (seed, ops) => {
        const c = mkClock(seed);
        const rng = seededRng(seed);
        c.presence = bothFresh(c.now);
        let s = playing(c, { alarmOn: true, fleets: [randomFleet(rng), randomFleet(rng)] });
        let alarms = 0;
        let lastMatch = s.game!.matchId;
        const pres = (h0: boolean, h1: boolean, gone: number) => {
          const p0 = gone === 1 || gone === 3 ? null : fresh(c.now, h0 ? 'disguise' : 'game', c.now - 100);
          const p1 = gone === 2 || gone === 3 ? null : fresh(c.now, h1 ? 'disguise' : 'game', c.now - 100);
          return [p0, p1] as const;
        };
        let lastP = pres(false, false, 0);
        for (const o of ops) {
          deepFreeze(s);
          const ctx = (): EngineCtx => ({ ...ctxOf(c), presence: lastP });
          let next = s;
          if (o.k === 'wait') {
            c.now += o.ms;
            lastP = pres(o.hide0, o.hide1, o.gone);
            next = advance(s, ctx()).state;
          } else {
            const g = s.game;
            let body: Record<string, unknown> | null = null;
            let seat: Seat = 0;
            if (o.k === 'fire' && g) { seat = g.turn; body = { type: 'fire', cell: ALL_CELLS[o.cell] }; }
            if (o.k === 'answer' && g?.quiz) { seat = o.seat; next = markDelivered(s, seat, ctx()).state; body = { type: 'answer', quizId: g.quiz.id, value: (s.secret.quiz?.answer ?? 0) + (o.right ? 0 : 1) }; }
            if (o.k === 'hint') { seat = o.seat; body = { type: 'hint', target: { kind: 'block', cell: ALL_CELLS[o.cell] } }; }
            if (o.k === 'taunt') { seat = o.seat; body = { type: 'taunt', tauntId: o.id }; }
            if (o.k === 'resign') { seat = o.seat; body = { type: 'resign' }; }
            if (o.k === 'rematch') { seat = o.seat; body = { type: 'rematch' }; }
            if (o.k === 'alarm' && g?.alarm) next = reportAlarm(s, o.seat, { issuedAt: g.alarm.issuedAt, reactionMs: o.ms }, ctx()).state;
            if (body) {
              c.now += 50;
              const base = next;
              deepFreeze(base);
              const r = applyAction(base, seat, { actionId: id(), ...body } as never, ctx());
              if (r.ok) next = advance(r.state, ctx()).state;
              else if (r.ok === false) expect(r.error).toMatch(/NOT_YOUR_TURN|WRONG_PHASE|LOCKED|INVALID/);
            }
            if (next.status === 'placing') {
              for (const st of [0, 1] as const) {
                const r = applyAction(next, st, { actionId: id(), type: 'place', ships: randomFleet(rng), confirm: true }, ctx());
                if (r.ok) next = r.state;
              }
            }
          }
          const ng = next.game;
          if (ng && ng.matchId !== lastMatch) { alarms = 0; lastMatch = ng.matchId; }
          if (ng?.alarm && !s.game?.alarm) {
            alarms++;
            expect(ng.round).toBeGreaterThanOrEqual(6);
            expect(ng.round).toBeLessThanOrEqual(15);
            expect(ng.quiz).toBeNull();
          }
          expect(alarms).toBeLessThanOrEqual(1);
          if (ng) {
            expect(ng.round).toBeLessThanOrEqual(30);
            for (const seat of [0, 1] as const) {
              const cells = ng.shots[seat].map((x) => x.cell);
              expect(new Set(cells).size).toBe(cells.length);
              expect(ng.sunk[seat].length).toBeLessThanOrEqual(3);
              expect(next.seats[seat]!.hintsEarned).toBeLessThanOrEqual(2);
              expect(next.seats[seat]!.hints.length).toBeLessThanOrEqual(next.seats[seat]!.hintsEarned);
            }
          }
          expect(next.status === 'ended').toBe(next.result !== null);
          for (const seat of [0, 1] as const) {
            if (!next.seats[0] || !next.seats[1]) continue;
            const v = viewFor(next, seat, { version: 1, serverNow: c.now, bellTopic: 'mc:x', oppLastSeenAt: c.now, oppHidden: false });
            expect(forbidden(v)).toEqual([]);
            if (v.status !== 'ended') expect('reveal' in v).toBe(false);
            if (v.status === 'playing') {
              const oppCells = new Set(cellsOf(next.secret.boards[other(seat)]));
              const known = new Set([...v.game.myShots.map((x) => x.cell), ...v.game.sunkByMe.flatMap((p) => placementCells(p) ?? [])]);
              const ms = Math.max(-1, ...v.events.filter((e) => e.type === 'matchStarted').map((e) => e.seq));
              const j = JSON.stringify({ ...v, me: null, events: v.events.filter((e) => e.seq >= ms && !(e.type === 'fire' && e.by !== seat)), game: { ...v.game, oppShots: null, log: null } });
              for (const cell of oppCells) if (!known.has(cell)) expect(j.includes(`"${cell}"`), `미적중 상대 배 칸 ${cell}`).toBe(false);
            }
          }
          s = next;
        }
      }),
      { numRuns: 5000 },
    );
  }, 600_000);
});
