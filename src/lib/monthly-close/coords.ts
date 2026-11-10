/**
 * 월마감 좌표 유틸 — D0 동결 (소유: 프론트팀장).
 *
 * 순수 TS. React·DOM·node:* 금지(방향서 §7 경계 규칙 ②). 서버 zod 검증, 엔진, 화면, 연습이 모두 import한다.
 *
 * 다루는 것
 *  - "B7" ↔ 0기준 좌표, 셀 인덱스(행 우선 0~63)
 *  - 범위 문자열 "B3:D5" 파싱/표기(이름 상자, 배치 범위, 힌트 범위)
 *  - 이름 상자 입력 정규화: 두벌식 자모(ㅁㅠㅊㅇㄷㄹㅎㅗ, Shift+E=ㄸ) → A~H, 소문자, 전각, `$` 절대참조 기호
 *  - 힌트 대상 → 범위(열 전체 / 행 전체 / 3×3, 가장자리는 판 안쪽으로 밀기 — 방향서 §2-R)
 *  - 배 배치(시작 칸 + 방향) → 칸 목록, 범위 → 배치
 *
 * 다루지 않는 것: 함대 전체 검증(겹침·슬롯 중복)은 engine/ 몫(API설계자).
 *
 * 와이어 형식 결정(D0): 칸은 항상 "B7" 같은 CellAddr 문자열, 배는 { slot, start, dir }.
 * 범위 문자열은 와이어에 싣지 않고 이 파일의 함수로 그때그때 만든다(형식 불일치 원천 차단).
 */

import { BOARD_SIZE, HINT_BLOCK_SIZE, SHIP_LENGTH, type ShipSlot } from './constants';

// ─── 타입 ────────────────────────────────────────────────────────────────────

export const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export type Col = (typeof COLS)[number];
export const ROWS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export type Row = (typeof ROWS)[number];

/** 판 위 칸 주소. 예: "B7". */
export type CellAddr = `${Col}${Row}`;

/** 0기준 좌표. c = 열(0=A), r = 행(0=1행). */
export interface Point {
  readonly c: number;
  readonly r: number;
}

/** 판 위 직사각형 범위. from = 왼쪽 위, to = 오른쪽 아래(항상 정규화된 상태). */
export interface CellRange {
  readonly from: CellAddr;
  readonly to: CellAddr;
}

export type ShipDir = 'h' | 'v';

/** 배 배치(와이어 형식). 칸 목록은 placementCells()로 만든다. */
export interface ShipPlacement {
  readonly slot: ShipSlot;
  readonly start: CellAddr;
  readonly dir: ShipDir;
}

export type HintKind = 'col' | 'row' | 'block';

/** 힌트 대상(와이어 형식). block의 cell은 사용자가 고른 칸(범위는 hintRange가 판 안쪽으로 민다). */
export type HintTarget =
  | { readonly kind: 'col'; readonly col: Col }
  | { readonly kind: 'row'; readonly row: Row }
  | { readonly kind: 'block'; readonly cell: CellAddr };

// ─── 기본 변환 ───────────────────────────────────────────────────────────────

const COL_SET: ReadonlySet<string> = new Set(COLS);

export function isCol(v: unknown): v is Col {
  return typeof v === 'string' && COL_SET.has(v);
}

export function isRow(v: unknown): v is Row {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= BOARD_SIZE;
}

const CELL_RE = /^([A-H])([1-8])$/;

export function isCellAddr(v: unknown): v is CellAddr {
  return typeof v === 'string' && CELL_RE.test(v);
}

export function inBoard(p: Point): boolean {
  return (
    Number.isInteger(p.c) && Number.isInteger(p.r) && p.c >= 0 && p.r >= 0 && p.c < BOARD_SIZE && p.r < BOARD_SIZE
  );
}

/** "B7" → { c: 1, r: 6 } */
export function toPoint(addr: CellAddr): Point {
  return { c: addr.charCodeAt(0) - 65, r: Number(addr.slice(1)) - 1 };
}

/** { c, r } → "B7". 판 밖이면 null. */
export function toAddr(p: Point): CellAddr | null {
  if (!inBoard(p)) return null;
  return `${COLS[p.c]}${ROWS[p.r]}`;
}

/** 행 우선 인덱스(A1=0, B1=1, …, H8=63). */
export function cellIndex(addr: CellAddr): number {
  const { c, r } = toPoint(addr);
  return r * BOARD_SIZE + c;
}

/** 인덱스 → 주소. 범위 밖이면 null. */
export function addrAt(index: number): CellAddr | null {
  if (!Number.isInteger(index) || index < 0 || index >= BOARD_SIZE * BOARD_SIZE) return null;
  return toAddr({ c: index % BOARD_SIZE, r: Math.floor(index / BOARD_SIZE) });
}

/** 판의 64칸(행 우선). */
export const ALL_CELLS: readonly CellAddr[] = Array.from(
  { length: BOARD_SIZE * BOARD_SIZE },
  (_, i) => addrAt(i) as CellAddr,
);

/** 방향키 이동: 판 밖으로 나가지 않고 가장자리에서 멈춘다(UX §4-5). */
export function stepCell(addr: CellAddr, dc: number, dr: number): CellAddr {
  const { c, r } = toPoint(addr);
  const clamp = (n: number) => Math.min(BOARD_SIZE - 1, Math.max(0, n));
  return toAddr({ c: clamp(c + dc), r: clamp(r + dr) }) as CellAddr;
}

// ─── 일반 시트 열 이름 (판 밖 머리글 I, J…, 숨기기 시트 A~J용) ──────────────────

/** 0 → "A", 25 → "Z", 26 → "AA". 음수·비정수면 빈 문자열. */
export function colName(index: number): string {
  if (!Number.isInteger(index) || index < 0) return '';
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** "A" → 0, "AA" → 26. 대문자 A~Z가 아니면 -1. */
export function colIndex(name: string): number {
  if (!/^[A-Z]+$/.test(name)) return -1;
  let n = 0;
  for (const ch of name) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

// ─── 이름 상자 입력 정규화 ──────────────────────────────────────────────────────

/**
 * 두벌식 자판에서 영문 A~H 키 위치의 자모. 한글 입력 상태로 "b7"을 치면 "ㅠ7"이 된다(방향서 §5-4).
 * 호환 자모(U+3131~)와 조합형 자모(U+1100~) 둘 다 받는다. Shift+E(ㄸ)도 E로 본다.
 */
export const JAMO_TO_COL: Readonly<Record<string, Col>> = {
  // 호환 자모
  'ㅁ': 'A', 'ㅠ': 'B', 'ㅊ': 'C', 'ㅇ': 'D', 'ㄷ': 'E', 'ㄸ': 'E', 'ㄹ': 'F', 'ㅎ': 'G', 'ㅗ': 'H',
  // 조합형 초성·중성
  'ᄆ': 'A', 'ᅲ': 'B', 'ᄎ': 'C', 'ᄋ': 'D', 'ᄃ': 'E', 'ᄄ': 'E', 'ᄅ': 'F',
  'ᄒ': 'G', 'ᅩ': 'H',
};

/**
 * 이름 상자 원문 → 비교용 문자열. 공백·`$` 제거, 전각 ASCII → 반각, 자모 → 열 문자, 대문자화.
 * 판 범위 검사는 하지 않는다(parseCell / parseRange 몫).
 */
export function normalizeAddrInput(raw: string): string {
  let out = '';
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    if (ch === ' ' || ch === '　' || ch === '\t' || ch === '$') continue;
    const jamo = JAMO_TO_COL[ch];
    if (jamo) {
      out += jamo;
      continue;
    }
    // 전각 ASCII(！~～) → 반각
    if (code >= 0xff01 && code <= 0xff5e) {
      out += String.fromCharCode(code - 0xfee0).toUpperCase();
      continue;
    }
    out += ch.toUpperCase();
  }
  return out;
}

const A1_RE = /^([A-Z]{1,3})(\d{1,7})$/;

/** 정규화된 A1 표기 → 0기준 좌표(판 범위 무관). 형식이 틀리면 null. 예: "Z9" → { c: 25, r: 8 } */
function parseA1Normalized(s: string): Point | null {
  const m = A1_RE.exec(s);
  if (!m) return null;
  const row = Number(m[2]);
  if (row < 1) return null;
  return { c: colIndex(m[1]), r: row - 1 };
}

/** 이름 상자 원문 → 판 위 칸. 형식 오류·판 밖이면 null. "ㅠ7", " b7 ", "Ｂ７", "$B$7" → "B7". */
export function parseCell(raw: string): CellAddr | null {
  const p = parseA1Normalized(normalizeAddrInput(raw));
  return p ? toAddr(p) : null;
}

export type ParseRangeResult =
  | { readonly ok: true; readonly range: CellRange }
  | { readonly ok: false; readonly reason: 'syntax' | 'outOfBoard' };

/**
 * 이름 상자 원문 → 판 위 범위. "B3:D5", "D5:B3"(뒤집혀도 정규화), "B7"(한 칸 = B7:B7).
 * - 'syntax'     : A1 표기가 아님 → 상태줄 `badAddr`
 * - 'outOfBoard' : A1 표기는 맞지만 판(A1:H8) 밖 → 상태줄 `outOfBoard`
 */
export function parseRange(raw: string): ParseRangeResult {
  const s = normalizeAddrInput(raw);
  const parts = s.split(':');
  if (parts.length < 1 || parts.length > 2 || parts.some((x) => x.length === 0)) {
    return { ok: false, reason: 'syntax' };
  }
  const pts = parts.map(parseA1Normalized);
  if (pts.some((p) => p === null)) return { ok: false, reason: 'syntax' };
  const a = pts[0] as Point;
  const b = (pts[1] ?? pts[0]) as Point;
  if (!inBoard(a) || !inBoard(b)) return { ok: false, reason: 'outOfBoard' };
  return { ok: true, range: makeRange(a, b) };
}

/** 두 좌표로 정규화된 범위(왼쪽 위 → 오른쪽 아래). 둘 다 판 안이어야 한다. */
export function makeRange(a: Point, b: Point): CellRange {
  const from = toAddr({ c: Math.min(a.c, b.c), r: Math.min(a.r, b.r) });
  const to = toAddr({ c: Math.max(a.c, b.c), r: Math.max(a.r, b.r) });
  if (!from || !to) throw new RangeError('makeRange: point out of board');
  return { from, to };
}

/** 범위 → "B3:D5". 한 칸이면 "B7"(시트 이름 상자 표기). */
export function formatRange(range: CellRange): string {
  return range.from === range.to ? range.from : `${range.from}:${range.to}`;
}

/** 범위의 열 수·행 수. */
export function rangeSize(range: CellRange): { cols: number; rows: number } {
  const a = toPoint(range.from);
  const b = toPoint(range.to);
  return { cols: b.c - a.c + 1, rows: b.r - a.r + 1 };
}

/** 범위 안의 칸(행 우선). */
export function rangeCells(range: CellRange): CellAddr[] {
  const a = toPoint(range.from);
  const b = toPoint(range.to);
  const out: CellAddr[] = [];
  for (let r = a.r; r <= b.r; r++) for (let c = a.c; c <= b.c; c++) out.push(toAddr({ c, r }) as CellAddr);
  return out;
}

export function rangeContains(range: CellRange, addr: CellAddr): boolean {
  const a = toPoint(range.from);
  const b = toPoint(range.to);
  const p = toPoint(addr);
  return p.c >= a.c && p.c <= b.c && p.r >= a.r && p.r <= b.r;
}

// ─── 힌트 ────────────────────────────────────────────────────────────────────

/**
 * 힌트 대상 → 조회 범위.
 *  - col  : E → E1:E8
 *  - row  : 3 → A3:H3
 *  - block: 고른 칸을 가운데로 하는 3×3. 판 밖으로 나가면 안쪽으로 민다(A1 → A1:C3, C4 → B3:D5).
 */
export function hintRange(target: HintTarget): CellRange {
  const last = BOARD_SIZE - 1;
  switch (target.kind) {
    case 'col': {
      const c = COLS.indexOf(target.col);
      return makeRange({ c, r: 0 }, { c, r: last });
    }
    case 'row':
      return makeRange({ c: 0, r: target.row - 1 }, { c: last, r: target.row - 1 });
    case 'block': {
      const half = Math.floor(HINT_BLOCK_SIZE / 2);
      const p = toPoint(target.cell);
      const lo = (n: number) => Math.min(BOARD_SIZE - HINT_BLOCK_SIZE, Math.max(0, n - half));
      const c0 = lo(p.c);
      const r0 = lo(p.r);
      return makeRange({ c: c0, r: r0 }, { c: c0 + HINT_BLOCK_SIZE - 1, r: r0 + HINT_BLOCK_SIZE - 1 });
    }
  }
}

/** 와이어 값 검증용: HintTarget 모양인지(서버 zod refine, 연습 엔진 입력 확인). */
export function isHintTarget(v: unknown): v is HintTarget {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (o.kind === 'col') return isCol(o.col);
  if (o.kind === 'row') return isRow(o.row);
  if (o.kind === 'block') return isCellAddr(o.cell);
  return false;
}

// ─── 배 ──────────────────────────────────────────────────────────────────────

/** 시작 칸 + 방향 + 길이 → 칸 목록. 판 밖으로 나가면 null. h = 오른쪽, v = 아래. */
export function shipCells(start: CellAddr, dir: ShipDir, length: number): CellAddr[] | null {
  if (!Number.isInteger(length) || length < 1) return null;
  const p = toPoint(start);
  const out: CellAddr[] = [];
  for (let i = 0; i < length; i++) {
    const a = toAddr(dir === 'h' ? { c: p.c + i, r: p.r } : { c: p.c, r: p.r + i });
    if (!a) return null;
    out.push(a);
  }
  return out;
}

/** 배치 → 칸 목록(슬롯 길이 사용). 판 밖이면 null. */
export function placementCells(p: ShipPlacement): CellAddr[] | null {
  return shipCells(p.start, p.dir, SHIP_LENGTH[p.slot]);
}

export type RangeToPlacementResult =
  | { readonly ok: true; readonly start: CellAddr; readonly dir: ShipDir }
  | { readonly ok: false; readonly reason: 'rangeLen' };

/**
 * 배치 범위(드래그·Shift 클릭·이름 상자 "B2:E2") → 시작 칸 + 방향.
 * 1×length(가로) 또는 length×1(세로)일 때만 성공. 아니면 'rangeLen'(상태줄 "범위 길이를 항목에 맞춰 주세요.").
 */
export function rangeToPlacement(range: CellRange, length: number): RangeToPlacementResult {
  const { cols, rows } = rangeSize(range);
  if (length >= 2 && rows === 1 && cols === length) return { ok: true, start: range.from, dir: 'h' };
  if (length >= 2 && cols === 1 && rows === length) return { ok: true, start: range.from, dir: 'v' };
  return { ok: false, reason: 'rangeLen' };
}

/** 배치 → 범위(배치 표·이름 상자 표시용). 판 밖이면 null. */
export function placementRange(p: ShipPlacement): CellRange | null {
  const cells = placementCells(p);
  if (!cells) return null;
  return { from: cells[0], to: cells[cells.length - 1] };
}
