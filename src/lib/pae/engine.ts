// 오후의 패 — 게임 진행 엔진 (서버 권위 상태 머신).
// 렉시오 정식 진행을 그대로 구현한다:
//   · 구름3 보유자가 첫 리드 (첫 수에 구름3 포함 의무 없음)
//   · 리드보다 강한 같은-크기 조합을 내거나 패스 (패스는 비영구 — 다시 차례 오면 낼 수 있음)
//   · 리드한 사람에게 차례가 돌아오면 트릭 종료, 그가 새 리드
//   · 누군가 마지막 타일을 내면 라운드 즉시 종료
//   · 점수: 남은 타일 수 차이를 서로 지불(pairwise), 2 보유 시 배수(1장→×2, 2장→×3 …)
import { Tile, DealConfig, deal, startingPlayer, tileEquals, tileId } from "@/lib/pae/tiles";
import { Combo, classify, canBeat } from "@/lib/pae/combos";

export interface Player {
  id: string;
  name: string;
}

export interface Lead {
  combo: Combo;
  /** 이 리드를 낸 플레이어 index */
  by: number;
}

export interface GameState {
  config: DealConfig;
  players: Player[];
  /** 서버 권위 — 각 클라이언트에는 본인 hands[i]만 내려준다 */
  hands: Tile[][];
  /** 현재 차례 플레이어 index */
  turn: number;
  /** 현재 바닥패. null이면 새 트릭의 리드 차례(아무 조합이나 낼 수 있음) */
  lead: Lead | null;
  /** 먼저 손을 비운 플레이어 index (라운드 승자) */
  winner: number | null;
  phase: "playing" | "ended";
}

export type ActionResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };

/** 새 라운드 시작 — 셔플·딜 후 구름3 보유자를 첫 리드로 세운다. */
export function startGame(players: Player[], rng: () => number): GameState {
  const { hands, config } = deal(players.length, rng);
  return {
    config,
    players,
    hands,
    turn: startingPlayer(hands),
    lead: null,
    winner: null,
    phase: "playing",
  };
}

/** 손에 주어진 타일을 전부 갖고 있는지 (중복 수량까지 확인) */
function handHasAll(hand: Tile[], tiles: Tile[]): boolean {
  const pool = new Map<string, number>();
  for (const t of hand) pool.set(tileId(t), (pool.get(tileId(t)) ?? 0) + 1);
  for (const t of tiles) {
    const left = pool.get(tileId(t)) ?? 0;
    if (left <= 0) return false;
    pool.set(tileId(t), left - 1);
  }
  return true;
}

function removeTiles(hand: Tile[], tiles: Tile[]): Tile[] {
  const rest = [...hand];
  for (const t of tiles) {
    const i = rest.findIndex((x) => tileEquals(x, t));
    if (i >= 0) rest.splice(i, 1);
  }
  return rest;
}

/** from 다음으로 손패가 남은 플레이어 index */
function nextAlive(hands: Tile[][], from: number): number {
  const n = hands.length;
  for (let step = 1; step <= n; step++) {
    const idx = (from + step) % n;
    if (hands[idx].length > 0) return idx;
  }
  return from;
}

/** 조합을 내는 액션. 서버 권위 검증을 모두 통과해야 적용된다. */
export function play(state: GameState, pi: number, tiles: Tile[]): ActionResult {
  if (state.phase !== "playing") return { ok: false, error: "게임이 끝났습니다" };
  if (state.turn !== pi) return { ok: false, error: "당신 차례가 아닙니다" };
  if (tiles.length === 0) return { ok: false, error: "낼 타일을 선택하세요" };
  if (!handHasAll(state.hands[pi], tiles)) return { ok: false, error: "손에 없는 타일입니다" };

  const combo = classify(tiles);
  if (!combo) return { ok: false, error: "유효하지 않은 조합입니다" };
  if (state.lead && !canBeat(combo, state.lead.combo)) {
    return { ok: false, error: "바닥패를 이길 수 없습니다" };
  }

  const hands = state.hands.map((h, i) => (i === pi ? removeTiles(h, tiles) : h));
  const lead: Lead = { combo, by: pi };

  // 라운드 즉시 종료 — 마지막 타일을 냈다
  if (hands[pi].length === 0) {
    return { ok: true, state: { ...state, hands, lead, winner: pi, phase: "ended" } };
  }

  return { ok: true, state: { ...state, hands, lead, turn: nextAlive(hands, pi) } };
}

/** 패스 액션. 리드 차례(바닥패 없음)에는 패스할 수 없다. */
export function pass(state: GameState, pi: number): ActionResult {
  if (state.phase !== "playing") return { ok: false, error: "게임이 끝났습니다" };
  if (state.turn !== pi) return { ok: false, error: "당신 차례가 아닙니다" };
  if (!state.lead) return { ok: false, error: "리드 차례에는 패스할 수 없습니다" };

  const next = nextAlive(state.hands, pi);
  // 한 바퀴 돌아 리드한 사람에게 → 트릭 종료, 그가 새 리드
  if (next === state.lead.by) {
    return { ok: true, state: { ...state, lead: null, turn: state.lead.by } };
  }
  return { ok: true, state: { ...state, turn: next } };
}

/**
 * 라운드 점수 정산 (칩 증감, zero-sum).
 * 각 플레이어는 자신보다 타일이 적은 모든 상대에게 (차이 × 자신의 2-배수)만큼 지불한다.
 * 2-배수: 2를 0장→×1, 1장→×2, 2장→×3 … (1 + 보유한 2의 개수).
 */
export function scoreRound(state: GameState): number[] {
  const n = state.players.length;
  const remaining = state.hands.map((h) => h.length);
  const twos = state.hands.map((h) => h.filter((t) => t.n === 2).length);
  const score = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (remaining[i] > remaining[j]) {
        const amount = (remaining[i] - remaining[j]) * (1 + twos[i]);
        score[i] -= amount;
        score[j] += amount;
      }
    }
  }
  return score;
}

// ─────────────────────────────────────────────────────────────
// 낼 수 있는 조합 탐색 (UI 하이라이트 · 자동 패스 판정용)
// ─────────────────────────────────────────────────────────────

function kCombinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > arr.length) return [];
  const [head, ...tail] = arr;
  const withHead = kCombinations(tail, k - 1).map((c) => [head, ...c]);
  return [...withHead, ...kCombinations(tail, k)];
}

/** 손에서 만들 수 있는 모든 유효 조합 (싱글·페어·트리플·5장 족보). */
export function enumerateCombos(hand: Tile[]): Combo[] {
  const out: Combo[] = [];
  for (const t of hand) out.push(classify([t])!);

  const byNumber = new Map<number, Tile[]>();
  for (const t of hand) {
    const g = byNumber.get(t.n) ?? [];
    g.push(t);
    byNumber.set(t.n, g);
  }
  for (const g of byNumber.values()) {
    if (g.length >= 2) for (const c of kCombinations(g, 2)) pushIf(out, c);
    if (g.length >= 3) for (const c of kCombinations(g, 3)) pushIf(out, c);
  }
  if (hand.length >= 5) for (const c of kCombinations(hand, 5)) pushIf(out, c);
  return out;
}

function pushIf(out: Combo[], tiles: Tile[]): void {
  const c = classify(tiles);
  if (c) out.push(c);
}

/** 현재 바닥패를 받을 수 있는 조합들. 리드 차례면 만들 수 있는 모든 조합. */
export function playableAgainst(hand: Tile[], lead: Lead | null): Combo[] {
  const all = enumerateCombos(hand);
  if (!lead) return all;
  return all.filter((c) => canBeat(c, lead.combo));
}

/** 낼 수 있는 수가 하나라도 있는가 (없으면 자동 패스 대상). */
export function hasPlayable(hand: Tile[], lead: Lead | null): boolean {
  if (!lead) return hand.length > 0;
  return playableAgainst(hand, lead).length > 0;
}
