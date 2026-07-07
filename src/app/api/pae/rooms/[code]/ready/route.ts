// POST /api/pae/rooms/[code]/ready — 결과화면 "준비완료" 토글.
//  내 ready를 set하고, 접속(활성) 참가자 전원이 ready면 다음 라운드를 자동 시작한다.
//  중복 시작 방지를 위해 CAS(status가 'ended'일 때만 커밋)를 쓴다.
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/pae/supabase-admin";
import { uidFromReq } from "@/lib/pae/auth";
import { nextRound } from "@/lib/pae/engine";
import { buildState, toPublic, type PublicState } from "@/lib/pae/room-state";
import { makeRng } from "@/lib/pae/tiles";
import type { Tile } from "@/lib/pae/tiles";

const AWAY_MS = 20000;

export async function POST(req: NextRequest, ctx: { params: { code: string } }) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase 미설정" }, { status: 500 });
  const uid = await uidFromReq(req);
  if (!uid) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const code = ctx.params.code.toUpperCase();
  const { ready } = (await req.json().catch(() => ({}))) as { ready?: boolean };

  // 내 ready set + heartbeat
  await admin
    .from("room_players")
    .update({ ready: ready !== false, last_seen: new Date().toISOString() })
    .eq("room_code", code)
    .eq("uid", uid);

  const [{ data: room }, { data: players }] = await Promise.all([
    admin.from("rooms").select("public_state,status").eq("code", code).single(),
    admin.from("room_players").select("uid,seat,last_seen,ready").eq("room_code", code).order("seat"),
  ]);
  if (!room) return NextResponse.json({ error: "방을 찾을 수 없습니다" }, { status: 404 });

  const pub = room.public_state as PublicState | null;
  // 라운드 종료 상태가 아니면 레디만 반영하고 끝.
  if (!pub || pub.phase !== "ended") return NextResponse.json({ ok: true });

  // 접속(활성, last_seen 최근) 참가자 전원이 ready인지 확인.
  const now = Date.now();
  const list = players ?? [];
  const active = list.filter((p) => now - new Date(p.last_seen as string).getTime() <= AWAY_MS);
  const allReady = active.length > 0 && active.every((p) => p.ready === true);
  if (!allReady) return NextResponse.json({ ok: true });

  // 다음 라운드 — CAS: status가 'ended'일 때만 커밋(동시 전원레디 중복 시작 방지).
  const { data: handRows } = await admin.from("hands").select("uid,tiles").eq("room_code", code);
  const state = buildState(pub, (handRows ?? []) as { uid: string; tiles: Tile[] }[]);
  const seed = Math.floor(Math.random() * 2 ** 31);
  const next = nextRound(state, makeRng(seed));
  const { data: committed } = await admin
    .from("rooms")
    .update({ public_state: { ...toPublic(next), turnAt: Date.now() }, status: "playing", updated_at: new Date().toISOString() })
    .eq("code", code)
    .eq("status", "ended")
    .select("code");

  if (committed && committed.length > 0) {
    // 새 딜 저장 + 전원 ready 리셋 + last_seen 리셋(새 라운드 타이머 기준).
    const rows = next.players.map((p, i) => ({ room_code: code, uid: p.id, tiles: next.hands[i] }));
    await admin.from("hands").upsert(rows);
    await admin.from("room_players").update({ ready: false, last_seen: new Date().toISOString() }).eq("room_code", code);
  }
  return NextResponse.json({ ok: true });
}
