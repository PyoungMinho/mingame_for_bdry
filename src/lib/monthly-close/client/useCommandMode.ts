'use client';

/**
 * 명령 이동 모드 (`/` 키, F10은 별칭 — 디자인 A5·A6, §9-2).
 *
 *  - 게임 레이어에서 포커스가 글자 입력칸 밖이면 `/`(code 'Slash')로 시작. 이름 상자(`[data-mc-namebox]`) 안에서도 시작.
 *    검산 입력칸 등 다른 입력칸 안에서는 무시. 보조키(Ctrl/Alt/Cmd)가 눌렸으면 무시.
 *  - 포커스가 `[data-mc-cmd]` 버튼 중 `data-mc-cmd-order` 오름차순 첫 번째로 간다. ←/→ 이동(양 끝에서 멈춤), Enter 실행,
 *    ↓ 메뉴 열기(= 클릭), `/` 다시 누르면 끝. 실행 뒤·끝낼 때 격자(`[data-mc-grid-focus]`)로 포커스를 돌려준다.
 *  - 비활성(aria-disabled) 버튼도 순서에 포함한다. 진짜 `disabled`는 포커스가 안 가므로 컴포넌트는 aria-disabled를 써야 한다.
 *  - ESC는 여기서 다루지 않는다(숨기기 키가 먼저 처리, 숨는 순간 모드는 종료).
 *  - 팝오버·드롭다운 안 이동(목록 ↑↓·Enter·←닫기)은 그 컴포넌트가 처리한다. 모드 중 키를 가로채지 않는 조건:
 *    열린 메뉴(`[data-mc-menu-open]`) 안에 포커스가 있으면 이 훅은 ←/→/Enter를 건드리지 않는다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ViewStore } from './viewStore';

/**
 * 기본 순서(디자인 A6): 파일 메뉴 → 도움말 메뉴 → [Σ] → [의견 남기기] → [공유] → (배치) 자동 배치·배치 완료 → (대전) 부재 처리 →
 * (결과) v 저장·내용 복사·새 문서·피식 3·신고. 컴포넌트가 data-mc-cmd-order를 달면 그것이 우선한다.
 * 메뉴 안 항목(`file:…`, `help:…`)과 ✕ ✓(cancel·confirm)는 이동 순서에서 뺀다.
 */
export const CMD_ORDER: Readonly<Record<string, number>> = {
  /** 검산 입력칸(검산이 열린 동안만 data-mc-cmd가 붙는다) — `/` 한 번으로 바로 들어간다(QA BUG-22) */
  'quiz-input': 5,
  'menu-file': 10,
  'menu-help': 20,
  hint: 30,
  taunt: 40,
  share: 50,
  more: 55,
  auto: 60,
  done: 70,
  absent: 80,
  rematch: 90,
  'save-v8': 90,
  'open-result': 91,
  copy: 100,
  'copy-text': 100,
  newdoc: 110,
  'new-doc': 110,
  'laugh:none': 120,
  'laugh:some': 121,
  'laugh:lol': 122,
  'name-toggle': 125,
  report: 130,
};
const SKIP_CMD = new Set(['cancel', 'confirm']);
/**
 * 메뉴·드롭다운 안 항목은 이동 순서에서 뺀다(열린 메뉴 안 ↑↓로 다닌다).
 * D3: 예전에는 ':'가 들어간 이름을 모두 뺐는데, 결과 탭의 피식 3버튼(`laugh:*`)까지 빠져 A6 순서에 닿지 못했다.
 */
const MENU_ITEM_PREFIXES = ['file:', 'help:', 'taunt:', 'more:', 'hint-kind:'];

export function commandItems(root: ParentNode): HTMLElement[] {
  const all = Array.from(root.querySelectorAll<HTMLElement>('[data-mc-cmd]')).filter((el) => {
    const name = el.getAttribute('data-mc-cmd') ?? '';
    if (SKIP_CMD.has(name) || MENU_ITEM_PREFIXES.some((p) => name.startsWith(p))) return false;
    // 숨은 레이어(display: none) 안의 버튼은 건너뛴다
    return !el.closest('[data-layer="disguise"]');
  });
  return all
    .map((el, i) => {
      const attr = el.getAttribute('data-mc-cmd-order');
      const name = el.getAttribute('data-mc-cmd') ?? '';
      const order = attr !== null ? Number(attr) : (CMD_ORDER[name] ?? 1000 + i);
      return { el, i, order };
    })
    .sort((a, b) => (a.order === b.order ? a.i - b.i : a.order - b.order))
    .map((x) => x.el);
}

export function isTextField(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') {
    const t = (el as HTMLInputElement).type;
    return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range'].includes(t);
  }
  return (el as HTMLElement).isContentEditable === true;
}

/** 시작해도 되는 포커스 위치인가: 글자 입력칸 밖, 또는 이름 상자 */
export function canStartCommandMode(active: Element | null): boolean {
  if (!isTextField(active)) return true;
  return (active as HTMLElement).hasAttribute('data-mc-namebox');
}

export interface CommandModeApi {
  readonly active: boolean;
  /** 현재 포커스를 가진 항목 순번(0부터), 비활성이면 -1 */
  readonly index: number;
  readonly exit: () => void;
}

export function useCommandMode(store: ViewStore, rootRef: { readonly current: HTMLElement | null }, enabled = true): CommandModeApi {
  const [state, setState] = useState<{ active: boolean; index: number }>({ active: false, index: -1 });
  const stateRef = useRef(state);
  stateRef.current = state;

  const focusIndex = useCallback(
    (i: number) => {
      const root = rootRef.current;
      if (!root) return;
      const items = commandItems(root);
      if (items.length === 0) return;
      const idx = Math.max(0, Math.min(items.length - 1, i));
      items[idx]?.focus();
      setState({ active: true, index: idx });
    },
    [rootRef],
  );

  const exit = useCallback(() => {
    if (!stateRef.current.active) return;
    setState({ active: false, index: -1 });
    rootRef.current?.querySelector<HTMLElement>('[data-mc-grid-focus]')?.focus();
  }, [rootRef]);

  // 숨기는 순간 모드 종료(포커스 이동 없음)
  useEffect(() => store.onChange((view) => {
    if (view === 'disguise') setState({ active: false, index: -1 });
  }), [store]);

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (store.view !== 'game') return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const root = rootRef.current;
      if (!root) return;
      const isTrigger = e.code === 'Slash' || e.code === 'F10';
      const cur = stateRef.current;

      if (!cur.active) {
        if (!isTrigger) return;
        if (!canStartCommandMode(document.activeElement)) return;
        e.preventDefault();
        e.stopPropagation();
        focusIndex(0);
        return;
      }

      // 모드 중
      const active = document.activeElement as HTMLElement | null;
      const menuOpen = active?.closest('[role="menu"], [data-mc-menu-open]');
      if (isTrigger) {
        e.preventDefault();
        e.stopPropagation();
        exit();
        return;
      }
      if (menuOpen) {
        // 열린 메뉴 안: ↑↓ 항목 이동, Enter 실행(기본 동작), ← 닫기(메뉴 버튼을 다시 눌러 접고 포커스 복귀)
        const entries = Array.from(menuOpen.querySelectorAll<HTMLElement>('[role="menuitem"]'));
        const at = entries.indexOf(active as HTMLElement);
        if (e.code === 'ArrowDown') {
          e.preventDefault();
          entries[Math.min(entries.length - 1, at + 1)]?.focus();
        } else if (e.code === 'ArrowUp') {
          e.preventDefault();
          entries[Math.max(0, at - 1)]?.focus();
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault();
          const owner = menuOpen.parentElement?.querySelector<HTMLElement>('[aria-haspopup="menu"]');
          owner?.click();
          owner?.focus();
        } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
          // 항목 실행 뒤에는 모드를 끝낸다(메뉴는 호출자가 닫음)
          window.setTimeout(() => exit(), 0);
        }
        return;
      }
      const items = commandItems(root);
      const here = items.indexOf(document.activeElement as HTMLElement);
      const idx = here >= 0 ? here : cur.index;
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        focusIndex(idx + 1);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        focusIndex(idx - 1);
      } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        const el = items[idx];
        if (!el) return;
        // 글자 입력칸(검산)에서 Enter = 그 칸의 확정. 모드만 끝내고 포커스·기본 동작은 그대로 둔다(격자로 튕기지 않게)
        if (isTextField(el) && document.activeElement === el) {
          setState({ active: false, index: -1 });
          return;
        }
        e.preventDefault();
        const opensMenu = el.getAttribute('aria-haspopup') !== null;
        el.click();
        if (opensMenu) window.requestAnimationFrame(() => el.parentElement?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
        else exit();
      } else if (e.code === 'ArrowDown') {
        const el = items[idx];
        if (el && el.getAttribute('aria-haspopup') !== null) {
          e.preventDefault();
          el.click();
          window.requestAnimationFrame(() => el.parentElement?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
        }
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      // 격자 클릭 = 모드 끝
      if (!stateRef.current.active) return;
      const t = e.target as Element | null;
      if (t && !t.closest('[data-mc-cmd]')) setState({ active: false, index: -1 });
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [enabled, store, rootRef, focusIndex, exit]);

  return { active: state.active, index: state.index, exit };
}
