/**
 * 일기 초안 스토어 — 플로우 C 재방문 기억 + 작성 중 임시 상태.
 * - 마지막 화풍·아바타 기억 (design-final §4 플로우C)
 * - localStorage 영속화 (zustand/middleware persist)
 */
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ArtStyleKey, AvatarConfig } from "@/lib/contract";
import { DEFAULT_ART_STYLE, DEFAULT_AVATAR } from "@/lib/constants";

interface DiaryDraftState {
  /** 현재 작성 중인 일기 텍스트 (임시) */
  text: string;
  /** 마지막으로 선택한 화풍 (재방문 시 기억) */
  artStyle: ArtStyleKey;
  /** 마지막으로 설정한 아바타 (재방문 시 기억) */
  avatar: AvatarConfig;

  /* 액션 */
  setText: (text: string) => void;
  setArtStyle: (artStyle: ArtStyleKey) => void;
  setAvatar: (avatar: AvatarConfig) => void;
  /** 생성 시작 후 텍스트만 초기화 (화풍/아바타는 기억 유지) */
  clearText: () => void;
  /** 전체 초기화 */
  reset: () => void;
}

const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  ...DEFAULT_AVATAR,
  seed: Math.floor(Math.random() * 2147483647),
};

export const useDiaryDraftStore = create<DiaryDraftState>()(
  persist(
    (set) => ({
      text: "",
      artStyle: DEFAULT_ART_STYLE,
      avatar: DEFAULT_AVATAR_CONFIG,

      setText: (text) => set({ text }),
      setArtStyle: (artStyle) => set({ artStyle }),
      setAvatar: (avatar) => set({ avatar }),
      clearText: () => set({ text: "" }),
      reset: () =>
        set({
          text: "",
          artStyle: DEFAULT_ART_STYLE,
          avatar: DEFAULT_AVATAR_CONFIG,
        }),
    }),
    {
      name: "toonlog-diary-draft",
      // 화풍·아바타만 영속화 (텍스트는 앱 재시작 시 초기화)
      partialize: (state) => ({
        artStyle: state.artStyle,
        avatar: state.avatar,
      }),
    }
  )
);
