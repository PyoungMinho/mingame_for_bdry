"use client";

import { cn } from "@/lib/utils";
import type { TrustGrade } from "@/lib/types/domain";

export interface TrustDonutProps {
  score: number;
  grade: TrustGrade;
  size?: "mini" | "small" | "medium";
  showScore?: boolean;
  className?: string;
}

const SIZE_MAP = {
  mini: { outer: 28, inner: 16, stroke: 6 },
  small: { outer: 36, inner: 22, stroke: 7 },
  medium: { outer: 52, inner: 32, stroke: 10 },
} as const;

// SVG 도넛 아크 색 — 디자인 §4.1/§4.2 확정값 (hex 예외 허용)
const ARC_COLOR: Record<TrustGrade, string> = {
  gold: "#B8860B",
  silver: "#5B6F7A",
  unverified: "#6B7280", // D4: #9CA3AF → #6B7280 통일
};

const SCORE_TEXT_SIZE: Record<string, string> = {
  mini: "text-[8px]",
  small: "text-[10px]",
  medium: "text-[13px]",
};

export function TrustDonut({
  score,
  grade,
  size = "small",
  showScore = false,
  className,
}: TrustDonutProps) {
  const { outer, stroke } = SIZE_MAP[size];
  const radius = (outer - stroke) / 2;
  const cx = outer / 2;
  const cy = outer / 2;
  const circumference = 2 * Math.PI * radius;

  // 최소 8px 아크 표시(빈 도넛 방지), 시작 12시(-90deg)
  const clampedScore = Math.max(0, Math.min(100, score));
  const rawOffset = circumference - (clampedScore / 100) * circumference;
  // 5점 미만도 ≥8px 표시
  const minArcLength = 8;
  const arcLength = Math.max(
    clampedScore > 0 ? minArcLength : 0,
    (clampedScore / 100) * circumference
  );
  const dashOffset = circumference - arcLength;

  const arcColor = ARC_COLOR[grade];
  const trackColor = "#E7E5E4"; // neutral-200 (웜 스톤)

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: outer, height: outer }}
    >
      <svg
        width={outer}
        height={outer}
        viewBox={`0 0 ${outer} ${outer}`}
        role="img"
        aria-label={`신뢰 점수 ${clampedScore}점 도넛 차트`}
        aria-hidden={showScore ? undefined : "true"}
      >
        {/* 트랙 */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        {/* 아크 — 진입 시 0→점수 500ms easeOut, prefers-reduced-motion에서 즉시 */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={arcColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{
            transition: "stroke-dashoffset 500ms ease-out",
            // prefers-reduced-motion은 globals.css의 @media rule이 처리
          }}
          className="motion-reduce:transition-none"
        />
      </svg>
      {showScore && (
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center font-bold leading-none",
            SCORE_TEXT_SIZE[size]
          )}
          style={{ color: arcColor }}
          aria-hidden="true"
        >
          {clampedScore}
        </span>
      )}
    </div>
  );
}
