import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://tier.gg"),
  title: {
    default: "Tier.gg — AI Model Rankings & Comparisons",
    template: "%s | Tier.gg",
  },
  description:
    "Compare AI model performance, pricing, and benchmarks. Find the best LLM for coding, writing, and more. No signup required.",
  keywords: ["AI model comparison", "LLM benchmark", "GPT vs Claude", "AI pricing"],
  authors: [{ name: "Tier.gg" }],
  creator: "Tier.gg",
  openGraph: {
    type: "website",
    siteName: "Tier.gg",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@tiergg",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // lang은 [locale]/layout.tsx에서 locale에 맞게 재정의됨
    <html suppressHydrationWarning>
      <head>
        {/* 다크모드 플리커 방지 인라인 스크립트 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('tier-gg-theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (theme === 'dark' || (!theme && prefersDark)) {
                  document.documentElement.classList.add('dark');
                }
              } catch {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
