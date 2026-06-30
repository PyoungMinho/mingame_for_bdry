/**
 * 오름(Oreum) 컬러 토큰
 * 출처: design-final.md C1(친구 민트), C2(관계 마젠타) 반영
 * ui-spec.md §1-1 기반
 */

// REDLINE: 외모/체형 비교 UI 금지. 타인 점수 노출 금지.

export const colors = {
  // ── Primary — 딥 네이비 10단계 ──
  primary: {
    50: "#E8EBF2",
    100: "#C6CDE2",
    200: "#9FAECF",
    300: "#788FBC",
    400: "#5170A9",
    500: "#2A5196",
    600: "#1E3D75",
    700: "#152E5A",
    800: "#0F1B3D", // 브랜드 기본값
    900: "#080E20",
  },

  // ── Accent — 선라이즈 오렌지 ──
  accent: {
    50: "#FFF3EB",
    100: "#FFE0C7",
    200: "#FFC89E",
    300: "#FFB075",
    400: "#FF984C",
    500: "#FF7A29", // 핵심 강조
    600: "#E0621A",
    700: "#B54C10",
    800: "#8A3608",
    900: "#5F2104",
  },

  // ── 4축 컬러 — 색약 대응 (컬러+모양+레이블 3중 표기 필수) ──
  health: {
    50: "#E8F5EC",
    300: "#6CC889",
    500: "#2E9E55", // 건강 기본
    700: "#1A5E31",
  },
  learn: {
    50: "#E8F0FA",
    300: "#6699E0",
    500: "#2563EB", // 학습 기본
    700: "#1A3D8F",
  },
  // C2: #D63384 → #C7307D (로즈 마젠타 미세조정, 오렌지와 시각 거리 확보)
  relate: {
    50: "#FDE8F2",
    300: "#E070B0",
    500: "#C7307D", // 관계 기본
    700: "#871C53",
  },
  achieve: {
    50: "#FEF9E0",
    300: "#F5D85A",
    500: "#EAB308", // 성취 기본
    700: "#8A6D00",
  },

  // ── Semantic ──
  success: {
    DEFAULT: "#2E9E55",
    bg: "#E8F5EC",
    text: "#1A5E31",
  },
  warning: {
    DEFAULT: "#EAB308",
    bg: "#FEF9E0",
    text: "#6B5900",
  },
  error: {
    DEFAULT: "#DC2626",
    bg: "#FDE8E8",
    text: "#7A1A1A",
  },
  info: {
    DEFAULT: "#2563EB",
    bg: "#E8F0FA",
    text: "#1A3D8F",
  },

  // ── Neutral — Gray 스케일 ──
  gray: {
    50: "#F9FAFB",
    100: "#F3F4F6",
    200: "#E5E7EB",
    300: "#D1D5DB",
    400: "#9CA3AF",
    500: "#6B7280",
    600: "#4B5563",
    700: "#374151",
    800: "#1F2937",
    900: "#111827",
  },

  // ── Surface ──
  surface: {
    bg: "#F9FAFB",
    card: "#FFFFFF",
    elevated: "#FFFFFF",
    overlay: "rgba(0,0,0,0.48)",
    overlayDark: "rgba(0,0,0,0.64)",
  },

  // ── 페르소나 3종 Accent (design-final.md C1 반영) ──
  persona: {
    mentor: {
      primary: "#0F1B3D",
      accent: "#FF7A29",
      surfaceBg: "#FFF8F4",
    },
    spartan: {
      primary: "#0A1528",
      accent: "#FF4D00",
      surfaceBg: "#F7F8FA",
    },
    // C1: 친구 동료 = 민트 그린 (오렌지 계열 기각)
    friend: {
      primary: "#1A3060",
      accent: "#3DBE9C",
      surfaceBg: "#FFFBF7",
    },
  },
} as const;

/** 4축 컬러 맵 — checkin-slider, mountain-chart 등에서 사용 */
export const axisColors = {
  health: colors.health[500],
  learn: colors.learn[500],
  relate: colors.relate[500],
  achieve: colors.achieve[500],
} as const;

export type AxisKey = keyof typeof axisColors;
export type PersonaKey = keyof typeof colors.persona;
