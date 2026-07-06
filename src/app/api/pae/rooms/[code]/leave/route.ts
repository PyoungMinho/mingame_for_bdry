// POST /api/pae/rooms/[code]/leave — 이탈.
// · waiting: 자리 제거 후 seat 재정렬(로비에서 빠짐).
// · playing/ended: 명시적 나가기이므로 last_seen을 과거로 밀어 "즉시 자리비움" 처리
//   → 다음 tick에서 그 좌석이 자동 스킵된다. (자리는 유지 → 마음 바뀌면 재접속 가능)
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/pae/supabase-admin";
import { uidFromReq } from "@/lib/pae/auth";

export async function POST(req: NextRequest, ctx: { params: { code: string } }) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase 미설정" }, { status: 500 });
  const uid = await uidFromReq(req);
  if (!uid) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const code = ctx.params.code.toUpperCase();
  const { data: room } = await admin.from("rooms").select("status").eq("code", code).single();
  if (!room) return NextResponse.json({ error: "방을 찾을 수 없습니다" }, { status: 404 });

  // 게임 진행/종료 중: 자리는 유지하되 last_seen을 과거로 밀어 즉시 자리비움 → tick이 자동 스킵.
  if (room.status !== "waiting") {
    await admin.from("room_players").update({ last_seen: new Date(0).toISOString() }).eq("room_code", code).eq("uid", uid);
    return NextResponse.json({ ok: true });
  }

  // 대기 중이면 제거 후 남은 seat을 0..n-1로 재정렬.
  await admin.from("room_players").delete().eq("room_code", code).eq("uid", uid);

  const { data: rest } = await admin
    .from("room_players")
    .select("uid,seat")
    .eq("room_code", code)
    .order("seat");
  const list = rest ?? [];
  for (let i = 0; i < list.length; i++) {
    if (list[i].seat !== i) {
      await admin.from("room_players").update({ seat: i }).eq("room_code", code).eq("uid", list[i].uid as string);
    }
  }

  return NextResponse.json({ ok: true });
}
