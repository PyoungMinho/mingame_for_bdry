// 오후의 패 — API 요청의 익명 사용자 신원 검증.
// 클라이언트가 보낸 access token을 service_role로 검증해 uid를 얻는다.
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/pae/supabase-admin";

export async function uidFromReq(req: NextRequest): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error) return null;
  return data.user?.id ?? null;
}
