/**
 * Supabase 세션 헬퍼.
 * 보호 라우트에서 호출 — 세션 없으면 401 응답(NextResponse) 반환.
 *
 * ⚠️ @supabase/ssr 미설치 환경. 세션 토큰은 OAuth 콜백이 설정한 쿠키
 * (oauth.ts: ACCESS_TOKEN_COOKIE) 또는 Authorization: Bearer 헤더에서 추출하여
 * supabaseServer().auth.getUser(token) 으로 검증한다.
 * 프로덕션 권장: @supabase/ssr createServerClient 도입 후 이 모듈 교체.
 */
import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

/** DB설계자 의존: @/lib/db에서 제공 */
import { supabaseServer } from "@/lib/db";
import { ACCESS_TOKEN_COOKIE } from "@/server/auth/oauth";

export interface AuthResult {
  user: User;
}

/** 요청에서 access token 추출 (쿠키 우선, 그다음 Authorization 헤더) */
function extractAccessToken(req: NextRequest): string | null {
  const cookieToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim() || null;
  }
  return null;
}

function unauthorized(message: string): NextResponse {
  return NextResponse.json(
    { ok: false, error: { code: "UNAUTHORIZED", message } },
    { status: 401 }
  );
}

/**
 * Route Handler 내에서 인증 유저를 가져온다.
 * 인증 실패 시 NextResponse(401)를 반환. 성공 시 { user } 반환.
 */
export async function requireAuth(
  req: NextRequest
): Promise<{ user: User } | NextResponse> {
  try {
    const token = extractAccessToken(req);
    if (!token) {
      return unauthorized("로그인이 필요합니다.");
    }

    const supabase = supabaseServer();
    // 토큰 기반 검증 — service role 클라이언트로 JWT 유효성 + 유저 확인
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return unauthorized("로그인이 필요합니다.");
    }

    return { user };
  } catch {
    return unauthorized("인증 처리 중 오류가 발생했습니다.");
  }
}

/** 인증 결과가 NextResponse(에러)인지 판별 */
export function isAuthError(
  result: AuthResult | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
