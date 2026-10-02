/**
 * 저장 — 활성 게임 1개 = 1키 `gu:game:v1`, 기기 설정 `gu:prefs:v1`. (디자인 스펙 §6, D19)
 *
 *  - 절대 throw 하지 않는다. localStorage 가 막히면 메모리 폴백(persistent=false → UI 가 1회 배너).
 *  - 읽을 때 구조를 전부 검증하고 **화이트리스트 필드만** 복사한다 → 깨진 저장은 폐기(키 삭제),
 *    모르는 필드(사건 본문 등)는 저장에도 복원에도 실리지 않는다.
 *  - 12시간 무활동(updatedAt) → 자동 이어하기 하지 않고 삭제.
 *  - caseVersion 이 현재 번들과 다르면 복원은 하되 versionMismatch 플래그(배너 "사건 내용이 갱신됐어요").
 *  - 봉인 열림 여부·사건 본문은 저장하지 않는다(스키마에 자리가 없다).
 */
import {
  HISTORY_LIMIT,
  SAVE_VERSION,
  isPhase,
  type Disclosure,
  type GameState,
  type HostCore,
  type HostSnapshot,
  type HostState,
  type RoundPick,
  type TimerState,
  type VoteState,
} from './game';
import { parseRoomCode, type EntryParams, type RoomCode } from './room';
import type { RoundNo } from './types';

export const STORAGE_KEYS = {
  game: 'gu:game:v1',
  prefs: 'gu:prefs:v1',
} as const;

export const GAME_TTL_MS = 12 * 60 * 60 * 1000;

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
  /** false = 메모리 폴백(새로고침하면 사라짐) — UI 1회 배너 */
  persistent: boolean;
}

/** window.localStorage 를 쓰기 시험까지 해 보고 연다. 실패하면 메모리. */
export function openStorage(): OpenedStorage {
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage;
    if (ls) {
      const probe = 'gu:probe';
      ls.setItem(probe, '1');
      ls.removeItem(probe);
      return { storage: ls, persistent: true };
    }
  } catch {
    /* 시크릿 모드·차단·용량 초과 */
  }
  return { storage: memoryStorage(), persistent: false };
}

function readRaw(storage: StorageLike, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(storage: StorageLike, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeRaw(storage: StorageLike, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    /* 무시 */
  }
}

// ─────────────────────────────── 검증 헬퍼 ───────────────────────────────

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isFin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown): v is number => Number.isInteger(v);
const isSeat = (v: unknown, n: number): v is number => isInt(v) && (v as number) >= 1 && (v as number) <= n;
const seatList = (v: unknown, n: number): number[] | null =>
  Array.isArray(v) && v.every((x) => isSeat(x, n)) ? Array.from(new Set(v as number[])).sort((a, b) => a - b) : null;
const DISCLOSURES: readonly Disclosure[] = ['undecided', 'public', 'private'];
const ROUND_KEYS = ['1', '2', '3'] as const;

/** 좌석→좌석 맵({ "2": 3 }) */
function seatMap(v: unknown, n: number): Record<number, number> | null {
  if (!isObj(v)) return null;
  const out: Record<number, number> = {};
  for (const [k, t] of Object.entries(v)) {
    const voter = Number(k);
    if (!isSeat(voter, n) || !isSeat(t, n)) return null;
    out[voter] = t;
  }
  return out;
}

function parseTimer(v: unknown): TimerState | null | undefined {
  if (v === null) return null;
  if (!isObj(v)) return undefined;
  if (v.kind !== 'select' && v.kind !== 'discuss' && v.kind !== 'defense' && v.kind !== 'cards' && v.kind !== 'tie') return undefined;
  if (!isFin(v.totalMs) || v.totalMs < 0 || typeof v.running !== 'boolean' || !isFin(v.remainingMs)) return undefined;
  if (v.running ? !isFin(v.endsAt) : v.endsAt !== null) return undefined;
  return { kind: v.kind, totalMs: v.totalMs, running: v.running, endsAt: v.running ? (v.endsAt as number) : null, remainingMs: v.remainingMs };
}

function parseVote(v: unknown, n: number): VoteState | null | undefined {
  if (v === null) return null;
  if (!isObj(v)) return undefined;
  if (!['ready', 'input', 'tally', 'revote', 'final'].includes(v.sub as string)) return undefined;
  const first = seatMap(v.first, n);
  if (!first) return undefined;
  const out: VoteState = { sub: v.sub as VoteState['sub'], first };
  if (v.revote !== undefined) {
    if (!isObj(v.revote)) return undefined;
    const candidates = seatList(v.revote.candidates, n);
    const ballots = seatMap(v.revote.ballots, n);
    if (!candidates || !ballots) return undefined;
    out.revote = { candidates, ballots };
  }
  if ((out.sub === 'revote' || out.sub === 'final') && !out.revote) return undefined;
  if (v.bonus !== undefined) {
    if (!isObj(v.bonus)) return undefined;
    const bonus: Record<number, Record<string, number>> = {};
    for (const [k, answers] of Object.entries(v.bonus)) {
      if (!isSeat(Number(k), n) || !isObj(answers)) return undefined;
      const a: Record<string, number> = {};
      for (const [q, opt] of Object.entries(answers)) {
        if (!isInt(opt) || opt < 0) return undefined;
        a[q] = opt;
      }
      bonus[Number(k)] = a;
    }
    out.bonus = bonus;
  }
  return out;
}

function parseHostCore(v: unknown, n: number): HostCore | null {
  if (!isObj(v)) return null;
  const rollCall = seatList(v.rollCall, n);
  const absentSeats = seatList(v.absentSeats, n);
  if (!rollCall || !absentSeats || !isSeat(v.introCurrent, n)) return null;
  if (v.roundSub !== null && v.roundSub !== 'select' && v.roundSub !== 'discuss') return null;
  if (!isObj(v.publicClueOpened)) return null;
  const publicClueOpened: Partial<Record<RoundNo, boolean>> = {};
  for (const [k, b] of Object.entries(v.publicClueOpened)) {
    if (!(ROUND_KEYS as readonly string[]).includes(k) || typeof b !== 'boolean') return null;
    publicClueOpened[Number(k) as RoundNo] = b;
  }
  const timer = parseTimer(v.timer);
  if (timer === undefined) return null;
  let defense: HostCore['defense'] = null;
  if (v.defense !== null) {
    if (!isObj(v.defense)) return null;
    const order = Array.isArray(v.defense.order) && v.defense.order.every((x) => isSeat(x, n)) ? (v.defense.order as number[]) : null;
    if (!order || !isInt(v.defense.index) || v.defense.index < 0 || v.defense.index > Math.max(0, order.length - 1)) return null;
    defense = { order: order.slice(), index: v.defense.index };
  }
  const vote = parseVote(v.vote, n);
  if (vote === undefined) return null;
  if (!isObj(v.missions)) return null;
  const missions: HostCore['missions'] = {};
  for (const [k, m] of Object.entries(v.missions)) {
    if (!isSeat(Number(k), n) || !isObj(m)) return null;
    const row: Record<string, boolean | null> = {};
    for (const [id, val] of Object.entries(m)) {
      if (val !== null && typeof val !== 'boolean') return null;
      row[id] = val;
    }
    missions[Number(k)] = row;
  }
  if (!isInt(v.revealIndex) || v.revealIndex < 0) return null;
  if (v.startedAt !== undefined && !isFin(v.startedAt)) return null;
  if (v.endedAt !== undefined && !isFin(v.endedAt)) return null;
  const core: HostCore = {
    rollCall: rollCall.includes(1) ? rollCall : [1, ...rollCall],
    introCurrent: v.introCurrent as number,
    roundSub: v.roundSub as HostCore['roundSub'],
    publicClueOpened,
    timer,
    defense,
    vote,
    absentSeats,
    missions,
    revealIndex: v.revealIndex,
  };
  if (v.startedAt !== undefined) core.startedAt = v.startedAt as number;
  if (v.endedAt !== undefined) core.endedAt = v.endedAt as number;
  return core;
}

/**
 * 단계 ↔ 하위 상태 정합성(QA BUG-19) — 구조는 맞지만 짝이 안 맞는 저장(지목 단계인데 vote 가 null)을
 * 그 단계의 시작 상태로 메운다. 화면은 지목 단계에서 vote 를 전제로 그리므로 그대로 두면 렌더 예외 → 에러 화면.
 */
function alignHostCore<T extends HostCore>(phase: string, core: T): T {
  if (phase === 'vote' && !core.vote) return { ...core, vote: { sub: 'ready', first: {} } };
  return core;
}

function parseHost(v: unknown, n: number, phase: string): HostState | null {
  const core = parseHostCore(v, n);
  if (!core || !isObj(v) || !Array.isArray(v.history)) return null;
  // 되돌리기 스택은 부가 정보 — 깨진 스냅샷은 그것만 버린다
  const history: HostSnapshot[] = [];
  for (const snap of v.history.slice(-HISTORY_LIMIT)) {
    if (!isObj(snap) || !isPhase(snap.phase)) continue;
    const h = parseHostCore(snap.host, n);
    if (h) history.push({ phase: snap.phase, host: alignHostCore(snap.phase, h) });
  }
  return { ...alignHostCore(phase, core), history };
}

function parsePick(v: unknown): RoundPick | null {
  if (!isObj(v)) return null;
  if (typeof v.placeId !== 'string' || !v.placeId || v.placeId.length > 64) return null;
  if (!isFin(v.pickedAt) || typeof v.opened !== 'boolean' || !DISCLOSURES.includes(v.disclosure as Disclosure)) return null;
  const out: RoundPick = { placeId: v.placeId, pickedAt: v.pickedAt, opened: v.opened, disclosure: v.disclosure as Disclosure };
  if (v.disclosedAt !== undefined) {
    if (!isFin(v.disclosedAt)) return null;
    out.disclosedAt = v.disclosedAt;
  }
  if (v.disclosedFrom !== undefined) {
    if (!DISCLOSURES.includes(v.disclosedFrom as Disclosure)) return null;
    out.disclosedFrom = v.disclosedFrom as Disclosure;
  }
  return out;
}

/** 저장 원본 → 검증된 GameState(화이트리스트 복사). 하나라도 깨졌으면 null. */
export function sanitizeGame(raw: unknown): GameState | null {
  if (!isObj(raw) || raw.v !== SAVE_VERSION) return null;
  const room = typeof raw.code === 'string' ? parseRoomCode(raw.code) : null;
  if (!room || room.code !== raw.code) return null;
  const n = room.n;
  if (typeof raw.caseId !== 'string' || !raw.caseId || raw.caseId.length > 64) return null;
  if (!isInt(raw.caseVersion) || raw.caseVersion < 0) return null;
  if (raw.role !== 'host' && raw.role !== 'player') return null;
  if (!isSeat(raw.seat, n)) return null;
  if (raw.role === 'host' ? raw.seat !== 1 : raw.seat === 1) return null;
  if (!isPhase(raw.phase) || !isFin(raw.createdAt) || !isFin(raw.updatedAt)) return null;
  if (!isObj(raw.rounds)) return null;
  const rounds: GameState['rounds'] = {};
  for (const [k, p] of Object.entries(raw.rounds)) {
    if (!(ROUND_KEYS as readonly string[]).includes(k)) return null;
    const pick = parsePick(p);
    if (!pick) return null;
    rounds[Number(k) as RoundNo] = pick;
  }
  const s: GameState = {
    v: SAVE_VERSION,
    code: room.code,
    caseId: raw.caseId,
    caseVersion: raw.caseVersion,
    role: raw.role,
    seat: raw.seat as number,
    phase: raw.phase,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    rounds,
  };
  if (raw.myVote !== undefined) {
    const mv = raw.myVote;
    if (!isObj(mv) || !isSeat(mv.seat, n) || mv.seat === s.seat || !isFin(mv.at)) return null;
    s.myVote = { seat: mv.seat as number, at: mv.at };
  }
  if (raw.role === 'host') {
    const host = parseHost(raw.host, n, raw.phase);
    if (!host) return null;
    s.host = host;
  }
  return s;
}

/** sanitize 를 한 번 거쳐 모르는 필드가 섞여 들어가지 않게 한다. 상태가 깨졌으면 null(저장 안 함). */
export function serializeGame(s: GameState): string | null {
  const clean = sanitizeGame(JSON.parse(JSON.stringify(s)));
  return clean ? JSON.stringify(clean) : null;
}

export type LoadStatus = 'none' | 'ok' | 'expired' | 'invalid';

export interface LoadResult {
  status: LoadStatus;
  state: GameState | null;
  /** 저장 당시 사건 버전 ≠ 지금 번들 → 배너 "사건 내용이 갱신됐어요. 새 방을 권해요" */
  versionMismatch: boolean;
}

/**
 * 읽기 — 깨졌거나(invalid) 12시간 넘었으면(expired) 키를 지우고 state=null.
 * expected 를 주면 caseId 가 다른 저장은 invalid, caseVersion 이 다르면 versionMismatch.
 */
export function loadGame(storage: StorageLike, now: number, expected?: { caseId: string; caseVersion: number }): LoadResult {
  const raw = readRaw(storage, STORAGE_KEYS.game);
  if (raw === null) return { status: 'none', state: null, versionMismatch: false };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const s = sanitizeGame(parsed);
  if (!s || (expected && s.caseId !== expected.caseId)) {
    removeRaw(storage, STORAGE_KEYS.game);
    return { status: 'invalid', state: null, versionMismatch: false };
  }
  if (now - s.updatedAt > GAME_TTL_MS) {
    removeRaw(storage, STORAGE_KEYS.game);
    return { status: 'expired', state: null, versionMismatch: false };
  }
  return { status: 'ok', state: s, versionMismatch: Boolean(expected && s.caseVersion !== expected.caseVersion) };
}

/** 쓰기 — 실패해도 throw 하지 않고 false */
export function saveGame(storage: StorageLike, s: GameState): boolean {
  let json: string | null;
  try {
    json = serializeGame(s);
  } catch {
    return false;
  }
  return json !== null && writeRaw(storage, STORAGE_KEYS.game, json);
}

export function clearGame(storage: StorageLike): void {
  removeRaw(storage, STORAGE_KEYS.game);
}

// ─────────────────────────────── 설정 ───────────────────────────────

export interface GungPrefs {
  v: 1;
  /** 꾹 누르기 / 탭 15초 */
  revealMode: 'hold' | 'tap';
  /** 방장 소리(기본 true) */
  sound: boolean;
  stageScale: 1 | 1.2;
  /** O10 꾹 누르기 코치마크 봤음 */
  seenPeekTip: boolean;
  seenRules: boolean;
}

export const DEFAULT_PREFS: GungPrefs = {
  v: 1,
  revealMode: 'hold',
  sound: true,
  stageScale: 1,
  seenPeekTip: false,
  seenRules: false,
};

/** 설정은 관대하게 — 틀린 필드만 기본값으로 */
export function parsePrefs(raw: unknown): GungPrefs {
  const o = isObj(raw) ? raw : {};
  return {
    v: 1,
    revealMode: o.revealMode === 'tap' ? 'tap' : 'hold',
    sound: typeof o.sound === 'boolean' ? o.sound : DEFAULT_PREFS.sound,
    stageScale: o.stageScale === 1.2 ? 1.2 : 1,
    seenPeekTip: o.seenPeekTip === true,
    seenRules: o.seenRules === true,
  };
}

export function loadPrefs(storage: StorageLike): GungPrefs {
  const raw = readRaw(storage, STORAGE_KEYS.prefs);
  if (raw === null) return { ...DEFAULT_PREFS };
  try {
    return parsePrefs(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(storage: StorageLike, prefs: GungPrefs): boolean {
  return writeRaw(storage, STORAGE_KEYS.prefs, JSON.stringify(parsePrefs(prefs)));
}

// ─────────────────────────────── 진입 판정 ───────────────────────────────

export type EntryDecision =
  /** URL 코드 없음 → S1 홈(resume 가 있으면 '이어하기' 카드) */
  | { kind: 'home'; resume: GameState | null }
  /** URL 코드 = 저장 코드 → 자동 복원 */
  | { kind: 'resume'; state: GameState }
  /** 다른 코드 링크 + 진행 중 게임 → O9 이어하기/새 사건으로 입장 */
  | { kind: 'conflict'; saved: GameState; room: RoomCode; asHost: boolean }
  /** 저장 없음 + 코드 → S5 초대 랜딩 */
  | { kind: 'join'; room: RoomCode }
  /** 저장 없음 + ?as=host → 자리 1 방장 모드 생성 */
  | { kind: 'hostRecover'; room: RoomCode }
  /** 코드 형식 오류 → S4 오류 표시 */
  | { kind: 'badCode'; resume: GameState | null };

/** §6-3 #6 — saved 는 loadGame 결과(만료·깨짐 처리 끝난 것) */
export function decideEntry(saved: GameState | null, params: EntryParams): EntryDecision {
  if (params.invalidCode) return { kind: 'badCode', resume: saved };
  const room = params.room;
  if (!room) return { kind: 'home', resume: saved };
  if (saved) {
    return saved.code === room.code ? { kind: 'resume', state: saved } : { kind: 'conflict', saved, room, asHost: params.asHost };
  }
  return params.asHost ? { kind: 'hostRecover', room } : { kind: 'join', room };
}
