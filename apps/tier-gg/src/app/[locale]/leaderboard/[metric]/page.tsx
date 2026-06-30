import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { mockModels } from "@/lib/data/mock-models";

export const revalidate = 3600;

const VALID_METRICS = ["overall", "coding", "reasoning", "writing", "price"] as const;
type Metric = (typeof VALID_METRICS)[number];

interface LeaderboardPageProps {
  params: Promise<{ locale: string; metric: string }>;
}

export async function generateStaticParams() {
  return VALID_METRICS.flatMap((metric) =>
    ["en", "ko"].map((locale) => ({ locale, metric }))
  );
}

export async function generateMetadata({
  params,
}: LeaderboardPageProps): Promise<Metadata> {
  const { locale, metric } = await params;

  if (!VALID_METRICS.includes(metric as Metric)) {
    return { title: "Leaderboard | Tier.gg" };
  }

  const t = await getTranslations({ locale, namespace: "leaderboard" });
  const metricLabel = t(`tabs.${metric as Metric}`);

  return {
    title: t("pageTitle", { metric: metricLabel }),
    description: `${metricLabel} leaderboard — compare AI model rankings by ${metric} performance.`,
    alternates: {
      languages: {
        en: `/leaderboard/${metric}`,
        ko: `/ko/leaderboard/${metric}`,
      },
    },
    openGraph: {
      images: [{ url: `/api/og?type=leaderboard&metric=${metric}`, width: 1200, height: 630 }],
    },
  };
}

export default async function LeaderboardPage({ params }: LeaderboardPageProps) {
  const { locale, metric } = await params;

  if (!VALID_METRICS.includes(metric as Metric)) notFound();

  const t = await getTranslations({ locale, namespace: "leaderboard" });
  const metricLabel = t(`tabs.${metric as Metric}`);

  const localePath = (path: string) =>
    locale === "en" ? path : `/${locale}${path}`;

  // 메트릭별 모델 정렬 (mock — DB 연동 시 Supabase 쿼리로 교체)
  const ranked = mockModels
    .filter((m) => m.status === "published")
    .sort((a, b) => {
      if (metric === "price") {
        return (a.attrs.priceInput ?? Infinity) - (b.attrs.priceInput ?? Infinity);
      }
      if (metric === "coding") {
        return (b.scores.humaneval ?? 0) - (a.scores.humaneval ?? 0);
      }
      if (metric === "reasoning") {
        return (b.scores.gpqa ?? 0) - (a.scores.gpqa ?? 0);
      }
      if (metric === "writing") {
        return (b.scores.arenaElo ?? 0) - (a.scores.arenaElo ?? 0);
      }
      // overall
      return (b.scores.mmlu ?? 0) - (a.scores.mmlu ?? 0);
    });

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10">
      {/* 카테고리 탭 */}
      <nav aria-label="Leaderboard categories">
        <ul className="flex flex-wrap gap-1 border-b border-border pb-4" role="list">
          {VALID_METRICS.map((m) => (
            <li key={m}>
              <Link
                href={localePath(`/leaderboard/${m}`)}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  m === metric
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
                aria-current={m === metric ? "page" : undefined}
              >
                {t(`tabs.${m}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* 페이지 헤더 */}
      <div className="mt-6 mb-4">
        <h1 className="text-2xl font-bold">{t("pageTitle", { metric: metricLabel })}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("updatedAt", { date: "2026-05-25" })} · {t("reliabilityNote")}
        </p>
      </div>

      {/* AD_SLOT_LEADERBOARD_RIGHT */}
      {/* AD_SLOT_LEADERBOARD_RIGHT */}
      <div className="float-right ml-6 hidden lg:block" style={{ minHeight: "600px", minWidth: "300px" }} aria-hidden="true" />

      {/* 리더보드 테이블 */}
      {ranked.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">{t("empty")}</p>
          <Link
            href={localePath("/leaderboard/overall")}
            className="mt-4 inline-block text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t("emptyAction")}
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table
            className="w-full text-sm"
            aria-label={`${metricLabel} leaderboard`}
          >
            <caption className="sr-only">
              {t("table.caption", { metric: metricLabel })}
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase text-muted-foreground">
                <th scope="col" className="py-3 pr-4 w-16">{t("table.rank")}</th>
                <th scope="col" className="py-3 pr-4">{t("table.model")}</th>
                <th scope="col" className="py-3 pr-4">{t("table.score")}</th>
                <th scope="col" className="py-3 pr-4 w-20">{t("table.change")}</th>
                <th scope="col" className="py-3 w-24">{t("table.compare")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ranked.map((model, i) => {
                // 비교 대상: 1위가 아니면 1위와, 1위면 2위와 페어
                const opponent =
                  ranked[0]?.slug !== model.slug
                    ? ranked[0]?.slug
                    : ranked[1]?.slug;
                const pairSlug = opponent
                  ? [model.slug, opponent].sort().join("_vs_")
                  : null;
                const score =
                  metric === "price"
                    ? `$${model.attrs.priceInput ?? "N/A"}/1M`
                    : metric === "coding"
                    ? String(model.scores.humaneval ?? "N/A")
                    : metric === "reasoning"
                    ? String(model.scores.gpqa ?? "N/A")
                    : metric === "writing"
                    ? String(model.scores.arenaElo ?? "N/A")
                    : String(model.scores.mmlu ?? "N/A");

                return (
                  <tr key={model.slug} className="hover:bg-muted/50">
                    <td className="py-3 pr-4 font-bold text-primary">#{i + 1}</td>
                    <td className="py-3 pr-4">
                      <Link
                        href={localePath(`/models/${model.slug}`)}
                        className="font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {model.name}
                      </Link>
                      <span className="ml-2 text-xs text-muted-foreground">{model.providerSlug}</span>
                    </td>
                    <td className="py-3 pr-4 font-semibold">{score}</td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">—</td>
                    <td className="py-3">
                      {pairSlug ? (
                        <Link
                          href={localePath(`/compare/${pairSlug}`)}
                          className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          aria-label={`${t("addToCompare")} — ${model.name}`}
                        >
                          {t("addToCompare")}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 신뢰도 안내 (clearfix) */}
      <div className="clear-both mt-8 rounded-lg bg-muted px-4 py-3 text-xs text-muted-foreground">
        {t("reliabilityNote")}
      </div>
    </div>
  );
}
