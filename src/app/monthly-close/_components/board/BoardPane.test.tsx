// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BoardPane } from './BoardPane';
import { hintResultExtras, itemsExtras, placementExtras, reviewExtras } from './tables';
import { merge } from './extras';
import { changeLogExtras } from '../overlays/ChangeLog';
import { quizExtras } from '../overlays/QuizSheet';

const cell = (addr: string) => document.querySelector(`[data-addr="${addr}"]`) as HTMLElement;

describe('BoardPane', () => {
  it('A1:H8 판 + I열·9행, 상태가 칸에 반영된다', () => {
    render(
      <BoardPane
        label="상대 시트"
        idPrefix="t"
        cells={{ B2: { state: 'miss', label: '0', memo: 'miss' }, C3: { state: 'hit', label: '1', memo: 'hit' }, D4: { state: 'sunk', label: '법카' } }}
        extras={hintResultExtras({ cols: { E: 2 }, rows: { 3: 1 } })}
        selected={{ c: 1, r: 1 }}
        fireable
      />,
    );
    expect(cell('B2').dataset.state).toBe('miss');
    expect(cell('B2').getAttribute('aria-label')).toBe('B2, 해당 없음');
    expect(cell('B2').getAttribute('aria-selected')).toBe('true');
    expect(cell('C3').getAttribute('aria-label')).toBe('C3, 반려');
    expect(cell('D4').textContent).toBe('법카');
    expect(cell('E9').textContent).toBe('2');
    expect(cell('I3').textContent).toBe('1');
    expect(cell('A1').dataset.hoverable).toBe('true');
    // 판 안 64칸 + 열 머리글 9개(A~I)
    expect(screen.getAllByRole('columnheader')).toHaveLength(9);
    expect(screen.getByRole('grid', { name: '상대 시트' }).getAttribute('aria-activedescendant')).toBe('t-B2');
  });

  it('읽기 전용 창은 호버 없음', () => {
    render(<BoardPane label="내 시트" idPrefix="m" cells={{}} readOnly />);
    expect(cell('A1').dataset.hoverable).toBe('false');
  });

  it('칸 클릭·더블클릭·마우스다운 콜백에 주소가 간다', () => {
    const down = vi.fn();
    const click = vi.fn();
    render(<BoardPane label="x" idPrefix="x" cells={{}} onCellMouseDown={down} onCellClick={click} />);
    fireEvent.mouseDown(cell('C5'));
    fireEvent.click(cell('C5'));
    expect(down.mock.calls[0][0]).toBe('C5');
    expect(click).toHaveBeenCalledWith('C5');
  });

  it('내 시트에서 맞은 칸: 이름에 취소선', () => {
    render(<BoardPane label="x" idPrefix="x" cells={{ A1: { state: 'hit', label: '법카', strike: true } }} />);
    expect(cell('A1').querySelector('.mc-cell__strike')).not.toBeNull();
  });

  it('힌트 고르기: 열 머리글 클릭 → onPickCol, 행 머리글 → onPickRow', () => {
    const col = vi.fn();
    const row = vi.fn();
    render(<BoardPane label="x" idPrefix="x" cells={{}} pick={{ cols: true, rows: true }} onPickCol={col} onPickRow={row} />);
    fireEvent.click(screen.getAllByRole('columnheader')[4]);
    expect(col).toHaveBeenCalledWith(4);
    fireEvent.click(screen.getAllByRole('rowheader')[2]);
    expect(row).toHaveBeenCalledWith(2);
  });

  it('범위 점선은 바깥 변에만', () => {
    render(<BoardPane label="x" idPrefix="x" cells={{}} range={{ c0: 1, r0: 1, c1: 3, r1: 3 }} />);
    expect(cell('B2').dataset.range).toBe('t l');
    expect(cell('C3').dataset.range).toBe('in');
    expect(cell('D4').dataset.range).toBe('b r');
    expect(cell('A1').dataset.range).toBeUndefined();
  });
});

describe('판 아래 표', () => {
  it('항목 표: 10 머리 + 3줄, 이름 A~C 병합', () => {
    render(
      <BoardPane
        label="x"
        idPrefix="x"
        cells={{}}
        extras={itemsExtras({ heads: ['항목', '칸', '상태'], items: [{ name: '법카', cells: 4, status: '정상' }, { name: '출장비', cells: 3, status: '1건 반려' }, { name: '택시', cells: 2, status: '종결' }] })}
      />,
    );
    expect(cell('A10').textContent).toBe('항목');
    expect(cell('D11').textContent).toBe('4');
    expect(cell('E12').textContent).toBe('1건 반려');
    expect(cell('A13').textContent).toBe('택시');
    // 병합된 칸(B10, C10)은 그리지 않는다
    expect(cell('B10')).toBeNull();
    expect(cell('A10').style.width).toBe('calc(0px + 3 * var(--mc-cell-w))');
  });

  it('배치 표: 15행 버튼이 data-mc-cmd, 16행 경보 줄', () => {
    const auto = vi.fn();
    render(
      <BoardPane
        label="x"
        idPrefix="x"
        cells={{}}
        extras={placementExtras({
          title: '배치 표',
          heads: ['항목', '칸', '상태'],
          items: [{ name: '부장님 법카 내역', cells: 4, status: '미배치' }, { name: '출장비', cells: 3, status: '미배치' }, { name: '택시', cells: 2, status: '미배치' }],
          autoLabel: '자동 배치',
          doneLabel: '배치 완료',
          doneDisabled: true,
          onAuto: auto,
          alarmLine: '결재 경보: 포함',
        })}
      />,
    );
    expect(cell('A10').textContent).toBe('배치 표');
    expect(cell('A12').textContent).toBe('부장님 법카 내역');
    const btn = cell('A15').querySelector('button') as HTMLButtonElement;
    expect(btn.dataset.mcCmd).toBe('auto-place');
    fireEvent.click(btn);
    expect(auto).toHaveBeenCalledTimes(1);
    expect((cell('E15').querySelector('button') as HTMLButtonElement).disabled).toBe(true);
    expect(cell('A16').textContent).toBe('결재 경보: 포함');
  });

  it('변경 내역(왼쪽 창): 최신 2건만', () => {
    render(
      <BoardPane
        label="x"
        idPrefix="x"
        cells={{}}
        extras={changeLogExtras(['시각', '범위', '내용'], [{ time: '14:31', range: 'A1:A8', note: '행 검토' }, { time: '14:32', range: 'E1:E8', note: '열 검토' }, { time: '14:33', range: 'C3:E5', note: '영역 검토' }])}
      />,
    );
    expect(cell('A15').textContent).toBe('시각');
    expect(cell('A16').textContent).toBe('14:32');
    expect(cell('A17').textContent).toBe('14:33');
    expect(cell('E17').textContent).toBe('영역 검토');
  });

  it('검토 의견(오른쪽 창)', () => {
    render(<BoardPane label="x" idPrefix="x" cells={{}} extras={merge(reviewExtras(['범위', '값', '시각'], [{ range: 'B3:D5', value: '2', time: '14:30' }]))} />);
    expect(cell('A16').textContent).toBe('B3:D5');
    expect(cell('C16').textContent).toBe('2');
  });
});

describe('검산 표 (QuizSheet)', () => {
  const base = {
    label: '팀장님 이번 주 아아 결제 합계',
    remain: '00:07',
    heads: ['건명', '1건', '2건', '3건'],
    unit: '(단위: 만원)' as string | null,
    valueLabel: '금액',
    values: ['47', '38', '21'],
    rowLabel: '합계',
    inputHint: 'Enter로 확정',
  };
  const input = (o: Partial<{ wrong: boolean; locked: boolean; value: string }> = {}) => ({
    value: '',
    placeholder: 'Enter로 확정',
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    ariaLabel: '합계 입력',
    ...o,
  });

  it('10~13행 구성: 라벨 7칸 병합, 남은 시간 H10, 단위 G11:H11, 입력 B13:D13', () => {
    render(<BoardPane label="x" idPrefix="x" cells={{}} extras={quizExtras({ ...base, input: input() })} />);
    expect(cell('A10').textContent).toBe(base.label);
    expect(cell('A10').style.width).toContain('7 *');
    expect(cell('H10').textContent).toBe('00:07');
    expect(cell('B11').textContent).toBe('1건');
    expect(cell('G11').textContent).toBe('(단위: 만원)');
    expect(cell('B12').textContent).toBe('47');
    expect(cell('A13').textContent).toBe('합계');
    expect(cell('E13').textContent).toBe('Enter로 확정');
    expect(cell('B13').querySelector('input')).not.toBeNull();
  });

  it('unit 이 null 이면 단위 칸 비움 (인사 합계)', () => {
    render(<BoardPane label="x" idPrefix="x" cells={{}} extras={quizExtras({ ...base, unit: null, input: input() })} />);
    expect(cell('G11').textContent).toBe('');
  });

  it('Enter 로 제출, 한글 조합 중 Enter 와 Tab 은 제출하지 않는다', () => {
    const inp = input();
    render(<BoardPane label="x" idPrefix="x" cells={{}} extras={quizExtras({ ...base, input: inp })} />);
    const el = screen.getByLabelText('합계 입력') as HTMLInputElement;
    fireEvent.change(el, { target: { value: '106' } });
    expect(inp.onChange).toHaveBeenCalledWith('106');
    fireEvent.keyDown(el, { key: 'Tab' });
    fireEvent.keyDown(el, { key: 'Enter', isComposing: true });
    expect(inp.onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(el, { key: 'Enter' });
    expect(inp.onSubmit).toHaveBeenCalledWith('');
  });

  it('오답: #VALUE! 표시 + 입력 잠금(제출 안 됨)', () => {
    const inp = input({ wrong: true });
    render(<BoardPane label="x" idPrefix="x" cells={{}} extras={quizExtras({ ...base, input: inp })} />);
    const el = screen.getByLabelText('합계 입력') as HTMLInputElement;
    expect(el.value).toBe('#VALUE!');
    expect(el.readOnly).toBe(true);
    expect(cell('B13').dataset.tone).toBe('error');
    fireEvent.keyDown(el, { key: 'Enter' });
    expect(inp.onSubmit).not.toHaveBeenCalled();
  });
});
