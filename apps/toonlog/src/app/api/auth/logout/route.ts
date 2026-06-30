/**
 * /api/auth/logout
 * - GET:  프론트(mypage)가 window.location.href 로 진입 → 세션 쿠키 제거 후 랜딩으로 302.
 * - POST: 프로그램적 로그아웃(향후 fetch 사용 대비) → 동일 처리, JSON 응답.
 *
 * ⚠️ @supabase/ssr 미설치 → 세션 쿠키를 직접 삭제한다.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  appBaseUrl,
} from "@/server/auth/oauth";

export const dynamic = "force-dynamic";

function clearSessionCookies(res: NextResponse): void {
  const secure = process.env.NODE_ENV === "production";
  for (const name of [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE]) {
    res.cookies.set(name, "", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
}

export async function GET(_req: NextRequest) {
  const res = NextResponse.redirect(`${appBaseUrl()}/`);
  clearSessionCookies(res);
  return res;
}

export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ ok: true, data: { loggedOut: true } });
  clearSessionCookies(res);
  return res;
}
