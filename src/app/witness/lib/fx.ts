/**
 * 연출 타임라인 상수 · 진동 패턴 — 디자인 확정본 §6-1·6-2·6-3. witness.css 의 모션 토큰(--wt-dur-*)과 같은 값으로 유지한다.
 * 모든 시간은 fxMs() 를 거친다: 기본 ×1 · 짧게 ×0.5 · 줄이기 ×0.6(컷인은 페이드 한 번이라 별도 키프레임).
 * fxConfig.scale 은 테스트가 0 으로 내려 연출을 건너뛰는 용도다(실서비스에서는 1).
 */
export type FxMode = 'full' | 'short' | 'reduced';

export const fxConfig = { scale: 1 };

export function fxMs(base: number, mode: FxMode): number {
  const k = mode === 'short' ? 0.5 : mode === 'reduced' ? 0.6 : 1;
  return Math.round(base * k * fxConfig.scale);
}

/** 기본(full) 모드 기준 길이(ms) */
export const T = {
  sheetClose: 180,
  cutPress: 350,
  cutPresent: 450,
  flyCard: 250,
  /** ★ 돌파: 번쩍·균열·스트립·쾅까지 */
  breakStar: 1100,
  /** ★ 도장 + 신뢰 스윕 */
  stampStar: 900,
  breakMinor: 800,
  half: 600,
  redirect: 450,
  wrong: 800,
  panRail: 220,
  toastShort: 1600,
  toastLong: 3200,
  toastSiren: 4000,
  /** 최종 판정: 칸당 쾅 */
  verdictSlot: 1000,
  verdictBlack: 500,
} as const;

/** 진동 패턴(ms) — 지원 기기 + 설정 켬일 때만 */
export const VIB = {
  tap: 10,
  action3: [30],
  siren: [200, 100, 200],
  trustDown: [50, 40, 50],
  trustZero: [80, 40, 80],
  star: [30, 40, 60],
  star3: [30, 40, 60, 40, 90],
  minor: [30, 40],
  half: [20],
  upgrade: [40],
  verdictOk: [30, 40, 60],
  verdictNg: [50, 40, 50],
} as const;

export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function vibrate(enabled: boolean, pattern: number | readonly number[]): void {
  if (!enabled || !canVibrate()) return;
  try {
    navigator.vibrate(typeof pattern === 'number' ? pattern : [...pattern]);
  } catch {
    /* 일부 브라우저는 사용자 제스처 밖 호출을 막는다 */
  }
}

/** 글자 간격(ms) — 보통 28(≈36자/초) · 빠름 12(≈80자/초) · 즉시 0 */
export const TYPE_MS = { normal: 28, fast: 12, instant: 0 } as const;
/** 줄당 상한 */
export const TYPE_CAP_MS = 1400;
/** 문장부호 멈춤(ms, 보통 기준. 빠름은 절반) */
export const TYPE_PAUSE: Readonly<Record<string, number>> = { '…': 160, '.': 90, '?': 90, '!': 90, ',': 40 };
/** 길게 누르기 */
export const LONG_PRESS_MS = 450;
