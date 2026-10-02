import './gung.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { KakaoSdk } from './lib/KakaoSdk';

const SITE_URL = 'https://project-orsrw.vercel.app';
const TITLE = '세자 독살 사건 — 술자리 추리 게임';
const DESCRIPTION =
  '오늘 밤 세자가 독살당했다. 범인은 이 자리에 있다. 4~6명이 폰 하나씩 들고 말로 추리하는 조선 궁중 미스터리. 설치 없이 카톡으로 초대.';

/**
 * §12-2 레이아웃 메타 — rewind/zombie 선례처럼 이 라우트에서 루트 앱 이름을 전부 덮어쓴다.
 * 루트 layout.tsx/globals.css/tailwind.config.ts 무수정(blast radius 0) — 스타일은 `.gu-shell` 스코프의
 * gung.css 뿐이고, import는 여기 한 곳뿐이다.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { absolute: TITLE },
  description: DESCRIPTION,
  applicationName: '세자 독살 사건',
  keywords: ['추리 게임', '술자리 게임', '마피아 게임', '크라임씬', '방탈출', '조선 사극', '세자 독살 사건', '카카오톡 초대'],
  authors: [{ name: '세자 독살 사건' }],
  creator: '세자 독살 사건',
  appleWebApp: { capable: true, title: '세자 독살 사건', statusBarStyle: 'black-translucent' },
  icons: { icon: [{ url: '/gung/icon.svg', type: 'image/svg+xml' }], shortcut: '/gung/icon.svg', apple: '/gung/icon.svg' },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    title: TITLE,
    description: DESCRIPTION,
    siteName: '세자 독살 사건',
    url: '/gung',
    images: [{ url: '/gung/og.jpg', width: 1200, height: 630, alt: TITLE }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/gung/og.jpg'] },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0A0A0E',
};

export default function GungLayout({ children }: { children: ReactNode }) {
  return (
    <div className="gu-shell">
      <KakaoSdk />
      {children}
    </div>
  );
}
