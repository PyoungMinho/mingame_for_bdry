// POST /api/pae/rooms/[code]/join — 대기방 입장 (waiting 상태 + 정원 미만).
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/pae/supabase-admin";
import { uidFromReq } from "@/lib/pae/auth";
import { MAX_PLAYERS } from "@/lib/pae/tiles";

export async function POST(req: NextRequest, ctx: { params: { code: string } }) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase 미설정" }, { status: 500 });
  const uid = await uidFromReq(req);
  if (!uid) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const code = ctx.params.code.toUpperCase();
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };

  const { data: room } = await admin.from("rooms").select("status").eq("code", code).single();
  if (!room) return NextResponse.json({ error: "방을 찾을 수 없습니다" }, { status: 404 });
  if (room.status !== "waiting") return NextResponse.json({ error: "이미 시작된 방입니다" }, { status: 409 });

  const { data: players } = await admin.from("room_players").select("uid,seat").eq("room_code", code);
  const list = players ?? [];
  if (list.some((p) => p.uid === uid)) return NextResponse.json({ ok: true }); // 이미 입장
  if (list.length >= MAX_PLAYERS) return NextResponse.json({ error: "정원이 찼습니다" }, { status: 409 });

  await admin.from("room_players").insert({ room_code: code, uid, name: name || "손님", seat: list.length });
  return NextResponse.json({ ok: true });
}
