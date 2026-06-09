// REDLINE: 타인 비교/외모 점수 UI 금지
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Providers } from "./providers";
import { ADS_ENABLED, ADSENSE_CLIENT } from "@/lib/ads";
import "./globals.css";

// ---------------------------------------------------------------------------
// 메타데이터 (SEO + PWA)
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: {
    default: "문제팩토리 — 무료 수능형 문제 자동 생성·풀이",
    template: "%s | 문제팩토리",
  },
  description:
    "문제집 살 돈 걱정 없이. 공부할 주제만 입력하면 수능 출제유형 그대로 문제를 만들어 즉시 채점·해설까지. 회원가입 없이 무료로 사용하세요.",
  keywords: [
    "수능 문제 생성",
    "무료 문제집",
    "수능형 문제",
    "자습",
    "기출 변형",
    "문제 풀이",
    "내신 대비",
    "AI 문제 생성",
  ],
  authors: [{ name: "문제팩토리" }],
  creator: "문제팩토리",
  applicationName: "문제팩토리",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "문제팩토리",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    title: "문제팩토리 — 무료 수능형 문제 자동 생성·풀이",
    description:
      "공부할 주제만 입력하면 수능 출제유형 그대로 문제를 만들어 즉시 채점·해설까지. 무료.",
    siteName: "문제팩토리",
  },
  robots: {
    index: true,
    follow: true,
  },
  // 파비콘 — /favicon.ico 404 제거 (브라우저 자동 요청 대응) + PWA/OG 아이콘
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#FAFAF7",
};

// ---------------------------------------------------------------------------
// 루트 레이아웃
// ---------------------------------------------------------------------------

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* Pretendard Variable — font-display: swap (design-final.md §W1~W4 P0) */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/* 문제팩토리 — 학술 세리프(Crimson Pro·고운바탕) + 수식 모노(JetBrains Mono) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;500;600;700&family=Gowun+Batang:wght@400;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
        />
      </head>
      <body className="font-sans antialiased bg-[#FAFAF7] text-slate-900 min-h-screen">
        {/* Google AdSense 로더 — 프로덕션에서만 (학생 무료 모드 광고 수익) */}
        {ADS_ENABLED && (
          <Script
            id="adsbygoogle-init"
            async
            strategy="afterInteractive"
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          />
        )}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
