/**
 * 생성 상태 스토어 — SSE 스트리밍 진행 상태 + 완성 컷 누적.
 * S4 생성대기 화면에서 사용.
 */
"use client";

import { create } from "zustand";
import type { Panel, JobStage, GenerationErrorCode } from "@/lib/contract";

interface GenerationState {
  jobId: string | null;
  diaryId: string | null;
  stage: JobStage | null;
  completedPanels: number;
  panels: Panel[]; // 완성된 컷 목록 (1컷 도착할 때마다 push)
  currentTip: string | null;
  error: { code: GenerationErrorCode; message: string; retryable: boolean } | null;
  isDone: boolean;

  /* SSE 수신 액션 */
  setStage: (stage: JobStage) => void;
  addPanel: (panel: Panel) => void;
  setProgress: (completed: number) => void;
  setTip: (tip: string) => void;
  setDone: (panels: Panel[]) => void;
  setError: (code: GenerationErrorCode, message: string, retryable: boolean) => void;
  /** 새 생성 시작 시 초기화 */
  init: (jobId: string, diaryId: string) => void;
  reset: () => void;
}

export const useGenerationStore = create<GenerationState>((set) => ({
  jobId: null,
  diaryId: null,
  stage: null,
  completedPanels: 0,
  panels: [],
  currentTip: null,
  error: null,
  isDone: false,

  setStage: (stage) => set({ stage }),
  addPanel: (panel) =>
    set((s) => ({
      panels: [...s.panels.filter((p) => p.index !== panel.index), panel].sort(
        (a, b) => a.index - b.index
      ),
    })),
  setProgress: (completedPanels) => set({ completedPanels }),
  setTip: (tip) => set({ currentTip: tip }),
  setDone: (panels) =>
    set({ panels, completedPanels: 4, isDone: true, stage: "finalizing" }),
  setError: (code, message, retryable) =>
    set({ error: { code, message, retryable } }),
  init: (jobId, diaryId) =>
    set({
      jobId,
      diaryId,
      stage: "queued",
      completedPanels: 0,
      panels: [],
      currentTip: null,
      error: null,
      isDone: false,
    }),
  reset: () =>
    set({
      jobId: null,
      diaryId: null,
      stage: null,
      completedPanels: 0,
      panels: [],
      currentTip: null,
      error: null,
      isDone: false,
    }),
}));
