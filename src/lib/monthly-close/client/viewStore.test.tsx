// @vitest-environment jsdom
import { act, render, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useHideKeys, hideKeyKind, isSaveShortcut } from './useHideKeys';
import { ViewStore, useViewSnapshot } from './viewStore';
import React from 'react';

function key(code: string, init: KeyboardEventInit = {}, target: EventTarget = document.body): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { code, key: init.key ?? code, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
}

describe('ViewStore', () => {
  it('hide는 data-view를 동기로 바꾸고 한 방향이다', () => {
    const store = new ViewStore('game');
    const shell = document.createElement('div');
    store.attachShell(shell);
    expect(shell.getAttribute('data-view')).toBe('game');
    const seen: string[] = [];
    store.onChange((v, r) => seen.push(`${v}:${r}`));
    expect(store.hide('tab')).toBe(true);
    expect(shell.getAttribute('data-view')).toBe('disguise'); // React 렌더 없이
    expect(store.hide('esc')).toBe(false); // 이미 숨음
    expect(store.getSnapshot().version).toBe(1);
    expect(store.show()).toBe(true);
    expect(shell.getAttribute('data-view')).toBe('game');
    expect(store.show()).toBe(false);
    expect(seen).toEqual(['disguise:tab', 'game:return']);
  });

  it('initial disguise는 숨김으로 시작(새로고침 규칙)', () => {
    const store = new ViewStore('disguise');
    const shell = document.createElement('div');
    store.attachShell(shell);
    expect(shell.getAttribute('data-view')).toBe('disguise');
    expect(store.getSnapshot().lastReason).toBe('init');
  });

  it('useViewSnapshot이 구독한다', () => {
    const store = new ViewStore();
    const { result } = renderHook(() => useViewSnapshot(store));
    expect(result.current.view).toBe('game');
    act(() => {
      store.hide('blur');
    });
    expect(result.current.view).toBe('disguise');
  });

  it('창 이탈 예외 1회(공유 시트)', () => {
    const store = new ViewStore();
    store.graceNextLeave();
    expect(store.consumeLeaveGrace()).toBe(true);
    expect(store.consumeLeaveGrace()).toBe(false);
  });
});

describe('hideKeyKind', () => {
  it('code로 판별하고 보조키는 무시', () => {
    expect(hideKeyKind({ code: 'Tab', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false })).toBe('tab');
    expect(hideKeyKind({ code: 'Tab', shiftKey: true, ctrlKey: false, altKey: false, metaKey: false })).toBe('shift-tab');
    expect(hideKeyKind({ code: 'Escape', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false })).toBe('esc');
    expect(hideKeyKind({ code: 'Tab', shiftKey: false, ctrlKey: true, altKey: false, metaKey: false })).toBeNull();
    expect(hideKeyKind({ code: 'Tab', shiftKey: false, ctrlKey: false, altKey: true, metaKey: false })).toBeNull();
    expect(hideKeyKind({ code: 'Tab', shiftKey: false, ctrlKey: false, altKey: false, metaKey: true })).toBeNull();
    expect(hideKeyKind({ code: 'KeyA', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false })).toBeNull();
    expect(isSaveShortcut({ code: 'KeyS', ctrlKey: true, metaKey: false, altKey: false })).toBe(true);
    expect(isSaveShortcut({ code: 'KeyS', ctrlKey: false, metaKey: true, altKey: false })).toBe(true);
    expect(isSaveShortcut({ code: 'KeyS', ctrlKey: false, metaKey: false, altKey: false })).toBe(false);
  });
});

describe('useHideKeys', () => {
  function setup(opts: Parameters<typeof useHideKeys>[1] = {}) {
    const store = new ViewStore('game');
    const onSave = vi.fn();
    const hook = renderHook(() => useHideKeys(store, { onSave, ...opts }));
    return { store, onSave, ...hook };
  }

  it('Tab·Shift+Tab·ESC는 게임 레이어에서 숨기기 (기본 동작 차단)', () => {
    for (const [code, init] of [
      ['Tab', {}],
      ['Tab', { shiftKey: true }],
      ['Escape', {}],
    ] as const) {
      const { store, unmount } = setup();
      const e = key(code, init);
      expect(store.view).toBe('disguise');
      expect(e.defaultPrevented).toBe(true);
      unmount();
    }
  });

  it('입력칸·한글 조합 중(key=Process, isComposing)에도 잡힌다', () => {
    const { store } = setup();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    key('Tab', { key: 'Process', isComposing: true, keyCode: 229 } as KeyboardEventInit, input);
    expect(store.view).toBe('disguise');
    input.remove();
  });

  it('Ctrl/Alt/Cmd + Tab은 무시', () => {
    const { store } = setup();
    key('Tab', { ctrlKey: true });
    key('Tab', { altKey: true });
    key('Tab', { metaKey: true });
    key('Escape', { ctrlKey: true });
    expect(store.view).toBe('game');
  });

  it('한 방향: 숨긴 뒤 Tab/ESC를 아무리 눌러도 게임으로 돌아가지 않고, 키를 소비하지 않는다', () => {
    const { store } = setup();
    key('Tab');
    expect(store.view).toBe('disguise');
    const results = [key('Tab'), key('Tab', { shiftKey: true }), key('Escape'), key('Escape')];
    expect(store.view).toBe('disguise');
    for (const e of results) expect(e.defaultPrevented).toBe(false); // 시트가 처리한다
    // 창 왕복에도 유지
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));
    expect(store.view).toBe('disguise');
    // 복귀는 show()뿐
    act(() => {
      store.show();
    });
    expect(store.view).toBe('game');
  });

  it('창 이탈(blur·visibilitychange hidden·pagehide)은 숨기고, 돌아와도 유지', () => {
    const a = setup();
    window.dispatchEvent(new Event('blur'));
    expect(a.store.view).toBe('disguise');
    a.unmount();

    const b = setup();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(b.store.view).toBe('disguise');
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(b.store.view).toBe('disguise');
    b.unmount();

    const c = setup();
    window.dispatchEvent(new Event('pagehide'));
    expect(c.store.view).toBe('disguise');
    c.unmount();
  });

  it('공유 시트 예외 1회: 첫 이탈만 무시하고 다음은 숨긴다', () => {
    const { store } = setup();
    store.graceNextLeave();
    window.dispatchEvent(new Event('blur'));
    expect(store.view).toBe('game');
    window.dispatchEvent(new Event('blur'));
    expect(store.view).toBe('disguise');
  });

  it('입장 대화상자: tabHides=false면 Tab은 통과, ESC는 숨기기', () => {
    const { store } = setup({ tabHides: false });
    const tab = key('Tab');
    expect(store.view).toBe('game');
    expect(tab.defaultPrevented).toBe(false);
    key('Escape');
    expect(store.view).toBe('disguise');
  });

  it('enabled=false(홈)면 아무것도 하지 않는다', () => {
    const { store } = setup({ enabled: false });
    key('Tab');
    key('Escape');
    window.dispatchEvent(new Event('blur'));
    expect(store.view).toBe('game');
  });

  it('Ctrl/Cmd+S는 두 레이어 모두 가로채 onSave', () => {
    const { store, onSave } = setup();
    const a = key('KeyS', { ctrlKey: true });
    expect(a.defaultPrevented).toBe(true);
    key('KeyS', { metaKey: true });
    expect(onSave).toHaveBeenCalledTimes(2);
    key('Tab');
    expect(store.view).toBe('disguise');
    key('KeyS', { ctrlKey: true });
    expect(onSave).toHaveBeenCalledTimes(3);
  });

  it('언마운트하면 리스너가 사라진다', () => {
    const { store, unmount } = setup();
    unmount();
    key('Tab');
    expect(store.view).toBe('game');
  });

  it('컴포넌트 안에서 쓰면 React 핸들러보다 먼저(캡처) 잡는다', () => {
    const store = new ViewStore('game');
    const seen = vi.fn();
    function C() {
      useHideKeys(store);
      return <input data-testid="i" onKeyDown={seen} />;
    }
    const { getByTestId } = render(<C />);
    const el = getByTestId('i');
    el.focus();
    el.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab', bubbles: true, cancelable: true }));
    expect(store.view).toBe('disguise');
    expect(seen).not.toHaveBeenCalled(); // 전파 차단
  });
});
