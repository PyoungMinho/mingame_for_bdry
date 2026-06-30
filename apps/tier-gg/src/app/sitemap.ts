import type { MetadataRoute } from "next";
import { mockModels } from "@/lib/data/mock-models";

const BASE_URL = "https://tier.gg";
const LOCALES = ["en", "ko"] as const;
const METRICS = ["overall", "coding", "reasoning", "writing", "price"] as const;

function localePath(locale: string, path: string) {
  return locale === "en" ? `${BASE_URL}${path}` : `${BASE_URL}/${locale}${path}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // 정적 페이지
  const staticPages: MetadataRoute.Sitemap = LOCALES.flatMap((locale) => [
    {
      url: localePath(locale, "/"),
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 1.0,
    },
    {
      url: localePath(locale, "/models"),
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    {
      url: localePath(locale, "/find"),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
  ]);

  // 리더보드 페이지
  const leaderboardPages: MetadataRoute.Sitemap = LOCALES.flatMap((locale) =>
    METRICS.map((metric) => ({
      url: localePath(locale, `/leaderboard/${metric}`),
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }))
  );

  // 모델 상세 페이지 (mockModels 기반 — DB 연동 후 Supabase 쿼리로 교체)
  const modelPages: MetadataRoute.Sitemap = LOCALES.flatMap((locale) =>
    mockModels.map((model) => ({
      url: localePath(locale, `/models/${model.slug}`),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }))
  );

  // 인기 비교 페어 (상위 SSG만 포함)
  const popularPairs = [
    ["claude-3-5-sonnet", "gpt-4o"],
    ["gemini-1-5-pro", "gpt-4o"],
    ["claude-3-haiku", "gpt-4o-mini"],
  ];

  const comparePages: MetadataRoute.Sitemap = LOCALES.flatMap((locale) =>
    popularPairs.map(([a, b]) => {
      const sorted = [a, b].sort();
      return {
        url: localePath(locale, `/compare/${sorted[0]}_vs_${sorted[1]}`),
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      };
    })
  );

  return [...staticPages, ...leaderboardPages, ...modelPages, ...comparePages];
}
