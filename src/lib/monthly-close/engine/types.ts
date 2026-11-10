/**
 * 월마감 엔진 상태 타입 (소유: API설계자). 순수 TS — React·DOM·node:* 없음.
 *
 * 엔진은 "상태 → 상태" 함수 모음이다. 시각(now)과 난수(rng), id 생성(newId), 접속 정보(presence)는 전부 인자로 받는다.
 * 상태(RoomState)는 JSON으로 직렬화되어 mc_rooms.state에 그대로 저장된다(Date·Map·undefined 금지).
 *
 * 비밀 필드 이름은 protocol.VIEW_FORBIDDEN_KEYS와 맞춘다:
 *   secret.boards / secret.quiz.answer / secret.alarmRound / seats[n].keyHash·actionIds / quiz.deliveredAt
 * 그래야 실수로 화면 데이터에 복사됐을 때 투영 속성 테스트(금지 키 검사)에 걸린다.
 */

import type { CellAddr, HintTarget, ShipPlacement } from '../coords';
import type { IndustryId, ShipSlot } from '../constants';
import type {
  AlarmOutcome,
  EndReason,
  GameEventView,
  GamePhase,
  InvalidReason,
  LogEntry,
  MyHint,
  QuizKind,
  RoomStatus,
  Seat,
  ShotResult,
  ViewState,
} from '../protocol';

/** [0, 1) 난수. 엔진은 Math.random을 쓰지 않는다. */
export type Rng = () => number;

export interface SeatPresence {
  /** 마지막 접속 신호(서버 ms) */
  readonly lastSeenAt: number;
  readonly viewState: ViewState;
  /** viewState가 마지막으로 바뀐 서버 시각 — 발사 시계 정지의 소급 기준 */
  readonly viewStateAt: number;
}
export type PresencePair = readonly [SeatPresence | null, SeatPresence | null];

export interface EngineCtx {
  readonly now: number;
  readonly rng: Rng;
  /** 매치 id 등 문자열 id 생성(서버는 randomUUID, 테스트·시뮬은 카운터) */
  readonly newId: () => string;
  readonly presence: PresencePair;
}

// ─── 상태 ────────────────────────────────────────────────────────────────────

export interface SeatState {
  /** 비밀키 SHA-256 hex. 화면 데이터에 절대 싣지 않는다 */
  keyHash: string;
  nickname: string;
  industry: IndustryId;
  /** 자리에 있음(문서를 닫고 나가면 false). 같은 키로 다시 들어오면 true */
  present: boolean;
  /** 배치 완료(confirm) */
  placed: boolean;
  /** 최근 처리한 actionId(중복 제거). 화면 데이터에 싣지 않는다 */
  actionIds: string[];
  // ── 판마다 초기화 ──
  consecutiveTimeouts: number;
  hintsEarned: number;
  hints: MyHint[];
  quizLockUntil: number | null;
  skipNextFire: boolean;
  /** 마지막으로 도발을 보낸 라운드 */
  lastTauntRound: number | null;
  /** 이번 판에 숨기기로 쓴 시계 정지 시간 */
  hideUsedMs: number;
}

export interface ShotRec {
  cell: CellAddr;
  result: ShotResult;
  round: number;
}

export interface SunkRec extends ShipPlacement {
  round: number;
}

export interface ClockState {
  /** 이 차례 시계가 시작된 서버 시각 */
  startedAt: number;
  /** 시계가 도는 중이면 만료 시각. 정지 중이면 의미 없음(pause가 우선) */
  deadlineAt: number;
  /** 차례인 사람이 숨어서 정지 중. since는 소급된 정지 시작 시각 */
  pause: { since: number; remainingMs: number } | null;
}

export interface QuizState {
  id: string;
  kind: QuizKind;
  values: number[];
  labelSeed: number;
  /** 출제 시각 */
  issuedAt: number;
  /** 풀 수 있는 자리(힌트를 이미 2개 받은 자리는 빠짐) */
  eligible: [boolean, boolean];
  /** 서버가 이 검산을 그 사람의 응답에 처음 실은 시각(또는 출제 + 1초). 화면 데이터에 싣지 않는다 */
  deliveredAt: [number | null, number | null];
  /** 정답을 낸 사람의 경과 ms(수신 시각 − 배달 시각) */
  elapsedMs: [number | null, number | null];
  expired: [boolean, boolean];
}

export interface AlarmState {
  issuedAt: number;
  /** 자리별 보고된 반응 ms(없으면 null). 화면 데이터에 싣지 않는다 */
  reactionMs: [number | null, number | null];
}

export interface QuizStat {
  round: number;
  kind: QuizKind;
  awarded: Seat[];
  elapsedMs: [number | null, number | null];
}

export interface GameState {
  matchId: string;
  startedAt: number;
  round: number;
  phase: GamePhase;
  /** 지금 쏠 차례. phase = quiz면 검산 확정 뒤 쏠 사람 */
  turn: Seat;
  firstSeat: Seat;
  /** phase = fire일 때만 */
  clock: ClockState | null;
  /** shots[s] = 자리 s가 상대 판에 쏜 결과 */
  shots: [ShotRec[], ShotRec[]];
  /** sunk[s] = 자리 s가 종결시킨 상대 배 */
  sunk: [SunkRec[], SunkRec[]];
  log: LogEntry[];
  logSeq: number;
  quiz: QuizState | null;
  /** 4·8·12라운드에 조건이 안 맞아 미뤄 둔 검산이 있음(다음에 낼 1회) */
  pendingQuiz: boolean;
  /**
   * pendingQuiz 뒤에 더 밀려 있는 회차 수(QA BUG-15, 기획 판단: 판당 3회 유지). 미뤄진 회차끼리 합치지 않고
   * 조건이 되는 라운드마다 하나씩 낸다. pendingQuiz가 false면 항상 0.
   */
  quizBacklog: number;
  alarm: AlarmState | null;
  /** 경보를 이미 냈거나(또는 놓쳐서) 더 내지 않음 */
  alarmDone: boolean;
  /** 지표용 요약 */
  stats: { quizzes: QuizStat[]; alarmOutcome: [AlarmOutcome, AlarmOutcome] | null };
}

export interface ResultState {
  winner: Seat | null;
  reason: EndReason;
  round: number;
}

export interface SecretState {
  /** boards[s] = 자리 s가 놓은 배(배치 중에는 초안 0~3개) */
  boards: [ShipPlacement[], ShipPlacement[]];
  /** 진행 중인 검산의 정답 */
  quiz: { answer: number } | null;
  /** 이 판의 경보 라운드(6~15) 또는 null */
  alarmRound: number | null;
}

export interface RoomState {
  code: string;
  alarmOn: boolean;
  status: RoomStatus;
  /** 판 순번(1부터) */
  matchSeq: number;
  wins: [number, number];
  draws: number;
  seats: [SeatState | null, SeatState | null];
  /** 직전 판의 선공(재대결은 번갈아). 첫 판 전에는 null */
  lastFirstSeat: Seat | null;
  /** 직전 판의 매치 id(재대결 연결용) */
  prevMatchId: string | null;
  placeDeadlineAt: number | null;
  eventSeq: number;
  /** 최근 EVENTS_KEEP개 */
  events: GameEventView[];
  rematch: { requested: [boolean, boolean]; expiresAt: number | null };
  game: GameState | null;
  result: ResultState | null;
  secret: SecretState;
}

// ─── 결과 ────────────────────────────────────────────────────────────────────

/** 서버가 지표·매치 행으로 바꾸는 부수 효과 */
export type EngineEffect =
  | { type: 'matchStarted'; matchId: string; seq: number; rematchOf: string | null; startedAt: number }
  | {
      type: 'matchEnded';
      matchId: string;
      seq: number;
      endedAt: number;
      reason: EndReason;
      winner: Seat | null;
      rounds: number;
      hints: [number, number];
      quizzes: QuizStat[];
      alarmOutcome: [AlarmOutcome, AlarmOutcome] | null;
    }
  | { type: 'rematchRequested'; seat: Seat; matchId: string };

export type EngineErrorCode = 'NOT_YOUR_TURN' | 'WRONG_PHASE' | 'LOCKED' | 'INVALID';

export interface Stepped {
  state: RoomState;
  /** 상태가 바뀌었는가(= 서버가 version을 올려 저장해야 하는가) */
  changed: boolean;
  effects: EngineEffect[];
}

/** 액션 결과. 거부(ok:false)는 상태를 바꾸지 않는다(그 전에 advance가 바꾼 것은 호출자가 따로 저장). */
export type ActionResult =
  | (Stepped & { ok: true; duplicate: boolean })
  | { ok: false; error: EngineErrorCode; reason?: InvalidReason };

export type { ShipSlot, HintTarget };
