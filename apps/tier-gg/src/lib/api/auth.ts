/**
 * 관리자 인증 미들웨어
 * Authorization: Bearer <supabase_jwt> 헤더 검증
 * 환경변수 ADMIN_EMAIL과 일치하는 사용자만 통과
 */
import { supabaseAdmin } from "@/lib/supabase/server";
import { Errors } from "./response";
import { NextRequest, NextResponse } from "next/server";

export async function requireAdmin(
  req: NextRequest
): Promise<{ userId: string; email: string } | NextResponse> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return Errors.unauthorized();
  }

  const token = authHeader.slice(7);
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!adminEmail) {
    console.error("ADMIN_EMAIL env var not set");
    return Errors.internalError();
  }

  // Supabase JWT 검증 — service role 클라이언트로 user 조회
  const { data: userData, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !userData?.user) {
    return Errors.unauthorized();
  }

  const userEmail = userData.user.email;

  if (userEmail !== adminEmail) {
    return Errors.forbidden();
  }

  return { userId: userData.user.id, email: userEmail };
}
