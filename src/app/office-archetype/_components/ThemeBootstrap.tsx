"use client";

import { useEffect } from "react";
import { OA_LOCAL_KEYS } from "../lib/types";

/**
 * layout.tsx(서버 컴포넌트)가 렌더하는 `.oa-shell`은 기본 data-theme="light"로 시작한다.
 * 이 컴포넌트는 마운트 직후(useEffect, 페인트 이전 최대한 빠르게) localStorage(oa-theme)를
 * 읽어 실제 저장된 테마를 `.oa-shell`에 반영한다 — 저장소가 sessionStorage가 아니라
 * localStorage인 이유는 design-final §1-0 상태 목록(다크 테마 = localStorage `oa-theme`) 그대로.
 *
 * 페이지 내부(page.tsx/result 등)의 ThemeToggle은 이 컴포넌트가 세팅한 DOM 속성을
 * 그대로 토글하며 동일 로직(setOaTheme)을 재사용한다.
 */
export default function ThemeBootstrap() {
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(OA_LOCAL_KEYS.theme);
      const theme = saved === "dark" || saved === "light" ? saved : getSystemTheme();
      applyOaTheme(theme);
    } catch {
      // localStorage 접근 불가(프라이빗 모드 등) — 기본 light 유지, 조용히 무시
    }
  }, []);

  return null;
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** `.oa-shell` DOM에 data-theme을 실제로 적용한다. ThemeToggle 클릭 핸들러에서도 재사용. */
export function applyOaTheme(theme: "light" | "dark") {
  if (typeof document === "undefined") return;
  const shell = document.querySelector(".oa-shell");
  if (shell) shell.setAttribute("data-theme", theme);
}
