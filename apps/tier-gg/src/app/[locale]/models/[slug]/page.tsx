import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { mockModels } from "@/lib/data/mock-models";
import { SourceBadge, MetricCard } from "@/components/ui";

export const revalidate = 3600;

interface ModelDetailPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams() {
  return mockModels.flatMap((model) =>
    ["en", "ko"].map((locale) => ({ locale, slug: model.slug }))
  );
}

export async function generateMetadata({
  params,
}: ModelDetailPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const model = mockModels.find((m) => m.slug === slug);

  if (!model) return { title: "Model Not Found | Tier.gg" };

  const t = await getTranslations({ locale, namespace: "modelDetail" });

  return {
    title: `${model.name} — Benchmarks, Pricing & Review`,
    description: t("jsonLdDescription", { model: model.name }),
    alternates: {
      languages: {
        en: `/models/${slug}`,
        ko: `/ko/models/${slug}`,
      },
    },
    openGraph: {
      title: `${model.name} — AI Model Review | Tier.gg`,
      description: `Context: ${model.attrs.contextWindow}K · Input: $${model.attrs.priceInput}/1M · Output: $${model.attrs.priceOutput}/1M`,
      images: [
        {
          url: `/api/og?type=model&slug=${slug}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      images: [`/api/og?type=model&slug=${slug}`],
    },
  };
}

// JSON-LD SoftwareApplication 스키마
function ModelJsonLd({
  model,
  description,
}: {
  model: (typeof mockModels)[number];
  description: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: model.name,
    applicationCategory: "ArtificialIntelligence",
    operatingSystem: "Web",
    description,
    author: {
      "@type": "Organization",
      name: model.providerSlug,
    },
    offers: {
      "@type": "Offer",
      price: model.attrs.priceInput,
      priceCurrency: "USD",
      description: `$${model.attrs.priceInput} per 1M input tokens`,
    },
    datePublished: model.releasedAt,
    url: model.source.url,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

type ConfidenceLevel = "high" | "mid" | "low";

function tierToConfidence(tier: "T1" | "T2" | "T3"): ConfidenceLevel {
  return tier === "T1" ? "high" : tier === "T2" ? "mid" : "low";
}

// scores → 벤치마크 행 변환 헬퍼
function buildBenchmarkRows(model: (typeof mockModels)[number]) {
  const { scores, source } = model;
  const rows: {
    metric: string;
    score: number | string;
    sourceName: string;
    sourceUrl: string;
    verifiedAt: string;
    confidence: ConfidenceLevel;
  }[] = [];

  if (scores.mmlu != null)
    rows.push({ metric: "MMLU", score: scores.mmlu, sourceName: "Official", sourceUrl: source.url, verifiedAt: source.verifiedAt, confidence: tierToConfidence(source.confidence) });
  if (scores.humaneval != null)
    rows.push({ metric: "HumanEval", score: scores.humaneval, sourceName: "Official", sourceUrl: source.url, verifiedAt: source.verifiedAt, confidence: tierToConfidence(source.confidence) });
  if (scores.gpqa != null)
    rows.push({ metric: "GPQA Diamond", score: scores.gpqa, sourceName: "Official", sourceUrl: source.url, verifiedAt: source.verifiedAt, confidence: tierToConfidence(source.confidence) });
  if (scores.arenaElo != null)
    rows.push({ metric: "Arena Elo", score: scores.arenaElo, sourceName: "LMArena", sourceUrl: "https://lmarena.ai", verifiedAt: source.verifiedAt, confidence: "mid" as const });

  return rows;
}

export default async function ModelDetailPage({ params }: ModelDetailPageProps) {
  const { locale, slug } = await params;
  const model = mockModels.find((m) => m.slug === slug);

  if (!model) notFound();

  const t = await getTranslations({ locale, namespace: "modelDetail" });

  const localePath = (path: string) =>
    locale === "en" ? path : `/${locale}${path}`;

  const description = t("jsonLdDescription", { model: model.name });
  const benchmarkRows = buildBenchmarkRows(model);

  // 자주 비교되는 모델 (같은 카테고리, 현재 모델 제외, 최대 3개)
  const relatedModels = mockModels
    .filter(
      (m) =>
        m.slug !== slug &&
        m.attrs.modality.some((mod) => model.attrs.modality.includes(mod))
    )
    .slice(0, 3);

  const confidenceLabel = (c: "T1" | "T2" | "T3") =>
    c === "T1"
      ? t("reliability.high")
      : c === "T2"
      ? t("reliability.mid")
      : t("reliability.low");

  const confidenceSymbol = (c: "T1" | "T2" | "T3") =>
    c === "T1" ? "●" : c === "T2" ? "○" : "△";

  return (
    <>
      <ModelJsonLd model={model} description={description} />

      <div className="mx-auto max-w-[1200px] px-4 py-10">
        {/* EntityHero */}
        <section
          aria-labelledby="model-name-heading"
          className="rounded-xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1
                id="model-name-heading"
                className="text-3xl font-extrabold tracking-tight"
              >
                {model.name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("by")} {model.providerSlug}
                {model.releasedAt && (
                  <>
                    {" · "}
                    {t("released")} {model.releasedAt.slice(0, 7)}
                  </>
                )}
              </p>

              {/* 핵심 스펙 요약 */}
              <dl className="mt-4 flex flex-wrap gap-4">
                {model.attrs.contextWindow && (
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("contextWindow")}</dt>
                    <dd className="font-semibold">{model.attrs.contextWindow}K</dd>
                  </div>
                )}
                {model.attrs.priceInput != null && (
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("inputPrice")}</dt>
                    <dd className="font-semibold">${model.attrs.priceInput}{t("perMillion")}</dd>
                  </div>
                )}
                {model.attrs.priceOutput != null && (
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("outputPrice")}</dt>
                    <dd className="font-semibold">${model.attrs.priceOutput}{t("perMillion")}</dd>
                  </div>
                )}
              </dl>

              <a
                href={model.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {t("officialPage")}
              </a>
            </div>

            {/* CTA 버튼 */}
            <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
              {(() => {
                const rival =
                  relatedModels[0]?.slug ??
                  mockModels.find((m) => m.slug !== slug)?.slug;
                const pair = rival
                  ? [slug, rival].sort().join("_vs_")
                  : null;
                return pair ? (
                  <Link
                    href={localePath(`/compare/${pair}`)}
                    className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {t("addToCompare")}
                  </Link>
                ) : null;
              })()}
            </div>
          </div>
        </section>

        {/* AD_SLOT_MODEL_DETAIL_SIDEBAR */}
        {/* AD_SLOT_MODEL_DETAIL_SIDEBAR */}
        <div className="mt-6 hidden lg:block" style={{ minHeight: "250px" }} aria-hidden="true" />

        {/* 벤치마크 테이블 */}
        <section className="mt-8" aria-labelledby="benchmarks-heading">
          <h2 id="benchmarks-heading" className="mb-4 text-xl font-bold">
            {t("benchmarks")}
          </h2>

          {benchmarkRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label={`${model.name} benchmark scores`}>
                <caption className="sr-only">
                  {model.name} benchmark scores by metric
                </caption>
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase text-muted-foreground">
                    <th scope="col" className="py-3 pr-4">{t("benchmarkTable.metric")}</th>
                    <th scope="col" className="py-3 pr-4">{t("benchmarkTable.score")}</th>
                    <th scope="col" className="py-3 pr-4">{t("benchmarkTable.source")}</th>
                    <th scope="col" className="py-3">{t("benchmarkTable.freshness")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {benchmarkRows.map((b) => (
                    <tr key={b.metric} className="hover:bg-muted/50">
                      <td className="py-3 pr-4 font-medium">{b.metric}</td>
                      <td className="py-3 pr-4">{b.score}</td>
                      <td className="py-3 pr-4">
                        <SourceBadge
                          sourceName={b.sourceName}
                          sourceUrl={b.sourceUrl}
                          verifiedAt={b.verifiedAt}
                          confidence={b.confidence}
                        />
                      </td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {b.verifiedAt}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <p className="text-muted-foreground">{t("emptyBenchmark")}</p>
              <a
                href="https://github.com/tier-gg/data/issues/new"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {t("reportSource")}
              </a>
            </div>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            ⓘ {t("disclaimer")}
          </p>
        </section>

        {/* MetricCard 그리드 (핵심 수치 카드 — Recharts 레이더 차트는 컴포넌트개발자 담당) */}
        {model.attrs.priceInput != null && (
          <section className="mt-8">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <MetricCard
                kind="price-in"
                value={model.attrs.priceInput}
                unit="$/1M"
                scoreValue={Math.max(0, 100 - model.attrs.priceInput)}
                scoreMax={100}
                scoreLabel="Cost efficiency"
              />
              {model.attrs.priceOutput != null && (
                <MetricCard
                  kind="price-out"
                  value={model.attrs.priceOutput}
                  unit="$/1M"
                  scoreValue={Math.max(0, 100 - model.attrs.priceOutput * 0.5)}
                  scoreMax={100}
                  scoreLabel="Output cost"
                />
              )}
              {model.attrs.contextWindow != null && (
                <MetricCard
                  kind="context"
                  value={model.attrs.contextWindow}
                  unit="K"
                  scoreValue={Math.min(100, model.attrs.contextWindow / 10)}
                  scoreMax={100}
                  scoreLabel="Context size"
                />
              )}
              {model.scores.mmlu != null && (
                <MetricCard
                  kind="quality"
                  value={model.scores.mmlu}
                  unit="%"
                  scoreValue={model.scores.mmlu}
                  scoreMax={100}
                  scoreLabel="MMLU"
                />
              )}
            </div>
          </section>
        )}

        {/* 자주 비교되는 모델 */}
        {relatedModels.length > 0 && (
          <section className="mt-10" aria-labelledby="related-heading">
            <h2 id="related-heading" className="mb-4 text-xl font-bold">
              {t("frequentlyCompared")}
            </h2>
            <ul className="flex flex-wrap gap-3" role="list">
              {relatedModels.map((related) => {
                const sorted = [slug, related.slug].sort();
                const pairSlug = `${sorted[0]}_vs_${sorted[1]}`;
                return (
                  <li key={related.slug}>
                    <Link
                      href={localePath(`/compare/${pairSlug}`)}
                      className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {related.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* 출처 & 신뢰도 메타 */}
        <section className="mt-10" aria-labelledby="sources-heading">
          <h2 id="sources-heading" className="mb-3 text-lg font-bold">
            {t("sourcesMeta")}
          </h2>
          <ul className="space-y-2" role="list">
            <li className="flex items-center gap-3 text-sm">
              <span
                className={
                  model.source.confidence === "T1"
                    ? "text-green-600 dark:text-green-400"
                    : model.source.confidence === "T2"
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-orange-600 dark:text-orange-400"
                }
                aria-label={`Reliability: ${confidenceLabel(model.source.confidence)}`}
              >
                {confidenceSymbol(model.source.confidence)}{" "}
                <span className="text-xs">{confidenceLabel(model.source.confidence)}</span>
              </span>
              <a
                href={model.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {model.providerSlug} Official
              </a>
              <span className="text-muted-foreground text-xs">
                ({t("lastVerified")} {model.source.verifiedAt})
              </span>
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
