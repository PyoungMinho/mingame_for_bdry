/**
 * PATCH /api/diary/[id]/balloons
 * 말풍선 에디터 저장 — 컷별 balloons 메타(좌표/타입/꼬리/suggested_text) 갱신.
 * 한글 미생성 원칙: 텍스트는 suggested_text 로만 보관(이미지 미반영).
 * 소유권 검사 필수 + 타입별 글자수 상한 검증(design-final §6.3).
 * 인증 필수.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/server/auth/session";
import { updateBalloonsBodySchema } from "@/lib/validation/schemas";
import { BALLOON_CHAR_LIMITS } from "@/lib/constants";

/** DB설계자 의존 — @/lib/db */
import { getDiary, updatePanelBalloons } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: diaryId } = await params;

  // ── 인증 ──
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const { user } = auth;

  // ── 입력 검증 ──
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "INVALID_JSON", message: "요청 본문이 올바른 JSON이 아닙니다." },
      },
      { status: 400 }
    );
  }

  const parsed = updateBalloonsBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues.map((i) => i.message).join(", "),
        },
      },
      { status: 400 }
    );
  }

  // ── 타입별 글자수 상한 검증 (design-final §6.3) ──
  for (const panel of parsed.data.panels) {
    for (const b of panel.balloons) {
      const limit = BALLOON_CHAR_LIMITS[b.type];
      if (b.suggested_text && b.suggested_text.length > limit) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "VALIDATION_ERROR",
              message: `${b.type} 말풍선은 최대 ${limit}자까지 입력할 수 있습니다.`,
            },
          },
          { status: 400 }
        );
      }
    }
  }

  // ── 소유권 검사 ──
  const diary = await getDiary(diaryId).catch(() => null);
  if (!diary) {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND", message: "일기를 찾을 수 없습니다." } },
      { status: 404 }
    );
  }
  if (diary.userId !== user.id) {
    return NextResponse.json(
      { ok: false, error: { code: "FORBIDDEN", message: "접근 권한이 없습니다." } },
      { status: 403 }
    );
  }

  // ── 저장 ──
  try {
    await updatePanelBalloons(
      diaryId,
      parsed.data.panels.map((p) => ({ index: p.index, balloons: p.balloons }))
    );
    return NextResponse.json({ ok: true, data: { diaryId, updated: parsed.data.panels.length } });
  } catch (err) {
    console.error("[Balloons] 저장 실패", err);
    return NextResponse.json(
      {
        ok: false,
        error: { code: "INTERNAL_ERROR", message: "말풍선 저장에 실패했습니다." },
      },
      { status: 500 }
    );
  }
}
