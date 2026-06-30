/**
 * S7 공유 페이지 — 비율 SegmentedToggle + 카드 미리보기 + 다운로드.
 * ux-spec §7 + design-final §7(공유카드 3종).
 * Satori 카드 생성: /diary/[id]/share/card/route.ts (api/ 밖).
 * 무료=512px 미리보기, 다운로드=1080² 워터마크.
 * 잉크 & 리소 에디션 — 헤더 잉크 라인, 미리보기 프레임 하드 오프셋, 옵션 칩 리소.
 */
"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Button,
  SegmentedToggle,
  AIDisclosureBadge,
  WatermarkOverlay,
  Skeleton,
  Toast,
} from "@/components";
import { ROUTES } from "@/lib/constants";
import { COPY } from "@/lib/copy";
import { AI_DISCLOSURE_TEXT } from "@/lib/constants";
import { useDiary } from "@/hooks/useDiary";
import { useQuota } from "@/hooks/useQuota";
import type { ShareRatio } from "@/lib/contract";

const RATIO_OPTIONS: { value: ShareRatio; label: string }[] = [
  { value: "1:1", label: COPY.share.ratio11 },
  { value: "16:9", label: COPY.share.ratio169 },
  { value: "9:16", label: COPY.share.ratio916 },
];

/** 비율별 미리보기 컨테이너 aspect-ratio 클래스 */
const RATIO_ASPECT: Record<ShareRatio, string> = {
  "1:1": "aspect-square",
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16]",
};

export default function SharePage() {
  const router = useRouter();
  const params = useParams();
  const diaryId = typeof params.id === "string" ? params.id : null;

  const { data: diary, isLoading } = useDiary(diaryId);
  const { data: quota } = useQuota();

  const [ratio, setRatio] = useState<ShareRatio>("1:1");
  const [isDownloading, setIsDownloading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const tier = quota?.tier ?? "free";

  /** 공유 카드 URL (Satori 생성 route) */
  const cardUrl = diaryId
    ? `/diary/${diaryId}/share/card?ratio=${encodeURIComponent(ratio)}`
    : null;

  const handleNativeShare = useCallback(async () => {
    if (!cardUrl || !diaryId) return;
    const shareUrl = `${window.location.origin}${ROUTES.sharePublic(diaryId)}`;

    // Web Share API 우선 (ux-spec §7: 마찰 제로 공유)
    if (navigator.share) {
      try {
        await navigator.share({
          title: "툰일기 만화",
          text: AI_DISCLOSURE_TEXT,
          url: shareUrl,
        });
        return;
      } catch {
        // 취소 또는 미지원 — fallback
      }
    }
    // fallback: 링크 복사
    try {
      await navigator.clipboard.writeText(shareUrl);
      setToastMsg(COPY.share.linkCopied);
    } catch {
      setToastMsg(COPY.error.generic);
    }
  }, [cardUrl, diaryId]);

  const handleDownload = useCallback(async () => {
    if (!cardUrl) return;
    setIsDownloading(true);
    try {
      // 1080² 다운로드 요청
      const downloadUrl = `${cardUrl}&download=1`;
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error("다운로드 실패");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `toonlog-${diaryId}-${ratio.replace(":", "x")}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setToastMsg(COPY.error.generic);
    } finally {
      setIsDownloading(false);
    }
  }, [cardUrl, diaryId, ratio]);

  const handleCopyLink = useCallback(async () => {
    if (!diaryId) return;
    const shareUrl = `${window.location.origin}${ROUTES.sharePublic(diaryId)}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setToastMsg(COPY.share.linkCopied);
    } catch {
      setToastMsg(COPY.error.generic);
    }
  }, [diaryId]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg-base)]">
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col px-5 py-4">

        {/* 헤더 — 잉크 라인 + font-heading */}
        <header className="mb-5 flex items-center gap-3 border-b-2 border-[var(--color-line)] pb-3">
          <button
            onClick={() => router.back()}
            aria-label="뒤로 가기"
            className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-[var(--color-line)] bg-[var(--color-surface-raised)] font-english text-lg text-[var(--color-text-secondary)] shadow-[var(--shadow-pop-sm)] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-pop)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[var(--shadow-pop-xs)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
          >
            ←
          </button>
          <h1 className="flex-1 font-heading text-lg text-[var(--color-text-primary)]">
            {COPY.share.title}
          </h1>
          <AIDisclosureBadge />
        </header>

        {/* 비율 선택 — SegmentedToggle */}
        <div className="mb-5">
          <p className="mb-2 font-heading text-xs text-[var(--color-text-muted)]">
            {COPY.share.ratioLabel}
          </p>
          <SegmentedToggle
            options={RATIO_OPTIONS}
            value={ratio}
            onChange={(v) => setRatio(v as ShareRatio)}
            aria-label="공유 카드 비율 선택"
          />
        </div>

        {/* 카드 미리보기 — 잉크 라인 프레임 + 하드 오프셋 */}
        <div className="mb-4 flex flex-1 items-center justify-center">
          {isLoading || !diary ? (
            <div className={`w-full ${RATIO_ASPECT[ratio]} max-h-[60vh]`}>
              <Skeleton className="h-full w-full rounded-xl" />
            </div>
          ) : (
            <div
              className={`relative w-full ${RATIO_ASPECT[ratio]} max-h-[60vh] overflow-hidden rounded-xl border-[3px] border-[var(--color-line)] bg-[var(--color-bg-subtle)] shadow-[var(--shadow-pop-lg)]`}
              aria-label={`${ratio} 공유 카드 미리보기`}
            >
              {/* 하프톤 배경 플레이스홀더 */}
              <span
                aria-hidden
                className="tone-dots pointer-events-none absolute inset-0 text-[var(--color-text-muted)] opacity-15"
              />
              {/* Satori 미리보기 이미지 (512px 다운스케일 — 무료 정책) */}
              {cardUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${cardUrl}&preview=1`}
                  alt="공유 카드 미리보기"
                  className="relative h-full w-full object-contain"
                  loading="lazy"
                />
              ) : (
                <div className="relative flex h-full items-center justify-center">
                  <p className="font-balloon text-sm text-[var(--color-text-muted)]">
                    미리보기 준비 중
                  </p>
                </div>
              )}
              {/* 워터마크 오버레이 */}
              <WatermarkOverlay tier={tier} isShareCard />
            </div>
          )}
        </div>

        {/* 워터마크 힌트 (무료 티어) */}
        {tier === "free" && (
          <p className="mb-3 text-center font-balloon text-xs text-[var(--color-text-muted)]">
            {COPY.share.watermarkFreeHint}
          </p>
        )}

        {/* AI 생성 고지 — 법무 필수 (design-final §8.2) */}
        <p className="mb-4 text-center font-sans text-xs text-[var(--color-text-muted)]">
          {AI_DISCLOSURE_TEXT}
        </p>

        {/* 공유/다운로드 버튼 */}
        <div className="mt-auto flex flex-col gap-3 pb-safe">
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleNativeShare}
          >
            {COPY.share.ctaShareNative}
          </Button>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="md"
              className="flex-1"
              disabled={isDownloading}
              onClick={handleDownload}
            >
              {isDownloading ? "저장 중..." : COPY.share.ctaDownload}
            </Button>
            <Button
              variant="ghost"
              size="md"
              className="flex-1"
              onClick={handleCopyLink}
            >
              {COPY.share.ctaCopyLink}
            </Button>
          </div>
        </div>
      </div>

      {toastMsg && (
        <Toast
          message={toastMsg}
          variant="success"
          onDismiss={() => setToastMsg(null)}
        />
      )}
    </div>
  );
}
