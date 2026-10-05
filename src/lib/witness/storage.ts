/**
 * 저장 — localStorage(이 기기에만). 진행 중인 판 `wt:save:v1`, 도감·설정 `wt:meta:v1`.
 *
 *  - 절대 throw 하지 않는다. localStorage 가 막히면 메모리 폴백(persistent=false → UI 1회 띠).
 *  - run 은 읽을 때 구조·값 범위·id 를 전부 검증하고 **화이트리스트 필드만** 복사한다. 하나라도 깨졌으면 키를 지우고 폐기
 *    (디자인 §7-4 "저장 손상 / v 불일치 → run 폐기 + meta 보존"). 모르는 필드는 버린다.
 *  - 없는 선택 필드는 기본값으로 읽는다(phase 'play', final [] …) — v 는 1 유지.
 *  - 규칙 개정(rev 2 = 행동 13 · 사이렌 뒤 재방문): rev 가 없는 옛 저장은 행동 12 규칙으로 진행 중이던 판이다.
 *    진행 중(phase 'play')이면 남은 행동에 +1 을 더해 새 규칙으로 이관한다. 근거 — 새 규칙은 옛 규칙보다 모든 면에서 넉넉하다(행동 +1,
 *    재방문 허용). 쓴 행동 수는 그대로라 시계가 10분 이르게(시작이 23:00 → 22:50) 가리킬 뿐 강력팀 도착 01:00 은 그대로이고
 *    (= 늘어난 행동 1번만큼의 시간이 더 생긴 것), 이미 얻은 증거·돌파·신뢰는 한 칸도 건드리지 않는다. 옛 규칙을 판마다 따로 유지하면 엔진 분기가 영구히 남는다.
 *    이미 사이렌이 울린 판(phase 'siren')과 끝난 판은 행동을 그대로 둔다(사이렌 장면을 두 번 보이지 않으려고).
 *    옛 저장의 accuse.forced 는 읽되 엔진이 무시한다(취소·경고 가능).
 *  - meta 는 관대하게: 깨진 필드만 기본값으로 바꾸고 나머지는 살린다(도감은 소중하다).
 */
import {
  CASE_ID,
  DEFAULT_SETTINGS,
  RULES_REV,
  KNOWN,
  RULES,
  SAVE_V,
  SOUND_LEVELS,
  newMeta,
  rulesOf,
  type AccuseDraft,
  type HintEntry,
  type HintTarget,
  type LastEnding,
  type MissedItem,
  type Mode,
  type Phase,
  type RunCore,
  type RunResult,
  type RunState,
  type Screen,
  type ScreenName,
  type Settings,
  type SoundLevel,
  type WitnessMeta,
} from './engine';
import type { AchievementId, EndingId, Grade, Id, Slot, SuspectId } from './types';

export const STORAGE_KEYS = {
  run: 'wt:save:v1',
  meta: 'wt:meta:v1',
} as const;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
  };
}

export interface OpenedStorage {
  storage: StorageLike;
  /** false = 메모리 폴백(탭을 닫으면 사라짐) */
  persistent: boolean;
}

/** localStorage 를 쓰기 시험까지 해 보고 연다. 실패하면 메모리 */
export function openStorage(): OpenedStorage {
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage;
    if (ls) {
      const probe = 'wt:probe';
      ls.setItem(probe, '1');
      ls.removeItem(probe);
      return { storage: ls, persistent: true };
    }
  } catch {
    /* 시크릿 모드·차단·용량 초과 */
  }
  return { storage: memoryStorage(), persistent: false };
}

function readRaw(s: StorageLike, k: string): string | null {
  try {
    return s.getItem(k);
  } catch {
    return null;
  }
}
function writeRaw(s: StorageLike, k: string, v: string): boolean {
  try {
    s.setItem(k, v);
    return true;
  } catch {
    return false;
  }
}
function removeRaw(s: StorageLike, k: string): void {
  try {
    s.removeItem(k);
  } catch {
    /* 무시 */
  }
}

// ─────────────────────────────── 검증 도우미 ───────────────────────────────

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
const isFinNonNeg = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isStr = (v: unknown): v is string => typeof v === 'string';

/** 전부 domain 안의 문자열이면 중복 제거한 배열, 아니면 null(= 깨짐) */
function idList(v: unknown, domain: Set<string>): string[] | null {
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const x of v) {
    if (!isStr(x) || !domain.has(x)) return null;
    if (!out.includes(x)) out.push(x);
  }
  return out;
}

const SCREENS: readonly ScreenName[] = ['intro', 'rules', 'hub', 'location', 'testimony', 'accuse', 'siren', 'ending'];
const PHASES: readonly Phase[] = ['play', 'siren', 'ended'];
/** 모드 목록은 RULES 에서(형사 모드를 RULES 에 더하면 저장도 자동으로 받아들인다) */
const MODES = Object.keys(RULES) as Mode[];
const GRADES: readonly Grade[] = ['S', 'A', 'B', 'C'];
const SLOT_KEYS: readonly Slot[] = ['means', 'opportunity', 'motive'];
const ACHIEVEMENTS: readonly AchievementId[] = ['flawless', 'lightning', 'nohint', 'allclear', 'arrestSpeaker', 'trustedMachine'];
const ENDING_RE = /^(perfect|hidden|short|timeout|excluded|wrong-S[1-4])$/;
const isEnding = (v: unknown): v is EndingId => isStr(v) && ENDING_RE.test(v);
const VISITABLE = new Set([...KNOWN.locations, ...KNOWN.hotspots]);
const FREEPASS = new Set([...KNOWN.sets, ...KNOWN.locations, ...KNOWN.hotspots]);
const REFS = new Set([...KNOWN.sets, ...KNOWN.locations]);

function parseScreen(v: unknown): Screen | null {
  if (!isObj(v) || !SCREENS.includes(v.name as ScreenName)) return null;
  const s: Screen = { name: v.name as ScreenName };
  if (v.ref !== undefined) {
    if (!isStr(v.ref) || !REFS.has(v.ref)) return null;
    // 화면 종류와 ref 종류가 어긋나면(심문 화면 + 장소 id 등) 렌더가 죽는다 → 손상으로 본다
    if (s.name === 'location' && !KNOWN.locations.has(v.ref)) return null;
    if (s.name === 'testimony' && !KNOWN.sets.has(v.ref)) return null;
    s.ref = v.ref;
  }
  if (v.tab !== undefined) {
    if (!['house', 'people', 'notebook'].includes(v.tab as string)) return null;
    s.tab = v.tab as Screen['tab'];
  }
  if (v.line !== undefined) {
    if (!isInt(v.line, 0, 5)) return null;
    s.line = v.line;
  }
  if (v.replay !== undefined) {
    if (!isStr(v.replay) || !KNOWN.breaks.has(v.replay)) return null;
    s.replay = v.replay;
  }
  return s;
}

function parseAccuse(v: unknown): AccuseDraft | null | undefined {
  if (v === undefined) return undefined;
  if (!isObj(v) || !['suspect', 'slots', 'confirm'].includes(v.stage as string)) return null;
  const a: AccuseDraft = { stage: v.stage as AccuseDraft['stage'] };
  if (v.culprit !== undefined) {
    if (!isStr(v.culprit) || !KNOWN.suspects.has(v.culprit)) return null;
    a.culprit = v.culprit as SuspectId;
  }
  for (const k of SLOT_KEYS) {
    const c = v[k];
    if (c === undefined) continue;
    if (!isStr(c) || !KNOWN.evidence.has(c)) return null;
    a[k] = c;
  }
  if (v.forced !== undefined) {
    if (typeof v.forced !== 'boolean') return null;
    a.forced = v.forced;
  }
  return a;
}

function parseHintTarget(v: unknown): HintTarget | null | undefined {
  if (v === undefined) return undefined;
  if (!isObj(v)) return null;
  if (v.kind === 'accuse') return { kind: 'accuse' };
  if (v.kind === 'set' && isStr(v.id) && KNOWN.sets.has(v.id)) return { kind: 'set', id: v.id };
  if (v.kind === 'location' && isStr(v.id) && KNOWN.locations.has(v.id)) return { kind: 'location', id: v.id };
  return null;
}

function parseHintLog(v: unknown, max: number): HintEntry[] | null | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.length > max) return null;
  const out: HintEntry[] = [];
  for (const e of v) {
    if (!isObj(e) || !Array.isArray(e.text) || !e.text.every(isStr) || e.text.length > 4) return null;
    const target = parseHintTarget(e.target);
    if (target === null) return null;
    out.push(target ? { text: [...e.text], target } : { text: [...e.text] });
  }
  return out;
}

function parseMissed(v: unknown): MissedItem[] | null {
  if (!Array.isArray(v)) return null;
  const out: MissedItem[] = [];
  for (const m of v) {
    if (!isObj(m) || !isStr(m.id) || !KNOWN.evidence.has(m.id) || !isStr(m.missHint)) return null;
    out.push(m.upgrade === true ? { id: m.id, missHint: m.missHint, upgrade: true } : { id: m.id, missHint: m.missHint });
  }
  return out;
}

function parseResult(v: unknown): RunResult | null | undefined {
  if (v === undefined) return undefined;
  if (!isObj(v) || !isEnding(v.ending) || !GRADES.includes(v.grade as Grade) || !isStr(v.title)) return null;
  const nums = ['stars', 'starTotal', 'evidence', 'evidenceTotal', 'wrong', 'hints', 'actionsLeft', 'unbrokenStars'] as const;
  for (const k of nums) if (!isInt(v[k], 0, 999)) return null;
  if (!isFinNonNeg(v.playMs) || typeof v.hiddenTeaser !== 'boolean') return null;
  const missed = parseMissed(v.missed);
  const ach = Array.isArray(v.achievements) && v.achievements.every((a) => ACHIEVEMENTS.includes(a as AchievementId));
  const sec = idList(v.secretsRevealed, KNOWN.suspects);
  if (!missed || !ach || !sec) return null;
  const r: RunResult = {
    ending: v.ending,
    grade: v.grade as Grade,
    title: v.title,
    stars: v.stars as number,
    starTotal: v.starTotal as number,
    evidence: v.evidence as number,
    evidenceTotal: v.evidenceTotal as number,
    wrong: v.wrong as number,
    hints: v.hints as number,
    actionsLeft: v.actionsLeft as number,
    playMs: v.playMs,
    missed,
    unbrokenStars: v.unbrokenStars as number,
    hiddenTeaser: v.hiddenTeaser,
    achievements: [...(v.achievements as AchievementId[])],
    secretsRevealed: sec as SuspectId[],
  };
  if (v.accusation !== undefined) {
    const a = v.accusation;
    if (!isObj(a) || !isStr(a.culprit) || !KNOWN.suspects.has(a.culprit)) return null;
    if (!SLOT_KEYS.every((k) => isStr(a[k]) && KNOWN.evidence.has(a[k] as string))) return null;
    r.accusation = { culprit: a.culprit as SuspectId, means: a.means as Id, opportunity: a.opportunity as Id, motive: a.motive as Id };
  }
  if (v.slots !== undefined) {
    const s = v.slots;
    if (!isObj(s) || !SLOT_KEYS.every((k) => typeof s[k] === 'boolean')) return null;
    r.slots = { means: s.means as boolean, opportunity: s.opportunity as boolean, motive: s.motive as boolean };
  }
  return r;
}

/** RunCore 한 벌 검증(체크포인트에도 같은 규칙). 깨졌으면 null */
function parseCore(v: unknown): RunCore | null {
  if (!isObj(v)) return null;
  if (v.v !== SAVE_V || v.caseId !== CASE_ID) return null;
  const mode = v.mode === undefined ? 'normal' : v.mode;
  if (!MODES.includes(mode as Mode)) return null;
  const rules = rulesOf({ mode: mode as Mode });
  if (v.rev !== undefined && v.rev !== RULES_REV) return null;
  if (!isInt(v.actions, 0, rules.actions) || !isInt(v.trust, 0, rules.trustMax)) return null;
  if (!isInt(v.wrong, 0, 9999) || !isInt(v.hints, 0, rules.hintsMax) || typeof v.rewound !== 'boolean') return null;
  const visited = idList(v.visited, VISITABLE);
  const opened = idList(v.opened, KNOWN.sets);
  const freePass = v.freePass === undefined ? [] : idList(v.freePass, FREEPASS);
  const evidence = idList(v.evidence, KNOWN.evidence);
  const broken = idList(v.broken, KNOWN.breaks);
  const pressed = idList(v.pressed, KNOWN.lines);
  const revealed = idList(v.revealed, KNOWN.hiddenLines);
  const flags = idList(v.flags, KNOWN.flags);
  const secrets = idList(v.secrets, KNOWN.suspects);
  if (!visited || !opened || !freePass || !evidence || !broken || !pressed || !revealed || !flags || !secrets) return null;
  const screen = parseScreen(v.screen);
  if (!screen || !isFinNonNeg(v.startedAt) || !isFinNonNeg(v.playMs)) return null;
  const phase = v.phase === undefined ? 'play' : v.phase;
  if (!PHASES.includes(phase as Phase)) return null;
  const final = v.final === undefined ? [] : idList(v.final, REFS);
  if (!final) return null;
  const accuse = parseAccuse(v.accuse);
  const hintLog = parseHintLog(v.hintLog, rules.hintsMax);
  const result = parseResult(v.result);
  if (accuse === null || hintLog === null || result === null) return null;
  const seen = v.seen === undefined ? undefined : Array.isArray(v.seen) && v.seen.every(isStr) ? [...new Set(v.seen as string[])].slice(0, 200) : null;
  if (seen === null) return null;
  if (v.egg !== undefined && typeof v.egg !== 'boolean') return null;
  if (phase === 'ended' && !result) return null;
  // 옛 규칙(행동 12) 저장 이관 — 진행 중인 판만 행동 +1(상한 = 새 예산). 옛 규칙의 '마지막 행동 중' 표시(final)는 더 쓸 일이 없다
  const legacyPlay = v.rev === undefined && phase === 'play';
  const actions = legacyPlay ? Math.min(rules.actions, v.actions + 1) : v.actions;
  const core: RunCore = {
    v: SAVE_V,
    caseId: CASE_ID,
    mode: mode as Mode,
    rev: RULES_REV,
    actions,
    trust: v.trust,
    wrong: v.wrong,
    hints: v.hints,
    rewound: v.rewound,
    visited,
    opened,
    freePass,
    evidence,
    broken,
    pressed,
    revealed,
    flags,
    secrets: secrets as SuspectId[],
    screen,
    startedAt: v.startedAt,
    playMs: v.playMs,
    phase: phase as Phase,
    final: legacyPlay && v.actions === 0 ? [] : final,
  };
  if (accuse) core.accuse = accuse;
  if (hintLog) core.hintLog = hintLog;
  if (seen) core.seen = seen;
  if (v.egg === true) core.egg = true;
  if (result) core.result = result;
  return core;
}

/** 저장 문자열 → RunState(검증 통과분만). 깨졌으면 null */
export function parseRun(raw: string | null): RunState | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  const core = parseCore(v);
  if (!core) return null;
  const run: RunState = { ...core };
  const cp = (v as Obj).checkpoint;
  if (cp !== undefined) {
    if (isObj(cp) && cp.checkpoint !== undefined) return null;
    const c = parseCore(cp);
    if (!c) return null;
    run.checkpoint = c;
  }
  return run;
}

export type LoadStatus = 'empty' | 'ok' | 'corrupt' | 'version';

export interface LoadedRun {
  status: LoadStatus;
  run: RunState | null;
}

/** 진행 중인 판 읽기. 깨졌거나 v 가 다르면 키를 지우고 null(meta 는 건드리지 않는다) */
export function loadRun(storage: StorageLike): LoadedRun {
  const raw = readRaw(storage, STORAGE_KEYS.run);
  if (!raw) return { status: 'empty', run: null };
  const run = parseRun(raw);
  if (run) return { status: 'ok', run };
  let status: LoadStatus = 'corrupt';
  try {
    const o = JSON.parse(raw) as Obj;
    if (isObj(o) && (o.v !== SAVE_V || o.caseId !== CASE_ID)) status = 'version';
  } catch {
    /* corrupt */
  }
  removeRaw(storage, STORAGE_KEYS.run);
  return { status, run: null };
}

export function saveRun(storage: StorageLike, run: RunState): boolean {
  let s: string;
  try {
    s = JSON.stringify(run);
  } catch {
    return false;
  }
  return writeRaw(storage, STORAGE_KEYS.run, s);
}

export function clearRun(storage: StorageLike): void {
  removeRaw(storage, STORAGE_KEYS.run);
}

// ─────────────────────────────── meta ───────────────────────────────

function parseSettings(v: unknown): Settings {
  const s = { ...DEFAULT_SETTINGS };
  if (!isObj(v)) return s;
  if (['normal', 'fast', 'instant'].includes(v.speed as string)) s.speed = v.speed as Settings['speed'];
  if (['m', 'l', 'xl'].includes(v.text as string)) s.text = v.text as Settings['text'];
  if (['auto', 'full', 'short', 'reduced'].includes(v.fx as string)) s.fx = v.fx as Settings['fx'];
  if (typeof v.haptics === 'boolean') s.haptics = v.haptics;
  if (typeof v.leftHand === 'boolean') s.leftHand = v.leftHand;
  if (typeof v.readFast === 'boolean') s.readFast = v.readFast;
  if (['map', 'list'].includes(v.hubView as string)) s.hubView = v.hubView as Settings['hubView'];
  // 소리(나중에 더한 필드) — 옛 저장에는 없으므로 없거나 깨졌으면 기본값(보통·보통·켬)
  if (SOUND_LEVELS.includes(v.bgm as SoundLevel)) s.bgm = v.bgm as SoundLevel;
  if (SOUND_LEVELS.includes(v.sfx as SoundLevel)) s.sfx = v.sfx as SoundLevel;
  if (typeof v.muted === 'boolean') s.muted = v.muted;
  return s;
}

function parseLastEnding(v: unknown): LastEnding | undefined {
  if (!isObj(v) || !isEnding(v.ending) || !GRADES.includes(v.grade as Grade)) return undefined;
  const nums = ['stars', 'evidence', 'wrong', 'hints', 'actionsLeft', 'unbrokenStars'] as const;
  if (!nums.every((k) => isInt(v[k], 0, 999)) || !isFinNonNeg(v.playMs) || !isFinNonNeg(v.at)) return undefined;
  const missed = idList(v.missed, KNOWN.evidence);
  if (!missed || typeof v.hiddenTeaser !== 'boolean' || typeof v.pendingView !== 'boolean') return undefined;
  if (!Array.isArray(v.newAchievements) || !v.newAchievements.every((a) => ACHIEVEMENTS.includes(a as AchievementId))) return undefined;
  return {
    ending: v.ending,
    grade: v.grade as Grade,
    stars: v.stars as number,
    evidence: v.evidence as number,
    wrong: v.wrong as number,
    hints: v.hints as number,
    actionsLeft: v.actionsLeft as number,
    playMs: v.playMs,
    missed,
    unbrokenStars: v.unbrokenStars as number,
    hiddenTeaser: v.hiddenTeaser,
    newAchievements: [...(v.newAchievements as AchievementId[])],
    at: v.at,
    pendingView: v.pendingView,
  };
}

/** meta 문자열 → WitnessMeta. 필드 단위로 관대하게(깨진 필드만 기본값) */
export function parseMeta(raw: string | null): WitnessMeta {
  const m = newMeta();
  if (!raw) return m;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return m;
  }
  if (!isObj(v) || v.v !== 1) return m;
  if (isInt(v.plays, 0, 1e6)) m.plays = v.plays;
  if (Array.isArray(v.endings)) m.endings = [...new Set(v.endings.filter(isEnding))];
  const sec = Array.isArray(v.secrets) ? v.secrets.filter((s): s is SuspectId => isStr(s) && KNOWN.suspects.has(s)) : [];
  m.secrets = [...new Set(sec)];
  if (Array.isArray(v.achievements)) m.achievements = [...new Set(v.achievements.filter((a): a is AchievementId => ACHIEVEMENTS.includes(a as AchievementId)))];
  if (GRADES.includes(v.bestGrade as Grade)) m.bestGrade = v.bestGrade as Grade;
  if (Array.isArray(v.readLines)) m.readLines = [...new Set(v.readLines.filter(isStr))].slice(0, 5000);
  m.settings = parseSettings(v.settings);
  if (Array.isArray(v.coach)) m.coach = [...new Set(v.coach.filter(isStr))].slice(0, 100);
  const le = parseLastEnding(v.lastEnding);
  if (le) m.lastEnding = le;
  return m;
}

export function loadMeta(storage: StorageLike): WitnessMeta {
  return parseMeta(readRaw(storage, STORAGE_KEYS.meta));
}

export function saveMeta(storage: StorageLike, meta: WitnessMeta): boolean {
  try {
    return writeRaw(storage, STORAGE_KEYS.meta, JSON.stringify(meta));
  } catch {
    return false;
  }
}
