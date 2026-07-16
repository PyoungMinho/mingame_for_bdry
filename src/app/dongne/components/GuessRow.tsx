"use client";

import type { Direction8 } from "@/lib/dongne/types";
import { DIRECTION_ARROW, DIRECTION_KO } from "@/lib/dongne/queue";

export type GuessRowState = "pending" | "active" | "answered" | "correct";

export interface GuessRowProps {
  /** 1-based 시도 순번(칩 표시용) */
  index: number;
  state: GuessRowState;
  /** "answered" 상태에서만 사용 — 동명이면 이미 "(시도)"가 포함된 표시명(예: "고성군(강원)") */
  regionName?: string;
  distanceKm?: number;
  direction?: Direction8 | null;
  proximity?: number;
  className?: string;
}

function proximityBucket(pct: number): 1 | 2 | 3 | 4 | 5 {
  if (pct < 20) return 1;
  if (pct < 40) return 2;
  if (pct < 60) return 3;
  if (pct < 80) return 4;
  return 5;
}

/**
 * 시도 리스트의 행 1개 (design-final §4-6). 근접도는 색(%숫자)과 하단 바 폭으로
 * **이중 인코딩**한다 — 색 단독 정보 전달 금지(WCAG 1.4.1, §9-10 가드). 방향 화살표는
 * 색으로 구분하지 않는다(중립 잉크색 고정, 텍스트 방위 라벨 병기).
 *
 * 게임 로직(정답 판정·힌트 계산)은 이 컴포넌트가 전혀 모른다 — 이미 계산된 결과만
 * 그대로 그린다(GuessList가 6행 스켈레톤 배치를 조립할 때 이 컴포넌트를 사용).
 */
export default function GuessRow({
  index,
  state,
  regionName,
  distanceKm,
  direction,
  proximity,
  className = "",
}: GuessRowProps) {
  if (state === "correct") {
    return (
      <div
        className={`dn-guess-row is-correct ${className}`.trim()}
        aria-live="polite"
        aria-label={`${index}번째 시도, 정답입니다`}
      >
        🎯 정답!
      </div>
    );
  }

  if (state === "pending" || state === "active") {
    return (
      <div className={`dn-guess-row ${state === "active" ? "is-active" : "is-pending"} ${className}`.trim()}>
        <span className="dn-guess-row-chip dn-text-mono-num" aria-hidden="true">
          {index}
        </span>
        {state === "active" ? <span className="dn-guess-row-waiting">입력 대기</span> : null}
      </div>
    );
  }

  // answered (오답)
  const bucket = proximity !== undefined ? proximityBucket(proximity) : 3;
  const dirLabel = direction ? DIRECTION_KO[direction] : "";
  const dirArrow = direction ? DIRECTION_ARROW[direction] : "";
  const liveText = `${index}번째 시도, ${regionName ?? ""}, ${distanceKm}킬로미터, ${dirLabel}쪽, 근접도 ${proximity}퍼센트`;

  return (
    <div className={`dn-guess-row is-answered ${className}`.trim()} aria-live="polite" aria-label={liveText}>
      <span className="dn-guess-row-chip dn-text-mono-num" aria-hidden="true">
        {index}
      </span>
      <span className="dn-guess-row-name dn-text-guess-name" aria-hidden="true">
        {regionName}
      </span>
      <span className="dn-guess-row-dist dn-text-mono-num" aria-hidden="true">
        {distanceKm}km
      </span>
      <span className="dn-guess-row-dir" aria-hidden="true">
        <span className="dn-guess-row-dir-arrow">{dirArrow}</span>
        {dirLabel}
      </span>
      <span
        className="dn-guess-row-prox dn-text-mono-num"
        style={{ color: `var(--dn-prox-${bucket})` }}
        aria-hidden="true"
      >
        {proximity}%
      </span>
      <span
        className="dn-guess-row-proxbar"
        style={{ width: `${proximity}%`, background: `var(--dn-prox-${bucket})` }}
        aria-hidden="true"
      />
    </div>
  );
}
