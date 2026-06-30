"use client";

/**
 * StreakBadge — 연속 기록 배지 (P1)
 * design-final §5.2 누락 보강 + 플로우C 리텐션 훅.
 * 색 + 아이콘(🔥) + 텍스트 3중 (§9.3 색각 대응 — 색에만 의존 금지).
 * 7/30/100일 마일스톤 분기 카피.
 *
 * 사용 예시:
 *   <StreakBadge days={7} />   // "7일 연속 기록 중!"
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface StreakBadgeProps {
  /** 연속 기록 일수 */
  days: number;
  className?: string;
}

/** 마일스톤 분기 — 7/30/100일에서 강조 톤 상승 */
function getMilestone(days: number): {
  label: string;
  suffix: string;
  bg: string;
  text: string;
  border: string;
  shadow: string;
  rotate: string;
} {
  if (days >= 100) {
    return {
      label: String(days),
      suffix: "일 연속 — 전설의 기록!",
      bg: "bg-[var(--color-lemon)]",
      text: "text-[var(--color-ink)]",
      border: "border-[var(--color-line)]",
      shadow: "shadow-[var(--shadow-pop-sm)]",
      rotate: "-rotate-2",
    };
  }
  if (days >= 30) {
    return {
      label: String(days),
      suffix: "일 연속 기록 중!",
      bg: "bg-[var(--color-primary-subtle)]",
      text: "text-[var(--color-primary)]",
      border: "border-[var(--color-line)]",
      shadow: "shadow-[var(--shadow-pop-sm)]",
      rotate: "-rotate-1",
    };
  }
  if (days >= 7) {
    return {
      label: String(days),
      suffix: "일 연속 기록 중!",
      bg: "bg-[var(--color-warning-subtle)]",
      text: "text-[var(--color-warning)]",
      border: "border-[var(--color-line)]",
      shadow: "shadow-[var(--shadow-pop-xs)]",
      rotate: "",
    };
  }
  return {
    label: String(days),
    suffix: "일 연속 기록 중",
    bg: "bg-[var(--color-surface-raised)]",
    text: "text-[var(--color-text-secondary)]",
    border: "border-[var(--color-line)]",
    shadow: "shadow-[var(--shadow-pop-xs)]",
    rotate: "",
  };
}

export function StreakBadge({ days, className }: StreakBadgeProps) {
  const m = getMilestone(days);

  return (
    <div
      role="status"
      aria-label={`연속 ${days}일 기록 중`}
      className={cn(
        "inline-flex items-center gap-1.5",
        "h-9 px-4 rounded-full",
        "border-2",
        m.bg,
        m.text,
        m.border,
        m.shadow,
        m.rotate,
        "motion-safe:transition-[transform,box-shadow] motion-safe:duration-150",
        className
      )}
    >
      {/* 아이콘 — 색 외 정보 1 (불꽃) */}
      <span aria-hidden="true" className="text-base leading-none">
        🔥
      </span>
      {/* 숫자 강조 — font-english / 텍스트 — font-heading */}
      <span className="font-english text-base leading-none">{m.label}</span>
      <span className="font-heading text-xs">{m.suffix}</span>
    </div>
  );
}
