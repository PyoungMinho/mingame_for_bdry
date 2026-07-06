// POST /api/pae/rooms/[code]/action — 조합 내기/패스. 서버가 엔진으로 검증 후에만 반영.
import { NextRequest, NextResponse } from "next/server";
import { uidFromReq } from "@/lib/pae/auth";
import { play, pass } from "@/lib/pae/engine";
import { loadGame, saveGame, toPublic } from "@/lib/pae/room-state";
import type { Tile } from "@/lib/pae/tiles";

export async function POST(req: NextRequest, ctx: { params: { code: string } }) {
  const uid = await uidFromReq(req);
  if (!uid) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const code = ctx.params.code.toUpperCase();
  const body = (await req.json().catch(() => ({}))) as { action?: "play" | "pass"; tiles?: Tile[] };

  const state = await loadGame(code);
  if (!state) return NextResponse.json({ error: "진행 중인 게임이 없습니다" }, { status: 404 });

  const seat = state.players.findIndex((p) => p.id === uid);
  if (seat < 0) return NextResponse.json({ error: "참가자가 아닙니다" }, { status: 403 });

  const result = body.action === "pass" ? pass(state, seat) : play(state, seat, body.tiles ?? []);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await saveGame(code, result.state);
  // 낸 사람이 refresh 왕복 없이 즉시 반영하도록, 최신 공개상태 + 본인 손패를 함께 돌려준다.
  return NextResponse.json({ ok: true, publicState: toPublic(result.state), myHand: result.state.hands[seat] ?? [] });
}
