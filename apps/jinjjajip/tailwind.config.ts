import type { Config } from "tailwindcss";

/**
 * 진짜집(Jinjjajip) Tailwind 설정 — 격리 앱.
 * docs/design/real-estate-design-final.md §3 토큰 최종본을 verbatim 채택.
 * 모든 진짜집 토큰은 realestate.* 네임스페이스로 격리(디자인 §10.1 제약 준수).
 * 오름(Oreum)/tier-gg 앱과 완전 분리되어 서로 영향 없음.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        realestate: {
          brand: {
            primary: "#1C1917", // 웜 차콜 — 신뢰·절제 (Primary CTA, 포커스 링) [에디토리얼 럭셔리 리스킨]
            sub: "#8C6A1A", // 딥 브론즈골드 — 링크·강조 (Gold 배지와 동계열로 통일)
            "primary-light": "#EDEBE7", // 웜 라이트 스톤
            "sub-light": "#F5EFE2", // 웜 골드 틴트
          },
          trust: {
            // 신뢰 등급 (색+형태 이중 코드화 핵심)
            gold: "#B8860B",
            "gold-bg": "#FEF7E0",
            "gold-border": "#E6C547",
            silver: "#5B6F7A", // [D2] 슬레이트 확정 (노랑 폐기)
            "silver-bg": "#EEF2F4",
            "silver-border": "#9EB2BC",
            unverified: "#6B7280", // [D4] 도넛 아크도 이 값으로 통일
            "unverified-bg": "#F3F4F6",
            "unverified-border": "#D1D5DB",
          },
          amber: {
            warn: "#B45309",
            "warn-bg": "#FFFBEB",
            "warn-border": "#FCD34D",
            "warn-light": "#FEF3C7",
          },
          state: {
            pending: "#6B7280",
            "pending-bg": "#F9FAFB",
            processing: "#2563EB",
            "processing-bg": "#EFF6FF",
            reported: "#DC2626",
            "reported-bg": "#FEF2F2",
            complete: "#2E9E55", // 스텝퍼 "완료" 그린 (디자인 §3 health.500 재사용)
            "complete-bg": "#E8F5EC",
          },
          neutral: {
            // 웜 스톤 스케일 — 에디토리얼 럭셔리 리스킨(크림/차콜). 본문 대비 WCAG AA 검증 완료.
            950: "#0C0A09",
            900: "#1C1917", // 헤딩·강조 (brand.primary와 동일 차콜로 통일)
            700: "#44403C", // 본문 기본 (cream 위 ≈9.4:1)
            600: "#57534E", // 서브라벨 (cream 위 ≈7.3:1) — 신규 추가
            500: "#78716C", // 보조·뮤트 캡션 (cream 위 ≈4.7:1, AA)
            400: "#A8A29E", // 보더·장식 아이콘·비활성 (본문 텍스트용 아님) — 신규 추가
            300: "#D6D3D1", // 디바이더
            200: "#E7E5E4", // 보더·카드 외곽·트랙
            100: "#F5F4F1", // 호버·섹션 보조면
            50: "#FAF9F7", // 웜 크림 (본문 배경)
          },
        },
      },
      fontFamily: {
        sans: ["Pretendard Variable", "Pretendard", "system-ui", "sans-serif"],
        // 디스플레이 세리프 — Hahmlet(한글+라틴 지원). 헤드라인·가격·신뢰점수 등 대형 타이포 전용.
        serif: ["Hahmlet", "Pretendard Variable", "Georgia", "serif"],
      },
      fontSize: {
        "trust-label": ["13px", { lineHeight: "1.3", fontWeight: "600", letterSpacing: "0.02em" }],
        "trust-score": ["22px", { lineHeight: "1.0", fontWeight: "700", letterSpacing: "-0.01em" }],
        "trust-desc": ["12px", { lineHeight: "1.4", fontWeight: "400", letterSpacing: "0.01em" }],
        price: ["20px", { lineHeight: "1.2", fontWeight: "700", letterSpacing: "-0.01em" }],
        h1: ["28px", { lineHeight: "1.3", fontWeight: "700", letterSpacing: "-0.01em" }],
        h2: ["22px", { lineHeight: "1.4", fontWeight: "700" }],
        h3: ["18px", { lineHeight: "1.4", fontWeight: "600" }],
        "body-l": ["16px", { lineHeight: "1.6", fontWeight: "400" }],
        "body-m": ["15px", { lineHeight: "1.6", fontWeight: "400" }],
        "body-s": ["14px", { lineHeight: "1.6", fontWeight: "400" }],
        caption: ["12px", { lineHeight: "1.5", fontWeight: "400" }],
        label: ["13px", { lineHeight: "1.4", fontWeight: "500", letterSpacing: "0.02em" }],
      },
      spacing: {
        "card-pad": "16px",
        "card-gap": "12px",
        "badge-pad-x": "8px",
        "badge-pad-y": "4px",
        "section-gap": "24px",
        "score-gap": "6px",
        "screen-x": "20px",
      },
      borderRadius: {
        badge: "6px",
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        full: "9999px",
      },
      boxShadow: {
        // 웜 차콜 그림자 — 에디토리얼 카드가 크림 배경 위에 은은히 떠 보이게(절제된 깊이)
        "card-trust": "0 1px 3px rgba(28,25,23,0.06), 0 6px 16px rgba(28,25,23,0.05)",
        "badge-gold": "0 1px 4px rgba(184,134,11,0.25)",
        sm: "0 1px 3px rgba(28,25,23,0.06)",
        md: "0 4px 12px rgba(28,25,23,0.08)",
        lg: "0 8px 24px rgba(28,25,23,0.12)",
      },
      maxWidth: {
        mobile: "375px",
        content: "640px",
        desktop: "1200px",
      },
      transitionTimingFunction: {
        "motion-base": "cubic-bezier(0.4,0,0.2,1)",
        "motion-spring": "cubic-bezier(0.34,1.56,0.64,1)",
      },
    },
  },
  plugins: [],
};

export default config;
