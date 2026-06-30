/**
 * GET /api/auth/verify/callback
 * PASS 본인인증 딥링크 콜백 처리.
 *
 * 흐름:
 *  1. PASS 공급사가 이 URL로 리다이렉트 (token, result 쿼리파라미터 포함).
 *  2. 서버에서 토큰 검증 (M0: 모의 통과).
 *  3. profiles.identity_verified = true 갱신.
 *  4. /verify?step=2 로 리다이렉트 → 업로드 Step2(전자동의)로 이어짐.
 *
 * M0 주의:
 *  PASS/통신사 실연동 전이므로 token 파라미터 존재 시 무조건 통과로 처리.
 *  실연동 시 이 핸들러에서 나이스/드림시큐리티 API 호출로 교체.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const token = searchParams.get("token");
  const userId = searchParams.get("userId");
  const result = searchParams.get("result");

  // PASS 실패 케이스
  if (result === "fail" || !token) {
    const failUrl = new URL("/verify", request.url);
    failUrl.searchParams.set("step", "1");
    failUrl.searchParams.set("auth_error", "pass_failed");
    return NextResponse.redirect(failUrl.toString());
  }

  // M0 모의 통과: token 존재 시 identity_verified 갱신
  if (userId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServerClient() as any;
    const { error } = await supabase
      .from("profiles")
      .update({ identity_verified: true, phone_verified: true })
      .eq("id", userId);

    if (error) {
      console.error(`identity_verified 갱신 실패: ${error.message}`);
    }
  }

  const redirectUrl = new URL("/verify", request.url);
  redirectUrl.searchParams.set("step", "2");
  return NextResponse.redirect(redirectUrl.toString());
}
