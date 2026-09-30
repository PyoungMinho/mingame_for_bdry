import './rewind.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

const SITE_URL = 'https://project-orsrw.vercel.app';
const TITLE = '인생 2회차 — 2000년으로 돌아간 1993년생';
const DESCRIPTION =
  '서른셋의 기억으로 눈을 떴더니 2000년, 초등학교 1학년. 미래를 다 아는데 몸은 여덟 살이다. 실제 시세로 사고팔아 2026년, 당신의 자산은 얼마일까?';

/**
 * rewind 전용 메타데이터·레이아웃. 루트 layout.tsx / globals.css / tailwind.config.ts 무수정
 * (blast radius 0) — 스타일은 rewind.css 의 `.rw-shell` 스코프 안에서만 해석된다.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { absolute: TITLE },
  description: DESCRIPTION,
  applicationName: '인생 2회차',
  keywords: ['회귀', '인생 2회차', '2000년으로 돌아간다면', '비트코인', '투자 시뮬레이션', '선택형 게임', '1993년생'],
  authors: [{ name: '인생 2회차' }],
  creator: '인생 2회차',
  appleWebApp: { capable: true, title: '인생 2회차', statusBarStyle: 'default' },
  icons: { icon: [{ url: '/rewind/icon.svg', type: 'image/svg+xml' }], shortcut: '/rewind/icon.svg', apple: '/rewind/icon.svg' },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    title: TITLE,
    description: DESCRIPTION,
    siteName: '인생 2회차',
    url: '/rewind',
    images: [{ url: '/rewind/og.jpg', width: 1200, height: 630, alt: TITLE }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/rewind/og.jpg'] },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 5, themeColor: '#F3ECDD' };

export default function RewindLayout({ children }: { children: ReactNode }) {
  return <div className="rw-shell">{children}</div>;
}
