// REDLINE: 외모/체형 비교 UI 금지. 타인 점수 노출 금지.

"use client";

import * as React from "react";
import { Flame } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ── Props 인터페이스 ──────────────────────────────────────────────────
export interface StreakDay {
  /** ISO 날짜 (YYYY-MM-DD) */
  date: string;
  /** 해당 날 체크인 완료 여부 */
  completed: boolean;
  /** 오늘 날짜 여부 */
  isToday?: boolean;
}

export interface StreakIndicatorProps {
  /** 현재 연속 일수 */
  streakCount: number;
  /** 7일 도트 바 데이터 */
  days: StreakDay[];
  /**
   * 스트릭 grace period 상태
   * design-final.md C3: 0시 기준 + 24시 grace period
   * "grace" = 오늘 미완료지만 24h 이내 회복 가능
   */
  graceActive?: boolean;
  /**
   * 스트릭 끊김 후 재시작 보너스 상태
   * true 시 부정 메시지 대신 "재시작 보너스" 프레임 표시
   * design-final.md C3: 끊김 시 자동 "재시작 보너스 +5점" 카드
   */
  isRestart?: boolean;
  /** 재시작 보너스 점수 (기본 5) */
  restartBonus?: number;
  className?: string;
}

// ── 도트 컴포넌트 ─────────────────────────────────────────────────────
const DotBar: React.FC<{ days: StreakDay[] }> = ({ days }) => (
  <div
    className="flex items-center gap-1.5"
    role="group"
    aria-label="최근 7일 체크인 현황"
  >
    {days.map((day, i) => {
      const isToday = day.isToday ?? false;
      return (
        <div
          key={day.date}
          role="img"
          aria-label={`${day.date} ${day.completed ? "완료" : isToday ? "오늘" : "미완료"}`}
          className={cn(
            "w-2 h-2 rounded-full transition-all duration-fast",
            // 완료: accent-500
            day.completed && "bg-accent-500",
            // 오늘 미완료: accent-500 테두리 + 흰 내부 (ui-spec.md §3-10)
            isToday && !day.completed && "border-2 border-accent-500 bg-white",
            // 과거 미완료: gray-200
            !day.completed && !isToday && "bg-gray-200"
          )}
        />
      );
    })}
  </div>
);

// ── 메인 컴포넌트 ────────────────────────────────────────────────────
/**
 * 오름 StreakIndicator 컴포넌트
 *
 * 스트릭 연속 일수 + 7일 도트 바.
 * 끊겨도 절대 부정 메시지 없음 — 재시작 보너스 프레임으로 전환.
 * design-final.md C3: 0시 기준 + 24h grace period.
 *
 * @example
 * <StreakIndicator
 *   streakCount={12}
 *   days={last7Days}
 *   graceActive={false}
 * />
 * // 스트릭 끊긴 경우
 * <StreakIndicator streakCount={0} days={last7Days} isRestart restartBonus={5} />
 */
const StreakIndicator = React.forwardRef<HTMLDivElement, StreakIndicatorProps>(
  (
    {
      streakCount,
      days,
      graceActive = false,
      isRestart = false,
      restartBonus = 5,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-2", className)}
        aria-label={
          isRestart
            ? `재시작 보너스 +${restartBonus}점`
            : `${streakCount}일 연속 체크인`
        }
        {...props}
      >
        {/* ── 연속 일수 행 ── */}
        <div className="flex items-center gap-1.5">
          {/* 불꽃 아이콘 — Lucide Flame, accent-500 24px (ui-spec.md §3-10) */}
          <Flame
            size={24}
            className={cn(
              "shrink-0 transition-colors duration-base",
              isRestart ? "text-gray-400" : "text-accent-500"
            )}
            aria-hidden="true"
          />

          {/* 연속 일수 숫자 — h3 20px/600 accent-500 */}
          <motion.span
            key={streakCount}
            initial={{ opacity: 0.6, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
            className={cn(
              "text-[20px] font-semibold leading-[1.4] tabular-nums",
              isRestart ? "text-gray-500" : "text-accent-500"
            )}
            aria-live="polite"
          >
            {streakCount}
          </motion.span>

          <span className="text-[14px] text-gray-500 leading-[1.6]">일 연속</span>

          {/* Grace period 뱃지 */}
          {graceActive && !isRestart && (
            <span
              className="ml-1 text-[11px] text-accent-600 bg-accent-50 px-1.5 py-0.5 rounded-full font-medium"
              aria-label="오늘 자정까지 체크인 가능"
            >
              회복 가능
            </span>
          )}
        </div>

        {/* ── 7일 도트 바 ── */}
        <DotBar days={days} />

        {/* ── 재시작 보너스 카드 — 끊김 시 부정 메시지 없이 표시 ── */}
        {isRestart && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="flex items-center gap-2 px-3 py-2 bg-accent-50 rounded-lg border border-accent-100"
            role="status"
            aria-live="polite"
          >
            <Flame size={16} className="text-accent-500 shrink-0" aria-hidden="true" />
            <span className="text-[13px] font-medium text-accent-700 leading-[1.4]">
              재시작 보너스 +{restartBonus}점 — 다시 시작해봐요!
            </span>
          </motion.div>
        )}
      </div>
    );
  }
);

StreakIndicator.displayName = "StreakIndicator";

export { StreakIndicator };
