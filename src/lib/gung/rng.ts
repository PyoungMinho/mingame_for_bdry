/**
 * 세자 독살 사건 (/gung) — 시드 기반 결정론 난수.
 *
 * src/lib/flight/rng.ts 와 **같은 알고리즘의 복제본**이다(디자인 스펙 §7-2).
 * flight 는 미커밋 staged 상태라 import 하면 배포가 flight 에 묶인다 → import 금지, 복제.
 *
 * 규칙: Math.random · Date · 로케일 의존 금지. 같은 입력 → 모든 기기에서 같은 결과.
 */

/** 문자열 → uint32 해시 (xmur3 계열 + murmur3 finalizer). */
export function hash32(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

/** mulberry32 — [0,1) 난수열. 같은 seed 는 항상 같은 수열. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 두 seed 합성(하위 seed 트리). 3개 이상은 mix(mix(a,b),c). */
export function mix(a: number, b: number): number {
  return Math.imul(a ^ b, 0x9e3779b9) >>> 0;
}

/** Fisher–Yates — 원본은 건드리지 않고 섞은 사본을 돌려준다. */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}
