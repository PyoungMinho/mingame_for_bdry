// POST /api/pae/rooms/[code]/tick — 게임 중 주기 호출.
//  1) heartbeat: 내 last_seen 갱신(살아있음 표시)
//  2) 자리비움(12초 이상 끊긴) 좌석 차례면 자동 진행 — 단, 중복 방지를 위해
//     "심판(active 중 가장 낮은 seat) 1명만" 수행한다.
//  3) 방장이 자리비움이면 승계. active 인원이 2명 이하면 게임 중단 → 대기방 복귀.
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/pae/supabase-admin";
import { uidFromReq } from "@/lib/pae/auth";
import { forceAdvance } from "@/lib/pae/engine";
import { loadGame, saveGame, toPublic } from "@/lib/pae/room-state";

const AWAY_MS = 12000; // 이 시간 이상 heartbeat 없으면 자리비움

export async function POST(req: NextRequest, ctx: { params: { code: string } }) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase 미설정" }, { status: 500 });
  const uid = await uidFromReq(req);
  if (!uid) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const code = ctx.params.code.toUpperCase();

  // 1) heartbeat — 나 살아있음
  await admin.from("room_players").update({ last_seen: new Date().toISOString() }).eq("room_code", code).eq("uid", uid);

  // 2) 현재 방 정보 + 참가자 last_seen
  const [{ data: room }, { data: players }] = await Promise.all([
    admin.from("rooms").select("host_uid,status").eq("code", code).single(),
    admin.from("room_players").select("uid,seat,last_seen").eq("room_code", code).order("seat"),
  ]);
  if (!room) return NextResponse.json({ error: "방을 찾을 수 없습니다" }, { status: 404 });

  let state = await loadGame(code);
  if (!state || state.phase !== "playing") {
    return NextResponse.json({ ok: true, publicState: state ? toPublic(state) : null, awaySeats: [] });
  }

  const now = Date.now();
  const lastByUid = new Map((players ?? []).map((p) => [p.uid as string, new Date(p.last_seen as string).getTime()]));
  const isAway = (id: string) => now - (lastByUid.get(id) ?? 0) > AWAY_MS;
  const awaySeats = state.players.map((p, i) => (isAway(p.id) ? i : -1)).filter((i) => i >= 0);
  const activeSeats = state.players.map((_, i) => i).filter((i) => !awaySeats.includes(i));

  const mySeat = state.players.findIndex((p) => p.id === uid);
  const refereeSeat = activeSeats.length ? Math.min(...activeSeats) : -1;

  // 자동 진행/정리는 심판(active 최소 seat) 1명만 → 중복 forceAdvance 방지
  if (mySeat === refereeSeat && refereeSeat >= 0) {
    // 2인 이하 → 게임 계속 불가. 대기방 복귀(세트 무효), 방장 자리비움이면 나에게 승계.
    if (activeSeats.length <= 2) {
      await admin.from("hands").delete().eq("room_code", code);
      const patch: Record<string, unknown> = { status: "waiting", public_state: null, updated_at: new Date().toISOString() };
      if (room.host_uid && isAway(room.host_uid as string)) patch.host_uid = state.players[refereeSeat].id;
      await admin.from("rooms").update(patch).eq("code", code);
      return NextResponse.json({ ok: true, publicState: null, awaySeats, aborted: true });
    }

    // 방장 승계 (host가 자리비움)
    if (room.host_uid && isAway(room.host_uid as string)) {
      await admin.from("rooms").update({ host_uid: state.players[refereeSeat].id }).eq("code", code);
    }

    // 현재 턴이 자리비움인 동안 자동 진행 (정상 좌석 만나면 멈춤, guard로 무한 방지)
    let advanced = false;
    let guard = 0;
    while (state.phase === "playing" && awaySeats.includes(state.turn) && guard++ < state.players.length) {
      const r = forceAdvance(state);
      if (!r.ok) break;
      state = r.state;
      advanced = true;
    }
    if (advanced) await saveGame(code, state);
  }

  return NextResponse.json({ ok: true, publicState: toPublic(state), awaySeats });
}
