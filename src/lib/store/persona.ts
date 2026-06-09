// REDLINE: 타인 비교/외모 점수 UI 금지
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Persona } from "@/lib/shared/schemas";

// ---------------------------------------------------------------------------
// 페르소나 메타데이터 (디자인 최종안 반영)
// ---------------------------------------------------------------------------

export interface PersonaMeta {
  id: Persona;
  displayName: string;
  coachName: string;
  /** 2~3단어 성격 요약 */
  tagline: string;
  /** Tailwind bg 클래스 — data-persona 속성 기반 테마 전환용 */
  accentColor: string;
  /** 격려 문구 예시 (온보딩 카드 표시용) */
  exampleMessage: string;
}

export const PERSONA_META: Record<Persona, PersonaMeta> = {
  mentor: {
    id: "mentor",
    displayName: "따뜻한 멘토",
    coachName: "지수 코치",
    tagline: "따뜻하고 세심하게",
    accentColor: "#FF7A29",
    exampleMessage: "오늘도 잘 해내셨어요. 작은 노력이 모여 큰 변화가 됩니다.",
  },
  spartan: {
    id: "spartan",
    displayName: "스파르타",
    coachName: "강 코치",
    tagline: "명확하고 단호하게",
    accentColor: "#FF4D00",
    exampleMessage: "오늘 목표 달성률 60%. 내일은 70%를 목표로 하세요.",
  },
  friend: {
    id: "friend",
    displayName: "친구 동료",
    coachName: "민 코치",
    tagline: "가볍고 편안하게",
    accentColor: "#3DBE9C",
    exampleMessage: "오늘 어땠어? 힘들었으면 얘기해~",
  },
};

// ---------------------------------------------------------------------------
// 스토어
// ---------------------------------------------------------------------------

interface PersonaState {
  selected: Persona;
}

interface PersonaActions {
  setPersona: (persona: Persona) => void;
}

export const usePersonaStore = create<PersonaState & PersonaActions>()(
  persist(
    (set) => ({
      selected: "mentor" as Persona,
      setPersona: (persona) => set({ selected: persona }),
    }),
    {
      name: "oreum-persona",
    }
  )
);

// ---------------------------------------------------------------------------
// 셀렉터
// ---------------------------------------------------------------------------

export const selectPersona = (s: PersonaState & PersonaActions) => s.selected;
export const selectPersonaMeta = (s: PersonaState & PersonaActions) =>
  PERSONA_META[s.selected];
