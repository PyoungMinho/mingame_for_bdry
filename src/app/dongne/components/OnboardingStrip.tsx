"use client";

export interface OnboardingStripProps {
  /** "시작하기" 탭 콜백 — localStorage(`dongne:onboarded`) 기록은 페이지 책임, 여기선 순수 콜백만 */
  onStart: () => void;
  className?: string;
}

/**
 * 최초 방문 온보딩 스트립 (design-final §4-2). **모달 아님** — 헤더 아래 인라인 노출,
 * dismiss 후 영구 미노출은 페이지가 마운트 여부로 제어한다(이 컴포넌트는 상태를 갖지 않음).
 */
export default function OnboardingStrip({ onStart, className = "" }: OnboardingStripProps) {
  return (
    <div className={`dn-onboarding ${className}`.trim()} role="region" aria-label="게임 방법 안내">
      <div className="dn-onboarding-body">
        <p className="dn-onboarding-title dn-text-h2">누구나 6번 안에!</p>
        <p className="dn-onboarding-steps dn-text-body-sm">
          ① 오늘의 동네 실루엣 1개 &nbsp;② 6번 안에 지명 맞히기 &nbsp;③ 오답마다 거리·방향·근접도 힌트
        </p>
      </div>
      <button type="button" className="dn-onboarding-start touch-target" onClick={onStart}>
        시작하기
      </button>
    </div>
  );
}
