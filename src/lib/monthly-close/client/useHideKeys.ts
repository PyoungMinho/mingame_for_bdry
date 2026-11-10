'use client';

/**
 * 숨기기 키 처리 (PM 확정, 디자인 §9-1 / 방향서 §5-4).
 *
 *  - 게임 레이어: Tab · Shift+Tab · ESC = 언제나 숨기기. 입력칸·한글 조합 중·드롭다운·팝오버가 열려 있어도 무조건.
 *    `e.code`로 판별(한글 입력 중 e.key는 'Process'), window **캡처 단계** 리스너 하나. Ctrl/Alt/Cmd가 함께 눌렸으면 무시.
 *  - 숨기기 레이어: 키를 소비하지 않는다(시트가 Tab=다음 칸, ESC=편집 취소). 게임으로 튀어나오는 경로 없음(한 방향).
 *    단, 포커스가 시트 격자 밖이면 Tab은 onHiddenTab(다음 칸)으로 넘긴다.
 *    예외(2026-11-10 PM 피드백 "탭기능때문에 칸이 우르르 움직이네"): 숨긴 직후 HIDDEN_TAB_GRACE_MS 동안의 Tab과
 *    꾹 눌러 생기는 자동 반복(e.repeat) Tab은 삼킨다 — 허둥대며 연타해도 선택 칸이 달려가지 않게.
 *  - 창 이탈(window blur · visibilitychange hidden · pagehide) → 숨기기. 돌아와도 유지(hide만 부르니까).
 *    공유 시트 예외(graceNextLeave)는 이탈 1번 분량: 짝으로 오는 다른 종류 신호(blur ↔ visibility)까지 소비한다(BUG-21).
 *  - Ctrl/Cmd+S는 두 레이어 모두 가로채 `onSave()`(가짜 저장 토스트).
 *  - 입장 대화상자에서는 Tab이 입력 이동이므로 `tabHides: false`, ESC만 숨기기.
 *  - 홈은 이 훅을 쓰지 않는다.
 */

import { useEffect, useRef } from 'react';
import { markHideStart, type ViewStore } from './viewStore';

export interface HideKeysOptions {
  /** false면 아무것도 하지 않는다(홈) */
  readonly enabled?: boolean;
  /** 기본 true. 입장 대화상자에서는 false */
  readonly tabHides?: boolean;
  /** 기본 true */
  readonly escHides?: boolean;
  /** 기본 true. false면 창 이탈 감지를 끈다(홈·테스트) */
  readonly leaveHides?: boolean;
  /** Ctrl/Cmd+S 가짜 저장 */
  readonly onSave?: () => void;
  /**
   * 숨기기 시트가 보이는데 포커스가 시트 격자 밖(이름 상자·body·사라진 게임 칸)에 있을 때의 Tab·Shift+Tab.
   * 브라우저 기본 포커스 이동 대신 "다음 칸/이전 칸"으로 처리하게 호출자에게 넘긴다(D3: 숨긴 뒤 Tab이 D4에 멈춰 있던 버그).
   * 격자 안(`[data-layer="disguise"]` 안)의 키는 시트가 처리하므로 여기로 오지 않는다.
   */
  readonly onHiddenTab?: (kind: 'tab' | 'shift-tab') => void;
}

/** 숨긴 직후 이 시간 동안은 숨기기 시트에서 Tab·Shift+Tab이 칸을 옮기지 않는다(연타 방지) */
export const HIDDEN_TAB_GRACE_MS = 1500;

/** 키 이벤트가 숨기기 키인지(보조키가 없을 때만). 순수 함수라 테스트하기 쉽다 */
export function hideKeyKind(e: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey'>): 'tab' | 'shift-tab' | 'esc' | null {
  if (e.ctrlKey || e.altKey || e.metaKey) return null;
  if (e.code === 'Tab') return e.shiftKey ? 'shift-tab' : 'tab';
  if (e.code === 'Escape') return 'esc';
  return null;
}

export function isSaveShortcut(e: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'metaKey' | 'altKey'>): boolean {
  return e.code === 'KeyS' && (e.ctrlKey || e.metaKey) && !e.altKey;
}

export function useHideKeys(store: ViewStore, opts: HideKeysOptions = {}): void {
  const { enabled = true, tabHides = true, escHides = true, leaveHides = true } = opts;
  const onSaveRef = useRef(opts.onSave);
  onSaveRef.current = opts.onSave;
  const onHiddenTabRef = useRef(opts.onHiddenTab);
  onHiddenTabRef.current = opts.onHiddenTab;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isSaveShortcut(e)) {
        e.preventDefault();
        e.stopPropagation();
        onSaveRef.current?.();
        return;
      }
      if (store.view !== 'game') {
        // 숨기기 시트: 격자 안 키는 시트가 처리한다. 격자 밖의 Tab만 "다음 칸"으로 넘긴다
        const k = hideKeyKind(e);
        if (k === 'tab' || k === 'shift-tab') {
          // 숨긴 직후의 연타와 꾹 누른 자동 반복은 삼킨다(시트 격자까지 내려가지 않게 캡처 단계에서 멈춤)
          const hiddenAt = store.getSnapshot().hiddenAt;
          const justHidden = hiddenAt !== null && Date.now() - hiddenAt < HIDDEN_TAB_GRACE_MS;
          if (e.repeat || justHidden) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }
        const inLayer = e.target instanceof Element && !!e.target.closest('[data-layer="disguise"]');
        if ((k === 'tab' || k === 'shift-tab') && !inLayer && onHiddenTabRef.current) {
          e.preventDefault();
          e.stopPropagation();
          onHiddenTabRef.current(k);
        }
        return;
      }
      const kind = hideKeyKind(e);
      if (!kind) return;
      if (kind === 'esc' ? !escHides : !tabHides) return;
      markHideStart();
      e.preventDefault();
      e.stopPropagation();
      store.hide(kind);
    };

    const leave = (reason: 'blur' | 'visibility' | 'pagehide') => {
      if (!leaveHides) return;
      if (store.consumeLeaveGrace(reason)) return;
      markHideStart();
      store.hide(reason);
    };
    const onBlur = () => leave('blur');
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') leave('visibility');
    };
    const onPageHide = () => leave('pagehide');

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    // 이미 가려진 채로 마운트된 경우(백그라운드 탭에서 열림)
    if (leaveHides && typeof document !== 'undefined' && document.visibilityState === 'hidden') store.hide('visibility');

    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [store, enabled, tabHides, escHides, leaveHides]);
}
