"use client";

/**
 * TextInput — 6상태 (default / hover / focus / filled / error / disabled)
 * design-final §5.3 / ui-spec §7.2
 *
 * 사용 예시:
 *   <TextInput label="닉네임" placeholder="툰일기 이름" />
 *   <TextInput label="이메일" error="올바른 이메일 형식을 입력해 주세요." />
 */

import * as React from "react";
import { cn } from "@/lib/utils";

/* ─── Props ─── */

export interface TextInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** 필드 레이블 */
  label?: string;
  /** 에러 메시지 (에러 상태 전환) */
  error?: string;
  /** 보조 힌트 텍스트 */
  hint?: string;
  /** 좌측 인라인 아이콘 */
  leftAddon?: React.ReactNode;
  /** 우측 인라인 아이콘/버튼 */
  rightAddon?: React.ReactNode;
  /** input size — sm(40px) / md(48px, 기본) */
  inputSize?: "sm" | "md";
}

/* ─── 컴포넌트 ─── */

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      label,
      error,
      hint,
      leftAddon,
      rightAddon,
      inputSize = "md",
      disabled,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const hintId = hint ? `${inputId}-hint` : undefined;

    const hasError = Boolean(error);

    const inputBase = [
      "w-full bg-[var(--color-surface-raised)] text-[var(--color-text-primary)]",
      "border-2 border-[var(--color-line)] rounded-lg",
      "font-sans text-base",
      "placeholder:text-[var(--color-text-muted)]",
      "transition-[transform,box-shadow,border-color] duration-150 ease-out",
      "outline-none",
      "disabled:bg-[var(--color-bg-muted)] disabled:text-[var(--color-text-disabled)] disabled:cursor-not-allowed disabled:opacity-60",
    ];

    const stateClasses = hasError
      ? [
          "border-[var(--color-border-error)] bg-[var(--color-error-subtle)]",
          "shadow-[var(--shadow-focus-error)]",
        ]
      : [
          "hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-pop-sm)]",
          "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] focus-visible:bg-[var(--color-surface-raised)]",
          "focus:shadow-[var(--shadow-pop-sm)] focus:bg-[var(--color-surface-raised)]",
        ];

    const sizeClasses =
      inputSize === "sm"
        ? ["h-10", leftAddon ? "pl-10 pr-3" : "px-4", rightAddon ? "pr-10" : ""]
        : ["h-12 py-[14px]", leftAddon ? "pl-11 pr-4" : "px-4", rightAddon ? "pr-11" : ""];

    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-heading text-[var(--color-text-secondary)] leading-tight"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftAddon && (
            <span className="absolute left-3 flex items-center text-[var(--color-text-muted)] pointer-events-none">
              {leftAddon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={
              [errorId, hintId].filter(Boolean).join(" ") || undefined
            }
            className={cn(...inputBase, ...stateClasses, ...sizeClasses, className)}
            {...props}
          />

          {rightAddon && (
            <span className="absolute right-3 flex items-center text-[var(--color-text-muted)]">
              {rightAddon}
            </span>
          )}
        </div>

        {error && (
          <p
            id={errorId}
            role="alert"
            className="text-xs text-[var(--color-error)] leading-normal mt-[-4px]"
          >
            {error}
          </p>
        )}

        {hint && !error && (
          <p
            id={hintId}
            className="text-xs text-[var(--color-text-muted)] leading-normal mt-[-4px]"
          >
            {hint}
          </p>
        )}
      </div>
    );
  }
);

TextInput.displayName = "TextInput";
