/**
 * 백엔드 QA 수정 회귀 테스트 (2026-11-08 · @백엔드팀장). 리포트 `docs/qa/monthly-close-bug-report.md`의
 * BUG-15·16(기획 판단 반영 — 기존 재현 테스트 없음, 새로 추가), BUG-09(재현은 HTTP 스크립트였음), BUG-11(로컬 재현은 HTTP S6).
 * BUG-03 재현은 기존 `pipeline.int.test.ts`(CON-02, ENG-12·13 실제 경로)를 it으로 전환했다.
 * 기록: docs/backend/monthly-close-qa-fixes.md
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALARM_REPORT_WAIT_MS, HINTS_PER_GAME, QUIZ_MS } from '../constants';
import { advance, applyAction, createRoomState, joinSeat, reportAlarm } from '../engine/core';
import { seededRng } from '../engine/rng';
import { FLEET0, FLEET1, bothFresh, ctxOf, emptyCells, mkClock, playing } from '../engine/testkit';
import type { EngineCtx, RoomState } from '../engine/types';
import type { ApiErr, RoomView, Seat } from '../protocol';
import { clientIp, hashKey, identityFromHeaders, type Identity } from '../server/auth';
import { defaultNickname, isBannedNickname, screenNickname } from '../server/nickname';
import { createRoomFlow, joinFlow, syncFlow, type Out, type PipelineDeps } from '../server/pipeline';
import { RateLimiter } from '../server/rate';
import { MemoryStore } from '../server/store-memory';
import { resetDbForTests } from '../server/db';

const other = (s: Seat): Seat => (s === 0 ? 1 : 0);
let aid = 0;

afterEach(() => {
  vi.unstubAllEnvs();
  resetDbForTests();
});

// ─── BUG-15 미뤄진 검산은 합치지 않는다(판당 3회) ─────────────────────────────────

/**
 * 판을 끝까지 미스로만 진행한다. 접속 신호는 `readyFrom` 라운드부터(그 라운드의 발사부터) 켠다.
 * 검산이 나오면 아무도 안 풀고 마감 뒤 확정시킨다. 반환: 출제 라운드 목록.
 */
function quizRounds(readyFrom: number, maxRound = 20, tweak?: (s: RoomState) => void): { rounds: number[]; s: RoomState } {
  const c = mkClock(15);
  let s = playing(c);
  const rounds: number[] = [];
  for (let i = 0; i < 400 && s.status === 'playing' && s.game!.round <= maxRound; i++) {
    tweak?.(s);
    const g = s.game!;
    if (g.phase === 'quiz') {
      rounds.push(g.round);
      c.now += QUIZ_MS + 2_500;
      c.presence = bothFresh(c.now);
      s = advance(s, ctxOf(c)).state;
      continue;
    }
    const seat = g.turn;
    const free = emptyCells(s.secret.boards[other(seat)]).filter((x) => !g.shots[seat].some((y) => y.cell === x));
    c.now += 1000;
    c.presence = g.round >= readyFrom ? bothFresh(c.now) : [null, null];
    const r = applyAction(s, seat, { actionId: `b15-${++aid}`, type: 'fire', cell: free[0] }, ctxOf(c));
    if (!r.ok) throw new Error(`fire ${r.error}`);
    s = advance(r.state, ctxOf(c)).state;
  }
  return { rounds, s };
}

describe('BUG-15 검산 판당 3회 유지 — 미뤄진 회차는 합치지 않고 라운드마다 하나씩', () => {
  it('조건이 늘 맞으면 4·8·12 그대로(회귀)', () => {
    expect(quizRounds(1).rounds).toEqual([4, 8, 12]);
  });

  it('4라운드분이 8라운드 출제 시점까지 밀리면 → 9(4라운드분)·10(8라운드분)·12, 합계 3회', () => {
    // 8라운드 발사부터 접속 → 8라운드 시작(7라운드 마지막 발사)까지는 조건 불충족
    expect(quizRounds(8).rounds).toEqual([9, 10, 12]);
  });

  it('세 회차가 모두 밀리면 13·14·15에 하나씩 차례로(한 라운드 2회 출제 없음)', () => {
    const { rounds } = quizRounds(12);
    expect(rounds).toEqual([13, 14, 15]);
    expect(new Set(rounds).size).toBe(rounds.length);
  });

  it('밀린 회차가 남아 있어도 둘 다 힌트 상한이면 더 내지 않는다(밀린 수도 비움)', () => {
    let maxed = false;
    const { rounds, s } = quizRounds(12, 20, (st) => {
      // 13라운드 첫 검산이 끝난 뒤 두 사람 모두 상한에 도달했다고 가정
      if (!maxed && st.game!.stats.quizzes.length === 1) {
        st.seats[0]!.hintsEarned = HINTS_PER_GAME;
        st.seats[1]!.hintsEarned = HINTS_PER_GAME;
        maxed = true;
      }
    });
    expect(rounds).toEqual([13]);
    expect(s.game!.pendingQuiz).toBe(false);
    expect(s.game!.quizBacklog).toBe(0);
  });

  it('판이 밀린 회차를 다 내기 전에 끝나면 그만(오류 없음)', () => {
    const { s } = quizRounds(12, 13);
    const after = applyAction(s, 0, { actionId: `b15-${++aid}`, type: 'resign' }, { now: 9e9, rng: seededRng(1), newId: () => 'x', presence: [null, null] });
    expect(after.ok && after.state.status).toBe('ended');
    expect(after.ok && after.state.game!.stats.quizzes.length).toBe(1);
  });
});

// ─── BUG-16 한 사람이 같은 자기 차례에 잃는 턴은 최대 1회 ─────────────────────────────

function alarmGame(): { s: RoomState; c: { now: number }; ctx: () => EngineCtx; turn: Seat } {
  const c = { now: 1_000_000 };
  const ctx = (): EngineCtx => ({ now: c.now, rng: seededRng(3), newId: () => 'm1', presence: [null, null] });
  let s = createRoomState({ code: '12345', keyHash: 'a'.repeat(64), nickname: '가', industry: 0, alarmOn: true });
  s = (joinSeat(s, { keyHash: 'b'.repeat(64), nickname: '나', industry: 1 }, ctx()) as { stepped: { state: RoomState } }).stepped.state;
  for (const seat of [0, 1] as const) {
    s = (applyAction(s, seat, { actionId: `p${seat}`, type: 'place', ships: seat ? FLEET1 : FLEET0, confirm: true }, ctx()) as { state: RoomState }).state;
  }
  const g = s.game!;
  g.alarm = { issuedAt: g.clock!.startedAt, reactionMs: [null, null] }; // 경보를 차례 시작과 같은 시각에 강제
  g.alarmDone = true;
  return { s, c, ctx, turn: g.turn };
}

function fireMiss(s: RoomState, ctx: EngineCtx): RoomState {
  const seat = s.game!.turn;
  const free = emptyCells(s.secret.boards[other(seat)]).filter((x) => !s.game!.shots[seat].some((y) => y.cell === x));
  const r = applyAction(s, seat, { actionId: `b16-${++aid}`, type: 'fire', cell: free[0] }, ctx);
  if (!r.ok) throw new Error(`fire ${r.error}`);
  return advance(r.state, ctx).state;
}

/** 지금부터 seat의 다음 "자기 차례" 시작까지 진행하며, 그 사이 seat의 skip 사건 수를 센다 */
function untilOwnTurn(s: RoomState, seat: Seat, c: { now: number }, ctx: () => EngineCtx): { s: RoomState; skips: number } {
  let skips = 0;
  const seen = new Set(s.events.map((e) => e.seq));
  for (let i = 0; i < 6; i++) {
    for (const e of s.events) {
      if (!seen.has(e.seq) && e.type === 'skip' && (e as { seat: Seat }).seat === seat) skips++;
      seen.add(e.seq);
    }
    if (s.game!.turn === seat && s.game!.clock !== null) return { s, skips };
    c.now += 1000;
    s = fireMiss(s, ctx());
  }
  throw new Error('own turn not reached');
}

describe('BUG-16 경보 실패 쉼 + 같은 차례 시간 초과 = 1턴 손실', () => {
  it('실패자가 그 차례 주인: 시간 초과가 쉼을 소진 → 다음 자기 차례는 정상(쉼 없음)', () => {
    const { s: s0, c, ctx, turn } = alarmGame();
    let s = reportAlarm(s0, turn, { issuedAt: s0.game!.alarm!.issuedAt, reactionMs: 4000 }, ctx()).state;
    c.now = s.game!.clock!.deadlineAt; // 경보 창(10초)과 차례(20초)가 한 번의 advance에서 함께 지남
    s = advance(s, ctx()).state;
    expect(s.events.filter((e) => e.type === 'timeout')).toHaveLength(1);
    expect(s.game!.stats.alarmOutcome![turn]).toBe('fail');
    expect(s.seats[turn]!.skipNextFire).toBe(false); // 시간 초과가 쉼을 소진
    const next = untilOwnTurn(s, turn, c, ctx);
    expect(next.skips).toBe(0);
    expect(next.s.game!.clock).not.toBeNull();
  });

  it('실패자가 그 차례 주인인데 시간 안에 쐈다: 쉼은 그대로 다음 자기 차례에 적용(벌칙 유지, 1턴)', () => {
    const { s: s0, c, ctx, turn } = alarmGame();
    let s = reportAlarm(s0, turn, { issuedAt: s0.game!.alarm!.issuedAt, reactionMs: 4000 }, ctx()).state;
    c.now = s0.game!.alarm!.issuedAt + ALARM_REPORT_WAIT_MS; // 판정만, 차례는 아직 진행 중
    s = advance(s, ctx()).state;
    expect(s.seats[turn]!.skipNextFire).toBe(true);
    c.now += 1000;
    s = fireMiss(s, ctx());
    const skipsBefore = s.events.filter((e) => e.type === 'skip' && (e as { seat: Seat }).seat === turn).length;
    // 상대 한 발 → 다음 라운드 내 차례는 skip 사건으로 넘어간다
    c.now += 1000;
    s = fireMiss(s, ctx());
    const skips = s.events.filter((e) => e.type === 'skip' && (e as { seat: Seat }).seat === turn).length - skipsBefore;
    expect(skips).toBe(1);
    expect(s.seats[turn]!.skipNextFire).toBe(false);
  });

  it('실패자가 상대(차례 주인은 시간 초과): 실패자는 다음 자기 차례 1회만 쉰다, 차례 주인은 시간 초과 1회만', () => {
    const { s: s0, c, ctx, turn } = alarmGame();
    const f = other(turn);
    let s = reportAlarm(s0, f, { issuedAt: s0.game!.alarm!.issuedAt, reactionMs: 4000 }, ctx()).state;
    c.now = s.game!.clock!.deadlineAt;
    s = advance(s, ctx()).state;
    const timeouts = s.events.filter((e) => e.type === 'timeout');
    expect(timeouts).toHaveLength(1);
    expect((timeouts[0] as { seat: Seat }).seat).toBe(turn);
    expect(s.events.filter((e) => e.type === 'skip').map((e) => (e as { seat: Seat }).seat)).toEqual([f]);
    expect(s.seats[f]!.skipNextFire).toBe(false);
    expect(s.seats[turn]!.skipNextFire).toBe(false);
  });
});

// ─── BUG-09 닉네임 금칙어 ─────────────────────────────────────────────────────────

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ident = (ch: string): Identity => ({ keyHash: hashKey(ch.repeat(32).slice(0, 32)), isTest: true, ip: '9.9.9.9' });
function mkDeps(): PipelineDeps {
  let n = 0;
  let code = 40000;
  return {
    store: new MemoryStore(),
    env: 'development',
    now: () => 60_000_000,
    rng: seededRng(9),
    newId: () => uuid(++n),
    randomCode: () => String(++code),
    bell: async () => undefined,
    limiter: new RateLimiter(),
  };
}
type Ok<T> = Extract<T, { ok: true }>;
function must<T>(out: Out<T>): Ok<T> {
  if (!(out.body as { ok: boolean }).ok) throw new Error(`expected ok, got ${(out.body as ApiErr).error}`);
  return out.body as Ok<T>;
}

describe('BUG-09 닉네임 금칙어 → 기본 닉네임으로 대체', () => {
  it('QA 재현 5종 + 끼워 넣기·자판 입력은 걸린다', () => {
    for (const bad of ['시발놈', '병신', '개새끼', 'ㅅㅂ', '씨발', '시 1 발', 'ㅅ.ㅂ', 'FUCK', 'tlqkf', '보지', '미친놈아']) {
      expect(isBannedNickname(bad), bad).toBe(true);
    }
  });

  it('보수적: 일상어·이름은 통과(부분 일치 오탐 방지)', () => {
    for (const good of ['김대리', '편집자35', '보지마', '자지마', '시바견', '등신대', '이애자', '새끼곰', '후쿠오카', 'fukuoka', '박과장']) {
      expect(isBannedNickname(good), good).toBe(false);
    }
  });

  it('기본 닉네임은 "편집자NN"(10~99), 같은 키면 같다. 정상 닉네임은 그대로', () => {
    const k = hashKey('a'.repeat(32));
    expect(defaultNickname(k)).toMatch(/^편집자[1-9]\d$/);
    expect(screenNickname('시발놈', k)).toBe(defaultNickname(k));
    expect(screenNickname('김대리', k)).toBe('김대리');
  });

  it('방 만들기·입장 실제 경로: 저장·내 화면·상대 화면 모두 기본 닉네임', async () => {
    const deps = mkDeps();
    const A = ident('a');
    const B = ident('b');
    const created = must(await createRoomFlow(deps, A, { nickname: '시발놈', industry: 0, alarmOn: false }));
    expect(created.view.me.nickname).toBe(defaultNickname(A.keyHash));
    const joined = must(await joinFlow(deps, created.code, B, { nickname: 'ㅅㅂ', industry: 1 }));
    expect(joined.view.me.nickname).toBe(defaultNickname(B.keyHash));
    const synced = must(await syncFlow(deps, created.code, A, { knownVersion: -1, view: 'game' })) as { view: RoomView };
    expect(synced.view.opp?.nickname).toBe(defaultNickname(B.keyHash));
    const snap = (await deps.store.load(created.code, deps.now()))!;
    expect(snap.players.map((p) => p?.nickname)).toEqual([defaultNickname(A.keyHash), defaultNickname(B.keyHash)]);
    expect(JSON.stringify(snap)).not.toMatch(/시발|ㅅㅂ/);
  });

  it('정상 닉네임 입장은 그대로(회귀)', async () => {
    const deps = mkDeps();
    const created = must(await createRoomFlow(deps, ident('c'), { nickname: '김대리', industry: 2, alarmOn: false }));
    expect(created.view.me.nickname).toBe('김대리');
  });
});

// ─── BUG-11 IP 버킷: Vercel에서는 플랫폼 헤더만 ─────────────────────────────────────

describe('BUG-11 클라이언트 IP — Vercel은 플랫폼 헤더, 로컬은 그대로', () => {
  const spoofed = () =>
    new Headers({ 'x-mc-key': '0'.repeat(32), 'x-forwarded-for': '6.6.6.6, 1.1.1.1', 'x-real-ip': '2.2.2.2', 'x-vercel-forwarded-for': '3.3.3.3' });

  it('Vercel: x-real-ip 우선 → 없으면 x-vercel-forwarded-for → 없으면 x-forwarded-for 첫 값', () => {
    expect(clientIp(spoofed(), true)).toBe('2.2.2.2');
    const h = spoofed();
    h.delete('x-real-ip');
    expect(clientIp(h, true)).toBe('3.3.3.3');
    h.delete('x-vercel-forwarded-for');
    expect(clientIp(h, true)).toBe('6.6.6.6');
    expect(clientIp(new Headers(), true)).toBe('unknown');
  });

  it('로컬: 예전 그대로 x-forwarded-for 첫 값(QA 스크립트의 버킷 분리 유지)', () => {
    expect(clientIp(spoofed(), false)).toBe('6.6.6.6');
    const h = spoofed();
    h.delete('x-forwarded-for');
    expect(clientIp(h, false)).toBe('2.2.2.2');
  });

  it('identityFromHeaders는 VERCEL=1이면 플랫폼 헤더를 쓴다(기본 인자 = 환경 변수)', () => {
    vi.stubEnv('VERCEL', '1');
    expect(identityFromHeaders(spoofed())!.ip).toBe('2.2.2.2');
    vi.stubEnv('VERCEL', '');
    expect(identityFromHeaders(spoofed())!.ip).toBe('6.6.6.6');
  });
});

