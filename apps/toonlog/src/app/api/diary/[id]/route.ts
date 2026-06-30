/**
 * GET /api/diary/[id]
 * 특정 일기 조회. 소유권 검사 필수.
 * 인증 필수.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/server/auth/session";

/** DB설계자 의존 — @/lib/db */
import { getDiary } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: diaryId } = await params;

  // ── 인증 ──
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const { user } = auth;

  // ── 일기 조회 + 소유권 검사 ──
  // getDiary returns Diary | null (DB설계자 실제 시그니처)
  try {
    const diary = await getDiary(diaryId);

    if (!diary) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "NOT_FOUND", message: "일기를 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    if (diary.userId !== user.id) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "FORBIDDEN", message: "접근 권한이 없습니다." },
        },
        { status: 403 }
      );
    }

    return NextResponse.json({ ok: true, data: diary });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "NOT_FOUND", message: "일기를 찾을 수 없습니다." },
      },
      { status: 404 }
    );
  }
}
