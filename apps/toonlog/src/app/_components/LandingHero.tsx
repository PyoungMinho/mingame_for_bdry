/**
 * 랜딩 히어로 — 잉크 & 리소 에디션.
 * 실제 4컷 만화 목업이 화풍 칩으로 리톤(retint)되는 시그니처 히어로.
 * ux-spec §4 화면1 / design-final RISO EDITION.
 */
"use client";

import { useState, type SVGProps } from "react";
import Link from "next/link";
import { Button, Chip } from "@/components";
import { ART_STYLES, TIERS, ROUTES } from "@/lib/constants";
import { COPY } from "@/lib/copy";
import type { ArtStyleKey } from "@/lib/contract";

/* ─── 화풍별 프리뷰 트리트먼트(장식 아트 팔레트 — ArtStyleCard 와 동일 컨셉) ─── */
type Treatment = { bg: string; ink: string; accent: string; stroke: number };
const PREVIEW: Record<ArtStyleKey, Treatment> = {
  emotional_line: { bg: "#FFF0F4", ink: "#83405A", accent: "#FF3D7F", stroke: 1.6 },
  bold_pen: { bg: "#F1EADB", ink: "#16130F", accent: "#16130F", stroke: 3 },
  pop_cartoon: { bg: "#FFF3BF", ink: "#16130F", accent: "#FF3D7F", stroke: 2.6 },
  watercolor_touch: { bg: "#E6ECFB", ink: "#27397E", accent: "#2541B2", stroke: 1.8 },
};

/* ─── 4컷 미니 스토리(비 오는 퇴근길) ─── */
const STORY: { cap: string; motif: "sun" | "rain" | "umbrella" | "heart" }[] = [
  { cap: "맑던 아침", motif: "sun" },
  { cap: "갑자기 비가", motif: "rain" },
  { cap: "우산 챙겼다", motif: "umbrella" },
  { cap: "무사 귀가", motif: "heart" },
];

type MotifName = (typeof STORY)[number]["motif"];

function Motif({ name, color, sw }: { name: MotifName; color: string; sw: number }) {
  const common: SVGProps<SVGSVGElement> = {
    width: "100%",
    height: "100%",
    viewBox: "0 0 48 48",
    fill: "none",
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  switch (name) {
    case "sun":
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="7" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const r = (a * Math.PI) / 180;
            return (
              <line
                key={a}
                x1={24 + Math.cos(r) * 12}
                y1={24 + Math.sin(r) * 12}
                x2={24 + Math.cos(r) * 17}
                y2={24 + Math.sin(r) * 17}
              />
            );
          })}
        </svg>
      );
    case "rain":
      return (
        <svg {...common}>
          <path d="M14 26a7 7 0 0 1 1-13 9 9 0 0 1 17-1 6 6 0 0 1 1 14z" />
          <line x1="17" y1="33" x2="14" y2="40" />
          <line x1="25" y1="33" x2="22" y2="40" />
          <line x1="33" y1="33" x2="30" y2="40" />
        </svg>
      );
    case "umbrella":
      return (
        <svg {...common}>
          <path d="M9 25a15 15 0 0 1 30 0z" />
          <path d="M24 25v12a4 4 0 0 1-7 2.5" />
          <path d="M16 25c2-3 6-3 8 0M24 25c2-3 6-3 8 0" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common}>
          <path d="M24 39C9 29 11 15 22 19c1.4.5 1.9 1.6 2 2.6.1-1 .6-2.1 2-2.6 11-4 13 10-2 20z" />
        </svg>
      );
  }
}

/* ─── 4컷 만화 프리뷰(화풍별 리톤) ─── */
function ComicPreview({ styleKey }: { styleKey: ArtStyleKey }) {
  const t = PREVIEW[styleKey];
  const meta = ART_STYLES.find((s) => s.key === styleKey);
  return (
    <figure
      role="img"
      aria-label={`${meta?.name} 화풍 4컷 예시 — ${meta?.desc}`}
      className="tilt-r relative mx-auto aspect-square w-full max-w-[300px] overflow-hidden rounded-lg border-[3px] border-[var(--color-line)] bg-[var(--color-surface-raised)] shadow-[var(--shadow-pop-xl)] transition-transform duration-300"
    >
      <div className="grid h-full w-full grid-cols-2 grid-rows-2">
        {STORY.map((p, i) => (
          <div
            key={i}
            style={{ backgroundColor: t.bg, color: t.ink, animationDelay: `${i * 110}ms` }}
            className={[
              "relative flex flex-col items-center justify-center gap-1 p-3",
              "motion-safe:animate-[panelStamp_.5s_ease-out_both]",
              i % 2 === 0 ? "border-r-2 border-[var(--color-line)]" : "",
              i < 2 ? "border-b-2 border-[var(--color-line)]" : "",
            ].join(" ")}
          >
            {/* 하프톤 결 */}
            <span
              aria-hidden
              className="tone-dots pointer-events-none absolute inset-0 opacity-[0.18]"
              style={{ color: t.ink }}
            />
            {/* 컷 번호 */}
            <span
              aria-hidden
              className="absolute left-1.5 top-1.5 flex h-5 w-5 -rotate-6 items-center justify-center rounded-full border-2 border-[var(--color-line)] bg-[var(--color-lemon)] font-english text-[10px] leading-none text-[var(--color-ink)] shadow-[var(--shadow-pop-xs)]"
            >
              {i + 1}
            </span>
            {/* 모티프 */}
            <span className="relative h-12 w-12">
              <Motif name={p.motif} color={t.ink} sw={t.stroke} />
            </span>
            {/* 캡션 */}
            <span className="relative font-balloon text-sm leading-none" style={{ color: t.ink }}>
              {p.cap}
            </span>
          </div>
        ))}
      </div>
    </figure>
  );
}

export function LandingHero() {
  const [activeStyle, setActiveStyle] = useState<ArtStyleKey>("emotional_line");
  const [activeTier, setActiveTier] = useState<keyof typeof TIERS>("basic");

  const tierList = Object.values(TIERS);
  const tier = TIERS[activeTier];

  return (
    <div className="relative mx-auto max-w-[480px] overflow-x-hidden px-5">
      {/* 배경 하프톤 데코 */}
      <span
        aria-hidden
        className="tone-dots-lg pointer-events-none absolute -right-10 top-24 h-48 w-48 rounded-full text-[var(--color-primary)] opacity-[0.10]"
      />
      <span
        aria-hidden
        className="tone-grid pointer-events-none absolute -left-12 top-[420px] h-44 w-44 text-[var(--color-secondary)] opacity-[0.08]"
      />

      {/* 헤더 */}
      <header className="relative flex items-center justify-between py-4">
        <span className="font-logo text-2xl tracking-tight text-[var(--color-text-primary)]">
          툰<span className="text-[var(--color-primary)]">일기</span>
        </span>
        <Link
          href={ROUTES.onboarding}
          className="font-heading text-sm text-[var(--color-text-secondary)] underline-offset-4 hover:text-[var(--color-text-primary)] hover:underline"
        >
          {COPY.landing.loginLink}
        </Link>
      </header>

      {/* 키커 스탬프 */}
      <div className="relative mb-3 mt-2">
        <span className="tilt-l inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--color-line)] bg-[var(--color-accent)] px-3 py-1 font-heading text-xs text-[var(--color-accent-text)] shadow-[var(--shadow-pop-xs)]">
          <span className="font-english tracking-wide">AI</span> 4컷 일기
        </span>
      </div>

      {/* 히어로 카피 */}
      <h1 className="relative mb-1 font-display text-[2.6rem] leading-[1.08] text-[var(--color-text-primary)]">
        {COPY.landing.headline}
      </h1>
      {/* 손그림 밑줄 */}
      <svg
        aria-hidden
        viewBox="0 0 200 12"
        preserveAspectRatio="none"
        className="mb-3 h-3 w-44 text-[var(--color-primary)]"
      >
        <path
          d="M2 8 Q 25 2 50 7 T 100 6 T 150 7 T 198 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
      <p className="mb-7 font-sans text-lg text-[var(--color-text-secondary)]">
        {COPY.landing.subheadline}, <span className="font-balloon text-[var(--color-text-primary)]">툭 던지면 끝.</span>
      </p>

      {/* 히어로 4컷 프리뷰 + 데코 */}
      <div className="relative mb-5 px-2">
        <ComicPreview styleKey={activeStyle} />

        {/* 말풍선 */}
        <div className="tilt-l absolute -left-1 top-1 z-10 rounded-2xl rounded-bl-sm border-2 border-[var(--color-line)] bg-[var(--color-surface-raised)] px-3 py-1.5 font-balloon text-sm text-[var(--color-text-primary)] shadow-[var(--shadow-pop-sm)]">
          오늘 일기 한 편 →
        </div>
        {/* AI 도장 */}
        <div className="absolute -bottom-2 -right-1 z-10 flex h-14 w-14 rotate-12 items-center justify-center rounded-full border-[3px] border-[var(--color-line)] bg-[var(--color-primary)] font-english text-lg text-[var(--color-primary-text)] shadow-[var(--shadow-pop)] motion-safe:animate-[inkStamp_.6s_ease-out_both]">
          4컷!
        </div>
      </div>

      {/* 화풍 칩(프리뷰 제어) */}
      <section className="relative mb-9" aria-labelledby="art-style-heading">
        <h2
          id="art-style-heading"
          className="mb-2 font-heading text-sm text-[var(--color-text-muted)]"
        >
          화풍 골라 탭해보세요
        </h2>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="화풍 미리보기">
          {ART_STYLES.map((style) => (
            <Chip
              key={style.key}
              selected={activeStyle === style.key}
              onClick={() => setActiveStyle(style.key)}
              role="tab"
              aria-selected={activeStyle === style.key}
            >
              {style.name}
            </Chip>
          ))}
        </div>
      </section>

      {/* 소셜 로그인 CTA */}
      <div className="relative mb-10 flex flex-col gap-3">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => {
            window.location.href = "/api/auth/google";
          }}
        >
          {COPY.landing.ctaGoogle}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          onClick={() => {
            window.location.href = "/api/auth/kakao";
          }}
        >
          {COPY.landing.ctaKakao}
        </Button>
        <p className="text-center font-sans text-sm text-[var(--color-text-muted)]">
          {COPY.landing.loginHint}{" "}
          <Link
            href={ROUTES.onboarding}
            className="font-heading text-[var(--color-text-link)] underline-offset-2 hover:underline"
          >
            {COPY.landing.loginLink}
          </Link>
        </p>
      </div>

      {/* 요금제 */}
      <section className="relative mb-12" aria-labelledby="pricing-heading">
        <h2
          id="pricing-heading"
          className="mb-3 font-heading text-lg text-[var(--color-text-primary)]"
        >
          요금제
        </h2>
        <div className="mb-4 flex gap-2" role="tablist" aria-label="요금제 선택">
          {tierList.map((t) => (
            <Chip
              key={t.key}
              selected={activeTier === t.key}
              onClick={() => setActiveTier(t.key)}
              role="tab"
              aria-selected={activeTier === t.key}
            >
              {t.name}
            </Chip>
          ))}
        </div>

        {/* 요금제 카드 */}
        <div
          className="relative overflow-hidden rounded-xl border-2 border-[var(--color-line)] bg-[var(--color-surface-raised)] p-5 shadow-[var(--shadow-pop)]"
          role="tabpanel"
        >
          <span
            aria-hidden
            className="tone-dots pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full text-[var(--color-primary)] opacity-10"
          />
          <p className="relative font-heading text-lg text-[var(--color-text-primary)]">
            {tier.name}
          </p>
          <p className="relative mb-1 flex items-baseline gap-1">
            <span className="font-display text-4xl text-[var(--color-primary)]">
              {tier.monthly === 0 ? "무료" : `₩${tier.monthly.toLocaleString()}`}
            </span>
            {tier.monthly !== 0 && (
              <span className="font-heading text-sm text-[var(--color-text-muted)]">/월</span>
            )}
          </p>
          <p className="relative mb-4 font-sans text-sm text-[var(--color-text-secondary)]">
            월 <span className="font-english">{tier.monthlyQuota}</span>컷
            {tier.watermark !== "off"
              ? tier.watermark === "large"
                ? " · 워터마크 포함"
                : " · 소형 워터마크"
              : " · 워터마크 제거"}
          </p>
          <Button variant="primary" size="md" className="relative w-full" asChild>
            <Link href={ROUTES.onboarding}>
              {activeTier === "free"
                ? COPY.landing.ctaFree
                : `${tier.name} 시작하기`}
            </Link>
          </Button>
        </div>
      </section>

      {/* 하단 CTA */}
      <div className="pb-safe relative mb-8 text-center">
        <Button variant="ghost" size="md" asChild>
          <Link href={ROUTES.onboarding}>{COPY.landing.ctaFree}</Link>
        </Button>
      </div>
    </div>
  );
}
