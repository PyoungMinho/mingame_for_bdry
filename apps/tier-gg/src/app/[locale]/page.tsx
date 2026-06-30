import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { mockModels } from "@/lib/data/mock-models";

export const revalidate = 3600;

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: HomePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });

  return {
    title: "Tier.gg — AI Model Rankings & Comparisons",
    description: t("heroSubtitle"),
    alternates: {
      canonical: locale === "en" ? "/" : `/${locale}`,
      languages: { en: "/", ko: "/ko" },
    },
    openGraph: {
      images: [
        {
          url: `/api/og?type=home`,
          width: 1200,
          height: 630,
        },
      ],
    },
  };
}

// 인기 비교 페어 데이터 (mock-models 슬러그 기준)
const POPULAR_PAIRS = [
  { a: "gpt-5", b: "claude-opus-4-7", labelA: "GPT-5", labelB: "Claude Opus 4.7" },
  { a: "gemini-2-0-pro", b: "gpt-5", labelA: "Gemini 2.0 Pro", labelB: "GPT-5" },
  { a: "claude-sonnet-4-6", b: "gemini-2-0-pro", labelA: "Claude Sonnet 4.6", labelB: "Gemini 2.0 Pro" },
  { a: "claude-haiku-4-5", b: "gpt-4o-mini", labelA: "Claude Haiku 4.5", labelB: "GPT-4o Mini" },
];

// 임시 changelog 데이터 (DB 연동 전)
const RECENT_CHANGELOG = [
  {
    id: "1",
    date: "2026-05-26",
    content: "GPT-4o input price updated — $5.00 → $2.50 / 1M tokens",
    sourceUrl: "https://openai.com/pricing",
  },
  {
    id: "2",
    date: "2026-05-24",
    content: "Claude Opus 5 added to the database",
    sourceUrl: "https://anthropic.com",
  },
  {
    id: "3",
    date: "2026-05-23",
    content: "LMArena Elo scores updated (2026-05-23 snapshot)",
    sourceUrl: "https://lmarena.ai",
  },
  {
    id: "4",
    date: "2026-05-20",
    content: "Gemini 1.5 Flash context window expanded to 1M tokens",
    sourceUrl: "https://ai.google.dev",
  },
  {
    id: "5",
    date: "2026-05-18",
    content: "Llama 3.1 70B HumanEval score updated via Artificial Analysis",
    sourceUrl: "https://artificialanalysis.ai",
  },
];

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });

  const localePath = (path: string) =>
    locale === "en" ? path : `/${locale}${path}`;

  // mockModels에서 카테고리별 Top 모델 추출 (placeholder — DB 시드 이후 Supabase 쿼리로 교체)
  // mockModels는 DB 연동 이후 실제 Supabase 쿼리로 교체 예정
  void mockModels; // 현재는 정적 데이터 미사용, DB 시드 완성 후 활성화

  return (
    <div className="flex flex-col">
      {/* HERO */}
      <section className="relative bg-gradient-to-b from-background to-accent/10 px-4 py-16 text-center md:py-24">
        <div className="mx-auto max-w-[800px]">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground md:text-xl">
            {t("heroSubtitle")}
          </p>

          {/* 검색 CTA */}
          <form
            action={localePath("/models")}
            method="GET"
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
          >
            <label htmlFor="hero-search" className="sr-only">
              {t("searchLabel")}
            </label>
            <input
              id="hero-search"
              name="q"
              type="search"
              placeholder={t("searchLabel")}
              className="w-full max-w-sm rounded-lg border border-input bg-background px-4 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary sm:w-80"
              autoComplete="off"
            />
            <button
              type="submit"
              className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t("compareButton")}
            </button>
          </form>

          {/* 위저드 보조 CTA */}
          <p className="mt-4">
            <Link
              href={localePath("/find")}
              className="text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t("wizardCTA")}
            </Link>
          </p>
        </div>
      </section>

      {/* AD_SLOT_HOME_LEADERBOARD_TOP */}
      {/* AD_SLOT_HOME_LEADERBOARD_TOP */}
      <div
        className="mx-auto mt-6 hidden w-full max-w-[1200px] px-4 md:block"
        aria-hidden="true"
        style={{ minHeight: "90px" }}
      />

      {/* 인기 비교 페어 */}
      <section className="mx-auto mt-10 w-full max-w-[1200px] px-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{t("popularPairs")}</h2>
          <Link
            href={localePath("/models")}
            className="text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t("viewAll")}
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {POPULAR_PAIRS.map((pair) => {
            const slugs = [pair.a, pair.b].sort();
            const pairSlug = `${slugs[0]}_vs_${slugs[1]}`;
            return (
              <Link
                key={pairSlug}
                href={localePath(`/compare/${pairSlug}`)}
                className="group rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <p className="font-semibold text-card-foreground group-hover:text-primary">
                  {pair.labelA}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">vs</p>
                <p className="font-semibold text-card-foreground group-hover:text-primary">
                  {pair.labelB}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 카테고리별 Top 모델 */}
      <section className="mx-auto mt-12 w-full max-w-[1200px] px-4">
        <h2 className="text-xl font-bold">{t("topModels")}</h2>

        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-3">
          {(["coding", "reasoning", "writing"] as const).map((cat) => (
            <div
              key={cat}
              className="rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <h3 className="font-semibold text-card-foreground">
                {t(`categoryLabels.${cat}`)}
              </h3>
              {/* 실제 순위는 DB 시드 이후 Supabase 쿼리 결과로 대체 */}
              <ul className="mt-3 space-y-2" aria-label={`Top ${cat} models`}>
                {[1, 2].map((rank) => (
                  <li
                    key={rank}
                    className="h-5 w-full animate-pulse rounded bg-muted"
                    aria-hidden="true"
                  />
                ))}
              </ul>
              <Link
                href={localePath(`/leaderboard/${cat}`)}
                className="mt-4 inline-block text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {t("viewAll")}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* 최근 Changelog */}
      <section className="mx-auto mt-12 w-full max-w-[1200px] px-4 pb-16">
        <h2 className="text-xl font-bold">{t("recentChangelog")}</h2>
        <ul className="mt-4 divide-y divide-border" role="list">
          {RECENT_CHANGELOG.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-4 py-3">
              <div className="flex items-start gap-3">
                <time
                  dateTime={item.date}
                  className="flex-shrink-0 text-xs text-muted-foreground"
                >
                  {item.date}
                </time>
                <p className="text-sm text-foreground">{item.content}</p>
              </div>
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={`Source for: ${item.content}`}
              >
                {t("seeSource")}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
