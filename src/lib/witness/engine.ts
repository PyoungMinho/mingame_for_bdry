/**
 * 「목격자는 AI」 엔진 — 순수 함수(React·DOM 비의존). 모든 행동은 (run, …) → Step{ run, events, error? }.
 *
 * 규칙 출처: docs/planning/witness-system.md
 *  - 2-1 비용(첫 진입·첫 열람 1, 재방문·재진입·추궁·제시 0, ★ 해금 무료 — 비용은 사건 데이터의 cost 로 명시)
 *  - 2-5 행동 0: 그 행위(장소·세트)는 끝까지, 나오는 순간 사이렌. 이후 재진입 금지(chain 세트는 같은 흐름으로 본다)
 *  - 3-4 제시 판정: 이미 깸 → 돌파(requires 미충족이면 HALF) → HALF(겹침 · v3 반쪽 카드) → 우회 → 오답
 *  - 3-5 신뢰도·되감기, 3-8 수첩 정리(힌트), 4-2 엔딩·등급, 5 업적
 * UI 는 원시 배열을 해석하지 않고 아래 셀렉터(costOf·roomStatus·setStatus·visibleHotspots·visibleLines …)만 쓴다(디자인 §8-2).
 * 범인 id 는 코드에 없다 — 전부 CASE.solution 에서 읽는다.
 */
import { CASE } from './case-data';
import type {
  AchievementId,
  Break,
  CardId,
  CardSet,
  Cond,
  Dialogue,
  EndingId,
  Evidence,
  Grade,
  Hotspot,
  Id,
  Line,
  Location,
  Profile,
  ProfileId,
  Slot,
  Speaker,
  SuspectId,
  TestimonySet,
} from './types';
import { SLOTS } from './types';

// ─────────────────────────────── 상수 ───────────────────────────────

/** 난이도 모드 — 형사 모드(P1)는 여기에 한 줄 더하면 된다(시스템 7-1 · 디자인 §8-4) */
export type Mode = 'normal';

export interface Rules {
  actions: number;
  minutesPerAction: number;
  /** 수사 시작 시각(분) — 23:00 */
  startMinute: number;
  trustMax: number;
  trustOnStar: number;
  hintsMax: number;
  hintCost: number;
  starGate: number;
  confirmWhenActionsLeq: number;
  sMaxWrong: number;
  rewindTrust: number;
}

export const RULES: Record<Mode, Rules> = {
  normal: {
    actions: 12,
    minutesPerAction: 10,
    startMinute: 23 * 60,
    trustMax: 5,
    trustOnStar: 1,
    hintsMax: 2,
    hintCost: 1,
    starGate: 3,
    confirmWhenActionsLeq: 2,
    sMaxWrong: 2,
    rewindTrust: 2,
  },
};

export const CASE_ID = CASE.id;
export const SAVE_V = 1 as const;

// ─────────────────────────────── 상태 ───────────────────────────────

export type ScreenName = 'intro' | 'rules' | 'hub' | 'location' | 'testimony' | 'accuse' | 'siren' | 'ending';
export type HubTab = 'house' | 'people' | 'notebook';

export interface Screen {
  name: ScreenName;
  ref?: Id;
  tab?: HubTab;
  line?: number;
  /** 직전 돌파 id — 판정 직후 닫았으면 결과 카드부터 */
  replay?: Id;
}

export type Phase = 'play' | 'siren' | 'ended';

export interface AccuseDraft {
  stage: 'suspect' | 'slots' | 'confirm';
  culprit?: SuspectId;
  means?: Id;
  opportunity?: Id;
  motive?: Id;
  /** 사이렌 강제 지목(경고 생략) */
  forced?: boolean;
}

export interface Accusation {
  culprit: SuspectId;
  means: Id;
  opportunity: Id;
  motive: Id;
}

export type HintTarget = { kind: 'set'; id: Id } | { kind: 'location'; id: Id } | { kind: 'accuse' };

export interface HintEntry {
  text: string[];
  target?: HintTarget;
}

export interface MissedItem {
  id: Id;
  missHint: string;
  /** true = 원본은 얻었지만 갱신(진실)을 못 봤다 */
  upgrade?: boolean;
}

export interface RunResult {
  ending: EndingId;
  grade: Grade;
  title: string;
  accusation?: Accusation;
  slots?: Record<Slot, boolean>;
  stars: number;
  starTotal: number;
  evidence: number;
  evidenceTotal: number;
  wrong: number;
  hints: number;
  actionsLeft: number;
  playMs: number;
  missed: MissedItem[];
  unbrokenStars: number;
  /** 완벽 해결인데 숨은 엔딩이 아님 → "AI가 아직 하지 않은 말이 하나 있다." */
  hiddenTeaser: boolean;
  achievements: AchievementId[];
  /** 비밀 도감에 기록할 인물(범인은 범인·동기 칸을 맞혔을 때) */
  secretsRevealed: SuspectId[];
}

export interface RunCore {
  v: typeof SAVE_V;
  caseId: typeof CASE_ID;
  mode?: Mode;
  actions: number;
  trust: number;
  /** 누적 틀린 제시(튜토리얼 제외) */
  wrong: number;
  hints: number;
  rewound: boolean;
  /** 들어간 장소 id + 조사한 핫스팟 id */
  visited: Id[];
  /** 연 증언 세트 */
  opened: Id[];
  /** 해금돼 무료로 기다리는 세트·장소·핫스팟(파생값, 매 단계 재계산) */
  freePass: Id[];
  /** 보유 증거(갱신 반영) */
  evidence: Id[];
  /** 깬 돌파 id(순서 = 깬 순서) */
  broken: Id[];
  pressed: Id[];
  revealed: Id[];
  flags: Id[];
  secrets: SuspectId[];
  screen: Screen;
  startedAt: number;
  playMs: number;
  phase: Phase;
  /** 행동이 0이 된 뒤에도 끝까지 마칠 수 있는 대상(장소·세트) — 나오면 사이렌 */
  final: Id[];
  accuse?: AccuseDraft;
  hintLog?: HintEntry[];
  seen?: Id[];
  /** 또박이 지목 이스터에그를 봤다 */
  egg?: boolean;
  result?: RunResult;
}

export interface RunState extends RunCore {
  /** 심문·대질 진입 직전 스냅샷 */
  checkpoint?: RunCore;
}

// ─────────────────────────────── 이벤트 ───────────────────────────────

export type VerdictKind = 'BREAK' | 'HALF' | 'REDIRECT' | 'WRONG' | 'ALREADY';

export type EngineEvent =
  | { t: 'spent'; cost: number; left: number }
  | { t: 'acquired'; id: Id }
  | { t: 'upgraded'; from: Id; to: Id }
  | { t: 'revealed'; line: Id }
  | { t: 'question'; id: Id }
  | { t: 'flag'; id: Id }
  | { t: 'hotspotOpened'; location: Id; hotspot: Id }
  | { t: 'verdict'; kind: VerdictKind; tier?: 'star' | 'minor'; breakId?: Id; lines: Dialogue[]; tutorial?: boolean }
  | { t: 'trust'; value: number; delta: number }
  | { t: 'star'; count: number }
  | { t: 'secret'; who: SuspectId }
  | { t: 'cleared'; set: Id; outro: Dialogue[] }
  | { t: 'hint'; lines: Dialogue[]; target?: HintTarget }
  | { t: 'easterEgg'; lines: Dialogue[] }
  | { t: 'siren' }
  | { t: 'excluded' }
  | { t: 'ended'; ending: EndingId; grade: Grade };

export type StepError =
  | 'unknown'
  | 'locked'
  | 'siren'
  | 'ended'
  | 'no-actions'
  | 'not-visited'
  | 'not-opened'
  | 'hidden'
  | 'bad-cards'
  | 'not-held'
  | 'no-hints'
  | 'gate'
  | 'not-accusing'
  | 'bad-accusation'
  | 'no-checkpoint';

export interface Step {
  run: RunState;
  events: EngineEvent[];
  error?: StepError;
}

// ─────────────────────────────── 색인 ───────────────────────────────

interface LineRef {
  line: Line;
  set: TestimonySet;
}
interface BreakRef {
  brk: Break;
  line: Line;
  set: TestimonySet;
}

const EV = new Map<Id, Evidence>(CASE.evidence.map((e) => [e.id, e]));
/** 원본 → 갱신본(v3: 단계형 — E03 → E03a → E03b) */
const UPGRADE_TO = new Map<Id, Id>();
for (const e of CASE.evidence) if (e.upgradeOf) UPGRADE_TO.set(e.upgradeOf, e.id);
/** 갱신 사슬의 윗단(원본 쪽) 전부 — 가까운 것부터 */
function ancestorsOf(id: Id): Id[] {
  const out: Id[] = [];
  for (let cur = EV.get(id)?.upgradeOf; cur && !out.includes(cur); cur = EV.get(cur)?.upgradeOf) out.push(cur);
  return out;
}
/** 갱신 사슬의 끝(더 갱신되지 않는 카드) */
function finalUpgradeOf(id: Id): Id {
  const seen = new Set<Id>([id]);
  let cur = id;
  for (let nx = UPGRADE_TO.get(cur); nx && !seen.has(nx); nx = UPGRADE_TO.get(cur)) {
    seen.add(nx);
    cur = nx;
  }
  return cur;
}
const BASE_EVIDENCE = CASE.evidence.filter((e) => !e.upgradeOf);
const LOC = new Map<Id, Location>(CASE.locations.map((l) => [l.id, l]));
const HS = new Map<Id, { hotspot: Hotspot; location: Location }>();
for (const l of CASE.locations) for (const h of l.hotspots) HS.set(h.id, { hotspot: h, location: l });
const SET = new Map<Id, TestimonySet>(CASE.sets.map((s) => [s.id, s]));
const LINE = new Map<Id, LineRef>();
const BRK = new Map<Id, BreakRef>();
for (const s of CASE.sets)
  for (const l of s.lines) {
    LINE.set(l.id, { line: l, set: s });
    for (const b of l.breaks ?? []) BRK.set(b.id, { brk: b, line: l, set: s });
  }
const PROFILE = new Map<Id, Profile>(CASE.profiles.map((p) => [p.id, p]));
const REVEALER = new Map<Id, Id>();
for (const { line } of LINE.values()) if (line.press.reveals) REVEALER.set(line.press.reveals, line.id);
const FLAG_FROM_PRESS = new Map<Id, Id>();
for (const { line } of LINE.values()) if (line.press.flag) FLAG_FROM_PRESS.set(line.press.flag, line.id);
const FLAG_FROM_BREAK = new Map<Id, Id>();
for (const { brk } of BRK.values()) for (const u of brk.unlocks) if ('flag' in u) FLAG_FROM_BREAK.set(u.flag, brk.id);
const SUSPECTS: readonly SuspectId[] = ['S1', 'S2', 'S3', 'S4'];

/** 사건 전체 ★ 수 */
export const STAR_TOTAL = [...BRK.values()].filter((b) => b.brk.tier === 'star').length;
/** 증거 칸 수(갱신 카드 제외) = 18 */
export const EVIDENCE_TOTAL = BASE_EVIDENCE.length;

export function rulesOf(run?: Pick<RunCore, 'mode'>): Rules {
  return RULES[run?.mode ?? 'normal'];
}

export const getEvidence = (id: Id): Evidence | undefined => EV.get(id);
export const getLocation = (id: Id): Location | undefined => LOC.get(id);
export const getSet = (id: Id): TestimonySet | undefined => SET.get(id);
export const getLine = (id: Id): LineRef | undefined => LINE.get(id);
export const getBreak = (id: Id): BreakRef | undefined => BRK.get(id);
export const getHotspot = (id: Id): { hotspot: Hotspot; location: Location } | undefined => HS.get(id);
export const getProfile = (id: Id): Profile | undefined => PROFILE.get(id);
export const isProfileCard = (id: Id): id is ProfileId => PROFILE.has(id);
export const allBreakIds = (): Id[] => [...BRK.keys()];

/** 알려진 id 집합(저장 검증용) */
export const KNOWN = {
  evidence: new Set(EV.keys()),
  locations: new Set(LOC.keys()),
  hotspots: new Set(HS.keys()),
  sets: new Set(SET.keys()),
  lines: new Set(LINE.keys()),
  hiddenLines: new Set([...LINE.values()].filter((r) => r.line.hidden).map((r) => r.line.id)),
  breaks: new Set(BRK.keys()),
  flags: new Set([...FLAG_FROM_PRESS.keys(), ...FLAG_FROM_BREAK.keys()]),
  suspects: new Set<string>(SUSPECTS),
  cards: new Set([...EV.keys(), ...PROFILE.keys()]),
};

// ─────────────────────────────── 기본 질의 ───────────────────────────────

const has = (arr: readonly Id[], id: Id): boolean => arr.includes(id);

export function evalCond(c: Cond | undefined, run: RunCore): boolean {
  if (!c) return true;
  if ('all' in c) return c.all.every((x) => evalCond(x, run));
  if ('any' in c) return c.any.some((x) => evalCond(x, run));
  if ('not' in c) return !evalCond(c.not, run);
  if ('broken' in c) return has(run.broken, c.broken);
  if ('hasEvidence' in c) return has(run.evidence, c.hasEvidence);
  if ('flag' in c) return has(run.flags, c.flag);
  return has(run.visited, c.visited);
}

const locAvailable = (run: RunCore, l: Location): boolean => l.initial || (!!l.unlock && evalCond(l.unlock, run));
const setAvailable = (run: RunCore, s: TestimonySet): boolean => s.initial || (!!s.unlock && evalCond(s.unlock, run));
const hotspotVisible = (run: RunCore, h: Hotspot): boolean => !h.unlock || evalCond(h.unlock, run);
const lineVisible = (run: RunCore, l: Line): boolean => !l.hidden || has(run.revealed, l.id);

/** 증거를 (원본이든 갱신본이든) 갖고 있나 */
function holdsOrSuperseded(run: RunCore, id: Id, depth = 0): boolean {
  if (has(run.evidence, id)) return true;
  const to = UPGRADE_TO.get(id);
  return !!to && depth < 8 && holdsOrSuperseded(run, to, depth + 1);
}

const cardHeld = (run: RunCore, id: CardId): boolean => PROFILE.has(id) || has(run.evidence, id);

/** 이 장소·세트에 지금 들어가거나 손댈 수 있나(사이렌 규칙) */
function accessible(run: RunCore, id: Id): boolean {
  if (run.phase !== 'play') return false;
  return run.actions > 0 || has(run.final, id);
}

export function stars(run: RunCore): number {
  return run.broken.filter((b) => BRK.get(b)?.brk.tier === 'star').length;
}

export function canAccuse(run: RunCore): boolean {
  if (run.phase === 'ended') return false;
  return stars(run) >= rulesOf(run).starGate;
}

export function isBroken(run: RunCore, breakId: Id): boolean {
  return has(run.broken, breakId);
}

function lineCleared(run: RunCore, l: Line): boolean {
  return !!l.breaks?.length && l.breaks.every((b) => has(run.broken, b.id));
}

function setCleared(run: RunCore, s: TestimonySet): boolean {
  const bs = s.lines.flatMap((l) => l.breaks ?? []);
  return bs.length > 0 && bs.every((b) => has(run.broken, b.id));
}

// ─────────────────────────────── 생성 ───────────────────────────────

export interface NewRunOptions {
  now?: number;
  /** 2회차 건너뛰기: 튜토리얼 증거 자동 획득 + 튜토리얼 돌파 처리(디자인 §8-3 A8) */
  skipTutorial?: boolean;
  mode?: Mode;
}

export function newRun(opts: NewRunOptions = {}): RunState {
  const rules = RULES[opts.mode ?? 'normal'];
  let run: RunState = {
    v: SAVE_V,
    caseId: CASE_ID,
    mode: opts.mode ?? 'normal',
    actions: rules.actions,
    trust: rules.trustMax,
    wrong: 0,
    hints: 0,
    rewound: false,
    visited: [],
    opened: [],
    freePass: [],
    evidence: [],
    broken: [],
    pressed: [],
    revealed: [],
    flags: [],
    secrets: [],
    screen: { name: opts.skipTutorial ? 'hub' : 'intro' },
    startedAt: opts.now ?? 0,
    playMs: 0,
    phase: 'play',
    final: [],
  };
  if (opts.skipTutorial) {
    for (const l of CASE.locations.filter((x) => x.tutorial)) {
      run = enterLocation(run, l.id).run;
      for (const h of l.hotspots) if (!h.precise && hotspotVisible(run, h)) run = examine(run, h.id).run;
    }
    for (const s of CASE.sets.filter((x) => x.kind === 'tutorial')) {
      run = openSet(run, s.id).run;
      for (const l of s.lines)
        for (const b of l.breaks ?? []) {
          if (has(run.broken, b.id)) continue;
          run = present(run, l.id, b.evidence).run;
        }
    }
    run = { ...run, checkpoint: undefined, screen: { name: 'hub', tab: 'house' } };
  }
  return finish(run);
}

// ─────────────────────────────── 내부 변경 도우미 ───────────────────────────────

function draft(run: RunState): RunState {
  return {
    ...run,
    visited: [...run.visited],
    opened: [...run.opened],
    evidence: [...run.evidence],
    broken: [...run.broken],
    pressed: [...run.pressed],
    revealed: [...run.revealed],
    flags: [...run.flags],
    secrets: [...run.secrets],
    final: [...run.final],
    screen: { ...run.screen },
  };
}

function core(run: RunState): RunCore {
  const { checkpoint: _cp, ...rest } = run;
  void _cp;
  return rest;
}

/** 파생값(freePass) 재계산 */
function finish(run: RunState): RunState {
  const free: Id[] = [];
  for (const s of CASE.sets) if (!s.initial && s.cost === 0 && !has(run.opened, s.id) && setAvailable(run, s)) free.push(s.id);
  for (const l of CASE.locations) {
    if (!l.initial && l.cost === 0 && !has(run.visited, l.id) && locAvailable(run, l)) free.push(l.id);
    if (has(run.visited, l.id))
      for (const h of l.hotspots) if (h.unlock && !h.precise && !has(run.visited, h.id) && hotspotVisible(run, h)) free.push(h.id);
  }
  return { ...run, freePass: free };
}

const ok = (run: RunState, events: EngineEvent[] = []): Step => ({ run: finish(run), events });
const fail = (run: RunState, error: StepError): Step => ({ run, events: [], error });

function guardPlay(run: RunState): StepError | null {
  if (run.phase === 'ended') return 'ended';
  if (run.phase === 'siren') return 'siren';
  return null;
}

/** 행동을 쓴다. 0이 되면 지금 대상만 끝까지 허용 */
function spend(r: RunState, cost: number, target: Id | null, ev: EngineEvent[]): void {
  if (cost <= 0) return;
  r.actions -= cost;
  ev.push({ t: 'spent', cost, left: r.actions });
  if (r.actions <= 0) {
    r.actions = 0;
    r.final = target ? [target] : [];
  }
}

function acquire(r: RunState, id: Id, ev: EngineEvent[]): void {
  if (holdsOrSuperseded(r, id)) return;
  r.evidence.push(id);
  ev.push({ t: 'acquired', id });
}

function visibleHotspotIds(run: RunCore): Set<Id> {
  const out = new Set<Id>();
  for (const l of CASE.locations) if (locAvailable(run, l)) for (const h of l.hotspots) if (hotspotVisible(run, h)) out.add(h.id);
  return out;
}

function pushHotspotDiff(before: Set<Id>, after: RunCore, ev: EngineEvent[]): void {
  for (const id of visibleHotspotIds(after)) if (!before.has(id)) ev.push({ t: 'hotspotOpened', location: HS.get(id)!.location.id, hotspot: id });
}

// ─────────────────────────────── 화면 앵커 ───────────────────────────────

export function setScreen(run: RunState, screen: Screen): RunState {
  return { ...run, screen: { ...screen } };
}

export function addPlayTime(run: RunState, ms: number): RunState {
  if (!(ms > 0) || !Number.isFinite(ms)) return run;
  return { ...run, playMs: run.playMs + Math.round(ms) };
}

export function markSeen(run: RunState, ids: Id[]): RunState {
  const seen = new Set(run.seen ?? []);
  let changed = false;
  for (const id of ids)
    if (!seen.has(id)) {
      seen.add(id);
      changed = true;
    }
  return changed ? { ...run, seen: [...seen] } : run;
}

// ─────────────────────────────── 조사 ───────────────────────────────

export function enterLocation(run: RunState, id: Id): Step {
  const loc = LOC.get(id);
  if (!loc) return fail(run, 'unknown');
  const g = guardPlay(run);
  if (g) return fail(run, g);
  if (!locAvailable(run, loc)) return fail(run, 'locked');
  if (!accessible(run, id)) return fail(run, 'siren');
  const r = draft(run);
  const ev: EngineEvent[] = [];
  if (!has(r.visited, id)) {
    if (loc.cost > r.actions) return fail(run, 'no-actions');
    spend(r, loc.cost, id, ev);
    r.visited.push(id);
  }
  r.screen = { name: 'location', ref: id };
  return ok(r, ev);
}

/** 핫스팟 조사 — 일반은 무료, 정밀 조사는 처음 한 번 행동 1 */
export function examine(run: RunState, hotspotId: Id): Step {
  const ref = HS.get(hotspotId);
  if (!ref) return fail(run, 'unknown');
  const g = guardPlay(run);
  if (g) return fail(run, g);
  const { hotspot, location } = ref;
  if (!has(run.visited, location.id)) return fail(run, 'not-visited');
  if (!accessible(run, location.id)) return fail(run, 'siren');
  if (!hotspotVisible(run, hotspot)) return fail(run, 'locked');
  if (has(run.visited, hotspotId)) return ok(run);
  const r = draft(run);
  const ev: EngineEvent[] = [];
  if (hotspot.precise) {
    if (r.actions < 1) return fail(run, 'no-actions');
    spend(r, 1, location.id, ev);
  }
  r.visited.push(hotspotId);
  for (const e of hotspot.gives ?? []) acquire(r, e, ev);
  return ok(r, ev);
}

// ─────────────────────────────── 심문 ───────────────────────────────

/** 증언 세트 열기(첫 열람만 비용). 진입 직전 checkpoint 를 찍는다 */
export function openSet(run: RunState, id: Id): Step {
  const set = SET.get(id);
  if (!set) return fail(run, 'unknown');
  const g = guardPlay(run);
  if (g) return fail(run, g);
  if (!setAvailable(run, set)) return fail(run, 'locked');
  if (!accessible(run, id)) return fail(run, 'siren');
  const first = !has(run.opened, id);
  if (first && set.cost > run.actions) return fail(run, 'no-actions');
  const r = draft(run);
  r.checkpoint = core(run);
  const ev: EngineEvent[] = [];
  if (first) {
    spend(r, set.cost, id, ev);
    r.opened.push(id);
  }
  r.screen = { name: 'testimony', ref: id, line: 0 };
  return ok(r, ev);
}

function lineGuard(run: RunState, lineId: Id): { ref: LineRef } | { error: StepError } {
  const ref = LINE.get(lineId);
  if (!ref) return { error: 'unknown' };
  const g = guardPlay(run);
  if (g) return { error: g };
  if (!has(run.opened, ref.set.id)) return { error: 'not-opened' };
  if (!accessible(run, ref.set.id)) return { error: 'siren' };
  if (!lineVisible(run, ref.line)) return { error: 'hidden' };
  return { ref };
}

/** 추궁(무료·무제한). 처음 한 번만 효과(숨은 줄·메모 증거·의문·플래그) */
export function press(run: RunState, lineId: Id): Step {
  const lg = lineGuard(run, lineId);
  if ('error' in lg) return fail(run, lg.error);
  const { line } = lg.ref;
  if (has(run.pressed, lineId)) return ok(run);
  const r = draft(run);
  const ev: EngineEvent[] = [];
  const before = visibleHotspotIds(r);
  r.pressed.push(lineId);
  const p = line.press;
  if (p.reveals && !has(r.revealed, p.reveals)) {
    r.revealed.push(p.reveals);
    ev.push({ t: 'revealed', line: p.reveals });
  }
  if (p.gives) acquire(r, p.gives, ev);
  if (p.question) ev.push({ t: 'question', id: p.question.id });
  if (p.flag && !has(r.flags, p.flag)) {
    r.flags.push(p.flag);
    ev.push({ t: 'flag', id: p.flag });
    pushHotspotDiff(before, r, ev);
  }
  return ok(r, ev);
}

const sameSet = (a: readonly Id[], b: readonly Id[]): boolean => a.length === b.length && a.every((x) => b.includes(x));

/** (v3) 반쪽 카드 — half 객체의 카드 키('requires' 제외). 정답 세트에 없어도 그 줄에서 HALF */
export function halfCards(brk: Break): CardId[] {
  const h = brk.half;
  if (!h || Array.isArray(h)) return [];
  return Object.keys(h).filter((k) => k !== 'requires');
}

export interface Judgement {
  kind: VerdictKind;
  brk?: Break;
  /** HALF 대사 */
  lines?: Dialogue[];
}

function pickHalf(brk: Break, cards: readonly Id[], requiresUnmet: boolean, exact: boolean): Dialogue[] {
  const h = brk.half;
  if (!h) return [CASE.copy.half];
  if (Array.isArray(h)) return h;
  if (exact && requiresUnmet && h.requires) return h.requires;
  for (const c of cards) {
    const v = h[c];
    if (v && v.length) return v;
  }
  if (requiresUnmet && h.requires) return h.requires;
  return [CASE.copy.half];
}

/** 순수 판정(상태 변화 없음) — 시스템 3-4 */
export function judgePresent(run: RunCore, lineId: Id, cards: readonly CardId[]): Judgement {
  const ref = LINE.get(lineId);
  if (!ref) return { kind: 'WRONG' };
  const { line } = ref;
  if (lineCleared(run, line)) return { kind: 'ALREADY', lines: [CASE.copy.already] };
  const breaks = (line.breaks ?? []).filter((b) => !has(run.broken, b.id));
  for (const b of breaks)
    for (const s of [b.evidence, ...(b.accept ?? [])] as CardSet[])
      if (sameSet(cards, s)) {
        const req = !b.requires || evalCond(b.requires, run);
        return req ? { kind: 'BREAK', brk: b } : { kind: 'HALF', brk: b, lines: pickHalf(b, cards, true, true) };
      }
  for (const b of breaks) {
    const touch = [...(b.accept ?? []), b.evidence].some((s) => cards.some((c) => s.includes(c))) || cards.some((c) => halfCards(b).includes(c));
    if (touch) {
      const req = !b.requires || evalCond(b.requires, run);
      return { kind: 'HALF', brk: b, lines: pickHalf(b, cards, !req, false) };
    }
  }
  if (line.redirect && cards.every((c) => line.redirect!.cards.includes(c))) return { kind: 'REDIRECT', lines: line.redirect.say };
  return { kind: 'WRONG' };
}

export function wrongReactionLines(run: RunCore, who: Speaker): Dialogue[] {
  const pool = CASE.wrongReactions[who] ?? CASE.wrongReactions.AI ?? [];
  const out: Dialogue[] = [];
  if (pool.length) out.push({ who, text: pool[run.wrong % pool.length] });
  out.push(CASE.copy.wrongMonologue);
  return out;
}

/** 증거 제시(1~2장). 틀리면 신뢰 −1(튜토리얼 제외), ★ 돌파면 +1 */
export function present(run: RunState, lineId: Id, cards: readonly CardId[]): Step {
  const lg = lineGuard(run, lineId);
  if ('error' in lg) return fail(run, lg.error);
  const { line, set } = lg.ref;
  if (cards.length < 1 || cards.length > 2 || new Set(cards).size !== cards.length) return fail(run, 'bad-cards');
  if (!cards.every((c) => KNOWN.cards.has(c))) return fail(run, 'bad-cards');
  if (!cards.every((c) => cardHeld(run, c))) return fail(run, 'not-held');
  const j = judgePresent(run, lineId, cards);
  const tutorial = set.kind === 'tutorial';
  if (j.kind === 'ALREADY' || j.kind === 'HALF' || j.kind === 'REDIRECT') {
    return ok(run, [{ t: 'verdict', kind: j.kind, breakId: j.brk?.id, tier: j.brk?.tier, lines: j.lines ?? [] }]);
  }
  if (j.kind === 'WRONG') {
    const lines = wrongReactionLines(run, line.who);
    if (tutorial) return ok(run, [{ t: 'verdict', kind: 'WRONG', lines, tutorial: true }]);
    const r = draft(run);
    r.wrong += 1;
    r.trust = Math.max(0, r.trust - 1);
    const ev: EngineEvent[] = [{ t: 'verdict', kind: 'WRONG', lines }, { t: 'trust', value: r.trust, delta: -1 }];
    if (r.trust <= 0) return endRun(r, null, ev, true);
    return ok(r, ev);
  }
  return applyBreak(run, j.brk!, set);
}

function applyBreak(run: RunState, brk: Break, set: TestimonySet): Step {
  const r = draft(run);
  const ev: EngineEvent[] = [{ t: 'verdict', kind: 'BREAK', tier: brk.tier, breakId: brk.id, lines: brk.reaction }];
  const before = visibleHotspotIds(r);
  r.broken.push(brk.id);
  for (const u of brk.unlocks) {
    if ('evidence' in u) acquire(r, u.evidence, ev);
    else if ('upgrade' in u) {
      const [from, to] = u.upgrade;
      // 사슬의 어느 윗단을 들고 있든(예: 옛 저장의 E03) 그 자리를 갱신본으로 바꾸고 나머지 윗단은 지운다
      const olds = [from, ...ancestorsOf(from)];
      const i = r.evidence.findIndex((x) => olds.includes(x));
      if (i >= 0) r.evidence[i] = to;
      else if (!has(r.evidence, to)) r.evidence.push(to);
      r.evidence = r.evidence.filter((x, k) => !olds.includes(x) && (x !== to || k === r.evidence.indexOf(to)));
      ev.push({ t: 'upgraded', from, to });
    } else if ('flag' in u) {
      if (!has(r.flags, u.flag)) {
        r.flags.push(u.flag);
        ev.push({ t: 'flag', id: u.flag });
      }
    } else if ('secret' in u) {
      if (!has(r.secrets, u.secret)) {
        r.secrets.push(u.secret);
        ev.push({ t: 'secret', who: u.secret });
      }
    } else if ('set' in u && u.chain && r.actions === 0) {
      // 행동 0 에서 깬 chain — 같은 흐름이므로 끝까지 허용(시스템 2-1 "몰아붙이는 흐름을 끊지 않는다")
      if (!has(r.final, u.set)) r.final.push(u.set);
    }
  }
  pushHotspotDiff(before, r, ev);
  if (brk.tier === 'star') {
    const rules = rulesOf(r);
    const nt = Math.min(rules.trustMax, r.trust + rules.trustOnStar);
    if (nt !== r.trust) {
      ev.push({ t: 'trust', value: nt, delta: nt - r.trust });
      r.trust = nt;
    }
    ev.push({ t: 'star', count: stars(r) });
  }
  if (setCleared(r, set)) ev.push({ t: 'cleared', set: set.id, outro: set.outro });
  r.screen = { ...r.screen, replay: brk.id };
  return ok(r, ev);
}

// ─────────────────────────────── 나가기 · 사이렌 ───────────────────────────────

/** 장소·세트에서 허브로. 행동이 0이면 사이렌 */
export function exit(run: RunState, tab?: HubTab): Step {
  if (run.phase !== 'play') return ok(run);
  const r = draft(run);
  r.screen = { name: 'hub', tab: tab ?? run.screen.tab ?? 'house' };
  if (r.actions <= 0) return siren(r, []);
  return ok(r);
}

function siren(r: RunState, ev: EngineEvent[]): Step {
  r.phase = 'siren';
  r.final = [];
  r.screen = { name: 'siren' };
  ev.push({ t: 'siren' });
  return ok(r, ev);
}

/** 사이렌 화면 [계속] — ★ 3 이상이면 강제 지목, 아니면 「시간 초과」 */
export function continueAfterSiren(run: RunState): Step {
  if (run.phase !== 'siren') return fail(run, run.phase === 'ended' ? 'ended' : 'gate');
  if (stars(run) >= rulesOf(run).starGate) {
    const r = draft(run);
    r.accuse = { stage: 'suspect', forced: true };
    r.screen = { name: 'accuse' };
    return ok(r);
  }
  return endRun(draft(run), null, []);
}

// ─────────────────────────────── 수첩 정리(힌트) ───────────────────────────────

function hasBatchim(word: string): boolean {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  return /[013678LMNRlmnr]$/.test(ch);
}

/** '{key}' 치환 + 바로 앞 낱말에 맞춘 조사 {을를}{이가}{은는}{과와} */
export function fillTemplate(tpl: string, vars: Record<string, string>): string {
  let s = tpl.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
  const pairs: Record<string, [string, string]> = { 을를: ['을', '를'], 이가: ['이', '가'], 은는: ['은', '는'], 과와: ['과', '와'] };
  s = s.replace(/(\S?)\{(을를|이가|은는|과와)\}/g, (_m, prev: string, k: string) => prev + (hasBatchim(prev || ' ') ? pairs[k][0] : pairs[k][1]));
  return s;
}

const placeName = (l: Location): string => l.name.split(' — ')[0];
const setWho = (s: TestimonySet): string => s.speakers.map((w) => CASE.names[w]).join('·');

interface HintMsg {
  lines: string[];
  target?: HintTarget;
}

function msgBreakable(ref: BreakRef): HintMsg {
  const [a, b] = CASE.copy.hintBreakable;
  return {
    lines: [fillTemplate(a, { who: setWho(ref.set), title: ref.set.title }), fillTemplate(b, { topic: ref.brk.hintTopic })],
    target: { kind: 'set', id: ref.set.id },
  };
}
const msgPlace = (l: Location): HintMsg => ({ lines: [fillTemplate(CASE.copy.hintPlace, { place: placeName(l) })], target: { kind: 'location', id: l.id } });
const msgRevisit = (l: Location): HintMsg => ({ lines: [fillTemplate(CASE.copy.hintRevisit, { place: placeName(l) })], target: { kind: 'location', id: l.id } });
const msgAsk = (s: TestimonySet): HintMsg => ({ lines: [fillTemplate(CASE.copy.hintAsk, { who: setWho(s) })], target: { kind: 'set', id: s.id } });
const msgPress = (s: TestimonySet): HintMsg => ({ lines: [fillTemplate(CASE.copy.hintPress, { who: setWho(s) })], target: { kind: 'set', id: s.id } });

function breakReady(run: RunCore, ref: BreakRef): boolean {
  if (has(run.broken, ref.brk.id)) return false;
  if (!has(run.opened, ref.set.id) || !lineVisible(run, ref.line)) return false;
  if (ref.brk.requires && !evalCond(ref.brk.requires, run)) return false;
  return [ref.brk.evidence, ...(ref.brk.accept ?? [])].some((s) => s.every((c) => cardHeld(run, c)));
}

function resolveCond(run: RunCore, c: Cond | undefined, seen: Set<string>): HintMsg | null {
  if (!c || evalCond(c, run)) return null;
  if ('all' in c) {
    for (const x of c.all) {
      const m = resolveCond(run, x, seen);
      if (m) return m;
    }
    return null;
  }
  if ('any' in c) {
    for (const x of c.any) {
      const m = resolveCond(run, x, seen);
      if (m) return m;
    }
    return null;
  }
  if ('not' in c) return null;
  if ('broken' in c) return resolveBreak(run, c.broken, seen);
  if ('hasEvidence' in c) return resolveEvidence(run, c.hasEvidence, seen);
  if ('flag' in c) {
    const pl = FLAG_FROM_PRESS.get(c.flag);
    if (pl) return resolvePressLine(run, pl, seen);
    const fb = FLAG_FROM_BREAK.get(c.flag);
    return fb ? resolveBreak(run, fb, seen) : null;
  }
  const loc = LOC.get(c.visited) ?? HS.get(c.visited)?.location;
  if (!loc) return null;
  if (!locAvailable(run, loc)) return resolveCond(run, loc.unlock, seen);
  return has(run.visited, loc.id) ? msgRevisit(loc) : msgPlace(loc);
}

function resolveSetAccess(run: RunCore, s: TestimonySet, seen: Set<string>): HintMsg | null | 'ok' {
  if (!setAvailable(run, s)) return resolveCond(run, s.unlock, seen);
  if (!has(run.opened, s.id)) return msgAsk(s);
  return 'ok';
}

function resolvePressLine(run: RunCore, lineId: Id, seen: Set<string>): HintMsg | null {
  const ref = LINE.get(lineId);
  if (!ref) return null;
  const a = resolveSetAccess(run, ref.set, seen);
  if (a !== 'ok') return a;
  return msgPress(ref.set);
}

function resolveEvidence(run: RunCore, id: Id, seen: Set<string>): HintMsg | null {
  if (holdsOrSuperseded(run, id) || PROFILE.has(id)) return null;
  const key = `e:${id}`;
  if (seen.has(key)) return null;
  seen.add(key);
  const e = EV.get(id);
  if (!e || e.from === 'start') return null;
  const f = e.from;
  if ('location' in f) {
    const loc = LOC.get(f.location)!;
    if (!locAvailable(run, loc)) return resolveCond(run, loc.unlock, seen);
    if (!has(run.visited, loc.id)) return msgPlace(loc);
    const h = HS.get(f.hotspot)!.hotspot;
    if (!hotspotVisible(run, h)) return resolveCond(run, h.unlock, seen);
    return msgRevisit(loc);
  }
  if ('press' in f) return resolvePressLine(run, f.press, seen);
  return resolveBreak(run, f.break, seen);
}

function resolveBreak(run: RunCore, breakId: Id, seen: Set<string>): HintMsg | null {
  if (has(run.broken, breakId)) return null;
  const key = `b:${breakId}`;
  if (seen.has(key)) return null;
  seen.add(key);
  const ref = BRK.get(breakId);
  if (!ref) return null;
  const a = resolveSetAccess(run, ref.set, seen);
  if (a !== 'ok') return a;
  if (!lineVisible(run, ref.line)) {
    const rv = REVEALER.get(ref.line.id);
    return rv ? resolvePressLine(run, rv, seen) : null;
  }
  const alts = [ref.brk.evidence, ...(ref.brk.accept ?? [])]
    .map((s) => ({ s, missing: s.filter((c) => !cardHeld(run, c)) }))
    .sort((x, y) => x.missing.length - y.missing.length);
  for (const { missing } of alts) {
    if (missing.length === 0) {
      if (ref.brk.requires && !evalCond(ref.brk.requires, run)) return resolveCond(run, ref.brk.requires, seen);
      return msgBreakable(ref);
    }
    for (const c of missing) {
      const m = resolveEvidence(run, c, seen);
      if (m) return m;
    }
  }
  return null;
}

/** 수첩 정리 문구(비용 없음 — 순수). 시스템 3-8 ①②③ */
export function hintFor(run: RunCore): HintEntry {
  const lead = CASE.copy.hintLead;
  const routeIdx = (id: Id) => {
    const i = CASE.hintRoute.indexOf(id);
    return i < 0 ? 99 : i;
  };
  const order = [...BRK.keys()];
  // ① 지금 깰 수 있는 것: ★ 우선, 완벽 해결 경로 순
  const ready = [...BRK.values()]
    .filter((ref) => breakReady(run, ref))
    .sort(
      (a, b) =>
        (a.brk.tier === 'star' ? 0 : 1) - (b.brk.tier === 'star' ? 0 : 1) ||
        routeIdx(a.brk.id) - routeIdx(b.brk.id) ||
        order.indexOf(a.brk.id) - order.indexOf(b.brk.id),
    );
  if (ready.length) {
    const m = msgBreakable(ready[0]);
    return { text: [lead, ...m.lines], target: m.target };
  }
  // ② 재료가 모자람: 다음 경로 돌파 → 그다음 최종 칸 정답 증거
  const seen = new Set<string>();
  for (const id of CASE.hintRoute) {
    const m = resolveBreak(run, id, seen);
    if (m) return { text: [lead, ...m.lines], target: m.target };
  }
  for (const slot of SLOTS) {
    const acc = CASE.solution.accept[slot];
    if (acc.some((id) => has(run.evidence, id))) continue;
    for (const id of acc) {
      const m = resolveEvidence(run, id, seen);
      if (m) return { text: [lead, ...m.lines], target: m.target };
    }
  }
  // ③ 경로 끝
  return { text: [lead, CASE.copy.hintDone], target: { kind: 'accuse' } };
}

/** 수첩 정리 — 행동 1, 판당 hintsMax 회 */
export function hint(run: RunState): Step {
  const g = guardPlay(run);
  if (g) return fail(run, g);
  const rules = rulesOf(run);
  if (rules.hintsMax <= 0 || run.hints >= rules.hintsMax) return fail(run, 'no-hints');
  if (run.actions < rules.hintCost) return fail(run, 'no-actions');
  const h = hintFor(run);
  const r = draft(run);
  const ev: EngineEvent[] = [];
  spend(r, rules.hintCost, null, ev);
  r.hints += 1;
  r.hintLog = [...(run.hintLog ?? []), h];
  ev.push({ t: 'hint', lines: h.text.map((text) => ({ who: 'ME' as const, text })), target: h.target });
  if (r.actions <= 0 && r.final.length === 0) return siren(r, ev);
  return ok(r, ev);
}

// ─────────────────────────────── 최종 지목 ───────────────────────────────

export function startAccuse(run: RunState): Step {
  if (run.phase === 'ended') return fail(run, 'ended');
  if (!canAccuse(run)) return fail(run, 'gate');
  const r = draft(run);
  const forced = run.phase === 'siren' || run.actions <= 0;
  r.accuse = { ...(run.accuse ?? {}), stage: run.accuse?.stage ?? 'suspect', forced };
  r.screen = { name: 'accuse' };
  return ok(r);
}

export function cancelAccuse(run: RunState): Step {
  if (!run.accuse) return ok(run);
  if (run.accuse.forced) return fail(run, 'siren');
  const r = draft(run);
  r.accuse = undefined;
  r.screen = { name: 'hub', tab: run.screen.tab ?? 'house' };
  return ok(r);
}

/** 1단계 범인 선택. 또박이를 고르면 이스터에그(페널티 없음) */
export function pickCulprit(run: RunState, who: Speaker): Step {
  if (!run.accuse) return fail(run, 'not-accusing');
  if (who === 'AI') {
    const r = draft(run);
    r.egg = true;
    return ok(r, [{ t: 'easterEgg', lines: CASE.easterEgg }]);
  }
  if (!KNOWN.suspects.has(who)) return fail(run, 'bad-accusation');
  const r = draft(run);
  r.accuse = { ...run.accuse, culprit: who as SuspectId, stage: 'slots' };
  return ok(r);
}

/** 2단계 칸 채우기 — 같은 카드가 다른 칸에 있으면 옮긴다(디자인 D25). movedFrom 으로 토스트 */
export function setSlot(run: RunState, slot: Slot, card: Id | null): Step & { movedFrom?: Slot } {
  if (!run.accuse) return fail(run, 'not-accusing');
  if (card !== null && (!EV.has(card) || !has(run.evidence, card))) return fail(run, 'not-held');
  const r = draft(run);
  const a: AccuseDraft = { ...run.accuse };
  let movedFrom: Slot | undefined;
  if (card !== null)
    for (const s of SLOTS)
      if (s !== slot && a[s] === card) {
        a[s] = undefined;
        movedFrom = s;
      }
  a[slot] = card ?? undefined;
  r.accuse = a;
  return { ...ok(r), movedFrom };
}

export function setAccuseStage(run: RunState, stage: AccuseDraft['stage']): Step {
  if (!run.accuse) return fail(run, 'not-accusing');
  const r = draft(run);
  r.accuse = { ...run.accuse, stage };
  return ok(r);
}

/** 지목 경고(시스템 1-8 v2 · v3 단계별). 강제 지목이면 생략. 위에서부터 처음 맞는 하나 */
export function accuseWarn(run: RunCore): Dialogue[] | null {
  if (run.accuse?.forced) return null;
  const w = (CASE.solution.accuseWarn ?? []).find((x) => evalCond(x.when, run));
  return w ? w.lines : null;
}

function accusationValid(run: RunCore, a: Partial<Accusation> | undefined): a is Accusation {
  if (!a || !a.culprit || !KNOWN.suspects.has(a.culprit)) return false;
  const cards = [a.means, a.opportunity, a.motive];
  if (cards.some((c) => !c || !EV.has(c) || !has(run.evidence, c))) return false;
  return new Set(cards).size === 3;
}

export interface JudgeResult {
  ending: EndingId;
  correct: number;
  slots?: Record<Slot, boolean>;
}

/** 순수 판정(시스템 4-2) */
export function judgeAccusation(run: RunCore, a: Accusation | null): JudgeResult {
  const sol = CASE.solution;
  if (run.trust <= 0) return { ending: 'excluded', correct: 0 };
  if (!a) return { ending: 'timeout', correct: 0 };
  const slots = Object.fromEntries(SLOTS.map((s) => [s, sol.accept[s].includes(a[s])])) as Record<Slot, boolean>;
  if (a.culprit !== sol.culprit) return { ending: `wrong-${a.culprit}`, correct: 0, slots };
  const correct = SLOTS.filter((s) => slots[s]).length;
  if (correct === 3) return { ending: evalCond(sol.hiddenEnding, run) ? 'hidden' : 'perfect', correct, slots };
  return { ending: 'short', correct, slots };
}

export function gradeOf(run: RunCore, j: JudgeResult): Grade {
  const rules = rulesOf(run);
  if (j.ending === 'perfect' || j.ending === 'hidden')
    return stars(run) === STAR_TOTAL && run.wrong <= rules.sMaxWrong && !run.rewound ? 'S' : 'A';
  if (j.ending === 'short' && j.correct === 2) return 'B';
  return 'C';
}

export function titleOf(ending: EndingId, grade: Grade): string {
  const t = CASE.titles;
  if (grade === 'S') return t.S;
  if (grade === 'A') return t.A;
  if (grade === 'B') return t.B;
  if (ending === 'short') return t.short;
  if (ending === 'timeout') return t.timeout;
  if (ending === 'excluded') return t.excluded;
  return t.wrong;
}

/** 기회 칸에 낸 raw 위조 원본(갱신 사슬의 끝이 forged 인 raw 로그) */
function isRawForgedSource(id: Id): boolean {
  const e = EV.get(id);
  const end = finalUpgradeOf(id);
  return !!e && e.reliability === 'raw' && end !== id && EV.get(end)?.reliability === 'forged';
}

function achievementsOf(run: RunCore, j: JudgeResult, a: Accusation | null, secretsRevealed: SuspectId[]): AchievementId[] {
  const out: AchievementId[] = [];
  const solved = j.ending === 'perfect' || j.ending === 'hidden';
  if (solved && run.wrong === 0) out.push('flawless');
  if (solved && run.actions >= 3) out.push('lightning');
  if (solved && run.hints === 0) out.push('nohint');
  if (stars(run) === STAR_TOTAL && SUSPECTS.every((s) => secretsRevealed.includes(s))) out.push('allclear');
  if (run.egg) out.push('arrestSpeaker');
  if (a && isRawForgedSource(a.opportunity)) out.push('trustedMachine');
  return out;
}

export function evidenceCount(run: RunCore): number {
  return BASE_EVIDENCE.filter((e) => holdsOrSuperseded(run, e.id)).length;
}

export function missed(run: RunCore): MissedItem[] {
  const out: MissedItem[] = [];
  for (const e of BASE_EVIDENCE) if (!holdsOrSuperseded(run, e.id)) out.push({ id: e.id, missHint: e.missHint });
  for (const e of CASE.evidence)
    if (e.upgradeOf && has(run.evidence, e.upgradeOf) && !has(run.evidence, e.id)) out.push({ id: e.id, missHint: e.missHint, upgrade: true });
  return out;
}

export function unbrokenStars(run: RunCore): number {
  return STAR_TOTAL - stars(run);
}

export function summarize(run: RunCore, a: Accusation | null): RunResult {
  const j = judgeAccusation(run, a);
  const grade = gradeOf(run, j);
  const sol = CASE.solution;
  const revealed = [...run.secrets];
  if (a && a.culprit === sol.culprit && j.slots?.motive && !revealed.includes(sol.culprit)) revealed.push(sol.culprit);
  return {
    ending: j.ending,
    grade,
    title: titleOf(j.ending, grade),
    accusation: a ?? undefined,
    slots: j.slots,
    stars: stars(run),
    starTotal: STAR_TOTAL,
    evidence: evidenceCount(run),
    evidenceTotal: EVIDENCE_TOTAL,
    wrong: run.wrong,
    hints: run.hints,
    actionsLeft: run.actions,
    playMs: run.playMs,
    missed: missed(run),
    unbrokenStars: unbrokenStars(run),
    hiddenTeaser: j.ending === 'perfect',
    achievements: achievementsOf(run, j, a, revealed),
    secretsRevealed: revealed,
  };
}

function endRun(r: RunState, a: Accusation | null, ev: EngineEvent[], excluded = false): Step {
  const result = summarize(r, a);
  r.phase = 'ended';
  r.final = [];
  r.result = result;
  r.accuse = undefined;
  r.screen = { name: 'ending' };
  if (excluded) ev.push({ t: 'excluded' });
  ev.push({ t: 'ended', ending: result.ending, grade: result.grade });
  return ok(r, ev);
}

/** 3단계 제출 — 제출 후 수정 불가 */
export function submitAccusation(run: RunState, a?: Accusation): Step {
  if (run.phase === 'ended') return fail(run, 'ended');
  if (!run.accuse) return fail(run, 'not-accusing');
  if (!canAccuse(run)) return fail(run, 'gate');
  const acc = a ?? (run.accuse as Partial<Accusation>);
  if (!accusationValid(run, acc)) return fail(run, 'bad-accusation');
  return endRun(draft(run), { culprit: acc.culprit, means: acc.means, opportunity: acc.opportunity, motive: acc.motive }, []);
}

/** 판정 연출 대본(범인을 맞혔을 때만 칸별 대사, 틀리면 오인 체포 엔딩 첫 줄로 대체) */
export function verdictScript(a: Accusation): { call: Dialogue; steps: { slot: Slot; card: Id; ok: boolean; lines: Dialogue[] }[]; wrongArrest: boolean } {
  const v = CASE.verdict;
  const call: Dialogue = { ...v.call, text: fillTemplate(v.call.text, { name: CASE.names[a.culprit] }) };
  if (a.culprit !== CASE.solution.culprit) return { call, steps: [], wrongArrest: true };
  const steps = SLOTS.map((slot) => {
    const card = a[slot];
    const good = CASE.solution.accept[slot].includes(card);
    const lines = good ? v[slot].ok : (slot === 'opportunity' ? v.opportunity.byCard?.[card] : undefined) ?? v[slot].ng;
    return { slot, card, ok: good, lines };
  });
  return { call, steps, wrongArrest: false };
}

/** 수사 배제 → 심문 직전으로 되감기(신뢰 max(체크포인트, 2), S 불가) */
export function rewind(run: RunState): Step {
  if (run.phase !== 'ended' || run.result?.ending !== 'excluded') return fail(run, 'gate');
  if (!run.checkpoint) return fail(run, 'no-checkpoint');
  const cp = run.checkpoint;
  const rules = rulesOf(run);
  const r: RunState = {
    ...cp,
    visited: [...cp.visited],
    opened: [...cp.opened],
    evidence: [...cp.evidence],
    broken: [...cp.broken],
    pressed: [...cp.pressed],
    revealed: [...cp.revealed],
    flags: [...cp.flags],
    secrets: [...cp.secrets],
    final: [...cp.final],
    trust: Math.max(cp.trust, rules.rewindTrust),
    rewound: true,
    phase: 'play',
    result: undefined,
    accuse: undefined,
    playMs: run.playMs,
    egg: run.egg || cp.egg,
    seen: run.seen,
    screen: { name: 'hub', tab: 'people' },
    checkpoint: cp,
  };
  return ok(r);
}

// ─────────────────────────────── UI 셀렉터 (디자인 §8-2) ───────────────────────────────

export type CostTarget = { location: Id } | { set: Id } | { hotspot: Id } | 'hint';

export function costOf(run: RunCore, target: CostTarget): 0 | 1 {
  if (target === 'hint') return rulesOf(run).hintCost > 0 ? 1 : 0;
  if ('location' in target) {
    const l = LOC.get(target.location);
    return !l || has(run.visited, l.id) ? 0 : l.cost;
  }
  if ('set' in target) {
    const s = SET.get(target.set);
    return !s || has(run.opened, s.id) ? 0 : s.cost;
  }
  const h = HS.get(target.hotspot)?.hotspot;
  return h?.precise && !has(run.visited, h.id) ? 1 : 0;
}

/** 마지막 행동(1 → 0) 프롬프트 변형 선택(디자인 §5-3) */
export function lastActionKind(run: RunCore, target: CostTarget): 'set' | 'location' | 'precise' | 'hint' | null {
  if (run.actions !== 1 || costOf(run, target) !== 1) return null;
  if (target === 'hint') return 'hint';
  if ('location' in target) return 'location';
  if ('set' in target) return 'set';
  return 'precise';
}

export interface RoomStatus {
  state: 'locked' | 'open' | 'visited' | 'siren';
  cost: 0 | 1;
  isNew: boolean;
  /** 아직 조사하지 않은 보이는 핫스팟 수(정밀 포함) */
  unexamined: number;
  lockedLabel?: string;
}

export function roomStatus(run: RunCore, id: Id): RoomStatus {
  const l = LOC.get(id);
  if (!l) return { state: 'locked', cost: 0, isNew: false, unexamined: 0 };
  const avail = locAvailable(run, l);
  const visited = has(run.visited, id);
  const unexamined = visited ? l.hotspots.filter((h) => hotspotVisible(run, h) && !has(run.visited, h.id)).length : 0;
  if (!avail) return { state: 'locked', cost: l.cost, isNew: false, unexamined: 0, lockedLabel: l.lockedLabel };
  const cost = costOf(run, { location: id });
  if (run.phase !== 'play' || (run.actions <= 0 && !has(run.final, id))) return { state: 'siren', cost, isNew: false, unexamined };
  const newHotspot = visited && l.hotspots.some((h) => h.unlock && !h.precise && hotspotVisible(run, h) && !has(run.visited, h.id));
  return { state: visited ? 'visited' : 'open', cost, isNew: (!visited && !l.initial) || newHotspot, unexamined };
}

export interface SetStatus {
  state: 'locked' | 'open' | 'opened' | 'siren';
  cost: 0 | 1;
  isNew: boolean;
  /** 추궁한 줄 수 / 지금 보이는 줄 수 */
  pressed: number;
  visibleLines: number;
  cleared: boolean;
}

export function setStatus(run: RunCore, id: Id): SetStatus {
  const s = SET.get(id);
  if (!s) return { state: 'locked', cost: 0, isNew: false, pressed: 0, visibleLines: 0, cleared: false };
  const vis = s.lines.filter((l) => lineVisible(run, l));
  const base = {
    cost: costOf(run, { set: id }),
    pressed: vis.filter((l) => has(run.pressed, l.id)).length,
    visibleLines: vis.length,
    cleared: setCleared(run, s),
  };
  if (!setAvailable(run, s)) return { ...base, state: 'locked', isNew: false };
  const opened = has(run.opened, id);
  if (run.phase !== 'play' || (run.actions <= 0 && !has(run.final, id))) return { ...base, state: 'siren', isNew: false };
  return { ...base, state: opened ? 'opened' : 'open', isNew: !opened && !s.initial };
}

export function visibleHotspots(run: RunCore, locId: Id): { hotspot: Hotspot; examined: boolean; isNew: boolean }[] {
  const l = LOC.get(locId);
  if (!l) return [];
  return l.hotspots
    .filter((h) => hotspotVisible(run, h))
    .map((h) => {
      const examined = has(run.visited, h.id);
      return { hotspot: h, examined, isNew: !!h.unlock && !examined };
    });
}

export function visibleLines(run: RunCore, setId: Id): { line: Line; pressed: boolean; broken: Break | null; isNew: boolean }[] {
  const s = SET.get(setId);
  if (!s) return [];
  return s.lines
    .filter((l) => lineVisible(run, l))
    .map((l) => {
      const b = (l.breaks ?? []).find((x) => has(run.broken, x.id)) ?? null;
      const pressed = has(run.pressed, l.id);
      return { line: l, pressed, broken: b, isNew: !!l.hidden && !pressed };
    });
}

/** 보유 증거(획득 순, 갱신 반영) */
export function holdings(run: RunCore): Evidence[] {
  return run.evidence.map((id) => EV.get(id)!).filter(Boolean);
}

export function profiles(run: RunCore): (Profile & { revealed: boolean })[] {
  return CASE.profiles.map((p) => {
    const revealed = KNOWN.suspects.has(p.id) && has(run.secrets, p.id);
    return revealed ? { ...p, revealed } : { ...p, secretLine: undefined, revealed };
  });
}

export interface QuestionItem {
  id: Id;
  text: string;
  resolved: boolean;
  /** 풀렸을 때만: 적어 둔 답(없으면 풀어 준 돌파의 explain) */
  answer?: string;
}

/** 의문이 풀렸나 — 돌파 id 는 깨졌는지, 증거 id 는 (갱신본 포함) 손에 있는지 */
function questionResolver(run: RunCore, resolvedBy: readonly Id[]): Id | null {
  for (const id of resolvedBy) {
    if (BRK.has(id) ? has(run.broken, id) : holdsOrSuperseded(run, id)) return id;
  }
  return null;
}

export function questions(run: RunCore): QuestionItem[] {
  const out: QuestionItem[] = [];
  for (const lid of run.pressed) {
    const q = LINE.get(lid)?.line.press.question;
    if (!q) continue;
    const by = questionResolver(run, q.resolvedBy);
    if (!by) {
      out.push({ id: q.id, text: q.text, resolved: false });
      continue;
    }
    const answer = q.answer ?? BRK.get(by)?.brk.explain ?? EV.get(by)?.summary;
    out.push(answer ? { id: q.id, text: q.text, resolved: true, answer } : { id: q.id, text: q.text, resolved: true });
  }
  return out;
}

export function summaries(run: RunCore): { breakId: Id; tier: 'star' | 'minor'; explain: string }[] {
  return run.broken.map((id) => {
    const b = BRK.get(id)!.brk;
    return { breakId: id, tier: b.tier, explain: b.explain };
  });
}

export interface TimelineItem {
  time: string;
  kind: 'record' | 'claim';
  ref: Id;
  who?: Speaker;
  text: string;
  broken?: boolean;
}

/** 기록(보유 증거 time) + 주장(연 세트의 보이는 줄 claimTime), 시각순. 엇갈림 표시는 하지 않는다(디자인 §5-13) */
export function timeline(run: RunCore): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const e of holdings(run)) if (e.time) items.push({ time: e.time, kind: 'record', ref: e.id, text: e.name });
  for (const sid of run.opened) {
    const s = SET.get(sid);
    if (!s) continue;
    for (const l of s.lines)
      if (l.claimTime && lineVisible(run, l))
        items.push({ time: l.claimTime, kind: 'claim', ref: l.id, who: l.who, text: l.text, broken: lineCleared(run, l) });
  }
  return items.sort((a, b) => a.time.localeCompare(b.time) || (a.kind === b.kind ? 0 : a.kind === 'record' ? -1 : 1));
}

export type OpenedItem =
  | { kind: 'set'; id: Id; cost: 0 | 1; chain: boolean; confront: boolean }
  | { kind: 'location'; id: Id; cost: 0 | 1 }
  | { kind: 'hotspot'; id: Id; location: Id }
  | { kind: 'evidence'; id: Id }
  | { kind: 'upgrade'; from: Id; to: Id }
  | { kind: 'secret'; who: SuspectId; line?: string };

/** 결과 카드 목록 = 돌파 전후 '열린 것'의 차이(디자인 D18). 내부 플래그는 넣지 않는다 */
export function diffOpened(before: RunCore, after: RunCore): OpenedItem[] {
  const sets: OpenedItem[] = [];
  const newBreaks = after.broken.filter((b) => !has(before.broken, b));
  const chained = new Set<Id>();
  for (const b of newBreaks) for (const u of BRK.get(b)?.brk.unlocks ?? []) if ('set' in u && u.chain) chained.add(u.set);
  for (const s of CASE.sets)
    if (!setAvailable(before, s) && setAvailable(after, s))
      sets.push({ kind: 'set', id: s.id, cost: costOf(after, { set: s.id }), chain: chained.has(s.id), confront: s.kind === 'confront' });
  const rank = (x: OpenedItem) => (x.kind === 'set' ? (x.chain ? 0 : x.confront ? 1 : 2) : 3);
  sets.sort((a, b) => rank(a) - rank(b));
  const locs: OpenedItem[] = CASE.locations
    .filter((l) => !locAvailable(before, l) && locAvailable(after, l))
    .map((l) => ({ kind: 'location', id: l.id, cost: costOf(after, { location: l.id }) }));
  const beforeHs = visibleHotspotIds(before);
  const hs: OpenedItem[] = [...visibleHotspotIds(after)]
    .filter((id) => !beforeHs.has(id) && locAvailable(before, HS.get(id)!.location))
    .map((id) => ({ kind: 'hotspot', id, location: HS.get(id)!.location.id }));
  const upgrades: OpenedItem[] = [];
  const evs: OpenedItem[] = [];
  for (const id of after.evidence) {
    if (has(before.evidence, id)) continue;
    const from = EV.get(id)?.upgradeOf;
    if (from && has(before.evidence, from)) upgrades.push({ kind: 'upgrade', from, to: id });
    else evs.push({ kind: 'evidence', id });
  }
  const secrets: OpenedItem[] = after.secrets
    .filter((s) => !has(before.secrets, s))
    .map((who) => ({ kind: 'secret', who, line: PROFILE.get(who)?.secretLine }));
  return [...sets, ...locs, ...hs, ...evs, ...upgrades, ...secrets];
}

/** 화면 시계 'HH:MM' — 23:00 + 쓴 행동 × 10분 */
export function clock(run: RunCore): string {
  const r = rulesOf(run);
  const m = (r.startMinute + (r.actions - run.actions) * r.minutesPerAction) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** 강력팀 도착까지 남은 분 */
export function minutesLeft(run: Pick<RunCore, 'actions' | 'mode'>): number {
  return run.actions * rulesOf(run).minutesPerAction;
}

/** 지금 hub 에 '유료 확인'이 필요한가(시스템 1-4) */
export function needsConfirm(run: RunCore): boolean {
  return run.actions <= rulesOf(run).confirmWhenActionsLeq;
}

// ─────────────────────────────── meta(도감·업적) ───────────────────────────────

export interface Settings {
  speed: 'normal' | 'fast' | 'instant';
  text: 'm' | 'l' | 'xl';
  fx: 'auto' | 'full' | 'short' | 'reduced';
  haptics: boolean;
  leftHand: boolean;
  readFast: boolean;
  hubView: 'map' | 'list';
}

export const DEFAULT_SETTINGS: Settings = {
  speed: 'normal',
  text: 'm',
  fx: 'auto',
  haptics: true,
  leftHand: false,
  readFast: true,
  hubView: 'map',
};

export interface LastEnding {
  ending: EndingId;
  grade: Grade;
  stars: number;
  evidence: number;
  wrong: number;
  hints: number;
  actionsLeft: number;
  playMs: number;
  missed: Id[];
  unbrokenStars: number;
  hiddenTeaser: boolean;
  newAchievements: AchievementId[];
  at: number;
  pendingView: boolean;
}

export interface WitnessMeta {
  v: 1;
  /** 엔딩 도착 횟수(수사 배제 제외) — 2회차 판단 plays ≥ 1 */
  plays: number;
  endings: EndingId[];
  secrets: SuspectId[];
  achievements: AchievementId[];
  bestGrade?: Grade;
  readLines: string[];
  settings: Settings;
  coach: string[];
  lastEnding?: LastEnding;
}

export function newMeta(): WitnessMeta {
  return { v: 1, plays: 0, endings: [], secrets: [], achievements: [], readLines: [], settings: { ...DEFAULT_SETTINGS }, coach: [] };
}

const GRADE_RANK: Record<Grade, number> = { S: 4, A: 3, B: 2, C: 1 };

export function addAchievement(meta: WitnessMeta, id: AchievementId): WitnessMeta {
  return meta.achievements.includes(id) ? meta : { ...meta, achievements: [...meta.achievements, id] };
}

/** 엔딩 도착을 meta 에 반영. 수사 배제는 도감만(되감기 가능하므로 plays·lastEnding 은 그대로) */
export function applyResultToMeta(meta: WitnessMeta, result: RunResult, at = 0): WitnessMeta {
  const endings = meta.endings.includes(result.ending) ? meta.endings : [...meta.endings, result.ending];
  if (result.ending === 'excluded') return { ...meta, endings };
  const newAch = result.achievements.filter((a) => !meta.achievements.includes(a));
  const secrets = [...meta.secrets];
  for (const s of result.secretsRevealed) if (!secrets.includes(s)) secrets.push(s);
  const best = !meta.bestGrade || GRADE_RANK[result.grade] > GRADE_RANK[meta.bestGrade] ? result.grade : meta.bestGrade;
  return {
    ...meta,
    plays: meta.plays + 1,
    endings,
    secrets,
    achievements: [...meta.achievements, ...newAch],
    bestGrade: best,
    lastEnding: {
      ending: result.ending,
      grade: result.grade,
      stars: result.stars,
      evidence: result.evidence,
      wrong: result.wrong,
      hints: result.hints,
      actionsLeft: result.actionsLeft,
      playMs: result.playMs,
      missed: result.missed.map((m) => m.id),
      unbrokenStars: result.unbrokenStars,
      hiddenTeaser: result.hiddenTeaser,
      newAchievements: newAch,
      at,
      pendingView: true,
    },
  };
}

/** 사건 파일(진상 해설) 열림 — 완벽 해결 1회 또는 플레이 3회(시스템 5) */
export function caseFileUnlocked(meta: WitnessMeta): boolean {
  return meta.endings.includes('perfect') || meta.endings.includes('hidden') || meta.plays >= 3;
}

/** 도감 엔딩 칸 8 — 오인 체포는 범인을 뺀 나머지로 런타임에 만든다(디자인 §7-3) */
export function endingSlots(): EndingId[] {
  const wrong = SUSPECTS.filter((s) => s !== CASE.solution.culprit).map((s) => `wrong-${s}` as EndingId);
  return ['perfect', 'hidden', 'short', ...wrong, 'timeout', 'excluded'];
}

/**
 * 도감 화면용 칸 순서 — 오인 체포 칸은 '본 것(본 순서) → 못 본 것'으로 다시 늘어놓는다.
 * 인물 순서(S1→S4)대로 두면 본 칸의 위치로 범인이 소거된다(예: 세 번째 인물의 오인 체포가 마지막 칸이면 네 번째가 범인).
 */
export function collectionSlots(got: readonly EndingId[]): EndingId[] {
  const all = endingSlots();
  const wrong = all.filter((e) => e.startsWith('wrong-'));
  const seenWrong = got.filter((e) => wrong.includes(e));
  const ordered = [...seenWrong, ...wrong.filter((e) => !seenWrong.includes(e))];
  const head = all.filter((e) => !e.startsWith('wrong-') && e !== 'timeout' && e !== 'excluded');
  return [...head, ...ordered, 'timeout', 'excluded'];
}
