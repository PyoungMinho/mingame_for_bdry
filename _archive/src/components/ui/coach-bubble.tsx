// REDLINE: 외모/체형 비교 UI 금지. 타인 점수 노출 금지.

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { type PersonaKey } from "@/components/tokens/persona";

// ── Props 인터페이스 ──────────────────────────────────────────────────
export interface CoachBubbleProps {
  /** 발화자 — "coach" | "user" */
  sender: "coach" | "user";
  /** 메시지 텍스트 */
  message: string;
  /** 페르소나 (코치 버블 accent 색상 결정) */
  persona?: PersonaKey;
  /** 스트리밍 중 여부 — 커서 블링크 표시 */
  streaming?: boolean;
  /** 페르소나 이름 레이블 (코치 버블 상단) */
  coachName?: string;
  className?: string;
}

/**
 * 오름 CoachBubble 컴포넌트 — 코치챗 말풍선
 *
 * TODO (페이지개발자 의존):
 * - SSE 스트리밍 연결 (POST /api/coach/chat)
 * - E_AI_QUOTA_EXCEEDED 에러 → Toast 자동 표시
 * - 페르소나 Zustand store 연결
 * - 메시지 목록 스크롤 관리
 *
 * @see ui-spec.md §3-19
 */
const CoachBubble = React.forwardRef<HTMLDivElement, CoachBubbleProps>(
  (
    {
      sender,
      message,
      persona = "mentor",
      streaming = false,
      coachName,
      className,
      ...props
    },
    ref
  ) => {
    // TODO: 페르소나별 bubbleAccent 색상 적용
    // TODO: 코치 버블 상단 페르소나 아이콘(20px) + 이름(caption) 렌더
    // TODO: streaming=true 시 커서 블링크 (1s infinite)

    const isCoach = sender === "coach";

    return (
      <div
        ref={ref}
        className={cn(
          "flex",
          isCoach ? "justify-start" : "justify-end",
          className
        )}
        {...props}
      >
        <div
          className={cn(
            "max-w-[75%] px-4 py-3 text-[15px] leading-[1.6]",
            isCoach
              ? // 코치: surface-elevated 배경, primary-800 텍스트, radius-xl 우하 4px
                "bg-white text-primary-800 rounded-xl rounded-br-none shadow-sm"
              : // 사용자: primary-800 배경, 흰색 텍스트, radius-xl 좌하 4px
                "bg-primary-800 text-white rounded-xl rounded-bl-none"
          )}
          role="article"
          aria-label={isCoach ? "코치 메시지" : "내 메시지"}
        >
          {/* TODO: 코치 버블 상단 페르소나 레이블 */}
          {isCoach && coachName && (
            <p className="text-[12px] text-gray-400 mb-1">{coachName}</p>
          )}
          <p>{message}</p>
          {/* TODO: streaming 커서 */}
          {streaming && (
            <span className="inline-block w-0.5 h-4 bg-current ml-0.5 animate-pulse" aria-hidden="true" />
          )}
        </div>
      </div>
    );
  }
);

CoachBubble.displayName = "CoachBubble";

export { CoachBubble };
