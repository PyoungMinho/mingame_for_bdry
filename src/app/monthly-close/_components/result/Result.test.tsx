// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ResultDoc } from './ResultDoc';
import { DocActionBar } from './DocActionBar';
import { ReportPopover } from './ReportPopover';
import { ResultSheet } from './ResultSheet';
import { MemoLine, MobileSheetTabs, ConfirmRow, MobileTopBar } from '../mobile/Mobile';

const rows = [
  { label: '소속', value: '편집자37' },
  { label: '경위', value: '본인은 3회차에 B7 인근의 법카 내역을 방치한 과실로 시말서를 제출합니다.', tall: true },
  { label: '서명', value: '편집자37 (인)', sign: true },
];

describe('ResultDoc', () => {
  it('시말서: 결재란 도장은 맨 오른쪽 1개만', () => {
    const { container } = render(
      <ResultDoc kind="reprimand" title="시말서" rows={rows} approval={{ labels: ['담당', '팀장', '본부장'], stamps: ['', '', '확인'] }} footnote="게임 결과 연출 · 베타" />,
    );
    expect(screen.getByRole('heading', { name: '시말서' })).toBeTruthy();
    expect(container.querySelectorAll('.mc-stamp')).toHaveLength(1);
    expect(container.querySelector('.mc-doc__approval-box:last-child .mc-stamp')).not.toBeNull();
    expect(container.querySelector('.mc-doc__value[data-tall="true"]')).not.toBeNull();
    expect(container.querySelector('.mc-doc')?.getAttribute('data-kind')).toBeNull();
  });
  it('포상 품의서: 도장 3개, 5자 이상 제목은 long 자간', () => {
    const { container } = render(
      <ResultDoc kind="award" title="포상 품의서" rows={rows} approval={{ labels: ['담당', '팀장', '본부장'], stamps: ['승', '승', '승'] }} footnote="x" />,
    );
    expect(container.querySelectorAll('.mc-stamp')).toHaveLength(3);
    expect(container.querySelector('.mc-doc')?.getAttribute('data-kind')).toBe('long');
  });
  it('경위서: 결재란 없음, 경보 실패 줄은 있을 때만', () => {
    const a = render(<ResultDoc kind="joint" title="공동 경위서" rows={rows} approval={null} footnote="x" />);
    expect(a.container.querySelector('.mc-doc__approval')).toBeNull();
    expect(a.container.querySelector('.mc-doc__note')).toBeNull();
    const b = render(<ResultDoc kind="reprimand" title="시말서" rows={rows} alarmFailLine="※ 결재 요청 대응 지연" footnote="x" />);
    expect(b.container.querySelector('.mc-doc__note')?.textContent).toContain('대응 지연');
  });
});

describe('DocActionBar', () => {
  const laugh = {
    question: '피식했나요?',
    options: [{ value: 'none', label: '아니요' }, { value: 'some', label: '약간' }, { value: 'lol', label: '많이' }] as const,
    value: null,
    onChange: vi.fn(),
  };
  const mk = (over: Partial<React.ComponentProps<typeof DocActionBar>> = {}) => (
    <DocActionBar saveLabel="v8로 저장" onSave={vi.fn()} copyLabel="내용 복사" onCopy={vi.fn()} newLabel="다른 동료와 새 문서" onNew={vi.fn()} laugh={laugh} reportLabel="불편한 문구 신고" onReport={vi.fn()} {...over} />
  );

  it('모든 기능 버튼이 data-mc-cmd 를 단다', () => {
    const { container } = render(mk({ nameToggle: { label: '상대 이름 넣기', checked: false, onChange: vi.fn() } }));
    const cmds = [...container.querySelectorAll('[data-mc-cmd]')].map((e) => e.getAttribute('data-mc-cmd'));
    expect(cmds).toEqual(expect.arrayContaining(['save-v8', 'copy-text', 'new-doc', 'laugh:none', 'laugh:some', 'laugh:lol', 'name-toggle', 'report']));
  });
  it('저장 요청 중에는 비활성 + 보조 글', () => {
    render(mk({ saveLabel: '요청함…', saveDisabled: true, saveAside: '공동 편집자가 문서를 닫았습니다.' }));
    // 기능 버튼은 명령 이동 모드가 닿도록 진짜 disabled 대신 aria-disabled(클릭 무시)
    const save = screen.getByRole('button', { name: '요청함…' }) as HTMLButtonElement;
    expect(save.getAttribute('aria-disabled')).toBe('true');
    expect(save.disabled).toBe(false);
    expect(screen.getByText('공동 편집자가 문서를 닫았습니다.')).toBeTruthy();
  });
  it('피식 응답 → 콜백', () => {
    render(mk());
    fireEvent.click(screen.getByRole('button', { name: '약간' }));
    expect(laugh.onChange).toHaveBeenCalledWith('some');
  });
});

describe('ReportPopover', () => {
  it('3택을 고르기 전에는 보내기 비활성', () => {
    const send = vi.fn();
    render(
      <ReportPopover
        title="어느 문구가 불편했나요?"
        options={[{ value: 'memo', label: '메모' }, { value: 'taunt', label: '의견' }, { value: 'doc', label: '문서' }]}
        sendLabel="보내기"
        cancelLabel="취소"
        onSend={send}
        onCancel={() => {}}
      />,
    );
    const btn = screen.getByRole('button', { name: '보내기' }) as HTMLButtonElement;
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(btn);
    expect(send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('radio', { name: '의견' }));
    expect(btn.getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(btn);
    expect(send).toHaveBeenCalledWith('taunt');
  });
});

describe('ResultSheet', () => {
  it('눈금선 끈 시트에 문서와 작업 줄을 얹는다 (셀은 그리지 않음)', () => {
    const { container } = render(<ResultSheet label="시말서" filterLeft="보기" filterRight="저장" doc={<div data-testid="doc" />} actions={<div data-testid="bar" />} />);
    expect(container.querySelector('.mc-grid')?.getAttribute('data-gridlines')).toBe('off');
    expect(container.querySelectorAll('[role="gridcell"]')).toHaveLength(0);
    expect(screen.getByTestId('doc')).toBeTruthy();
    expect(screen.getByTestId('bar')).toBeTruthy();
    expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(5);
  });
});

describe('mobile', () => {
  it('상단바 [공유] [⋯]', () => {
    const more = vi.fn();
    render(<MobileTopBar fileName="월마감_최종_v7" shareLabel="공유" moreLabel="더 보기" onMore={more} />);
    fireEvent.click(screen.getByLabelText('더 보기'));
    expect(more).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '공유' }).getAttribute('data-mc-cmd')).toBe('share');
  });
  it('키보드 위 시트 탭: 키보드 높이만큼 띄운다', () => {
    const { container } = render(
      <MobileSheetTabs keyboardOffset={280} activeId="g" onTab={() => {}} tabs={[{ id: 'g', label: '월결산', kind: 'game' }, { id: 'd', label: '손익', kind: 'disguise' }]} />,
    );
    const w = container.querySelector('.mc-mtabs') as HTMLElement;
    expect(w.dataset.keyboard).toBe('true');
    expect(w.style.bottom).toBe('280px');
  });
  it('키보드 없으면 평소 위치', () => {
    const { container } = render(<MobileSheetTabs activeId="g" onTab={() => {}} tabs={[{ id: 'g', label: '월결산', kind: 'game' }]} />);
    expect((container.querySelector('.mc-mtabs') as HTMLElement).dataset.keyboard).toBeUndefined();
  });
  it('메모 줄 + 남은 시간, 확정 줄 버튼', () => {
    const ok = vi.fn();
    render(
      <>
        <MemoLine text="B7 선택됨" time="00:14" />
        <ConfirmRow label="B7 반영" onConfirm={ok} />
      </>,
    );
    expect(screen.getByText('00:14')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'B7 반영' }));
    expect(ok).toHaveBeenCalled();
  });
});
