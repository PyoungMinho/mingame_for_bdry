import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { mockModels } from "@/lib/data/mock-models";
import type { CompareModel, CompareRow, Provider } from "@/components/ui";
import { CompareTable } from "@/components/ui";
import { CompareSummary } from "@/components/ui/CompareSummary";
import ShareButton from "@/components/ShareButton";
import {
  metricExplanations,
  compareRowKeyToMetricKey,
} from "@/lib/data/metric-explanations";
import type { RowExplanation } from "@/components/ui/CompareTable";

const KNOWN_PROVIDERS: Provider[] = ["openai", "anthropic", "google", "meta", "mistral", "xai", "cohere"];

function toProvider(slug: string): Provider {
  return KNOWN_PROVIDERS.includes(slug as Provider) ? (slug as Provider) : "other";
}

export const revalidate = 3600;

interface ComparePageProps {
  params: Promise<{ locale: string; pair: string }>;
}

/** pair 파싱: "slug_a_vs_slug_b" 형식 */
function parsePair(pair: string): [string, string] | null {
  const parts = pair.split("_vs_");
  if (parts.length !== 2) return null;
  const [a, b] = parts;
  if (!a || !b) return null;
  return [a, b];
}

export async function generateStaticParams() {
  const popularPairs = [
    ["claude-sonnet-4-6", "gpt-4o"],
    ["gemini-2-0-flash", "gpt-4o"],
    ["claude-haiku-4-5", "gpt-4o-mini"],
  ];

  return popularPairs.flatMap(([a, b]) => {
    const sorted = [a, b].sort();
    return ["en", "ko"].map((locale) => ({
      locale,
      pair: `${sorted[0]}_vs_${sorted[1]}`,
    }));
  });
}

export async function generateMetadata({
  params,
}: ComparePageProps): Promise<Metadata> {
  const { locale, pair } = await params;
  const parsed = parsePair(pair);
  if (!parsed) return { title: "Compare | Tier.gg" };

  const [slugA, slugB] = parsed;
  const modelA = mockModels.find((m) => m.slug === slugA);
  const modelB = mockModels.find((m) => m.slug === slugB);

  const nameA = modelA?.name ?? slugA;
  const nameB = modelB?.name ?? slugB;

  return {
    title: `${nameA} vs ${nameB} — Side-by-Side Comparison`,
    description: `Compare ${nameA} and ${nameB}: benchmarks, pricing, context window, and more.`,
    alternates: {
      languages: {
        en: `/compare/${pair}`,
        ko: `/ko/compare/${pair}`,
      },
    },
    openGraph: {
      images: [
        {
          url: `/api/og?type=compare&a=${slugA}&b=${slugB}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      images: [`/api/og?type=compare&a=${slugA}&b=${slugB}`],
    },
  };
}

// CompareTable에서 요구하는 CompareModel 형태로 변환
function toCompareModel(model: (typeof mockModels)[number]): CompareModel {
  return {
    slug: model.slug,
    name: model.name,
    provider: toProvider(model.providerSlug),
    metrics: {
      inputPrice: {
        value: model.attrs.priceInput ?? "N/A",
        unit: "$/1M",
        source: model.attrs.priceInput != null
          ? {
              sourceName: "Official",
              sourceUrl: model.source.url,
              verifiedAt: model.source.verifiedAt,
              confidence: (model.source.confidence === "T1" ? "high" : model.source.confidence === "T2" ? "mid" : "low") as "high" | "mid" | "low",
            }
          : undefined,
      },
      outputPrice: { value: model.attrs.priceOutput ?? "N/A", unit: "$/1M" },
      contextWindow: { value: model.attrs.contextWindow ?? "N/A", unit: "K" },
      mmlu: { value: model.scores.mmlu ?? "N/A", unit: "%" },
      humaneval: { value: model.scores.humaneval ?? "N/A", unit: "%" },
      arenaElo: { value: model.scores.arenaElo ?? "N/A", unit: "pts" },
    },
  };
}

const COMPARE_ROWS: CompareRow[] = [
  { key: "inputPrice", label: "Input Price", highlight: "min", numeric: true },
  { key: "outputPrice", label: "Output Price", highlight: "min", numeric: true },
  { key: "contextWindow", label: "Context Window", highlight: "max", numeric: true },
  { key: "mmlu", label: "MMLU", highlight: "max", numeric: true },
  { key: "humaneval", label: "HumanEval", highlight: "max", numeric: true },
  { key: "arenaElo", label: "Arena Elo", highlight: "max", numeric: true },
];

export default async function ComparePage({ params }: ComparePageProps) {
  const { locale, pair } = await params;

  const parsed = parsePair(pair);
  if (!parsed) notFound();

  const [slugA, slugB] = parsed;
  const t = await getTranslations({ locale, namespace: "compare" });

  // 동일 slug 비교 차단 — 모델 상세로 리다이렉트 (B-05)
  if (slugA === slugB) {
    const detailPath =
      locale === "en" ? `/models/${slugA}` : `/${locale}/models/${slugA}`;
    redirect(detailPath);
  }

  // 알파벳 정렬 강제 — 역순이면 301 redirect
  const sorted = [slugA, slugB].sort();
  if (sorted[0] !== slugA || sorted[1] !== slugB) {
    const correctedPair = `${sorted[0]}_vs_${sorted[1]}`;
    const redirectPath =
      locale === "en"
        ? `/compare/${correctedPair}`
        : `/${locale}/compare/${correctedPair}`;
    redirect(redirectPath);
  }

  const modelA = mockModels.find((m) => m.slug === slugA);
  const modelB = mockModels.find((m) => m.slug === slugB);

  if (!modelA && !modelB) notFound();

  const nameA = modelA?.name ?? slugA;
  const nameB = modelB?.name ?? slugB;

  const localePath = (path: string) =>
    locale === "en" ? path : `/${locale}${path}`;

  const compareModels: CompareModel[] = [
    ...(modelA ? [toCompareModel(modelA)] : []),
    ...(modelB ? [toCompareModel(modelB)] : []),
  ];

  // locale에 맞는 explanations 빌드
  const isKo = locale === "ko";
  const rowExplanations: Record<string, RowExplanation> = {};
  for (const row of COMPARE_ROWS) {
    const metricKey = compareRowKeyToMetricKey[row.key];
    if (metricKey && metricExplanations[metricKey]) {
      const exp = metricExplanations[metricKey];
      rowExplanations[row.key] = {
        oneLiner: isKo ? exp.oneLiner.ko : exp.oneLiner.en,
        betterWhen: exp.betterWhen,
      };
    }
  }

  // CompareSummary에 전달할 모델 데이터 빌드
  const summaryModels = compareModels.map((cm) => {
    const raw = [modelA, modelB].find((m) => m?.slug === cm.slug);
    return {
      name: cm.name,
      slug: cm.slug,
      provider: cm.provider,
      attrs: {
        priceInput: raw?.attrs.priceInput ?? null,
        priceOutput: raw?.attrs.priceOutput ?? null,
        contextWindow: raw?.attrs.contextWindow ?? null,
      },
      scores: {
        mmlu: raw?.scores.mmlu ?? null,
        humaneval: raw?.scores.humaneval ?? null,
        gpqa: raw?.scores.gpqa ?? null,
        arenaElo: raw?.scores.arenaElo ?? null,
        speedTps: raw?.scores.speedTps ?? null,
      },
    };
  });

  const shareUrl = `https://tier.gg${localePath(`/compare/${pair}`)}`;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10">
      {/* 페이지 제목 + 액션 */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">
          {t("pageTitle", { a: nameA, b: nameB })}
        </h1>
        <div className="flex items-center gap-3">
          <Link
            href={localePath("/models")}
            className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t("addModel")}
          </Link>
          <ShareButton label={t("share")} ariaLabel={t("share")} />
        </div>
      </div>

      {/* AD_SLOT_COMPARE_TOP */}
      {/* AD_SLOT_COMPARE_TOP */}
      <div className="mb-6" style={{ minHeight: "90px" }} aria-hidden="true" />

      {/* 에러 표시 (한쪽 slug 없음) */}
      {!modelA && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {t("invalidSlug", { slug: slugA })}
        </div>
      )}
      {!modelB && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {t("invalidSlug", { slug: slugB })}
        </div>
      )}

      {/* 자동 요약 카드 */}
      {compareModels.length >= 2 && (
        <CompareSummary models={summaryModels} locale={locale} />
      )}

      {/* 비교 매트릭스 */}
      {compareModels.length >= 2 && (
        <CompareTable
          models={compareModels}
          rows={COMPARE_ROWS}
          explanations={rowExplanations}
          aria-label={`${nameA} vs ${nameB} comparison`}
        />
      )}

      {/* AD_SLOT_COMPARE_BOTTOM */}
      {/* AD_SLOT_COMPARE_BOTTOM */}
      <div className="mt-8 mb-6" style={{ minHeight: "90px" }} aria-hidden="true" />

      {/* 공유 CTA 섹션 */}
      <section
        className="mt-8 rounded-xl border border-border bg-card p-6 text-center"
        aria-labelledby="share-cta-heading"
      >
        <h2 id="share-cta-heading" className="text-lg font-bold">
          {t("shareCTA")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground break-all">{shareUrl}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <a
            href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`${nameA} vs ${nameB} — Compare on Tier.gg`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t("shareTwitter")}
          </a>
        </div>
      </section>

      {/* 면책 고지 */}
      <p className="mt-6 text-xs text-muted-foreground">
        Scores are sourced from public benchmarks and are not directly measured by this site.
      </p>
    </div>
  );
}
