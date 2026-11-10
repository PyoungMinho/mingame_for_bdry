import { forwardRef, type CSSProperties, type KeyboardEventHandler, type ReactNode } from 'react';
import type { Pt, PtRange } from '@/lib/monthly-close/sheet/sheet-model';
import { ColHeaders, RowHead } from './Headers';
import { cx } from './cx';

export interface GridMerge {
  readonly c: number;
  readonly r: number;
  /** 오른쪽으로 병합하는 칸 수 (2 이상) */
  readonly cols: number;
}

export interface RenderCtx {
  /** <Cell w={ctx.w}> 로 넘긴다. 병합이면 병합 폭 */
  readonly w: number | string | undefined;
  readonly freezeCol: boolean;
  readonly rowKind?: string;
}

export interface SheetGridProps {
  /** 스크린리더용 이름 ("내 시트") */
  label: string;
  /** 열 폭(px, null = 기본 칸 폭, 0 = 숨긴 열). 길이 = 열 수 */
  colWidths: readonly (number | null)[];
  rowCount: number;
  /** 행 높이(px). 생략하면 기본 24 */
  rowHeight?: (r: number) => number | undefined;
  rowKind?: (r: number) => string | undefined;
  selected?: Pt | null;
  range?: PtRange | null;
  /** 읽기 전용 창이면 머리글 강조선이 회색 */
  readOnly?: boolean;
  /** 힌트 고르기 중이면 열/행 머리글이 클릭 가능하게 강조된다 */
  pick?: { cols?: boolean; rows?: boolean } | null;
  pickedCols?: readonly number[];
  pickedRows?: readonly number[];
  onPickCol?: (c: number) => void;
  onPickRow?: (r: number) => void;
  /** 틀 고정: 위 N행 · 왼쪽 0~1열 (숨기기 시트) */
  frozen?: { rows: number; cols: 0 | 1 };
  merges?: readonly GridMerge[];
  /** 칸 하나를 그린다. <Cell .../> 를 돌려준다 */
  renderCell: (c: number, r: number, ctx: RenderCtx) => ReactNode;
  activeId?: string;
  gridlines?: boolean;
  tabIndex?: number;
  /** 명령 이동 모드가 끝날 때 포커스를 돌려받는 격자(`data-mc-grid-focus`) */
  gridFocus?: boolean;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  /** 격자 위에 떠 있는 것들(차트·메모). inner 좌표계 기준 absolute */
  overlay?: ReactNode;
  className?: string;
  scrollRef?: React.Ref<HTMLDivElement>;
}

const DEFAULT_ROW_H = 24;
const COLHEAD_H = 24;

/**
 * 머리글 + 배경 격자 + 칸 슬롯. 데이터는 모른다 — renderCell 이 칸을 그린다.
 * 항상 세로·가로 스크롤바 공간을 가진다(overflow: scroll) — 레이어가 바뀌어도 폭이 변하지 않게.
 */
export const SheetGrid = forwardRef<HTMLDivElement, SheetGridProps>(function SheetGrid(props, ref) {
  const {
    label, colWidths, rowCount, rowHeight, rowKind, selected, range, readOnly, pick, pickedCols, pickedRows,
    onPickCol, onPickRow, frozen, merges, renderCell, activeId, gridlines = true, tabIndex = 0, gridFocus, onKeyDown, overlay, className, scrollRef,
  } = props;

  const mergeAt = new Map<string, GridMerge>();
  const covered = new Set<string>();
  for (const m of merges ?? []) {
    mergeAt.set(`${m.c},${m.r}`, m);
    for (let k = 1; k < m.cols; k++) covered.add(`${m.c + k},${m.r}`);
  }

  const sel = range ?? (selected ? { c0: selected.c, r0: selected.r, c1: selected.c, r1: selected.r } : null);
  const selCols = sel ? Array.from({ length: sel.c1 - sel.c0 + 1 }, (_, i) => sel.c0 + i) : [];
  const selRows = sel ? new Set(Array.from({ length: sel.r1 - sel.r0 + 1 }, (_, i) => sel.r0 + i)) : new Set<number>();

  const hOf = (r: number) => rowHeight?.(r) ?? DEFAULT_ROW_H;
  let top = COLHEAD_H;

  const rows: ReactNode[] = [];
  for (let r = 0; r < rowCount; r++) {
    const h = hOf(r);
    const isFrozen = !!frozen && r < frozen.rows;
    const style: CSSProperties = { height: h };
    if (isFrozen) style.top = top;
    top += h;
    const cells: ReactNode[] = [];
    for (let c = 0; c < colWidths.length; c++) {
      if (covered.has(`${c},${r}`)) continue;
      const m = mergeAt.get(`${c},${r}`);
      // 폭 0 = 숨긴 열(모바일 4열). 단 병합의 시작 열이 숨었고 병합 안에 보이는 열이 남아 있으면, 병합 칸을 그 첫 보이는 열 자리에
      // 그린다(내용 = 시작 칸). 예전에는 병합째 건너뛰어 모바일 숨기기 시트 1~2행 제목이 비었다(BUG-18).
      const hidden = colWidths[c] === 0;
      if (hidden && !(m && Array.from({ length: m.cols - 1 }, (_, k) => colWidths[c + 1 + k]).some((cw) => cw !== 0 && cw !== undefined))) continue;
      let w: number | string | undefined = colWidths[c] ?? undefined;
      if (m) {
        let fixed = 0;
        let flex = 0;
        for (let k = 0; k < m.cols; k++) {
          const cw = colWidths[c + k];
          if (cw === 0 || cw === undefined) continue;
          if (cw) fixed += cw;
          else flex += 1;
        }
        w = flex ? `calc(${fixed}px + ${flex} * var(--mc-cell-w))` : fixed;
      }
      cells.push(
        <RenderSlot key={c} node={renderCell(c, r, { w, freezeCol: !hidden && !!frozen && frozen.cols === 1 && c === 0, rowKind: rowKind?.(r) })} />,
      );
    }
    rows.push(
      <div
        key={r}
        role="row"
        aria-rowindex={r + 2}
        className="mc-row"
        style={style}
        data-frozen={isFrozen ? 'true' : undefined}
        data-freeze-end={isFrozen && frozen && r === frozen.rows - 1 ? 'true' : undefined}
      >
        <RowHead
          row={r}
          height={h}
          selected={selRows.has(r)}
          readOnly={readOnly}
          pickable={!!pick?.rows}
          picked={pickedRows?.includes(r)}
          onPick={onPickRow}
        />
        {cells}
      </div>,
    );
  }

  return (
    <div
      ref={ref}
      className={cx('mc-grid', className)}
      role="grid"
      aria-label={label}
      aria-rowcount={rowCount + 1}
      aria-colcount={colWidths.length}
      aria-activedescendant={activeId}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      data-gridlines={gridlines ? 'on' : 'off'}
      data-mc-grid-focus={gridFocus ? '' : undefined}
    >
      <div className="mc-grid__scroll" ref={scrollRef}>
        <div className="mc-grid__inner">
          <ColHeaders
            widths={colWidths}
            selected={selCols}
            readOnly={readOnly}
            pickable={!!pick?.cols}
            picked={pickedCols}
            onPick={onPickCol}
          />
          {rows}
          {overlay}
        </div>
      </div>
    </div>
  );
});

function RenderSlot({ node }: { node: ReactNode }) {
  return <>{node}</>;
}
