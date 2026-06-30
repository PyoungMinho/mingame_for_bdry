/**
 * 홈 대시보드 클라이언트 컴포넌트.
 */
"use client";

import Link from "next/link";
import { Button, QuotaChip, StreakBadge, Card, Skeleton } from "@/components";
import { ROUTES } from "@/lib/constants";
import { useArchive } from "@/hooks/useArchive";
import { useQuota } from "@/hooks/useQuota";

export function HomeDashboard() {
  const { data: quota, isLoading: quotaLoading } = useQuota();
  const { data: archiveData, isLoading: archiveLoading } = useArchive();

  const recentDiaries = archiveData?.pages[0]?.items.slice(0, 3) ?? [];
  // 스트릭: 연속 날짜 계산 (간단 추정 — 정확한 계산은 백엔드 API에서 제공 예정)
  const streak = archiveData?.pages[0]?.total ?? 0;

  return (
    <div className="relative px-5 py-4">
      {/* 헤더 */}
      <header className="relative mb-5 flex items-center justify-between">
        {/* 로고/인사 헤드라인 */}
        <div>
          <span
            aria-hidden
            className="mb-0.5 block font-heading text-xs text-[var(--color-text-muted)]"
          >
            오늘도
          </span>
          <h1 className="font-display text-[2rem] leading-[1.1] text-[var(--color-text-primary)]">
            툰<span className="text-[var(--color-primary)]">일기</span>
          </h1>
        </div>
        {quotaLoading ? (
          <Skeleton className="h-8 w-20 rounded-full" />
        ) : (
          <QuotaChip quota={quota} />
        )}
      </header>

      {/* 스트릭 배지 */}
      {streak > 0 && (
        <div className="mb-5 motion-safe:animate-[inkStamp_.4s_ease-out_both]">
          <StreakBadge days={streak} />
        </div>
      )}

      {/* 오늘 일기 작성 CTA — 코랄 primary, 큰 잉크 그림자 */}
      <div className="relative mb-8">
        {/* 데코: CTA 뒤 하프톤 원 */}
        <span
          aria-hidden
          className="tone-dots pointer-events-none absolute -right-3 -top-3 h-20 w-20 rounded-full text-[var(--color-primary)] opacity-[0.12]"
        />
        <Button variant="primary" size="lg" className="relative w-full" asChild>
          <Link href={ROUTES.diaryNew}>오늘 일기 쓰기</Link>
        </Button>
      </div>

      {/* 최근 만화 섹션 */}
      <section aria-labelledby="recent-heading">
        {/* 섹션 헤더 */}
        <div className="mb-3 flex items-center gap-2">
          <h2
            id="recent-heading"
            className="font-heading text-lg text-[var(--color-text-primary)]"
          >
            최근 만화
          </h2>
          {/* 컷 번호 뱃지 스타일 데코 */}
          {recentDiaries.length > 0 && (
            <span
              aria-hidden
              className="tilt-r flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--color-line)] bg-[var(--color-accent)] font-english text-[10px] leading-none text-[var(--color-accent-text)] shadow-[var(--shadow-pop-xs)]"
            >
              {recentDiaries.length}
            </span>
          )}
        </div>

        {archiveLoading && !archiveData ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : recentDiaries.length === 0 ? (
          /* 빈 상태 — 하프톤 플레이스홀더 */
          <div className="relative overflow-hidden rounded-xl border-2 border-[var(--color-line)] bg-[var(--color-surface-raised)] p-8 text-center shadow-[var(--shadow-pop-sm)]">
            <span
              aria-hidden
              className="tone-dots pointer-events-none absolute inset-0 text-[var(--color-text-muted)] opacity-[0.12]"
            />
            <span
              aria-hidden
              className="relative mb-2 block font-english text-3xl text-[var(--color-text-disabled)]"
            >
              4CUT
            </span>
            <p className="relative font-balloon text-sm text-[var(--color-text-muted)]">
              아직 만화가 없어요.
              <br />첫 일기를 써볼까요?
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {recentDiaries.map((diary) => (
              <Link key={diary.id} href={ROUTES.diary(diary.id)}>
                <Card
                  hoverable
                  className="flex gap-3 p-3"
                >
                  {/* 썸네일 (첫 컷) */}
                  {diary.panels[0] && (
                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 border-[var(--color-line)] shadow-[var(--shadow-pop-xs)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={diary.panels[0].previewUrl ?? diary.panels[0].imageUrl}
                        alt={diary.panels[0].caption ?? "만화 썸네일"}
                        width={64}
                        height={64}
                        className="h-full w-full object-cover"
                      />
                      {/* 컷 번호 */}
                      <span
                        aria-hidden
                        className="absolute left-1 top-1 flex h-4 w-4 -rotate-6 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-lemon)] font-english text-[8px] leading-none text-[var(--color-ink)]"
                      >
                        1
                      </span>
                    </div>
                  )}
                  <div className="flex min-w-0 flex-col justify-center">
                    <p className="truncate font-sans text-sm text-[var(--color-text-primary)]">
                      {diary.text.slice(0, 30)}
                      {diary.text.length > 30 ? "..." : ""}
                    </p>
                    <p className="mt-0.5 font-english text-xs text-[var(--color-text-muted)]">
                      {new Date(diary.createdAt).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {recentDiaries.length > 0 && (
          <div className="mt-4 text-center">
            <Link
              href={ROUTES.archive}
              className="font-heading text-sm text-[var(--color-text-link)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
            >
              전체 보기 →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
