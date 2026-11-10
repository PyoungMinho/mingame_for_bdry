'use client';

import type { KeyboardEventHandler } from 'react';
import { COLS, type CellAddr } from '@/lib/monthly-close/coords';
import { rangeEdges, type PtRange } from '@/lib/monthly-close/sheet/sheet-model';
import { colName } from '@/lib/monthly-close/coords';
import { Cell, type CellState, type MemoKind, type SelectionTone } from '../sheet/Cell';
import { SheetGrid, type GridMerge } from '../sheet/SheetGrid';
import type { ExtraMap } from './extras';

/** 판 한 칸의 겉모습. 기록이 없는 칸은 생략(= 빈칸) */
export interface BoardCellView {
  state: CellState;
  /** 상대 시트: `0`/`1`. 침몰·내 항목: 짧은 이름. 종료 후 공개: 흐린 짧은 이름 */
  label?: string;
  /** 내 시트에서 맞은 칸 → 이름에 취소선 */
  strike?: boolean;
  memo?: MemoKind | null;
}

export interface BoardPaneProps {
  /** 스크린리더 이름 ("내 시트" / "상대 시트") */
  label: string;
  idPrefix: string;
  cells: Partial<Record<CellAddr, BoardCellView>>;
  /** 선택 칸. 0기준 {c:0~7, r:0~7}. 판 밖 선택은 허용하지 않는다 */
  selected?: { c: number; r: number } | null;
  selectionTone?: SelectionTone;
  /** 쏠 수 있는 창이면 true (호버 + cell 커서) — 내 차례의 상대 시트, 배치 중 내 시트 */
  fireable?: boolean;
  /** 읽기 전용 창 → 머리글 강조선 회색 */
  readOnly?: boolean;
  /** 점선 범위 (힌트 미리보기·배치 드래그) */
  range?: PtRange | null;
  rangeBad?: boolean;
  /** 힌트 고르기 중: 열/행 머리글이 클릭 가능하게 강조된다 */
  pick?: { cols?: boolean; rows?: boolean } | null;
  pickedCols?: readonly number[];
  pickedRows?: readonly number[];
  onPickCol?: (c: number) => void;
  onPickRow?: (r: number) => void;
  /** 판 바깥 표(I열·9행·10행~): 주소 → 칸. extras 만들기는 tables.ts / ChangeLog / QuizSheet */
  extras?: ExtraMap;
  onCellMouseDown?: (addr: CellAddr, e: React.MouseEvent) => void;
  onCellClick?: (addr: CellAddr) => void;
  onCellDoubleClick?: (addr: CellAddr) => void;
  onCellEnter?: (addr: CellAddr) => void;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  /** 격자 inner 좌표 위에 떠 있는 것(메모 등). 보통은 Pane 의 overlay 에 둔다 */
  overlay?: React.ReactNode;
}

const COL_COUNT = 9; // A~H + I(행 힌트 결과)
const ROW_COUNT = 20;
const BOARD = 8;

/**
 * 게임판 창 한 개: A1:H8 판 + I열(행 힌트) + 9행(열 힌트) + 10행~ 표.
 * 판 바깥 빈 칸은 배경 격자가 그린다. 모든 칸은 role=gridcell 이고 aria-label 은 "B7, 해당 없음" 형식이다.
 */
export function BoardPane(p: BoardPaneProps) {
  const extras = p.extras ?? {};
  const merges: GridMerge[] = [];
  const covered = new Set<string>();
  for (const [addr, ex] of Object.entries(extras)) {
    const m = /^([A-I])(\d+)$/.exec(addr);
    if (!m) continue;
    const c = m[1].charCodeAt(0) - 65;
    const r = Number(m[2]) - 1;
    if (ex.span && ex.span > 1) {
      merges.push({ c, r, cols: ex.span });
      for (let k = 1; k < ex.span; k++) covered.add(`${c + k},${r}`);
    }
  }

  const activeAddr = p.selected ? `${COLS[p.selected.c]}${p.selected.r + 1}` : undefined;

  return (
    <SheetGrid
      label={p.label}
      colWidths={Array.from({ length: COL_COUNT }, () => null)}
      rowCount={ROW_COUNT}
      selected={p.selected ?? null}
      readOnly={p.readOnly}
      pick={p.pick}
      pickedCols={p.pickedCols}
      pickedRows={p.pickedRows}
      onPickCol={p.onPickCol}
      onPickRow={p.onPickRow}
      merges={merges}
      activeId={activeAddr ? `${p.idPrefix}-${activeAddr}` : undefined}
      onKeyDown={p.onKeyDown}
      overlay={p.overlay}
      renderCell={(c, r, ctx) => {
        const addr = `${colName(c)}${r + 1}`;
        const id = `${p.idPrefix}-${addr}`;
        // 판
        if (c < BOARD && r < BOARD) {
          const a = addr as CellAddr;
          const v = p.cells[a];
          const sel = !!p.selected && p.selected.c === c && p.selected.r === r;
          return (
            <Cell
              key={c}
              id={id}
              addr={addr}
              w={ctx.w}
              state={v?.state ?? 'empty'}
              label={v?.label}
              strike={v?.strike}
              memo={v?.memo ?? null}
              selected={sel}
              selectionTone={p.selectionTone}
              hoverable={!!p.fireable}
              range={p.range ? (() => { const e = rangeEdges(p.range!, { c, r }); return e ? { ...e, bad: p.rangeBad } : null; })() : null}
              onMouseDown={p.onCellMouseDown ? (e) => p.onCellMouseDown?.(a, e) : undefined}
              onClick={p.onCellClick ? () => p.onCellClick?.(a) : undefined}
              onDoubleClick={p.onCellDoubleClick ? () => p.onCellDoubleClick?.(a) : undefined}
              onMouseEnter={p.onCellEnter ? () => p.onCellEnter?.(a) : undefined}
            />
          );
        }
        // 판 바깥 표
        const ex = extras[addr];
        if (!ex) return <Cell key={c} id={id} addr={addr} w={ctx.w} />;
        const label = ex.text;
        if (ex.button) {
          return (
            <Cell key={c} id={id} addr={addr} w={ctx.w} ariaLabel={`${addr}, ${ex.button.label}`}>
              <button
                type="button"
                className="mc-cell__btn"
                data-mc-cmd={ex.button.cmd}
                disabled={ex.button.disabled}
                onClick={ex.button.onClick}
              >
                {ex.button.label}
              </button>
            </Cell>
          );
        }
        if (ex.input) {
          const inp = ex.input;
          return (
            <Cell key={c} id={id} addr={addr} w={ctx.w} tone={ex.tone} align="left" ariaLabel={`${addr}, ${inp.ariaLabel}`}>
              <input
                className="mc-cell__input"
                value={inp.value}
                placeholder={inp.placeholder}
                readOnly={inp.locked}
                data-locked={inp.locked ? 'true' : undefined}
                inputMode="numeric"
                autoComplete="off"
                aria-label={inp.ariaLabel}
                data-mc-quiz-input=""
                onChange={(e) => inp.onChange?.(e.target.value)}
                onKeyDown={(e) => {
                  // Tab 은 가로채지 않는다(Tab = 숨기기). 확정은 Enter 뿐.
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    if (!inp.locked) inp.onSubmit?.(e.currentTarget.value);
                  }
                }}
              />
            </Cell>
          );
        }
        return (
          <Cell key={c} id={id} addr={addr} w={ctx.w} label={label} tone={ex.tone} align={ex.align} />
        );
      }}
    />
  );
}
