/**
 * (tabs) 그룹 레이아웃 — 하단 탭바 포함 화면.
 * 홈/아카이브/마이페이지/일기작성 진입점에서 공용.
 * TabBar 컴포넌트는 컴포넌트개발자 병렬 작업 중 (@/components 배럴).
 */
import type { ReactNode } from "react";
import { TabBar } from "@/components";

export default function TabsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--color-bg-base)]">
      {/* 페이지 레벨 배경 하프톤 데코 — 은은하게, pointer-events 없음 */}
      <span
        aria-hidden
        className="tone-dots-lg pointer-events-none fixed right-0 top-32 h-56 w-56 rounded-full text-[var(--color-primary)] opacity-[0.06]"
      />
      <span
        aria-hidden
        className="tone-grid pointer-events-none fixed -left-8 top-[55%] h-48 w-48 text-[var(--color-secondary)] opacity-[0.05]"
      />

      {/* 콘텐츠 영역 — 중앙 정렬 + 하단 탭바 높이(56px) + safe-area 패딩 확보 */}
      <main className="mx-auto max-w-[480px] pb-[calc(56px+env(safe-area-inset-bottom,0px))]">
        {children}
      </main>

      <TabBar />
    </div>
  );
}
