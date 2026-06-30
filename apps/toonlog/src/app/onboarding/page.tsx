/**
 * S1b 온보딩 — 소셜 로그인 완료 후 아바타 설정.
 * ux-spec §4 화면1(온보딩) 기반.
 * 클라이언트 컴포넌트 (아바타 선택 인터랙션).
 *
 * 아바타 선택은 AvatarSelector 컴포넌트(SSOT)가 프리셋 그리드 + 헤어/상의/액세서리
 * 커스터마이저를 모두 제공한다. 이 페이지는 value/onChange로 상태만 연결.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, AvatarSelector } from "@/components";
import { ROUTES, DEFAULT_AVATAR } from "@/lib/constants";
import { COPY } from "@/lib/copy";
import { useDiaryDraftStore } from "@/store/diaryDraftStore";
import type { AvatarConfig } from "@/lib/contract";

/** 프리셋 이모지 미리보기 (실 SVG 에셋은 디자인 W2~W3 전달 후 교체 — design-final §12.1-4) */
const PRESET_EMOJI: Record<string, string> = {
  SHORT_HAIR_GIRL: "👧",
  LONG_HAIR_GIRL: "👩",
  SHORT_HAIR_BOY: "👦",
  CURLY_HAIR: "🧑‍🦱",
  TWIN_TAILS: "👧",
  GLASSES_KID: "🤓",
  HAT_BOY: "🧢",
  EARPHONE_TEEN: "🎧",
};

/** AvatarSelector가 다루는 부분 설정 + preset */
type AvatarDraft = Pick<AvatarConfig, "hairColor" | "topStyle" | "accessory"> & {
  preset?: string;
};

/* ─── 스텝 인디케이터 (리소 도장 스타일) ─── */
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2" role="progressbar" aria-valuenow={current} aria-valuemin={1} aria-valuemax={total} aria-label={`${total}단계 중 ${current}단계`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={[
            "flex items-center justify-center rounded-full border-2 border-[var(--color-line)] font-english text-[10px] leading-none transition-[transform,box-shadow,background-color] duration-150 ease-out",
            i + 1 === current
              ? "h-7 w-7 bg-[var(--color-primary)] text-[var(--color-primary-text)] shadow-[var(--shadow-pop-sm)] motion-safe:animate-[inkStamp_.4s_ease-out_both]"
              : i + 1 < current
              ? "h-6 w-6 bg-[var(--color-accent)] text-[var(--color-accent-text)] shadow-[var(--shadow-pop-xs)]"
              : "h-6 w-6 bg-[var(--color-surface-raised)] text-[var(--color-text-disabled)]",
          ].join(" ")}
        >
          {i + 1}
        </span>
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { setAvatar } = useDiaryDraftStore();

  const [draft, setDraft] = useState<AvatarDraft>({
    preset: "SHORT_HAIR_GIRL",
    hairColor: DEFAULT_AVATAR.hairColor,
    topStyle: DEFAULT_AVATAR.topStyle,
    accessory: DEFAULT_AVATAR.accessory,
  });

  function handleConfirm() {
    const avatar: AvatarConfig = {
      preset: draft.preset,
      hairColor: draft.hairColor,
      topStyle: draft.topStyle,
      accessory: draft.accessory,
      // 캐릭터 일관성 시드 고정 — contract AvatarConfig.seed
      seed: Math.floor(Math.random() * 2147483647),
    };
    setAvatar(avatar);
    router.push(ROUTES.diaryNew);
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--color-bg-base)]">
      {/* 배경 하프톤 데코 */}
      <span
        aria-hidden
        className="tone-dots-lg pointer-events-none absolute -right-8 top-20 h-40 w-40 rounded-full text-[var(--color-secondary)] opacity-[0.08]"
      />
      <span
        aria-hidden
        className="tone-grid pointer-events-none absolute -left-10 bottom-40 h-36 w-36 text-[var(--color-primary)] opacity-[0.07]"
      />

      <div className="mx-auto max-w-[480px] px-5">
        {/* 헤더 */}
        <header className="relative flex items-center justify-between py-4">
          <button
            onClick={() => router.back()}
            aria-label="뒤로 가기"
            className="flex h-11 w-11 items-center justify-center rounded-lg border-2 border-[var(--color-line)] bg-[var(--color-surface-raised)] font-heading text-[var(--color-text-secondary)] shadow-[var(--shadow-pop-xs)] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-pop)] hover:text-[var(--color-text-primary)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
          >
            ←
          </button>
          <StepDots current={1} total={2} />
        </header>

        {/* 키커 스탬프 */}
        <div className="relative mb-3 mt-2">
          <span className="tilt-l inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--color-line)] bg-[var(--color-accent)] px-3 py-1 font-heading text-xs text-[var(--color-accent-text)] shadow-[var(--shadow-pop-xs)]">
            <span className="font-english tracking-wide">STEP 1</span> 캐릭터 설정
          </span>
        </div>

        {/* 페이지 타이틀 */}
        <h1 className="relative mb-1 font-display text-[2.2rem] leading-[1.1] text-[var(--color-text-primary)]">
          {COPY.onboarding.avatarTitle}
        </h1>
        {/* 손그림 밑줄 */}
        <svg
          aria-hidden
          viewBox="0 0 200 12"
          preserveAspectRatio="none"
          className="mb-2 h-3 w-36 text-[var(--color-secondary)]"
        >
          <path
            d="M2 8 Q 25 2 50 7 T 100 6 T 150 7 T 198 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
        <p className="mb-6 font-sans text-sm text-[var(--color-text-muted)]">
          {COPY.onboarding.avatarHint}{" "}
          <span className="font-balloon text-[var(--color-text-secondary)]">만화 속 주인공이 될 거예요!</span>
        </p>

        {/* 실시간 미리보기 */}
        <div className="relative mb-6">
          <div
            className="relative mx-auto flex h-32 w-32 items-center justify-center overflow-hidden rounded-xl border-2 border-[var(--color-line)] bg-[var(--color-bg-subtle)] shadow-[var(--shadow-pop)] motion-safe:animate-[inkStamp_.5s_ease-out_both]"
            aria-label="아바타 미리보기"
          >
            <span
              aria-hidden
              className="tone-dots pointer-events-none absolute inset-0 text-[var(--color-text-muted)] opacity-[0.15]"
            />
            <span className="relative text-5xl" aria-hidden="true">
              {(draft.preset && PRESET_EMOJI[draft.preset]) ?? "👤"}
            </span>
          </div>
          {/* 데코 도장 */}
          <div
            aria-hidden
            className="absolute -bottom-2 -right-4 flex h-12 w-12 rotate-12 items-center justify-center rounded-full border-[3px] border-[var(--color-line)] bg-[var(--color-primary)] font-english text-sm text-[var(--color-primary-text)] shadow-[var(--shadow-pop)]"
          >
            ME!
          </div>
        </div>

        {/* 아바타 프리셋 8종 + 커스터마이저 (AvatarSelector SSOT) */}
        <AvatarSelector value={draft} onChange={setDraft} className="mb-8" />

        {/* CTA */}
        <Button
          variant="primary"
          size="lg"
          className="mb-8 w-full"
          onClick={handleConfirm}
        >
          {COPY.onboarding.ctaNext}
        </Button>
      </div>
    </div>
  );
}
