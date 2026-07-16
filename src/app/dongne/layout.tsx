import './dongne.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { getTodayGameNo } from '@/lib/dongne/queue';

const SITE_URL = 'https://project-orsrw.vercel.app';
const TITLE = '동네고수';
const DESCRIPTION = '매일 만나는 대한민국 동네 실루엣 퀴즈. 6번 안에 오늘의 동네를 맞혀보세요.';

/**
 * dongne 전용 메타데이터. `generateMetadata`(비동기 함수)를 쓰는 이유는 기본 OG 이미지를
 * "오늘" 회차(`/dongne/og/{gameNo}`)로 가리키기 위해서다 — `getTodayGameNo()`는 `page.tsx`가
 * 클라이언트 컴포넌트('use client')라 자체 metadata를 export할 수 없어서 레이아웃이 대신
 * 기본값을 잡아준다. 하위 세그먼트(archive/[gameNo] 등)는 자체 `generateMetadata`로
 * 이 값을 덮어쓴다(Next.js title.absolute/openGraph 병합 규칙, office-archetype 선례).
 *
 * ⚠ 공유 파일 무수정: metadataBase는 이 라우트 세그먼트에만 적용되고 루트 layout.tsx는
 * 손대지 않는다(office-archetype/pae 선례 그대로).
 */
export async function generateMetadata(): Promise<Metadata> {
  const gameNo = getTodayGameNo();
  const ogGameNo = gameNo >= 1 ? gameNo : 1;
  const ogImageUrl = `/dongne/og/${ogGameNo}`;
  // 정답 지역명 금지 — 일반문만(design-final §7 og:image:alt 규칙)
  const ogImageAlt = `동네고수 #${ogGameNo} — 오늘의 동네 실루엣 퀴즈`;

  return {
    metadataBase: new URL(SITE_URL),
    title: { absolute: TITLE, template: `%s | ${TITLE}` },
    description: DESCRIPTION,
    openGraph: {
      type: 'website',
      locale: 'ko_KR',
      title: TITLE,
      description: DESCRIPTION,
      siteName: TITLE,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: ogImageAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: TITLE,
      description: DESCRIPTION,
      images: [ogImageUrl],
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#F6EFDF',
};

/**
 * dongne 라우트 전용 레이아웃. globals.css/루트 layout.tsx/tailwind.config.ts 무수정
 * (blast radius 0) — 모든 스타일은 이 파일에서만 import하는 dongne.css의 `.dn-shell` 스코프
 * 안에서 해석된다(office-archetype/pae 선례). 다크모드 없음 — `color-scheme: light` 고정.
 */
export default function DongneLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dn-shell" style={{ colorScheme: 'light' }}>
      {children}
    </div>
  );
}
