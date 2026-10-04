// @vitest-environment jsdom
/**
 * 폴리시 검증(QA 실행자) 회귀 테스트.
 *  BUG-W09: 마지막 줄에서 0.45초 넘게 누른 '느린 탭'이 먹혀서 대사가 안 닫힘
 *           (길게 누르기가 아무것도 못 넘겼는데 뗄 때 클릭까지 삼켰다)
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Dialogue } from '@/lib/witness';
import { WtContext, type WtCtx } from './lib/context';
import { LONG_PRESS_MS, fxConfig } from './lib/fx';
import { DialogueBox, HOLD_STEP_MS } from './components/DialogueBox';
import { q } from './testkit';

const ctx = {
  game: { isRead: () => false, markRead: () => undefined, meta: { plays: 0 }, settings: { speed: 'instant', readFast: false } },
  fx: 'full',
} as unknown as WtCtx;

const logText = () => q('.wt-dialogue [role=log]')?.textContent ?? '';

function mount(lines: string[], onDone: () => void): HTMLElement {
  const ds = lines.map((text) => ({ who: 'NARR', text }) as Dialogue);
  render(
    <WtContext.Provider value={ctx}>
      <DialogueBox lines={ds} playKey="k" onDone={onDone} />
    </WtContext.Provider>,
  );
  return q('.wt-dialogue-tap')!;
}

/** 손가락을 ms 동안 누르고 뗀다(뗄 때 브라우저가 click 을 보낸다). 틱 사이에 화면이 갱신되도록 잘게 나눠 흘린다 */
function press(tap: HTMLElement, ms: number): void {
  fireEvent.pointerDown(tap);
  for (let t = 0; t < ms; t += 10) {
    act(() => {
      vi.advanceTimersByTime(Math.min(10, ms - t));
    });
  }
  fireEvent.pointerUp(tap);
  fireEvent.click(tap);
}

beforeEach(() => {
  vi.useFakeTimers();
  fxConfig.scale = 0;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  fxConfig.scale = 1;
});

describe('BUG-W09 느린 탭(≥ 0.45초)', () => {
  it('마지막 줄에서 느리게 탭하면 한 번에 닫힌다(삼키지 않는다)', () => {
    const onDone = vi.fn();
    const tap = mount(['하나.', '둘.'], onDone);
    press(tap, 100); // 1 → 2(마지막)
    expect(logText()).toBe('둘.');
    press(tap, LONG_PRESS_MS + 150);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('한 줄짜리 대사도 느린 탭 한 번에 닫힌다', () => {
    const onDone = vi.fn();
    const tap = mount(['한 줄.'], onDone);
    press(tap, LONG_PRESS_MS + 300);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('마지막이 아닌 줄의 느린 탭은 딱 한 줄만 넘긴다(넘긴 뒤 따라오는 클릭은 그대로 삼킨다)', () => {
    const onDone = vi.fn();
    const tap = mount(['하나.', '둘.', '셋.'], onDone);
    press(tap, LONG_PRESS_MS + 100);
    expect(logText()).toBe('둘.');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('연속 넘김으로 마지막 줄에 닿은 뒤 떼면 닫지 않는다(기존 설계 유지)', () => {
    const onDone = vi.fn();
    const tap = mount(['하나.', '둘.', '셋.'], onDone);
    press(tap, LONG_PRESS_MS + HOLD_STEP_MS * 4);
    expect(logText()).toBe('셋.');
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(tap);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
