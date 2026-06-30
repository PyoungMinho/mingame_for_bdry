/**
 * 오름(Oreum) 페르소나 3종 토큰
 * 출처: design-final.md C1 (친구 민트 #3DBE9C) + ui-spec.md §2
 * Q2 사장 확정: 3종 동시 출시, 컬러 토큰 + 프롬프트 톤만 차별화
 */

// REDLINE: 외모/체형 비교 UI 금지. 타인 점수 노출 금지.

export const PERSONA_KEYS = ["mentor", "spartan", "friend"] as const;
export type PersonaKey = (typeof PERSONA_KEYS)[number];

export interface PersonaConfig {
  key: PersonaKey;
  label: string;
  primaryColor: string;
  accentColor: string;
  surfaceBg: string;
  /** 코치챗 버블 강조색 */
  bubbleAccent: string;
  /** html[data-persona] 값 */
  dataAttr: string;
  /** 분위기 설명 (UI 레이블용) */
  mood: string;
}

export const personaConfig: Record<PersonaKey, PersonaConfig> = {
  mentor: {
    key: "mentor",
    label: "따뜻한 멘토",
    primaryColor: "#0F1B3D",
    accentColor: "#FF7A29",
    surfaceBg: "#FFF8F4",
    bubbleAccent: "#FF7A29",
    dataAttr: "mentor",
    mood: "안정·신뢰·따뜻함",
  },
  spartan: {
    key: "spartan",
    label: "스파르타",
    primaryColor: "#0A1528",
    accentColor: "#FF4D00",
    surfaceBg: "#F7F8FA",
    bubbleAccent: "#FF4D00",
    dataAttr: "spartan",
    mood: "강렬·각성·도전",
  },
  // C1 결정: 친구 동료 = 민트 그린 #3DBE9C (오렌지 계열 기각)
  friend: {
    key: "friend",
    label: "친구 동료",
    primaryColor: "#1A3060",
    accentColor: "#3DBE9C",
    surfaceBg: "#FFFBF7",
    bubbleAccent: "#3DBE9C",
    dataAttr: "friend",
    mood: "캐주얼·밝음·에너지",
  },
} as const;

/**
 * persona key → CSS data-attribute 변경
 * Zustand personaStore에서 호출 예정 (페이지개발자 담당)
 */
export function applyPersona(key: PersonaKey): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-persona", key);
}
