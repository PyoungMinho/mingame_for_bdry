// POST /api/pae/rooms/[code]/join — 대기방 입장 / 재접속.
// useRoom이 마운트마다 호출하므로, 기존 참가자는 status·정원과 무관하게 통과시킨다(재접속).
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/pae/supabase-admin";
import { uidFromReq } from "@/lib/pae/auth";
import { MAX_PLAYERS } from "@/lib/pae/tiles";
import { resolveJoin } from "@/lib/pae/join-logic";

export async function POST(req: NextRequest, ctx: { params: { code: string } }) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase 미설정" }, { status: 500 });
  const uid = await uidFromReq(req);
  if (!uid) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const code = ctx.params.code.toUpperCase();
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };

  const { data: room } = await admin.from("rooms").select("status").eq("code", code).single();
  if (!room) return NextResponse.json({ error: "방을 찾을 수 없습니다" }, { status: 404 });

  // 기존 참가자 우선 판정 → status·정원 체크는 그 다음 (재접속 튕김 방지).
  const { data: players } = await admin.from("room_players").select("uid,seat").eq("room_code", code);
  const decision = resolveJoin(room.status as string, players ?? [], uid, MAX_PLAYERS);

  if (decision.action === "reject") {
    return NextResponse.json({ error: decision.reason }, { status: 409 });
  }
  if (decision.action === "ok") {
    return NextResponse.json({ ok: true }); // 이미 입장 — 재접속 허용
  }
  // insert
  await admin
    .from("room_players")
    .insert({ room_code: code, uid, name: name || "손님", seat: decision.seat });
  return NextResponse.json({ ok: true });
}
