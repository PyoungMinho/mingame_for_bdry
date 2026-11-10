import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import type { RangeEdges } from '@/lib/monthly-close/sheet/sheet-model';
import { cx } from './cx';

/** 게임판 셀 상태. 선택·범위·호버·잠김은 상태가 아니라 겹치는 표시라 별도 prop. */
export type CellState = 'empty' | 'mine' | 'miss' | 'hit' | 'sunk' | 'reveal';
export const CELL_STATES: readonly CellState[] = ['empty', 'mine', 'miss', 'hit', 'sunk', 'reveal'];

/** 선택 테두리 색: active = 파랑, readonly = 회색(읽기 전용 창), locked = 회색(서버 대기·이미 검토한 칸) */
export type SelectionTone = 'active' | 'readonly' | 'locked';
export type MemoKind = 'miss' | 'hit' | 'sunk' | 'note';
export type CellTone = 'head' | 'label' | 'faint' | 'bold' | 'error' | 'title' | 'sub';

const STATE_WORD: Record<CellState, string> = {
  empty: '',
  mine: '내 항목',
  miss: '해당 없음',
  hit: '반려',
  sunk: '종결',
  reveal: '공개',
};

export interface CellProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** "B7" — aria-label 과 data-addr 에 쓴다 */
  addr: string;
  state?: CellState;
  /** 칸 글자. 상대 시트 빗나감 `0`, 명중 `1`, 침몰·내 항목은 짧은 이름 */
  label?: ReactNode;
  /** 내 시트에서 맞은 칸(반려): 짧은 이름에 취소선 */
  strike?: boolean;
  selected?: boolean;
  selectionTone?: SelectionTone;
  /** 쏠 수 있는 창에서만 true (호버 색 + cell 커서) */
  hoverable?: boolean;
  /** 범위 점선이 그려질 변. null/undefined = 범위 밖 */
  range?: (RangeEdges & { bad?: boolean }) | null;
  /** 메모 삼각형 종류. 없으면 안 그림 */
  memo?: MemoKind | null;
  /** px 또는 CSS 길이(병합 칸). 생략하면 --mc-cell-w */
  w?: number | string;
  align?: 'left' | 'center' | 'right';
  tone?: CellTone;
  neg?: boolean;
  /** 숨기기 시트 조건부 서식 */
  cf?: 'bad' | 'warn' | 'good' | 'bar' | null;
  /** 데이터 막대(0~100) */
  barPct?: number | null;
  rowKind?: string;
  freezeCol?: boolean;
  /** 정지 화면(샘플러)에서 호버 모양을 고정해서 보이기 */
  demoHover?: boolean;
  /** 스크린리더 문구 덮어쓰기 (기본: `${addr}, ${상태 낱말}`) */
  ariaLabel?: string;
  children?: ReactNode;
}

/**
 * 셀 한 칸. 선택 표시는 box-shadow 가 아니라 outline(전역 포커스 규칙이 box-shadow 를 지운다).
 * 상태 8종 = empty·mine·miss·hit·sunk·reveal(+ hover = hoverable, locked = selectionTone) + 선택·범위.
 */
export const Cell = forwardRef<HTMLDivElement, CellProps>(function Cell(
  {
    addr,
    state = 'empty',
    label,
    strike,
    selected,
    selectionTone = 'active',
    hoverable = false,
    range,
    memo,
    w,
    align,
    tone,
    neg,
    cf,
    barPct,
    rowKind,
    freezeCol,
    ariaLabel,
    demoHover,
    children,
    className,
    style,
    ...rest
  },
  ref,
) {
  const word = STATE_WORD[state];
  const textLabel = typeof label === 'string' || typeof label === 'number' ? String(label) : '';
  const aria =
    ariaLabel ?? (word ? `${addr}, ${word}` : textLabel ? `${addr}, ${textLabel}` : addr);
  const rangeAttr = range ? ['t', 'b', 'l', 'r'].filter((k) => range[k as keyof RangeEdges]).concat(range.bad ? ['bad'] : []).join(' ') || 'in' : undefined;
  const st: CSSProperties = { ...style };
  if (w !== undefined) st.width = w;
  if (barPct != null) (st as Record<string, string>)['--p'] = `${barPct}%`;

  return (
    <div
      {...rest}
      ref={ref}
      role="gridcell"
      aria-label={aria}
      aria-selected={selected ? true : undefined}
      className={cx('mc-cell', className)}
      style={st}
      data-addr={addr}
      data-state={state}
      data-hoverable={hoverable ? 'true' : 'false'}
      data-tone-sel={selected ? selectionTone : undefined}
      data-range={rangeAttr}
      data-memo={memo ?? undefined}
      data-align={align}
      data-tone={tone}
      data-neg={neg ? 'true' : undefined}
      data-cf={cf ?? undefined}
      data-bar={barPct != null ? '' : undefined}
      data-demo={demoHover ? 'hover' : undefined}
      data-row-kind={rowKind}
      data-freeze-col={freezeCol ? 'true' : undefined}
    >
      {children !== undefined ? (
        children
      ) : label !== undefined && label !== '' ? (
        <span className={cx('mc-cell__text', strike && 'mc-cell__strike')}>{label}</span>
      ) : null}
      {memo ? <MemoTriangle kind={memo} /> : null}
      {selected && selectionTone === 'active' ? <span className="mc-handle" aria-hidden="true" /> : null}
    </div>
  );
});

/** 셀 오른쪽 위 메모 삼각형 (변 6px). 해당 없음 회색 · 반려/종결 빨강 · 의견 파랑. */
export function MemoTriangle({ kind }: { kind: MemoKind }) {
  return <span className="mc-tri" data-kind={kind} aria-hidden="true" />;
}
