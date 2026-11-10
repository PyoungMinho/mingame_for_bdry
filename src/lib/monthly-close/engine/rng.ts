/** 시드 난수(테스트·시뮬용). 엔진은 Rng를 인자로만 받는다. */
import type { Rng } from './types';

/** mulberry32: 32비트 시드 → [0,1) */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
