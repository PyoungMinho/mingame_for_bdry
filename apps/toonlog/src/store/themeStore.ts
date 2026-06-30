/**
 * 테마 스토어 — 다크/라이트 토글.
 * localStorage 'toonlog-theme' 에 영속화.
 * FOUC 방지는 layout.tsx head 인라인 스크립트가 처리.
 */
"use client";

import { create } from "zustand";
import { THEME_STORAGE_KEY } from "@/lib/constants";

type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
  /** 실제 적용 테마 ('system'인 경우 OS 감지) */
  resolved: "light" | "dark";
}

function getInitialMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return "system";
}

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return mode;
}

function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(mode);
  if (resolved === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.setAttribute("data-theme", "light");
  }
  if (mode === "system") {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } else {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: getInitialMode(),
  resolved: resolveTheme(getInitialMode()),

  setMode: (mode) => {
    applyTheme(mode);
    set({ mode, resolved: resolveTheme(mode) });
  },

  toggle: () => {
    const current = get().resolved;
    const next: ThemeMode = current === "dark" ? "light" : "dark";
    applyTheme(next);
    set({ mode: next, resolved: next });
  },
}));
