"use client";

/**
 * ProgressBar + GeneratingUI (생성 대기 UI)
 * design-final §5.3, §4 이탈방지 핵심 / ui-spec §7.10
 *
 * - ProgressBar: 범용 진행 바 (role=progressbar, aria 속성 완비)
 * - GeneratingUI: 4컷 스켈레톤 + 단계 표시 + 팁 로테이션 슬롯
 *   (SSE ToonlogSSEEvent['tip']을 currentTip으로 주입)
 *
 * 사용 예시:
 *   // 단독 바
 *   <ProgressBar value={60} max={100} />
 *
 *   // 생성 대기 전체
 *   <GeneratingUI
 *     completedPanels={2}
 *     stage="drawing"
 *     currentTip="아바타 얼굴을 일관되게 그리는 중이에요."
 *     onCancel={() => router.back()}
 *   />
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type { JobStage } from "@/lib/contract";
import { Skeleton } from "./Skeleton";

/* ─── ProgressBar ─── */

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  /** 세그먼트 색상 (기본: coral → lemon 그라디언트) */
  gradient?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  gradient = true,
  className,
  ...props
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={`진행률 ${Math.round(pct)}%`}
      className={cn(
        "relative w-full h-3 rounded-full overflow-hidden",
        "border-2 border-[var(--color-line)]",
        "bg-[var(--color-bg-muted)]",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "relative h-full rounded-full transition-[width] ease-linear overflow-hidden",
          gradient
            ? "bg-gradient-to-r from-[var(--color-coral)] to-[var(--color-lemon)]"
            : "bg-[var(--color-primary)]"
        )}
        style={{ width: `${pct}%`, transitionDuration: "300ms" }}
        aria-hidden="true"
      >
        {/* 하프톤 오버레이 — 리소 질감 */}
        <span
          aria-hidden="true"
          className="tone-lines absolute inset-0 text-[var(--color-line)] opacity-10"
        />
      </div>
    </div>
  );
}

/* ─── 단계 레이블 ─── */

const STAGE_LABELS: Record<JobStage, string> = {
  queued: "대기 중...",
  splitting: "장면을 나누는 중...",
  drawing: "그림을 그리는 중...",
  checking: "캐릭터 얼굴을 확인하는 중...",
  finalizing: "마무리 작업 중...",
};

function PanelStep({
  index,
  isCompleted,
  isActive,
}: {
  index: number;
  isCompleted: boolean;
  isActive: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        aria-hidden="true"
        className={cn(
          "flex items-center justify-center",
          "h-6 w-6 rounded-full border-2 transition-colors duration-300",
          isCompleted
            ? "bg-[var(--color-primary)] border-[var(--color-line)] text-[var(--color-primary-text)]"
            : isActive
            ? "bg-transparent border-[var(--color-primary)] text-[var(--color-primary)]"
            : "bg-transparent border-[var(--color-line)] text-[var(--color-text-disabled)]"
        )}
      >
        {isCompleted ? (
          /* 체크 아이콘 */
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : isActive ? (
          /* 스피너 */
          <svg
            className="animate-spin"
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              className="opacity-30"
            />
            <path
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          <span className="text-[10px] font-english">{index + 1}</span>
        )}
      </div>
      <span className="text-[10px] text-[var(--color-text-muted)]">
        {index + 1}컷
      </span>
    </div>
  );
}

/* ─── GeneratingUI ─── */

export interface GeneratingUIProps {
  /** 완료된 패널 수 (0~4) */
  completedPanels: number;
  /** 현재 생성 단계 */
  stage: JobStage;
  /** SSE tip 이벤트로 받은 현재 팁 텍스트 */
  currentTip?: string;
  /** 생성 취소 콜백 */
  onCancel?: () => void;
  className?: string;
}

export function GeneratingUI({
  completedPanels,
  stage,
  currentTip,
  onCancel,
  className,
}: GeneratingUIProps) {
  const progress = (completedPanels / 4) * 100;
  const stageLabel = STAGE_LABELS[stage];

  return (
    <div
      className={cn("flex flex-col items-center gap-6 w-full px-5 py-8", className)}
      role="status"
      aria-live="polite"
      aria-label={`만화 생성 중. ${stageLabel}`}
    >
      {/* 4컷 스켈레톤 그리드 */}
      <div
        className="w-full aspect-square grid grid-cols-2 grid-rows-2 gap-1 rounded-lg overflow-hidden border-2 border-[var(--color-line)] shadow-[var(--shadow-pop)]"
        aria-hidden="true"
      >
        {Array.from({ length: 4 }).map((_, i) => {
          const panelDone = i < completedPanels;
          return (
            <div key={i} className="relative overflow-hidden bg-[var(--color-bg-muted)]">
              {panelDone ? (
                /* 완성된 컷 — 초록 체크 오버레이 */
                <div className="w-full h-full flex items-center justify-center bg-[var(--color-success-subtle)]">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--color-success)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              ) : (
                <Skeleton
                  className="w-full h-full rounded-none"
                  style={{ animationDelay: `${i * 100}ms` }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 단계 표시 */}
      <div className="flex items-end justify-center gap-4 w-full" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <PanelStep
            key={i}
            index={i}
            isCompleted={i < completedPanels}
            isActive={i === completedPanels && stage === "drawing"}
          />
        ))}
      </div>

      {/* 프로그레스 바 */}
      <ProgressBar value={progress} className="w-full" />

      {/* 상태 메시지 */}
      <p className="text-sm text-[var(--color-text-secondary)] text-center" aria-live="polite">
        {stageLabel}
      </p>

      {/* 팁 로테이션 슬롯 */}
      {currentTip && (
        <div
          aria-live="polite"
          aria-atomic="true"
          className={cn(
            "w-full rounded-lg bg-[var(--color-bg-subtle)] px-4 py-3",
            "border-2 border-[var(--color-line)] shadow-[var(--shadow-pop-xs)]"
          )}
        >
          <p className="text-xs text-[var(--color-text-muted)] text-center leading-relaxed">
            {currentTip}
          </p>
        </div>
      )}

      {/* 취소 버튼 */}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            "text-sm text-[var(--color-primary)] font-heading",
            "hover:text-[var(--color-primary-hover)] hover:underline",
            "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] rounded",
            "transition-colors duration-200",
            "min-h-[44px] px-2"
          )}
        >
          생성 취소
        </button>
      )}
    </div>
  );
}
