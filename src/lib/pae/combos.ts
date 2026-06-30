// 오후의 패 — 조합(멜드) 판정·비교 엔진.
// 조합: 싱글 · 페어 · 트리플 · 5장 족보(스트레이트 < 플러시 < 풀하우스 < 포카드+1 < 스트레이트플러시).
//   · 같은 종류끼리는 "가장 강한 타일 → 같으면 색"으로 비교.
//   · 풀하우스는 트리플 부분으로, 포카드+1은 포카드 부분으로만 비교.
//   · 스트레이트/스트레이트플러시는 자연수 최고값으로 비교 (1·2 wrap 없음, 최강은 11-12-13-14-15).
import { Tile, SUIT_RANK, tileStrength, byStrength } from "@/lib/pae/tiles";

export type ComboType =
  | "single"
  | "pair"
  | "triple"
  | "straight"
  | "flush"
  | "fullhouse"
  | "fourplus"
  | "straightflush";

/** 5장 족보 우열 (클수록 강함). */
export const FIVE_ORDER: Record<ComboType, number> = {
  single: 0,
  pair: 0,
  triple: 0,
  straight: 0,
  flush: 1,
  fullhouse: 2,
  fourplus: 3,
  straightflush: 4,
};

/** 조합 종류 한글 이름 (UI·로그용) */
export const COMBO_KO: Record<ComboType, string> = {
  single: "싱글",
  pair: "페어",
  triple: "트리플",
  straight: "스트레이트",
  flush: "플러시",
  fullhouse: "풀하우스",
  fourplus: "포카드",
  straightflush: "스트레이트 플러시",
};

export interface Combo {
  type: ComboType;
  /** 약 → 강 정렬된 타일 사본 */
  tiles: Tile[];
  size: 1 | 2 | 3 | 5;
  /** 비교 키 — 같은 type끼리 이 값이 큰 쪽이 강하다. */
  key: number;
}

function mk(type: ComboType, tiles: Tile[], size: 1 | 2 | 3 | 5, key: number): Combo {
  return { type, tiles, size, key };
}

/** 타일 묶음 중 가장 강한 타일의 strength */
function maxStrength(tiles: Tile[]): number {
  return Math.max(...tiles.map(tileStrength));
}

/** 숫자별 개수 맵 */
function countByNumber(tiles: Tile[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const t of tiles) m.set(t.n, (m.get(t.n) ?? 0) + 1);
  return m;
}

/** 자연수 5연속인가 (서로 다른 5개, 최대-최소=4). 1·2 wrap 없음. */
function isNaturalStraight(tiles: Tile[]): boolean {
  const ns = tiles.map((t) => t.n);
  const distinct = new Set(ns);
  if (distinct.size !== 5) return false;
  return Math.max(...ns) - Math.min(...ns) === 4;
}

/** 스트레이트류 비교 키: 자연수 최고값 → 그 타일의 색. */
function straightKey(tiles: Tile[]): number {
  const maxN = Math.max(...tiles.map((t) => t.n));
  const top = tiles.find((t) => t.n === maxN)!;
  return maxN * 4 + SUIT_RANK[top.suit];
}

/** 같은 숫자 그룹(페어/트리플/풀하우스의 트리플)의 최강 타일 strength */
function groupKey(tiles: Tile[], n: number): number {
  return maxStrength(tiles.filter((t) => t.n === n));
}

/** 포카드 비교 키 — 한 숫자의 4색 전부이므로 최강색(해)으로 고정. */
function quadKey(n: number): number {
  return tileStrength({ n, suit: "sun" });
}

/**
 * 타일 배열을 조합으로 판정한다. 유효하지 않으면 null.
 * 입력은 변형하지 않는다.
 */
export function classify(input: Tile[]): Combo | null {
  const tiles = [...input].sort(byStrength);
  const size = tiles.length;

  if (size === 1) return mk("single", tiles, 1, tileStrength(tiles[0]));

  if (size === 2) {
    if (tiles[0].n !== tiles[1].n) return null;
    return mk("pair", tiles, 2, maxStrength(tiles));
  }

  if (size === 3) {
    if (tiles[0].n !== tiles[1].n || tiles[1].n !== tiles[2].n) return null;
    return mk("triple", tiles, 3, maxStrength(tiles));
  }

  if (size === 5) return classifyFive(tiles);

  return null; // 4장 단독 등은 무효
}

function classifyFive(tiles: Tile[]): Combo | null {
  const isFlush = tiles.every((t) => t.suit === tiles[0].suit);
  const isStraight = isNaturalStraight(tiles);

  if (isStraight && isFlush) return mk("straightflush", tiles, 5, straightKey(tiles));
  if (isFlush) return mk("flush", tiles, 5, maxStrength(tiles));
  if (isStraight) return mk("straight", tiles, 5, straightKey(tiles));

  const counts = countByNumber(tiles);
  const sorted = [...counts.values()].sort((a, b) => b - a); // 내림차순

  if (sorted[0] === 4) {
    const quadN = [...counts.entries()].find(([, c]) => c === 4)![0];
    return mk("fourplus", tiles, 5, quadKey(quadN));
  }
  if (sorted[0] === 3 && sorted[1] === 2) {
    const tripN = [...counts.entries()].find(([, c]) => c === 3)![0];
    return mk("fullhouse", tiles, 5, groupKey(tiles, tripN));
  }

  return null; // 투페어 등은 무효
}

/**
 * 같은 크기 조합의 우열을 비교한다. (a가 강하면 양수, 약하면 음수, 같으면 0)
 * 크기가 다르면 비교 불가이므로 예외를 던진다.
 */
export function compareCombos(a: Combo, b: Combo): number {
  if (a.size !== b.size) {
    throw new Error(`크기가 다른 조합은 비교할 수 없습니다: ${a.size} vs ${b.size}`);
  }
  if (a.size === 5 && a.type !== b.type) {
    return FIVE_ORDER[a.type] - FIVE_ORDER[b.type];
  }
  return a.key - b.key;
}

/** candidate가 lead를 받을 수 있는가 — 같은 크기 + 더 강함. */
export function canBeat(candidate: Combo, lead: Combo): boolean {
  return candidate.size === lead.size && compareCombos(candidate, lead) > 0;
}

/** 유효한 조합인지 (편의 함수) */
export function isValidCombo(tiles: Tile[]): boolean {
  return classify(tiles) !== null;
}
