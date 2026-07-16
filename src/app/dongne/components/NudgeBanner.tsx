"use client";

import { Flame } from "lucide-react";
import { useMidnightCountdown, formatHMS } from "./useMidnightCountdown";

export interface NudgeBannerProps {
  streak: number;
  onDismiss: () => void;
  className?: string;
}

/**
 * 스트릭 위험 넛지 배너 (design-final §4-12). 노출 조건(오늘 미플레이 & streak>0 &
 * KST≥21:00) 판단은 페이지 책임 — 이 컴포넌트는 조건이 참일 때만 마운트된다고 가정하고
 * 순수 표시만 한다. 세션 dismiss만 처리(다음 방문 재평가는 페이지의 재마운트 판단).
 * 웹푸시 없음, 모달 아님(스크롤로 밀리는 인라인 배너).
 */
export default function NudgeBanner({ streak, onDismiss, className = "" }: NudgeBannerProps) {
  const parts = useMidnightCountdown();

  return (
    <div className={`dn-nudge ${className}`.trim()} role="status">
      <span className="dn-nudge-icon" aria-hidden="true">
        <Flame size={16} />
      </span>
      <p className="dn-nudge-text">
        🔥 스트릭 {streak}일째! 자정 전에 오늘 문제를 풀어야 이어져요 (자정까지 {formatHMS(parts)})
      </p>
      <button type="button" className="dn-nudge-dismiss touch-target" onClick={onDismiss} aria-label="닫기">
        ✕
      </button>
    </div>
  );
}
