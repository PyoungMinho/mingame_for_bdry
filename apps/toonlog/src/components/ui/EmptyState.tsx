"use client";

/**
 * EmptyState — 빈 상태 (P1)
 * design-final §5.2 누락 보강 (ux-spec §8.1).
 * SVG 일러스트 120px + H3(타이틀) + Body(설명) + Primary CTA.
 * 아카이브/검색 공용. semantic 토큰만 사용(다크모드 자동).
 *
 * ⚠️ MVP 임시 일러스트(인라인 SVG). 실 에셋은 디자인 W3 export 후 교체 (design-final §12.1-5).
 *
 * 사용 예시:
 *   <EmptyState message="아직 만화가 없어요" cta="첫 만화 만들기" ctaHref="/diary/new" />
 */

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

export interface EmptyStateProps {
  /** 본문 안내 문구 (\n 줄바꿈 지원) */
  message: string;
  /** 선택: 제목 (없으면 message만 표시) */
  title?: string;
  /** CTA 라벨 */
  cta?: string;
  /** CTA 링크 (ctaHref 또는 onCtaClick 중 하나) */
  ctaHref?: string;
  /** CTA 클릭 핸들러 (ctaHref 미사용 시) */
  onCtaClick?: () => void;
  /** 커스텀 일러스트 (미전달 시 기본 SVG) */
  illustration?: React.ReactNode;
  className?: string;
}

/** MVP 기본 일러스트 — 빈 만화 프레임 (120px, semantic 토큰 stroke) */
function DefaultIllustration() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      className="text-[var(--color-border-strong)]"
    >
      <rect
        x="18"
        y="18"
        width="38"
        height="38"
        rx="4"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeDasharray="5 5"
      />
      <rect
        x="64"
        y="18"
        width="38"
        height="38"
        rx="4"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeDasharray="5 5"
      />
      <rect
        x="18"
        y="64"
        width="38"
        height="38"
        rx="4"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeDasharray="5 5"
      />
      <rect
        x="64"
        y="64"
        width="38"
        height="38"
        rx="4"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeDasharray="5 5"
      />
      {/* 코랄 포인트 — 빈 말풍선 */}
      <circle cx="60" cy="60" r="11" fill="var(--color-primary-subtle)" stroke="var(--color-primary)" strokeWidth="2" />
      <path d="M60 56v8M56 60h8" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyState({
  message,
  title,
  cta,
  ctaHref,
  onCtaClick,
  illustration,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        "px-6 py-12",
        className
      )}
    >
      {/* 일러스트 영역 — 잉크 라인 점선 박스 + 하프톤 장식 */}
      <div
        aria-hidden="true"
        className={cn(
          "relative mb-6 flex items-center justify-center",
          "h-[144px] w-[144px]",
          "rounded-xl border-2 border-dashed border-[var(--color-line)]",
          "bg-[var(--color-bg-subtle)]",
        )}
      >
        <span className="tone-dots-lg absolute inset-0 rounded-xl text-[var(--color-text-muted)] opacity-15" />
        <span className="relative">{illustration ?? <DefaultIllustration />}</span>
      </div>

      {title && (
        <h3 className="mb-1.5 font-display text-xl text-[var(--color-text-primary)]">
          {title}
        </h3>
      )}

      <p className="mb-6 whitespace-pre-line font-sans text-sm text-[var(--color-text-muted)]">
        {message}
      </p>

      {cta && (ctaHref || onCtaClick) && (
        ctaHref ? (
          <Button variant="primary" size="md" asChild>
            <Link href={ctaHref}>{cta}</Link>
          </Button>
        ) : (
          <Button variant="primary" size="md" onClick={onCtaClick}>
            {cta}
          </Button>
        )
      )}
    </div>
  );
}
