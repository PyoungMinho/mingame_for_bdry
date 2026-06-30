"use client";

import { ShieldCheck, Camera, MapPin, HelpCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrustGrade } from "@/lib/types/domain";
import { TrustDonut } from "./TrustDonut";

export interface TrustScoreBadgeProps {
  grade: TrustGrade;
  score: number;
  scoreIsLowerBound?: boolean;    // D3: true면 "N점~" 표기
  maxPossibleScore?: number;       // pending 시 "최대 M점" 보조
  naturalLabel?: string;           // 자연어 우선 노출
  showDonut?: boolean;
  showScore?: boolean;
  variant?: "compact" | "standard" | "featured";
  className?: string;
}

// 등급별 라벨 (색+형태 이중 코드 §4.1)
const GRADE_LABEL: Record<TrustGrade, string> = {
  gold: "실거주 인증",
  silver: "현장 인증",
  unverified: "미인증",
};

const DEFAULT_NATURAL_LABEL: Record<TrustGrade, string> = {
  gold: "실거주 세입자가 직접 찍은 사진이 검증됐어요",
  silver: "현장에서 촬영한 사진이 있어요",
  unverified: "아직 현장 검증이 되지 않은 매물이에요",
};

// 컨테이너 스타일 (grade × variant)
function getBadgeContainerClass(grade: TrustGrade, variant: string): string {
  const base = "inline-flex flex-col gap-score-gap rounded-badge";

  const gradeClass: Record<TrustGrade, string> = {
    gold: "bg-realestate-trust-gold-bg border border-realestate-trust-gold-border shadow-badge-gold",
    silver: "bg-realestate-trust-silver-bg border border-realestate-trust-silver-border",
    unverified: "bg-realestate-trust-unverified-bg border-[1.5px] border-dashed border-realestate-trust-unverified-border",
  };

  const variantPad: Record<string, string> = {
    compact: "px-badge-pad-x py-badge-pad-y",
    standard: "px-3 py-2",
    featured: "px-4 py-3",
  };

  return cn(base, gradeClass[grade], variantPad[variant] ?? variantPad.standard);
}

// 아이콘 컴포넌트 — Silver는 Camera+MapPin 합성
function GradeIcon({ grade, size }: { grade: TrustGrade; size: number }) {
  const iconClass = {
    gold: "text-realestate-trust-gold",
    silver: "text-realestate-trust-silver",
    unverified: "text-realestate-trust-unverified",
  }[grade];

  if (grade === "silver") {
    // Camera + MapPin 합성: 렌즈 우하단에 핀 8px 오버레이
    return (
      <span className="relative inline-flex" style={{ width: size, height: size }}>
        <Camera size={size} className={iconClass} strokeWidth={2} aria-hidden="true" />
        <MapPin
          size={8}
          className={iconClass}
          strokeWidth={2}
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: -1,
            right: -1,
          }}
        />
      </span>
    );
  }

  if (grade === "gold") {
    return <ShieldCheck size={size} className={iconClass} strokeWidth={2} aria-hidden="true" />;
  }

  return <HelpCircle size={size} className={iconClass} strokeWidth={2} aria-hidden="true" />;
}

export function TrustScoreBadge({
  grade,
  score,
  scoreIsLowerBound = false,
  maxPossibleScore,
  naturalLabel,
  showDonut = false,
  showScore = true,
  variant = "standard",
  className,
}: TrustScoreBadgeProps) {
  const label = GRADE_LABEL[grade];
  const natural = naturalLabel ?? DEFAULT_NATURAL_LABEL[grade];
  const isUnverified = grade === "unverified";
  const isFeatured = variant === "featured";
  const isCompact = variant === "compact";

  const iconSize = isFeatured ? 24 : 16;
  const donutSize = isFeatured ? "medium" : isCompact ? "mini" : "small";

  // 점수 표기: scoreIsLowerBound면 "N점~"
  const scoreDisplay = scoreIsLowerBound ? `${score}점~` : `${score}점`;

  const ariaLabel = [
    `신뢰 등급: ${label}`,
    showScore ? scoreDisplay : null,
    natural,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className={cn("flex flex-col", className)}>
      <div
        role="status"
        aria-label={ariaLabel}
        className={getBadgeContainerClass(grade, variant)}
      >
        {/* 메인 행: 아이콘 + 라벨 + 도넛/점수 */}
        <div className="flex items-center gap-1.5">
          <GradeIcon grade={grade} size={iconSize} />

          <span
            className={cn(
              "text-trust-label",
              {
                gold: "text-realestate-trust-gold",
                silver: "text-realestate-trust-silver",
                unverified: "text-realestate-trust-unverified",
              }[grade]
            )}
          >
            {label}
          </span>

          {showScore && (
            <span
              className={cn(
                "ml-auto font-bold tabular-nums",
                isFeatured ? "text-trust-score font-serif" : "text-trust-label",
                {
                  gold: "text-realestate-trust-gold",
                  silver: "text-realestate-trust-silver",
                  unverified: "text-realestate-trust-unverified",
                }[grade]
              )}
              aria-hidden="true"
            >
              {scoreDisplay}
            </span>
          )}

          {showDonut && (
            <TrustDonut
              score={score}
              grade={grade}
              size={donutSize}
              showScore={false}
              className="ml-1"
            />
          )}
        </div>

        {/* 자연어 라벨 — standard/featured에서 노출 */}
        {!isCompact && (
          <p className="text-trust-desc text-realestate-neutral-700" aria-hidden="true">
            {natural}
          </p>
        )}

        {/* pending 보조: maxPossibleScore 표기 */}
        {scoreIsLowerBound && maxPossibleScore !== undefined && !isCompact && (
          <p className="text-trust-desc text-realestate-neutral-500" aria-hidden="true">
            최대 {maxPossibleScore}점까지 가능
          </p>
        )}
      </div>

      {/* Unverified: 하단 앰버 경고 스트립 자동 렌더 (§4.1) */}
      {isUnverified && (
        <div
          className="flex items-center gap-1 px-badge-pad-x py-badge-pad-y bg-realestate-amber-warn-bg border border-realestate-amber-warn-border text-realestate-amber-warn rounded-sm text-trust-desc mt-0.5"
          aria-live="polite"
        >
          <AlertTriangle size={12} strokeWidth={2} aria-hidden="true" />
          <span>미인증 매물입니다. 현장 방문 전 주의하세요</span>
        </div>
      )}
    </div>
  );
}
