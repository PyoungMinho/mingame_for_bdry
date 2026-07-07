"use client";

import { Sun, Moon } from "lucide-react";
import type { OaTheme } from "../lib/types";

export interface ThemeToggleProps {
  theme: OaTheme;
  onToggle: () => void;
  className?: string;
}

/** 다크모드 로컬 토글 (design-final D10 `.oa-shell[data-theme]`). 랜딩/결과에만 노출, 질문 화면은 숨김. */
export default function ThemeToggle({ theme, onToggle, className = "" }: ThemeToggleProps) {
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className={`oa-theme-toggle touch-target ${className}`.trim()}
      onClick={onToggle}
      aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      aria-pressed={isDark}
    >
      {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}
