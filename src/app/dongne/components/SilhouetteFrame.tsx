"use client";

import { useMemo } from "react";
import type { Silhouette } from "@/lib/dongne/types";

export type SilhouetteFrameState = "loading" | "error" | "playing" | "correct" | "failed";

export interface SilhouetteFrameProps {
  /** 프레임의 현재 표시 상태. */
  state: SilhouetteFrameState;
  /** 오늘 실루엣 데이터(정규화된 path). "loading"/"error" 상태에선 생략 가능 */
  silhouette?: Silhouette;
  /**
   * "failed" 상태에서만 사용 — 정답 확정(6패) 후의 정답 지역명.
   * ⚠ 스포일러 가드(design-final §9-2): "playing"·"correct" 상태에서는 절대 전달 금지.
   * "correct" 상태는 이 값을 받아도 렌더하지 않는다(§4-3 표에 명시된 유일한 노출 케이스는 실패뿐).
   */
  answerName?: string;
  /** "error" 상태의 "다시 시도" 버튼 핸들러. 없으면 버튼 미노출 */
  onRetry?: () => void;
  className?: string;
}

/**
 * 실루엣 프레임 카드 (design-final §4-3). 데이터 파이프라인이 이미 정북고정·미러금지·
 * fit-to-frame 88% 정규화한 path(silhouette.d, viewBox "0 0 100 100")를 그대로 렌더한다 —
 * 이 컴포넌트는 프레임/그래티큘 배경/상태 전환 크로스페이드만 담당한다.
 *
 * 스포일러 가드: "playing" 상태의 aria-label은 항상 "오늘의 동네 실루엣"만(지역명 렌더 금지).
 * fetch 실패("error")여도 게임 자체(자동완성)는 계속 진행 가능해야 한다 — 그 판단은 페이지 책임,
 * 이 컴포넌트는 완전 블로킹 없는 인라인 에러만 보여준다.
 */
export default function SilhouetteFrame({
  state,
  silhouette,
  answerName,
  onRetry,
  className = "",
}: SilhouetteFrameProps) {
  const ariaLabel = useMemo(() => {
    if (state === "failed" && answerName) return `오늘의 동네: ${answerName} (정답 공개)`;
    return "오늘의 동네 실루엣";
  }, [state, answerName]);

  return (
    <div className={`dn-silhouette-frame ${className}`.trim()} data-state={state}>
      <div className="dn-silhouette-frame-graticule" aria-hidden="true" />

      {state === "loading" ? (
        <div
          className="dn-silhouette-skeleton"
          role="img"
          aria-label="오늘의 동네 실루엣을 불러오는 중"
        />
      ) : null}

      {state === "error" ? (
        <div className="dn-silhouette-error">
          <p className="dn-text-body-sm">실루엣을 불러오지 못했어요</p>
          {onRetry ? (
            <button type="button" className="dn-silhouette-error-retry" onClick={onRetry}>
              다시 시도
            </button>
          ) : null}
        </div>
      ) : null}

      {(state === "playing" || state === "correct" || state === "failed") && silhouette ? (
        <div className="dn-silhouette-svg-wrap" role="img" aria-label={ariaLabel}>
          <svg
            className="dn-silhouette-svg"
            viewBox={silhouette.viewBox}
            aria-hidden="true"
            focusable="false"
          >
            <path d={silhouette.d} fillRule="evenodd" />
          </svg>

          {state === "correct" ? <span className="dn-silhouette-stamp">🎯 정답!</span> : null}

          {state === "failed" && answerName ? (
            <div className="dn-silhouette-caption">
              <p className="dn-text-h2">정답은 {answerName}였어요</p>
              <p className="dn-text-body-sm">내일 &apos;어제의 동네&apos;에서 만나요</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
