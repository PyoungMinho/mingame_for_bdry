// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Cell, CELL_STATES } from './Cell';
import { CellStateSampler, CELL_SAMPLES, SAMPLED_STATES } from './CellStateSampler';
import { SheetGrid } from './SheetGrid';

const cellOf = (c: HTMLElement) => c.querySelector('[role="gridcell"]') as HTMLElement;

describe('Cell 상태 렌더', () => {
  it.each([
    ['empty', undefined, 'B7'],
    ['mine', '법카', 'B7, 내 항목'],
    ['miss', '0', 'B7, 해당 없음'],
    ['hit', '1', 'B7, 반려'],
    ['sunk', '법카', 'B7, 종결'],
    ['reveal', '법카', 'B7, 공개'],
  ] as const)('%s: data-state·aria-label', (state, label, aria) => {
    const { container } = render(<Cell addr="B7" state={state} label={label} />);
    const el = cellOf(container);
    expect(el.dataset.state).toBe(state);
    expect(el.getAttribute('aria-label')).toBe(aria);
    if (label) expect(el.textContent).toBe(label);
  });

  it('상태 종류가 전부 샘플러에 나온다', () => {
    const used = new Set(CELL_SAMPLES.map((s) => s.props.state));
    for (const st of SAMPLED_STATES) expect(used.has(st)).toBe(true);
    expect(CELL_STATES).toHaveLength(6);
    const { container } = render(<CellStateSampler />);
    expect(container.querySelectorAll('[role="gridcell"]')).toHaveLength(CELL_SAMPLES.length);
  });

  it('선택: aria-selected + 핸들, 읽기 전용·잠김이면 핸들 없음', () => {
    const a = render(<Cell addr="A1" selected />);
    expect(cellOf(a.container).getAttribute('aria-selected')).toBe('true');
    expect(cellOf(a.container).dataset.toneSel).toBe('active');
    expect(a.container.querySelector('.mc-handle')).not.toBeNull();
    const b = render(<Cell addr="A1" selected selectionTone="readonly" />);
    expect(b.container.querySelector('.mc-handle')).toBeNull();
    expect(cellOf(b.container).dataset.toneSel).toBe('readonly');
    const c = render(<Cell addr="A1" selected selectionTone="locked" />);
    expect(c.container.querySelector('.mc-handle')).toBeNull();
  });

  it('선택 안 하면 aria-selected 속성이 없다', () => {
    const { container } = render(<Cell addr="A1" />);
    expect(cellOf(container).hasAttribute('aria-selected')).toBe(false);
  });

  it('반려(내 시트)는 짧은 이름에 취소선, 메모 삼각형은 종류별', () => {
    const { container } = render(<Cell addr="C3" state="hit" label="법카" strike memo="hit" />);
    expect(container.querySelector('.mc-cell__strike')?.textContent).toBe('법카');
    expect(container.querySelector('.mc-tri')?.getAttribute('data-kind')).toBe('hit');
  });

  it('호버 가능 여부와 범위 변', () => {
    const a = render(<Cell addr="A1" hoverable />);
    expect(cellOf(a.container).dataset.hoverable).toBe('true');
    const b = render(<Cell addr="A1" range={{ t: true, b: false, l: true, r: false, bad: true }} />);
    expect(cellOf(b.container).dataset.range).toBe('t l bad');
  });

  it('클릭 이벤트 전달, style 병합', () => {
    let n = 0;
    const { container } = render(<Cell addr="A1" w={96} onClick={() => n++} style={{ color: 'red' }} />);
    fireEvent.click(cellOf(container));
    expect(n).toBe(1);
    expect(cellOf(container).style.width).toBe('96px');
  });

  it('기능 없이 box-shadow 로 상태를 그리지 않는다(inline style 없음)', () => {
    const { container } = render(<Cell addr="A1" state="sunk" label="x" selected />);
    expect(cellOf(container).getAttribute('style') ?? '').not.toMatch(/box-shadow/);
  });
});

describe('SheetGrid', () => {
  it('열·행 머리글, 선택된 열·행 강조, 폭 0 열은 숨김', () => {
    render(
      <SheetGrid
        label="내 시트"
        colWidths={[null, 0, null]}
        rowCount={3}
        selected={{ c: 2, r: 1 }}
        renderCell={(c, r, ctx) => <Cell key={c} addr={`${'ABC'[c]}${r + 1}`} w={ctx.w} />}
      />,
    );
    const grid = screen.getByRole('grid', { name: '내 시트' });
    const heads = [...grid.querySelectorAll('[role="columnheader"]')].map((h) => h.textContent);
    expect(heads).toEqual(['A', 'C']);
    expect(grid.querySelector('[role="columnheader"][data-selected="true"]')?.textContent).toBe('C');
    expect(grid.querySelector('[role="rowheader"][data-selected="true"]')?.textContent).toBe('2');
    expect(grid.querySelectorAll('[role="gridcell"]')).toHaveLength(6);
  });

  it('병합: 덮인 칸은 안 그리고 폭을 합친다', () => {
    const seen: string[] = [];
    render(
      <SheetGrid
        label="x"
        colWidths={[40, 40, 40]}
        rowCount={1}
        merges={[{ c: 0, r: 0, cols: 2 }]}
        renderCell={(c, r, ctx) => {
          seen.push(`${c}:${ctx.w}`);
          return <Cell key={c} addr={`A${c}`} w={ctx.w} />;
        }}
      />,
    );
    expect(seen).toEqual(['0:80', '2:40']);
  });

  it('힌트 고르기: 머리글 클릭이 onPick 으로 간다', () => {
    const picked: number[] = [];
    render(
      <SheetGrid
        label="x"
        colWidths={[null, null]}
        rowCount={1}
        pick={{ cols: true }}
        onPickCol={(c) => picked.push(c)}
        renderCell={(c) => <Cell key={c} addr="A1" />}
      />,
    );
    fireEvent.click(screen.getAllByRole('columnheader')[1]);
    expect(picked).toEqual([1]);
    expect(screen.getAllByRole('columnheader')[0].getAttribute('data-pick')).toBe('col');
  });
});
