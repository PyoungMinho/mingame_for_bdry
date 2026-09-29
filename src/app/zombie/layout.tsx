import './zombie.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

const SITE_URL = 'https://project-orsrw.vercel.app';
const TITLE = '좀비 터지면 — 서울 생존 시뮬레이션';
const DESCRIPTION =
  '토요일 오후 2시, 긴급재난문자가 울린다. 콩이를 데려갈 것인가, 피 흘리는 이웃에게 문을 열어줄 것인가. 선택 하나로 운명이 갈리는 서울 좀비 생존 시뮬레이션.';

/**
 * zombie 전용 메타데이터·레이아웃. 루트 layout.tsx / globals.css / tailwind.config.ts 무수정
 * (blast radius 0) — 모든 스타일은 zombie.css 의 `.zb-shell` 스코프 안에서만 해석된다
 * (dongne/pae/office-archetype 선례).
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { absolute: TITLE },
  description: DESCRIPTION,
  // 루트(문제팩토리)의 앱 이름·키워드·아이콘이 상속되지 않도록 이 라우트에서 덮어쓴다
  applicationName: '좀비 터지면',
  keywords: ['좀비 게임', '좀비 사태', '생존 시뮬레이션', '선택형 게임', '텍스트 어드벤처', '서울 좀비', '만약에 게임'],
  authors: [{ name: '좀비 터지면' }],
  creator: '좀비 터지면',
  appleWebApp: { capable: true, title: '좀비 터지면', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [{ url: '/zombie/icon.svg', type: 'image/svg+xml' }],
    shortcut: '/zombie/icon.svg',
    apple: '/zombie/icon.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    title: TITLE,
    description: DESCRIPTION,
    siteName: '좀비 터지면',
    url: '/zombie',
    images: [{ url: '/zombie/og.jpg', width: 1200, height: 630, alt: '좀비 터지면 — 서울 생존 시뮬레이션' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/zombie/og.jpg'],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#07090A',
};

export default function ZombieLayout({ children }: { children: ReactNode }) {
  return <div className="zb-shell">{children}</div>;
}
