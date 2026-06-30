"use client";

/**
 * Card — 기본 카드 + 4컷 만화 카드 변형
 * design-final §5.3 / ui-spec §7.3
 *
 * 사용 예시:
 *   // 기본 카드
 *   <Card>내용</Card>
 *
 *   // 4컷 만화 카드 (2×2 그리드)
 *   <ComicCard panels={panels} alt="2026년 6월 3일 일기" />
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type { Panel } from "@/lib/contract";

/* ─── 기본 Card ─── */

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 호버 상승 효과 */
  hoverable?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ hoverable = false, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-[var(--color-surface-raised)]",
          "rounded-xl border-2 border-[var(--color-line)]",
          "p-4 shadow-[var(--shadow-pop-sm)]",
          "transition-[box-shadow,transform] duration-150 ease-out",
          hoverable && [
            "cursor-pointer",
            "hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-pop-lg)]",
            "active:translate-x-[2px] active:translate-y-[2px] active:shadow-[var(--shadow-pop-sm)]",
          ],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

/* ─── ComicCard — 4컷 만화 카드 ─── */

export interface ComicCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 4개 패널 데이터. 부족하면 Skeleton으로 채움 */
  panels: (Panel | null)[];
  /** 카드 전체 접근성 레이블 */
  alt?: string;
  /** 개별 컷 클릭 콜백 */
  onPanelClick?: (panelIndex: number) => void;
}

export function ComicCard({
  panels,
  alt,
  onPanelClick,
  className,
  ...props
}: ComicCardProps) {
  return (
    <figure
      role="img"
      aria-label={alt ?? "4컷 만화"}
      className={cn(
        "bg-[var(--color-surface-raised)]",
        "rounded-lg border-[3px] border-[var(--color-line)]",
        "shadow-[var(--shadow-pop-lg)]",
        "overflow-hidden aspect-square",
        className
      )}
      {...props}
    >
      {/* 2×2 그리드 */}
      <div className="grid grid-cols-2 grid-rows-2 h-full w-full">
        {Array.from({ length: 4 }).map((_, i) => {
          const panel = panels[i] ?? null;
          return (
            <div
              key={i}
              className={cn(
                "relative overflow-hidden",
                // 1px 흰 구분선 (ink border 안쪽)
                i % 2 === 0 ? "border-r-2 border-[var(--color-line)]" : "",
                i < 2 ? "border-b-2 border-[var(--color-line)]" : ""
              )}
              onClick={() => onPanelClick?.(i)}
              role={onPanelClick ? "button" : undefined}
              tabIndex={onPanelClick ? 0 : undefined}
              aria-label={onPanelClick ? `${i + 1}번 컷 편집` : undefined}
              onKeyDown={
                onPanelClick
                  ? (e) => e.key === "Enter" && onPanelClick(i)
                  : undefined
              }
            >
              {panel?.previewUrl || panel?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={panel.previewUrl ?? panel.imageUrl}
                  alt={panel.caption ?? `${i + 1}번 컷`}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                /* 빈 컷 플레이스홀더 — 하프톤 점묘 + 잉크 넘버 */
                <div className="relative w-full h-full bg-[var(--color-bg-muted)] flex items-center justify-center">
                  <span
                    aria-hidden="true"
                    className="tone-dots absolute inset-0 text-[var(--color-text-muted)] opacity-20"
                  />
                  <span className="relative font-english text-2xl text-[var(--color-text-disabled)]">
                    {i + 1}
                  </span>
                </div>
              )}

              {/* 컷 번호 배지 */}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-1.5 left-1.5",
                  "flex items-center justify-center",
                  "h-6 w-6 rounded-full border-2 border-[var(--color-line)]",
                  "font-english text-[11px] leading-none -rotate-6",
                  panel
                    ? "bg-[var(--color-lemon)] text-[var(--color-ink)] shadow-[var(--shadow-pop-xs)]"
                    : "bg-[var(--color-bg-muted)] text-[var(--color-text-disabled)]"
                )}
              >
                {i + 1}
              </span>
            </div>
          );
        })}
      </div>

      {/* 스크린리더용 캡션 */}
      {alt && <figcaption className="sr-only">{alt}</figcaption>}
    </figure>
  );
}
