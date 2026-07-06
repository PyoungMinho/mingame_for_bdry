import type { MetadataRoute } from "next";

/**
 * robots.txt — 크롤러 접근 규칙. API 경로만 제외하고 전부 허용.
 * sitemap 위치를 알려 색인/AdSense 심사 시 사이트 구조 파악을 돕는다.
 * 커스텀 도메인 연결 시 BASE만 교체하면 된다.
 */
const BASE = "https://project-orsrw.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
