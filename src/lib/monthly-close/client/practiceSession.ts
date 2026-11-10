/**
 * 박대리 연습 세션 (서버·지표 없음, 브라우저 안에서만 돈다).
 *
 * UX §2-5의 8컷 각본을 그대로 따르는 작은 상태 기계다. 박대리의 배치는 고정이고 사격은 각본(+이후 남은 칸 순서)이라
 * 박대리가 이길 수 없다. 이 클래스는 React를 모른다 — usePracticeRoom이 감싸고, 테스트는 직접 부른다.
 *
 * 컷 진행 (cut / coachLine = common.practice.coach 인덱스)
 *  1 첫 발                      coach 0 (칸을 고르면 UI가 1로 바꿔 보여 줄 수 있다)
 *  2 결과 메모 읽기(4.5초)       coach 2
 *  3 [의견 남기기] 1회           coach 3  → 박대리가 박대리 도발로 응수, 곧바로 검산 시작
 *  4 검산 정답                   coach 4  (오답 #VALUE! 3초 체험, 10초 만료면 새 문제)
 *  5 [Σ] 힌트 1회                coach 5
 *  6 Tab 숨기기 → 게임 탭 복귀    coach 6  (hide→show를 모두 봐야 다음 컷)
 *  7 결재 경보                   coach 7(4초) → 8(경보 중) → 9(통과 직후 5초). 벌칙 없음
 *  8 마무리                      coach 10. 한 척 더 종결하면 끝
 */

import { ALL_CELLS, hintRange, placementCells, rangeContains, type CellAddr, type HintTarget, type ShipPlacement } from '../coords';
import {
  ALARM_HIDE_MS,
  ALARM_REPORT_WAIT_MS,
  EVENTS_KEEP,
  HINTS_PER_GAME,
  QUIZ_LOCK_MS,
  QUIZ_MS,
  ROUND_CAP,
  SHIP_LENGTH,
  SUNK_TO_WIN,
  TAUNT_GAP_ROUNDS,
  TURN_MS,
  type IndustryId,
  type ShipSlot,
} from '../constants';
import type {
  AlarmView,
  EndedView,
  GameEventView,
  GameView,
  LogEntry,
  MeView,
  MyHint,
  MySunkView,
  OppView,
  PlayingView,
  QuizView,
  RoomView,
  ShotResult,
  ShotView,
  SunkView,
  TauntId,
  ViewState,
} from '../protocol';
import type { ActionOutcome, PracticeInfo } from './controller';

/** 코치 문장 인덱스(common.practice.coach) */
export const COACH = {
  firstFire: 0,
  selected: 1,
  memo: 2,
  taunt: 3,
  quiz: 4,
  hint: 5,
  tab: 6,
  autoHide: 7,
  alarm: 8,
  alarmDone: 9,
  finish: 10,
  hiddenHint: 11,
} as const;

export const PRACTICE_TOTAL_CUTS = 8;
export const PRACTICE_CODE = '00000';
/** 박대리 배치(고정). 내 배치(고정). */
export const PARTNER_SHIPS: readonly ShipPlacement[] = [
  { slot: 'L4', start: 'B2', dir: 'h' },
  { slot: 'L3', start: 'G4', dir: 'v' },
  { slot: 'L2', start: 'D7', dir: 'h' },
];
export const MY_SHIPS: readonly ShipPlacement[] = [
  { slot: 'L4', start: 'A5', dir: 'h' },
  { slot: 'L3', start: 'F1', dir: 'v' },
  { slot: 'L2', start: 'B7', dir: 'h' },
];
/** 박대리 사격 각본(내 배는 F1 한 번만 맞힌다). 이후엔 남은 칸을 순서대로, 내 배 칸은 건너뛴다 */
const PARTNER_SCRIPT: readonly CellAddr[] = ['H8', 'E4', 'F1', 'A8', 'D6', 'H1', 'G2', 'E8', 'H3', 'C3', 'A1', 'D8'];

const COACH_MEMO_MS = 4500;
const AUTO_HIDE_COACH_MS = 4000;
const ALARM_DONE_COACH_MS = 5000;
const PARTNER_NICK_FALLBACK = '박대리';

export interface PracticeOptions {
  readonly industry: IndustryId;
  readonly now?: () => number;
  /** 내 닉네임(상단바용). 연습은 표시용일 뿐 */
  readonly nickname?: string;
  /** 박대리 표시 이름(copy.practice.partnerName). 순환 import를 피하려고 주입한다 */
  readonly partnerName?: string;
}

interface Quiz {
  readonly id: string;
  readonly values: readonly number[];
  readonly answer: number;
  readonly labelSeed: number;
  readonly issuedAt: number;
}

export type PracticeListener = () => void;

export class PracticeSession {
  private readonly nowFn: () => number;
  private readonly industry: IndustryId;
  private readonly nick: string;
  private readonly partner: string;
  private readonly listeners = new Set<PracticeListener>();

  private version = 1;
  private eventSeq = 0;
  private events: GameEventView[] = [];
  private round = 1;
  private myShots: ShotView[] = [];
  private oppShots: ShotView[] = [];
  private sunkByMe: SunkView[] = [];
  private sunkByOpp: MySunkView[] = [];
  private log: LogEntry[] = [];
  private logSeq = 0;
  private hints: MyHint[] = [];
  private hintsEarned = 0;
  private nextTauntRound = 1;
  private quiz: Quiz | null = null;
  private quizLockUntil: number | null = null;
  private quizSerial = 0;
  private clockDeadline: number;
  private cut = 1;
  private cutEnteredAt: number;
  private firstFireAt: number | null = null;
  private hidOnce = false;
  private viewState: ViewState = 'game';
  private returnAt: number | null = null;
  private alarmAt: number | null = null;
  private alarm: AlarmView | null = null;
  private alarmDoneAt: number | null = null;
  private ended: { winner: 0 | 1 | null; reason: 'sunk2' | 'cap' } | null = null;
  private partnerTaunt: { seq: number; index: number } | null = null;
  private partnerScriptIdx = 0;
  private viewCache: RoomView;
  private lastCoach: number | null = COACH.firstFire;

  constructor(opts: PracticeOptions) {
    this.nowFn = opts.now ?? (() => Date.now());
    this.industry = opts.industry;
    this.nick = opts.nickname ?? '나';
    this.partner = opts.partnerName ?? PARTNER_NICK_FALLBACK;
    const t = this.nowFn();
    this.cutEnteredAt = t;
    this.clockDeadline = t + TURN_MS;
    // 시작 시 박대리의 L2가 이미 종결
    this.myShots.push({ cell: 'D7', result: 'hit', round: 0 }, { cell: 'E7', result: 'sunk', round: 0 });
    this.sunkByMe.push({ slot: 'L2', start: 'D7', dir: 'h', round: 0 });
    this.pushEvent({ type: 'matchStarted', first: 0 });
    this.viewCache = this.build();
  }

  // ── 구독 ──
  readonly subscribe = (l: PracticeListener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  now(): number {
    return this.nowFn();
  }
  getView(): RoomView {
    return this.viewCache;
  }
  getPartnerTaunt(): { seq: number; index: number } | null {
    return this.partnerTaunt;
  }
  get isDone(): boolean {
    return this.ended !== null;
  }
  get currentCut(): number {
    return this.cut;
  }

  /** 코치 정보. 시간에 따라 바뀌므로 매번 계산한다 */
  getPractice(): PracticeInfo {
    const t = this.nowFn();
    let coach: number | null = null;
    switch (this.cut) {
      case 1:
        coach = COACH.firstFire;
        break;
      case 2:
        coach = COACH.memo;
        break;
      case 3:
        coach = COACH.taunt;
        break;
      case 4:
        coach = COACH.quiz;
        break;
      case 5:
        coach = COACH.hint;
        break;
      case 6:
        coach = COACH.tab;
        break;
      case 7:
        if (this.alarm && !this.alarm.reported) coach = COACH.alarm;
        else if (this.alarmDoneAt !== null) coach = COACH.alarmDone;
        else if (this.returnAt !== null && t < this.returnAt + AUTO_HIDE_COACH_MS) coach = COACH.autoHide;
        else coach = COACH.alarm;
        break;
      default:
        coach = this.alarmDoneAt !== null && t < this.alarmDoneAt + ALARM_DONE_COACH_MS ? COACH.alarmDone : COACH.finish;
    }
    if (this.ended) coach = null;
    return { cut: this.cut, totalCuts: PRACTICE_TOTAL_CUTS, coachLine: coach, done: this.ended !== null };
  }

  // ── 시간 진행 (hook이 250ms마다 부른다) ──
  tick(): void {
    const t = this.nowFn();
    let changed = false;
    if (this.ended) return;
    if (this.cut === 2 && t - this.cutEnteredAt >= COACH_MEMO_MS) {
      this.setCut(3);
      changed = true;
    }
    if (this.quizLockUntil !== null && t >= this.quizLockUntil) {
      this.quizLockUntil = null;
      changed = true;
    }
    if (this.quiz && t >= this.quiz.issuedAt + QUIZ_MS) {
      this.issueQuiz(); // 만료 → 새 문제(연습은 정답을 맞힐 때까지)
      changed = true;
    }
    if (!this.quiz && this.clockDeadline <= t) {
      this.clockDeadline = t + TURN_MS; // 연습은 시간 초과 벌칙이 없다
      changed = true;
    }
    if (this.cut === 7 && this.returnAt !== null && !this.alarm && this.alarmDoneAt === null && this.alarmAt !== null && t >= this.alarmAt) {
      this.alarm = { issuedAt: t, reported: false };
      this.version += 1;
      changed = true;
      if (this.viewState === 'disguise') this.finishAlarm('pass'); // 이미 숨어 있으면 0ms 통과
    }
    if (this.alarm && !this.alarm.reported && t >= this.alarm.issuedAt + ALARM_REPORT_WAIT_MS) {
      this.finishAlarm('fail'); // 연습은 벌칙 없음
      changed = true;
    }
    if (this.cut === 7 && this.alarmDoneAt !== null && t - this.alarmDoneAt >= 0) {
      // 경보가 끝나면 마무리 컷으로 (코치는 5초 뒤 finish로 바뀐다)
      this.setCut(8);
      changed = true;
    }
    if (changed) this.commit();
    else {
      const coach = this.getPractice().coachLine;
      if (coach !== this.lastCoach) {
        this.lastCoach = coach;
        for (const l of this.listeners) l();
      }
    }
  }

  // ── 컨트롤러 동작 ──
  fire(cell: CellAddr): ActionOutcome {
    if (this.ended) return this.fail('WRONG_PHASE');
    if (this.quiz) return this.fail('WRONG_PHASE');
    if (this.myShots.some((s) => s.cell === cell)) return this.fail('INVALID', 'already_fired');
    const t = this.nowFn();
    const cells = (s: ShipPlacement) => placementCells(s) ?? [];
    const hitShip = PARTNER_SHIPS.find((s) => cells(s).includes(cell));
    let result: ShotResult = 'miss';
    let sunkSlot: ShipSlot | null = null;
    if (hitShip) {
      result = 'hit';
      const fired = new Set(this.myShots.map((s) => s.cell));
      fired.add(cell);
      if (cells(hitShip).every((c) => fired.has(c))) {
        result = 'sunk';
        sunkSlot = hitShip.slot;
      }
    }
    this.myShots.push({ cell, result, round: this.round });
    if (sunkSlot && hitShip) this.sunkByMe.push({ slot: sunkSlot, start: hitShip.start, dir: hitShip.dir, round: this.round });
    if (result === 'sunk' && sunkSlot) this.pushEvent({ type: 'fire', by: 0, cell, result: 'sunk', slot: sunkSlot });
    else this.pushEvent({ type: 'fire', by: 0, cell, result: result as 'miss' | 'hit' });

    if (this.firstFireAt === null) {
      this.firstFireAt = t;
      this.setCut(2);
    }
    if (this.sunkByMe.length >= SUNK_TO_WIN) {
      this.finish(0, 'sunk2');
      this.commit();
      return this.ok();
    }
    this.partnerFire();
    if (this.round >= ROUND_CAP && !this.ended) {
      const mine = this.myShots.filter((s) => s.result !== 'miss').length;
      const theirs = this.oppShots.filter((s) => s.result !== 'miss').length;
      this.finish(mine === theirs ? null : mine > theirs ? 0 : 1, 'cap');
    } else if (!this.ended) {
      this.round += 1;
      this.clockDeadline = t + TURN_MS;
    }
    this.commit();
    return this.ok();
  }

  answer(quizId: string, value: number): ActionOutcome {
    const t = this.nowFn();
    if (!this.quiz || this.quiz.id !== quizId) return this.fail('INVALID', 'quiz_stale');
    if (this.quizLockUntil !== null && t < this.quizLockUntil) return this.fail('LOCKED');
    if (value !== this.quiz.answer) {
      this.quizLockUntil = t + QUIZ_LOCK_MS;
      this.commit();
      return this.ok();
    }
    this.quiz = null;
    this.hintsEarned = Math.min(HINTS_PER_GAME, this.hintsEarned + 1);
    this.clockDeadline = t + TURN_MS;
    this.pushEvent({ type: 'quizSettled', awarded: [0], expired: false });
    this.setCut(5);
    this.commit();
    return this.ok();
  }

  hint(target: HintTarget): ActionOutcome {
    if (this.ended || this.quiz || this.alarm) return this.fail('INVALID', 'hint_blocked');
    if (this.hintsEarned - this.hints.length <= 0) return this.fail('INVALID', 'no_hint');
    const range = hintRange(target);
    const value = PARTNER_SHIPS.reduce((n, s) => n + (placementCells(s) ?? []).filter((c) => rangeContains(range, c)).length, 0);
    this.hints.push({ target, value, round: this.round, at: this.nowFn() });
    this.log.push({ seq: ++this.logSeq, at: this.nowFn(), round: this.round, by: 0, type: 'hint', target });
    if (this.cut === 5) this.setCut(6);
    this.commit();
    return this.ok();
  }

  taunt(id: TauntId): ActionOutcome {
    if (this.ended) return this.fail('WRONG_PHASE');
    if (this.round < this.nextTauntRound) return this.fail('INVALID', 'taunt_cooldown');
    if (!Number.isInteger(id) || id < 0 || id > 9) return this.fail('INVALID', 'taunt_id');
    this.nextTauntRound = this.round + TAUNT_GAP_ROUNDS;
    this.log.push({ seq: ++this.logSeq, at: this.nowFn(), round: this.round, by: 0, type: 'taunt', tauntId: id });
    if (this.cut <= 3) {
      // 박대리 응수 → 곧바로 검산
      this.partnerTaunt = { seq: this.partnerTaunt ? this.partnerTaunt.seq + 1 : 1, index: 0 };
      this.log.push({ seq: ++this.logSeq, at: this.nowFn(), round: this.round, by: 1, type: 'taunt', tauntId: 0 });
      this.setCut(4);
      this.issueQuiz();
    }
    this.commit();
    return this.ok();
  }

  reportView(view: ViewState): void {
    const t = this.nowFn();
    const prev = this.viewState;
    this.viewState = view;
    if (view === 'disguise' && prev !== 'disguise') {
      if (this.cut === 6) this.hidOnce = true;
      if (this.alarm && !this.alarm.reported) {
        const ms = t - this.alarm.issuedAt;
        this.finishAlarm(ms <= ALARM_HIDE_MS ? 'pass' : 'fail');
        this.commit();
      }
    }
    if (view === 'game' && prev === 'disguise' && this.cut === 6 && this.hidOnce) {
      this.setCut(7);
      this.returnAt = t;
      this.alarmAt = t + AUTO_HIDE_COACH_MS;
      this.commit();
    }
  }

  reportAlarm(issuedAt: number, reactionMs: number): void {
    if (!this.alarm || this.alarm.issuedAt !== issuedAt || this.alarm.reported) return;
    this.finishAlarm(reactionMs <= ALARM_HIDE_MS ? 'pass' : 'fail');
    this.commit();
  }

  noop(): ActionOutcome {
    return this.ok();
  }

  // ── 내부 ──
  private ok(): ActionOutcome {
    return { ok: true, view: this.viewCache };
  }
  private fail(error: 'WRONG_PHASE' | 'INVALID' | 'LOCKED', reason?: 'already_fired' | 'quiz_stale' | 'no_hint' | 'hint_blocked' | 'taunt_cooldown' | 'taunt_id'): ActionOutcome {
    return reason ? { ok: false, error, reason } : { ok: false, error };
  }

  private setCut(n: number): void {
    this.cut = n;
    this.cutEnteredAt = this.nowFn();
  }

  private finishAlarm(outcome: 'pass' | 'fail'): void {
    if (!this.alarm) return;
    this.alarm = { ...this.alarm, reported: true };
    this.alarmDoneAt = this.nowFn();
    this.pushEvent({ type: 'alarmResult', outcomes: [outcome, 'pass'] });
    // 경보 표시는 결과 이벤트와 함께 곧 사라진다
    this.alarm = null;
    this.version += 1;
  }

  private issueQuiz(): void {
    const t = this.nowFn();
    this.quizSerial += 1;
    const a = 20 + ((this.quizSerial * 7) % 30);
    const b = 15 + ((this.quizSerial * 11) % 30);
    const c = 10 + ((this.quizSerial * 13) % 30);
    this.quiz = { id: `practice-quiz-${this.quizSerial}`, values: [a, b, c], answer: a + b + c, labelSeed: this.quizSerial - 1, issuedAt: t };
    this.quizLockUntil = null;
    this.pushEvent({ type: 'quizStarted' });
  }

  private partnerFire(): void {
    const mine = MY_SHIPS.flatMap((s) => placementCells(s) ?? []);
    const fired = new Set(this.oppShots.map((s) => s.cell));
    let cell: CellAddr | undefined;
    while (this.partnerScriptIdx < PARTNER_SCRIPT.length) {
      const c = PARTNER_SCRIPT[this.partnerScriptIdx++]!;
      if (!fired.has(c)) {
        cell = c;
        break;
      }
    }
    if (!cell) cell = ALL_CELLS.find((c) => !fired.has(c) && !mine.includes(c));
    if (!cell) return;
    const isHit = mine.includes(cell);
    this.oppShots.push({ cell, result: isHit ? 'hit' : 'miss', round: this.round });
    this.pushEvent({ type: 'fire', by: 1, cell, result: isHit ? 'hit' : 'miss' });
  }

  private finish(winner: 0 | 1 | null, reason: 'sunk2' | 'cap'): void {
    this.ended = { winner, reason };
    this.quiz = null;
    this.alarm = null;
    this.pushEvent({ type: 'ended' });
  }

  private pushEvent(e: DistributiveOmit<GameEventView, 'seq' | 'at' | 'round'>): void {
    this.eventSeq += 1;
    const full = { ...e, seq: this.eventSeq, at: this.nowFn(), round: this.round } as GameEventView;
    this.events = [...this.events, full].slice(-EVENTS_KEEP);
  }

  private commit(): void {
    this.version += 1;
    this.viewCache = this.build();
    this.lastCoach = this.getPractice().coachLine;
    for (const l of this.listeners) l();
  }

  private build(): RoomView {
    const t = this.nowFn();
    const me: MeView = {
      seat: 0,
      nickname: this.nick,
      industry: this.industry,
      placed: true,
      consecutiveTimeouts: 0,
      ships: MY_SHIPS,
      hideBudgetMs: 120_000,
      hintsEarned: this.hintsEarned,
      hintsAvailable: this.hintsEarned - this.hints.length,
      hints: this.hints,
      quizLockUntil: this.quizLockUntil,
      skipNextFire: false,
      nextTauntRound: this.nextTauntRound,
    };
    const opp: OppView = {
      seat: 1,
      nickname: this.partner,
      industry: this.industry,
      placed: true,
      consecutiveTimeouts: 0,
      present: true,
      lastSeenAt: t,
      hidden: false,
    };
    const room = {
      code: PRACTICE_CODE,
      version: this.version,
      matchSeq: 1,
      alarmOn: true,
      record: { wins: [0, 0] as readonly [number, number], draws: 0 },
      bellTopic: '',
    };
    const quizView: QuizView | null = this.quiz
      ? {
          id: this.quiz.id,
          kind: 'sum',
          values: this.quiz.values,
          labelSeed: this.quiz.labelSeed,
          deadlineAt: this.quiz.issuedAt + QUIZ_MS,
          mine: 'open',
          status: 'open',
          settleAt: null,
        }
      : null;
    const game: GameView = {
      matchId: 'practice',
      round: this.round,
      phase: this.quiz ? 'quiz' : 'fire',
      turn: 0,
      firstSeat: 0,
      clock: this.quiz ? { state: 'paused', reason: 'quiz', remainingMs: TURN_MS } : { state: 'running', deadlineAt: this.clockDeadline },
      myShots: this.myShots,
      oppShots: this.oppShots,
      sunkByMe: this.sunkByMe,
      sunkByOpp: this.sunkByOpp,
      log: this.log,
      quiz: quizView,
      alarm: this.alarm,
    };
    if (this.ended) {
      const ended: EndedView = {
        status: 'ended',
        room,
        me,
        opp,
        events: this.events,
        game: { ...game, clock: { state: 'paused', reason: 'quiz', remainingMs: 0 }, phase: 'fire' },
        result: { winner: this.ended.winner, reason: this.ended.reason, round: this.round },
        reveal: PARTNER_SHIPS,
        rematch: { requested: [false, false], expiresAt: null },
      };
      return ended;
    }
    const playing: PlayingView = { status: 'playing', room, me, opp, events: this.events, game };
    return playing;
  }
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
