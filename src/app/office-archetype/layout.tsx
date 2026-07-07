import "./oa.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import ThemeBootstrap from "./_components/ThemeBootstrap";
import config from "./data/config.json";
import type { OaConfig } from "./lib/types";

const oaConfig = config as OaConfig;

// design-final §7-2: OG/twitter 메타는 결과 딥링크(result/[typeSlug])의 generateMetadata가
// 유형별로 override 한다. 여기서는 랜딩/공용 기본값만 설정.
//
// title.absolute 사용 이유: 루트 layout.tsx(문제팩토리)가 이미 `%s | 문제팩토리` template을
// 정의하고 있어, 이 라우트가 `title.default`만 지정하면 루트 template이 그 위에 다시 씌워져
// "당신의 직장 유형은? | 문제팩토리"처럼 다른 서비스 브랜드가 노출된다(Next.js title 병합
// 규칙 — 자식 template은 "형제 페이지"에는 적용되지만 부모 template을 대체하지 않음).
// `absolute`는 상위 template을 전부 무시하고 이 값 그대로를 쓰므로 blast radius 0을 지키면서
// office-archetype 자체 타이틀을 보장한다. 하위 세그먼트(test/result 등)의 template은
// 그대로 `%s | ${title}` 형태로 유지해 유형별 결과 타이틀(예: "불도저형 〈...〉 | 당신의 직장 유형은?")에는 정상 적용된다.
export const metadata: Metadata = {
  // OG/twitter 이미지(/office-archetype/og/[typeSlug])를 프로덕션 절대 URL로 해석시킨다.
  // 없으면 카톡/트위터 썸네일이 localhost/상대경로로 깨져 바이럴 재유입 루프가 반쪽이 됨(최종리뷰 P2).
  // 이 라우트 세그먼트에만 적용 → 루트/타 라우트 무영향(blast radius 0).
  metadataBase: new URL("https://project-orsrw.vercel.app"),
  title: { absolute: oaConfig.title, template: `%s | ${oaConfig.title}` },
  description: oaConfig.subtitle,
  openGraph: {
    type: "website",
    locale: "ko_KR",
    title: oaConfig.title,
    description: oaConfig.subtitle,
    siteName: "직장인 성향 분석기",
    images: [{ url: "/office-archetype/og/bulldozer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: oaConfig.title,
    description: oaConfig.subtitle,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#2B3556",
};

/**
 * office-archetype 라우트 전용 레이아웃.
 * globals.css/tailwind.config.ts/루트 layout.tsx/providers.tsx 무수정(blast radius 0) —
 * 모든 스타일은 이 파일에서만 import하는 oa.css 스코프(.oa-shell) 안에서 해석된다.
 *
 * 다크모드(D10, `.oa-shell[data-theme]`)는 서버 컴포넌트인 이 레이아웃에서 SSR 시
 * 깜빡임(FOUC) 없이 적용하기 위해 ThemeBootstrap(클라 훅)이 <html> 이전에 미리
 * localStorage(oa-theme)를 읽어 data-theme 속성을 동기적으로 세팅한다.
 */
export default function OfficeArchetypeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="oa-shell" data-theme="light">
      <ThemeBootstrap />
      {children}
    </div>
  );
}
