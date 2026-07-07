"use client";

import type { CSSProperties } from "react";
import TypeIcon from "./TypeIcon";
import DotGauge from "./DotGauge";
import type { OaType } from "../lib/types";

export interface ResultCardProps {
  /** 결과로 확정된 유형 — 이름/컬러/아이콘/카피 전부 여기서만 온다(도메인 하드코딩 금지) */
  type: OaType;
  /** 8유형 중 현재 몇 번째인지(1-based) — "No.03/08" 크롬바 표기용 */
  indexInTypes: number;
  totalTypes: number;
  /** 상성 매칭 유형(findMatchType 결과). 없으면 상성 섹션 미노출. */
  matchType?: OaType;
  /** config.labels.strengths 등 — 라벨 문자열을 config에서 주입(하드코딩 금지) */
  labels: {
    strengthLabel: string;
    shadowLabel: string;
    matchLabel: string;
    matchCtaLabel?: string;
  };
  /** 상성 카드 "이 유형 보기" 탭 핸들러(바텀시트 오픈 등, design-final §1 화면3) */
  onMatchCtaClick?: () => void;
  className?: string;
}

/**
 * 결과 화면 사원증 메타포 카드 (design-final §1 화면3, §4-3 스키마 계승).
 * OG 이미지(og/[typeSlug]/route.tsx)와 정보구조를 공유하는 소스 컴포넌트이므로
 * 레이아웃 변경 시 OG 라우트도 함께 검토해야 한다(설계 문서 §5 참고).
 *
 * 컬러는 전부 `type.color`를 CSS 커스텀 프로퍼티로 주입해서 사용한다 — oa.css는
 * `--oa-type-tint/solid/deep` 변수만 소비하고 특정 유형 색을 알지 못한다.
 */
export default function ResultCard({
  type,
  indexInTypes,
  totalTypes,
  matchType,
  labels,
  onMatchCtaClick,
  className = "",
}: ResultCardProps) {
  const cardStyle = {
    "--oa-type-tint": type.color.tint,
    "--oa-type-solid": type.color.solid,
    "--oa-type-deep": type.color.deep,
  } as CSSProperties;

  const paddedIndex = String(indexInTypes).padStart(2, "0");
  const paddedTotal = String(totalTypes).padStart(2, "0");

  return (
    <div className={`oa-result-card ${className}`.trim()} style={cardStyle}>
      <div className="oa-result-card-chrome">
        <span className="oa-result-card-brand">OFFICE ARCHETYPE</span>
        <span className="oa-result-card-no">
          No.{paddedIndex}/{paddedTotal}
        </span>
      </div>

      <div className="oa-result-card-badge">
        <TypeIcon icon={type.icon} size={40} color={type.color.solid} strokeWidth={2.5} />
      </div>

      <h1 className="oa-result-card-name">{type.name}</h1>
      <p className="oa-result-card-alias">〈{type.alias}〉</p>
      <p className="oa-result-card-tagline">&ldquo;{type.tagline}&rdquo;</p>

      <div className="oa-result-card-gauges">
        <span className="oa-result-card-gauge-item">
          <span className="oa-result-card-gauge-label">{labels.strengthLabel}</span>
          <DotGauge value={type.gauge.strength} label={labels.strengthLabel} />
        </span>
        <span className="oa-result-card-gauge-item">
          <span className="oa-result-card-gauge-label">{labels.shadowLabel}</span>
          <DotGauge value={type.gauge.shadow} label={labels.shadowLabel} />
        </span>
      </div>

      {matchType ? (
        <>
          <hr className="oa-result-card-divider" />
          <div className="oa-result-card-match">
            <p className="oa-result-card-match-label">{labels.matchLabel}</p>
            <div className="oa-result-card-match-row">
              <span className="oa-result-card-match-badge">
                <TypeIcon icon={matchType.icon} size={22} color={matchType.color.solid} strokeWidth={2.5} />
              </span>
              <div className="oa-result-card-match-body">
                <p className="oa-result-card-match-name">{matchType.name}</p>
                <p className="oa-result-card-match-reason">&ldquo;{type.matchBestReason}&rdquo;</p>
              </div>
            </div>
            {onMatchCtaClick && labels.matchCtaLabel ? (
              <button
                type="button"
                className="oa-result-card-match-cta touch-target"
                onClick={onMatchCtaClick}
              >
                {labels.matchCtaLabel}
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      <div className="oa-result-card-barcode" aria-hidden="true" />
    </div>
  );
}
