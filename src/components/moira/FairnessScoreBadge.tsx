"use client";

import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown } from "lucide-react";
import { CountUp } from "./motion";

export interface FairnessScoreBadgeProps {
  /** 이전 공평성 점수 (0~100) */
  prev: number;
  /** 현재 공평성 점수 (0~100) */
  current: number;
  /** CountUp 애니메이션 여부 */
  animated?: boolean;
  className?: string;
}

/**
 * 장소 수정 시 공평성 점수 실시간 변동 배지.
 * - ArrowUp/ArrowDown(lucide) 항상 동반: 색 단독 의존 0.
 * - FairnessBars와 별도 영역에 배치할 것(§3, §6-G).
 * - aria-live="polite": 점수 변동 시 스크린리더 안내.
 */
export function FairnessScoreBadge({
  prev,
  current,
  animated = true,
  className,
}: FairnessScoreBadgeProps) {
  const delta = current - prev;
  const isUp = delta > 0;
  const isDown = delta < 0;
  const isNeutral = delta === 0;

  const colorClass = isUp
    ? "text-moira-score-up bg-moira-score-up-tint"
    : isDown
      ? "text-moira-score-down bg-moira-score-down-tint"
      : "text-moira-score-neutral bg-slate-100";

  return (
    <span
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`공평성 점수 ${current}점${!isNeutral ? (isUp ? " 상승" : " 하락") : ""}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-extrabold tabular-nums",
        colorClass,
        className,
      )}
    >
      {/* 방향 아이콘 — 항상 표시(중립이면 숨김 대신 aria-hidden만) */}
      {isUp && (
        <ArrowUp size={13} strokeWidth={3} aria-hidden />
      )}
      {isDown && (
        <ArrowDown size={13} strokeWidth={3} aria-hidden />
      )}
      {isNeutral && (
        <span className="inline-block w-[13px]" aria-hidden />
      )}

      {/* 현재 점수 — animated이면 CountUp */}
      {animated ? (
        <CountUp to={current} duration={500} />
      ) : (
        <span>{current}</span>
      )}
      <span className="text-[11px] font-semibold opacity-70">점</span>

      {/* delta 표시 */}
      {!isNeutral && (
        <span className="text-[11px] font-semibold opacity-80">
          ({isUp ? "+" : ""}{delta})
        </span>
      )}
    </span>
  );
}
