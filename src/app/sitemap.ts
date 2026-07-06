import type { MetadataRoute } from "next";

/**
 * sitemap.xml — 색인 대상 공개 페이지 목록(문제팩토리 제품 라우트).
 * 커스텀 도메인 연결 시 BASE만 교체하면 된다.
 */
const BASE = "https://project-orsrw.vercel.app";

const ROUTES: { path: string; priority: number }[] = [
  { path: "", priority: 1 },
  { path: "/study", priority: 0.9 },
  { path: "/exam", priority: 0.8 },
  { path: "/about", priority: 0.6 },
  { path: "/guide", priority: 0.6 },
  { path: "/faq", priority: 0.6 },
  { path: "/privacy", priority: 0.3 },
  { path: "/terms", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map(({ path, priority }) => ({
    url: `${BASE}${path}`,
    changeFrequency: "weekly",
    priority,
  }));
}
