// 오후의 패 — 게임 진행 엔진 (서버 권위 상태 머신) + 세트/누적 점수.
// 렉시오 진행:
//   · 구름3 보유자가 첫 리드 (첫 수에 구름3 포함 의무 없음)
//   · 리드보다 강한 같은-크기 조합을 내거나 패스 (패스 비영구)
//   · 리드한 사람에게 차례가 돌아오면 트릭 종료, 그가 새 리드
//   · 누군가 마지막 타일을 내면 라운드 즉시 종료
// 점수(누적제): 라운드 종료 시 각자 "남은 타일 수 × (2 보유 시 2배)"가 벌점. 승자=0.
//   3라운드(SET_ROUNDS)를 한 세트로, 누적 벌점이 가장 낮은 사람이 최종 1등.
import { Tile, DealConfig, deal, startingPlayer, tileEquals, tileId } from "@/lib/pae/tiles";
import { Combo, classify, canBeat } from "@/lib/pae/combos";

export interface Player {
  id: string;
  name: string;
}

export interface Lead {
  combo: Combo;
  by: number;
}

export interface GameState {
  config: DealConfig;
  players: Player[];
  hands: Tile[][];
  turn: number;
  lead: Lead | null;
  winner: number | null;
  phase: "playing" | "ended";
  /** 현재 세트에서 몇 번째 라운드인지 (1..SET_ROUNDS) */
  setRound: number;
  /** 이전 라운드까지 누적 벌점 (seat별). 이번 라운드 벌점은 아직 미포함 */
  cumulative: number[];
}

export type ActionResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };

/** 한 세트 = 3라운드 */
export const SET_ROUNDS = 3;

/** 새 라운드 시작. set을 넘기면 세트 진행 상태를 이어받는다(없으면 새 세트 1라운드). */
export function startGame(
  players: Player[],
  rng: () => number,
  set?: { setRound: number; cumulative: number[] },
): GameState {
  const { hands, config } = deal(players.length, rng);
  return {
    config,
    players,
    hands,
    turn: startingPlayer(hands),
    lead: null,
    winner: null,
    phase: "playing",
    setRound: set?.setRound ?? 1,
    cumulative: set?.cumulative ?? players.map(() => 0),
  };
}

/**
 * 이번 라운드 벌점 (seat별). 남은 타일 수 × (2를 보유하면 2배). 승자(0장)=0.
 * 낮을수록 좋다.
 */
export function roundPenalty(state: GameState): number[] {
  return state.hands.map((h) => h.length * (h.some((t) => t.n === 2) ? 2 : 1));
}

/** 이번 라운드까지 포함한 누적 벌점 (종료 상태에서 결과 표시용). */
export function cumulativeWithRound(state: GameState): number[] {
  const p = roundPenalty(state);
  return state.cumulative.map((c, i) => c + p[i]);
}

/** 세트가 끝났는가 (마지막 라운드 종료). */
export function isSetOver(state: GameState): boolean {
  return state.phase === "ended" && state.setRound >= SET_ROUNDS;
}

/**
 * 다음 라운드(또는 세트 종료 후 새 세트) 시작.
 * 세트 진행 중이면 누적을 이어받고 setRound+1, 세트가 끝났으면 누적 0으로 새 세트.
 */
export function nextRound(prev: GameState, rng: () => number): GameState {
  const cumulative = cumulativeWithRound(prev);
  if (prev.setRound >= SET_ROUNDS) {
    return startGame(prev.players, rng, { setRound: 1, cumulative: prev.players.map(() => 0) });
  }
  return startGame(prev.players, rng, { setRound: prev.setRound + 1, cumulative });
}

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

function nextAlive(hands: Tile[][], from: number): number {
  const n = hands.length;
  for (let step = 1; step <= n; step++) {
    const idx = (from + step) % n;
    if (hands[idx].length > 0) return idx;
  }
  return from;
}

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

  if (hands[pi].length === 0) {
    return { ok: true, state: { ...state, hands, lead, winner: pi, phase: "ended" } };
  }
  return { ok: true, state: { ...state, hands, lead, turn: nextAlive(hands, pi) } };
}

export function pass(state: GameState, pi: number): ActionResult {
  if (state.phase !== "playing") return { ok: false, error: "게임이 끝났습니다" };
  if (state.turn !== pi) return { ok: false, error: "당신 차례가 아닙니다" };
  if (!state.lead) return { ok: false, error: "리드 차례에는 패스할 수 없습니다" };

  const next = nextAlive(state.hands, pi);
  if (next === state.lead.by) {
    return { ok: true, state: { ...state, lead: null, turn: state.lead.by } };
  }
  return { ok: true, state: { ...state, turn: next } };
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

export function playableAgainst(hand: Tile[], lead: Lead | null): Combo[] {
  const all = enumerateCombos(hand);
  if (!lead) return all;
  return all.filter((c) => canBeat(c, lead.combo));
}

export function hasPlayable(hand: Tile[], lead: Lead | null): boolean {
  if (!lead) return hand.length > 0;
  return playableAgainst(hand, lead).length > 0;
}
