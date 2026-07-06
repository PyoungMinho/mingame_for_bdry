// 오후의 패 — 게임 상태 ↔ DB 변환 (서버 권위).
//   · 공개 상태(rooms.public_state): 손패 제외 — turn·lead·winner·phase·handCounts·setRound·cumulative·(종료 시)scores
//   · 손패(hands 테이블): uid별, RLS로 본인만 열람
import { getSupabaseAdmin } from "@/lib/pae/supabase-admin";
import { roundPenalty, type GameState, type Player, type Lead } from "@/lib/pae/engine";
import type { Tile } from "@/lib/pae/tiles";

export interface PublicState {
  config: GameState["config"];
  players: Player[];
  turn: number;
  lead: Lead | null;
  winner: number | null;
  phase: GameState["phase"];
  handCounts: number[];
  setRound: number;
  cumulative: number[];
  scores?: number[]; // 이번 라운드 벌점 (종료 시에만)
}

/** 손패를 뺀 공개 상태로 변환. 종료 시 이번 라운드 벌점을 포함한다. */
export function toPublic(s: GameState): PublicState {
  return {
    config: s.config,
    players: s.players,
    turn: s.turn,
    lead: s.lead,
    winner: s.winner,
    phase: s.phase,
    handCounts: s.hands.map((h) => h.length),
    setRound: s.setRound,
    cumulative: s.cumulative,
    scores: s.phase === "ended" ? roundPenalty(s) : undefined,
  };
}

/** DB(공개 상태 + 손패 행)에서 완전한 GameState를 재구성. 진행 중 게임이 없으면 null. */
export async function loadGame(code: string): Promise<GameState | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  // rooms(공개상태)·hands(손패)는 서로 독립 조회 → 병렬로 왕복을 절반으로.
  const [{ data: room }, { data: rows }] = await Promise.all([
    admin.from("rooms").select("public_state").eq("code", code).single(),
    admin.from("hands").select("uid,tiles").eq("room_code", code),
  ]);
  const pub = (room?.public_state ?? null) as PublicState | null;
  if (!pub) return null;
  const byUid = new Map<string, Tile[]>((rows ?? []).map((r) => [r.uid as string, r.tiles as Tile[]]));
  const hands = pub.players.map((p) => byUid.get(p.id) ?? []);
  return {
    config: pub.config,
    players: pub.players,
    turn: pub.turn,
    lead: pub.lead,
    winner: pub.winner,
    phase: pub.phase,
    hands,
    setRound: pub.setRound ?? 1,
    cumulative: pub.cumulative ?? pub.players.map(() => 0),
  };
}

/** GameState를 공개 상태 + 손패로 분리 저장. */
export async function saveGame(code: string, s: GameState): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const rows = s.players.map((p, i) => ({ room_code: code, uid: p.id, tiles: s.hands[i] }));
  // rooms 업데이트·hands upsert도 독립 → 병렬로 왕복 절반.
  await Promise.all([
    admin
      .from("rooms")
      .update({ public_state: toPublic(s), status: s.phase, updated_at: new Date().toISOString() })
      .eq("code", code),
    admin.from("hands").upsert(rows),
  ]);
}
