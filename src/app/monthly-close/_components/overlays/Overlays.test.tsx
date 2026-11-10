// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AlarmToast, ConfirmPopover, Dropdown, InlineDialog, Toast } from './Popovers';
import { TauntPicker } from './TauntPicker';
import { HintPicker, hintPreview } from './HintPicker';
import { Button, Checkbox, RadioRow, SegmentedChoice, TextInput } from '../form/controls';

describe('AlarmToast', () => {
  it('role=alert, [Tab] 칩, 클릭 = 활성화', () => {
    const on = vi.fn();
    render(<AlarmToast text="결재 요청 1건이 도착했습니다." onActivate={on} />);
    const t = screen.getByRole('alert');
    expect(t.textContent).toContain('결재 요청 1건이 도착했습니다.');
    expect(t.querySelector('.mc-chip')?.textContent).toBe('Tab');
    expect(t.getAttribute('data-mc-cmd')).toBe('alarm');
    fireEvent.click(t);
    expect(on).toHaveBeenCalledTimes(1);
  });
  it('모바일 칩은 [전환]', () => {
    render(<AlarmToast text="x" chip="전환" onActivate={() => {}} />);
    expect(screen.getByRole('alert').querySelector('.mc-chip')?.textContent).toBe('전환');
  });
});

describe('TauntPicker / Dropdown', () => {
  it('쿨다운 항목은 disabled + 보조 글자, 선택하면 id 숫자', () => {
    const pick = vi.fn();
    render(
      <TauntPicker
        label="의견 남기기"
        onPick={pick}
        activeIndex={1}
        items={[
          { id: 0, label: '확인 부탁드립니다^^' },
          { id: 1, label: '회신 기다리겠습니다', aside: '2회차 뒤 가능', disabled: true },
        ]}
      />,
    );
    const items = screen.getAllByRole('menuitem');
    expect((items[1] as HTMLButtonElement).disabled).toBe(true);
    expect(items[1].textContent).toContain('2회차 뒤 가능');
    expect(items[1].getAttribute('data-active')).toBe('true');
    expect(items[0].getAttribute('data-mc-cmd')).toBe('taunt:0');
    fireEvent.click(items[0]);
    expect(pick).toHaveBeenCalledWith(0);
  });

  it('dropdown 은 title 속성을 쓰지 않는다', () => {
    const { container } = render(<Dropdown items={[{ id: 'a', label: 'A' }]} onPick={() => {}} cmdPrefix="x" label="x" />);
    expect(container.querySelector('[title]')).toBeNull();
  });
});

describe('HintPicker', () => {
  it('미리보기 수식: 열·행·3×3(가장자리는 안쪽으로)', () => {
    expect(hintPreview({ kind: 'col', col: 'E' })).toEqual({ name: 'E1:E8', formula: '=COUNTIF(E1:E8,">0")' });
    expect(hintPreview({ kind: 'row', row: 3 }).name).toBe('A3:H3');
    expect(hintPreview({ kind: 'block', cell: 'A1' }).name).toBe('A1:C3');
    expect(hintPreview({ kind: 'block', cell: 'C4' }).name).toBe('B3:D5');
  });
  it('고르기 방식 드롭다운', () => {
    const on = vi.fn();
    render(<HintPicker label="범위" labels={{ col: '열', row: '행', block: '칸' }} active="row" onChoose={on} />);
    expect(screen.getByRole('menuitem', { name: '✓ 행' })).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: '열' }));
    expect(on).toHaveBeenCalledWith('col');
  });
});

describe('팝오버·대화상자·토스트', () => {
  it('확인 팝오버: 위험 버튼 variant', () => {
    const ok = vi.fn();
    render(<ConfirmPopover title="문서를 닫을까요?" confirmLabel="나가기" cancelLabel="취소" danger onConfirm={ok} onCancel={() => {}} />);
    const btn = screen.getByRole('button', { name: '나가기' });
    expect(btn.getAttribute('data-variant')).toBe('danger');
    fireEvent.click(btn);
    expect(ok).toHaveBeenCalled();
  });
  it('인라인 대화상자는 aria-modal, 닫기 버튼 자동 생성 없음', () => {
    render(<InlineDialog title="문서 열기" actions={<Button>열기</Button>}>본문</InlineDialog>);
    const d = screen.getByRole('dialog');
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(screen.queryByRole('button', { name: '닫기' })).toBeNull();
  });
  it('토스트 텍스트 버튼', () => {
    const on = vi.fn();
    render(<Toast text="문서 1건이 생성되었습니다." action={{ label: '열기', cmd: 'open-result', onClick: on }} />);
    fireEvent.click(screen.getByRole('button', { name: '열기' }));
    expect(on).toHaveBeenCalled();
  });
});

describe('form', () => {
  it('Button: cmd → data-mc-cmd, 기본 type=button', () => {
    render(<Button cmd="share">공유</Button>);
    const b = screen.getByRole('button', { name: '공유' });
    expect(b.getAttribute('data-mc-cmd')).toBe('share');
    expect(b.getAttribute('type')).toBe('button');
  });
  it('TextInput: 오류 시 aria-invalid + 설명', () => {
    render(<TextInput id="n" aria-label="닉네임" error="2~8자로 입력하세요." />);
    expect(screen.getByLabelText('닉네임').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('2~8자로 입력하세요.')).toBeTruthy();
  });
  it('RadioRow: 방향키로 이동', () => {
    const on = vi.fn();
    render(<RadioRow label="양식" value="a" onChange={on} options={[{ value: 'a', label: '월마감표' }, { value: 'b', label: '실적표' }, { value: 'c', label: '연차현황' }]} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0].getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(radios[0], { key: 'ArrowDown' });
    expect(on).toHaveBeenCalledWith('b');
  });
  it('Checkbox 토글', () => {
    const on = vi.fn();
    render(<Checkbox checked={false} onChange={on}>결재 경보 포함</Checkbox>);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(on).toHaveBeenCalledWith(true);
  });
  it('SegmentedChoice: 선택은 ✓ 접두 + aria-pressed', () => {
    const on = vi.fn();
    render(<SegmentedChoice label="피식" value="some" onChange={on} cmdPrefix="laugh" options={[{ value: 'none', label: '아니요' }, { value: 'some', label: '약간' }, { value: 'lol', label: '많이' }]} />);
    const sel = screen.getByRole('button', { name: '✓ 약간' });
    expect(sel.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '많이' }));
    expect(on).toHaveBeenCalledWith('lol');
  });
});
