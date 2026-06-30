/**
 * 오름(Oreum) 타이포그래피 토큰
 * 출처: ui-spec.md §1-2 — Pretendard Variable 스케일
 */

// REDLINE: 외모/체형 비교 UI 금지. 타인 점수 노출 금지.

export const typography = {
  fontFamily: {
    sans: ["Pretendard Variable", "Pretendard", "system-ui", "sans-serif"],
  },

  /** 폰트 스케일 — size/lineHeight/weight/letterSpacing */
  scale: {
    display: {
      fontSize: "48px",
      lineHeight: "1.2",
      fontWeight: "800",
      letterSpacing: "-0.02em",
    },
    h1: {
      fontSize: "32px",
      lineHeight: "1.3",
      fontWeight: "700",
      letterSpacing: "-0.01em",
    },
    h2: {
      fontSize: "24px",
      lineHeight: "1.4",
      fontWeight: "700",
      letterSpacing: "0",
    },
    h3: {
      fontSize: "20px",
      lineHeight: "1.4",
      fontWeight: "600",
      letterSpacing: "0",
    },
    h4: {
      fontSize: "17px",
      lineHeight: "1.5",
      fontWeight: "600",
      letterSpacing: "0",
    },
    "body-l": {
      fontSize: "16px",
      lineHeight: "1.6",
      fontWeight: "400",
      letterSpacing: "0.01em",
    },
    "body-m": {
      fontSize: "15px",
      lineHeight: "1.6",
      fontWeight: "400",
      letterSpacing: "0.01em",
    },
    "body-s": {
      fontSize: "14px",
      lineHeight: "1.6",
      fontWeight: "400",
      letterSpacing: "0.01em",
    },
    caption: {
      fontSize: "12px",
      lineHeight: "1.5",
      fontWeight: "400",
      letterSpacing: "0.02em",
    },
    label: {
      fontSize: "13px",
      lineHeight: "1.4",
      fontWeight: "500",
      letterSpacing: "0.04em",
    },
  },
} as const;

export type TypographyScaleKey = keyof typeof typography.scale;
