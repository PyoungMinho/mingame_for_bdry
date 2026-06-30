/**
 * Supabase OAuth 서버 헬퍼 (소셜 로그인).
 *
 * ⚠️ 제약: 이 프로젝트는 `@supabase/ssr` 미설치(supabase-js 단독).
 * 프로덕션 권장은 @supabase/ssr 의 createServerClient + 쿠키 핸들러지만,
 * MVP/데모에서는 supabase-js 로 최소 일관 구현하여 프론트가 404 를 만나지 않게 한다.
 *
 * 흐름(서버 리다이렉트 방식 — 프론트가 window.location.href 로 진입):
 *   1) GET /api/auth/{provider} → signInWithOAuth(skipBrowserRedirect) 로 provider URL 취득 → 302
 *   2) provider 인증 후 GET /api/auth/callback?code=... → exchangeCodeForSession → 세션 쿠키 설정 → 302
 *   3) GET /api/auth/logout → signOut + 세션 쿠키 제거 → 302 (랜딩)
 */
import { createClient } from "@supabase/supabase-js";

export const SUPPORTED_OAUTH_PROVIDERS = ["google", "kakao"] as const;
export type OAuthProvider = (typeof SUPPORTED_OAUTH_PROVIDERS)[number];

/** 세션 쿠키 이름 — requireAuth(session.ts)와 공유 */
export const ACCESS_TOKEN_COOKIE = "toonlog-access-token";
export const REFRESH_TOKEN_COOKIE = "toonlog-refresh-token";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isOAuthConfigured(): boolean {
  return !!SUPABASE_URL && !!ANON_KEY;
}

export function isSupportedProvider(p: string): p is OAuthProvider {
  return (SUPPORTED_OAUTH_PROVIDERS as readonly string[]).includes(p);
}

/** 앱 베이스 URL (리다이렉트 절대경로 구성용) */
export function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3003"
  );
}

/** OAuth 전용 anon 클라이언트 (세션 비영속) */
function oauthClient() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * provider 인증 URL 생성. 성공 시 리다이렉트할 절대 URL 문자열 반환.
 * 실패 시 null.
 */
export async function getOAuthRedirectUrl(
  provider: OAuthProvider
): Promise<string | null> {
  const supabase = oauthClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${appBaseUrl()}/api/auth/callback`,
      skipBrowserRedirect: true,
    },
  });
  if (error || !data?.url) {
    console.error(`[OAuth] signInWithOAuth(${provider}) 실패`, error);
    return null;
  }
  return data.url;
}

/**
 * authorization code → 세션 교환.
 * 성공 시 { accessToken, refreshToken, expiresIn } 반환, 실패 시 null.
 */
export async function exchangeCodeForSession(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} | null> {
  const supabase = oauthClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data?.session) {
    console.error("[OAuth] exchangeCodeForSession 실패", error);
    return null;
  }
  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in ?? 3600,
  };
}
