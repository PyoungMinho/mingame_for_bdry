/**
 * GET /api/quota
 * 현재 사용자의 QuotaInfo 반환.
 * 프론트 QuotaChip 컴포넌트(잔여 한도 표시) 데이터 소스.
 * 인증 필수.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/server/auth/session";

/** DB설계자 의존 — @/lib/db */
import { getQuota } from "@/lib/db";

export async function GET(req: NextRequest) {
  // ── 인증 ──
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const { user } = auth;

  try {
    const quota = await getQuota(user.id);
    return NextResponse.json({ ok: true, data: quota });
  } catch (err) {
    console.error("[Quota] getQuota 실패", err);
    return NextResponse.json(
      {
        ok: false,
        error: { code: "INTERNAL_ERROR", message: "한도 정보를 불러올 수 없습니다." },
      },
      { status: 500 }
    );
  }
}
