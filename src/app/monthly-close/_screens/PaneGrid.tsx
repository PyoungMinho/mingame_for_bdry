'use client';

/**
 * 게임 창 하나(내 시트 / 상대 시트)의 격자. SheetGrid + Cell 위에 화면 데이터를 칠하는 얇은 조립 층.
 * 칸 내용은 `specs`(키 "c,r")로 받고, 클릭·키·메모는 콜백으로 올린다. 메모 위치는 DOM 칸 위치를 재서 구한다.
 */

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Cell, type CellState, type MemoKind, type SelectionTone } from '../_components/sheet/Cell';
import { CellMemo } from '../_components/sheet/CellMemo';
import { Pane } from '../_components/sheet/Panes';
import { SheetGrid, type GridMerge } from '../_components/sheet/SheetGrid';
import { placeMemo } from '@/lib/monthly-close/sheet/sheet-model';

export interface CellSpec {
  readonly state?: CellState;
  readonly label?: ReactNode;
  readonly strike?: boolean;
  readonly memo?: MemoKind | null;
  readonly tone?: 'head' | 'label' | 'faint' | 'bold' | 'error' | 'title' | 'sub';
  readonly align?: 'left' | 'center' | 'right';
  readonly children?: ReactNode;
  readonly onClick?: () => void;
  readonly ariaLabel?: string;
}

export interface PaneMemo {
  readonly id: string;
  readonly addr: string;
  readonly kind: MemoKind;
  readonly head: string;
  readonly body: string;
}

export interface PaneGridProps {
  readonly id: string;
  readonly head: string;
  readonly headRight?: ReactNode;
  readonly label: string;
  readonly cols?: number;
  readonly rows?: number;
  /** 키 "c,r" → 칸 내용 */
  readonly specs: ReadonlyMap<string, CellSpec>;
  readonly merges?: readonly GridMerge[];
  readonly rowHeight?: (r: number) => number | undefined;
  readonly selected?: { c: number; r: number } | null;
  readonly selectionTone?: SelectionTone;
  readonly range?: { c0: number; r0: number; c1: number; r1: number } | null;
  readonly rangeBad?: boolean;
  readonly hoverable?: boolean;
  readonly readOnly?: boolean;
  readonly pick?: { cols?: boolean; rows?: boolean } | null;
  readonly pickedCols?: readonly number[];
  readonly pickedRows?: readonly number[];
  readonly onPickCol?: (c: number) => void;
  readonly onPickRow?: (r: number) => void;
  /** 판(0~7행·열) 칸 마우스 누름 */
  readonly onCellDown?: (c: number, r: number, e: { shiftKey: boolean; detail: number }) => void;
  /** 칸 위로 마우스가 들어옴(배치 끌기 미리보기, 닫힌 메모 삼각형 재표시). hasMemo = 그 칸에 메모 삼각형이 있음 */
  readonly onCellEnter?: (c: number, r: number, addr: string, hasMemo: boolean) => void;
  readonly onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  readonly memos?: readonly PaneMemo[];
  readonly overlay?: ReactNode;
  readonly gridFocus?: boolean;
}

const EMPTY: CellSpec = {};

export function PaneGrid(p: PaneGridProps) {
  const cols = p.cols ?? 10;
  const rows = p.rows ?? 20;
  const widths: (number | null)[] = Array.from({ length: cols }, () => null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [memoPos, setMemoPos] = useState<Record<string, { x: number; y: number; flip: boolean }>>({});

  useLayoutEffect(() => {
    const body = bodyRef.current?.parentElement ?? null; // .mc-pane__body (wrapper는 display: contents)
    if (!body || !p.memos || p.memos.length === 0) {
      setMemoPos((cur) => (Object.keys(cur).length ? {} : cur));
      return;
    }
    const bb = body.getBoundingClientRect();
    const next: Record<string, { x: number; y: number; flip: boolean }> = {};
    for (const m of p.memos) {
      const el = body.querySelector<HTMLElement>(`[data-addr="${m.addr}"]`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const pl = placeMemo({ left: r.left - bb.left, top: r.top - bb.top, right: r.right - bb.left, bottom: r.bottom - bb.top }, { width: bb.width, height: bb.height });
      next[m.id] = { x: pl.x, y: pl.y, flip: pl.flip };
    }
    setMemoPos(next);
  }, [p.memos]);

  const mergeKeys = new Map<string, number>();
  for (const m of p.merges ?? []) mergeKeys.set(`${m.c},${m.r}`, m.cols);
  const sel = p.selected ?? null;

  return (
    <Pane
      id={p.id}
      head={p.head}
      headRight={p.headRight}
      overlay={
        <>
          {(p.memos ?? []).map((m) => {
            const pos = memoPos[m.id];
            return pos ? <CellMemo key={m.id} kind={m.kind} head={m.head} body={m.body} x={pos.x} y={pos.y} flip={pos.flip} /> : null;
          })}
          {p.overlay}
        </>
      }
    >
      <div ref={bodyRef} style={{ display: 'contents' }}>
        <SheetGrid
          label={p.label}
          colWidths={widths}
          rowCount={rows}
          rowHeight={p.rowHeight}
          selected={sel}
          range={p.range ?? null}
          readOnly={p.readOnly}
          pick={p.pick}
          pickedCols={p.pickedCols}
          pickedRows={p.pickedRows}
          onPickCol={p.onPickCol}
          onPickRow={p.onPickRow}
          merges={p.merges}
          onKeyDown={p.onKeyDown}
          className={p.gridFocus ? 'mc-grid--focus' : undefined}
          gridFocus={p.gridFocus}
          renderCell={(c, r, ctx) => {
            const spec = p.specs.get(`${c},${r}`) ?? EMPTY;
            const addr = `${String.fromCharCode(65 + c)}${r + 1}`;
            const isSel = !!sel && sel.c === c && sel.r === r;
            const inRange = !!p.range && c >= p.range.c0 && c <= p.range.c1 && r >= p.range.r0 && r <= p.range.r1;
            const edges = inRange
              ? {
                  t: r === p.range!.r0,
                  b: r === p.range!.r1,
                  l: c === p.range!.c0,
                  r: c === p.range!.c1,
                  bad: !!p.rangeBad,
                }
              : null;
            const board = c < 8 && r < 8;
            return (
              <Cell
                key={c}
                addr={addr}
                w={ctx.w}
                state={spec.state ?? 'empty'}
                label={spec.label}
                strike={spec.strike}
                memo={spec.memo ?? null}
                tone={spec.tone}
                align={spec.align}
                ariaLabel={spec.ariaLabel}
                selected={isSel}
                selectionTone={p.selectionTone ?? 'active'}
                hoverable={!!p.hoverable && board}
                range={edges}
                onMouseDown={(e) => {
                  p.onCellDown?.(c, r, { shiftKey: e.shiftKey, detail: e.detail });
                }}
                onMouseEnter={p.onCellEnter ? () => p.onCellEnter!(c, r, addr, !!spec.memo) : undefined}
                onClick={spec.onClick}
              >
                {spec.children}
              </Cell>
            );
          }}
        />
      </div>
    </Pane>
  );
}

export const key = (c: number, r: number) => `${c},${r}`;
