import type { Config } from "tailwindcss";

/**
 * 오름(Oreum) Tailwind 설정
 * design-final.md C1(친구 민트 #3DBE9C) + C2(관계 #C7307D) 반영
 * ui-spec.md §9 기반 확장
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary — 딥 네이비 10단계
        primary: {
          50: "#E8EBF2",
          100: "#C6CDE2",
          200: "#9FAECF",
          300: "#788FBC",
          400: "#5170A9",
          500: "#2A5196",
          600: "#1E3D75",
          700: "#152E5A",
          800: "#0F1B3D",
          900: "#080E20",
          DEFAULT: "#0F1B3D",
        },
        // Accent — 선라이즈 오렌지
        accent: {
          50: "#FFF3EB",
          100: "#FFE0C7",
          200: "#FFC89E",
          300: "#FFB075",
          400: "#FF984C",
          500: "#FF7A29",
          600: "#E0621A",
          700: "#B54C10",
          800: "#8A3608",
          900: "#5F2104",
          DEFAULT: "#FF7A29",
        },
        // 4축 컬러 — design-final.md C2 반영 (관계 마젠타)
        health: {
          50: "#E8F5EC",
          300: "#6CC889",
          500: "#2E9E55",
          700: "#1A5E31",
        },
        learn: {
          50: "#E8F0FA",
          300: "#6699E0",
          500: "#2563EB",
          700: "#1A3D8F",
        },
        // C2: #D63384 → #C7307D (로즈 마젠타로 미세조정)
        relate: {
          50: "#FDE8F2",
          300: "#E070B0",
          500: "#C7307D",
          700: "#871C53",
        },
        achieve: {
          50: "#FEF9E0",
          300: "#F5D85A",
          500: "#EAB308",
          700: "#8A6D00",
        },
        // Semantic 컬러
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
        // 브랜드 시그니처 — 빨간펜(채점·검증·강조). 동그라미/검증 도장/D-day 카운트다운 공통 액센트.
        redpen: {
          DEFAULT: "#DC2626",
          soft: "#FEF2F2",
        },
        info: {
          DEFAULT: "#2563EB",
          bg: "#E8F0FA",
          text: "#1A3D8F",
        },
        // Surface
        surface: {
          bg: "#F9FAFB",
          card: "#FFFFFF",
          elevated: "#FFFFFF",
          overlay: "rgba(0,0,0,0.48)",
        },
        // 페르소나 Accent (design-final.md C1 반영)
        persona: {
          "mentor-accent": "#FF7A29",
          "sparta-accent": "#FF4D00",
          "friend-accent": "#3DBE9C", // C1: 민트 그린
        },
      },
      fontFamily: {
        sans: ["Pretendard Variable", "Pretendard", "system-ui", "sans-serif"],
        serif: ['"Crimson Pro"', '"Gowun Batang"', "Georgia", "serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        display: ["48px", { lineHeight: "1.2", fontWeight: "800", letterSpacing: "-0.02em" }],
        h1: ["32px", { lineHeight: "1.3", fontWeight: "700", letterSpacing: "-0.01em" }],
        h2: ["24px", { lineHeight: "1.4", fontWeight: "700", letterSpacing: "0" }],
        h3: ["20px", { lineHeight: "1.4", fontWeight: "600", letterSpacing: "0" }],
        h4: ["17px", { lineHeight: "1.5", fontWeight: "600", letterSpacing: "0" }],
        "body-l": ["16px", { lineHeight: "1.6", fontWeight: "400", letterSpacing: "0.01em" }],
        "body-m": ["15px", { lineHeight: "1.6", fontWeight: "400", letterSpacing: "0.01em" }],
        "body-s": ["14px", { lineHeight: "1.6", fontWeight: "400", letterSpacing: "0.01em" }],
        caption: ["12px", { lineHeight: "1.5", fontWeight: "400", letterSpacing: "0.02em" }],
        label: ["13px", { lineHeight: "1.4", fontWeight: "500", letterSpacing: "0.04em" }],
      },
      spacing: {
        "screen-x": "20px",
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        full: "9999px",
      },
      boxShadow: {
        sm: "0 1px 3px rgba(15,27,61,0.08)",
        md: "0 4px 12px rgba(15,27,61,0.12)",
        lg: "0 8px 24px rgba(15,27,61,0.18)",
      },
      transitionDuration: {
        fast: "150ms",
        base: "250ms",
        slow: "400ms",
      },
      transitionTimingFunction: {
        "motion-base": "cubic-bezier(0.4,0,0.2,1)",
        "motion-slow": "cubic-bezier(0.25,0.46,0.45,0.94)",
        "motion-spring": "cubic-bezier(0.34,1.56,0.64,1)",
      },
      maxWidth: {
        mobile: "375px",
        content: "335px",
        desktop: "1200px",
      },
    },
  },
  plugins: [],
};

export default config;
