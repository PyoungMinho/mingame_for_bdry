/**
 * GET /api/auth/callback?code=...
 * OAuth provider 인증 완료 후 리다이렉트 수신 → code를 세션으로 교환 →
 * 세션 토큰을 HttpOnly 쿠키로 설정 → 온보딩(신규)/홈으로 302.
 *
 * ⚠️ @supabase/ssr 미설치 → 세션 쿠키를 직접 설정한다.
 *    requireAuth(session.ts)가 동일 쿠키명으로 토큰을 읽어 검증한다.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForSession,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  appBaseUrl,
} from "@/server/auth/oauth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const base = appBaseUrl();

  if (!code) {
    const errDesc = req.nextUrl.searchParams.get("error_description");
    console.warn("[Auth] callback: code 없음", errDesc);
    return NextResponse.redirect(`${base}/?auth_error=missing_code`);
  }

  const session = await exchangeCodeForSession(code);
  if (!session) {
    return NextResponse.redirect(`${base}/?auth_error=exchange_failed`);
  }

  // 온보딩으로 보냄(신규 유저 아바타 설정). 기존 유저도 온보딩이 홈으로 우회 가능.
  const res = NextResponse.redirect(`${base}/onboarding`);

  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(ACCESS_TOKEN_COOKIE, session.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: session.expiresIn,
  });
  res.cookies.set(REFRESH_TOKEN_COOKIE, session.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30일
  });

  return res;
}
