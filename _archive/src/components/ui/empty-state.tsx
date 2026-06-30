// REDLINE: 외모/체형 비교 UI 금지. 타인 점수 노출 금지.

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { type AxisKey } from "@/components/tokens/colors";

// ── 에러코드 타입 (project-direction.md §7) ──────────────────────────
export type OreumErrorCode =
  | "E_AGE_BLOCKED"
  | "E_REDLINE_REJECT"
  | "E_AI_QUOTA_EXCEEDED"
  | "EMPTY";

// ── Props 인터페이스 ──────────────────────────────────────────────────
export interface EmptyStateProps {
  /** 빈 상태 or 에러 코드 */
  code?: OreumErrorCode;
  /** 타이틀 (코드 기본값 오버라이드 가능) */
  title?: string;
  /** 서브텍스트 */
  description?: string;
  /** 아이콘 축 (64px 원 + 축 아이콘) */
  axis?: AxisKey;
  /** Primary 버튼 텍스트 */
  actionLabel?: string;
  /** Primary 버튼 클릭 */
  onAction?: () => void;
  /** Secondary 버튼 텍스트 (에러 상태 재시도) */
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
}

// ── 에러코드 기본 메시지 맵 ───────────────────────────────────────────
const ERROR_MESSAGES: Record<OreumErrorCode, { title: string; description: string }> = {
  E_AGE_BLOCKED: {
    title: "이용 불가",
    description: "만 16세 미만은 오름 서비스를 이용할 수 없습니다.",
  },
  E_REDLINE_REJECT: {
    title: "허용되지 않는 요청",
    description: "요청하신 기능은 제공하지 않습니다.",
  },
  E_AI_QUOTA_EXCEEDED: {
    title: "AI 코치 이용 한도 초과",
    description: "이번 달 코치챗 이용 한도에 도달했습니다. 다음 달 1일에 초기화됩니다.",
  },
  EMPTY: {
    title: "아직 기록이 없어요",
    description: "첫 체크인을 시작해보세요.",
  },
};

/**
 * 오름 EmptyState / ErrorState 컴포넌트
 *
 * TODO (페이지개발자 의존):
 * - 라우터 연결 (onAction "홈으로" 등)
 * - E_AGE_BLOCKED: CTA 없음, 앱 종료 유도 (design-final.md R3)
 * - 축 아이콘 커스텀 SVG 교체 (현재 텍스트 폴백)
 *
 * @see design-final.md §5 R3, ui-spec.md §3-20
 */
const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      code = "EMPTY",
      title,
      description,
      axis,
      actionLabel,
      onAction,
      retryLabel,
      onRetry,
      className,
      ...props
    },
    ref
  ) => {
    const defaults = ERROR_MESSAGES[code];
    const displayTitle = title ?? defaults.title;
    const displayDesc = description ?? defaults.description;

    // E_AGE_BLOCKED: CTA 없음 (design-final.md R3)
    const isAgeBlocked = code === "E_AGE_BLOCKED";

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center gap-4 py-12 px-5 text-center",
          className
        )}
        role="status"
        aria-live="polite"
        {...props}
      >
        {/* 아이콘 영역 — 64px 원 + 텍스트 폴백 */}
        {/* TODO: 축 커스텀 SVG 아이콘 교체 */}
        <div
          className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-2xl"
          aria-hidden="true"
        >
          {code === "E_AGE_BLOCKED" && "🔒"}
          {code === "E_AI_QUOTA_EXCEEDED" && "💬"}
          {code === "E_REDLINE_REJECT" && "⚠️"}
          {code === "EMPTY" && "✦"}
        </div>

        {/* 타이틀 — h4 17px/600 */}
        <h2 className="text-[17px] font-semibold leading-[1.5] text-primary-800">
          {displayTitle}
        </h2>

        {/* 서브텍스트 — body-s 14px */}
        <p className="text-[14px] text-gray-500 leading-[1.6] max-w-[240px]">
          {displayDesc}
        </p>

        {/* 버튼 영역 — E_AGE_BLOCKED는 CTA 없음 */}
        {!isAgeBlocked && (
          <div className="flex flex-col gap-2 w-full max-w-[240px]">
            {onAction && actionLabel && (
              <Button variant="primary" size="md" onClick={onAction}>
                {actionLabel}
              </Button>
            )}
            {onRetry && retryLabel && (
              <Button variant="secondary" size="md" onClick={onRetry}>
                {retryLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }
);

EmptyState.displayName = "EmptyState";

export { EmptyState };
