/**
 * 「목격자는 AI」 그림 전용 팔레트 · SVG id 범위 · 결정론 난수.
 *
 *  - 하드코딩 hex 는 SVG 그림에만 쓴다(디자인 확정본 §4-1). 텍스트·UI 색은 witness.css 의 --wt-* 토큰을 쓴다.
 *  - 용의자 4명은 같은 채도·같은 조명으로 칠한다(메타 추리 방지, UI 스펙 6-1). 화자 색은 역광에만 쓴다.
 *  - 엔진·사건 데이터 import 없음(타입 import 만 허용).
 */
import { useId } from 'react';

/** 공통 빛·밤 톤(장면·초상 공용) */
export const C = {
  /* 밤 */
  ink: '#060913',
  night0: '#0B1426',
  night1: '#12203C',
  night2: '#1B2E52',
  night3: '#243A66',
  /* 네온 원색(--wt-* 와 같은 값) */
  cyan: '#3DE0F7',
  amber: '#FFB84A',
  pink: '#FF4D94',
  red: '#FF5A5F',
  violet: '#A98BFF',
  green: '#5BE3A0',
  gold: '#FFD76A',
  yellow: '#FFD23F',
  white: '#FFFFFF',
  /* 실내 */
  wall0: '#0E1528',
  wall1: '#151E36',
  wall2: '#1C2744',
  wall3: '#26345A',
  walnut0: '#1C1411',
  walnut1: '#2A1F1A',
  walnut2: '#3A2B22',
  walnut3: '#4E3A2C',
  oak1: '#5A4030',
  oak2: '#7A5838',
  oak3: '#9A7449',
  steel0: '#3A4256',
  steel1: '#58627A',
  steel2: '#8592AC',
  steel3: '#C3CCDD',
  sofa0: '#383F50',
  sofa1: '#4A5266',
  sofa2: '#5C657C',
  marble: '#D8DCE6',
  marbleShade: '#AEB4C2',
  cloth: '#E9ECF2',
  clothShade: '#BCC2D0',
  chalk: '#F4F7FF',
  graphite0: '#1E2540',
  graphite1: '#2A3350',
  graphite2: '#3B4870',
  graphite3: '#56658F',
  glass: '#9FD6FF',
  plant0: '#173A33',
  plant1: '#22574A',
  plant2: '#2F7563',
} as const;

/** 초상 공통 — 피부 2톤 · 머리색 · 림/키 라이트(UI 스펙 6-1) */
export const SKIN = {
  light: ['#F3CDAA', '#D8A47C'] as const,
  mid: ['#E5B58C', '#BE8A62'] as const,
};
export const HAIR = {
  black: '#1B1B26',
  brown: '#2E2220',
  gray: '#5B5F70',
  grayHi: '#8C90A0',
};
/** 화자 색 — 역광 타원 전용(--wt-spk-*) */
export const SPK = {
  S1: '#B5BCD6',
  S2: '#FF8FB8',
  S3: '#C5E86C',
  S4: '#E6D9BD',
  AI: '#3DE0F7',
  COP: '#7CB8FF',
  ME: '#EAF1FF',
} as const;
export const RIM = '#3DE0F7';
export const KEY = '#FFB84A';
export const FEAT = '#2A1E1E'; // 눈·눈썹·입 선
export const BLUSH = '#F08A8A';
export const SWEAT = '#BFEFFF';

/**
 * SVG 안 id(그라디언트·클립) — 한 화면에 그림이 두 장 떠도 겹치지 않게.
 * scope 를 주면 그 값으로 고정(테스트·정적 렌더용), 없으면 useId.
 */
export function useSvgIds(prefix: string, scope?: string) {
  const raw = useId();
  const p = `wt-${prefix}-${(scope ?? raw).replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return {
    id: (n: string) => `${p}-${n}`,
    url: (n: string) => `url(#${p}-${n})`,
    href: (n: string) => `#${p}-${n}`,
  };
}
export type SvgIds = ReturnType<typeof useSvgIds>;

/** 결정론 난수(mulberry32) — 비·균열·보케 배치가 렌더마다 같게 */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 소수 1자리로 자른 숫자 문자열(경로 바이트 절약) */
export const r1 = (n: number) => Math.round(n * 10) / 10;
