/**
 * S3 일기 작성 페이지.
 * ux-spec §4 화면2~3 + design-final §10 충돌해소 #1(50~300자).
 * 클라이언트: Textarea 상호작용, 화풍/아바타 선택, 한도 체크.
 */
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Textarea,
  BottomSheet,
  Chip,
  QuotaChip,
  Toast,
} from "@/components";
import { ART_STYLES, ROUTES, DIARY_TEXT_MIN, DIARY_TEXT_MAX } from "@/lib/constants";
import { COPY } from "@/lib/copy";
import { useDiaryDraftStore } from "@/store/diaryDraftStore";
import { useCreateDiary } from "@/hooks/useCreateDiary";
import { useQuota } from "@/hooks/useQuota";
import { useGenerationStore } from "@/store/generationStore";
import type { ArtStyleKey } from "@/lib/contract";

/* ─── 단계 라벨 (종이/잉크 무드) ─── */
function StepLabel({ num, label }: { num: string; label: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span
        aria-hidden
        className="flex h-6 w-6 -rotate-3 items-center justify-center rounded-full border-2 border-[var(--color-line)] bg-[var(--color-accent)] font-english text-[11px] leading-none text-[var(--color-accent-text)] shadow-[var(--shadow-pop-xs)]"
      >
        {num}
      </span>
      <p
        id={`step-label-${num}`}
        className="font-heading text-sm text-[var(--color-text-secondary)]"
      >
        {label}
      </p>
    </div>
  );
}

export default function DiaryNewPage() {
  const router = useRouter();
  const { text, artStyle, avatar, setText, setArtStyle, clearText } =
    useDiaryDraftStore();
  const { data: quota } = useQuota();
  const createDiary = useCreateDiary();
  const { init: initGeneration } = useGenerationStore();

  const [showQuotaSheet, setShowQuotaSheet] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const isTextValid =
    text.length >= DIARY_TEXT_MIN && text.length <= DIARY_TEXT_MAX;
  const isOverLimit = text.length > DIARY_TEXT_MAX;
  const hasQuota = (quota?.remaining ?? 1) > 0 || (quota?.credits ?? 0) > 0;

  const handleCreate = useCallback(async () => {
    if (!isTextValid) return;

    // 한도 체크 — 글 작성 후 차단 방지: 생성 시도 직전에만 체크 (ux-spec §8.2)
    if (!hasQuota) {
      setShowQuotaSheet(true);
      return;
    }

    try {
      const result = await createDiary.mutateAsync({
        text,
        artStyle,
        avatar,
      });
      // 생성 스토어 초기화
      initGeneration(result.jobId, result.diaryId);
      clearText();
      router.push(ROUTES.diaryGenerating(result.diaryId));
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : COPY.error.generic;
      setToastMsg(msg);
    }
  }, [
    isTextValid,
    hasQuota,
    text,
    artStyle,
    avatar,
    createDiary,
    initGeneration,
    clearText,
    router,
  ]);

  return (
    <div className="relative px-5 py-4">
      {/* 배경 데코 — 종이 줄 느낌 보조 */}
      <span
        aria-hidden
        className="tone-lines pointer-events-none absolute right-0 top-0 h-32 w-24 text-[var(--color-text-muted)] opacity-[0.06]"
      />

      {/* 헤더 */}
      <div className="relative mb-5 flex items-center justify-between">
        <div>
          <span
            aria-hidden
            className="mb-0.5 block font-heading text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            today
          </span>
          <h1 className="font-display text-[1.9rem] leading-[1.1] text-[var(--color-text-primary)]">
            오늘 일기
          </h1>
        </div>
        {/* 잔여 한도 칩 — P0 (ux-spec 화면2) */}
        <QuotaChip quota={quota} />
      </div>

      {/* STEP 1 — 일기 텍스트 */}
      <section className="mb-5" aria-labelledby="step-label-1">
        <StepLabel num="1" label="오늘 있었던 일을 써주세요" />
        <div className="relative">
          {/* 종이 배경 카드 */}
          <div className="overflow-hidden rounded-xl border-2 border-[var(--color-line)] bg-[var(--color-surface-raised)] shadow-[var(--shadow-pop)]">
            {/* 종이 줄 데코 */}
            <span
              aria-hidden
              className="tone-lines pointer-events-none absolute inset-0 text-[var(--color-border-subtle)] opacity-[0.5]"
            />
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={COPY.diaryNew.placeholder}
              minLength={DIARY_TEXT_MIN}
              maxLength={DIARY_TEXT_MAX + 50} // 오버 입력 허용 후 경고
              rows={8}
              aria-label="일기 내용"
              aria-describedby="diary-counter"
              hideCounter // 카운터는 아래 커스텀 aria-live 카운터로 단일화 (중복 방지)
              className="relative w-full border-0 bg-transparent shadow-none"
            />
          </div>
        </div>
        {/* 글자 수 카운터 */}
        <div
          id="diary-counter"
          aria-live="polite"
          className={[
            "mt-1.5 text-right font-english text-xs",
            isOverLimit
              ? "text-[var(--color-warning)]"
              : text.length >= DIARY_TEXT_MIN
              ? "text-[var(--color-text-muted)]"
              : "text-[var(--color-text-disabled)]",
          ].join(" ")}
        >
          {isOverLimit
            ? COPY.diaryNew.counterWarning(text.length, DIARY_TEXT_MAX)
            : COPY.diaryNew.counter(text.length, DIARY_TEXT_MAX)}
        </div>
      </section>

      {/* STEP 2 — 화풍 선택 */}
      <section className="mb-5" aria-labelledby="step-label-2">
        <StepLabel num="2" label={COPY.diaryNew.artStyleLabel} />
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="step-label-2">
          {ART_STYLES.map((style) => (
            <Chip
              key={style.key}
              selected={artStyle === style.key}
              onClick={() => setArtStyle(style.key as ArtStyleKey)}
              role="radio"
              aria-checked={artStyle === style.key}
            >
              {style.name}
            </Chip>
          ))}
        </div>
      </section>

      {/* STEP 3 — 아바타 확인 / 변경 */}
      <section className="mb-8" aria-labelledby="step-label-3">
        <StepLabel num="3" label={COPY.diaryNew.avatarLabel} />
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[var(--color-line)] bg-[var(--color-bg-subtle)] text-xl shadow-[var(--shadow-pop-xs)]"
            aria-label={COPY.diaryNew.avatarLabel}
          >
            👤
          </div>
          <div>
            <p className="font-heading text-sm text-[var(--color-text-primary)]">
              내 캐릭터
            </p>
            <button
              onClick={() => router.push(ROUTES.onboarding)}
              className="font-heading text-xs text-[var(--color-text-link)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] rounded-sm"
            >
              변경하기
            </button>
          </div>
        </div>
      </section>

      {/* 생성 CTA — "만화로 만들기" */}
      <div className="relative mb-4">
        {/* 잉크 스탬프 데코 */}
        {isTextValid && (
          <div
            aria-hidden
            className="absolute -right-1 -top-4 flex h-11 w-11 rotate-12 items-center justify-center rounded-full border-[3px] border-[var(--color-line)] bg-[var(--color-primary)] font-english text-xs text-[var(--color-primary-text)] shadow-[var(--shadow-pop)] motion-safe:animate-[inkStamp_.5s_ease-out_both]"
          >
            GO!
          </div>
        )}
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!isTextValid || createDiary.isPending}
          onClick={handleCreate}
          aria-label={
            isTextValid
              ? COPY.diaryNew.ctaCreate
              : COPY.diaryNew.ctaCreateDisabled
          }
        >
          {createDiary.isPending ? "생성 중..." : COPY.diaryNew.ctaCreate}
        </Button>
      </div>

      {!isTextValid && text.length > 0 && (
        <p
          role="alert"
          className="mt-2 text-center font-balloon text-xs text-[var(--color-text-muted)]"
        >
          {COPY.diaryNew.ctaCreateDisabled}
        </p>
      )}

      {/* 한도 소진 BottomSheet — ux-spec §8.2, 플로우 B */}
      <BottomSheet
        open={showQuotaSheet}
        onClose={() => setShowQuotaSheet(false)}
        title={COPY.quota.title}
      >
        <div className="px-5 pb-8 pt-2">
          <p className="mb-2 whitespace-pre-line font-sans text-sm text-[var(--color-text-secondary)]">
            {COPY.quota.body}
          </p>
          {quota?.resetAt && (
            <p className="mb-6 font-english text-xs text-[var(--color-text-muted)]">
              {COPY.quota.resetHint(quota.resetAt)}
            </p>
          )}
          <div className="flex flex-col gap-3">
            {/* "내일 다시" = "업그레이드" 동등 (design-final §4 플로우B 설계 원칙) */}
            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={() => {
                setShowQuotaSheet(false);
                router.push(ROUTES.upgrade);
              }}
            >
              {COPY.quota.ctaUpgrade}
            </Button>
            <Button
              variant="ghost"
              size="md"
              className="w-full"
              onClick={() => setShowQuotaSheet(false)}
            >
              {COPY.quota.ctaTomorrow}
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* 토스트 에러 */}
      {toastMsg && (
        <Toast
          message={toastMsg}
          variant="error"
          onDismiss={() => setToastMsg(null)}
        />
      )}
    </div>
  );
}
