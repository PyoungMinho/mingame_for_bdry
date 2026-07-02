// POST /api/pae/rooms/[code]/restart — 방장이 "한 판 더" (재셔플·재딜·구름3 리드 재계산).
// status가 'ended' | 'waiting'일 때만 허용한다(진행 중 재시작 금지).
// 이전 손패를 전부 지우고 startGame으로 전체 초기화하므로 turn/lead/hands가 stale하지 않다.
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/pae/supabase-admin";
import { uidFromReq } from "@/lib/pae/auth";
import { startGame, type Player } from "@/lib/pae/engine";
import { makeRng, MIN_PLAYERS } from "@/lib/pae/tiles";
import { saveGame } from "@/lib/pae/room-state";

export async function POST(req: NextRequest, ctx: { params: { code: string } }) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase 미설정" }, { status: 500 });
  const uid = await uidFromReq(req);
  if (!uid) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const code = ctx.params.code.toUpperCase();
  const { data: room } = await admin.from("rooms").select("host_uid,status").eq("code", code).single();
  if (!room) return NextResponse.json({ error: "방을 찾을 수 없습니다" }, { status: 404 });
  if (room.host_uid !== uid) return NextResponse.json({ error: "방장만 다시 시작할 수 있습니다" }, { status: 403 });
  if (room.status !== "ended" && room.status !== "waiting") {
    return NextResponse.json({ error: "게임 진행 중에는 다시 시작할 수 없습니다" }, { status: 409 });
  }

  const { data: players } = await admin
    .from("room_players")
    .select("uid,name,seat")
    .eq("room_code", code)
    .order("seat");
  const list = players ?? [];
  if (list.length < MIN_PLAYERS) {
    return NextResponse.json({ error: `${MIN_PLAYERS}인 이상부터 시작할 수 있습니다` }, { status: 400 });
  }

  // 이전 손패 정리 → 떠난 참가자의 stale 손패 행이 남지 않게.
  await admin.from("hands").delete().eq("room_code", code);

  const gamePlayers: Player[] = list.map((p) => ({ id: p.uid as string, name: p.name as string }));
  const seed = Math.floor(Math.random() * 2 ** 31);
  const state = startGame(gamePlayers, makeRng(seed));
  await saveGame(code, state);

  return NextResponse.json({ ok: true });
}
