'use client';

/**
 * 시트·모달 공통(디자인 §5-1 BottomSheet · ConfirmSheet) — gung 패턴을 witness 안에 복제.
 *  - role="dialog" aria-modal, 포커스 트랩(맨 위 층일 때만), 닫으면 이전 포커스 복귀.
 *  - 뒤로가기·Esc 는 BackStack 이 맨 위 층만 닫는다. 스크림 탭으로도 닫힌다(dismissible).
 *  - 핸들을 아래로 끌어 닫기(필수 경로 아님 — 버튼 대체 경로가 항상 있다).
 *  - variant: 'sheet'(아래에서 올라옴) | 'modal'(중앙 카드, 결과 카드·경고·확인).
 */
import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useBackLayer } from '../lib/BackStack';

export type SheetHeight = 'auto' | 'confirm' | 'evidence' | 'tall' | 'full';

export interface BottomSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  height?: SheetHeight;
  variant?: 'sheet' | 'modal';
  dismissible?: boolean;
  /** 스크린(바깥) 탭으로 닫히는지. 기본은 dismissible 을 따른다 — 결과 카드처럼 실수 탭으로 닫히면 곤란한 모달은 false(X·Esc·뒤로는 그대로 닫는다) */
  scrimDismiss?: boolean;
  /** 제목을 화면에 그리지 않고 aria-label 로만 쓴다 */
  hideTitle?: boolean;
  /** 닫기(X) 버튼을 그리지 않는다 */
  noClose?: boolean;
  className?: string;
  headerExtra?: ReactNode;
}

const FOCUSABLE = 'button:not([disabled]):not([tabindex="-1"]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function BottomSheet({ open, title, onClose, children, footer, height = 'auto', variant = 'sheet', dismissible = true, scrimDismiss, hideTitle, noClose, className, headerExtra }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const isTop = useBackLayer(open, onClose, dismissible);
  const isTopRef = useRef(isTop);
  isTopRef.current = isTop;
  const dragRef = useRef<{ y: number; id: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const root = sheetRef.current;
    const auto = root?.querySelector<HTMLElement>('[data-autofocus]');
    (auto ?? closeRef.current ?? root)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !root || !isTopRef.current()) return;
      const f = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!f.length) {
        e.preventDefault();
        return;
      }
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (prev && document.contains(prev)) prev.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  const onHandleDown = (e: React.PointerEvent) => {
    if (!dismissible || variant !== 'sheet') return;
    dragRef.current = { y: e.clientY, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !sheetRef.current) return;
    const dy = Math.max(0, e.clientY - d.y);
    sheetRef.current.style.transform = `translateY(${dy}px)`;
  };
  const onHandleUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || !sheetRef.current) return;
    const dy = e.clientY - d.y;
    sheetRef.current.style.transform = '';
    if (dy > 90) onClose();
  };

  return (
    <div className={['wt-sheet', `wt-sheet--${variant}`, className].filter(Boolean).join(' ')} role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="wt-sheet-scrim" aria-hidden tabIndex={-1} onClick={dismissible && scrimDismiss !== false ? onClose : undefined} />
      <div className={`wt-sheet-body wt-sheet-body--${height}`} ref={sheetRef} tabIndex={-1}>
        {variant === 'sheet' && <span className="wt-sheet-handle" aria-hidden onPointerDown={onHandleDown} onPointerMove={onHandleMove} onPointerUp={onHandleUp} onPointerCancel={onHandleUp} />}
        {(!hideTitle || (!noClose && dismissible)) && (
          <div className="wt-sheet-head">
            {hideTitle ? <span /> : <h2 className="wt-display">{title}</h2>}
            {headerExtra}
            {!noClose && dismissible && (
              <button ref={closeRef} type="button" className="wt-iconbtn" onClick={onClose} aria-label="닫기">
                <X size={20} aria-hidden />
              </button>
            )}
          </div>
        )}
        <div className="wt-sheet-content">{children}</div>
        {footer && <div className="wt-sheet-footer">{footer}</div>}
      </div>
    </div>
  );
}

export interface ConfirmSheetProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** 기본 포커스(안전한 쪽) — 보통 'cancel' */
  focus?: 'cancel' | 'confirm';
  danger?: boolean;
  variant?: 'sheet' | 'modal';
  confirmTestId?: string;
}

/** 확인 시트 — 취소(안전한 쪽)가 기본 포커스. 반대 의미 버튼 사이 24px */
export function ConfirmSheet({ open, title, children, confirmLabel, cancelLabel, onConfirm, onCancel, focus = 'cancel', danger, variant = 'sheet', confirmTestId }: ConfirmSheetProps) {
  return (
    <BottomSheet open={open} title={title} onClose={onCancel} height="confirm" variant={variant}>
      <div className="wt-confirm-body">{children}</div>
      <div className="wt-actions wt-actions--opposed">
        <button type="button" className="wt-btn wt-btn--secondary" onClick={onCancel} data-autofocus={focus === 'cancel' ? '' : undefined}>
          {cancelLabel}
        </button>
        <button type="button" className={`wt-btn ${danger ? 'wt-btn--danger' : 'wt-btn--primary'}`} onClick={onConfirm} data-autofocus={focus === 'confirm' ? '' : undefined} data-testid={confirmTestId}>
          {confirmLabel}
        </button>
      </div>
    </BottomSheet>
  );
}
