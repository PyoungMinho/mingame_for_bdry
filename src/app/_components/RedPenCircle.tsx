import type { ReactNode } from "react";

/**
 * 손그림 빨간펜 동그라미 — 헤드라인 강조(브랜드 시그니처).
 * preserveAspectRatio="none"로 텍스트 박스에 맞춰 늘어나되,
 * vectorEffect="non-scaling-stroke"로 선 두께는 균일하게 유지.
 */
function RedPenCircle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 120" fill="none" preserveAspectRatio="none" className={className} aria-hidden="true">
      <path
        d="M168 13 C92 4 27 24 17 54 C9 80 70 105 166 107 C258 109 313 82 302 49 C293 23 236 10 149 16"
        stroke="#DC2626"
        strokeWidth="2.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        opacity="0.9"
      />
    </svg>
  );
}

/**
 * 단어를 빨간펜 동그라미로 감싸는 헤드라인 강조 래퍼.
 * 랜딩·자습·강사 세 페이지 공통 브랜드 시그니처.
 * 부모가 inline-block + nowrap이라 감싼 구절은 한 줄에 유지된다.
 */
export function CircledWord({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className="relative inline-block whitespace-nowrap align-baseline">
      <span className={`relative z-10 ${className ?? ""}`}>{children}</span>
      <RedPenCircle className="pointer-events-none absolute -inset-x-3 -inset-y-1.5 z-20" />
    </span>
  );
}
