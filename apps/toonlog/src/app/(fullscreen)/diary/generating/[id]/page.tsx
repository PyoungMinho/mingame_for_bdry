/**
 * S4 생성 대기 페이지 — SSE 소비 + 1컷 즉시 노출 (이탈방지 핵심).
 * ux-spec §5 + design-final §4 플로우A 단계7.
 * 풀스크린, 탭바 숨김.
 * EventSource 구독은 useSSEGeneration 훅이 처리.
 * 잉크 & 리소 에디션 — font-balloon 대기 카피, 하프톤 플레이스홀더, dotJump 점 로딩.
 */
"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ProgressBar, Skeleton, Toast } from "@/components";
import { ROUTES } from "@/lib/constants";
import { COPY } from "@/lib/copy";
import { useGenerationStore } from "@/store/generationStore";
import { useSSEGeneration } from "@/hooks/useSSEGeneration";

const STAGE_LABELS: Record<string, string> = {
  queued: "순서를 기다리고 있어요",
  splitting: "일기를 4장면으로 나누고 있어요",
  drawing: "만화를 그리고 있어요",
  checking: "캐릭터 표정을 다듬고 있어요",
  finalizing: "마무리 중이에요",
};

export default function GeneratingPage() {
  const router = useRouter();
  const params = useParams();
  const diaryId = typeof params.id === "string" ? params.id : null;

  const { panels, completedPanels, currentTip, stage, error, isDone } =
    useGenerationStore();

  // SSE 구독 시작
  useSSEGeneration(diaryId);

  // 완성 시 결과 화면으로 이동
  useEffect(() => {
    if (isDone && diaryId) {
      router.replace(ROUTES.diary(diaryId));
    }
  }, [isDone, diaryId, router]);

  const progress = Math.round((completedPanels / 4) * 100);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-between overflow-x-hidden px-5 py-8">

      {/* 배경 하프톤 데코 */}
      <span
        aria-hidden
        className="tone-dots pointer-events-none absolute left-0 right-0 top-0 h-full text-[var(--color-secondary)] opacity-[0.05]"
      />

      {/* 상단: 제목 + 진행률 */}
      <div className="relative w-full max-w-[480px]">
        {/* 키커 스탬프 — 도장 등장 */}
        <div className="mb-4 flex justify-center">
          <span className="tilt-l inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--color-line)] bg-[var(--color-accent)] px-3 py-1 font-heading text-xs text-[var(--color-accent-text)] shadow-[var(--shadow-pop-xs)] motion-safe:animate-[inkStamp_.5s_ease-out_both]">
            <span className="font-english tracking-wide">AI</span> 그리는 중
          </span>
        </div>

        <h1 className="mb-1 text-center font-heading text-lg text-[var(--color-text-primary)]">
          {COPY.generating.title}
        </h1>

        {/* 스테이지 카피 — font-balloon */}
        <p className="mb-4 text-center font-balloon text-base text-[var(--color-text-secondary)]">
          {stage ? STAGE_LABELS[stage] ?? COPY.generating.etaHint : COPY.generating.etaHint}
        </p>

        {/* 점 로딩 (dotJump) */}
        <div className="mb-3 flex justify-center gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2.5 w-2.5 rounded-full bg-[var(--color-primary)] motion-safe:animate-[dotJump_1.2s_ease-in-out_infinite]"
              style={{ animationDelay: `${i * 180}ms` }}
            />
          ))}
        </div>

        {/* 진행률 바 */}
        <ProgressBar
          value={progress}
          max={100}
          aria-label={`생성 진행률 ${progress}%`}
          className="mb-1"
        />
        <p className="mb-6 text-right font-english text-xs text-[var(--color-text-muted)]">
          {progress}%
        </p>
      </div>

      {/* 중앙: 4컷 그리드 — 완성 컷 즉시 표시 + 하프톤 플레이스홀더 */}
      <div
        className="relative grid w-full max-w-[480px] grid-cols-2 gap-2"
        aria-label="만화 생성 현황"
      >
        {([1, 2, 3, 4] as const).map((index) => {
          const panel = panels.find((p) => p.index === index);
          return (
            <div
              key={index}
              className="relative aspect-square overflow-hidden rounded-lg border-2 border-[var(--color-line)] shadow-[var(--shadow-pop-sm)]"
            >
              {panel ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={panel.previewUrl ?? panel.imageUrl}
                    alt={panel.caption ?? `${index}컷 완성`}
                    className="h-full w-full object-cover motion-safe:animate-[panelStamp_.5s_ease-out_both]"
                  />
                  {/* 컷 완성 배지 — 리소 레몬 도장 */}
                  <span
                    className="absolute left-1.5 top-1.5 flex h-6 w-6 -rotate-6 items-center justify-center rounded-full border-2 border-[var(--color-line)] bg-[var(--color-lemon)] font-english text-[10px] leading-none text-[var(--color-ink)] shadow-[var(--shadow-pop-xs)]"
                    aria-label={COPY.generating.panelLabel(index)}
                  >
                    {index}
                  </span>
                </>
              ) : (
                /* 하프톤 플레이스홀더 — panelStamp 등장 */
                <div className="relative flex h-full w-full items-center justify-center bg-[var(--color-bg-muted)] motion-safe:animate-[panelStamp_.4s_ease-out_both]"
                  style={{ animationDelay: `${(index - 1) * 120}ms` }}
                >
                  <span
                    aria-hidden
                    className="tone-dots pointer-events-none absolute inset-0 text-[var(--color-text-muted)] opacity-25"
                  />
                  <span className="relative font-english text-3xl text-[var(--color-text-disabled)]">
                    {index}
                  </span>
                  <span
                    className="absolute left-1.5 top-1.5 flex h-6 w-6 -rotate-6 items-center justify-center rounded-full border-2 border-[var(--color-line)] bg-[var(--color-bg-subtle)] font-english text-[10px] leading-none text-[var(--color-text-disabled)] shadow-[var(--shadow-pop-xs)]"
                    aria-hidden
                  >
                    {index}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 하단: 팁 + 백그라운드 전환 안내 */}
      <div className="relative w-full max-w-[480px] text-center">
        {currentTip && (
          <p
            aria-live="polite"
            className="mb-3 font-balloon text-sm italic text-[var(--color-text-muted)]"
          >
            {COPY.generating.tipPrefix} {currentTip}
          </p>
        )}
        <p className="font-sans text-xs text-[var(--color-text-disabled)]">
          {COPY.generating.backgroundHint}
        </p>
      </div>

      {/* 에러 토스트 */}
      {error && (
        <Toast
          message={
            error.code === "QUOTA_EXCEEDED"
              ? COPY.error.quotaExceeded
              : error.code === "MODERATION_BLOCKED_INPUT" ||
                error.code === "MODERATION_BLOCKED_OUTPUT"
              ? COPY.error.moderationBlocked
              : error.message || COPY.error.generationFailed
          }
          variant="error"
          action={
            error.retryable
              ? {
                  label: COPY.error.ctaRetry,
                  onClick: () => router.back(),
                }
              : {
                  label: COPY.error.ctaHome,
                  onClick: () => router.push(ROUTES.home),
                }
          }
        />
      )}
    </div>
  );
}
