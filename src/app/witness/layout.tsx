import './witness.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

const SITE_URL = 'https://project-orsrw.vercel.app';
const TITLE = '목격자는 AI — 스마트홈 살인사건';
const DESCRIPTION = '비 오는 밤, 41층 펜트하우스. 용의자는 넷, 증인은 스피커 하나. 행동 12번 안에 거짓말을 깨라. 혼자서 25분.';

/**
 * 메타데이터 — 스포일러 없음(범인·증거·트릭 어휘 금지, 디자인 확정본 §9-3). 공유·OG 어디에도 결과 값이 들어가지 않는다.
 * 루트 layout.tsx/globals.css/providers/tailwind.config 무수정(blast radius 0) — 스타일은 `.wt-shell` 스코프의 witness.css 뿐이고,
 * import 는 이 한 곳뿐이다. `.wt-shell` 요소는 WitnessApp(클라이언트)이 설정 속성(data-*)과 함께 렌더한다.
 * og.jpg(1200×630, 기본 커버: 타워 외관 + 또박이 + 워드마크 + 훅 + 「혼자서·약 25분·가입 없음」)와 icon.svg 는 public/witness/ 에 있다.
 * 결과별 동적 OG(디자인 §9-2 결과 변형)는 P1 — 공유 URL 에 파라미터를 붙이지 않으므로 정적 커버 하나로 충분하다.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { absolute: TITLE },
  description: DESCRIPTION,
  applicationName: '목격자는 AI',
  keywords: ['추리 게임', '역전재판 느낌', '웹 추리 게임', '혼자 하는 추리', '스마트홈', 'AI 스피커', '미스터리'],
  authors: [{ name: '목격자는 AI' }],
  creator: '목격자는 AI',
  appleWebApp: { capable: true, title: '목격자는 AI', statusBarStyle: 'black-translucent' },
  icons: { icon: [{ url: '/witness/icon.svg', type: 'image/svg+xml' }], shortcut: '/witness/icon.svg', apple: '/witness/icon.svg' },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    title: TITLE,
    description: DESCRIPTION,
    siteName: '목격자는 AI',
    url: '/witness',
    images: [{ url: '/witness/og.jpg', width: 1200, height: 630, alt: TITLE }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/witness/og.jpg'] },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#060913',
};

export default function WitnessLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
