import './monthly-close.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { McRoot } from './_components/sheet/McRoot';

/**
 * 월마감 라우트 레이아웃 (메타 누수 차단: 방향서 §8-2 #1~#5, 디자인 §9-7).
 *  - 루트 레이아웃의 제목 템플릿 "%s | 문제팩토리"가 붙지 않게 title.absolute.
 *  - 탭 제목은 이후 화면이 useDocumentTitle로 고정한다(방은 업종 파일명, 연습은 연습용_사본_v1). 숨기기 전후 동일.
 *  - noindex, 아이콘 = /monthly-close/icon.svg(표 아이콘, 녹색 없음), OG 고정 1종("공유된 문서입니다").
 *  - 이 파일은 서버 컴포넌트다. 방 상태를 서버에서 그리지 않는다.
 */

const TITLE = '월마감';
const OG_TITLE = '월마감_최종_진짜최종_v7';
const OG_DESC = '공유된 문서입니다';
const OG_IMAGE = '/monthly-close/og.png';

export const metadata: Metadata = {
  metadataBase: new URL('https://project-orsrw.vercel.app'),
  title: { absolute: TITLE },
  description: OG_DESC,
  applicationName: TITLE,
  appleWebApp: { capable: true, title: TITLE, statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/monthly-close/icon.svg', type: 'image/svg+xml' }],
    shortcut: '/monthly-close/icon.svg',
    apple: [{ url: '/monthly-close/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    title: OG_TITLE,
    description: OG_DESC,
    siteName: TITLE,
    url: '/monthly-close',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: OG_TITLE }],
  },
  twitter: { card: 'summary_large_image', title: OG_TITLE, description: OG_DESC, images: [OG_IMAGE] },
  robots: { index: false, follow: false },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#F7F8FA',
  colorScheme: 'light',
};

export default function MonthlyCloseLayout({ children }: { children: ReactNode }) {
  return <McRoot>{children}</McRoot>;
}
