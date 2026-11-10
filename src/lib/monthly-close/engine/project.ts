/**
 * 투영: 상태(RoomState) → 보는 사람별 화면 데이터(RoomView). 순수 TS — 서버 view.ts와 연습 모드(브라우저)가 같이 쓴다.
 *
 * 허용 목록 방식: 원본을 복사해 비밀을 지우지 않는다. 필드를 하나씩 읽어 새 객체를 만든다.
 * 이 파일이 읽는 비밀 필드는 딱 둘이다.
 *   - secret.boards[seat]      : 내 배(me.ships)
 *   - secret.boards[opp]       : 판이 끝난 뒤(status = 'ended')에만, reveal로
 * 그 밖의 비밀(secret.quiz.answer, secret.alarmRound, seats[n].keyHash·actionIds, quiz.deliveredAt,
 * alarm.reactionMs, 상대 hints·quizLockUntil)은 읽지 않는다.
 */

import { HIDE_BUDGET_MS, HINTS_PER_GAME, QUIZ_MS, TAUNT_GAP_ROUNDS, TURN_MS } from '../constants';
import type {
  AlarmView,
  EndedView,
  GameView,
  MeView,
  OppView,
  PlacingView,
  PlayingView,
  QuizView,
  RoomInfo,
  RoomView,
  Seat,
  TurnClock,
  WaitingView,
} from '../protocol';
import { seatQuizState, settlePlan } from './quiz';
import type { GameState, RoomState, SeatState } from './types';

export interface ProjectCtx {
  readonly version: number;
  readonly serverNow: number;
  /** `mc:<방 UUID>` — 연습 모드는 빈 문자열 */
  readonly bellTopic: string;
  /** 상대 접속 정보(버전 없는 값) */
  readonly oppLastSeenAt: number;
  readonly oppHidden: boolean;
}

const other = (s: Seat): Seat => (s === 0 ? 1 : 0);

function meView(s: RoomState, seat: Seat, ctx: ProjectCtx): MeView {
  const st = s.seats[seat] as SeatState;
  const g = s.game;
  let used = st.hideUsedMs;
  if (g?.clock?.pause && g.turn === seat) used += Math.max(0, Math.min(HIDE_BUDGET_MS - used, ctx.serverNow - g.clock.pause.since));
  return {
    seat,
    nickname: st.nickname,
    industry: st.industry,
    placed: st.placed,
    consecutiveTimeouts: st.consecutiveTimeouts,
    ships: s.secret.boards[seat].map((p) => ({ slot: p.slot, start: p.start, dir: p.dir })),
    hideBudgetMs: Math.max(0, HIDE_BUDGET_MS - used),
    hintsEarned: Math.min(HINTS_PER_GAME, st.hintsEarned),
    hintsAvailable: Math.max(0, st.hintsEarned - st.hints.length),
    hints: st.hints.map((h) => ({ target: h.target, value: h.value, round: h.round, at: h.at })),
    quizLockUntil: st.quizLockUntil !== null && st.quizLockUntil > ctx.serverNow ? st.quizLockUntil : null,
    skipNextFire: st.skipNextFire,
    nextTauntRound: st.lastTauntRound === null ? 1 : st.lastTauntRound + TAUNT_GAP_ROUNDS,
  };
}

function oppView(s: RoomState, seat: Seat, ctx: ProjectCtx): OppView {
  const o = other(seat);
  const st = s.seats[o] as SeatState;
  return {
    seat: o,
    nickname: st.nickname,
    industry: st.industry,
    placed: st.placed,
    consecutiveTimeouts: st.consecutiveTimeouts,
    present: st.present,
    lastSeenAt: ctx.oppLastSeenAt,
    hidden: ctx.oppHidden,
  };
}

function clockView(g: GameState): TurnClock {
  if (g.phase === 'quiz' || !g.clock) return { state: 'paused', reason: 'quiz', remainingMs: TURN_MS };
  if (g.clock.pause) {
    return {
      state: 'paused',
      reason: 'hidden',
      remainingMs: g.clock.pause.remainingMs,
      budgetEndsAt: 0, // 아래 gameView에서 채운다(좌석별 예산이 필요)
    };
  }
  return { state: 'running', deadlineAt: g.clock.deadlineAt };
}

function quizView(s: RoomState, seat: Seat, ctx: ProjectCtx): QuizView | null {
  const q = s.game?.quiz;
  if (!q || !q.eligible[seat]) return null;
  const delivered = q.deliveredAt[seat];
  const base = {
    id: q.id,
    kind: q.kind,
    values: [...q.values],
    labelSeed: q.labelSeed,
    deadlineAt: (delivered ?? ctx.serverNow) + QUIZ_MS,
  };
  const mine = seatQuizState(q, seat);
  if (mine === 'correct' || mine === 'expired') {
    const plan = settlePlan(q);
    const settleAt = plan && plan.open ? plan.at : null;
    return { ...base, mine, status: settleAt === null ? 'open' : 'settling', settleAt };
  }
  return { ...base, mine: 'open', status: 'open', settleAt: null };
}

function alarmView(g: GameState, seat: Seat): AlarmView | null {
  if (!g.alarm) return null;
  return { issuedAt: g.alarm.issuedAt, reported: g.alarm.reactionMs[seat] !== null };
}

function gameView(s: RoomState, seat: Seat, ctx: ProjectCtx): GameView {
  const g = s.game as GameState;
  const o = other(seat);
  let clock = clockView(g);
  if (clock.state === 'paused' && clock.reason === 'hidden' && g.clock?.pause) {
    const turnSeat = s.seats[g.turn] as SeatState;
    clock = { ...clock, budgetEndsAt: g.clock.pause.since + Math.max(0, HIDE_BUDGET_MS - turnSeat.hideUsedMs) };
  }
  return {
    matchId: g.matchId,
    round: g.round,
    phase: g.phase,
    turn: g.turn,
    firstSeat: g.firstSeat,
    clock,
    myShots: g.shots[seat].map((x) => ({ cell: x.cell, result: x.result, round: x.round })),
    oppShots: g.shots[o].map((x) => ({ cell: x.cell, result: x.result, round: x.round })),
    sunkByMe: g.sunk[seat].map((x) => ({ slot: x.slot, start: x.start, dir: x.dir, round: x.round })),
    sunkByOpp: g.sunk[o].map((x) => ({ slot: x.slot, round: x.round })),
    log: g.log.map((l) =>
      l.type === 'hint'
        ? { seq: l.seq, at: l.at, round: l.round, by: l.by, type: 'hint' as const, target: l.target }
        : { seq: l.seq, at: l.at, round: l.round, by: l.by, type: 'taunt' as const, tauntId: l.tauntId },
    ),
    quiz: quizView(s, seat, ctx),
    alarm: alarmView(g, seat),
  };
}

function roomInfo(s: RoomState, ctx: ProjectCtx): RoomInfo {
  return {
    code: s.code,
    version: ctx.version,
    matchSeq: s.matchSeq,
    alarmOn: s.alarmOn,
    record: { wins: [s.wins[0], s.wins[1]], draws: s.draws },
    bellTopic: ctx.bellTopic,
  };
}

function eventsView(s: RoomState) {
  // 사건은 두 자리에 똑같이 보내도 되는 것만 담겨 있다(엔진이 그렇게만 만든다). 그래도 새 객체로 복사한다.
  return s.events.map((e) => ({ ...e }));
}

/** viewFor(state, seat): 보는 사람의 화면 데이터. 자리가 비어 있으면 throw. */
export function viewFor(s: RoomState, seat: Seat, ctx: ProjectCtx): RoomView {
  const common = { room: roomInfo(s, ctx), me: meView(s, seat, ctx), events: eventsView(s) };
  const o = s.seats[other(seat)];
  if (s.status === 'waiting' || !o) {
    const v: WaitingView = { ...common, status: 'waiting', opp: null };
    return v;
  }
  if (s.status === 'placing') {
    const v: PlacingView = {
      ...common,
      status: 'placing',
      opp: oppView(s, seat, ctx),
      placeDeadlineAt: s.placeDeadlineAt ?? ctx.serverNow,
    };
    return v;
  }
  if (s.status === 'playing') {
    const v: PlayingView = { ...common, status: 'playing', opp: oppView(s, seat, ctx), game: gameView(s, seat, ctx) };
    return v;
  }
  const res = s.result as NonNullable<RoomState['result']>;
  const v: EndedView = {
    ...common,
    status: 'ended',
    opp: oppView(s, seat, ctx),
    game: gameView(s, seat, ctx),
    result: { winner: res.winner, reason: res.reason, round: res.round },
    reveal: s.secret.boards[other(seat)].map((p) => ({ slot: p.slot, start: p.start, dir: p.dir })),
    rematch: { requested: [s.rematch.requested[0], s.rematch.requested[1]], expiresAt: s.rematch.expiresAt },
  };
  return v;
}
