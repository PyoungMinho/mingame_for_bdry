/**
 * 월마감 게임 엔진 코어 (소유: API설계자). 순수 TS.
 *
 * 공개 진입점
 *  createRoomState · joinSeat · leave(액션) · advance(기한 처리) · markDelivered(검산 배달 기록) ·
 *  reportAlarm(경보 반응 보고) · applyAction(place/fire/answer/hint/taunt/rematch/resign/claimAbsent/leave)
 *
 * 규칙
 *  - 모든 함수는 입력 상태를 바꾸지 않고(structuredClone) 새 상태를 돌려준다. changed = false면 같은 객체를 그대로 돌려준다.
 *  - 시각·난수·id는 ctx로만 받는다.
 *  - 한 번의 advance()에서 발사 시간 초과는 최대 1회만 처리한다(둘 다 끊겼다 돌아와도 차례가 연쇄로 넘어가지 않음).
 *  - [QA 수정] 검산 확정은 settleAt 다음 ms부터(BUG-03), 미뤄진 검산은 합치지 않고 라운드마다 하나씩(BUG-15),
 *    경보 실패 쉼과 같은 차례의 시간 초과는 1턴 손실로 친다(BUG-16). docs/backend/monthly-close-qa-fixes.md
 *  - 검산·경보·시계 정지는 방향서 §3, 백엔드 D0 결정(docs/backend/monthly-close-d0-freeze.md)을 따른다.
 */

import {
  ABSENT_AFTER_TIMEOUTS,
  ALARM_HIDE_MS,
  ALARM_ROUND_MAX,
  ALARM_ROUND_MIN,
  EVENTS_KEEP,
  HIDE_BUDGET_MS,
  HINTS_PER_GAME,
  PLACE_MS,
  PRESENCE_MS,
  QUIZ_DELIVERY_GRACE_MS,
  QUIZ_MS,
  QUIZ_LOCK_MS,
  QUIZ_ROUNDS,
  REMATCH_WAIT_MS,
  ROUND_CAP,
  SUNK_TO_WIN,
  TAUNT_COUNT,
  TAUNT_GAP_ROUNDS,
  TURN_MS,
  ALARM_REPORT_WAIT_MS,
  type IndustryId,
} from '../constants';
import { isCellAddr, isHintTarget, placementCells, type CellAddr, type ShipPlacement } from '../coords';
import type {
  ActionBody,
  AlarmOutcome,
  EndReason,
  GameEventView,
  InvalidReason,
  Seat,
} from '../protocol';
import { checkFleet, completeFleet, countShipCellsInHint, fleetCells, judgeFire, normalizeFleet } from './placement';
import { awardedSeats, generateQuiz, gradeAnswer, seatQuizState, settlePlan } from './quiz';
import type {
  ActionResult,
  EngineCtx,
  EngineEffect,
  EngineErrorCode,
  GameState,
  QuizState,
  RoomState,
  SeatState,
  Stepped,
} from './types';

const ACTION_ID_KEEP = 16;

const other = (s: Seat): Seat => (s === 0 ? 1 : 0);
const SEATS = [0, 1] as const;

// ─── 실행 문맥 ────────────────────────────────────────────────────────────────

interface Run {
  s: RoomState;
  ctx: EngineCtx;
  fx: EngineEffect[];
  changed: boolean;
  /** 이번 advance에서 처리한 시간 초과 수 */
  timeouts: number;
}

function begin(state: RoomState, ctx: EngineCtx): Run {
  return { s: structuredClone(state), ctx, fx: [], changed: false, timeouts: 0 };
}

function done(state: RoomState, r: Run): Stepped {
  return r.changed ? { state: r.s, changed: true, effects: r.fx } : { state, changed: false, effects: [] };
}

function int(rng: () => number, lo: number, hi: number): number {
  return lo + Math.min(hi - lo, Math.floor(rng() * (hi - lo + 1)));
}

// ─── 생성·입장 ────────────────────────────────────────────────────────────────

function newSeat(keyHash: string, nickname: string, industry: IndustryId): SeatState {
  return {
    keyHash,
    nickname,
    industry,
    present: true,
    placed: false,
    actionIds: [],
    consecutiveTimeouts: 0,
    hintsEarned: 0,
    hints: [],
    quizLockUntil: null,
    skipNextFire: false,
    lastTauntRound: null,
    hideUsedMs: 0,
  };
}

function resetSeatForMatch(seat: SeatState): void {
  seat.placed = false;
  seat.consecutiveTimeouts = 0;
  seat.hintsEarned = 0;
  seat.hints = [];
  seat.quizLockUntil = null;
  seat.skipNextFire = false;
  seat.lastTauntRound = null;
  seat.hideUsedMs = 0;
}

export interface CreateRoomParams {
  code: string;
  keyHash: string;
  nickname: string;
  industry: IndustryId;
  alarmOn: boolean;
}

/** 새 방: 방장이 0번 자리, 대기 상태. */
export function createRoomState(p: CreateRoomParams): RoomState {
  return {
    code: p.code,
    alarmOn: p.alarmOn,
    status: 'waiting',
    matchSeq: 1,
    wins: [0, 0],
    draws: 0,
    seats: [newSeat(p.keyHash, p.nickname, p.industry), null],
    lastFirstSeat: null,
    prevMatchId: null,
    placeDeadlineAt: null,
    eventSeq: 0,
    events: [],
    rematch: { requested: [false, false], expiresAt: null },
    game: null,
    result: null,
    secret: { boards: [[], []], quiz: null, alarmRound: null },
  };
}

export function seatOfKey(state: RoomState, keyHash: string): Seat | null {
  for (const s of SEATS) if (state.seats[s]?.keyHash === keyHash) return s;
  return null;
}

/** 두 자리가 다 찼는가(ROOM_FULL 판정: 다른 키가 들어올 자리 없음). */
export function isFull(state: RoomState): boolean {
  return state.seats[0] !== null && state.seats[1] !== null;
}

function pushEvent(r: Run, e: Record<string, unknown> & { type: GameEventView['type'] }): void {
  const s = r.s;
  s.eventSeq += 1;
  s.events.push({ ...e, seq: s.eventSeq, at: r.ctx.now, round: s.game?.round ?? 0 } as unknown as GameEventView);
  if (s.events.length > EVENTS_KEEP) s.events.splice(0, s.events.length - EVENTS_KEEP);
  r.changed = true;
}

function bothPresent(s: RoomState): boolean {
  return s.seats[0] !== null && s.seats[1] !== null && s.seats[0].present && s.seats[1].present;
}

function startPlacing(r: Run): void {
  r.s.status = 'placing';
  r.s.placeDeadlineAt = r.ctx.now + PLACE_MS;
  r.changed = true;
}

export type JoinResult =
  | { ok: true; seat: Seat; rejoined: boolean; stepped: Stepped }
  | { ok: false; error: 'ROOM_FULL' };

/**
 * 입장·재입장. 같은 키면 원래 자리(닉네임·업종은 처음 값 유지). 새 키는 1번 자리가 비었을 때만.
 * 자리 확보 후 두 사람이 모두 자리에 있으면 대기 → 배치로 넘어간다(두 자리가 찬 시점부터 90초).
 */
export function joinSeat(
  state: RoomState,
  who: { keyHash: string; nickname: string; industry: IndustryId },
  ctx: EngineCtx,
): JoinResult {
  const r = begin(state, ctx);
  const s = r.s;
  const existing = seatOfKey(s, who.keyHash);
  if (existing !== null) {
    const seat = s.seats[existing] as SeatState;
    if (!seat.present) {
      seat.present = true;
      pushEvent(r, { type: 'joined', seat: existing });
    }
    if (s.status === 'waiting' && bothPresent(s)) startPlacing(r);
    return { ok: true, seat: existing, rejoined: true, stepped: done(state, r) };
  }
  if (s.seats[1] !== null) return { ok: false, error: 'ROOM_FULL' };
  s.seats[1] = newSeat(who.keyHash, who.nickname, who.industry);
  pushEvent(r, { type: 'joined', seat: 1 });
  if (s.status === 'waiting' && bothPresent(s)) startPlacing(r);
  return { ok: true, seat: 1, rejoined: false, stepped: done(state, r) };
}

// ─── 판 시작·종료 ──────────────────────────────────────────────────────────────

function startPlay(r: Run): void {
  const { s, ctx } = r;
  const firstSeat: Seat = s.lastFirstSeat === null ? (ctx.rng() < 0.5 ? 0 : 1) : other(s.lastFirstSeat);
  s.lastFirstSeat = firstSeat;
  s.status = 'playing';
  s.placeDeadlineAt = null;
  s.result = null;
  s.secret.quiz = null;
  s.secret.alarmRound = s.alarmOn ? int(ctx.rng, ALARM_ROUND_MIN, ALARM_ROUND_MAX) : null;
  const game: GameState = {
    matchId: ctx.newId(),
    startedAt: ctx.now,
    round: 1,
    phase: 'fire',
    turn: firstSeat,
    firstSeat,
    clock: null,
    shots: [[], []],
    sunk: [[], []],
    log: [],
    logSeq: 0,
    quiz: null,
    pendingQuiz: false,
    quizBacklog: 0,
    alarm: null,
    alarmDone: !s.alarmOn,
    stats: { quizzes: [], alarmOutcome: null },
  };
  s.game = game;
  r.fx.push({ type: 'matchStarted', matchId: game.matchId, seq: s.matchSeq, rematchOf: s.prevMatchId, startedAt: ctx.now });
  pushEvent(r, { type: 'matchStarted', first: firstSeat });
  beginRound(r, 1);
}

function endMatch(r: Run, winner: Seat | null, reason: EndReason): void {
  const { s, ctx } = r;
  const g = s.game as GameState;
  s.status = 'ended';
  s.result = { winner, reason, round: g.round };
  if (winner === null) s.draws += 1;
  else s.wins[winner] += 1;
  g.clock = null;
  g.quiz = null;
  g.alarm = null;
  s.secret.quiz = null;
  s.rematch = { requested: [false, false], expiresAt: null };
  pushEvent(r, { type: 'ended' });
  r.fx.push({
    type: 'matchEnded',
    matchId: g.matchId,
    seq: s.matchSeq,
    endedAt: ctx.now,
    reason,
    winner,
    rounds: g.round,
    hints: [s.seats[0]?.hintsEarned ?? 0, s.seats[1]?.hintsEarned ?? 0],
    quizzes: g.stats.quizzes,
    alarmOutcome: g.stats.alarmOutcome,
  });
  r.changed = true;
}

// ─── 라운드·차례 ───────────────────────────────────────────────────────────────

function presenceOk(r: Run, seat: Seat): boolean {
  const p = r.ctx.presence[seat];
  return p !== null && p.viewState === 'game' && r.ctx.now - p.lastSeenAt <= PRESENCE_MS;
}

/** 출제 조건(검산·경보 공통): 두 사람 모두 게임 화면이고 접속 신호가 PRESENCE_MS 이내. */
function bothReady(r: Run): boolean {
  return bothPresent(r.s) && presenceOk(r, 0) && presenceOk(r, 1);
}

function beginRound(r: Run, round: number): void {
  const { s, ctx } = r;
  const g = s.game as GameState;
  g.round = round;
  g.phase = 'fire';
  g.clock = null;
  if ((QUIZ_ROUNDS as readonly number[]).includes(round)) {
    // 판당 검산 횟수 유지(QA BUG-15): 앞 회차가 아직 미뤄져 있으면 합치지 않고 하나 더 쌓는다.
    if (g.pendingQuiz) g.quizBacklog = (g.quizBacklog ?? 0) + 1;
    else g.pendingQuiz = true;
  }
  if (g.pendingQuiz) {
    const eligible: [boolean, boolean] = [
      (s.seats[0] as SeatState).hintsEarned < HINTS_PER_GAME,
      (s.seats[1] as SeatState).hintsEarned < HINTS_PER_GAME,
    ];
    if (!eligible[0] && !eligible[1]) {
      g.pendingQuiz = false; // 둘 다 받을 수 있는 힌트가 없다 → 밀린 회차도 의미가 없다
      g.quizBacklog = 0;
    } else if (g.alarm === null && bothReady(r)) {
      const q = generateQuiz(ctx.rng, g.stats.quizzes.length ? g.stats.quizzes[g.stats.quizzes.length - 1].kind : null);
      const quiz: QuizState = {
        id: `q${round}-${int(ctx.rng, 100000, 999999)}`,
        kind: q.kind,
        values: q.values,
        labelSeed: q.labelSeed,
        issuedAt: ctx.now,
        eligible,
        deliveredAt: [null, null],
        elapsedMs: [null, null],
        expired: [false, false],
      };
      g.quiz = quiz;
      s.secret.quiz = { answer: q.answer };
      // 한 라운드에 하나만. 더 밀린 회차가 있으면 다음 라운드(조건이 되는 라운드)에 낸다.
      if ((g.quizBacklog ?? 0) > 0) g.quizBacklog -= 1;
      else g.pendingQuiz = false;
      g.phase = 'quiz';
      g.turn = g.firstSeat;
      pushEvent(r, { type: 'quizStarted' });
      return;
    }
  }
  tryIssueAlarm(r, round);
  beginTurn(r, g.firstSeat);
}

function tryIssueAlarm(r: Run, round: number): void {
  const { s, ctx } = r;
  const g = s.game as GameState;
  const ar = s.secret.alarmRound;
  if (g.alarmDone || ar === null || round < ar) return;
  if (round > ALARM_ROUND_MAX) {
    g.alarmDone = true; // 15라운드까지 조건이 한 번도 안 맞으면 이 판은 경보 없이
    return;
  }
  if (g.quiz !== null || g.alarm !== null || !bothReady(r)) return;
  g.alarm = { issuedAt: ctx.now, reactionMs: [null, null] };
  g.alarmDone = true;
  r.changed = true;
}

function beginTurn(r: Run, seat: Seat): void {
  const { s, ctx } = r;
  const g = s.game as GameState;
  g.turn = seat;
  g.phase = 'fire';
  const st = s.seats[seat] as SeatState;
  if (st.skipNextFire) {
    st.skipNextFire = false;
    pushEvent(r, { type: 'skip', seat });
    g.clock = null;
    endTurn(r);
    return;
  }
  g.clock = { startedAt: ctx.now, deadlineAt: ctx.now + TURN_MS, pause: null };
  r.changed = true;
}

function hitCount(g: GameState, seat: Seat): number {
  return g.shots[seat].filter((x) => x.result !== 'miss').length;
}

/** 차례가 끝난 뒤: 선공이었으면 후공 차례, 후공이었으면 라운드 종료 판정. */
function endTurn(r: Run): void {
  const { s } = r;
  const g = s.game as GameState;
  g.clock = null;
  if (g.turn === g.firstSeat) {
    beginTurn(r, other(g.firstSeat));
    return;
  }
  const a = g.sunk[0].length >= SUNK_TO_WIN;
  const b = g.sunk[1].length >= SUNK_TO_WIN;
  if (a && b) return endMatch(r, null, 'draw');
  if (a) return endMatch(r, 0, 'sunk2');
  if (b) return endMatch(r, 1, 'sunk2');
  if (g.round >= ROUND_CAP) {
    const h0 = hitCount(g, 0);
    const h1 = hitCount(g, 1);
    return endMatch(r, h0 === h1 ? null : h0 > h1 ? 0 : 1, 'cap');
  }
  beginRound(r, g.round + 1);
}

// ─── 기한 처리 (advance) ───────────────────────────────────────────────────────

function stepAlarm(r: Run): boolean {
  const { s, ctx } = r;
  const g = s.game;
  if (!g || !g.alarm || s.status !== 'playing') return false;
  const al = g.alarm;
  const allReported = al.reactionMs[0] !== null && al.reactionMs[1] !== null;
  if (!allReported && ctx.now < al.issuedAt + ALARM_REPORT_WAIT_MS) return false;
  // 무보고 판정 기준 시각 = 판정 창 끝(D0: "그 시점 lastSeen > PRESENCE_MS면 excluded"). 판정이 늦게 돌아도
  // 창 끝에 접속 중이던 사람이 '제외'로 빠지지 않게 한다(D3 R2). 둘 다 보고했으면 무보고자가 없으니 무관.
  const judgeAt = Math.min(ctx.now, al.issuedAt + ALARM_REPORT_WAIT_MS);
  const outcomes = SEATS.map((seat): AlarmOutcome => {
    const ms = al.reactionMs[seat];
    if (ms !== null) return ms <= ALARM_HIDE_MS ? 'pass' : 'fail';
    const p = ctx.presence[seat];
    // 보고가 없다: 창 끝 기준으로 접속이 끊겨 있었으면 벌칙 제외, 접속 중이었으면 실패
    return p !== null && judgeAt - p.lastSeenAt <= PRESENCE_MS ? 'fail' : 'excluded';
  }) as [AlarmOutcome, AlarmOutcome];
  for (const seat of SEATS) if (outcomes[seat] === 'fail') (s.seats[seat] as SeatState).skipNextFire = true;
  g.alarm = null;
  g.stats.alarmOutcome = outcomes;
  pushEvent(r, { type: 'alarmResult', outcomes });
  return true;
}

function finalizeQuiz(r: Run): void {
  const { s } = r;
  const g = s.game as GameState;
  const q = g.quiz as QuizState;
  const awarded = awardedSeats(q);
  for (const seat of awarded) (s.seats[seat] as SeatState).hintsEarned += 1;
  g.stats.quizzes.push({ round: g.round, kind: q.kind, awarded, elapsedMs: [q.elapsedMs[0], q.elapsedMs[1]] });
  pushEvent(r, { type: 'quizSettled', awarded, expired: awarded.length === 0 });
  g.quiz = null;
  s.secret.quiz = null;
  tryIssueAlarm(r, g.round);
  beginTurn(r, g.firstSeat);
}

function stepQuiz(r: Run): boolean {
  const { s, ctx } = r;
  const g = s.game;
  if (!g || !g.quiz || s.status !== 'playing') return false;
  const q = g.quiz;
  let changed = false;
  for (const seat of SEATS) {
    if (q.eligible[seat] && q.deliveredAt[seat] === null && ctx.now >= q.issuedAt + QUIZ_DELIVERY_GRACE_MS) {
      q.deliveredAt[seat] = q.issuedAt + 1000;
      changed = true;
    }
  }
  for (const seat of SEATS) {
    const d = q.deliveredAt[seat];
    if (seatQuizState(q, seat) === 'open' && d !== null && ctx.now > d + QUIZ_MS) {
      q.expired[seat] = true;
      changed = true;
    }
  }
  const plan = settlePlan(q);
  const openLeft = SEATS.some((seat) => seatQuizState(q, seat) === 'open');
  if (plan === null) {
    if (!openLeft) {
      finalizeQuiz(r);
      return true;
    }
  } else if (!plan.open) {
    finalizeQuiz(r);
    return true;
  } else if (ctx.now > plan.at) {
    // plan.at(= settleAt)은 남은 사람이 "아직 비길 수 있는 마지막 시각"이다(QUIZ_TIE_MS 이내 = 포함, 마감 deliveredAt + QUIZ_MS = 포함).
    // 그 시각 정각에 온 정답은 받아야 하므로 확정은 그 다음 ms부터. 액션 앞의 advance()가 정각 정답을 먼저 먹던 1ms 어긋남(QA BUG-03) 수정.
    for (const seat of SEATS) if (seatQuizState(q, seat) === 'open') q.expired[seat] = true;
    finalizeQuiz(r);
    return true;
  }
  if (changed) r.changed = true;
  return changed;
}

function autoPlaceMissing(r: Run): Seat[] {
  const { s, ctx } = r;
  const auto: Seat[] = [];
  for (const seat of SEATS) {
    const st = s.seats[seat] as SeatState;
    if (st.placed) continue;
    s.secret.boards[seat] = completeFleet(s.secret.boards[seat], ctx.rng);
    st.placed = true;
    auto.push(seat);
  }
  return auto;
}

function stepPlace(r: Run): boolean {
  const { s, ctx } = r;
  if (s.status !== 'placing' || s.placeDeadlineAt === null || ctx.now < s.placeDeadlineAt) return false;
  const auto = autoPlaceMissing(r);
  if (auto.length) pushEvent(r, { type: 'autoPlaced', seats: auto });
  startPlay(r);
  return true;
}

function stepRematch(r: Run): boolean {
  const { s, ctx } = r;
  if (s.status !== 'ended' || s.rematch.expiresAt === null || ctx.now < s.rematch.expiresAt) return false;
  s.rematch = { requested: [false, false], expiresAt: null };
  pushEvent(r, { type: 'rematchExpired' });
  return true;
}

/** 차례인 사람이 숨는 동안 발사 시계 정지(소급), 복귀·예산 소진 재개, 시간 초과(1회). */
function stepClock(r: Run): boolean {
  const { s, ctx } = r;
  const g = s.game;
  if (!g || s.status !== 'playing' || g.phase !== 'fire' || !g.clock) return false;
  const c = g.clock;
  const t = g.turn;
  const seat = s.seats[t] as SeatState;
  const p = ctx.presence[t];
  const hiddenNow = p !== null && p.viewState === 'disguise';
  const budgetLeft = Math.max(0, HIDE_BUDGET_MS - seat.hideUsedMs);

  if (c.pause === null) {
    if (hiddenNow && budgetLeft > 0 && p.viewStateAt < c.deadlineAt) {
      const since = Math.max(p.viewStateAt, c.startedAt);
      c.pause = { since, remainingMs: Math.max(0, c.deadlineAt - since) };
      r.changed = true;
      return true;
    }
  } else {
    const budgetEnds = c.pause.since + budgetLeft;
    if (!hiddenNow) {
      const showAt = p === null ? ctx.now : Math.max(p.viewStateAt, c.pause.since);
      const resumeAt = Math.min(showAt, budgetEnds);
      seat.hideUsedMs += Math.max(0, resumeAt - c.pause.since);
      c.deadlineAt = resumeAt + c.pause.remainingMs;
      c.pause = null;
      r.changed = true;
      return true;
    }
    if (ctx.now >= budgetEnds) {
      seat.hideUsedMs = HIDE_BUDGET_MS;
      c.deadlineAt = budgetEnds + c.pause.remainingMs;
      c.pause = null;
      pushEvent(r, { type: 'hideBudgetOut', seat: t });
      return true;
    }
    return false;
  }

  if (ctx.now >= c.deadlineAt && r.timeouts === 0) {
    r.timeouts += 1;
    seat.consecutiveTimeouts += 1;
    // 한 사람이 같은 자기 차례에 잃는 턴은 최대 1회(QA BUG-16, 기획 판단). beginTurn이 차례 시작 때 쉼을 먼저 소진하므로
    // 여기서 skipNextFire가 켜져 있으면 이 차례 도중 경보 실패로 걸린 것이다 → 이 시간 초과가 그 쉼을 소진한 것으로 본다.
    seat.skipNextFire = false;
    pushEvent(r, { type: 'timeout', seat: t });
    endTurn(r);
    return true;
  }
  return false;
}

/**
 * 지난 기한 처리(요청마다 먼저 호출). cron이 없으므로 sync·action이 올 때마다 돈다.
 * 처리 대상: 경보 판정, 검산 배달 보정·마감·확정, 배치 90초 자동 배치, 재대결 만료, 시계 정지·재개·시간 초과.
 */
export function advance(state: RoomState, ctx: EngineCtx): Stepped {
  const r = begin(state, ctx);
  for (let i = 0; i < 12; i++) {
    const a = stepAlarm(r);
    const b = stepQuiz(r);
    const c = stepPlace(r);
    const d = stepRematch(r);
    const e = stepClock(r);
    if (!(a || b || c || d || e)) break;
  }
  return done(state, r);
}

// ─── 검산 배달·경보 보고 (sync가 부르는 것) ───────────────────────────────────────

/**
 * 이 사람 응답에 검산을 처음 싣는 순간을 기록한다. 서버는 투영 전에 호출하고 저장한다(D0).
 * 이미 배달됐거나 풀 수 없는 자리면 변화 없음.
 */
export function markDelivered(state: RoomState, seat: Seat, ctx: EngineCtx): Stepped {
  const q = state.game?.quiz;
  if (!q || !q.eligible[seat] || q.deliveredAt[seat] !== null || state.status !== 'playing') {
    return { state, changed: false, effects: [] };
  }
  const r = begin(state, ctx);
  ((r.s.game as GameState).quiz as QuizState).deliveredAt[seat] = ctx.now;
  r.changed = true;
  return done(state, r);
}

/** 경보 반응 보고. issuedAt이 현재 경보와 다르거나 이미 보고했으면 무시. 둘 다 보고되면 즉시 판정. */
export function reportAlarm(state: RoomState, seat: Seat, rep: { issuedAt: number; reactionMs: number }, ctx: EngineCtx): Stepped {
  const al = state.game?.alarm;
  if (!al || al.issuedAt !== rep.issuedAt || al.reactionMs[seat] !== null) return { state, changed: false, effects: [] };
  const r = begin(state, ctx);
  ((r.s.game as GameState).alarm as NonNullable<GameState['alarm']>).reactionMs[seat] = rep.reactionMs;
  r.changed = true;
  stepAlarm(r);
  return done(state, r);
}

// ─── 액션 ────────────────────────────────────────────────────────────────────

type Fail = { ok: false; error: EngineErrorCode; reason?: InvalidReason };
const fail = (error: EngineErrorCode, reason?: InvalidReason): Fail => (reason ? { ok: false, error, reason } : { ok: false, error });

function closePause(r: Run): void {
  const g = r.s.game as GameState;
  const c = g.clock;
  if (!c || !c.pause) return;
  const seat = r.s.seats[g.turn] as SeatState;
  const left = Math.max(0, HIDE_BUDGET_MS - seat.hideUsedMs);
  seat.hideUsedMs += Math.min(left, Math.max(0, r.ctx.now - c.pause.since));
  c.pause = null;
}

/** 액션 하나 적용. 호출 전에 advance()로 기한 처리를 먼저 해 둘 것. 거부는 상태를 바꾸지 않는다. */
export function applyAction(state: RoomState, seat: Seat, body: ActionBody, ctx: EngineCtx): ActionResult {
  const me = state.seats[seat];
  if (!me) return fail('WRONG_PHASE');
  if (me.actionIds.includes(body.actionId)) return { ok: true, duplicate: true, state, changed: false, effects: [] };

  const r = begin(state, ctx);
  const res = dispatch(r, seat, body);
  if (res) return res;
  const mine = r.s.seats[seat];
  if (mine) {
    mine.actionIds.push(body.actionId);
    if (mine.actionIds.length > ACTION_ID_KEEP) mine.actionIds.splice(0, mine.actionIds.length - ACTION_ID_KEEP);
  }
  r.changed = true;
  return { ok: true, duplicate: false, state: r.s, changed: true, effects: r.fx };
}

/** null = 성공, Fail = 거부 */
function dispatch(r: Run, seat: Seat, body: ActionBody): Fail | null {
  switch (body.type) {
    case 'place':
      return doPlace(r, seat, body.ships, body.confirm);
    case 'fire':
      return doFire(r, seat, body.cell);
    case 'answer':
      return doAnswer(r, seat, body.quizId, body.value);
    case 'hint':
      return doHint(r, seat, body.target);
    case 'taunt':
      return doTaunt(r, seat, body.tauntId);
    case 'rematch':
      return doRematch(r, seat);
    case 'resign':
      if (r.s.status !== 'playing') return fail('WRONG_PHASE');
      endMatch(r, other(seat), 'resign');
      return null;
    case 'claimAbsent':
      return doClaimAbsent(r, seat);
    case 'leave':
      return doLeave(r, seat);
  }
}

function doPlace(r: Run, seat: Seat, ships: readonly ShipPlacement[], confirm: boolean): Fail | null {
  const s = r.s;
  if (s.status !== 'waiting' && s.status !== 'placing') return fail('WRONG_PHASE');
  const me = s.seats[seat] as SeatState;
  if (me.placed) return fail('INVALID', 'placed');
  const check = checkFleet(ships, confirm);
  if (!check.ok) return fail('INVALID', 'ships');
  s.secret.boards[seat] = normalizeFleet(ships);
  if (confirm) me.placed = true;
  if (s.status === 'placing' && bothPresent(s) && (s.seats[0] as SeatState).placed && (s.seats[1] as SeatState).placed) {
    startPlay(r);
  }
  return null;
}

function doFire(r: Run, seat: Seat, cell: CellAddr): Fail | null {
  const { s } = r;
  const g = s.game;
  if (s.status !== 'playing' || !g) return fail('WRONG_PHASE');
  if (g.phase !== 'fire') return fail('WRONG_PHASE');
  if (g.turn !== seat) return fail('NOT_YOUR_TURN');
  if (!isCellAddr(cell)) return fail('INVALID', 'cell');
  if (g.shots[seat].some((x) => x.cell === cell)) return fail('INVALID', 'already_fired');
  closePause(r);
  const opp = other(seat);
  const hitBefore = new Set(g.shots[seat].filter((x) => x.result !== 'miss').map((x) => x.cell));
  const j = judgeFire(s.secret.boards[opp], cell, hitBefore);
  g.shots[seat].push({ cell, result: j.result, round: g.round });
  if (j.result === 'sunk') {
    g.sunk[seat].push({ slot: j.ship.slot, start: j.ship.start, dir: j.ship.dir, round: g.round });
    pushEvent(r, { type: 'fire', by: seat, cell, result: 'sunk', slot: j.ship.slot });
  } else {
    pushEvent(r, { type: 'fire', by: seat, cell, result: j.result });
  }
  (s.seats[seat] as SeatState).consecutiveTimeouts = 0;
  endTurn(r);
  return null;
}

function doAnswer(r: Run, seat: Seat, quizId: string, value: number): Fail | null {
  const { s, ctx } = r;
  const g = s.game;
  if (s.status !== 'playing' || !g) return fail('WRONG_PHASE');
  const q = g.quiz;
  if (!q || g.phase !== 'quiz' || q.id !== quizId) return fail('INVALID', 'quiz_stale');
  if (!q.eligible[seat]) return fail('WRONG_PHASE');
  if (seatQuizState(q, seat) !== 'open') return fail('INVALID', 'quiz_stale');
  const me = s.seats[seat] as SeatState;
  if (me.quizLockUntil !== null && ctx.now < me.quizLockUntil) return fail('LOCKED');
  // 방어: 배달 기록 전에 도착한 답. 서버는 검산을 싣는 모든 응답에서 배달을 기록하므로 정상 경로에서는 오지 않는다.
  // 수신 시각으로 잡으면 경과 0ms로 무조건 이기므로(D3 R1) 가장 이른 가능 시각인 출제 시각으로 잡는다.
  if (q.deliveredAt[seat] === null) q.deliveredAt[seat] = q.issuedAt;
  const delivered = q.deliveredAt[seat] as number;
  if (ctx.now > delivered + QUIZ_MS) {
    q.expired[seat] = true;
    stepQuiz(r);
    return fail('INVALID', 'quiz_stale');
  }
  if (gradeAnswer((s.secret.quiz as { answer: number }).answer, value)) {
    q.elapsedMs[seat] = Math.max(0, ctx.now - delivered);
    me.quizLockUntil = null;
  } else {
    me.quizLockUntil = ctx.now + QUIZ_LOCK_MS;
  }
  stepQuiz(r);
  return null;
}

function doHint(r: Run, seat: Seat, target: unknown): Fail | null {
  const { s, ctx } = r;
  const g = s.game;
  if (s.status !== 'playing' || !g) return fail('WRONG_PHASE');
  if (!isHintTarget(target)) return fail('INVALID', 'body');
  const me = s.seats[seat] as SeatState;
  if (me.hintsEarned - me.hints.length <= 0) return fail('INVALID', 'no_hint');
  if (g.phase === 'quiz' || g.alarm !== null) return fail('INVALID', 'hint_blocked');
  const value = countShipCellsInHint(s.secret.boards[other(seat)], target);
  me.hints.push({ target, value, round: g.round, at: ctx.now });
  g.logSeq += 1;
  g.log.push({ seq: g.logSeq, at: ctx.now, round: g.round, by: seat, type: 'hint', target });
  return null;
}

function doTaunt(r: Run, seat: Seat, tauntId: number): Fail | null {
  const { s, ctx } = r;
  const g = s.game;
  if (s.status !== 'playing' || !g) return fail('WRONG_PHASE');
  if (!Number.isInteger(tauntId) || tauntId < 0 || tauntId >= TAUNT_COUNT) return fail('INVALID', 'taunt_id');
  const me = s.seats[seat] as SeatState;
  const next = me.lastTauntRound === null ? 1 : me.lastTauntRound + TAUNT_GAP_ROUNDS;
  if (g.round < next) return fail('INVALID', 'taunt_cooldown');
  me.lastTauntRound = g.round;
  g.logSeq += 1;
  g.log.push({ seq: g.logSeq, at: ctx.now, round: g.round, by: seat, type: 'taunt', tauntId });
  return null;
}

function doClaimAbsent(r: Run, seat: Seat): Fail | null {
  const { s } = r;
  if (s.status !== 'playing') return fail('WRONG_PHASE');
  const oppSeat = s.seats[other(seat)] as SeatState;
  if (oppSeat.consecutiveTimeouts < ABSENT_AFTER_TIMEOUTS) return fail('INVALID', 'absent_not_allowed');
  endMatch(r, seat, 'absent');
  return null;
}

function resetForNextMatch(r: Run): void {
  const { s } = r;
  s.matchSeq += 1;
  s.prevMatchId = s.game?.matchId ?? null;
  for (const seat of SEATS) resetSeatForMatch(s.seats[seat] as SeatState);
  s.secret = { boards: [[], []], quiz: null, alarmRound: null };
  s.game = null;
  s.result = null;
  s.rematch = { requested: [false, false], expiresAt: null };
  startPlacing(r);
}

function doRematch(r: Run, seat: Seat): Fail | null {
  const { s, ctx } = r;
  if (s.status !== 'ended') return fail('WRONG_PHASE');
  if (!bothPresent(s)) return fail('INVALID', 'rematch_closed');
  if (s.rematch.requested[seat]) return null; // 이미 눌렀다: 변화 없음(중복 허용)
  s.rematch.requested[seat] = true;
  if (s.rematch.expiresAt === null) s.rematch.expiresAt = ctx.now + REMATCH_WAIT_MS;
  pushEvent(r, { type: 'rematchRequested', seat });
  r.fx.push({ type: 'rematchRequested', seat, matchId: s.game?.matchId ?? '' });
  if (s.rematch.requested[0] && s.rematch.requested[1]) resetForNextMatch(r);
  return null;
}

function doLeave(r: Run, seat: Seat): Fail | null {
  const { s } = r;
  if (s.status === 'playing') {
    endMatch(r, other(seat), 'resign'); // 대전 중 나가기 = 기권
    (s.seats[seat] as SeatState).present = false;
    pushEvent(r, { type: 'left', seat });
    return null;
  }
  const me = s.seats[seat] as SeatState;
  if (s.status === 'ended') {
    me.present = false;
    s.rematch = { requested: [false, false], expiresAt: null };
    pushEvent(r, { type: 'left', seat });
    return null;
  }
  // waiting · placing
  if (seat === 1) {
    s.seats[1] = null; // 손님 자리는 비워 새 사람이 들어올 수 있게
    s.secret.boards[1] = [];
  } else {
    me.present = false; // 방장 자리는 같은 키의 재입장을 위해 남긴다
  }
  s.status = 'waiting';
  s.placeDeadlineAt = null;
  pushEvent(r, { type: 'left', seat });
  return null;
}

// ─── 보조: 읽기 전용 ──────────────────────────────────────────────────────────

export function ownCells(state: RoomState, seat: Seat): Set<CellAddr> {
  return fleetCells(state.secret.boards[seat]);
}

export function placementsValid(state: RoomState, seat: Seat): boolean {
  return state.secret.boards[seat].every((p) => placementCells(p) !== null);
}
