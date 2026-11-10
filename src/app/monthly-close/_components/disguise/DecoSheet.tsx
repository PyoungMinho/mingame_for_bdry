'use client';

import { useEffect, useReducer } from 'react';
import { ptToAddr, initSheetState, keyToAction, rangeEdges, selectionRange, sheetReducer, type SheetAction } from '@/lib/monthly-close/sheet/sheet-model';
import { Cell } from '../sheet/Cell';
import { PaneHead } from '../sheet/Panes';
import { SheetGrid } from '../sheet/SheetGrid';

export interface DecoRow {
  date: string;
  memo: string;
  owner: string;
}

export interface DecoSheetProps {
  label: string;
  /** 1행 제목 (업종 공통 `업무 메모`) */
  title: string;
  /** 2행 머리 [일자, 내용, 담당] */
  headers: readonly [string, string, string];
  /** 3행부터 메모 줄 (6줄 이상) */
  rows: readonly DecoRow[];
  filterLeft: string;
  filterRight: string;
  /** 선택이 바뀔 때 이름 상자·수식줄 동기화용 */
  onSelect?: (addr: string, text: string) => void;
}

// A 일자 96 · B~E 내용(병합) 4×96 · F 담당 72 · 나머지 기본
const WIDTHS: (number | null)[] = [96, 96, 96, 96, 96, 72, null, null, null, null];

/** 장식 메모 시트(비고·목표): 선택·이동만 된다. 눌러서 숨기기 시트로 보이는 "다른 시트"일 뿐 게임 요소 0. */
export function DecoSheet({ label, title, headers, rows, filterLeft, filterRight, onSelect }: DecoSheetProps) {
  const [state, dispatch] = useReducer(
    (s: ReturnType<typeof initSheetState>, a: SheetAction) => sheetReducer(s, a),
    undefined,
    () => initSheetState({ cols: WIDTHS.length, rows: 20 }, { c: 1, r: 2 }),
  );
  const rowsAll = 20;
  const textAt = (c: number, r: number): string => {
    if (r === 0) return c === 0 ? title : '';
    if (r === 1) return c === 0 ? headers[0] : c === 1 ? headers[1] : c === 5 ? headers[2] : '';
    const row = rows[r - 2];
    if (!row) return '';
    return c === 0 ? row.date : c === 1 ? row.memo : c === 5 ? row.owner : '';
  };

  useEffect(() => {
    onSelect?.(ptToAddr(state.sel), textAt(state.sel.c, state.sel.r));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sel.c, state.sel.r]);

  const rng = selectionRange(state);
  const multi = !!state.anchor;
  const merges = [{ c: 1, r: 1, cols: 4 }, ...rows.map((_, i) => ({ c: 1, r: i + 2, cols: 4 }))];

  return (
    <div className="mc-pane mc-pane--single" data-pane="deco">
      <PaneHead left={filterLeft} right={filterRight} />
      <div className="mc-pane__body">
        <SheetGrid
          label={label}
          colWidths={WIDTHS}
          rowCount={rowsAll + 12}
          rowHeight={(r) => (r === 0 ? 28 : undefined)}
          selected={state.sel}
          range={multi ? rng : null}
          merges={merges.filter((m) => m.r < rowsAll)}
          onKeyDown={(e) => {
            const a = keyToAction(state, { key: e.key, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, isComposing: e.nativeEvent.isComposing });
            // 글자 입력 = 편집 시작이지만 이 시트는 편집이 없다 → 이동 키만 처리
            if (a && (a.type === 'move' || a.type === 'home' || a.type === 'end' || (a.type === 'commit' && !state.edit))) {
              e.preventDefault();
              dispatch(a);
            }
          }}
          renderCell={(c, r, ctx) => {
            const addr = ptToAddr({ c, r });
            const pt = { c, r };
            const isHead = r === 1;
            return (
              <Cell
                key={c}
                addr={addr}
                w={ctx.w}
                label={textAt(c, r)}
                align={c === 0 ? 'center' : 'left'}
                tone={r === 0 ? 'title' : isHead ? 'head' : undefined}
                selected={state.sel.c === c && state.sel.r === r}
                range={multi ? rangeEdges(rng, pt) : null}
                onMouseDown={() => dispatch({ type: 'select', at: pt })}
              />
            );
          }}
        />
      </div>
    </div>
  );
}
