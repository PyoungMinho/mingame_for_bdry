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
  totalRounds: number;
  cumulative: number[];
  scores?: number[]; // 이번 라운드 벌점 (종료 시에만)
  turnAt?: number; // 현재 턴 시작 시각(ms) — 서버가 saveGame 시 기록, 턴 타임아웃(10초) 판정용
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
    totalRounds: s.totalRounds,
    cumulative: s.cumulative,
    scores: s.phase === "ended" ? roundPenalty(s) : undefined,
  };
}

/** DB(공개 상태 + 손패 행)에서 완전한 GameState를 재구성. 진행 중 게임이 없으면 null. */
/** 공개상태(pub) + 손패 행에서 GameState를 구성. turn/lead 등은 넘겨받은 pub 스냅샷과 정합한다. */
export function buildState(pub: PublicState, handRows: { uid: string; tiles: Tile[] }[]): GameState {
  const byUid = new Map<string, Tile[]>(handRows.map((r) => [r.uid, r.tiles]));
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
    totalRounds: pub.totalRounds ?? 3,
    cumulative: pub.cumulative ?? pub.players.map(() => 0),
  };
}

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
  return buildState(pub, (rows ?? []) as { uid: string; tiles: Tile[] }[]);
}

/**
 * GameState를 공개 상태 + 손패로 분리 저장. 커밋 여부를 반환.
 * expectedTurnAt을 주면 CAS(낙관적 락) — DB의 현재 turnAt이 그 값일 때만 커밋한다.
 * (tick 자동진행이, 그 사이 착지한 정상 play/pass 액션을 덮어써 되돌리는 lost-update 방지)
 */
export async function saveGame(code: string, s: GameState, expectedTurnAt?: number): Promise<boolean> {
  const admin = getSupabaseAdmin();
  if (!admin) return false;
  const rows = s.players.map((p, i) => ({ room_code: code, uid: p.id, tiles: s.hands[i] }));
  const patch = {
    public_state: { ...toPublic(s), turnAt: Date.now() },
    status: s.phase,
    updated_at: new Date().toISOString(),
  };

  // 정상 경로(액션/시작): 무조건 저장 — rooms·hands 병렬로 왕복 절반.
  if (expectedTurnAt === undefined) {
    await Promise.all([admin.from("rooms").update(patch).eq("code", code), admin.from("hands").upsert(rows)]);
    return true;
  }

  // CAS: 읽은 이후 turnAt이 안 바뀌었을 때만 rooms 커밋 → 성공 시에만 hands 반영.
  const { data } = await admin
    .from("rooms")
    .update(patch)
    .eq("code", code)
    .eq("public_state->>turnAt", String(expectedTurnAt))
    .select("code");
  const committed = !!data && data.length > 0;
  if (committed) await admin.from("hands").upsert(rows);
  return committed;
}
