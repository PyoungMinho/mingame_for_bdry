/**
 * S9b 요금제 업그레이드 — 요금제 카드 + 월/연 토글 + 크레딧팩. P1.
 * ux-spec §8.2 + design-final §4 플로우B.
 * 잉크 & 리소 에디션 — LandingHero 요금제 카드 톤 참고, 추천 스탬프.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, SegmentedToggle } from "@/components";
import { TIERS, CREDIT_PACKS, BETA_EARLYBIRD_DISCOUNT } from "@/lib/constants";
import { COPY } from "@/lib/copy";
import { useQuota } from "@/hooks/useQuota";

const BILLING_OPTIONS = [
  { value: "monthly", label: COPY.upgrade.billingMonthly },
  { value: "yearly", label: COPY.upgrade.billingYearly },
];

export default function UpgradePage() {
  const router = useRouter();
  const { data: quota } = useQuota();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const currentTier = quota?.tier ?? "free";

  const tierList = [TIERS.free, TIERS.basic, TIERS.pro];

  function getPrice(tier: typeof TIERS.basic) {
    if (tier.monthly === 0) return "무료";
    const price =
      billing === "yearly"
        ? Math.round((tier.yearly / 12) * (1 - BETA_EARLYBIRD_DISCOUNT))
        : Math.round(tier.monthly * (1 - BETA_EARLYBIRD_DISCOUNT));
    // 단위("/ 월")는 아래 레이아웃에서 스타일된 span으로 별도 표기 — 여기선 금액만
    return `₩${price.toLocaleString()}`;
  }

  return (
    <div className="relative mx-auto max-w-[480px] overflow-x-hidden px-5 py-4">
      {/* 배경 하프톤 데코 */}
      <span
        aria-hidden
        className="tone-dots-lg pointer-events-none absolute -right-12 top-16 h-52 w-52 rounded-full text-[var(--color-accent)] opacity-[0.08]"
      />
      <span
        aria-hidden
        className="tone-grid pointer-events-none absolute -left-10 bottom-24 h-44 w-44 text-[var(--color-secondary)] opacity-[0.06]"
      />

      {/* 헤더 — 잉크 라인 + font-heading */}
      <header className="relative mb-6 flex items-center gap-3 border-b-2 border-[var(--color-line)] pb-3">
        <button
          onClick={() => router.back()}
          aria-label="뒤로 가기"
          className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-[var(--color-line)] bg-[var(--color-surface-raised)] font-english text-lg text-[var(--color-text-secondary)] shadow-[var(--shadow-pop-sm)] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-pop)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[var(--shadow-pop-xs)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
        >
          ←
        </button>
        <h1 className="relative flex-1 font-heading text-lg text-[var(--color-text-primary)]">
          {COPY.upgrade.title}
        </h1>
      </header>

      {/* 월/연 토글 */}
      <div className="relative mb-6">
        <SegmentedToggle
          options={BILLING_OPTIONS}
          value={billing}
          onChange={(v) => setBilling(v as "monthly" | "yearly")}
          aria-label="결제 주기 선택"
        />
        {billing === "yearly" && (
          <p className="mt-2 text-center font-balloon text-sm text-[var(--color-success)]">
            얼리버드 30% 할인 + 2개월 무료
          </p>
        )}
      </div>

      {/* 요금제 카드 — LandingHero 톤 참고 */}
      <div className="relative mb-8 flex flex-col gap-3">
        {tierList.map((tier) => {
          const isCurrent = tier.key === currentTier;
          const isRecommended = tier.key === "basic";

          return (
            <div
              key={tier.key}
              className={`relative overflow-hidden rounded-xl border-2 p-5 transition-[transform,box-shadow] duration-150 ease-out ${
                isCurrent
                  ? "border-[var(--color-primary)] bg-[var(--color-surface-raised)] shadow-[var(--shadow-pop-pink)]"
                  : "border-[var(--color-line)] bg-[var(--color-surface-raised)] shadow-[var(--shadow-pop)]"
              }`}
            >
              {/* 하프톤 결 */}
              <span
                aria-hidden
                className={`tone-dots pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10 ${
                  isCurrent ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"
                }`}
              />

              {/* 추천 스탬프 */}
              {isRecommended && !isCurrent && (
                <span className="tilt-r absolute -right-1 -top-1 z-10 flex h-12 w-12 rotate-12 items-center justify-center rounded-full border-2 border-[var(--color-line)] bg-[var(--color-lemon)] font-english text-[10px] leading-tight text-[var(--color-ink)] shadow-[var(--shadow-pop-xs)] motion-safe:animate-[inkStamp_.6s_ease-out_both]">
                  추천!
                </span>
              )}

              <div className="relative flex items-start justify-between mb-2">
                <div>
                  <p className="font-heading text-base text-[var(--color-text-primary)]">
                    {tier.name}
                  </p>
                  {/* 가격 — font-display */}
                  <p className="flex items-baseline gap-1">
                    <span className="font-display text-3xl text-[var(--color-primary)]">
                      {getPrice(tier)}
                    </span>
                    {tier.monthly !== 0 && (
                      <span className="font-heading text-xs text-[var(--color-text-muted)]">/ 월</span>
                    )}
                  </p>
                </div>
                {isCurrent && (
                  <span className="rounded-full border-2 border-[var(--color-line)] bg-[var(--color-primary-subtle)] px-2 py-0.5 font-heading text-xs text-[var(--color-primary)] shadow-[var(--shadow-pop-xs)]">
                    현재
                  </span>
                )}
              </div>

              {/* 기능 목록 */}
              <ul className="relative mb-4 space-y-1">
                <li className="flex items-center gap-2 font-sans text-sm text-[var(--color-text-secondary)]">
                  <span className="font-english text-xs text-[var(--color-primary)]">▸</span>
                  월 <span className="font-english text-[var(--color-text-primary)]">{tier.monthlyQuota}</span>컷
                </li>
                <li className="flex items-center gap-2 font-sans text-sm text-[var(--color-text-secondary)]">
                  <span className="font-english text-xs text-[var(--color-primary)]">▸</span>
                  {tier.watermark === "off"
                    ? "워터마크 제거"
                    : tier.watermark === "small"
                    ? "소형 워터마크"
                    : "워터마크 포함"}
                </li>
                {tier.key !== "free" && (
                  <li className="flex items-center gap-2 font-sans text-sm text-[var(--color-text-secondary)]">
                    <span className="font-english text-xs text-[var(--color-primary)]">▸</span>
                    HD 다운로드
                  </li>
                )}
              </ul>

              <Button
                variant={isCurrent ? "ghost" : "primary"}
                size="sm"
                className="relative w-full"
                disabled={isCurrent}
                onClick={() => {
                  if (!isCurrent) {
                    /* 결제 플로우 — 백엔드 /api/payments 의존 */
                    alert("결제 플로우 준비 중입니다.");
                  }
                }}
              >
                {isCurrent
                  ? COPY.upgrade.ctaCurrentPlan
                  : COPY.upgrade.ctaSelect}
              </Button>
            </div>
          );
        })}
      </div>

      {/* 크레딧 팩 */}
      <section aria-labelledby="credit-pack-heading">
        <h2
          id="credit-pack-heading"
          className="mb-1 font-heading text-base text-[var(--color-text-primary)]"
        >
          {COPY.upgrade.creditPackTitle}
        </h2>
        <p className="mb-3 font-sans text-sm text-[var(--color-text-muted)]">
          {COPY.upgrade.creditPackHint}
        </p>
        <div className="flex gap-2">
          {CREDIT_PACKS.map((pack) => (
            <button
              key={pack.credits}
              className="flex-1 rounded-xl border-2 border-[var(--color-line)] bg-[var(--color-surface-raised)] p-3 text-center shadow-[var(--shadow-pop-sm)] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-pop)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
              onClick={() => alert("결제 플로우 준비 중입니다.")}
            >
              <p className="font-english text-xl text-[var(--color-text-primary)]">
                {pack.credits}컷
              </p>
              <p className="font-sans text-xs text-[var(--color-text-muted)]">
                ₩{pack.price.toLocaleString()}
              </p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
