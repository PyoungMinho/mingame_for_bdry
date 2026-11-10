import { colName } from '@/lib/monthly-close/coords';
import { cx } from './cx';

export type PickMode = 'col' | 'row' | null;

export interface ColHeadersProps {
  /** 열 폭(px). null = 기본 칸 폭 */
  widths: readonly (number | null)[];
  /** 선택된 열 인덱스들 (파랑 강조) */
  selected?: readonly number[];
  /** 읽기 전용 창이면 강조선이 회색 */
  readOnly?: boolean;
  /** 힌트 범위 고르기 중이면 true: 호버 강조 + s-resize 커서 */
  pickable?: boolean;
  /** 힌트로 이미 고른 열 */
  picked?: readonly number[];
  onPick?: (col: number) => void;
}

/** 열 머리글 줄 (왼쪽 모서리 포함). sticky 로 위에 붙는다. */
export function ColHeaders({ widths, selected = [], readOnly, pickable, picked = [], onPick }: ColHeadersProps) {
  return (
    <div className="mc-colheads" role="row" aria-rowindex={1}>
      <div className="mc-corner" aria-hidden="true" />
      {widths.map((w, c) => w === 0 ? null : (
        <div
          key={c}
          role="columnheader"
          aria-colindex={c + 1}
          className={cx('mc-hcell')}
          style={w ? { width: w } : undefined}
          data-selected={selected.includes(c) ? 'true' : undefined}
          data-readonly={readOnly ? 'true' : undefined}
          data-pick={pickable ? 'col' : undefined}
          data-picked={picked.includes(c) ? 'true' : undefined}
          data-col={colName(c)}
          onClick={pickable && onPick ? () => onPick(c) : undefined}
        >
          {colName(c)}
        </div>
      ))}
    </div>
  );
}

export interface RowHeadProps {
  row: number; // 0기준
  height?: number;
  selected?: boolean;
  readOnly?: boolean;
  pickable?: boolean;
  picked?: boolean;
  onPick?: (row: number) => void;
}

/** 행 머리글 한 칸. 왼쪽에 sticky. */
export function RowHead({ row, height, selected, readOnly, pickable, picked, onPick }: RowHeadProps) {
  return (
    <div
      role="rowheader"
      className="mc-rowhead"
      style={height ? { height } : undefined}
      data-selected={selected ? 'true' : undefined}
      data-readonly={readOnly ? 'true' : undefined}
      data-pick={pickable ? 'row' : undefined}
      data-picked={picked ? 'true' : undefined}
      onClick={pickable && onPick ? () => onPick(row) : undefined}
    >
      {row + 1}
    </div>
  );
}
