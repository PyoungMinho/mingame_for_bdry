"use client";

/**
 * Toast — 5타입 (default / success / warning / error / info)
 * design-final §5.3 / ui-spec §7.8
 *
 * 컴포넌트 자체는 순수 표시용. ToastContainer가 목록을 관리.
 * 페이지 개발자는 useToast 훅 + ToastContainer를 providers에 등록하여 사용.
 *
 * 사용 예시:
 *   // providers.tsx (페이지개발자 영역)
 *   import { ToastContainer, useToastStore } from "@/components/ui";
 *   <ToastContainer />
 *
 *   // 임의 컴포넌트에서
 *   const { addToast } = useToastStore();
 *   addToast({ type: "success", message: "공유 완료!" });
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* ─── 타입 정의 ─── */

export type ToastType = "default" | "success" | "warning" | "error" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  /** 자동 소멸 ms. 기본 default/success/info=3000, warning/error=4000 */
  duration?: number;
}

/* ─── CVA ─── */

const toastVariants = cva(
  [
    "relative flex items-center gap-3 overflow-hidden",
    "w-[calc(100vw-40px)] max-w-[380px]",
    "px-4 py-3 rounded-lg",
    "border-2 border-[var(--color-line)] shadow-[var(--shadow-pop)]",
    "text-sm font-sans",
    "pointer-events-auto",
    "transition-[transform,box-shadow] duration-150 ease-out",
  ],
  {
    variants: {
      type: {
        default: "bg-[var(--color-bg-inverse)] text-[var(--color-text-inverse)]",
        success: "bg-[var(--color-success-subtle)] text-[var(--color-text-primary)]",
        warning: "bg-[var(--color-warning-subtle)] text-[var(--color-text-primary)]",
        error: "bg-[var(--color-error-subtle)] text-[var(--color-text-primary)]",
        info: "bg-[var(--color-info-subtle)] text-[var(--color-text-primary)]",
      },
    },
    defaultVariants: { type: "default" },
  }
);

/* ─── 아이콘 맵 ─── */

function ToastIcon({ type }: { type: ToastType }) {
  const icons: Record<ToastType, React.ReactNode> = {
    default: null,
    success: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    warning: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    error: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
    info: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  };
  return <>{icons[type]}</>;
}

/* ─── 단일 Toast 컴포넌트 ─── */

interface ToastProps extends VariantProps<typeof toastVariants> {
  item: ToastItem;
  onDismiss: (id: string) => void;
}

/* 타입별 좌측 컬러 바 색상 */
const TYPE_BAR_COLOR: Record<ToastType, string> = {
  default: "var(--color-text-muted)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  error: "var(--color-error)",
  info: "var(--color-info)",
};

function ToastCard({ item, onDismiss }: ToastProps) {
  React.useEffect(() => {
    const timeout = setTimeout(
      () => onDismiss(item.id),
      item.duration ?? (item.type === "warning" || item.type === "error" ? 4000 : 3000)
    );
    return () => clearTimeout(timeout);
  }, [item, onDismiss]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={cn(toastVariants({ type: item.type }), "motion-safe:animate-[slideUp_200ms_ease-out]")}
    >
      {/* 좌측 컬러 바 */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
        style={{ background: TYPE_BAR_COLOR[item.type] }}
      />
      <span className="pl-2">
        <ToastIcon type={item.type} />
      </span>
      <p className="flex-1 font-sans leading-normal">{item.message}</p>
      <button
        type="button"
        aria-label="알림 닫기"
        onClick={() => onDismiss(item.id)}
        className={cn(
          "shrink-0 flex items-center justify-center",
          "h-6 w-6 rounded border border-[var(--color-border-subtle)] opacity-70 hover:opacity-100",
          "transition-opacity duration-150",
          "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
        )}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/* ─── Toast Store (간단 상태 관리 — zustand 미사용, 순수 React) ─── */

type ToastListener = (items: ToastItem[]) => void;

class ToastStore {
  private items: ToastItem[] = [];
  private listeners = new Set<ToastListener>();

  subscribe(fn: ToastListener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((fn) => fn([...this.items]));
  }

  addToast(item: Omit<ToastItem, "id">) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.items = [...this.items, { ...item, id }];
    this.emit();
  }

  dismissToast(id: string) {
    this.items = this.items.filter((t) => t.id !== id);
    this.emit();
  }

  getItems() {
    return this.items;
  }
}

export const toastStore = new ToastStore();

/** 컴포넌트 내 toast 추가 헬퍼 */
export function useToastStore() {
  return {
    addToast: (item: Omit<ToastItem, "id">) => toastStore.addToast(item),
  };
}

/* ─── 단일 인라인 Toast (페이지 로컬 state용) ───
 * 페이지가 useState로 toast 메시지를 직접 관리할 때 사용.
 * store 기반 ToastContainer와 별개. message만 truthy면 렌더.
 * design-final §9.3: 색 + 아이콘 + 텍스트 3중. reduced-motion 안전. */

export interface ToastInlineProps {
  /** null/빈 문자열이면 렌더 안 함 */
  message: string | null | undefined;
  /** 시각 타입 (default/success/warning/error/info) */
  variant?: ToastType;
  /** 자동 소멸 ms. 기본 success/info=3000, warning/error=4000 */
  duration?: number;
  /** 소멸 콜백 (자동/수동 공통) */
  onDismiss?: () => void;
  /** 인라인 액션 버튼 (재시도/홈 등) */
  action?: { label: string; onClick: () => void };
}

export function Toast({
  message,
  variant = "default",
  duration,
  onDismiss,
  action,
}: ToastInlineProps) {
  React.useEffect(() => {
    if (!message) return;
    const ms =
      duration ?? (variant === "warning" || variant === "error" ? 4000 : 3000);
    const timeout = setTimeout(() => onDismiss?.(), ms);
    return () => clearTimeout(timeout);
  }, [message, variant, duration, onDismiss]);

  if (!message) return null;

  return (
    <div
      aria-label="알림"
      className={cn(
        "fixed bottom-6 left-0 right-0 z-[var(--z-toast)]",
        "flex flex-col items-center px-5",
        "pointer-events-none"
      )}
    >
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className={cn(
          toastVariants({ type: variant }),
          "motion-safe:animate-[slideUp_200ms_ease-out]"
        )}
      >
        {/* 좌측 컬러 바 */}
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
          style={{ background: TYPE_BAR_COLOR[variant] }}
        />
        <span className="pl-2">
          <ToastIcon type={variant} />
        </span>
        <p className="flex-1 font-sans leading-normal">{message}</p>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className={cn(
              "shrink-0 rounded px-2 py-1 text-sm font-heading underline",
              "min-h-[44px] flex items-center",
              "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
            )}
          >
            {action.label}
          </button>
        )}
        <button
          type="button"
          aria-label="알림 닫기"
          onClick={() => onDismiss?.()}
          className={cn(
            "shrink-0 flex items-center justify-center",
            "h-6 w-6 rounded border border-[var(--color-border-subtle)] opacity-70 hover:opacity-100",
            "transition-opacity duration-150",
            "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ─── ToastContainer — layout/providers에 1회 마운트 ─── */

export function ToastContainer() {
  const [items, setItems] = React.useState<ToastItem[]>(() => toastStore.getItems());

  React.useEffect(() => {
    const unsubscribe = toastStore.subscribe(setItems);
    return () => {
      unsubscribe();
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      aria-label="알림"
      className={cn(
        "fixed bottom-6 left-0 right-0 z-[var(--z-toast)]",
        "flex flex-col items-center gap-2",
        "pointer-events-none px-5"
      )}
    >
      {items.map((item) => (
        <ToastCard
          key={item.id}
          item={item}
          onDismiss={(id) => toastStore.dismissToast(id)}
        />
      ))}
    </div>
  );
}
