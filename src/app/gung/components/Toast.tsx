'use client';

/**
 * §5-26 Toast / UndoToast — 액션바 바로 위, 56h. 되돌리기 6초(장소)·5초(공개) / 일반 2.5초.
 * 동시에 1개(상위가 보장) · role="status".
 */
import { useEffect, useRef } from 'react';

export interface ToastProps {
  text: string;
  action?: { label: string; onClick: () => void };
  /** ms — 6000(장소 되돌리기)·5000(공개 되돌리기)·2500(일반) */
  duration?: number;
  onDismiss?: () => void;
  className?: string;
}

export function Toast({ text, action, duration = 2500, onDismiss, className }: ToastProps) {
  // onDismiss 는 보통 인라인 람다라 매 렌더 바뀐다 — 의존성에 넣으면 상위가 다시 그릴 때마다(방장 타이머 1초 틱)
  // 타이머가 리셋돼 토스트가 영영 안 사라진다. ref 로 최신 콜백만 잡고 타이머는 duration 기준 1회.
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  useEffect(() => {
    const id = window.setTimeout(() => dismissRef.current?.(), duration);
    return () => window.clearTimeout(id);
  }, [duration]);

  return (
    <div className={['gu-toast', className ?? ''].filter(Boolean).join(' ')} role="status">
      <span className="gu-toast-text">{text}</span>
      {action && (
        <button
          type="button"
          className="gu-toast-action"
          onClick={() => {
            action.onClick();
            dismissRef.current?.();
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
