"use client";

/**
 * Chip / Tag — selected 상태 필수
 * design-final §5.3 / ui-spec §7.5
 *
 * 사용 예시:
 *   <Chip selected={style === "emotional_line"} onClick={() => setStyle("emotional_line")}>
 *     감성 라인
 *   </Chip>
 *   <Chip variant="tag" size="sm">일상</Chip>
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* ─── CVA ─── */

const chipVariants = cva(
  [
    "inline-flex items-center gap-1 font-heading",
    "border-2 rounded-full",
    "cursor-pointer select-none",
    "transition-[transform,box-shadow,background-color,color] duration-150 ease-out",
    "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
    "disabled:cursor-not-allowed disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        default: "",
        tag: "rounded-sm",
      },
      size: {
        sm: "h-7 px-3 text-[11px]",
        md: "h-9 px-4 text-xs",
      },
      selected: {
        true: [
          "bg-[var(--color-primary)] border-[var(--color-line)]",
          "text-[var(--color-primary-text)] shadow-[var(--shadow-pop-sm)]",
        ],
        false: [
          "bg-[var(--color-surface-raised)] border-[var(--color-line)]",
          "text-[var(--color-text-secondary)]",
          "hover:-translate-y-px hover:shadow-[var(--shadow-pop-sm)] hover:text-[var(--color-text-primary)]",
        ],
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
      selected: false,
    },
  }
);

/* ─── Props ─── */

export interface ChipProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color">,
    VariantProps<typeof chipVariants> {
  /** 선택 상태 */
  selected?: boolean;
  /** 왼쪽 아이콘 */
  icon?: React.ReactNode;
}

/* ─── 컴포넌트 ─── */

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  (
    { variant, size, selected = false, icon, disabled, className, children, onClick, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={selected}
        disabled={disabled}
        onClick={onClick}
        className={cn(chipVariants({ variant, size, selected }), className)}
        {...props}
      >
        {icon && <span aria-hidden="true">{icon}</span>}
        {children}
      </button>
    );
  }
);

Chip.displayName = "Chip";
