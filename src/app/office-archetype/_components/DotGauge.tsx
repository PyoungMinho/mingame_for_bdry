"use client";

export interface DotGaugeProps {
  /** 채움값 0~5 */
  value: number;
  /** 전체 도트 개수 (기본 5, design-final §1 화면3 "도트 5개 채움 게이지") */
  max?: number;
  label?: string;
  className?: string;
}

/**
 * 강점/그림자 도트 게이지. REDLINE: 자기 유형 내 속성 강조 용도로만 사용하고,
 * 타 유형과의 직접 수치 비교 UI로 절대 재사용하지 않는다(design-final §1, §7-2).
 */
export default function DotGauge({ value, max = 5, label, className = "" }: DotGaugeProps) {
  const clamped = Math.max(0, Math.min(max, value));
  const dots = Array.from({ length: max }, (_, i) => i < clamped);

  return (
    <span className={`oa-gauge ${className}`.trim()} role="img" aria-label={`${label ?? ""} ${clamped}/${max}`.trim()}>
      {dots.map((filled, i) => (
        <span key={i} className={`oa-gauge-dot${filled ? " is-filled" : ""}`} aria-hidden="true" />
      ))}
    </span>
  );
}
