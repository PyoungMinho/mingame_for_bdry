/**
 * AIDisclosureBadge — AI 생성 고지 배지 (전 티어 필수, 제거 불가)
 * design-final §8.2 / 한국 AI 기본법 대응
 * AI_DISCLOSURE_BADGE_TEXT = "AI 생성" (constants.ts)
 *
 * ⚠️ 법무 의무 — 프로 티어에서도 제거 금지.
 *    WatermarkOverlay와 별개 요소 (design-final §8.2 명시)
 *
 * 사용 예시:
 *   // 앱 내 미리보기
 *   <AIDisclosureBadge variant="preview" />
 *
 *   // 공유 카드 하단 (항상 라이트 고정 — Satori 기준)
 *   <AIDisclosureBadge variant="card" />
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { AI_DISCLOSURE_BADGE_TEXT, AI_DISCLOSURE_TEXT } from "@/lib/constants";

/* ─── Props ─── */

export interface AIDisclosureBadgeProps {
  /**
   * preview: 앱 내 미리보기용 소형 배지 (12px, info-subtle 배경)
   * card: 공유 카드 하단 전문 고지 (10px, 라이트 고정)
   */
  variant?: "preview" | "card";
  className?: string;
}

/* ─── 컴포넌트 ─── */

export function AIDisclosureBadge({
  variant = "preview",
  className,
}: AIDisclosureBadgeProps) {
  if (variant === "preview") {
    return (
      <div
        role="note"
        aria-label={`AI 생성 이미지: ${AI_DISCLOSURE_BADGE_TEXT}`}
        className={cn(
          "inline-flex items-center gap-1",
          "px-2.5 py-0.5 rounded-full",
          "border-2 border-[var(--color-line)]",
          "bg-[var(--color-accent-subtle)]",
          "text-[var(--color-ink)]",
          "text-[11px] font-heading leading-tight",
          "shadow-[var(--shadow-pop-xs)]",
          "tilt-r",
          "select-none pointer-events-none",
          className
        )}
      >
        {/* AI 아이콘 */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
        </svg>
        <span>{AI_DISCLOSURE_BADGE_TEXT}</span>
      </div>
    );
  }

  // variant === "card" — 공유 카드 하단 전문 고지 (라이트 고정)
  return (
    <p
      role="note"
      aria-label={AI_DISCLOSURE_TEXT}
      // Satori/공유카드는 라이트 고정 — 다크모드 토큰 사용 불가, 하드코딩
      className={cn(
        "text-[10px] font-sans",
        "leading-normal tracking-wide",
        // 배경 대비 3:1 보장 (design-final §8.2) — 라이트 고정
        "text-[rgba(26,26,26,0.85)]",
        "select-none pointer-events-none",
        className
      )}
    >
      {AI_DISCLOSURE_TEXT}
    </p>
  );
}
