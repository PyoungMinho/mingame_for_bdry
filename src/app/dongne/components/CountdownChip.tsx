"use client";

import { Clock } from "lucide-react";
import { useMidnightCountdown, formatHMS } from "./useMidnightCountdown";

export interface CountdownChipProps {
  /** 기본 "다음 문제까지". 넛지 배너 등에서 다른 문구로 재사용 가능 */
  label?: string;
  /** true면 아이콘·라벨 없이 HH:MM:SS만(넛지 배너 인라인 삽입용) */
  compact?: boolean;
  className?: string;
}

/**
 * 카운트다운 칩 (design-final §4-10). 다음 KST 자정까지 남은 시간만 표시하는
 * 독립 컴포넌트 — 1초마다 자체 리렌더되므로 부모 트리 리렌더를 유발하지 않도록
 * 반드시 이 컴포넌트 단위로 격리해서 사용한다(design-final 성능 지침).
 */
export default function CountdownChip({
  label = "다음 문제까지",
  compact = false,
  className = "",
}: CountdownChipProps) {
  const parts = useMidnightCountdown();
  const hms = formatHMS(parts);

  return (
    <span className={`dn-countdown-chip${compact ? " is-compact" : ""} ${className}`.trim()}>
      {!compact ? <Clock size={14} aria-hidden="true" /> : null}
      <span className="dn-text-mono-num">{compact ? hms : `${label} ${hms}`}</span>
    </span>
  );
}
