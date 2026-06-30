/**
 * Skeleton — shimmer 로딩 플레이스홀더
 * design-final §5.3 / ui-spec §7.9
 * prefers-reduced-motion: shimmer 비활성 (design-final §9.3)
 *
 * 사용 예시:
 *   <Skeleton className="h-4 w-32 rounded-md" />
 *   <Skeleton className="h-12 w-12 rounded-full" /> // 아바타
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, style, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden",
        "bg-[var(--color-bg-muted)]",
        "border-2 border-[var(--color-border-subtle)]",
        "rounded-md",
        // shimmer — motion-safe 로만 적용 (prefers-reduced-motion 자동 대응)
        "motion-safe:animate-[shimmer_800ms_ease-in-out_infinite_alternate]",
        className
      )}
      style={style}
      {...props}
    >
      {/* 하프톤 도트 오버레이 — 리소 질감 */}
      <span
        aria-hidden="true"
        className="tone-dots absolute inset-0 text-[var(--color-text-muted)] opacity-15 pointer-events-none"
      />
    </div>
  );
}

/**
 * 4컷 카드 스켈레톤 — S4 생성 대기 화면용
 * 각 컷 100ms delay 차이로 순차 shimmer
 */
export function ComicCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-label="4컷 만화 로딩 중"
      aria-busy="true"
      className={cn(
        "aspect-square w-full rounded-lg overflow-hidden",
        "border-2 border-[var(--color-line)] shadow-[var(--shadow-pop-sm)]",
        "grid grid-cols-2 grid-rows-2 gap-px bg-[var(--color-line)]",
        className
      )}
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton
          key={i}
          className="rounded-none w-full h-full"
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  );
}

/**
 * 일기 목록 아이템 스켈레톤
 */
export function DiaryListItemSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 p-4", className)} aria-hidden="true">
      {/* 아바타 */}
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      {/* 텍스트 2줄 */}
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
      </div>
    </div>
  );
}
