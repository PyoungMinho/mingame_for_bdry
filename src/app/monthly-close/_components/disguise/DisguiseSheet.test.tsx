// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DISGUISE_FIXTURES } from '@/lib/monthly-close/sheet/disguise-fixtures';
import type { DisguiseKind } from '@/lib/monthly-close/sheet/disguise';
import { DisguiseSheet } from './DisguiseSheet';
import { DecoSheet } from './DecoSheet';
import { useDisguiseSheet } from './useDisguiseSheet';
import { FormulaBar } from '../sheet/Chrome';

function Harness({ kind, mobile }: { kind: DisguiseKind; mobile?: boolean }) {
  const k = useDisguiseSheet(DISGUISE_FIXTURES[kind], { seed: 'room-1:abcd', asOf: '2026-11-07' });
  return (
    <>
      <FormulaBar {...k.formulaBar} />
      <DisguiseSheet controller={k} label="손익" filterLeft="보기: 기본 │ 필터: 없음 │ 정렬: 없음" filterRight="마지막 저장 14:32" mobile={mobile} />
    </>
  );
}

const cell = (addr: string) => document.querySelector(`[data-addr="${addr}"]`) as HTMLElement;
const grid = () => screen.getByRole('grid', { name: '손익' });

describe('DisguiseSheet', () => {
  it('30행 틀: 제목·머리·합계 렌더, 첫 선택 칸 D4, 수식 입력줄에 값', () => {
    render(<Harness kind="accounting" />);
    expect(cell('A1').textContent).toBe('계정별 결산 대비표');
    expect(cell('B3').textContent).toBe('계정과목');
    expect(cell('B17').textContent).toBe('합계');
    expect(cell('D4').getAttribute('aria-selected')).toBe('true');
    expect((screen.getByLabelText('이름 상자') as HTMLInputElement).value).toBe('D4');
    expect((screen.getByLabelText('수식 입력줄') as HTMLInputElement).value).toMatch(/^\d+$/);
    expect(screen.getByText('마지막 저장 14:32')).toBeTruthy();
    expect(document.querySelector('.mc-disguise-chart')).not.toBeNull();
  });

  it('인사는 F4 에서 시작', () => {
    render(<Harness kind="hr" />);
    expect(cell('F4').getAttribute('aria-selected')).toBe('true');
  });

  it('방향키 이동 → 이름 상자·수식 입력줄 갱신, 계산 칸은 수식', () => {
    render(<Harness kind="accounting" />);
    fireEvent.keyDown(grid(), { key: 'ArrowRight' });
    expect(cell('E4').getAttribute('aria-selected')).toBe('true');
    expect((screen.getByLabelText('이름 상자') as HTMLInputElement).value).toBe('E4');
    expect((screen.getByLabelText('수식 입력줄') as HTMLInputElement).value).toBe('=D4-C4');
  });

  it('숫자 입력 → Enter 로 확정하면 증감·소계·합계가 다시 계산된다', () => {
    render(<Harness kind="accounting" />);
    const sub = cell('D10').textContent;
    fireEvent.keyDown(grid(), { key: '9' });
    const input = document.querySelector('.mc-cell__input') as HTMLInputElement;
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { value: '99999' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(document.querySelector('.mc-cell__input')).toBeNull();
    expect(cell('D4').textContent).toBe('99,999');
    expect(cell('D10').textContent).not.toBe(sub);
    expect(cell('D5').getAttribute('aria-selected')).toBe('true');
  });

  it('ESC 는 편집 취소만 — 값이 바뀌지 않는다', () => {
    render(<Harness kind="accounting" />);
    const before = cell('D4').textContent;
    fireEvent.keyDown(grid(), { key: '5' });
    const input = document.querySelector('.mc-cell__input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(document.querySelector('.mc-cell__input')).toBeNull();
    expect(cell('D4').textContent).toBe(before);
  });

  it('Tab 은 다음 칸 (게임으로 돌아가지 않고 같은 시트에 머문다)', () => {
    render(<Harness kind="accounting" />);
    fireEvent.keyDown(grid(), { key: 'Tab' });
    expect(cell('E4').getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(grid(), { key: 'Tab', shiftKey: true });
    expect(cell('D4').getAttribute('aria-selected')).toBe('true');
  });

  it('계산 칸에서 글자를 쳐도 편집이 시작되지 않는다(보호 셀)', () => {
    render(<Harness kind="accounting" />);
    fireEvent.keyDown(grid(), { key: 'ArrowRight' }); // E4 = 증감(계산)
    fireEvent.keyDown(grid(), { key: '7' });
    expect(document.querySelector('.mc-cell__input')).toBeNull();
  });

  it('이름 상자에 좌표를 쳐서 이동', () => {
    render(<Harness kind="sales" />);
    const box = screen.getByLabelText('이름 상자');
    fireEvent.change(box, { target: { value: 'c9' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(cell('C9').getAttribute('aria-selected')).toBe('true');
  });

  it('클릭으로 선택, 더블클릭으로 편집', () => {
    render(<Harness kind="accounting" />);
    fireEvent.mouseDown(cell('C6'));
    expect(cell('C6').getAttribute('aria-selected')).toBe('true');
    fireEvent.doubleClick(cell('C6'));
    expect(document.querySelector('.mc-cell__input')).not.toBeNull();
  });

  it('틀 고정: 1~3행 sticky, 3행이 고정선 끝', () => {
    render(<Harness kind="accounting" />);
    const frozen = grid().querySelectorAll('.mc-row[data-frozen="true"]');
    expect(frozen).toHaveLength(3);
    expect(grid().querySelector('.mc-row[data-freeze-end="true"]')?.getAttribute('aria-rowindex')).toBe('4');
    expect(cell('A5').dataset.freezeCol).toBe('true');
  });

  it('조건부 서식이 data-cf 로 나온다 (영업 달성률)', () => {
    render(<Harness kind="sales" />);
    const cfs = [...document.querySelectorAll('[data-cf]')].map((e) => e.getAttribute('data-cf'));
    expect(cfs.length).toBeGreaterThan(0);
  });

  it('모바일: 4열만 보이고 차트·편집 없음', () => {
    render(<Harness kind="accounting" mobile />);
    const heads = [...grid().querySelectorAll('[role="columnheader"]')].map((h) => h.textContent).slice(0, 4);
    expect(heads).toEqual(['B', 'C', 'D', 'E']);
    expect(document.querySelector('.mc-disguise-chart')).toBeNull();
    fireEvent.doubleClick(cell('D4'));
    expect(document.querySelector('.mc-cell__input')).toBeNull();
  });
});

describe('DecoSheet', () => {
  it('제목·머리·메모 6줄, 선택 이동, 선택 알림', () => {
    const seen: string[] = [];
    render(
      <DecoSheet
        label="비고"
        title="업무 메모"
        headers={['일자', '내용', '담당']}
        rows={Array.from({ length: 6 }, (_, i) => ({ date: `2026-10-0${i + 1}`, memo: `메모 ${i + 1}`, owner: 'AC-1' }))}
        filterLeft="보기: 기본"
        filterRight="마지막 저장 14:32"
        onSelect={(a) => seen.push(a)}
      />,
    );
    expect(cell('A1').textContent).toBe('업무 메모');
    expect(cell('B2').textContent).toBe('내용');
    expect(cell('B3').textContent).toBe('메모 1');
    fireEvent.keyDown(screen.getByRole('grid', { name: '비고' }), { key: 'ArrowDown' });
    expect(seen).toEqual(['B3', 'B4']);
    // 글자를 쳐도 편집이 시작되지 않는다
    fireEvent.keyDown(screen.getByRole('grid', { name: '비고' }), { key: 'x' });
    expect(document.querySelector('.mc-cell__input')).toBeNull();
  });
});
