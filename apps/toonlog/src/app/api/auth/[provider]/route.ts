/**
 * GET /api/auth/{provider}  (provider = google | kakao)
 * 소셜 로그인 시작 — 프론트가 window.location.href 로 진입.
 * Supabase signInWithOAuth(skipBrowserRedirect)로 provider 인증 URL을 받아 302 리다이렉트.
 *
 * 미설정(키 없음) 시: 온보딩으로 안내(데모 환경에서 흐름 유지).
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getOAuthRedirectUrl,
  isOAuthConfigured,
  isSupportedProvider,
  appBaseUrl,
} from "@/server/auth/oauth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  if (!isSupportedProvider(provider)) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "UNSUPPORTED_PROVIDER", message: "지원하지 않는 로그인 방식입니다." },
      },
      { status: 400 }
    );
  }

  // 키 미설정(개발/데모) — OAuth 불가 시 온보딩으로 보내 흐름 유지
  if (!isOAuthConfigured()) {
    console.warn("[Auth] Supabase 키 없음 → OAuth 생략, 온보딩으로 리다이렉트");
    return NextResponse.redirect(`${appBaseUrl()}/onboarding`);
  }

  const url = await getOAuthRedirectUrl(provider);
  if (!url) {
    return NextResponse.redirect(
      `${appBaseUrl()}/?auth_error=oauth_init_failed`
    );
  }

  return NextResponse.redirect(url);
}
