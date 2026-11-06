import './liar.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

const TITLE = '거짓말로 대표까지';
const DESCRIPTION = '인턴 김정직의 거짓말이 몇 년 뒤 돌아온다. 내가 뭐라고 했는지 기억해야 살아남는 직장 생존 게임.';

const OG_IMAGE = '/liar/og.jpg';

/** 루트 메타데이터가 상속되지 않도록 여기서 덮어쓴다. 스타일은 `.lr-shell` 안에서만 적용된다. */
export const metadata: Metadata = {
  metadataBase: new URL('https://project-orsrw.vercel.app'),
  title: { absolute: TITLE },
  description: DESCRIPTION,
  applicationName: TITLE,
  keywords: ['직장인 게임', '회사 게임', '선택형 게임', '텍스트 어드벤처', '거짓말 게임', '직장 생활', '무료 게임'],
  authors: [{ name: TITLE }],
  creator: TITLE,
  appleWebApp: { capable: true, title: TITLE, statusBarStyle: 'black-translucent' },
  icons: {
    icon: [{ url: '/liar/icon.svg', type: 'image/svg+xml' }],
    shortcut: '/liar/icon.svg',
    apple: '/liar/icon.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    title: TITLE,
    description: DESCRIPTION,
    siteName: TITLE,
    url: '/liar',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: TITLE }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [OG_IMAGE] },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#171b22',
};

export default function LiarLayout({ children }: { children: ReactNode }) {
  return <div className="lr-shell">{children}</div>;
}
