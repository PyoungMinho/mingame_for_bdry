"use client";

import { useCallback, useEffect, useState } from "react";
import { OA_LOCAL_KEYS, type OaTheme } from "./types";

/**
 * 다크모드 로컬 토글 상태 훅 (design-final D10: `.oa-shell[data-theme]` 로컬 토글,
 * localStorage `oa-theme`). ThemeBootstrap이 마운트 시 이미 DOM(.oa-shell)에
 * 초기 테마를 적용해두므로, 이 훅은 그 값을 읽어와 React state와 동기화하고
 * 이후 토글 클릭 시 DOM + localStorage + state 세 곳을 함께 갱신한다.
 *
 * 질문 화면(test/page.tsx)은 몰입을 위해 이 훅을 사용하지 않고 토글 UI 자체를 숨긴다(§1 화면2).
 */
export function useOaTheme(): { theme: OaTheme; toggle: () => void } {
  const [theme, setTheme] = useState<OaTheme>("light");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(OA_LOCAL_KEYS.theme);
      if (saved === "dark" || saved === "light") {
        setTheme(saved);
        return;
      }
      const prefersDark =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
    } catch {
      // 접근 불가 시 기본 light 유지
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: OaTheme = prev === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(OA_LOCAL_KEYS.theme, next);
      } catch {
        // 저장 실패해도 이번 세션 내 토글 자체는 동작하게 둔다
      }
      const shell = document.querySelector(".oa-shell");
      if (shell) shell.setAttribute("data-theme", next);
      return next;
    });
  }, []);

  return { theme, toggle };
}
