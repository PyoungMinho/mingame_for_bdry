/**
 * POST /api/onboarding/age-verify
 * 생년월일 입력 → 만16세 미만 차단 (레드라인 R3)
 * 인증 필요 (Supabase 가입 직후 호출)
 */

import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { setAgeBlockedFlag } from "@/lib/server/auth";
import { toErrorResponse, toSuccessResponse, Errors } from "@/lib/server/errors";
import { AgeVerifyRequestSchema } from "@/lib/shared/schemas";
import type { AgeVerifyResponse } from "@/lib/shared/schemas";

/** 만 나이 계산 (KST 기준) */
function calcKoreanAge(birthDate: Date): number {
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000); // KST
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

const MINIMUM_AGE = 16;

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    // Zod 검증
    const rawBody = await req.json() as Record<string, unknown>;
    const parsed = AgeVerifyRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw Errors.validation(parsed.error.flatten());
    }
    const { birthDate } = parsed.data;

    // 나이 계산
    const birth = new Date(birthDate);
    const age = calcKoreanAge(birth);
    const allowed = age >= MINIMUM_AGE;

    // DB 플래그 설정 (차단 여부 저장)
    await setAgeBlockedFlag(user.id, !allowed);

    // TODO(DB): users 테이블 birth_date 저장 (익명화 잡 대응)
    // await db.users.update({
    //   where: { id: user.id },
    //   data: { birth_date: birth, is_age_blocked: !allowed },
    // });

    if (!allowed) {
      // E_AGE_BLOCKED — 프론트는 모달만 표시, CTA 없음, 앱 종료 유도
      throw Errors.ageBlocked(age);
    }

    const responseData: AgeVerifyResponse = { allowed: true, age };
    return toSuccessResponse(responseData);
  } catch (err) {
    return toErrorResponse(err);
  }
}
