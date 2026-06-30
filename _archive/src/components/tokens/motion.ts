/**
 * 오름(Oreum) 모션 토큰
 * 출처: ui-spec.md §1-3 + §4 시그니처 모션 스펙
 * Framer Motion variants 포함
 */

// REDLINE: 외모/체형 비교 UI 금지. 타인 점수 노출 금지.

export const motion = {
  duration: {
    fast: 0.15,   // 150ms — 탭 피드백, 호버
    base: 0.25,   // 250ms — 페르소나 전환, 토스트
    slow: 0.4,    // 400ms — 바텀시트, 모달
    scoreCountup: 0.6,   // 600ms — 점수 카운트업
    lineDrawing: 1.2,    // 1200ms — 산 능선 드로우
  },

  easing: {
    fast: [0, 0, 0.2, 1] as [number, number, number, number],       // ease-out
    base: [0.4, 0, 0.2, 1] as [number, number, number, number],     // standard
    slow: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number], // decelerate
    spring: [0.34, 1.56, 0.64, 1] as [number, number, number, number],  // 버튼 스프링
    lineDrawing: [0.42, 0, 0.18, 1.0] as [number, number, number, number], // 능선 드로우
  },

  /** CSS cubic-bezier 문자열 */
  cssEasing: {
    fast: "cubic-bezier(0, 0, 0.2, 1)",
    base: "cubic-bezier(0.4, 0, 0.2, 1)",
    slow: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    lineDrawing: "cubic-bezier(0.42, 0, 0.18, 1.0)",
    scoreCountup: "cubic-bezier(0, 0, 0.2, 1)", // ease-out (score countup)
  },
} as const;

/** Framer Motion variants — 페이지/컴포넌트 공용 */
export const variants = {
  /** 바텀시트 진입 */
  bottomSheet: {
    hidden: { y: "100%", opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: motion.duration.slow,
        ease: motion.easing.slow,
      },
    },
    exit: {
      y: "100%",
      opacity: 0,
      transition: {
        duration: motion.duration.base,
        ease: motion.easing.fast,
      },
    },
  },

  /** 토스트 슬라이드다운 */
  toast: {
    hidden: { y: -20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: motion.duration.base,
        ease: motion.easing.base,
      },
    },
    exit: {
      y: -20,
      opacity: 0,
      transition: {
        duration: motion.duration.fast,
        ease: motion.easing.fast,
      },
    },
  },

  /** 변화량 수치 페이드인 (score-display) */
  delta: {
    hidden: { y: 4, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        delay: 0.7, // 카운트업(0.6s) 완료 후 100ms 딜레이
        duration: 0.2,
        ease: motion.easing.fast,
      },
    },
  },

  /** 버튼 스프링 누름 */
  buttonPress: {
    tap: {
      scale: 0.97,
      transition: { duration: 0.1, ease: motion.easing.fast },
    },
  },
} as const;
