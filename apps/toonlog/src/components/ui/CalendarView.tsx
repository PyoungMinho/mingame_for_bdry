"use client";

/**
 * CalendarView + DateCell — 월간 캘린더 (P1)
 * design-final §5.2 보강 (ux-spec 화면8). 7열, 셀 최소 44×44px.
 * 셀 3상태: 썸네일(만화 있음) / 오늘(● 표시) / 빈칸.
 * 만화 있는 날 클릭 → 해당 일기로 이동.
 *
 * 사용 예시:
 *   <CalendarView diaries={allDiaries} />
 */

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import type { Diary } from "@/lib/contract";

export interface CalendarViewProps {
  diaries: Diary[];
  /** 표시 기준 월 (기본: 오늘이 속한 달) */
  month?: Date;
  className?: string;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** YYYY-MM-DD 로컬 키 */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/* ─── DateCell (내부) ─── */

interface DateCellProps {
  day: number | null;
  diary?: Diary;
  isToday: boolean;
}

function DateCell({ day, diary, isToday }: DateCellProps) {
  // 빈칸 (해당 월에 속하지 않는 셀)
  if (day === null) {
    return <div className="aspect-square min-h-[44px]" aria-hidden="true" />;
  }

  const dateLabel = `${day}일`;

  // 만화 있는 날 — 썸네일 + 링크
  if (diary) {
    const thumb = diary.panels[0]?.previewUrl ?? diary.panels[0]?.imageUrl;
    return (
      <Link
        href={ROUTES.diary(diary.id)}
        aria-label={`${dateLabel} 만화 보기`}
        className={cn(
          "relative aspect-square min-h-[44px] overflow-hidden rounded-md",
          "border-2 border-[var(--color-line)]",
          "shadow-[var(--shadow-pop-xs)]",
          "transition-[transform,box-shadow] duration-150 ease-out",
          "hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-pop-sm)]",
          "active:translate-x-[2px] active:translate-y-[2px] active:shadow-[var(--shadow-pop-xs)]",
          "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
          isToday && "border-[var(--color-primary)] bg-[var(--color-primary-subtle)]"
        )}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={diary.panels[0]?.caption ?? `${dateLabel} 만화`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="relative h-full w-full bg-[var(--color-bg-muted)]">
            <span aria-hidden="true" className="tone-dots absolute inset-0 text-[var(--color-text-muted)] opacity-20" />
          </div>
        )}
        {/* 날짜 숫자 뱃지 — lemon 컷번호 스타일 */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute bottom-0.5 right-0.5",
            "h-5 w-5 rounded-full border-2 border-[var(--color-line)]",
            "bg-[var(--color-lemon)] text-[var(--color-ink)]",
            "font-english text-[9px] leading-none",
            "flex items-center justify-center",
            "shadow-[var(--shadow-pop-xs)]",
          )}
        >
          {day}
        </span>
      </Link>
    );
  }

  // 만화 없는 날 — 숫자만, 오늘은 ● 표시(색 외 정보)
  return (
    <div
      className={cn(
        "flex aspect-square min-h-[44px] flex-col items-center justify-center rounded-md",
        isToday
          ? "border-2 border-[var(--color-primary)] bg-[var(--color-primary-subtle)]"
          : "border border-[var(--color-border-subtle)]"
      )}
      aria-label={isToday ? `${dateLabel} (오늘)` : dateLabel}
    >
      <span
        className={cn(
          "font-english text-sm leading-none",
          isToday
            ? "text-[var(--color-primary)]"
            : "text-[var(--color-text-muted)]"
        )}
      >{day}</span>
      {isToday && (
        <span aria-hidden="true" className="mt-0.5 h-1 w-1 rounded-full bg-[var(--color-primary)]" />
      )}
    </div>
  );
}

/* ─── CalendarView ─── */

export function CalendarView({ diaries, month, className }: CalendarViewProps) {
  const base = month ?? new Date();
  const year = base.getFullYear();
  const monthIdx = base.getMonth();

  // 날짜 → diary 매핑
  const byDay = React.useMemo(() => {
    const map = new Map<string, Diary>();
    for (const d of diaries) {
      const key = dayKey(new Date(d.createdAt));
      // 같은 날 여러 편이면 첫 항목 유지(최신 정렬 가정)
      if (!map.has(key)) map.set(key, d);
    }
    return map;
  }, [diaries]);

  const firstDay = new Date(year, monthIdx, 1).getDay(); // 0=일
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const todayKey = dayKey(new Date());

  // 셀 배열: 선행 빈칸 + 날짜
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthLabel = `${year}년 ${monthIdx + 1}월`;

  return (
    <div className={cn("w-full", className)} aria-label={`${monthLabel} 만화 캘린더`}>
      {/* 월 표시 */}
      <p className="mb-2 text-center font-heading text-sm text-[var(--color-text-primary)]">
        {monthLabel}
      </p>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-1" role="row">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            role="columnheader"
            className={cn(
              "py-1 text-center font-heading text-xs",
              i === 0
                ? "text-[var(--color-error)]"
                : "text-[var(--color-text-muted)]"
            )}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          const key = day !== null ? dayKey(new Date(year, monthIdx, day)) : `empty-${i}`;
          return (
            <DateCell
              key={key}
              day={day}
              diary={day !== null ? byDay.get(key) : undefined}
              isToday={day !== null && key === todayKey}
            />
          );
        })}
      </div>
    </div>
  );
}
