/**
 * DiaryViewer — S5 결과 클라이언트 컴포넌트.
 * 2×2 그리드 뷰어 + 액션 버튼 (편집/공유/저장/재생성).
 * WatermarkOverlay + AIDisclosureBadge는 P0 컴포넌트.
 * 잉크 & 리소 에디션 — 헤더 잉크 라인, 패널 하드 오프셋, 도장 버튼.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  WatermarkOverlay,
  AIDisclosureBadge,
  Skeleton,
  Toast,
} from "@/components";
import { ROUTES } from "@/lib/constants";
import { COPY } from "@/lib/copy";
import { useDiary } from "@/hooks/useDiary";
import { useQuota } from "@/hooks/useQuota";

interface Props {
  diaryId: string;
}

export function DiaryViewer({ diaryId }: Props) {
  const router = useRouter();
  const { data: diary, isLoading } = useDiary(diaryId);
  const { data: quota } = useQuota();
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);

  const tier = quota?.tier ?? "free";

  if (isLoading && !diary) {
    return (
      <div className="flex min-h-screen flex-col px-5 py-8">
        <div className="mx-auto w-full max-w-[480px]">
          {/* 헤더 스켈레톤 */}
          <div className="mb-6 flex items-center gap-2">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-5 w-32 rounded-md" />
          </div>
          {/* 4컷 그리드 스켈레톤 */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            {([1, 2, 3, 4] as const).map((i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!diary) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="relative rounded-xl border-2 border-[var(--color-line)] bg-[var(--color-surface-raised)] px-8 py-10 text-center shadow-[var(--shadow-pop)]">
          <span
            aria-hidden
            className="tone-dots pointer-events-none absolute inset-0 rounded-xl text-[var(--color-text-muted)] opacity-15"
          />
          <p className="relative font-balloon text-lg text-[var(--color-text-muted)]">
            {COPY.error.notFound}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col px-5 py-4">

        {/* 헤더 — 잉크 라인 구분 + font-heading 타이틀 */}
        <header className="mb-5 flex items-center gap-3 border-b-2 border-[var(--color-line)] pb-3">
          <button
            onClick={() => router.push(ROUTES.home)}
            aria-label="홈으로"
            className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-[var(--color-line)] bg-[var(--color-surface-raised)] font-english text-lg text-[var(--color-text-secondary)] shadow-[var(--shadow-pop-sm)] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-pop)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[var(--shadow-pop-xs)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
          >
            ←
          </button>
          <h1 className="flex-1 font-heading text-lg text-[var(--color-text-primary)]">
            완성된 만화
          </h1>
          {/* AI 생성 고지 배지 — 법무 필수, 삭제 불가 (design-final §8.2) */}
          <AIDisclosureBadge />
        </header>

        {/* 2×2 뷰어 그리드 — design-final §7.2: 뷰어는 항상 2×2 */}
        <div
          className="mb-5 grid grid-cols-2 gap-2"
          aria-label="4컷 만화"
          role="img"
        >
          {diary.panels.map((panel) => (
            <div
              key={panel.index}
              className="relative aspect-square overflow-hidden rounded-lg border-2 border-[var(--color-line)] shadow-[var(--shadow-pop-sm)]"
              style={{ animationDelay: `${(panel.index - 1) * 80}ms` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={panel.previewUrl ?? panel.imageUrl}
                alt={panel.caption ?? `${panel.index}컷`}
                className="h-full w-full object-cover motion-safe:animate-[panelStamp_.45s_ease-out_both]"
              />
              {/* 워터마크 오버레이 — tier 분기 (design-final §8.1) */}
              <WatermarkOverlay tier={tier} panelIndex={panel.index} />
              {/* 컷 번호 배지 — 리소 도장 */}
              <span
                className="absolute left-1.5 top-1.5 flex h-6 w-6 -rotate-6 items-center justify-center rounded-full border-2 border-[var(--color-line)] bg-[var(--color-lemon)] font-english text-[10px] leading-none text-[var(--color-ink)] shadow-[var(--shadow-pop-xs)]"
                aria-hidden
              >
                {panel.index}
              </span>
              {/* 캡션 */}
              {panel.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-[var(--color-bg-base)] bg-opacity-80 px-2 py-1">
                  <p className="truncate font-balloon text-xs text-[var(--color-text-primary)]">
                    {panel.caption}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 일기 날짜 — font-english */}
        <p className="mb-6 text-center font-english text-sm tracking-wide text-[var(--color-text-muted)]">
          {new Date(diary.createdAt).toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>

        {/* 액션 버튼 */}
        <div className="mt-auto flex flex-col gap-3">
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => router.push(ROUTES.diaryShare(diaryId))}
          >
            {COPY.diaryResult.ctaShare}
          </Button>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="md"
              className="flex-1"
              onClick={() => router.push(ROUTES.diaryEdit(diaryId))}
            >
              {COPY.diaryResult.ctaEdit}
            </Button>
            <Button
              variant="ghost"
              size="md"
              className="flex-1"
              onClick={() => setShowRegenConfirm(true)}
            >
              {COPY.diaryResult.ctaRegenerate}
            </Button>
          </div>
        </div>

        {/* 재생성 확인 인라인 (ux-spec §10 충돌해소 #6: 자발적 재생성=차감) */}
        {showRegenConfirm && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="regen-confirm-title"
            className="relative mt-4 overflow-hidden rounded-xl border-2 border-[var(--color-line)] bg-[var(--color-surface-raised)] p-4 shadow-[var(--shadow-pop)]"
          >
            <span
              aria-hidden
              className="tone-dots pointer-events-none absolute inset-0 text-[var(--color-primary)] opacity-10"
            />
            <p
              id="regen-confirm-title"
              className="relative mb-4 font-sans text-sm text-[var(--color-text-primary)]"
            >
              {COPY.diaryResult.regenerateConfirm}
            </p>
            <div className="relative flex gap-2">
              <Button
                variant="primary"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setShowRegenConfirm(false);
                  // 재생성 뮤테이션 — useRegenerate 훅 (백엔드 의존)
                  setToastMsg("재생성 기능은 준비 중입니다.");
                }}
              >
                {COPY.diaryResult.regenerateConfirmCta}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => setShowRegenConfirm(false)}
              >
                취소
              </Button>
            </div>
          </div>
        )}
      </div>

      {toastMsg && (
        <Toast
          message={toastMsg}
          variant="info"
          onDismiss={() => setToastMsg(null)}
        />
      )}
    </div>
  );
}
