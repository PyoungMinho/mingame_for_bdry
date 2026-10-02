'use client';

/**
 * §10-1 SealedCard 동작 규약 구현 — `SealedCard`/`ClueCard`/`RoleCard`는 `open`+`pressBind`만
 * 받는 완전 제어형이라(컴포넌트개발자 설계), 400ms 홀드 임계값·pointer capture·전역 즉시 재봉인
 * 타이밍/이벤트 로직은 여기(페이지개발자 소유)에 둔다.
 *
 *  - hold 모드: pointerdown 400ms 뒤 열림(그 전에 떼면 무반응) · 떼면 즉시 닫힘(애니메이션 없음)
 *  - tap 모드: 탭 → 15초 열림(자동 봉인) · 다시 탭 → 즉시 봉인
 *  - 키보드: Space/Enter keydown(반복 무시) = 열림, keyup = 봉인
 *  - visibilitychange(hidden)/blur/pagehide → 즉시 봉인
 *  - `sealEpoch` 가 바뀌면(탭 전환·phase 전환·시트 열림 등 상위가 올리는 신호) 즉시 재봉인
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { PressBind, SealMode } from '../components/types';

const HOLD_MS = 400;
export const TAP_OPEN_MS = 15_000;

export interface UseHoldReveal {
  open: boolean;
  mode: SealMode;
  pressBind: PressBind;
  holdProgress: number;
  tapRemainingMs?: number;
  tapTotalMs?: number;
  reseal: () => void;
}

export function useHoldReveal(mode: SealMode, sealEpoch: unknown): UseHoldReveal {
  const [open, setOpen] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [tapRemainingMs, setTapRemainingMs] = useState<number | undefined>(undefined);

  const holdTimeout = useRef<number | undefined>(undefined);
  const holdRaf = useRef<number | undefined>(undefined);
  const holdStartedAt = useRef(0);
  const tapTimeout = useRef<number | undefined>(undefined);
  const tapInterval = useRef<number | undefined>(undefined);

  const clearHold = useCallback(() => {
    if (holdTimeout.current !== undefined) window.clearTimeout(holdTimeout.current);
    if (holdRaf.current !== undefined) window.cancelAnimationFrame(holdRaf.current);
    holdTimeout.current = undefined;
    holdRaf.current = undefined;
    setHoldProgress(0);
  }, []);

  const clearTap = useCallback(() => {
    if (tapTimeout.current !== undefined) window.clearTimeout(tapTimeout.current);
    if (tapInterval.current !== undefined) window.clearInterval(tapInterval.current);
    tapTimeout.current = undefined;
    tapInterval.current = undefined;
    setTapRemainingMs(undefined);
  }, []);

  const reseal = useCallback(() => {
    clearHold();
    clearTap();
    setOpen(false);
  }, [clearHold, clearTap]);

  // 탭 전환 · phase 전환 · 시트 열림 등 — 상위가 올리는 신호에 즉시 재봉인
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    reseal();
  }, [sealEpoch, reseal]);

  // 전역 이벤트 — 화면이 꺼지거나 다른 앱으로 전환되면 즉시 봉인
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) reseal();
    };
    window.addEventListener('blur', reseal);
    window.addEventListener('pagehide', reseal);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', reseal);
      window.removeEventListener('pagehide', reseal);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reseal]);

  useEffect(() => reseal, [reseal]); // 언마운트 시 타이머 정리

  const startHold = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      // 주 포인터만(두 번째 손가락·마우스 오른쪽 버튼 무시) — §10-1 "pointerdown(주 포인터)"
      if (e.isPrimary === false || (e.pointerType === 'mouse' && e.button > 0)) return;
      clearHold(); // 이전 홀드 타이머가 남아 있으면(멀티터치 등) 누수 없이 정리
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        /* 일부 환경 미지원 */
      }
      holdStartedAt.current = performance.now();
      const tick = () => {
        const elapsed = performance.now() - holdStartedAt.current;
        setHoldProgress(Math.min(1, elapsed / HOLD_MS));
        if (elapsed < HOLD_MS) holdRaf.current = window.requestAnimationFrame(tick);
      };
      holdRaf.current = window.requestAnimationFrame(tick);
      holdTimeout.current = window.setTimeout(() => {
        setOpen(true);
        setHoldProgress(1);
        try {
          navigator.vibrate?.(10);
        } catch {
          /* 무시 */
        }
      }, HOLD_MS);
    },
    [clearHold],
  );

  const endHold = useCallback(() => {
    clearHold();
    setOpen(false);
  }, [clearHold]);

  const toggleTap = useCallback(() => {
    if (open) {
      reseal();
      return;
    }
    setOpen(true);
    setTapRemainingMs(TAP_OPEN_MS);
    const endsAt = Date.now() + TAP_OPEN_MS;
    tapInterval.current = window.setInterval(() => {
      setTapRemainingMs(Math.max(0, endsAt - Date.now()));
    }, 250);
    tapTimeout.current = window.setTimeout(reseal, TAP_OPEN_MS);
  }, [open, reseal]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.repeat || (e.key !== ' ' && e.key !== 'Enter')) return;
      e.preventDefault();
      if (mode === 'tap') {
        toggleTap();
      } else if (!open) {
        setOpen(true);
        setHoldProgress(1);
      }
    },
    [mode, open, toggleTap],
  );

  const onKeyUp = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      if (mode === 'hold') reseal();
    },
    [mode, reseal],
  );

  const pressBind: PressBind =
    mode === 'hold'
      ? {
          onPointerDown: startHold,
          onPointerUp: endHold,
          onPointerCancel: endHold,
          onPointerLeave: endHold,
          onLostPointerCapture: endHold,
          onKeyDown,
          onKeyUp,
          onContextMenu: (e) => e.preventDefault(),
        }
      : {
          onClick: toggleTap,
          onKeyDown,
          onKeyUp,
          onContextMenu: (e) => e.preventDefault(),
        };

  return { open, mode, pressBind, holdProgress, tapRemainingMs, tapTotalMs: mode === 'tap' ? TAP_OPEN_MS : undefined, reseal };
}
