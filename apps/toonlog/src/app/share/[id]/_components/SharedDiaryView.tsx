/**
 * 공유 수신자 뷰 — 공개 OG 페이지.
 * 미인증 접근 가능. 앱 유입 CTA 포함.
 * 잉크 & 리소 에디션 — 로고 잉크 헤더, ComicCard 크게 + 하드 오프셋, "나도 만들기" CTA, WatermarkOverlay.
 */
"use client";

import Link from "next/link";
import { Button, AIDisclosureBadge, Skeleton, WatermarkOverlay } from "@/components";
import { ROUTES } from "@/lib/constants";
import { AI_DISCLOSURE_TEXT } from "@/lib/constants";
import { useDiary } from "@/hooks/useDiary";

interface Props {
  diaryId: string;
}

export function SharedDiaryView({ diaryId }: Props) {
  const { data: diary, isLoading } = useDiary(diaryId);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--color-bg-base)]">
      {/* 배경 하프톤 데코 */}
      <span
        aria-hidden
        className="tone-dots-lg pointer-events-none absolute -left-12 top-32 h-56 w-56 rounded-full text-[var(--color-secondary)] opacity-[0.07]"
      />
      <span
        aria-hidden
        className="tone-grid pointer-events-none absolute -right-10 bottom-20 h-48 w-48 text-[var(--color-primary)] opacity-[0.06]"
      />

      <div className="relative mx-auto max-w-[480px] px-5 py-6">

        {/* 헤더 — 로고 + AI 배지 */}
        <header className="mb-6 flex items-center justify-between border-b-2 border-[var(--color-line)] pb-3">
          <span className="font-logo text-2xl tracking-tight text-[var(--color-text-primary)]">
            툰<span className="text-[var(--color-primary)]">일기</span>
          </span>
          <AIDisclosureBadge />
        </header>

        {/* 4컷 만화 뷰어 */}
        {isLoading && !diary ? (
          <div className="mb-6 grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : diary ? (
          <>
            {/* 날짜 */}
            <p className="mb-3 font-english text-sm tracking-wide text-[var(--color-text-muted)]">
              {new Date(diary.createdAt).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>

            {/* 2×2 패널 그리드 — 하드 오프셋 + 하프톤 */}
            <div
              className="mb-5 grid grid-cols-2 gap-2 overflow-hidden rounded-xl border-[3px] border-[var(--color-line)] shadow-[var(--shadow-pop-xl)]"
              role="img"
              aria-label="4컷 만화"
            >
              {diary.panels.map((panel) => (
                <div
                  key={panel.index}
                  className={`relative aspect-square overflow-hidden ${
                    panel.index % 2 === 1 ? "border-r-2 border-[var(--color-line)]" : ""
                  } ${panel.index <= 2 ? "border-b-2 border-[var(--color-line)]" : ""}`}
                  style={{ animationDelay: `${(panel.index - 1) * 80}ms` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={panel.previewUrl ?? panel.imageUrl}
                    alt={panel.caption ?? `${panel.index}컷`}
                    className="h-full w-full object-cover motion-safe:animate-[panelStamp_.45s_ease-out_both]"
                  />
                  {/* 워터마크 오버레이 */}
                  <WatermarkOverlay tier="free" panelIndex={panel.index} />
                  {/* 컷 번호 배지 */}
                  <span
                    className="absolute left-1.5 top-1.5 flex h-6 w-6 -rotate-6 items-center justify-center rounded-full border-2 border-[var(--color-line)] bg-[var(--color-lemon)] font-english text-[10px] leading-none text-[var(--color-ink)] shadow-[var(--shadow-pop-xs)]"
                    aria-hidden
                  >
                    {panel.index}
                  </span>
                  {/* 캡션 */}
                  {panel.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-[var(--color-bg-base)] bg-opacity-80 px-2 py-0.5">
                      <p className="truncate font-balloon text-xs text-[var(--color-text-primary)]">
                        {panel.caption}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          /* 없는 만화 */
          <div className="relative mb-6 overflow-hidden rounded-xl border-2 border-[var(--color-line)] p-8 text-center shadow-[var(--shadow-pop)]">
            <span
              aria-hidden
              className="tone-dots pointer-events-none absolute inset-0 text-[var(--color-text-muted)] opacity-15"
            />
            <p className="relative font-balloon text-lg text-[var(--color-text-muted)]">
              만화를 찾을 수 없어요.
            </p>
          </div>
        )}

        {/* AI 고지 */}
        <p className="mb-6 text-center font-sans text-xs text-[var(--color-text-muted)]">
          {AI_DISCLOSURE_TEXT}
        </p>

        {/* 앱 유입 CTA — 잉크 카드 + 도장 */}
        <div className="relative overflow-hidden rounded-xl border-2 border-[var(--color-line)] bg-[var(--color-surface-raised)] p-5 text-center shadow-[var(--shadow-pop-lg)]">
          {/* 배경 하프톤 */}
          <span
            aria-hidden
            className="tone-dots pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full text-[var(--color-primary)] opacity-10"
          />
          {/* 추천 도장 */}
          <span
            aria-hidden
            className="absolute -right-1 -top-1 flex h-12 w-12 rotate-12 items-center justify-center rounded-full border-2 border-[var(--color-line)] bg-[var(--color-lemon)] font-english text-[10px] leading-tight text-[var(--color-ink)] shadow-[var(--shadow-pop-xs)] motion-safe:animate-[inkStamp_.6s_ease-out_both]"
          >
            무료!
          </span>
          {/* 키커 */}
          <div className="relative mb-2">
            <span className="tilt-l inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--color-line)] bg-[var(--color-accent)] px-3 py-1 font-heading text-xs text-[var(--color-accent-text)] shadow-[var(--shadow-pop-xs)]">
              <span className="font-english tracking-wide">AI</span> 4컷 일기
            </span>
          </div>
          <p className="relative mb-1 font-heading text-lg text-[var(--color-text-primary)]">
            나만의 4컷 만화 만들기
          </p>
          <p className="relative mb-5 font-balloon text-base text-[var(--color-text-secondary)]">
            일기 한 줄이면 만화 완성, 툭 던지면 끝.
          </p>
          <Button variant="primary" size="lg" className="relative w-full" asChild>
            <Link href={ROUTES.landing}>툰일기 무료로 시작하기</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
