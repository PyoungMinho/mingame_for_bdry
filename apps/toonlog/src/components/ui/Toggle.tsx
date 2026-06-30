"use client";

/**
 * Toggle — 스위치 토글 (P1)
 * design-final §5.1 (다크모드/알림 등 S9 마이페이지).
 * role=switch + aria-checked. 터치 타깃 44px 보장(트랙은 작아도 hit-area 확장).
 * on/off 상태는 색 + 노브 위치 2중 (색각 대응 §9.3).
 *
 * 사용 예시:
 *   <Toggle checked={isDark} onChange={setDark} aria-label="다크 모드" />
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** 접근성 라벨 (필수 — 시각 라벨이 별도 표기될 때) */
  "aria-label"?: string;
  className?: string;
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        // 44px 터치 hit-area (트랙은 시각적으로 작게, 패딩으로 영역 확보)
        "relative inline-flex h-11 w-[52px] items-center justify-center shrink-0",
        "cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
        className
      )}
    >
      {/* 트랙 */}
      <span
        className={cn(
          "relative h-6 w-11 rounded-full",
          "border-2 border-[var(--color-line)]",
          "transition-[background-color,box-shadow] duration-150 ease-out",
          checked
            ? "bg-[var(--color-primary)]"
            : "bg-[var(--color-bg-muted)]"
        )}
      >
        {/* 노브 — 위치로 on/off 표현 (색 외 정보) */}
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full",
            "border-2 border-[var(--color-line)]",
            "bg-[var(--color-surface-raised)]",
            "shadow-[var(--shadow-pop-xs)]",
            "transition-transform duration-150 ease-out",
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          )}
          aria-hidden="true"
        />
      </span>
    </button>
  );
}
