/**
 * 로컬 게임 상태 — 단계 머신 · 되돌리기 · 진행 단계 맞추기 · 장소 잠금 · 공개/비공개 · 지목/재지목/도주 · 점수.
 * (디자인 스펙 §1-2, §2, §6-2, §6-3, §7-3)
 *
 * 순수 함수만. 시각은 항상 ctx.now 로 받는다(Date.now 호출 없음). React 는 useReducer 에서
 *   dispatch(action) → applyAction(state, action, { c, now: Date.now() }) 형태로 쓴다.
 * 불가능한 액션은 **같은 참조**를 돌려준다(no-op) — `next === prev` 로 거부 여부를 알 수 있다.
 *
 * 서버가 없으므로 "공식 결과"는 방장 폰 하나(HostState)에만 있다(D18). 플레이어 상태는 개인 메모다.
 * 사건 본문(역할 시트·단서 텍스트)은 상태에 넣지 않는다 — 언제나 code 로 재계산한다.
 */
import { assignSeats, seatOfRole, type Assignment } from './assign';
import { isPlaceInRound } from './deck';
import { parseRoomCode } from './room';
import { canExamine, type ExamineLog } from './scene';
import { placeCardById } from './seal';
import {
  DEFAULT_SCORING,
  DEFAULT_TIMERS,
  type GungCase,
  type MissionDef,
  type PlayerCount,
  type RoleId,
  ROUND_NOS,
  type RoundNo,
  type ScoringRule,
  type TimerConfig,
} from './types';

export const SAVE_VERSION = 1 as const;
export const HISTORY_LIMIT = 20;
/** 공개 표시 되돌리기 창(§3 P6) */
export const DISCLOSE_UNDO_MS = 5_000;
/** 방장 단계 전진 되돌리기 토스트(§10-2) — UI 표시용 상수 */
export const ADVANCE_UNDO_TOAST_MS = 6_000;
/** 장소 확정 토스트(§3 P5) — 되돌리기 자체는 단서를 열기 전까지 시간 제한 없음 */
export const PICK_UNDO_TOAST_MS = 6_000;
export const TIMER_ADD_MS = 30_000;

// ─────────────────────────────── 단계 ───────────────────────────────

export const PHASES = ['lobby', 'briefing', 'cards', 'intro', 'r1', 'r2', 'r3', 'defense', 'vote', 'reveal', 'result'] as const;
export type Phase = (typeof PHASES)[number];

export const PHASE_LABELS: Record<Phase, string> = {
  lobby: '대기',
  briefing: '사건 개요',
  cards: '패 확인',
  intro: '자기소개',
  r1: '조사 1',
  r2: '조사 2',
  r3: '조사 3',
  defense: '최종 변론',
  vote: '지목',
  reveal: '진상 공개',
  result: '결과',
};

/**
 * 조사 라운드 하위 단계(6판): scene(현장 보기 1분, 조용한 타이머) → select(장소 고르기) → discuss(토론).
 * 라운드에 들어서면 scene 부터. 진행 단계 맞추기(hostSync)로 들어오면 select 부터(현장은 시트로 언제든 다시 본다).
 */
export type RoundSub = 'scene' | 'select' | 'discuss';
export const ROUND_SUBS: readonly RoundSub[] = ['scene', 'select', 'discuss'];
export type VoteSub = 'ready' | 'input' | 'tally' | 'revote' | 'final';
export type Disclosure = 'undecided' | 'public' | 'private';
export type GameRole = 'host' | 'player';
/**
 * scene·select·discuss = 조사(현장 보기 → 장소 고르기 → 토론) · defense = 최종 변론 · cards = 패 확인 ·
 * tie = 동률자 추가 변론(원고 8-1). scene 은 0초에도 징·진동 없이 조용히 끝난다(UX 스펙 §2-3, isQuietTimer).
 */
export type TimerKind = 'scene' | 'select' | 'discuss' | 'defense' | 'cards' | 'tie';
export const TIMER_KINDS: readonly TimerKind[] = ['scene', 'select', 'discuss', 'defense', 'cards', 'tie'];
/** 헤더 5기둥 레일(§5-3) */
export type RailStep = 'prep' | 1 | 2 | 3 | 'defense' | 'vote' | 'done';

export function isPhase(v: unknown): v is Phase {
  return typeof v === 'string' && (PHASES as readonly string[]).includes(v);
}

export function phaseIndex(p: Phase): number {
  return PHASES.indexOf(p);
}

export function roundOfPhase(p: Phase): RoundNo | null {
  return p === 'r1' ? 1 : p === 'r2' ? 2 : p === 'r3' ? 3 : null;
}

export function phaseOfRound(r: RoundNo): Phase {
  return r === 1 ? 'r1' : r === 2 ? 'r2' : 'r3';
}

/** 이 단계까지 도달한 마지막 조사 라운드(0 = 아직 조사 전) */
export function reachedRound(p: Phase): 0 | RoundNo {
  const i = phaseIndex(p);
  if (i >= phaseIndex('r3')) return 3;
  if (i >= phaseIndex('r2')) return 2;
  if (i >= phaseIndex('r1')) return 1;
  return 0;
}

export function railStep(p: Phase): RailStep {
  const r = roundOfPhase(p);
  if (r) return r;
  if (p === 'defense' || p === 'vote') return p;
  if (p === 'reveal' || p === 'result') return 'done';
  return 'prep';
}

/**
 * 방장 화면 '내문 출입 타임라인'에 올릴 라운드 — 이 폰이 들어선 조사 라운드 전부.
 * 공용 카드(PB)는 **라운드 시작 때 공개**한다(원고 1-7 규칙 4·4-1·1-8, QA BUG-04 결정) — 그래서 그 라운드에 들어서는 순간
 * 그 카드의 출입 기록도 그린다. 아직 들어서지 않은 라운드는 절대 넣지 않는다(되돌리기·단계 맞추기로 뒤로 가면 다시 빠진다).
 */
export function gateRoundsShown(s: Pick<GameState, 'phase'>): RoundNo[] {
  const reached = reachedRound(s.phase);
  return ROUND_NOS.filter((r) => r <= reached);
}

/**
 * from → to 로 옮길 때 새로 들어서는 조사 라운드(가장 늦은 것). 없으면 null.
 * 조사 라운드에 들어서면 그 라운드 장소 단서·공용 카드·「R3에 떠오르는 기억」이 풀리고, 한 번 본 것은 못 되돌린다 —
 * 그래서 플레이어 게이트든 진행 단계 맞추기(O1)든 **같은 확인**을 거친다(QA BUG-05 와 그 우회로).
 */
export function roundEntered(from: Phase, to: Phase): RoundNo | null {
  const a = reachedRound(from);
  const b = reachedRound(to);
  return b > a ? (b as RoundNo) : null;
}

/** 공용 화면에 역할명을 써도 되는가(D16). 플래그가 false 면 진상부터. */
export function rolesVisible(c: GungCase, p: Phase): boolean {
  return c.rolesPublicAfterIntro ? phaseIndex(p) > phaseIndex('intro') : phaseIndex(p) >= phaseIndex('reveal');
}

/** O1 진행 단계 맞추기 — 두 단계 이상 앞으로, 새 조사 라운드로 들어설 때(한 단계여도), 진상·결과로 가면 확인 시트 */
export function syncNeedsConfirm(from: Phase, to: Phase): boolean {
  if (to === 'reveal' || to === 'result') return from !== to;
  if (roundEntered(from, to) !== null) return true;
  return phaseIndex(to) - phaseIndex(from) >= 2;
}

// ─────────────────────────────── 상태 ───────────────────────────────

export interface RoundPick {
  placeId: string;
  pickedAt: number;
  /** 단서를 한 번이라도 열었는가 — 열면 장소 되돌리기 소멸 */
  opened: boolean;
  disclosure: Disclosure;
  /** 마지막으로 '공개'를 누른 시각(되돌리기 창) */
  disclosedAt?: number;
  /** 공개 직전 상태(되돌리기 복원용) */
  disclosedFrom?: Disclosure;
}

export interface TimerState {
  kind: TimerKind;
  totalMs: number;
  running: boolean;
  /** running 일 때만 */
  endsAt: number | null;
  /** 멈춤일 때 기준값 */
  remainingMs: number;
}

export interface VoteState {
  sub: VoteSub;
  /** voterSeat → targetSeat (1차 지목) */
  first: Record<number, number>;
  revote?: { candidates: number[]; ballots: Record<number, number> };
  /** seat → questionId → 고른 보기 인덱스(보너스 문항, 선택) */
  bonus?: Record<number, Record<string, number>>;
}

/**
 * 공개 단서 보드 한 줄(개선 묶음 1 · R5) — 본문은 저장하지 않는다(언제나 사건 데이터에서 다시 계산).
 * 방장이 인장 번호로만 올린다(간편 모드 없음). seats = '누가 밝혔소?'에서 고른 자리(비어 있어도 된다).
 */
export interface BoardEntry {
  id: string;
  round: RoundNo;
  seats: number[];
}
/** 보드 최대 장 수 — 한 판에 열 수 있는 장소 카드 수(7곳 × 3라운드) */
export const BOARD_LIMIT = 21;
/** 카드 id 형식(DG-1 · HW-1b · NPC-5A 는 장소 카드가 아니라 보드에 못 오른다) */
export const BOARD_ID_RE = /^[A-Z]{2,3}-\d{1,2}[a-z]?$/;

export interface HostState {
  /** 롤콜 확인된 자리(1 은 항상 포함) */
  rollCall: number[];
  introCurrent: number;
  roundSub: RoundSub | null;
  publicClueOpened: Partial<Record<RoundNo, boolean>>;
  timer: TimerState | null;
  defense: { order: number[]; index: number } | null;
  vote: VoteState | null;
  absentSeats: number[];
  /** seat → missionId → 판정(null = 미판정) */
  missions: Record<number, Record<string, boolean | null>>;
  revealIndex: number;
  /** 공개 단서 보드(R5) — 올린 순서. 되돌리기 스택에 함께 실린다 */
  board: BoardEntry[];
  startedAt?: number;
  endedAt?: number;
  /** 되돌리기 스택(최대 HISTORY_LIMIT, 영속) */
  history: HostSnapshot[];
}

export type HostCore = Omit<HostState, 'history'>;
export interface HostSnapshot {
  phase: Phase;
  host: HostCore;
}

export interface GameState {
  v: typeof SAVE_VERSION;
  /** '7F3K5' (하이픈 없음) */
  code: string;
  caseId: string;
  caseVersion: number;
  role: GameRole;
  /** 1..n (host = 1) */
  seat: number;
  phase: Phase;
  createdAt: number;
  updatedAt: number;
  rounds: Partial<Record<RoundNo, RoundPick>>;
  /**
   * 7판 살펴보기(개인 기록) — 조사 → 그 조사에 살펴본 물건 id(고른 순). 이 폰에만 있고 결과·공유·초대 링크엔 실리지 않는다.
   * 한 번 본 건 되돌릴 수 없다(되돌리기 액션이 없다). 장소를 확정하면(rounds[r]) 그 조사의 남은 살펴보기는 마감.
   */
  examined?: ExamineLog;
  /** P8 확정 지목(개인 기록) */
  myVote?: { seat: number; at: number };
  host?: HostState;
}

export interface GameContext {
  c: GungCase;
  now: number;
}

export function emptyHost(): HostState {
  return {
    rollCall: [1],
    introCurrent: 1,
    roundSub: null,
    publicClueOpened: {},
    timer: null,
    defense: null,
    vote: null,
    absentSeats: [],
    missions: {},
    revealIndex: 0,
    board: [],
    history: [],
  };
}

export function newHostGame(c: GungCase, code: string, now: number): GameState | null {
  const room = parseRoomCode(code);
  if (!room) return null;
  return {
    v: SAVE_VERSION,
    code: room.code,
    caseId: c.id,
    caseVersion: c.version,
    role: 'host',
    seat: 1,
    phase: 'lobby',
    createdAt: now,
    updatedAt: now,
    rounds: {},
    host: emptyHost(),
  };
}

/** 플레이어 자리는 2..n (1번 = 방장, 방장 복구는 ?as=host) */
export function newPlayerGame(c: GungCase, code: string, seat: number, now: number): GameState | null {
  const room = parseRoomCode(code);
  if (!room || !Number.isInteger(seat) || seat < 2 || seat > room.n) return null;
  return {
    v: SAVE_VERSION,
    code: room.code,
    caseId: c.id,
    caseVersion: c.version,
    role: 'player',
    seat,
    phase: 'lobby',
    createdAt: now,
    updatedAt: now,
    rounds: {},
  };
}

export function playerCountOf(s: Pick<GameState, 'code'>): PlayerCount {
  const room = parseRoomCode(s.code);
  if (!room) throw new Error(`invalid code ${s.code}`);
  return room.n;
}

const assignCache = new WeakMap<GungCase, Map<string, Assignment>>();
/** 상태의 code 로 배정 계산(결정론이라 캐시 안전) */
export function assignmentOf(c: GungCase, s: Pick<GameState, 'code'>): Assignment {
  let m = assignCache.get(c);
  if (!m) assignCache.set(c, (m = new Map()));
  const hit = m.get(s.code);
  if (hit) return hit;
  const room = parseRoomCode(s.code);
  if (!room) throw new Error(`invalid code ${s.code}`);
  const a = assignSeats(c, room);
  m.set(s.code, a);
  return a;
}

export function activeSeats(n: number, absent: readonly number[] = []): number[] {
  const out: number[] = [];
  for (let i = 1; i <= n; i++) if (!absent.includes(i)) out.push(i);
  return out;
}

function timersOf(c: GungCase): TimerConfig {
  return { ...DEFAULT_TIMERS, ...(c.timers ?? {}) };
}

export function scoringOf(c: GungCase): ScoringRule {
  return { ...DEFAULT_SCORING, ...(c.scoring ?? {}) };
}

// ─────────────────────────────── 타이머 ───────────────────────────────

export function startTimer(kind: TimerKind, totalMs: number, now: number): TimerState {
  return { kind, totalMs, running: true, endsAt: now + totalMs, remainingMs: totalMs };
}

export function timerRemaining(t: TimerState, now: number): number {
  return t.running && t.endsAt !== null ? Math.max(0, t.endsAt - now) : Math.max(0, t.remainingMs);
}

export function timerFinished(t: TimerState, now: number): boolean {
  return timerRemaining(t, now) <= 0;
}

export function pauseTimer(t: TimerState, now: number): TimerState {
  if (!t.running) return t;
  return { ...t, running: false, endsAt: null, remainingMs: timerRemaining(t, now) };
}

export function resumeTimer(t: TimerState, now: number): TimerState {
  if (t.running || t.remainingMs <= 0) return t;
  return { ...t, running: true, endsAt: now + t.remainingMs };
}

export function addTimerTime(t: TimerState, ms: number, now: number): TimerState {
  const remaining = timerRemaining(t, now) + ms;
  return t.running
    ? { ...t, totalMs: t.totalMs + ms, endsAt: now + remaining, remainingMs: remaining }
    : { ...t, totalMs: t.totalMs + ms, remainingMs: remaining };
}

/** 지금 단계에 맞는 타이머 종류(없으면 null). 지목 단계 = 동률자 추가 변론(집계에서 동률일 때만 엔진이 받는다) */
export function timerKindFor(phase: Phase, roundSub: RoundSub | null): TimerKind | null {
  if (roundOfPhase(phase)) return roundSub === 'discuss' ? 'discuss' : roundSub === 'scene' ? 'scene' : 'select';
  if (phase === 'defense') return 'defense';
  if (phase === 'cards') return 'cards';
  if (phase === 'vote') return 'tie';
  return null;
}

export function timerMs(c: GungCase, kind: TimerKind): number {
  const t = timersOf(c);
  switch (kind) {
    case 'scene':
      return t.sceneMs;
    case 'select':
      return t.selectMs;
    case 'discuss':
      return t.discussMs;
    case 'defense':
      return t.defenseMs;
    case 'cards':
      return t.cardsMs;
    case 'tie':
      return t.tieMs;
  }
}

/** 0초에 징·진동 없이 조용히 끝나는 타이머인가(현장 보기 — 낭독 중 징이 울리지 않게, UX 스펙 §2-3) */
export function isQuietTimer(kind: TimerKind): boolean {
  return kind === 'scene';
}

/** 분 단위 표시(UI 문구 「고르기 1분 시작」 등) — 1분 미만은 소수 없이 초로 쓰는 쪽에서 처리 */
export function timerMinutes(c: GungCase, kind: TimerKind): number {
  return timerMs(c, kind) / 60_000;
}

/**
 * 진행표(UX 스펙 §2-4 「게임 진행이 어떻게 되는지」) — 타이머 값에서 계산한 단계별 예상 분.
 * 개요·소개·지목/진상은 타이머가 없는 낭독 구간이라 스펙 §2-1 시간 예산의 어림값을 쓴다. 합계 40분을 넘으면 테스트가 실패한다.
 */
export interface FlowStep {
  key: 'briefing' | 'cards' | 'intro' | 'rounds' | 'defense' | 'finale';
  label: string;
  minutes: number;
}
export const FLOW_FIXED_MINUTES = { briefing: 2, intro: 2, finale: 4 } as const;

export function flowPlan(c: GungCase, n: PlayerCount): { steps: FlowStep[]; total: number } {
  const perRound = (timerMs(c, 'scene') + timerMs(c, 'select') + timerMs(c, 'discuss')) / 60_000;
  const steps: FlowStep[] = [
    { key: 'briefing', label: '개요', minutes: FLOW_FIXED_MINUTES.briefing },
    { key: 'cards', label: '패', minutes: Math.ceil(timerMs(c, 'cards') / 60_000) },
    { key: 'intro', label: '소개', minutes: FLOW_FIXED_MINUTES.intro },
    { key: 'rounds', label: '조사', minutes: Math.ceil(perRound * ROUND_NOS.length) },
    { key: 'defense', label: '변론', minutes: Math.ceil((timerMs(c, 'defense') * n) / 60_000) },
    { key: 'finale', label: '지목·진상', minutes: FLOW_FIXED_MINUTES.finale },
  ];
  return { steps, total: steps.reduce((sum, x) => sum + x.minutes, 0) };
}

// ─────────────────────────────── 지목 ───────────────────────────────

export interface Tally {
  counts: Record<number, number>;
  max: number;
  /** 최다 득표 자리(동률이면 여럿, 표가 없으면 빈 배열) */
  top: number[];
}

/** ballots 를 센다. targets 가 있으면 그 자리로 간 표만, voters 가 있으면 그 투표자 표만. */
export function tallyVotes(
  ballots: Record<number, number>,
  opts: { voters?: readonly number[]; targets?: readonly number[] } = {},
): Tally {
  const counts: Record<number, number> = {};
  for (const [vk, target] of Object.entries(ballots)) {
    const voter = Number(vk);
    if (opts.voters && !opts.voters.includes(voter)) continue;
    if (opts.targets && !opts.targets.includes(target)) continue;
    if (voter === target) continue;
    counts[target] = (counts[target] ?? 0) + 1;
  }
  const max = Object.values(counts).reduce((m, x) => Math.max(m, x), 0);
  const top = max > 0 ? Object.keys(counts).map(Number).filter((s) => counts[s] === max).sort((a, b) => a - b) : [];
  return { counts, max, top };
}

/** 투표자가 고를 수 있는 자리 — 자기 자신 제외, 재지목이면 후보만 */
export function voteOptions(voter: number, active: readonly number[], candidates?: readonly number[]): number[] {
  return (candidates ?? active).filter((s) => s !== voter && active.includes(s));
}

export function ballotsComplete(
  ballots: Record<number, number>,
  active: readonly number[],
  candidates?: readonly number[],
): boolean {
  return active.every((v) => {
    const opts = voteOptions(v, active, candidates);
    return opts.length === 0 || opts.includes(ballots[v]);
  });
}

/** 스테퍼 다음 투표자(자리 순, 아직 표가 없는 첫 사람) */
export function nextVoter(ballots: Record<number, number>, active: readonly number[], candidates?: readonly number[]): number | null {
  for (const v of active) {
    const opts = voteOptions(v, active, candidates);
    if (opts.length && !opts.includes(ballots[v])) return v;
  }
  return null;
}

export type VerdictStage = 'pending' | 'needsRevote' | 'decided';

export interface Verdict {
  stage: VerdictStage;
  /** 최종 지목된 자리(동률·무표면 null) */
  accusedSeat: number | null;
  /** 지목된 자 = 범인 */
  caught: boolean;
  revoted: boolean;
  first: Tally;
  revote: Tally | null;
  /** 1차가 완결됐는가(개인 미션 자동 판정 근거) */
  firstComplete: boolean;
}

/**
 * 판결(§7-3): 1차 단독 1위 → 지목. 동률 → 동률 후보 대상 재지목 1회. 재지목도 동률 → 아무도 지목 안 됨(=도주).
 * 지목된 자 = 범인 → 검거, 그 외 → 도주. 이탈자는 투표자·후보에서 제외.
 */
export function resolveVerdict(vote: VoteState | null, active: readonly number[], culpritSeat: number): Verdict {
  const firstBallots = vote?.first ?? {};
  const first = tallyVotes(firstBallots, { voters: active, targets: active });
  const firstComplete = ballotsComplete(firstBallots, active);
  const base = { first, revote: null as Tally | null, firstComplete, revoted: false };
  if (!firstComplete) return { ...base, stage: 'pending', accusedSeat: null, caught: false };
  if (first.top.length <= 1) {
    const accused = first.top[0] ?? null;
    return { ...base, stage: 'decided', accusedSeat: accused, caught: accused !== null && accused === culpritSeat };
  }
  if (!vote?.revote) return { ...base, stage: 'needsRevote', accusedSeat: null, caught: false };
  const cands = vote.revote.candidates.filter((s) => active.includes(s));
  const revote = tallyVotes(vote.revote.ballots, { voters: active, targets: cands });
  if (!ballotsComplete(vote.revote.ballots, active, cands)) {
    return { ...base, revote, revoted: true, stage: 'pending', accusedSeat: null, caught: false };
  }
  const accused = revote.top.length === 1 ? revote.top[0] : null;
  return { ...base, revote, revoted: true, stage: 'decided', accusedSeat: accused, caught: accused !== null && accused === culpritSeat };
}

// ─────────────────────────────── 진상 비트 ───────────────────────────────

export type RevealBeat =
  | { kind: 'dark' }
  | { kind: 'story'; index: number; time?: string; text: string }
  | { kind: 'culpritLine'; text: string }
  | { kind: 'culprit'; confession: string }
  | { kind: 'verdict'; summary?: string; epilogue?: string };

/** 암전 → 이야기 비트 n개 → '범인은…' → 범인 도장(자백) → 판결(정리·에필로그) */
export function revealBeats(c: GungCase): RevealBeat[] {
  return [
    { kind: 'dark' },
    ...c.truth.beats.map((b, index): RevealBeat => ({ kind: 'story', index, time: b.time, text: b.text })),
    { kind: 'culpritLine', text: c.truth.culpritLine },
    { kind: 'culprit', confession: c.truth.confession },
    { kind: 'verdict', summary: c.truth.summary, epilogue: c.truth.epilogue },
  ];
}

// ─────────────────────────────── 액션 ───────────────────────────────

export type GameAction =
  /** 방장: 다음 단계/하위 단계 · 플레이어: 게이트(다음 단계) */
  | { type: 'advance' }
  /** 방장 전용: 직전 스냅샷으로(타이머는 멈춤 상태로 복원) */
  | { type: 'undo' }
  /** O1 진행 단계 맞추기 */
  | { type: 'syncPhase'; phase: Phase }
  /** 패 확인 → 1라운드 직행(자기소개 건너뛰기) */
  | { type: 'skipIntro' }
  // ── 플레이(방장 포함)
  /** 7판: 이동 장소 물건 하나 살펴보기 — 라운드당 횟수 제한·같은 물건 두 번 금지·장소 확정 뒤 마감. 되돌리기 없음 */
  | { type: 'examine'; round: RoundNo; objectId: string }
  | { type: 'pickPlace'; round: RoundNo; placeId: string }
  | { type: 'unpickPlace'; round: RoundNo }
  | { type: 'openClue'; round: RoundNo }
  | { type: 'disclose'; round: RoundNo; value: 'public' | 'private' }
  | { type: 'undoDisclose'; round: RoundNo }
  | { type: 'castVote'; target: number }
  | { type: 'clearVote' }
  /** 플레이어 자리 바꾸기 — 진행 기록 초기화 */
  | { type: 'changeSeat'; seat: number }
  // ── 방장 전용
  | { type: 'rollCall'; seat: number }
  | { type: 'introNext' }
  | { type: 'introSet'; seat: number }
  | { type: 'openPublicClue'; round: RoundNo }
  | { type: 'timer'; op: 'pause' | 'resume' | 'add30' | 'restart' }
  /** 지목 입력(1차는 input/tally, 재지목은 revote/final 하위 단계에서) */
  | { type: 'ballot'; voter: number; target: number }
  | { type: 'clearBallot'; voter: number }
  | { type: 'startRevote' }
  | { type: 'bonusAnswer'; seat: number; questionId: string; option: number | null }
  | { type: 'revealAll' }
  | { type: 'mission'; seat: number; missionId: string; value: boolean | null }
  | { type: 'setAbsent'; seat: number; absent: boolean }
  /**
   * 공개 단서 보드에 올림(R5) — 인장으로 찾은 장소 카드 id 만. 이미 오른 카드면 새 자리만 덧붙인다.
   * 아직 들어서지 않은 라운드의 카드·장소 카드가 아닌 id 는 거부(no-op).
   */
  | { type: 'postClue'; id: string; seats: number[] }
  | { type: 'unpostClue'; id: string };

function touch(s: GameState, now: number, patch: Partial<GameState>): GameState {
  return { ...s, ...patch, updatedAt: now };
}

function coreOf(h: HostState): HostCore {
  const core: Partial<HostState> = { ...h };
  delete core.history;
  return core as HostCore;
}

/** 스냅샷 — 타이머는 그 순간 값으로 멈춰 둔다(되돌리기 복원 = 멈춤 상태) */
function snapshot(s: GameState, now: number): HostSnapshot {
  const core = coreOf(s.host!);
  return { phase: s.phase, host: { ...core, timer: core.timer ? pauseTimer(core.timer, now) : null } };
}

type HostMutation = { phase: Phase; host: HostCore } | null;

/** 방장 상태 변경. record=true 면 변경 전 스냅샷을 되돌리기 스택에 쌓는다. */
function hostChange(s: GameState, ctx: GameContext, record: boolean, mutate: (h: HostCore, phase: Phase) => HostMutation): GameState {
  if (s.role !== 'host' || !s.host) return s;
  const res = mutate(coreOf(s.host), s.phase);
  if (!res) return s;
  const history = record ? [...s.host.history, snapshot(s, ctx.now)].slice(-HISTORY_LIMIT) : s.host.history;
  return touch(s, ctx.now, { phase: res.phase, host: { ...res.host, history } });
}

function nextActiveSeat(after: number, active: readonly number[]): number | null {
  return active.find((x) => x > after) ?? null;
}

function initVote(): VoteState {
  return { sub: 'ready', first: {} };
}

/**
 * 조사 라운드에 들어선다(자기소개 → 조사 1 · 토론 → 다음 조사 · 자기소개 건너뛰기) — 현장 보기부터, 현장 타이머(조용함) 실행.
 * 6판 이전(G2)엔 고르기 단계 + 타이머 멈춤으로 들어섰다. 이제 낭독은 현장 보기 1분이 맡고, 고르기 타이머는 현장 → 고르기 전진 때 돈다.
 */
function enterRound(h: HostCore, ctx: GameContext): HostCore {
  return { ...h, roundSub: 'scene', timer: startTimer('scene', timerMs(ctx.c, 'scene'), ctx.now) };
}

/** 방장 '다음' — 단계·하위 단계 전진 */
function hostAdvance(h: HostCore, phase: Phase, ctx: GameContext, n: number, culpritSeat: number): HostMutation {
  const { c, now } = ctx;
  const active = activeSeats(n, h.absentSeats);
  const r = roundOfPhase(phase);
  if (r) {
    if (h.roundSub === 'scene') {
      // 6판: 현장 보기(공용 단서 낭독 + 새 관찰 확인) → 장소 고르기. 고르기 타이머는 이 전진과 함께 돈다(별도 시작 버튼 없음)
      return { phase, host: { ...h, roundSub: 'select', timer: startTimer('select', timerMs(c, 'select'), now) } };
    }
    if (h.roundSub !== 'discuss') {
      return { phase, host: { ...h, roundSub: 'discuss', timer: startTimer('discuss', timerMs(c, 'discuss'), now) } };
    }
    if (r < 3) return { phase: phaseOfRound((r + 1) as RoundNo), host: enterRound(h, ctx) };
    return {
      phase: 'defense',
      host: { ...h, roundSub: null, defense: { order: active, index: 0 }, timer: startTimer('defense', timerMs(c, 'defense'), now) },
    };
  }
  switch (phase) {
    case 'lobby':
      return { phase: 'briefing', host: { ...h, startedAt: h.startedAt ?? now } };
    case 'briefing':
      // 「각자 폰을 가리고 확인하세요」 카운트다운(6판 2분 — DEFAULT_TIMERS.cardsMs)
      return { phase: 'cards', host: { ...h, timer: startTimer('cards', timerMs(c, 'cards'), now) } };
    case 'cards':
      return { phase: 'intro', host: { ...h, introCurrent: active[0] ?? 1, timer: null } };
    case 'intro':
      return { phase: 'r1', host: enterRound(h, ctx) };
    case 'defense': {
      const d = h.defense ?? { order: active, index: 0 };
      if (d.index < d.order.length - 1) {
        return { phase, host: { ...h, defense: { ...d, index: d.index + 1 }, timer: startTimer('defense', timerMs(c, 'defense'), now) } };
      }
      return { phase: 'vote', host: { ...h, defense: d, timer: null, vote: h.vote ?? initVote() } };
    }
    case 'vote': {
      const v = h.vote ?? initVote();
      const verdict = resolveVerdict(v, active, culpritSeat);
      switch (v.sub) {
        case 'ready':
          return { phase, host: { ...h, vote: { ...v, sub: 'input' } } };
        case 'input':
          return verdict.firstComplete ? { phase, host: { ...h, vote: { ...v, sub: 'tally' } } } : null;
        case 'tally':
          if (!verdict.firstComplete) return null;
          if (verdict.stage === 'needsRevote') {
            // 동률자 추가 변론(30초 타이머)은 여기서 끝난다
            return { phase, host: { ...h, timer: null, vote: { ...v, sub: 'revote', revote: { candidates: verdict.first.top, ballots: {} } } } };
          }
          return { phase: 'reveal', host: { ...h, vote: v, revealIndex: 0 } };
        case 'revote':
          return verdict.stage === 'decided' ? { phase, host: { ...h, vote: { ...v, sub: 'final' } } } : null;
        case 'final':
          return verdict.stage === 'decided' ? { phase: 'reveal', host: { ...h, revealIndex: 0 } } : null;
      }
      return null;
    }
    case 'reveal': {
      const last = revealBeats(c).length - 1;
      if (h.revealIndex < last) {
        const idx = h.revealIndex + 1;
        return { phase, host: { ...h, revealIndex: idx, endedAt: idx >= last ? h.endedAt ?? now : h.endedAt } };
      }
      return { phase: 'result', host: { ...h, endedAt: h.endedAt ?? now } };
    }
    default:
      return null;
  }
}

/** O1 — 방장이 단계를 직접 고를 때 하위 상태 기본값 */
function hostSync(h: HostCore, from: Phase, to: Phase, ctx: GameContext, n: number): HostMutation {
  if (from === to) return null;
  const active = activeSeats(n, h.absentSeats);
  const base: HostCore = {
    ...h,
    timer: null,
    // 단계 맞추기는 복구 경로 — 조사 라운드면 장소 고르기부터(현장은 시트로 언제든). 타이머는 방장이 다시 켠다
    roundSub: roundOfPhase(to) ? 'select' : null,
    startedAt: phaseIndex(to) > phaseIndex('lobby') ? h.startedAt ?? ctx.now : h.startedAt,
  };
  if (to === 'intro') base.introCurrent = active[0] ?? 1;
  if (to === 'defense') base.defense = { order: active, index: 0 };
  if (to === 'vote') base.vote = h.vote ?? initVote();
  if (to === 'reveal') base.revealIndex = 0;
  if (to === 'result') base.endedAt = h.endedAt ?? ctx.now;
  return { phase: to, host: base };
}

/** 이탈 처리 — 그 자리의 표와 그 자리로 간 표를 지우고, 재지목은 무효화 */
function applyAbsent(h: HostCore, seat: number, absent: boolean, n: number): HostCore {
  const absentSeats = absent ? Array.from(new Set([...h.absentSeats, seat])).sort((a, b) => a - b) : h.absentSeats.filter((s) => s !== seat);
  const active = activeSeats(n, absentSeats);
  let vote = h.vote;
  if (vote && absent) {
    const first: Record<number, number> = {};
    for (const [k, t] of Object.entries(vote.first)) if (Number(k) !== seat && t !== seat) first[Number(k)] = t;
    const done = ballotsComplete(first, active);
    const sub: VoteSub = vote.sub === 'ready' ? 'ready' : done ? 'tally' : 'input';
    vote = { ...vote, first, sub, revote: undefined };
  }
  let defense = h.defense;
  if (defense && absent) {
    const cur = defense.order[defense.index];
    const order = defense.order.filter((s) => s !== seat);
    const idx = cur === seat ? Math.min(defense.index, Math.max(0, order.length - 1)) : Math.max(0, order.indexOf(cur));
    defense = { order, index: idx };
  }
  let introCurrent = h.introCurrent;
  if (absent && introCurrent === seat) introCurrent = nextActiveSeat(seat, active) ?? active[active.length - 1] ?? 1;
  return {
    ...h,
    absentSeats,
    vote,
    defense,
    introCurrent,
    rollCall: absent ? h.rollCall.filter((s) => s !== seat) : h.rollCall,
  };
}

function hostOnly(s: GameState, ctx: GameContext, action: GameAction, n: number): GameState {
  const { now } = ctx;
  switch (action.type) {
    case 'undo': {
      if (s.role !== 'host' || !s.host || !s.host.history.length) return s;
      const hist = s.host.history;
      const last = hist[hist.length - 1];
      // 미션 판정은 되돌리기 대상이 아니다(record=false) — 스냅샷의 옛 판정으로 덮으면 결과 화면 ↶ 한 번에
      // 그동안 입력한 판정이 전부 사라진다(QA BUG-08). 지금 값을 그대로 들고 간다.
      return touch(s, now, { phase: last.phase, host: { ...last.host, missions: s.host.missions, history: hist.slice(0, -1) } });
    }
    case 'rollCall':
      if (!Number.isInteger(action.seat) || action.seat < 2 || action.seat > n) return s;
      return hostChange(s, ctx, true, (h, p) => {
        const has = h.rollCall.includes(action.seat);
        const rollCall = has ? h.rollCall.filter((x) => x !== action.seat) : [...h.rollCall, action.seat].sort((a, b) => a - b);
        return { phase: p, host: { ...h, rollCall } };
      });
    case 'introNext':
      return hostChange(s, ctx, true, (h, p) => {
        if (p !== 'intro') return null;
        const nx = nextActiveSeat(h.introCurrent, activeSeats(n, h.absentSeats));
        return nx === null ? null : { phase: p, host: { ...h, introCurrent: nx } };
      });
    case 'introSet':
      return hostChange(s, ctx, true, (h, p) => {
        if (p !== 'intro' || !activeSeats(n, h.absentSeats).includes(action.seat) || h.introCurrent === action.seat) return null;
        return { phase: p, host: { ...h, introCurrent: action.seat } };
      });
    case 'openPublicClue':
      return hostChange(s, ctx, false, (h, p) => {
        if (reachedRound(p) < action.round || h.publicClueOpened[action.round]) return null;
        return { phase: p, host: { ...h, publicClueOpened: { ...h.publicClueOpened, [action.round]: true } } };
      });
    case 'timer':
      return hostChange(s, ctx, false, (h, p) => {
        const t = h.timer;
        switch (action.op) {
          case 'pause':
            return t && t.running ? { phase: p, host: { ...h, timer: pauseTimer(t, now) } } : null;
          case 'resume':
            return t && !t.running && t.remainingMs > 0 ? { phase: p, host: { ...h, timer: resumeTimer(t, now) } } : null;
          case 'add30':
            return t ? { phase: p, host: { ...h, timer: addTimerTime(t, TIMER_ADD_MS, now) } } : null;
          case 'restart': {
            const kind = timerKindFor(p, h.roundSub);
            if (!kind) return null;
            // 동률 변론 타이머는 1차 집계가 동률일 때만(원고 8-1)
            if (kind === 'tie') {
              const v = h.vote;
              if (!v || v.sub !== 'tally') return null;
              const verdict = resolveVerdict(v, activeSeats(n, h.absentSeats), assignmentOf(ctx.c, s).culpritSeat);
              if (verdict.stage !== 'needsRevote') return null;
            }
            return { phase: p, host: { ...h, timer: startTimer(kind, timerMs(ctx.c, kind), now) } };
          }
        }
        return null;
      });
    case 'ballot':
    case 'clearBallot':
      return hostChange(s, ctx, true, (h, p) => {
        const v = h.vote;
        if (p !== 'vote' || !v) return null;
        const active = activeSeats(n, h.absentSeats);
        if (!active.includes(action.voter)) return null;
        const isRevote = v.sub === 'revote' || v.sub === 'final';
        if (!isRevote && v.sub !== 'input' && v.sub !== 'tally') return null;
        const cands = isRevote ? v.revote?.candidates : undefined;
        if (isRevote && !cands) return null;
        const ballots = { ...(isRevote ? v.revote!.ballots : v.first) };
        if (action.type === 'ballot') {
          if (!voteOptions(action.voter, active, cands).includes(action.target)) return null;
          if (ballots[action.voter] === action.target) return null;
          ballots[action.voter] = action.target;
        } else {
          if (!(action.voter in ballots)) return null;
          delete ballots[action.voter];
        }
        const done = ballotsComplete(ballots, active, cands);
        if (isRevote) {
          return { phase: p, host: { ...h, vote: { ...v, revote: { candidates: cands!, ballots }, sub: done ? 'final' : 'revote' } } };
        }
        return { phase: p, host: { ...h, vote: { ...v, first: ballots, sub: done ? 'tally' : 'input' } } };
      });
    case 'startRevote':
      return hostChange(s, ctx, true, (h, p) => {
        const v = h.vote;
        if (p !== 'vote' || !v || v.sub !== 'tally') return null;
        const a = assignmentOf(ctx.c, s);
        const verdict = resolveVerdict(v, activeSeats(n, h.absentSeats), a.culpritSeat);
        if (verdict.stage !== 'needsRevote') return null;
        return { phase: p, host: { ...h, timer: null, vote: { ...v, sub: 'revote', revote: { candidates: verdict.first.top, ballots: {} } } } };
      });
    case 'bonusAnswer':
      return hostChange(s, ctx, true, (h, p) => {
        const q = ctx.c.bonusQuestions?.find((x) => x.id === action.questionId);
        if (!q || !h.vote || !activeSeats(n, h.absentSeats).includes(action.seat)) return null;
        if (action.option !== null && !(Number.isInteger(action.option) && action.option >= 0 && action.option < q.options.length)) return null;
        const bonus = { ...(h.vote.bonus ?? {}) };
        const mine = { ...(bonus[action.seat] ?? {}) };
        if (action.option === null) delete mine[action.questionId];
        else mine[action.questionId] = action.option;
        bonus[action.seat] = mine;
        return { phase: p, host: { ...h, vote: { ...h.vote, bonus } } };
      });
    case 'revealAll':
      // "전체 한 번에 보기" — 정황 비트를 건너뛰고 **범인 도장(자백) 비트**까지. 판결은 다음 탭(QA BUG-15:
      // 예전엔 판결로 직행해 자백이 끝내 안 나왔다). 범인 비트 이후엔 건너뛸 게 없다.
      return hostChange(s, ctx, true, (h, p) => {
        if (p !== 'reveal') return null;
        const target = revealBeats(ctx.c).findIndex((b) => b.kind === 'culprit');
        if (target < 0 || h.revealIndex >= target) return null;
        return { phase: p, host: { ...h, revealIndex: target } };
      });
    case 'mission':
      return hostChange(s, ctx, false, (h, p) => {
        if (!Number.isInteger(action.seat) || action.seat < 1 || action.seat > n) return null;
        const mine = { ...(h.missions[action.seat] ?? {}) };
        if (mine[action.missionId] === action.value) return null;
        mine[action.missionId] = action.value;
        return { phase: p, host: { ...h, missions: { ...h.missions, [action.seat]: mine } } };
      });
    case 'setAbsent':
      if (!Number.isInteger(action.seat) || action.seat < 2 || action.seat > n) return s;
      return hostChange(s, ctx, true, (h, p) => {
        if (h.absentSeats.includes(action.seat) === action.absent) return null;
        return { phase: p, host: applyAbsent(h, action.seat, action.absent, n) };
      });
    case 'postClue':
      return hostChange(s, ctx, true, (h, p) => {
        if (typeof action.id !== 'string' || !BOARD_ID_RE.test(action.id)) return null;
        const card = placeCardById(ctx.c, n as PlayerCount, action.id);
        if (!card || card.round > reachedRound(p)) return null;
        if (!Array.isArray(action.seats) || !action.seats.every((x) => Number.isInteger(x) && x >= 1 && x <= n)) return null;
        const seats = Array.from(new Set(action.seats)).sort((x, y) => x - y);
        const board = h.board ?? [];
        const i = board.findIndex((e) => e.id === action.id);
        if (i >= 0) {
          const merged = Array.from(new Set([...board[i].seats, ...seats])).sort((x, y) => x - y);
          if (merged.length === board[i].seats.length) return null; // 새 자리 없음 — 기록하지 않는다
          const next = board.slice();
          next[i] = { ...board[i], seats: merged };
          return { phase: p, host: { ...h, board: next } };
        }
        if (board.length >= BOARD_LIMIT) return null;
        return { phase: p, host: { ...h, board: [...board, { id: card.id, round: card.round, seats }] } };
      });
    case 'unpostClue':
      return hostChange(s, ctx, true, (h, p) => {
        const board = h.board ?? [];
        if (!board.some((e) => e.id === action.id)) return null;
        return { phase: p, host: { ...h, board: board.filter((e) => e.id !== action.id) } };
      });
    default:
      return s;
  }
}

/** 리듀서 본체 — 불가능한 액션은 같은 참조를 돌려준다 */
export function applyAction(s: GameState, action: GameAction, ctx: GameContext): GameState {
  const n = playerCountOf(s);
  const { now, c } = ctx;
  switch (action.type) {
    case 'advance': {
      if (s.role === 'host') {
        const a = assignmentOf(c, s);
        return hostChange(s, ctx, true, (h, p) => hostAdvance(h, p, ctx, n, a.culpritSeat));
      }
      const i = phaseIndex(s.phase);
      return i < PHASES.length - 1 ? touch(s, now, { phase: PHASES[i + 1] }) : s;
    }
    case 'syncPhase': {
      if (!isPhase(action.phase) || action.phase === s.phase) return s;
      if (s.role === 'host') return hostChange(s, ctx, true, (h, p) => hostSync(h, p, action.phase, ctx, n));
      return touch(s, now, { phase: action.phase });
    }
    case 'skipIntro': {
      if (s.phase !== 'cards') return s;
      if (s.role === 'host') {
        // 자기소개 → 조사 1 과 같은 진입(현장 보기부터)
        return hostChange(s, ctx, true, (h) => ({ phase: 'r1', host: enterRound(h, ctx) }));
      }
      return touch(s, now, { phase: 'r1' });
    }
    case 'examine': {
      const { round, objectId } = action;
      // 들어선 조사만(미래 라운드 금지) · 장소를 확정했으면 마감 · 물건·횟수·중복은 scene.canExamine(역할 무관)
      if (!ROUND_NOS.includes(round) || reachedRound(s.phase) < round || s.rounds[round]) return s;
      if (typeof objectId !== 'string' || !canExamine(c, s.examined, round, objectId)) return s;
      const prev = s.examined?.[round] ?? [];
      return touch(s, now, { examined: { ...(s.examined ?? {}), [round]: [...prev, objectId] } });
    }
    case 'pickPlace': {
      const { round, placeId } = action;
      if (reachedRound(s.phase) < round || s.rounds[round] || !isPlaceInRound(c, round, placeId)) return s;
      return touch(s, now, { rounds: { ...s.rounds, [round]: { placeId, pickedAt: now, opened: false, disclosure: 'undecided' } } });
    }
    case 'unpickPlace': {
      const pick = s.rounds[action.round];
      if (!pick || pick.opened) return s;
      const rounds = { ...s.rounds };
      delete rounds[action.round];
      return touch(s, now, { rounds });
    }
    case 'openClue': {
      const pick = s.rounds[action.round];
      if (!pick || pick.opened) return s;
      return touch(s, now, { rounds: { ...s.rounds, [action.round]: { ...pick, opened: true } } });
    }
    case 'disclose': {
      const pick = s.rounds[action.round];
      if (!pick || !pick.opened || pick.disclosure === action.value) return s;
      // 공개 → 비공개는 불가(이미 말했으니). 공개 직후엔 undoDisclose 로만 되돌린다.
      if (pick.disclosure === 'public') return s;
      const next: RoundPick =
        action.value === 'public'
          ? { ...pick, disclosure: 'public', disclosedAt: now, disclosedFrom: pick.disclosure }
          : { ...pick, disclosure: 'private' };
      return touch(s, now, { rounds: { ...s.rounds, [action.round]: next } });
    }
    case 'undoDisclose': {
      const pick = s.rounds[action.round];
      if (!pick || pick.disclosure !== 'public' || pick.disclosedAt === undefined) return s;
      if (now - pick.disclosedAt > DISCLOSE_UNDO_MS) return s;
      const back: RoundPick = { ...pick, disclosure: pick.disclosedFrom ?? 'undecided' };
      delete back.disclosedAt;
      delete back.disclosedFrom;
      return touch(s, now, { rounds: { ...s.rounds, [action.round]: back } });
    }
    case 'castVote': {
      const t = action.target;
      if (s.phase !== 'vote' || s.myVote || !Number.isInteger(t) || t < 1 || t > n || t === s.seat) return s;
      return touch(s, now, { myVote: { seat: t, at: now } });
    }
    case 'clearVote': {
      if (!s.myVote || s.phase !== 'vote') return s;
      const next = touch(s, now, {});
      delete next.myVote;
      return next;
    }
    case 'changeSeat': {
      const seat = action.seat;
      if (s.role !== 'player' || !Number.isInteger(seat) || seat < 2 || seat > n || seat === s.seat) return s;
      const next = touch(s, now, { seat, rounds: {} });
      delete next.myVote;
      delete next.examined; // 7판: 살펴본 기록도 그 자리의 것이 아니다
      return next;
    }
    default:
      return hostOnly(s, ctx, action, n);
  }
}

/** 이 상태에서 방장 '다음'이 가능한가(ActionBar 활성) */
export function canAdvance(s: GameState, c: GungCase, now: number): boolean {
  return applyAction(s, { type: 'advance' }, { c, now }) !== s;
}

export function canUndo(s: GameState): boolean {
  return s.role === 'host' && Boolean(s.host?.history.length);
}

/** 장소 되돌리기 가능 — 단서를 열기 전까지 */
export function canUnpick(s: GameState, round: RoundNo): boolean {
  const p = s.rounds[round];
  return Boolean(p && !p.opened);
}

export function canUndoDisclose(s: GameState, round: RoundNo, now: number): boolean {
  const p = s.rounds[round];
  return Boolean(p && p.disclosure === 'public' && p.disclosedAt !== undefined && now - p.disclosedAt <= DISCLOSE_UNDO_MS);
}

/**
 * 그 자리가 범인 자리인가. **진상 공개 전 화면에서 쓰지 말 것** — 자리 비우기 시트가 이 값을 보여 주면 방장이
 * 비우기 → 결과 → ↶ 를 되풀이해 범인을 캘 수 있다(QA BUG-02 우회). 결과 계산은 GameResult.culpritAbsent 를 쓴다.
 */
export function absentImpact(c: GungCase, s: Pick<GameState, 'code'>, seat: number): 'culprit' | 'innocent' {
  return assignmentOf(c, s).culpritSeat === seat ? 'culprit' : 'innocent';
}

/** O1 선택지 */
export function syncOptions(
  s: GameState,
): { phase: Phase; label: string; current: boolean; needsConfirm: boolean; spoiler: boolean; entersRound: RoundNo | null }[] {
  return PHASES.map((p) => ({
    phase: p,
    label: PHASE_LABELS[p],
    current: p === s.phase,
    needsConfirm: syncNeedsConfirm(s.phase, p),
    spoiler: p === 'reveal' || p === 'result',
    entersRound: roundEntered(s.phase, p),
  }));
}

// ─────────────────────────────── 점수 ───────────────────────────────

export interface MissionResult {
  id: string;
  tag?: string;
  text: string;
  points: number;
  /** true 성공 / false 실패 / null 미판정 */
  value: boolean | null;
  /** 앱이 자동 판정했는가(false = 방장 입력) */
  auto: boolean;
  /** 범인 검거로 무효(onlyIfEscaped) */
  void: boolean;
}

export interface SeatScore {
  seat: number;
  roleId: RoleId;
  isCulprit: boolean;
  absent: boolean;
  /** 1차 지목 */
  vote: number | null;
  /** 비범인이 진범을 짚었는가(범인은 null) */
  correct: boolean | null;
  votesReceived: number;
  missions: MissionResult[];
  breakdown: { correctVote: number; teamCatch: number; bonus: number; missions: number; escape: number };
  score: number;
  /** 공동 순위(1,1,3…). 이탈자는 null */
  rank: number | null;
}

export interface GameResult {
  verdict: Verdict;
  /**
   * 판결이 났는가(verdict.stage === 'decided' 이고 범인 자리가 비지 않음). false = 지목 미완료·재지목 미실시인 채
   * 진상/결과로 건너뜀, 또는 범인 자리를 비운 판 — 화면은 '검거/도주' 대신 '판결 없음'을 쓰고 결과 공유를 막아야 한다(QA BUG-06).
   */
  decided: boolean;
  /**
   * 범인 자리가 비워졌다(O8). 자리 비우기 화면은 범인 여부를 절대 보이지 않으므로(QA BUG-02 우회 차단) 이 사실은
   * **진상 공개 뒤**(판결 비트·결과)에서만 드러난다.
   */
  culpritAbsent: boolean;
  caught: boolean;
  culpritSeat: number;
  culpritRole: RoleId;
  /** 비범인 중 1차 지목에서 범인을 짚은 수 */
  hits: number;
  /** 판정자 수 = 비범인 활성 인원 */
  judges: number;
  revoted: boolean;
  /** 자리 순 */
  rows: SeatScore[];
  /** 점수 내림차순 자리(이탈자 제외) */
  ranking: number[];
  /** 검거: 명판관(원고 8-4 — 최고점, 동점이면 미션 성공 수, 그래도 같으면 공동) · 도주: [범인] */
  mvpSeats: number[];
  /** startedAt→endedAt 분(1..300), 기록 없으면 null */
  minutes: number | null;
  /** 아직 판정 안 된 미션 수 */
  pendingMissions: number;
}

function evalMission(
  m: MissionDef,
  seat: number,
  a: Assignment,
  verdict: Verdict,
  firstBallots: Record<number, number>,
  bonus: Record<number, Record<string, number>> | undefined,
  c: GungCase,
): boolean | null {
  const ck = m.check;
  const targetSeat = (t: RoleId | 'self') => (t === 'self' ? seat : seatOfRole(a, t));
  const votesOf = (s: number | null) => (s === null ? 0 : verdict.first.counts[s] ?? 0);
  switch (ck.kind) {
    case 'manual':
      return null;
    case 'votesAtLeast':
      return verdict.firstComplete ? votesOf(targetSeat(ck.target)) >= ck.min : null;
    case 'votesAtMost':
      return verdict.firstComplete ? votesOf(targetSeat(ck.target)) <= ck.max : null;
    case 'notTopVoted': {
      if (!verdict.firstComplete) return null;
      const t = targetSeat(ck.target);
      return t === null || !verdict.first.top.includes(t);
    }
    case 'votedCulprit':
      return verdict.firstComplete ? firstBallots[seat] === a.culpritSeat : null;
    case 'bonusCorrect': {
      const q = c.bonusQuestions?.find((x) => x.id === ck.questionId);
      const ans = bonus?.[seat]?.[ck.questionId];
      return q && ans !== undefined ? ans === q.answer : null;
    }
  }
  return null;
}

/** 결과 계산 — 방장 상태만으로(단일 진실원, D18) */
export function computeResult(c: GungCase, a: Assignment, host: HostCore): GameResult {
  const rule = scoringOf(c);
  const active = activeSeats(a.n, host.absentSeats);
  const verdict = resolveVerdict(host.vote, active, a.culpritSeat);
  const culpritAbsent = !active.includes(a.culpritSeat);
  // 범인이 자리를 비운 판은 검거도 도주도 아니다 — 판결 없음
  const decided = verdict.stage === 'decided' && !culpritAbsent;
  const caught = decided && verdict.caught;
  const firstBallots = host.vote?.first ?? {};
  const bonus = host.vote?.bonus;

  const rows: SeatScore[] = a.seats.map((roleId, i) => {
    const seat = i + 1;
    const isCulprit = seat === a.culpritSeat;
    const absent = !active.includes(seat);
    const vote = !absent && active.includes(firstBallots[seat]) && firstBallots[seat] !== seat ? firstBallots[seat] : null;
    const correct = isCulprit ? null : vote === null ? (verdict.firstComplete ? false : null) : vote === a.culpritSeat;
    const role = c.roles.find((r) => r.id === roleId);
    let missionDefs = role?.byCount?.[a.n]?.missions ?? role?.missions ?? [];
    if (isCulprit && role?.asCulprit?.missions) missionDefs = role.asCulprit.missions;

    const missions: MissionResult[] = missionDefs.map((m) => {
      const points = m.points ?? rule.mission;
      const isVoid = Boolean(m.onlyIfEscaped && caught);
      const auto = evalMission(m, seat, a, verdict, firstBallots, bonus, c);
      const manual = host.missions[seat]?.[m.id];
      const value = isVoid ? null : auto !== null ? auto : manual ?? null;
      return { id: m.id, tag: m.tag, text: m.text, points, value, auto: auto !== null, void: isVoid };
    });

    const breakdown = { correctVote: 0, teamCatch: 0, bonus: 0, missions: 0, escape: 0 };
    if (!absent) {
      if (isCulprit) {
        if (decided && !caught) breakdown.escape = rule.culpritEscape;
      } else {
        if (correct) breakdown.correctVote = rule.correctVote;
        if (caught) breakdown.teamCatch = rule.teamCatch;
        for (const q of c.bonusQuestions ?? []) {
          if (bonus?.[seat]?.[q.id] === q.answer) breakdown.bonus += rule.bonusCorrect;
        }
      }
      breakdown.missions = missions.reduce((sum, m) => sum + (m.value === true && !m.void ? m.points : 0), 0);
    }
    const score = breakdown.correctVote + breakdown.teamCatch + breakdown.bonus + breakdown.missions + breakdown.escape;
    return {
      seat,
      roleId,
      isCulprit,
      absent,
      vote,
      correct,
      votesReceived: verdict.first.counts[seat] ?? 0,
      missions,
      breakdown,
      score,
      rank: null,
    };
  });

  const live = rows.filter((r) => !r.absent);
  const ranking = live
    .slice()
    .sort((x, y) => y.score - x.score || x.seat - y.seat)
    .map((r) => r.seat);
  for (const r of live) r.rank = 1 + live.filter((o) => o.score > r.score).length;

  const successes = (r: SeatScore) => r.missions.filter((m) => m.value === true && !m.void).length;
  let mvpSeats: number[] = [];
  if (decided && !caught) {
    mvpSeats = [a.culpritSeat];
  } else if (caught) {
    const pool = live.filter((r) => !r.isCulprit);
    const best = Math.max(...pool.map((r) => r.score));
    let tied = pool.filter((r) => r.score === best);
    const bestM = Math.max(...tied.map(successes));
    tied = tied.filter((r) => successes(r) === bestM);
    mvpSeats = tied.map((r) => r.seat);
  }

  const nonCulprit = live.filter((r) => !r.isCulprit);
  const hits = nonCulprit.filter((r) => r.correct === true).length;
  const minutes =
    host.startedAt !== undefined && host.endedAt !== undefined
      ? Math.min(300, Math.max(1, Math.round((host.endedAt - host.startedAt) / 60_000)))
      : null;

  return {
    verdict,
    decided,
    culpritAbsent,
    caught,
    culpritSeat: a.culpritSeat,
    culpritRole: a.culpritRole,
    hits,
    judges: nonCulprit.length,
    revoted: verdict.revoted,
    rows,
    ranking,
    mvpSeats,
    minutes,
    pendingMissions: live.reduce((n, r) => n + r.missions.filter((m) => m.value === null && !m.void).length, 0),
  };
}

/** GameState(방장)에서 바로 결과 계산 */
export function resultOf(c: GungCase, s: GameState): GameResult | null {
  if (s.role !== 'host' || !s.host) return null;
  return computeResult(c, assignmentOf(c, s), coreOf(s.host));
}
