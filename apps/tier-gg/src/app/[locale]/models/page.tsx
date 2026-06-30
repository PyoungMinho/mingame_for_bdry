import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { mockModels } from "@/lib/data/mock-models";

export const revalidate = 3600;

interface ModelsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; provider?: string; modality?: string }>;
}

export async function generateMetadata({
  params,
}: ModelsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "models" });

  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
    alternates: {
      languages: { en: "/models", ko: "/ko/models" },
    },
  };
}

export default async function ModelsPage({ params, searchParams }: ModelsPageProps) {
  const { locale } = await params;
  const { q, provider, modality } = await searchParams;
  const t = await getTranslations({ locale, namespace: "models" });

  const localePath = (path: string) =>
    locale === "en" ? path : `/${locale}${path}`;

  // mockModels 기반 필터링 (DB 연동 시 Supabase 쿼리로 교체)
  const allModels = mockModels;
  const providers = Array.from(new Set(allModels.map((m) => m.providerSlug))).sort();
  const modalities = Array.from(
    new Set(allModels.flatMap((m) => m.attrs.modality))
  ).sort();

  const filtered = allModels.filter((model) => {
    if (q && !model.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (provider && model.providerSlug !== provider) return false;
    if (modality && !model.attrs.modality.includes(modality as "text" | "image" | "code" | "audio" | "video")) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10">
      {/* 페이지 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("pageTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("pageDescription")}</p>
      </div>

      {/* 필터 폼 */}
      <form
        method="GET"
        className="mb-8 flex flex-wrap gap-4"
        aria-label="Filter models"
      >
        {/* 검색어 */}
        <div className="flex flex-col gap-1">
          <label htmlFor="q-filter" className="text-sm font-medium">
            {t("filterProvider")}
          </label>
          <input
            id="q-filter"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="e.g. GPT-4o"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* 제공사 필터 */}
        <div className="flex flex-col gap-1">
          <label htmlFor="provider-filter" className="text-sm font-medium">
            {t("filterProvider")}
          </label>
          <select
            id="provider-filter"
            name="provider"
            defaultValue={provider ?? ""}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">{t("filterAll")}</option>
            {providers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* 모달리티 필터 */}
        <div className="flex flex-col gap-1">
          <label htmlFor="modality-filter" className="text-sm font-medium">
            {t("filterModality")}
          </label>
          <select
            id="modality-filter"
            name="modality"
            defaultValue={modality ?? ""}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">{t("filterAll")}</option>
            {modalities.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t("filterAll")}
          </button>
        </div>
      </form>

      {/* 결과 */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">{t("emptyResults")}</p>
          <Link
            href={localePath("/models")}
            className="mt-4 inline-block text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t("emptyResultsAction")}
          </Link>
        </div>
      ) : (
        <ul
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          role="list"
          aria-label="AI Models"
        >
          {filtered.map((model) => (
            <li key={model.slug}>
              <Link
                href={localePath(`/models/${model.slug}`)}
                className="group flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-card-foreground group-hover:text-primary">
                      {model.name}
                    </p>
                    <p className="text-sm text-muted-foreground">{model.providerSlug}</p>
                  </div>
                  <span className="flex-shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                    {model.attrs.modality[0]}
                  </span>
                </div>

                {/* 가격 요약 */}
                <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
                  {model.attrs.priceInput != null && (
                    <span>In: ${model.attrs.priceInput}/1M</span>
                  )}
                  {model.attrs.priceOutput != null && (
                    <span>Out: ${model.attrs.priceOutput}/1M</span>
                  )}
                </div>

                {/* 컨텍스트 */}
                {model.attrs.contextWindow && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {model.attrs.contextWindow}K ctx
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
