"use client";

import { useState, useRef, useEffect } from "react";
import { Check } from "lucide-react";

/** design-final D3 확정: 선택 점등 → 260ms 후 콜백(오탭 인지 가능한 시각 피드백 + 체감 지연 없음). */
export const OA_OPTION_TRANSITION_MS = 260;

export interface OptionButtonProps {
  /** 옵션 고유 id (예: "a") */
  id: string;
  /** 옵션 본문. line-clamp 금지(design-final §1 화면2 — moira 교훈), 길면 카드 높이 증가. */
  text: string;
  /** 이 옵션이 현재 선택된 상태인지 (뒤로가기 복원 시 하이라이트) */
  selected?: boolean;
  /** 문항 전체가 답변 완료(자동 전환 대기 중)라 인터랙션을 잠글지 여부 */
  disabled?: boolean;
  /** 탭 즉시 점등 애니메이션이 끝난 뒤(260ms) 호출되는 콜백. 실제 다음 문항 전환은 호출부 책임. */
  onSelect: (id: string) => void;
  /** reduce-motion 등으로 지연을 0으로 만들고 싶을 때 override (기본 260ms) */
  transitionMs?: number;
  className?: string;
}

/**
 * 질문 화면 선택지 카드. 탭하면 즉시 배경이 점등되고 체크 아이콘이 페이드인,
 * transitionMs(기본 260ms) 뒤 onSelect가 실제로 호출된다.
 * 실제 `<button>`이라 키보드/스크린리더 모두 자연 지원. Tab 순서 = 시각 순서.
 */
export default function OptionButton({
  id,
  text,
  selected = false,
  disabled = false,
  onSelect,
  transitionMs = OA_OPTION_TRANSITION_MS,
  className = "",
}: OptionButtonProps) {
  const [lit, setLit] = useState(selected);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLit(selected);
  }, [selected]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleClick() {
    if (disabled) return;
    setLit(true);
    timerRef.current = setTimeout(() => {
      onSelect(id);
    }, transitionMs);
  }

  return (
    <button
      type="button"
      className={`oa-option${lit ? " is-lit" : ""} touch-target ${className}`.trim()}
      aria-pressed={lit}
      disabled={disabled}
      onClick={handleClick}
    >
      <span className="oa-option-text">{text}</span>
      <span className="oa-option-check" aria-hidden="true">
        <Check size={16} strokeWidth={3} />
      </span>
    </button>
  );
}
