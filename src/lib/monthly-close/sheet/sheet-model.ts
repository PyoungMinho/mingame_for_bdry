/**
 * 시트 선택·이동·편집 모델 — 게임판과 숨기기 시트가 함께 쓰는 순수 리듀서 (소유: 컴포넌트개발자).
 *
 * 순수 TS. React·DOM·node 없음(방향서 §7 경계 규칙 ②).
 * 좌표는 0기준 { c, r } (c=열, r=행). 주소 문자열은 coords.ts의 colName을 쓴다.
 *
 * 규칙 요약
 *  - 방향키는 가장자리에서 멈춘다.
 *  - Shift+방향키 = 범위 확장(anchor 고정).
 *  - 편집 중에는 이동 액션이 무시된다(commit/cancel로만 나감).
 *  - commit(Enter)은 아래로, commit(Tab)은 오른쪽으로 이동하고, state.lastCommit에 결과를 남긴다.
 *  - canEdit 판정은 호출자가 ctx로 넘긴다(보호 셀·계산 셀 = false).
 */

import { colName } from '../coords';

export interface Pt {
  readonly c: number;
  readonly r: number;
}

export interface SheetDims {
  readonly cols: number;
  readonly rows: number;
}

export interface EditState {
  /** 편집 중인 칸 */
  readonly at: Pt;
  readonly text: string;
  /** 취소하면 돌아갈 원래 글자 */
  readonly original: string;
}

export interface CommitInfo {
  readonly at: Pt;
  readonly text: string;
  /** 같은 값이어도 매번 증가 — 호출자가 변화 감지에 쓴다 */
  readonly seq: number;
}

export interface SheetState {
  readonly dims: SheetDims;
  readonly sel: Pt;
  /** 범위 선택의 고정점. 범위가 아니면 null */
  readonly anchor: Pt | null;
  readonly edit: EditState | null;
  readonly lastCommit: CommitInfo | null;
}

export interface SheetCtx {
  /** 이 칸을 편집할 수 있는가. 생략하면 모두 편집 가능 */
  readonly canEdit?: (p: Pt) => boolean;
  /** 편집 시작 때 칸의 현재 글자(수식 입력줄에 보이는 값). 생략하면 '' */
  readonly textAt?: (p: Pt) => string;
}

export type SheetAction =
  | { readonly type: 'move'; readonly dc: number; readonly dr: number; readonly extend?: boolean }
  | { readonly type: 'select'; readonly at: Pt; readonly extend?: boolean }
  | { readonly type: 'selectRange'; readonly from: Pt; readonly to: Pt }
  | { readonly type: 'home' }
  | { readonly type: 'end' }
  | { readonly type: 'startEdit'; readonly mode: 'keep' | 'replace'; readonly initial?: string }
  | { readonly type: 'change'; readonly text: string }
  | { readonly type: 'commit'; readonly advance: 'down' | 'right' | 'left' | 'up' | 'none' }
  | { readonly type: 'cancelEdit' }
  | { readonly type: 'resize'; readonly dims: SheetDims };

// ─── 도우미 ───────────────────────────────────────────────────────────────────

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function clampPt(p: Pt, dims: SheetDims): Pt {
  return { c: clamp(p.c, 0, dims.cols - 1), r: clamp(p.r, 0, dims.rows - 1) };
}

export function samePt(a: Pt | null, b: Pt | null): boolean {
  return a === b || (!!a && !!b && a.c === b.c && a.r === b.r);
}

/** {c:1,r:6} → "B7" (행은 1부터 표기). 열이 26을 넘으면 AA… */
export function ptToAddr(p: Pt): string {
  return `${colName(p.c)}${p.r + 1}`;
}

/** "B7" → {c:1,r:6}. 형식이 맞지 않으면 null. */
export function addrToPt(addr: string): Pt | null {
  const m = /^([A-Z]+)([1-9]\d*)$/.exec(addr);
  if (!m) return null;
  let c = 0;
  for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
  return { c: c - 1, r: Number(m[2]) - 1 };
}

export interface PtRange {
  readonly c0: number;
  readonly r0: number;
  readonly c1: number;
  readonly r1: number;
}

/** 현재 선택 범위(anchor가 없으면 칸 하나). */
export function selectionRange(s: Pick<SheetState, 'sel' | 'anchor'>): PtRange {
  const a = s.anchor ?? s.sel;
  return {
    c0: Math.min(a.c, s.sel.c),
    r0: Math.min(a.r, s.sel.r),
    c1: Math.max(a.c, s.sel.c),
    r1: Math.max(a.r, s.sel.r),
  };
}

export function rangeHas(range: PtRange, p: Pt): boolean {
  return p.c >= range.c0 && p.c <= range.c1 && p.r >= range.r0 && p.r <= range.r1;
}

/** 범위 문자열 "B3:D5" (칸 하나면 "B3"). 이름 상자 표시용. */
export function rangeLabel(range: PtRange): string {
  const a = ptToAddr({ c: range.c0, r: range.r0 });
  const b = ptToAddr({ c: range.c1, r: range.r1 });
  return a === b ? a : `${a}:${b}`;
}

export interface RangeEdges {
  readonly t: boolean;
  readonly b: boolean;
  readonly l: boolean;
  readonly r: boolean;
}

/** 범위 점선이 이 칸의 어느 변에 그려지는가. 범위 밖이면 null. */
export function rangeEdges(range: PtRange, p: Pt): RangeEdges | null {
  if (!rangeHas(range, p)) return null;
  return { t: p.r === range.r0, b: p.r === range.r1, l: p.c === range.c0, r: p.c === range.c1 };
}

// ─── 초기 상태 ────────────────────────────────────────────────────────────────

export function initSheetState(dims: SheetDims, sel: Pt = { c: 0, r: 0 }): SheetState {
  return { dims, sel: clampPt(sel, dims), anchor: null, edit: null, lastCommit: null };
}

// ─── 리듀서 ───────────────────────────────────────────────────────────────────

export function sheetReducer(state: SheetState, action: SheetAction, ctx: SheetCtx = {}): SheetState {
  switch (action.type) {
    case 'resize': {
      const sel = clampPt(state.sel, action.dims);
      return { ...state, dims: action.dims, sel, anchor: state.anchor ? clampPt(state.anchor, action.dims) : null, edit: null };
    }

    case 'move': {
      if (state.edit) return state;
      const sel = clampPt({ c: state.sel.c + action.dc, r: state.sel.r + action.dr }, state.dims);
      if (action.extend) return { ...state, sel, anchor: state.anchor ?? state.sel };
      return { ...state, sel, anchor: null };
    }

    case 'select': {
      if (state.edit) {
        // 편집 중 다른 칸을 누르면 값을 확정하고 옮긴다(시트 앱 동작)
        const committed = commitInternal(state, ctx);
        return selectInternal(committed, clampPt(action.at, state.dims), action.extend);
      }
      return selectInternal(state, clampPt(action.at, state.dims), action.extend);
    }

    case 'selectRange': {
      if (state.edit) return state;
      return { ...state, sel: clampPt(action.to, state.dims), anchor: clampPt(action.from, state.dims) };
    }

    case 'home':
      return state.edit ? state : { ...state, sel: { c: 0, r: state.sel.r }, anchor: null };

    case 'end':
      return state.edit ? state : { ...state, sel: { c: state.dims.cols - 1, r: state.sel.r }, anchor: null };

    case 'startEdit': {
      if (state.edit) return state;
      if (ctx.canEdit && !ctx.canEdit(state.sel)) return state;
      const original = ctx.textAt ? ctx.textAt(state.sel) : '';
      const text = action.mode === 'replace' ? (action.initial ?? '') : original;
      return { ...state, anchor: null, edit: { at: state.sel, text, original } };
    }

    case 'change':
      return state.edit ? { ...state, edit: { ...state.edit, text: action.text } } : state;

    case 'cancelEdit':
      return state.edit ? { ...state, edit: null } : state;

    case 'commit': {
      if (!state.edit) {
        // 편집 중이 아니면 Enter/Tab은 이동일 뿐이다
        return advance(state, action.advance);
      }
      return advance(commitInternal(state, ctx), action.advance);
    }
  }
}

function selectInternal(state: SheetState, at: Pt, extend?: boolean): SheetState {
  if (extend) return { ...state, sel: at, anchor: state.anchor ?? state.sel };
  return { ...state, sel: at, anchor: null };
}

function commitInternal(state: SheetState, _ctx: SheetCtx): SheetState {
  const e = state.edit;
  if (!e) return state;
  const seq = (state.lastCommit?.seq ?? 0) + 1;
  return { ...state, edit: null, lastCommit: { at: e.at, text: e.text, seq } };
}

function advance(state: SheetState, dir: 'down' | 'right' | 'left' | 'up' | 'none'): SheetState {
  if (dir === 'none') return state;
  const d = dir === 'down' ? [0, 1] : dir === 'up' ? [0, -1] : dir === 'right' ? [1, 0] : [-1, 0];
  const sel = clampPt({ c: state.sel.c + d[0], r: state.sel.r + d[1] }, state.dims);
  return { ...state, sel, anchor: null };
}

// ─── 키 → 액션 ────────────────────────────────────────────────────────────────

export interface KeyInfo {
  readonly key: string;
  readonly shiftKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
  readonly isComposing?: boolean;
}

/**
 * 시트 안 키 입력 → 액션. 처리하지 않는 키는 null.
 * (Tab·Esc의 게임 쪽 의미는 이 함수 밖에서 정한다. 이 함수는 "숨기기 시트 안" 키 표(UX §6-2)를 따른다.)
 */
export function keyToAction(state: SheetState, k: KeyInfo): SheetAction | null {
  if (k.isComposing || k.ctrlKey || k.metaKey || k.altKey) return null;
  const editing = !!state.edit;

  switch (k.key) {
    case 'ArrowUp':
      return editing ? null : { type: 'move', dc: 0, dr: -1, extend: k.shiftKey };
    case 'ArrowDown':
      return editing ? null : { type: 'move', dc: 0, dr: 1, extend: k.shiftKey };
    case 'ArrowLeft':
      return editing ? null : { type: 'move', dc: -1, dr: 0, extend: k.shiftKey };
    case 'ArrowRight':
      return editing ? null : { type: 'move', dc: 1, dr: 0, extend: k.shiftKey };
    case 'Home':
      return editing ? null : { type: 'home' };
    case 'End':
      return editing ? null : { type: 'end' };
    case 'Enter':
      return { type: 'commit', advance: k.shiftKey ? 'up' : 'down' };
    case 'Tab':
      return { type: 'commit', advance: k.shiftKey ? 'left' : 'right' };
    case 'Escape':
      return editing ? { type: 'cancelEdit' } : null;
    case 'F2':
      return editing ? null : { type: 'startEdit', mode: 'keep' };
    default:
      // 글자 한 개 = 편집 시작(기존 값 대체)
      if (!editing && k.key.length === 1) return { type: 'startEdit', mode: 'replace', initial: k.key };
      return null;
  }
}

// ─── 메모 말풍선 위치 ──────────────────────────────────────────────────────────

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface MemoPlacement {
  readonly x: number;
  readonly y: number;
  readonly flip: boolean;
}

export const MEMO_W = 220;
export const MEMO_H = 66;
const MEMO_GAP = 4;

/**
 * 메모는 셀 오른쪽 위에 맞추고 4px 띄운다. 창 오른쪽 끝에 닿으면 왼쪽으로 뒤집는다(UI §2-7).
 * 좌표는 창(pane) 기준 px. 창 위·아래 밖으로는 나가지 않게 y를 접는다.
 */
export function placeMemo(cell: Box, pane: { width: number; height: number }, memo = { w: MEMO_W, h: MEMO_H }): MemoPlacement {
  let flip = false;
  let x = cell.right + MEMO_GAP;
  if (x + memo.w > pane.width) {
    flip = true;
    x = cell.left - MEMO_GAP - memo.w;
  }
  x = Math.max(0, x);
  let y = cell.top;
  if (y + memo.h > pane.height) y = Math.max(0, pane.height - memo.h);
  return { x, y, flip };
}
