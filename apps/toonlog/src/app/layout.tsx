import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@/components/ui/animations.css"; // 컴포넌트 키프레임(shimmer/slideUp/panelEnter/pop 등)
import { Providers } from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL("https://toonlog.app"),
  title: {
    default: "툰일기 — 내 이야기가 만화가 되는 곳",
    template: "%s · 툰일기",
  },
  description:
    "일기 한 편을 AI가 4컷 만화로. 누구나 만화 작가가 될 수 있다. 화풍 4종, 나만의 아바타, SNS 공유.",
  applicationName: "툰일기",
  openGraph: {
    type: "website",
    siteName: "툰일기(Toonlog)",
    title: "툰일기 — 내 이야기가 만화가 되는 곳",
    description: "일기 한 편을 AI 4컷 만화로. 누구나 만화 작가가 될 수 있다.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover", // safe-area 대응 (TabBar/FAB)
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF7F2" },
    { media: "(prefers-color-scheme: dark)", color: "#1C1917" },
  ],
};

/* FOUC 방지: 페인트 전에 테마 결정 (design-final §9.2, localStorage['toonlog-theme']) */
const themeScript = `(function(){try{var t=localStorage.getItem('toonlog-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(!t&&d)){document.documentElement.setAttribute('data-theme','dark');}else if(t==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
