// POST /api/pae/rooms — 방 생성 (생성자가 방장 seat 0).
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/pae/supabase-admin";
import { uidFromReq } from "@/lib/pae/auth";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode(): string {
  let s = "";
  for (let i = 0; i < 5; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

export async function POST(req: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase 미설정" }, { status: 500 });
  const uid = await uidFromReq(req);
  if (!uid) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  const code = randomCode();

  const { error } = await admin.from("rooms").insert({ code, status: "waiting", host_uid: uid });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.from("room_players").insert({ room_code: code, uid, name: name || "방장", seat: 0 });

  return NextResponse.json({ code });
}
