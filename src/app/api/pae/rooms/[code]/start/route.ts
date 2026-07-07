// POST /api/pae/rooms/[code]/start — 방장이 게임 시작 (셔플·딜·구름3 리드).
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
  if (room.host_uid !== uid) return NextResponse.json({ error: "방장만 시작할 수 있습니다" }, { status: 403 });
  if (room.status !== "waiting") return NextResponse.json({ error: "이미 시작됨" }, { status: 409 });

  const { data: players } = await admin
    .from("room_players")
    .select("uid,name,seat")
    .eq("room_code", code)
    .order("seat");
  const list = players ?? [];
  if (list.length < MIN_PLAYERS) {
    return NextResponse.json({ error: `${MIN_PLAYERS}인 이상부터 시작할 수 있습니다` }, { status: 400 });
  }

  const { rounds } = (await req.json().catch(() => ({}))) as { rounds?: number };
  const totalRounds = Math.min(9, Math.max(1, Math.floor(Number(rounds) || 3)));
  const gamePlayers: Player[] = list.map((p) => ({ id: p.uid as string, name: p.name as string }));
  const seed = Math.floor(Math.random() * 2 ** 31);
  const state = startGame(gamePlayers, makeRng(seed), { totalRounds });
  await saveGame(code, state);
  // 게임 시작 시 전원 heartbeat 리셋 — 대기 시간 동안 오래된 last_seen으로 즉시 자리비움 오판되는 것 방지.
  await admin.from("room_players").update({ last_seen: new Date().toISOString() }).eq("room_code", code);

  return NextResponse.json({ ok: true });
}
