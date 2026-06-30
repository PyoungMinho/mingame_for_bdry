"use client";

/**
 * BottomSheet — 드래그 핸들 + 백드롭 + 스크롤 지원
 * design-final §5.3 / ui-spec §7.4
 *
 * 사용 예시:
 *   <BottomSheet open={open} onClose={() => setOpen(false)} title="화풍 선택">
 *     <p>콘텐츠</p>
 *   </BottomSheet>
 */

import * as React from "react";
import { cn } from "@/lib/utils";

/* ─── Props ─── */

export interface BottomSheetProps {
  /** 열림 상태 */
  open: boolean;
  /** 닫힘 콜백 */
  onClose: () => void;
  /** 시트 타이틀 (선택) */
  title?: string;
  /** 내부 콘텐츠 */
  children: React.ReactNode;
  /** 추가 className (내부 시트 패널) */
  className?: string;
}

/* ─── 컴포넌트 ─── */

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  className,
}: BottomSheetProps) {
  // 포커스 트랩 & ESC 닫기
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // body 스크롤 잠금
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* 백드롭 */}
      <div
        role="presentation"
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "fixed inset-0 bg-[var(--color-surface-overlay)]",
          "z-[var(--z-modal)]",
          "transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        style={{ backdropFilter: open ? "blur(2px)" : undefined }}
      />

      {/* 시트 패널 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "바텀시트"}
        className={cn(
          "fixed bottom-0 left-0 right-0",
          "bg-[var(--color-surface-raised)]",
          "rounded-t-2xl border-2 border-b-0 border-[var(--color-line)]",
          "shadow-[var(--shadow-pop-lg)]",
          "max-h-[90dvh] flex flex-col",
          "z-[var(--z-modal)]",
          "transition-transform duration-500 ease-out",
          "motion-reduce:transition-none",
          open ? "translate-y-0" : "translate-y-full",
          className
        )}
      >
        {/* 드래그 핸들 — 잉크색 알약 */}
        <div
          className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing shrink-0"
          aria-hidden="true"
        >
          <div className="w-10 h-1.5 rounded-full bg-[var(--color-line)]" />
        </div>

        {/* 헤더 */}
        {title && (
          <div className="flex items-center justify-between px-5 pb-3 pt-1 shrink-0">
            <h2 className="font-heading text-md text-[var(--color-text-primary)] leading-snug">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className={cn(
                "flex items-center justify-center",
                "h-11 w-11 rounded-lg",
                "text-[var(--color-text-muted)]",
                "border-2 border-transparent",
                "transition-[transform,box-shadow,border-color] duration-150 ease-out",
                "hover:border-[var(--color-line)] hover:shadow-[var(--shadow-pop-xs)]",
                "active:translate-x-[2px] active:translate-y-[2px]",
                "focus-visible:shadow-[var(--shadow-focus)] outline-none"
              )}
            >
              {/* X 아이콘 — lucide-react 없이 인라인 SVG */}
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* 콘텐츠 — 스크롤 가능 */}
        <div className="overflow-y-auto overscroll-contain flex-1 px-5 pb-safe-area pb-6">
          {children}
        </div>
      </div>
    </>
  );
}
