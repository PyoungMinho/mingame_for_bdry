/**
 * (fullscreen) 그룹 레이아웃 — 탭바 없는 풀스크린.
 * 생성대기(S4), 결과(S5), 편집(S6), 공유(S7).
 * 잉크 & 리소 에디션 — 상단 뒤로가기 헤더 + 배경 하프톤 데코.
 */
import type { ReactNode } from "react";

export default function FullscreenLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--color-bg-base)]">
      {/* 배경 하프톤 데코 — aria-hidden, pointer-events-none */}
      <span
        aria-hidden
        className="tone-dots-lg pointer-events-none absolute -right-12 top-20 h-52 w-52 rounded-full text-[var(--color-primary)] opacity-[0.07]"
      />
      <span
        aria-hidden
        className="tone-grid pointer-events-none absolute -left-14 bottom-32 h-48 w-48 text-[var(--color-secondary)] opacity-[0.06]"
      />
      <main className="relative h-full">{children}</main>
    </div>
  );
}
