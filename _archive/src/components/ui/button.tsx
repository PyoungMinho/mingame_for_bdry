// REDLINE: 외모/체형 비교 UI 금지. 타인 점수 노출 금지.

"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ── Props 인터페이스 ──────────────────────────────────────────────────
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Radix Slot — asChild=true 시 자식 엘리먼트로 렌더 */
  asChild?: boolean;
  /** 로딩 상태 — 인라인 스피너 표시, 클릭 비활성 */
  loading?: boolean;
}

// ── CVA Variants ──────────────────────────────────────────────────────
/**
 * 버튼 CVA — ui-spec.md §3-1
 * 4 Variant × 3 Size = 12조합
 */
const buttonVariants = cva(
  // base
  [
    "inline-flex items-center justify-center gap-2",
    "font-sans font-medium",
    "rounded-md",
    "select-none",
    "transition-all duration-fast",
    // 터치 타겟 최소 44×44px (design-final.md §4-3)
    "min-h-[44px] min-w-[44px]",
    // 포커스 링 (ui-spec.md §8)
    "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-[0_0_0_3px_rgba(255,122,41,0.5)]",
    // disabled
    "disabled:opacity-[0.38] disabled:pointer-events-none disabled:cursor-not-allowed",
  ],
  {
    variants: {
      variant: {
        /** 메인 CTA — accent-500 배경, 흰색 텍스트 */
        primary: [
          "bg-accent-500 text-white",
          "hover:brightness-105",
          "active:scale-[0.97]",
        ],
        /** 보조 액션 — primary-50 배경, primary-800 텍스트, primary-200 테두리 */
        secondary: [
          "bg-primary-50 text-primary-800 border border-primary-200",
          "hover:bg-primary-100",
          "active:scale-[0.97]",
        ],
        /** 인라인 텍스트 액션 — 투명 배경 */
        ghost: [
          "bg-transparent text-primary-800",
          "hover:bg-gray-100",
          "active:scale-[0.97]",
        ],
        /** 삭제·철회 — error 계열 */
        destructive: [
          "bg-[#FDE8E8] text-[#7A1A1A] border border-[#DC2626]",
          "hover:bg-[#FAD0D0]",
          "active:scale-[0.97]",
        ],
      },
      size: {
        /** height 36px, px 12 */
        sm: ["h-9 px-3", "text-label text-[13px]"],
        /** height 44px, px 16 — 기본값 */
        md: ["h-11 px-4", "text-label text-[13px]"],
        /** height 52px, px 24 */
        lg: ["h-[52px] px-6", "text-[15px] font-semibold"],
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

// ── 로딩 스피너 ──────────────────────────────────────────────────────
const Spinner: React.FC = () => (
  <svg
    className="animate-spin h-4 w-4 shrink-0"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
);

// ── 컴포넌트 ──────────────────────────────────────────────────────────
/**
 * 오름 Button 컴포넌트
 *
 * @example
 * <Button variant="primary" size="lg">체크인 시작</Button>
 * <Button variant="secondary" loading>저장 중</Button>
 * <Button asChild><Link href="/pro">Pro 업그레이드</Link></Button>
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";

    return (
      <motion.div
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
        // 스프링 버튼 (ui-spec.md §7)
        className="inline-flex"
      >
        <Comp
          ref={ref}
          disabled={disabled || loading}
          aria-disabled={disabled || loading}
          aria-busy={loading}
          className={cn(buttonVariants({ variant, size }), className)}
          {...props}
        >
          {loading && <Spinner />}
          {children}
        </Comp>
      </motion.div>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
