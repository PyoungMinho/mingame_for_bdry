/**
 * S8 아카이브 — 캘린더/그리드 토글.
 * ux-spec §4 화면8 기반. P1.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { SegmentedToggle, CalendarView, Skeleton, EmptyState } from "@/components";
import { ROUTES } from "@/lib/constants";
import { COPY } from "@/lib/copy";
import { useArchive } from "@/hooks/useArchive";
import type { Metadata } from "next";

// 클라이언트 컴포넌트이므로 별도 metadata 불가 — layout에서 처리 가능
const VIEW_OPTIONS = [
  { value: "calendar", label: COPY.archive.calendarTab },
  { value: "grid", label: COPY.archive.gridTab },
];

export default function ArchivePage() {
  const [view, setView] = useState<"calendar" | "grid">("calendar");
  const { data, isLoading, hasNextPage, fetchNextPage } = useArchive();

  const allDiaries = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  return (
    <div className="relative px-5 py-4">
      {/* 헤더 */}
      <header className="relative mb-5">
        {/* 키커 */}
        <div className="mb-2">
          <span className="tilt-l inline-flex items-center gap-1 rounded-full border-2 border-[var(--color-line)] bg-[var(--color-secondary-subtle)] px-2.5 py-0.5 font-heading text-[10px] text-[var(--color-secondary)] shadow-[var(--shadow-pop-xs)]">
            <span className="font-english tracking-wide">MY</span> 만화 기록
          </span>
        </div>

        <h1 className="font-heading text-2xl text-[var(--color-text-primary)]">
          {COPY.archive.title}
        </h1>
        {total > 0 && (
          <p className="mt-0.5 font-sans text-sm text-[var(--color-text-muted)]">
            총{" "}
            <span className="font-english text-[var(--color-text-secondary)]">{total}</span>편
          </p>
        )}

        {/* 손그림 밑줄 */}
        <svg
          aria-hidden
          viewBox="0 0 200 12"
          preserveAspectRatio="none"
          className="mt-1 h-2.5 w-28 text-[var(--color-accent)]"
        >
          <path
            d="M2 8 Q 25 2 50 7 T 100 6 T 150 7 T 198 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      </header>

      {/* 뷰 토글 */}
      <div className="mb-5">
        <SegmentedToggle
          options={VIEW_OPTIONS}
          value={view}
          onChange={(v) => setView(v as "calendar" | "grid")}
          aria-label="뷰 전환"
        />
      </div>

      {/* 로딩 */}
      {isLoading && allDiaries.length === 0 && (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      )}

      {/* 빈 상태 */}
      {!isLoading && allDiaries.length === 0 && (
        <EmptyState
          message={COPY.archive.empty}
          cta={COPY.archive.emptyCta}
          ctaHref={ROUTES.diaryNew}
        />
      )}

      {/* 캘린더 뷰 */}
      {!isLoading && allDiaries.length > 0 && view === "calendar" && (
        <CalendarView diaries={allDiaries} />
      )}

      {/* 그리드 뷰 */}
      {!isLoading && allDiaries.length > 0 && view === "grid" && (
        <>
          <div
            className="grid grid-cols-3 gap-2"
            aria-label="만화 그리드"
          >
            {allDiaries.map((diary) => (
              <Link
                key={diary.id}
                href={ROUTES.diary(diary.id)}
                aria-label={`${new Date(diary.createdAt).toLocaleDateString("ko-KR")} 만화`}
                className="focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] rounded-lg"
              >
                <div className="group relative aspect-square overflow-hidden rounded-lg border-2 border-[var(--color-line)] shadow-[var(--shadow-pop-sm)] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-pop-lg)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[var(--shadow-pop-xs)]">
                  {diary.panels[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={diary.panels[0].previewUrl ?? diary.panels[0].imageUrl}
                      alt={diary.panels[0].caption ?? "만화 썸네일"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    /* 빈 썸네일 — 하프톤 플레이스홀더 */
                    <div className="relative h-full w-full bg-[var(--color-bg-muted)] flex items-center justify-center">
                      <span
                        aria-hidden
                        className="tone-dots absolute inset-0 text-[var(--color-text-muted)] opacity-[0.18]"
                      />
                      <span className="relative font-english text-lg text-[var(--color-text-disabled)]">
                        4CUT
                      </span>
                    </div>
                  )}
                  {/* 날짜 오버레이 */}
                  <div className="absolute bottom-0 left-0 right-0 bg-[var(--color-surface-overlay)] px-1.5 py-1">
                    <span className="font-english text-[9px] leading-none text-[var(--color-text-inverse)]">
                      {new Date(diary.createdAt).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* 더 불러오기 */}
          {hasNextPage && (
            <div className="mt-5 text-center">
              <button
                onClick={() => fetchNextPage()}
                className="rounded-lg border-2 border-[var(--color-line)] bg-[var(--color-surface-raised)] px-5 py-2.5 font-heading text-sm text-[var(--color-text-secondary)] shadow-[var(--shadow-pop-sm)] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-pop-lg)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[var(--shadow-pop-xs)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
              >
                더 보기
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
