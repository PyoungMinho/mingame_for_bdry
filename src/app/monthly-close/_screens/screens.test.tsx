// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { PracticeApp } from './PracticeApp';
import { Home } from './Home';

describe('연습 화면 조립 (mock 정지 판)', () => {
  it('셸을 그리고 Tab으로 숨기면 data-view가 바뀌고, 게임 탭 클릭으로만 돌아온다', () => {
    const { container } = render(<PracticeApp mock="playing" industry={0} />);
    const shell = container.querySelector('.mc-shell') as HTMLElement;
    expect(shell.dataset.view).toBe('game');
    expect(document.title).toBe('연습용_사본_v1');
    // 셀 상태: 상대 판 0/1/종결, 내 판 취소선
    expect(container.querySelector('[data-state="miss"]')).not.toBeNull();
    expect(container.querySelector('[data-state="hit"]')).not.toBeNull();
    expect(container.querySelector('[data-state="sunk"]')).not.toBeNull();
    expect(container.querySelector('.mc-cell__strike')).not.toBeNull();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab', bubbles: true, cancelable: true }));
    });
    expect(shell.dataset.view).toBe('disguise');
    expect(document.title).toBe('연습용_사본_v1');
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true, cancelable: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab', bubbles: true, cancelable: true }));
    });
    expect(shell.dataset.view).toBe('disguise');
    const gameTab = screen.getAllByRole('tab')[0]!;
    fireEvent.click(gameTab);
    expect(shell.dataset.view).toBe('game');
  });

  it('종료 판은 공개(reveal) 칸과 결과 탭이 생긴다', () => {
    const { container } = render(<PracticeApp mock="ended" industry={1} />);
    expect(container.querySelector('[data-state="reveal"]')).not.toBeNull();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toContain('품의서');
  });

  it('네이티브 UI 없음: title 속성·dialog 요소가 없다', () => {
    const { container } = render(<PracticeApp mock="playing" industry={2} />);
    expect(container.querySelector('[title]')).toBeNull();
    expect(container.querySelector('dialog')).toBeNull();
  });
});

describe('홈', () => {
  it('게임임을 밝히는 안내와 법적 고지, 연습 버튼이 있다', () => {
    render(<Home />);
    expect(screen.getByText('이 서비스는 게임입니다.')).toBeTruthy();
    expect(screen.getByText(/Microsoft·Google/)).toBeTruthy();
    expect(screen.getByText('박대리와 연습 2분')).toBeTruthy();
  });
});
