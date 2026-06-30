// REDLINE: 외모/체형 비교 UI 금지. 타인 점수 노출 금지.

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { PERSONA_KEYS, personaConfig, type PersonaKey } from "@/components/tokens/persona";

// ── Props 인터페이스 ──────────────────────────────────────────────────
export interface PersonaSelectorProps {
  /** 현재 선택된 페르소나 */
  value: PersonaKey;
  /** 변경 핸들러 */
  onChange: (persona: PersonaKey) => void;
  className?: string;
}

/**
 * 오름 PersonaSelector 컴포넌트 — 페르소나 3종 토글
 *
 * TODO (페이지개발자 의존):
 * - Zustand personaStore 연동 (applyPersona 호출)
 * - 선택 시 <html data-persona="..."> 교체 → 250ms CSS 전환
 * - 드로어(Drawer) 내부에서 렌더
 * - R5 레드라인: 로맨틱 페르소나 금지, 친밀감 과잉(애칭/하트) 금지
 *
 * @see design-final.md C1, ui-spec.md §3-18
 */
const PersonaSelector = React.forwardRef<HTMLDivElement, PersonaSelectorProps>(
  ({ value, onChange, className, ...props }, ref) => {
    // TODO: Zustand personaStore 연결 후 onChange 내부에서 applyPersona() 호출

    return (
      <div
        ref={ref}
        className={cn("flex gap-2", className)}
        role="radiogroup"
        aria-label="코치 페르소나 선택"
        {...props}
      >
        {PERSONA_KEYS.map((key) => {
          const config = personaConfig[key];
          const isSelected = value === key;

          return (
            <button
              key={key}
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(key)}
              className={cn(
                "flex-1 px-3 py-2 rounded-full text-[13px] font-medium leading-[1.4]",
                "border transition-all duration-base",
                "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(255,122,41,0.5)]",
                "min-h-[44px]", // 터치 타겟
                isSelected
                  ? "bg-primary-800 text-white border-primary-800"
                  : "bg-gray-100 text-gray-700 border-transparent hover:bg-gray-200"
              )}
              // TODO: 선택 시 accent 컬러를 페르소나 config.accentColor 로 적용
            >
              {config.label}
            </button>
          );
        })}
      </div>
    );
  }
);

PersonaSelector.displayName = "PersonaSelector";

export { PersonaSelector };
