import { describe, expect, it } from 'vitest';
import {
  addrToPt, initSheetState, keyToAction, placeMemo, ptToAddr, rangeEdges, rangeLabel, selectionRange, sheetReducer,
  type SheetAction, type SheetState,
} from './sheet-model';

const dims = { cols: 10, rows: 30 };
const run = (s: SheetState, ...a: SheetAction[]) => a.reduce((x, y) => sheetReducer(x, y), s);

describe('sheet-model: 주소', () => {
  it('좌표 ↔ 주소', () => {
    expect(ptToAddr({ c: 1, r: 6 })).toBe('B7');
    expect(ptToAddr({ c: 26, r: 0 })).toBe('AA1');
    expect(addrToPt('B7')).toEqual({ c: 1, r: 6 });
    expect(addrToPt('b7')).toBeNull();
    expect(addrToPt('A0')).toBeNull();
  });
});

describe('sheet-model: 이동', () => {
  it('가장자리에서 멈춘다', () => {
    let s = initSheetState(dims, { c: 0, r: 0 });
    s = run(s, { type: 'move', dc: -1, dr: -1 });
    expect(s.sel).toEqual({ c: 0, r: 0 });
    s = run(initSheetState(dims, { c: 9, r: 29 }), { type: 'move', dc: 1, dr: 1 });
    expect(s.sel).toEqual({ c: 9, r: 29 });
  });

  it('Shift+이동 = 범위 확장, 이동하면 해제', () => {
    let s = initSheetState(dims, { c: 1, r: 1 });
    s = run(s, { type: 'move', dc: 1, dr: 0, extend: true }, { type: 'move', dc: 0, dr: 1, extend: true });
    expect(selectionRange(s)).toEqual({ c0: 1, r0: 1, c1: 2, r1: 2 });
    expect(rangeLabel(selectionRange(s))).toBe('B2:C3');
    s = run(s, { type: 'move', dc: 1, dr: 0 });
    expect(s.anchor).toBeNull();
  });

  it('범위 점선은 바깥 변에만', () => {
    const range = { c0: 1, r0: 2, c1: 3, r1: 4 };
    expect(rangeEdges(range, { c: 1, r: 2 })).toEqual({ t: true, b: false, l: true, r: false });
    expect(rangeEdges(range, { c: 2, r: 3 })).toEqual({ t: false, b: false, l: false, r: false });
    expect(rangeEdges(range, { c: 0, r: 0 })).toBeNull();
  });
});

describe('sheet-model: 편집', () => {
  const canEdit = (p: { c: number; r: number }) => p.c !== 0;
  const ctx = { canEdit, textAt: () => '5000' };

  it('글자 입력으로 시작하면 기존 값을 대체한다', () => {
    let s = initSheetState(dims, { c: 2, r: 3 });
    const act = keyToAction(s, { key: '7' });
    expect(act).toEqual({ type: 'startEdit', mode: 'replace', initial: '7' });
    s = sheetReducer(s, act as SheetAction, ctx);
    expect(s.edit?.text).toBe('7');
    expect(s.edit?.original).toBe('5000');
  });

  it('F2는 기존 값을 유지한 채 시작', () => {
    const s = sheetReducer(initSheetState(dims, { c: 2, r: 3 }), { type: 'startEdit', mode: 'keep' }, ctx);
    expect(s.edit?.text).toBe('5000');
  });

  it('편집 불가 칸은 편집이 시작되지 않는다', () => {
    const s = sheetReducer(initSheetState(dims, { c: 0, r: 3 }), { type: 'startEdit', mode: 'keep' }, ctx);
    expect(s.edit).toBeNull();
  });

  it('Enter = 확정 후 아래, Tab = 확정 후 오른쪽, Shift+Tab = 왼쪽', () => {
    let s = sheetReducer(initSheetState(dims, { c: 2, r: 3 }), { type: 'startEdit', mode: 'replace', initial: '1' }, ctx);
    s = sheetReducer(s, { type: 'change', text: '123' }, ctx);
    s = sheetReducer(s, keyToAction(s, { key: 'Enter' }) as SheetAction, ctx);
    expect(s.edit).toBeNull();
    expect(s.lastCommit).toMatchObject({ at: { c: 2, r: 3 }, text: '123', seq: 1 });
    expect(s.sel).toEqual({ c: 2, r: 4 });

    s = sheetReducer(s, { type: 'startEdit', mode: 'replace', initial: '9' }, ctx);
    s = sheetReducer(s, keyToAction(s, { key: 'Tab' }) as SheetAction, ctx);
    expect(s.lastCommit?.seq).toBe(2);
    expect(s.sel).toEqual({ c: 3, r: 4 });

    s = sheetReducer(s, { type: 'startEdit', mode: 'replace', initial: '9' }, ctx);
    s = sheetReducer(s, keyToAction(s, { key: 'Tab', shiftKey: true }) as SheetAction, ctx);
    expect(s.sel).toEqual({ c: 2, r: 4 });
  });

  it('ESC는 편집 취소만 — 편집 중이 아니면 처리하지 않는다', () => {
    const idle = initSheetState(dims, { c: 2, r: 3 });
    expect(keyToAction(idle, { key: 'Escape' })).toBeNull();
    let s = sheetReducer(idle, { type: 'startEdit', mode: 'replace', initial: '1' }, ctx);
    s = sheetReducer(s, { type: 'cancelEdit' }, ctx);
    expect(s.edit).toBeNull();
    expect(s.lastCommit).toBeNull();
    expect(s.sel).toEqual({ c: 2, r: 3 });
  });

  it('편집 중에는 방향키·이동이 무시되고, 다른 칸 선택은 확정 후 이동', () => {
    let s = sheetReducer(initSheetState(dims, { c: 2, r: 3 }), { type: 'startEdit', mode: 'replace', initial: '4' }, ctx);
    expect(keyToAction(s, { key: 'ArrowDown' })).toBeNull();
    expect(sheetReducer(s, { type: 'move', dc: 1, dr: 0 }, ctx)).toBe(s);
    s = sheetReducer(s, { type: 'select', at: { c: 5, r: 5 } }, ctx);
    expect(s.edit).toBeNull();
    expect(s.lastCommit?.text).toBe('4');
    expect(s.sel).toEqual({ c: 5, r: 5 });
  });

  it('IME 조합 중·수식키 조합은 무시', () => {
    const s = initSheetState(dims);
    expect(keyToAction(s, { key: 'a', isComposing: true })).toBeNull();
    expect(keyToAction(s, { key: 's', ctrlKey: true })).toBeNull();
    expect(keyToAction(s, { key: 's', metaKey: true })).toBeNull();
  });

  it('편집 중이 아닐 때 Enter는 아래 이동일 뿐', () => {
    const s = sheetReducer(initSheetState(dims, { c: 2, r: 3 }), keyToAction(initSheetState(dims), { key: 'Enter' }) as SheetAction);
    expect(s.sel).toEqual({ c: 2, r: 4 });
    expect(s.lastCommit).toBeNull();
  });
});

describe('sheet-model: 메모 위치', () => {
  const pane = { width: 600, height: 400 };
  it('기본은 셀 오른쪽 4px', () => {
    expect(placeMemo({ left: 100, top: 50, right: 164, bottom: 74 }, pane)).toEqual({ x: 168, y: 50, flip: false });
  });
  it('창 오른쪽 끝이면 왼쪽으로 뒤집는다', () => {
    const p = placeMemo({ left: 500, top: 50, right: 564, bottom: 74 }, pane);
    expect(p.flip).toBe(true);
    expect(p.x).toBe(500 - 4 - 220);
  });
  it('아래로 넘치면 위로 올린다', () => {
    expect(placeMemo({ left: 10, top: 390, right: 74, bottom: 414 }, pane).y).toBe(400 - 66);
  });
});
