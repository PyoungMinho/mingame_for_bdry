// REDLINE: 타인 비교/외모 점수 UI 금지
import { create } from "zustand";
import type { CheckinResponse, ScoreSnapshot, ScoreDelta } from "@/lib/shared/schemas";

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

/** 4축 슬라이더 임시 값 (0~100) */
export interface CheckinDraft {
  health: number;
  learning: number;
  relation: number;
  achievement: number;
}

/** 체크인 완료 후 결과 카드 표시용 */
export interface CheckinResult {
  score: ScoreSnapshot;
  delta: ScoreDelta;
  streak: CheckinResponse["streak"];
  missionTitle: string;
}

interface CheckinState {
  /** 슬라이더 임시 상태 (제출 전) */
  draft: CheckinDraft;
  /** 오늘 체크인 완료 여부 */
  hasCheckedInToday: boolean;
  /** 마지막 체크인 결과 — Home 점수 카드에 표시 */
  lastResult: CheckinResult | null;
  /** 제출 중 여부 */
  isSubmitting: boolean;
}

interface CheckinActions {
  setDraftAxis: (axis: keyof CheckinDraft, value: number) => void;
  setDraftAll: (draft: CheckinDraft) => void;
  resetDraft: () => void;
  setCheckedInToday: (done: boolean) => void;
  setLastResult: (result: CheckinResult) => void;
  setSubmitting: (submitting: boolean) => void;
}

// ---------------------------------------------------------------------------
// 초기 상태
// ---------------------------------------------------------------------------

const DEFAULT_DRAFT: CheckinDraft = {
  health: 50,
  learning: 50,
  relation: 50,
  achievement: 50,
};

// ---------------------------------------------------------------------------
// 스토어
// ---------------------------------------------------------------------------

export const useCheckinStore = create<CheckinState & CheckinActions>()((set) => ({
  draft: { ...DEFAULT_DRAFT },
  hasCheckedInToday: false,
  lastResult: null,
  isSubmitting: false,

  setDraftAxis: (axis, value) =>
    set((state) => ({ draft: { ...state.draft, [axis]: value } })),

  setDraftAll: (draft) => set({ draft }),

  resetDraft: () => set({ draft: { ...DEFAULT_DRAFT } }),

  setCheckedInToday: (done) => set({ hasCheckedInToday: done }),

  setLastResult: (result) => set({ lastResult: result }),

  setSubmitting: (submitting) => set({ isSubmitting: submitting }),
}));

// ---------------------------------------------------------------------------
// 셀렉터
// ---------------------------------------------------------------------------

export const selectDraft = (s: CheckinState & CheckinActions) => s.draft;
export const selectHasCheckedIn = (s: CheckinState & CheckinActions) => s.hasCheckedInToday;
export const selectLastResult = (s: CheckinState & CheckinActions) => s.lastResult;
export const selectIsSubmitting = (s: CheckinState & CheckinActions) => s.isSubmitting;
