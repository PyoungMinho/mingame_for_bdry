// 오후의 패 (빅2/렉시오) — 타일 모델·덱·셔플·딜.
// 룰 출처: marquand.net/lexio (빅2 표준 pagat.com 교차검증).
//   · 색 강함: 해(sun) > 달(moon) > 별(star) > 구름(cloud)
//   · 숫자 강함: 2 > 1 > 15 > … > 3   (3이 최약, 2가 최강)
//   · 딜: 인원에 맞춰 높은 숫자를 빼서 (인원 × 장수)에 딱 맞춘다.

export const SUITS = ["cloud", "star", "moon", "sun"] as const; // 약 → 강
export type Suit = (typeof SUITS)[number];

/** 색 강함 순위(클수록 강함): 해 > 달 > 별 > 구름 */
export const SUIT_RANK: Record<Suit, number> = { cloud: 0, star: 1, moon: 2, sun: 3 };

/** 색 한글 이름 (UI·로그용) */
export const SUIT_KO: Record<Suit, string> = { sun: "해", moon: "달", star: "별", cloud: "구름" };

export interface Tile {
  /** 숫자 1~15 */
  n: number;
  suit: Suit;
}

/**
 * 숫자 강함 순위(작을수록 약함). 3→0 … 15→12, 1→13, 2→14.
 * 렉시오 규칙 "2 > 1 > 15 > … > 3"을 0-기반 정수로 사상한다.
 */
export function numberRank(n: number): number {
  return n >= 3 ? n - 3 : n + 12; // 3→0 … 15→12, 1→13, 2→14
}

/**
 * 타일 절대 강함(싱글 비교 및 같은-숫자 타이브레이크용).
 * 숫자 강함이 우선, 같으면 색. 60종 타일이 0~59의 고유값을 갖는다.
 */
export function tileStrength(t: Tile): number {
  return numberRank(t.n) * 4 + SUIT_RANK[t.suit];
}

/** 안정적 식별자 (예: "cloud-3") */
export function tileId(t: Tile): string {
  return `${t.suit}-${t.n}`;
}

export function tileEquals(a: Tile, b: Tile): boolean {
  return a.n === b.n && a.suit === b.suit;
}

/** 약 → 강 정렬용 비교자 */
export function byStrength(a: Tile, b: Tile): number {
  return tileStrength(a) - tileStrength(b);
}

// ─────────────────────────────────────────────────────────────
// 덱 · 딜
// ─────────────────────────────────────────────────────────────

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 5;

export interface DealConfig {
  /** 사용하는 최대 숫자 (1..maxNumber) */
  maxNumber: number;
  /** 1인당 분배 장수 */
  perPlayer: number;
}

/** 인원별 딜 설정. (maxNumber × 4) === (인원 × perPlayer) 가 항상 성립한다. */
export const DEAL_CONFIG: Record<number, DealConfig> = {
  3: { maxNumber: 9, perPlayer: 12 }, //  1~9  (36장) ÷ 3
  4: { maxNumber: 13, perPlayer: 13 }, // 1~13 (52장) ÷ 4
  5: { maxNumber: 15, perPlayer: 12 }, // 1~15 (60장) ÷ 5
};

/** 1..maxNumber × 4색 덱 생성 (약 → 강 정렬). */
export function buildDeck(maxNumber: number): Tile[] {
  const deck: Tile[] = [];
  for (let n = 1; n <= maxNumber; n++) {
    for (const suit of SUITS) deck.push({ n, suit });
  }
  return deck;
}

/**
 * 시드 기반 RNG (mulberry32).
 * 서버 권위 셔플의 재현성·테스트를 위해 결정적 난수를 쓴다.
 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates 셔플 (비파괴 — 원본 배열을 건드리지 않는다). */
export function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface DealResult {
  hands: Tile[][];
  config: DealConfig;
}

/**
 * 인원수만큼 셔플·분배한다. 각 손패는 약 → 강으로 정렬되어 반환된다.
 * 3~5인만 지원하며 그 외에는 예외를 던진다.
 */
export function deal(playerCount: number, rng: () => number): DealResult {
  const config = DEAL_CONFIG[playerCount];
  if (!config) throw new Error(`지원하지 않는 인원수: ${playerCount} (3~5인만 가능)`);
  const shuffled = shuffle(buildDeck(config.maxNumber), rng);
  const hands: Tile[][] = Array.from({ length: playerCount }, () => []);
  shuffled.forEach((tile, i) => hands[i % playerCount].push(tile));
  hands.forEach((h) => h.sort(byStrength));
  return { hands, config };
}

/** 첫 라운드 리드를 정하는 타일: 구름3 (가장 약한 타일). */
export const STARTING_TILE: Tile = { n: 3, suit: "cloud" };

/** 구름3을 가진 플레이어 index. 없으면 -1 (정상적인 덱에선 항상 존재). */
export function startingPlayer(hands: Tile[][]): number {
  return hands.findIndex((h) => h.some((t) => tileEquals(t, STARTING_TILE)));
}
