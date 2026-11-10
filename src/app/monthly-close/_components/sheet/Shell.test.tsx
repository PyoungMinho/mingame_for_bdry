// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FormulaBar, MenuBar, ToolBar, TopBar } from './Chrome';
import { SheetShell } from './SheetFrame';
import { SheetTabs } from './SheetTabs';
import { StatusBar } from './StatusBar';
import { CellMemo } from './CellMemo';
import { Pane, SplitPanes } from './Panes';

describe('SheetShell', () => {
  it('두 레이어를 모두 마운트하고 data-view 만 바뀐다', () => {
    const el = (view: 'game' | 'disguise') => (
      <SheetShell view={view} chrome={<i>c</i>} game={<b data-testid="g">g</b>} disguise={<b data-testid="d">d</b>} footer={<i>f</i>} />
    );
    const { container, rerender } = render(el('game'));
    const shell = container.querySelector('.mc-shell') as HTMLElement;
    expect(shell.dataset.view).toBe('game');
    expect(screen.getByTestId('g')).toBeTruthy();
    expect(screen.getByTestId('d')).toBeTruthy();
    rerender(el('disguise'));
    expect(shell.dataset.view).toBe('disguise');
    expect(screen.getByTestId('g')).toBeTruthy();
  });
});

describe('SheetTabs', () => {
  it('게임 탭이 첫 번째, 활성 탭 aria-selected, 클릭하면 id·kind 전달', () => {
    const onTab = vi.fn();
    render(
      <SheetTabs
        activeId="game"
        onTab={onTab}
        tabs={[
          { id: 'game', label: '월결산', kind: 'game' },
          { id: 'result', label: '시말서', kind: 'result', fresh: true },
          { id: 'ds', label: '손익', kind: 'disguise' },
        ]}
      />,
    );
    const tabs = screen.getAllByRole('tab').filter((t) => t.getAttribute('data-mc-tab') !== 'add');
    expect(tabs.map((t) => t.textContent)).toEqual(['월결산', '시말서', '손익']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');
    expect(tabs[1].dataset.fresh).toBe('true');
    fireEvent.click(tabs[2]);
    expect(onTab).toHaveBeenCalledWith('ds', 'disguise');
  });
});

describe('크롬', () => {
  it('기능 버튼은 모두 data-mc-cmd 를 달고 장식은 탭 이동에서 빠진다', () => {
    const { container } = render(
      <>
        <TopBar fileName="월마감_최종_v7" shareLabel="공유" editors={[{ initial: '김' }, { initial: 'B' }]} coEditLabel="공동 편집 중" />
        <MenuBar open="file" onToggle={() => {}} onItem={() => {}} fileItems={[{ id: 'new', label: '새 문서' }]} helpItems={[]} />
        <ToolBar hintLabel="검토" hintCount={2} tauntLabel="의견 남기기" />
      </>,
    );
    const cmds = [...container.querySelectorAll('[data-mc-cmd]')].map((e) => e.getAttribute('data-mc-cmd'));
    expect(cmds).toEqual(expect.arrayContaining(['share', 'menu-file', 'menu-help', 'file:new', 'hint', 'taunt']));
    // 장식 버튼은 tabIndex -1 + aria-hidden
    const decor = container.querySelectorAll('.mc-tool[aria-hidden="true"]');
    expect(decor.length).toBeGreaterThan(5);
    decor.forEach((d) => expect((d as HTMLElement).tabIndex).toBe(-1));
  });

  it('메뉴 항목 클릭 → onItem', () => {
    const onItem = vi.fn();
    render(<MenuBar open="help" onToggle={() => {}} onItem={onItem} fileItems={[]} helpItems={[{ id: 'rules', label: '인수인계서' }]} />);
    fireEvent.click(screen.getByRole('menuitem', { name: '인수인계서' }));
    expect(onItem).toHaveBeenCalledWith('help', 'rules');
  });

  it('이름 상자 Enter → onNameSubmit, 한글 조합 중에는 무시', () => {
    const onNameSubmit = vi.fn();
    render(<FormulaBar nameValue="B7" onNameValueChange={() => {}} onNameSubmit={onNameSubmit} formula="" />);
    const box = screen.getByLabelText('이름 상자');
    fireEvent.keyDown(box, { key: 'Enter', isComposing: true });
    expect(onNameSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onNameSubmit).toHaveBeenCalledWith('B7');
  });

  it('✕ ✓ 는 armed 일 때만 활성, 모바일은 hideButtons', () => {
    const onCancel = vi.fn();
    const { rerender } = render(<FormulaBar nameValue="A1" formula="" armed={false} onCancel={onCancel} />);
    expect((screen.getByLabelText('취소') as HTMLButtonElement).disabled).toBe(true);
    rerender(<FormulaBar nameValue="A1" formula="" armed onCancel={onCancel} />);
    fireEvent.click(screen.getByLabelText('취소'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    rerender(<FormulaBar nameValue="A1" formula="" hideButtons nameDisplayOnly />);
    expect(screen.queryByLabelText('취소')).toBeNull();
    expect(screen.getByLabelText('이름 상자').getAttribute('data-display-only')).toBe('true');
  });

  it('상태줄은 role=status', () => {
    render(<StatusBar message="준비" right="회차 3 · 100%" />);
    expect(screen.getByRole('status').textContent).toBe('준비');
  });

  it('창 머리 띠·분할 창', () => {
    const { container } = render(
      <SplitPanes
        left={<Pane id="mine" head="내 시트 · 편집 가능">x</Pane>}
        right={<Pane id="theirs" head="상대 시트 · 읽기 전용">y</Pane>}
      />,
    );
    expect(container.querySelectorAll('.mc-pane')).toHaveLength(2);
    expect(container.querySelector('.mc-split__bar')).not.toBeNull();
    expect(screen.getByText('상대 시트 · 읽기 전용')).toBeTruthy();
  });

  it('메모: title 속성 없음, 위치 스타일', () => {
    const { container } = render(<CellMemo kind="hit" head="B님 · 방금" body="반려되었습니다." x={168} y={50} />);
    const m = container.querySelector('.mc-memo') as HTMLElement;
    expect(m.style.left).toBe('168px');
    expect(m.hasAttribute('title')).toBe(false);
    expect(m.dataset.kind).toBe('hit');
  });
});
