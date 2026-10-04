import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SceneStandalone } from './SceneStandalone';

/**
 * /gung/scene — 큰 화면 모드(노트북·TV). 현장 그림만 뜨고 비밀은 없다. 레이아웃·스타일은 /gung/layout.tsx(gung.css)를 그대로 받는다.
 * SceneStandalone 이 useSearchParams(?code=)를 쓰므로 Suspense 로 감싼다(Next 14 정적 렌더 요구).
 */
export const metadata: Metadata = {
  title: { absolute: '현장 보기 — 세자 독살 사건' },
  robots: { index: false, follow: false },
};

export default function GungScenePage() {
  return (
    <Suspense fallback={<div className="gu-boot" />}>
      <SceneStandalone />
    </Suspense>
  );
}
