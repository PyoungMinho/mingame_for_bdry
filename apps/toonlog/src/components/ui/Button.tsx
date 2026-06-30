"use client";

/**
 * Button — 5변형 (Primary / Secondary / Ghost / Danger / Icon)
 * design-final §5.3 / ui-spec §7.1
 *
 * 사용 예시:
 *   <Button variant="primary" size="md">만화 만들기</Button>
 *   <Button variant="icon" size="md" aria-label="닫기"><XIcon /></Button>
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* ─── CVA 정의 ─── */

const buttonVariants = cva(
  // 공통 base — 리소: 잉크 아웃라인 + 하드 오프셋 그림자 + 도장 눌림
  [
    "relative inline-flex items-center justify-center gap-2",
    "font-heading tracking-wide",
    "rounded-lg outline-none",
    "transition-[transform,box-shadow,background-color,color,border-color] duration-100 ease-out",
    "cursor-pointer select-none",
    "focus-visible:shadow-[var(--shadow-focus)]",
    "disabled:cursor-not-allowed disabled:opacity-60",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-[var(--color-primary)] text-[var(--color-primary-text)]",
          "border-2 border-[var(--color-line)] shadow-[var(--shadow-pop)]",
          "hover:bg-[var(--color-primary-hover)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-pop-lg)]",
          "active:translate-x-[2px] active:translate-y-[2px] active:shadow-[var(--shadow-pop-sm)]",
          "disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[var(--shadow-pop-sm)]",
        ],
        secondary: [
          "bg-[var(--color-surface-raised)] text-[var(--color-text-primary)]",
          "border-2 border-[var(--color-line)] shadow-[var(--shadow-pop)]",
          "hover:bg-[var(--color-bg-subtle)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-pop-lg)]",
          "active:translate-x-[2px] active:translate-y-[2px] active:shadow-[var(--shadow-pop-sm)]",
          "disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[var(--shadow-pop-sm)]",
        ],
        ghost: [
          "bg-transparent text-[var(--color-primary)] border-2 border-transparent",
          "hover:bg-[var(--color-primary-subtle)] hover:text-[var(--color-primary-hover)]",
          "active:translate-y-px active:bg-[var(--color-primary-subtle)]",
          "disabled:text-[var(--color-text-disabled)]",
        ],
        danger: [
          "bg-[var(--color-error)] text-[var(--color-primary-text)]",
          "border-2 border-[var(--color-line)] shadow-[var(--shadow-pop)]",
          "hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-pop-lg)]",
          "active:translate-x-[2px] active:translate-y-[2px] active:shadow-[var(--shadow-pop-sm)]",
          "disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[var(--shadow-pop-sm)]",
        ],
        icon: [
          "bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)]",
          "border-2 border-[var(--color-line)] shadow-[var(--shadow-pop-sm)]",
          "hover:text-[var(--color-text-primary)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-pop)]",
          "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        ],
      },
      size: {
        sm: "h-10 px-4 text-sm min-w-[88px]",
        md: "h-12 px-6 text-base min-w-[120px]",
        lg: "h-14 px-8 text-md min-w-[160px]",
      },
    },
    compoundVariants: [
      // Icon 변형은 정사각형 — min-w 덮어쓰기
      {
        variant: "icon",
        size: "sm",
        className: "h-10 w-10 min-w-0 p-0 rounded-lg",
      },
      {
        variant: "icon",
        size: "md",
        className: "h-12 w-12 min-w-0 p-0 rounded-lg",
      },
      {
        variant: "icon",
        size: "lg",
        className: "h-14 w-14 min-w-0 p-0 rounded-lg",
      },
    ],
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

/* ─── 스피너 (loading 상태용) ─── */
function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
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
}

/* ─── Props ─── */

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** 로딩 스피너 표시 + 인터랙션 차단 */
  loading?: boolean;
  /** 버튼 앞 아이콘 (ReactNode) */
  leftIcon?: React.ReactNode;
  /** 버튼 뒤 아이콘 */
  rightIcon?: React.ReactNode;
  /**
   * 자식 엘리먼트(예: next/link <Link>)에 버튼 스타일을 위임.
   * <button> 대신 단일 자식을 렌더하고 className/props를 병합한다.
   * (Radix Slot 미사용 경량 구현 — anchor-in-button 무효 마크업 방지)
   */
  asChild?: boolean;
}

/* ─── 컴포넌트 ─── */

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant,
      size,
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      className,
      children,
      asChild = false,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    const mergedClassName = cn(buttonVariants({ variant, size }), className);

    // asChild: 단일 자식 엘리먼트에 스타일/props 위임 (예: <Link>)
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{
        className?: string;
        children?: React.ReactNode;
      }>;
      return React.cloneElement(
        child,
        {
          // @ts-expect-error — ref 병합 (Link/anchor)
          ref,
          className: cn(mergedClassName, child.props.className),
          "aria-disabled": isDisabled || undefined,
          ...props,
        },
        <span className="inline-flex items-center gap-1.5">
          {leftIcon}
          {child.props.children}
          {rightIcon}
        </span>
      );
    }

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading}
        className={mergedClassName}
        {...props}
      >
        {loading && (
          <Spinner className="absolute h-5 w-5 text-current" />
        )}
        <span
          className={cn("inline-flex items-center gap-1.5", loading && "invisible")}
        >
          {leftIcon}
          {children}
          {rightIcon}
        </span>
      </button>
    );
  }
);

Button.displayName = "Button";
