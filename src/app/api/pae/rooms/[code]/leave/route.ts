// POST /api/pae/rooms/[code]/leave — 대기방 이탈 (waiting 상태에서만 제거).
// playing/ended 중에는 삭제하지 않는다 → 재접속(join)으로 자리를 되찾을 수 있어야 하므로.
// TODO(B-3 후속): 게임 중 이탈 자동패스는 이번 범위 밖. 현재는 재접속(B-2)으로 커버된다.
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

  // 게임 진행/종료 중이면 자리를 유지(재접속 대비) — 이탈 무시.
  if (room.status !== "waiting") return NextResponse.json({ ok: true });

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
