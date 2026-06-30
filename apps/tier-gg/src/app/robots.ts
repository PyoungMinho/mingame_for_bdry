import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // 일반 크롤러: 퍼블릭 페이지 허용
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",       // 관리자 페이지 차단
          "/api/",        // API 엔드포인트 차단
          "/_next/",      // Next.js 내부 차단
        ],
      },
      {
        // AI 학습용 크롤러 선택적 차단 (선택 사항 — 사장 결정 후 조정)
        userAgent: ["GPTBot", "Google-Extended", "CCBot"],
        disallow: "/",
      },
    ],
    sitemap: "https://tier.gg/sitemap.xml",
    host: "https://tier.gg",
  };
}
