// POST /api/pae/rooms/[code]/tick — 게임 중 주기 호출.
//  1) heartbeat: 내 last_seen 갱신(살아있음 표시 — awaySeats 배지용)
//  2) 자동 진행: 현재 턴이 10초(TURN_MS) 넘거나, "낼 게 없는 응수 차례"면 자동 패스/최소패.
//     중복 방지로 심판(active=연결된 좌석 중 최소 seat) 1명만 수행.
//  3) 방장이 자리비움이면 승계. 게임은 종료시키지 않고 자동패스로 계속 진행한다(방 안 터짐).
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/pae/supabase-admin";
import { uidFromReq } from "@/lib/pae/auth";
import { forceAdvance, hasPlayable } from "@/lib/pae/engine";
import { buildState, saveGame, toPublic, type PublicState } from "@/lib/pae/room-state";
import type { Tile } from "@/lib/pae/tiles";

const AWAY_MS = 20000; // 자리비움 "표시"(배지) 기준. 게임 진행은 아래 턴 타임아웃이 담당.
const TURN_MS = 10000; // 현재 턴이 이 시간 넘으면 자동 진행(응수=패스, 리드=최소패)

export async function POST(req: NextRequest, ctx: { params: { code: string } }) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase 미설정" }, { status: 500 });
  const uid = await uidFromReq(req);
  if (!uid) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const code = ctx.params.code.toUpperCase();

  // 1) heartbeat — 나 살아있음
  await admin.from("room_players").update({ last_seen: new Date().toISOString() }).eq("room_code", code).eq("uid", uid);

  // 2) 현재 방 정보(+공개상태의 turnAt) + 참가자 last_seen
  const [{ data: room }, { data: players }] = await Promise.all([
    admin.from("rooms").select("host_uid,status,public_state").eq("code", code).single(),
    admin.from("room_players").select("uid,seat,last_seen").eq("room_code", code).order("seat"),
  ]);
  if (!room) return NextResponse.json({ error: "방을 찾을 수 없습니다" }, { status: 404 });

  // turn과 turnAt(턴 시작 시각)을 반드시 같은 public_state 스냅샷에서 뽑는다.
  // (예전엔 room 쿼리에서 turnAt, loadGame의 별도 쿼리에서 turn을 읽어 세대가 어긋나면
  //  방금 넘어온 응수자를 오타임아웃으로 강제 패스시켰다 — BUG-1)
  const pub = (room.public_state ?? null) as PublicState | null;
  if (!pub || pub.phase !== "playing") {
    return NextResponse.json({ ok: true, publicState: pub, awaySeats: [] });
  }
  const { data: handRows } = await admin.from("hands").select("uid,tiles").eq("room_code", code);
  let state = buildState(pub, (handRows ?? []) as { uid: string; tiles: Tile[] }[]);
  const turnAt = pub.turnAt ?? Date.now();

  const now = Date.now();
  const lastByUid = new Map((players ?? []).map((p) => [p.uid as string, new Date(p.last_seen as string).getTime()]));
  const isAway = (id: string) => now - (lastByUid.get(id) ?? 0) > AWAY_MS;
  const awaySeats = state.players.map((p, i) => (isAway(p.id) ? i : -1)).filter((i) => i >= 0);
  const activeSeats = state.players.map((_, i) => i).filter((i) => !awaySeats.includes(i));

  const mySeat = state.players.findIndex((p) => p.id === uid);
  const refereeSeat = activeSeats.length ? Math.min(...activeSeats) : -1;

  // 자동 진행은 심판(연결된 좌석 중 최소 seat) 1명만 → 중복 forceAdvance 방지
  if (mySeat === refereeSeat && refereeSeat >= 0) {
    // 방장이 자리비움이면 심판에게 승계 (게임 진행엔 방장 권한 불필요)
    if (room.host_uid && isAway(room.host_uid as string)) {
      await admin.from("rooms").update({ host_uid: state.players[refereeSeat].id }).eq("code", code);
    }

    let advanced = false;
    // (a) 현재 턴이 10초 초과 → 자동 진행 1회 (응수=패스, 리드=최소패)
    if (now - turnAt > TURN_MS) {
      const r = forceAdvance(state);
      if (r.ok) {
        state = r.state;
        advanced = true;
      }
    }
    // (b) 낼 게 없는 응수 차례는 기다릴 것 없이 즉시 연쇄 자동패스
    let guard = 0;
    while (
      state.phase === "playing" &&
      state.lead &&
      !hasPlayable(state.hands[state.turn], state.lead) &&
      guard++ < state.players.length
    ) {
      const r = forceAdvance(state);
      if (!r.ok) break;
      state = r.state;
      advanced = true;
    }
    // CAS: 읽은 turnAt이 그대로일 때만 커밋. 그 사이 정상 액션이 착지했으면 tick 진행을 폐기(액션 보존).
    if (advanced) await saveGame(code, state, turnAt);
  }

  return NextResponse.json({ ok: true, publicState: toPublic(state), awaySeats });
}
