/**
 * 개인 추리 수첩(개선 묶음 1 · R4) — 순수 파서·직렬화·저장. React 비의존.
 *
 * 수첩은 **정리 도구**까지다(PM: "추리 보조는 정리 도구까지"). 이 모듈은 사람이 탭한 표시와 적은 글만 담는다 —
 *  - 자동 추론 없음: 카드 열람·단계 진행·공개 여부 어느 것도 칸에 닿지 않는다(이 모듈엔 게임 상태를 받는 함수가 없다).
 *  - 합계·순위·'의심 1위' 같은 계산 없음.
 *  - 보너스 문항(독의 그릇·노린 사람) 관련 칸·보기 없음 — 보기 자체가 반전을 가리킨다.
 *
 * 저장 규약은 storage.ts 와 같다: 키 1개(`gu:note:v1`) · try/catch · 메모리 폴백은 호출부(StorageLike) · 화이트리스트 복사 ·
 * 12시간 TTL. 읽을 때 code·seat 가 지금 게임과 다르면 폐기한다(자리 바꾸기·새 방). 게임 저장(`gu:game:v1`)과 섞지 않는다.
 * 결과 공유·OG·초대 링크 어디에도 들어가지 않는다(share.ts 는 이 모듈을 import 하지 않는다).
 */
import { parseRoomCode } from './room';
import { STORAGE_KEYS, type StorageLike } from './storage';

export const NOTE_VERSION = 1 as const;
export const NOTE_KEY = STORAGE_KEYS.note;
export const NOTE_TTL_MS = 12 * 60 * 60 * 1000;
/** 행마다 한 줄 메모 */
export const NOTE_LINE_MAX = 40;
/** 표 아래 자유 메모 */
export const NOTE_FREE_MAX = 300;

export type NoteMark = 'o' | 'x';
export const NOTE_COLS = ['means', 'opp', 'motive'] as const;
export type NoteCol = (typeof NOTE_COLS)[number];

export interface GungNote {
  v: typeof NOTE_VERSION;
  code: string;
  seat: number;
  updatedAt: number;
  /** 자리 → 열 → 표시. 빈칸은 키 자체가 없다 */
  marks: Record<number, Partial<Record<NoteCol, NoteMark>>>;
  lines: Record<number, string>;
  free: string;
}

export function emptyNote(code: string, seat: number, now: number): GungNote {
  return { v: NOTE_VERSION, code, seat, updatedAt: now, marks: {}, lines: {}, free: '' };
}

/** 수첩 행 — 이 판의 착석 자리 중 내 자리를 뺀 모두(NPC 행 없음) */
export function noteRows(n: number, mySeat: number): number[] {
  const out: number[] = [];
  for (let s = 1; s <= n; s++) if (s !== mySeat) out.push(s);
  return out;
}

/** 칸 탭 순환: 빈칸 → ○ → ✕ → 빈칸 */
export function nextMark(cur: NoteMark | undefined): NoteMark | undefined {
  return cur === undefined ? 'o' : cur === 'o' ? 'x' : undefined;
}

/** 글자 수 자르기 — 코드 포인트 단위(이모지 반쪽이 남지 않게) */
export function clampText(v: string, max: number): string {
  const chars = Array.from(v);
  return chars.length > max ? chars.slice(0, max).join('') : v;
}

export function cycleMark(note: GungNote, seat: number, col: NoteCol, now: number): GungNote {
  const row = { ...(note.marks[seat] ?? {}) };
  const next = nextMark(row[col]);
  if (next === undefined) delete row[col];
  else row[col] = next;
  const marks = { ...note.marks };
  if (Object.keys(row).length) marks[seat] = row;
  else delete marks[seat];
  return { ...note, marks, updatedAt: now };
}

export function setLine(note: GungNote, seat: number, text: string, now: number): GungNote {
  const lines = { ...note.lines };
  const v = clampText(text, NOTE_LINE_MAX);
  if (v) lines[seat] = v;
  else delete lines[seat];
  return { ...note, lines, updatedAt: now };
}

export function setFree(note: GungNote, text: string, now: number): GungNote {
  return { ...note, free: clampText(text, NOTE_FREE_MAX), updatedAt: now };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** 저장 원본 → 검증된 수첩(화이트리스트 복사). 구조가 깨졌으면 null */
export function sanitizeNote(raw: unknown): GungNote | null {
  if (!isObj(raw) || raw.v !== NOTE_VERSION) return null;
  const room = typeof raw.code === 'string' ? parseRoomCode(raw.code) : null;
  if (!room || room.code !== raw.code) return null;
  const n = room.n;
  const seat = raw.seat;
  if (!Number.isInteger(seat) || (seat as number) < 1 || (seat as number) > n) return null;
  if (typeof raw.updatedAt !== 'number' || !Number.isFinite(raw.updatedAt)) return null;
  if (!isObj(raw.marks) || !isObj(raw.lines) || typeof raw.free !== 'string') return null;
  const okSeat = (k: string) => {
    const x = Number(k);
    return Number.isInteger(x) && x >= 1 && x <= n && x !== seat;
  };
  const marks: GungNote['marks'] = {};
  for (const [k, row] of Object.entries(raw.marks)) {
    if (!okSeat(k) || !isObj(row)) return null;
    const out: Partial<Record<NoteCol, NoteMark>> = {};
    for (const [col, m] of Object.entries(row)) {
      if (!(NOTE_COLS as readonly string[]).includes(col) || (m !== 'o' && m !== 'x')) return null;
      out[col as NoteCol] = m;
    }
    if (Object.keys(out).length) marks[Number(k)] = out;
  }
  const lines: GungNote['lines'] = {};
  for (const [k, t] of Object.entries(raw.lines)) {
    if (!okSeat(k) || typeof t !== 'string') return null;
    const v = clampText(t, NOTE_LINE_MAX);
    if (v) lines[Number(k)] = v;
  }
  return { v: NOTE_VERSION, code: room.code, seat: seat as number, updatedAt: raw.updatedAt, marks, lines, free: clampText(raw.free, NOTE_FREE_MAX) };
}

export function serializeNote(note: GungNote): string | null {
  const clean = sanitizeNote(JSON.parse(JSON.stringify(note)));
  return clean ? JSON.stringify(clean) : null;
}

function safeRemove(storage: StorageLike): void {
  try {
    storage.removeItem(NOTE_KEY);
  } catch {
    /* 무시 */
  }
}

/**
 * 읽기 — 없거나·깨졌거나·12시간 넘었거나·다른 방(code)·다른 자리(seat)면 지우고 null. 절대 throw 하지 않는다.
 */
export function loadNote(storage: StorageLike, now: number, expect: { code: string; seat: number }): GungNote | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(NOTE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const note = sanitizeNote(parsed);
  if (!note || note.code !== expect.code || note.seat !== expect.seat || now - note.updatedAt > NOTE_TTL_MS) {
    safeRemove(storage);
    return null;
  }
  return note;
}

/** 쓰기 — 실패해도 throw 하지 않고 false */
export function saveNote(storage: StorageLike, note: GungNote): boolean {
  try {
    const json = serializeNote(note);
    if (json === null) return false;
    storage.setItem(NOTE_KEY, json);
    return true;
  } catch {
    return false;
  }
}

export function clearNote(storage: StorageLike): void {
  safeRemove(storage);
}
