/**
 * 정지 화면용 고정 RoomView (G0-5 미리보기·셸 눈테스트·mock 컨트롤러).
 * 셀 상태 8종이 한 화면에 보이도록 짠 대전 중 판:
 *   빈칸 · 내 항목 · 내 항목 반려(취소선) · 내 판의 해당 없음(0) · 상대 판의 해당 없음(0) · 반려(1) · 종결(짧은 이름) · (종료 후 공개 = ended 변형)
 * 선택 칸은 화면 상태(클라이언트)라서 view에 없다.
 */

import type { CellAddr, ShipPlacement } from '../coords';
import type { IndustryId } from '../constants';
import type { EndedView, GameEventView, PlayingView, ShotView } from '../protocol';

const T0 = 1_760_000_000_000;

const MY_SHIPS: readonly ShipPlacement[] = [
  { slot: 'L4', start: 'B2', dir: 'h' },
  { slot: 'L3', start: 'D4', dir: 'v' },
  { slot: 'L2', start: 'F7', dir: 'h' },
];
const OPP_SHIPS: readonly ShipPlacement[] = [
  { slot: 'L4', start: 'C1', dir: 'h' },
  { slot: 'L3', start: 'G3', dir: 'v' },
  { slot: 'L2', start: 'A6', dir: 'h' },
];

const shot = (cell: CellAddr, result: ShotView['result'], round: number): ShotView => ({ cell, result, round });

export function mockPlayingView(industry: IndustryId = 0, now: number = T0): PlayingView {
  const events: GameEventView[] = [{ seq: 1, at: now - 60_000, round: 1, type: 'matchStarted', first: 0 }];
  return {
    status: 'playing',
    room: { code: '48291', version: 12, matchSeq: 1, alarmOn: true, record: { wins: [2, 1], draws: 0 }, bellTopic: 'mc:mock' },
    me: {
      seat: 0,
      nickname: '편집자37',
      industry,
      placed: true,
      consecutiveTimeouts: 0,
      ships: MY_SHIPS,
      hideBudgetMs: 120_000,
      hintsEarned: 1,
      hintsAvailable: 1,
      hints: [],
      quizLockUntil: null,
      skipNextFire: false,
      nextTauntRound: 1,
    },
    opp: { seat: 1, nickname: '편집자52', industry, placed: true, consecutiveTimeouts: 0, present: true, lastSeenAt: now, hidden: false },
    events,
    game: {
      matchId: 'mock-match',
      round: 6,
      phase: 'fire',
      turn: 0,
      firstSeat: 0,
      clock: { state: 'running', deadlineAt: now + 14_000 },
      // 내가 상대 판에 쏜 것: 해당 없음 3, 반려 2, 종결 1(L2)
      myShots: [
        shot('A1', 'miss', 1),
        shot('H8', 'miss', 2),
        shot('E5', 'miss', 3),
        shot('C1', 'hit', 4),
        shot('G3', 'hit', 5),
        shot('A6', 'hit', 5),
        shot('B6', 'sunk', 5),
      ],
      // 상대가 내 판에 쏜 것: 해당 없음 3, 반려 1(취소선), 종결 0
      oppShots: [shot('H1', 'miss', 1), shot('A8', 'miss', 2), shot('E8', 'miss', 3), shot('B2', 'hit', 4)],
      sunkByMe: [{ slot: 'L2', start: 'A6', dir: 'h', round: 5 }],
      sunkByOpp: [],
      log: [{ seq: 1, at: now - 30_000, round: 3, by: 1, type: 'hint', target: { kind: 'col', col: 'E' } }],
      quiz: null,
      alarm: null,
    },
  };
}

export function mockEndedView(industry: IndustryId = 0, now: number = T0): EndedView {
  const p = mockPlayingView(industry, now);
  return {
    status: 'ended',
    room: { ...p.room, version: 20 },
    me: p.me,
    opp: p.opp,
    events: [...p.events, { seq: 2, at: now, round: 9, type: 'ended' }],
    game: {
      ...p.game,
      round: 9,
      clock: { state: 'paused', reason: 'quiz', remainingMs: 0 },
      sunkByMe: [
        { slot: 'L2', start: 'A6', dir: 'h', round: 5 },
        { slot: 'L4', start: 'C1', dir: 'h', round: 9 },
      ],
      myShots: [...p.game.myShots, shot('D1', 'hit', 8), shot('E1', 'hit', 8), shot('F1', 'sunk', 9)],
    },
    result: { winner: 0, reason: 'sunk2', round: 9 },
    reveal: OPP_SHIPS,
    rematch: { requested: [false, false], expiresAt: null },
  };
}

/** 자리가 생기기 전·예외 화면에서 훅 호출 규칙을 지키기 위한 빈 대기 view (그리지 않는다) */
export function blankWaitingView(industry: IndustryId = 0): import('../protocol').WaitingView {
  return {
    status: 'waiting',
    room: { code: '00000', version: 0, matchSeq: 1, alarmOn: true, record: { wins: [0, 0], draws: 0 }, bellTopic: '' },
    me: {
      seat: 0, nickname: '', industry, placed: false, consecutiveTimeouts: 0, ships: [], hideBudgetMs: 0, hintsEarned: 0,
      hintsAvailable: 0, hints: [], quizLockUntil: null, skipNextFire: false, nextTauntRound: 1,
    },
    opp: null,
    events: [],
  };
}
