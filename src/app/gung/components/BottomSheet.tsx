'use client';

/**
 * §5-25 BottomSheet — 스크림 + radius 22 상단 시트, max-height 88dvh, 핸들 36×4.
 * 안드로이드 하드웨어 뒤로가기로 닫는 처리는 전역 백가드(`lib/useBackGuard.ts`, 페이지개발자)가 수행 —
 * 여기서는 포커스 트랩·Escape·스크림 탭만 다룬다(§10-2 체크리스트의 "로컬" 부분).
 */
import { useEffect, useRef, type ReactNode } from 'react';

export interface BottomSheetProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  dismissible?: boolean;
  className?: string;
}

export function BottomSheet({ title, open, onClose, children, actions, dismissible = true, className }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // onClose 는 보통 인라인 람다 — 의존성에 넣으면 상위 재렌더(타이머 틱)마다 포커스를 닫기 버튼으로 다시 뺏는다.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    (closeRef.current ?? sheetRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) return onCloseRef.current();
      if (e.key !== 'Tab' || !sheetRef.current) return;
      const focusables = sheetRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([tabindex="-1"]), [href], input, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.({ preventScroll: true });
    };
  }, [open, dismissible]);

  if (!open) return null;

  return (
    <div className={['gu-sheet', className ?? ''].filter(Boolean).join(' ')} role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="gu-sheet-scrim" aria-hidden tabIndex={-1} onClick={dismissible ? onClose : undefined} />
      <div className="gu-sheet-body" ref={sheetRef} tabIndex={-1}>
        <span className="gu-sheet-handle" aria-hidden />
        <div className="gu-sheet-head">
          <h2 className="gu-display">{title}</h2>
          {dismissible && (
            <button ref={closeRef} type="button" className="gu-header-iconbtn" onClick={onClose} aria-label="닫기">
              ✕
            </button>
          )}
        </div>
        <div className="gu-sheet-content">{children}</div>
        {actions && <div className="gu-sheet-actions">{actions}</div>}
      </div>
    </div>
  );
}
