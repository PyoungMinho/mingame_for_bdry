// REDLINE: 타인 비교/외모 점수 UI 금지
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MeResponse, SubscriptionTier, Persona } from "@/lib/shared/schemas";

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
  nickname: string | null;
  createdAt: string;
  persona: Persona;
  northStarStatement: string | null;
  isAgeBlocked: boolean;
  subscription: {
    tier: SubscriptionTier;
    expiresAt: string | null;
    coachFreeUntil: string | null;
    isCoachFreeActive: boolean;
  };
  aiBudgetUsageRatio: number;
}

interface AuthState {
  user: AuthUser | null;
  /** Supabase JWT — localStorage에 직접 저장하지 않음. 메모리 캐시 */
  accessToken: string | null;
  isLoading: boolean;
  /** 온보딩 완료 여부 (로컬 체크) */
  onboardingDone: boolean;
}

interface AuthActions {
  setUser: (user: MeResponse) => void;
  setAccessToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setOnboardingDone: (done: boolean) => void;
  clearAuth: () => void;
  /** persona 변경 — 드로어 > 페르소나 변경 */
  setPersona: (persona: Persona) => void;
}

// ---------------------------------------------------------------------------
// 초기 상태
// ---------------------------------------------------------------------------

const INITIAL_STATE: AuthState = {
  user: null,
  accessToken: null,
  isLoading: true,
  onboardingDone: false,
};

// ---------------------------------------------------------------------------
// 스토어
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      setUser: (meResponse: MeResponse) =>
        set({
          user: {
            id: meResponse.id,
            email: meResponse.email,
            nickname: meResponse.nickname,
            createdAt: meResponse.createdAt,
            persona: meResponse.persona,
            northStarStatement: meResponse.northStarStatement,
            isAgeBlocked: meResponse.isAgeBlocked,
            subscription: meResponse.subscription,
            aiBudgetUsageRatio: meResponse.aiBudgetUsageRatio,
          },
        }),

      setAccessToken: (token) => set({ accessToken: token }),

      setLoading: (loading) => set({ isLoading: loading }),

      setOnboardingDone: (done) => set({ onboardingDone: done }),

      clearAuth: () =>
        set({
          user: null,
          accessToken: null,
          onboardingDone: false,
          isLoading: false,
        }),

      setPersona: (persona) =>
        set((state) => ({
          user: state.user ? { ...state.user, persona } : null,
        })),
    }),
    {
      name: "oreum-auth",
      // accessToken은 persist 제외 (보안)
      partialize: (state) => ({
        onboardingDone: state.onboardingDone,
        user: state.user
          ? {
              ...state.user,
              // aiBudgetUsageRatio는 항상 서버에서 최신 값으로 갱신
              aiBudgetUsageRatio: 0,
            }
          : null,
      }),
    }
  )
);

// ---------------------------------------------------------------------------
// 셀렉터 (리렌더링 최소화)
// ---------------------------------------------------------------------------

export const selectUser = (s: AuthState & AuthActions) => s.user;
export const selectIsLoading = (s: AuthState & AuthActions) => s.isLoading;
export const selectOnboardingDone = (s: AuthState & AuthActions) => s.onboardingDone;
export const selectIsProUser = (s: AuthState & AuthActions) =>
  s.user?.subscription.tier === "pro";
export const selectIsCoachFreeActive = (s: AuthState & AuthActions) =>
  s.user?.subscription.isCoachFreeActive ?? false;
