"use client";

/**
 * Textarea — 일기 입력 전용
 * - 종이 줄 질감 배경 (CSS repeating-linear-gradient)
 * - 글자 수 카운터 n/300, 50~300자 검증
 * - aria-live="polite" 접근성
 * - 야간 다크 최적화 (토큰으로 자동)
 * design-final §5.3, §9.2, §10 충돌해소 #1 / ui-spec §7.2
 * 글자수 범위: DIARY_TEXT_MIN(50) ~ DIARY_TEXT_MAX(300) — constants.ts
 *
 * 사용 예시:
 *   <Textarea
 *     label="오늘 일기"
 *     value={text}
 *     onChange={e => setText(e.target.value)}
 *   />
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { DIARY_TEXT_MIN, DIARY_TEXT_MAX } from "@/lib/constants";

/* ─── Props ─── */

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "maxLength"> {
  /** 필드 레이블 */
  label?: string;
  /** 에러 메시지 */
  error?: string;
  /** 최소 글자 수 (기본 DIARY_TEXT_MIN=50) */
  minLength?: number;
  /** 최대 글자 수 (기본 DIARY_TEXT_MAX=300) */
  maxLength?: number;
  /** 카운터 숨김 */
  hideCounter?: boolean;
}

/* ─── 컴포넌트 ─── */

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      minLength = DIARY_TEXT_MIN,
      maxLength = DIARY_TEXT_MAX,
      hideCounter = false,
      disabled,
      className,
      id,
      value,
      defaultValue,
      onChange,
      placeholder = "오늘 어떤 일이 있었나요? 50자 이상 적어주세요.",
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const counterId = `${inputId}-counter`;
    const errorId = error ? `${inputId}-error` : undefined;

    // 내부 글자 수 추적 (controlled / uncontrolled 모두 대응)
    const [internalLength, setInternalLength] = React.useState(() => {
      if (value !== undefined) return String(value).length;
      if (defaultValue !== undefined) return String(defaultValue).length;
      return 0;
    });

    const currentLength =
      value !== undefined ? String(value).length : internalLength;

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInternalLength(e.target.value.length);
      onChange?.(e);
    };

    const isOverMax = currentLength > maxLength;
    const isUnderMin = currentLength > 0 && currentLength < minLength;
    const hasError = Boolean(error) || isOverMax;

    // 카운터 색상: 초과 시 warning, 에러 시 error
    const counterColor = isOverMax
      ? "text-[var(--color-error)]"
      : currentLength >= maxLength * 0.9
      ? "text-[var(--color-warning)]"
      : "text-[var(--color-text-muted)]";

    // 카운터 스크린리더 라이브 텍스트
    const liveText = isOverMax
      ? `${currentLength}자 — ${maxLength}자 초과`
      : `${currentLength}자 / ${maxLength}자`;

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

        <div className="relative">
          <textarea
            ref={ref}
            id={inputId}
            disabled={disabled}
            value={value}
            defaultValue={defaultValue}
            onChange={handleChange}
            placeholder={placeholder}
            aria-invalid={hasError}
            aria-describedby={
              [counterId, errorId].filter(Boolean).join(" ") || undefined
            }
            // 야간 다크 최적화: 다크 토큰 변수가 globals.css에 정의되어 있어 자동 대응
            className={cn(
              // 레이아웃
              "w-full min-h-[200px] max-h-[480px]",
              // pt/줄높이는 줄 배경 주기(32px)의 배수로 맞춰 글자가 줄 위에 얹히게 함
              "px-4 pt-8 pb-8",
              "resize-none overflow-y-auto",
              // 폰트 — line-height를 종이 줄 간격(32px)과 정확히 일치(취소선 겹침 방지)
              "font-sans text-base font-normal leading-[32px]",
              "text-[var(--color-text-primary)]",
              "placeholder:text-[var(--color-text-muted)]",
              // 테두리 & 배경
              "rounded-lg border-2 border-[var(--color-line)]",
              hasError
                ? "border-[var(--color-border-error)] bg-[var(--color-error-subtle)] shadow-[var(--shadow-focus-error)]"
                : "bg-[var(--color-surface-raised)]",
              !hasError && "hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-pop-sm)]",
              !hasError &&
                "focus:shadow-[var(--shadow-pop-sm)] focus:bg-[var(--color-surface-raised)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
              // 종이 줄 질감 (CSS 커스텀 프로퍼티로 opacity 제어)
              "[background-image:repeating-linear-gradient(transparent,transparent_31px,var(--color-border-default)_31px,var(--color-border-default)_32px)]",
              "[background-attachment:local]",
              // 전환
              "transition-[transform,box-shadow,border-color] duration-150 ease-out",
              "outline-none",
              "disabled:bg-[var(--color-bg-muted)] disabled:text-[var(--color-text-disabled)] disabled:cursor-not-allowed",
              // 다크모드 야간 줄 opacity 조정 (토큰 기반 자동)
              "dark:[background-image:repeating-linear-gradient(transparent,transparent_31px,color-mix(in_srgb,var(--color-border-default)_40%,transparent)_31px,color-mix(in_srgb,var(--color-border-default)_40%,transparent)_32px)]",
              className
            )}
            {...props}
          />

          {/* 글자 수 카운터 — 우하단 */}
          {!hideCounter && (
            <div className="absolute bottom-3 right-3 flex items-center gap-1 pointer-events-none">
              {isOverMax && (
                <span
                  className="text-[10px] font-english text-[var(--color-error)]"
                  aria-hidden="true"
                >
                  {maxLength}자 초과
                </span>
              )}
              {isUnderMin && !isOverMax && (
                <span
                  className="text-[10px] font-english text-[var(--color-warning)]"
                  aria-hidden="true"
                >
                  {minLength}자 이상
                </span>
              )}
              <span
                className={cn("text-xs font-english tabular-nums", counterColor)}
                aria-hidden="true"
              >
                {currentLength}/{maxLength}
              </span>
            </div>
          )}
        </div>

        {/* 스크린리더용 라이브 카운터 — 시각적으로 숨김 */}
        <span
          id={counterId}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {liveText}
        </span>

        {error && (
          <p
            id={errorId}
            role="alert"
            className="text-xs text-[var(--color-error)] leading-normal"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
