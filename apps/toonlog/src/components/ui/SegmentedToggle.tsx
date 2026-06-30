"use client";

/**
 * SegmentedToggle — 2~3 세그먼트 토글 (P1)
 * design-final §5.2 보강. 월간/연간(S9b), 캘린더/그리드(S8), 공유 비율(S7).
 * selected = --color-primary-subtle (§5.2 스펙). 셀 높이 44px(터치 타깃 §9.3).
 * role=radiogroup + aria-checked (스크린리더 대응).
 *
 * 사용 예시:
 *   <SegmentedToggle
 *     options={[{value:"calendar",label:"캘린더"},{value:"grid",label:"그리드"}]}
 *     value={view} onChange={setView} aria-label="뷰 전환" />
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentedOption {
  value: string;
  label: string;
}

export interface SegmentedToggleProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  /** 접근성 라벨 (radiogroup) */
  "aria-label"?: string;
  className?: string;
}

export function SegmentedToggle({
  options,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: SegmentedToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex w-full items-center gap-0.5 rounded-full p-0.5",
        "border-2 border-[var(--color-line)]",
        "bg-[var(--color-bg-muted)]",
        className
      )}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 min-h-[44px] rounded-full px-3 text-sm font-heading",
              "transition-[transform,box-shadow,background-color,color] duration-150 ease-out",
              "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
              selected
                ? [
                    "bg-[var(--color-primary)] text-[var(--color-primary-text)]",
                    "border-2 border-[var(--color-line)] shadow-[var(--shadow-pop-xs)]",
                  ]
                : [
                    "text-[var(--color-text-secondary)]",
                    "hover:-translate-y-px hover:text-[var(--color-text-primary)] hover:shadow-[var(--shadow-pop-xs)]",
                  ]
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
