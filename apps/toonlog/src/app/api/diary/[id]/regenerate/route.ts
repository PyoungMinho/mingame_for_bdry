/**
 * POST /api/diary/[id]/regenerate
 * 자발적 재생성 요청.
 * design-final §10 충돌해소 #6: 자발적 재생성 = quota 차감.
 * panelIndex 지정 시 특정 컷만, 없으면 전체 재생성.
 * 인증 필수.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/server/auth/session";
import { regenerateBodySchema } from "@/lib/validation/schemas";

/** DB설계자 의존 — @/lib/db */
import {
  getDiary,
  createJob,
  getQuota,
  tryConsumeQuota,
  consumeCredits,
  updateDiaryStatus,
} from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: diaryId } = await params;

  // ── 인증 ──
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const { user } = auth;

  // ── 입력 검증 ──
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "INVALID_JSON", message: "요청 본문이 올바른 JSON이 아닙니다." },
      },
      { status: 400 }
    );
  }

  const parsed = regenerateBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues.map((i) => i.message).join(", "),
        },
      },
      { status: 400 }
    );
  }

  const { panelIndex } = parsed.data;

  // ── 소유권 검사 ──
  // getDiary returns Diary | null (DB설계자 실제 시그니처)
  const diary = await getDiary(diaryId).catch(() => null);

  if (!diary) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "NOT_FOUND", message: "일기를 찾을 수 없습니다." },
      },
      { status: 404 }
    );
  }

  if (diary.userId !== user.id) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "FORBIDDEN", message: "접근 권한이 없습니다." },
      },
      { status: 403 }
    );
  }

  // ── Quota 검사 (자발적 재생성 = 차감) ──
  const quota = await getQuota(user.id);
  if (quota.remaining <= 0 && quota.credits <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "QUOTA_EXCEEDED",
          message: "재생성 한도를 모두 사용했습니다. 내일 다시 이용하거나 요금제를 업그레이드하세요.",
        },
      },
      { status: 429 }
    );
  }

  // 자발적 재생성 — quota 차감 (design §10 #6: 자발적=차감 유지).
  // tryConsumeQuota: { ok, remaining, usedCredits } — 한도 초과 시 크레딧 폴백.
  const consumed = await tryConsumeQuota(user.id, 1);
  if (!consumed.ok) {
    if (quota.credits > 0) {
      try {
        await consumeCredits(user.id, 1);
      } catch {
        return NextResponse.json(
          {
            ok: false,
            error: { code: "QUOTA_EXCEEDED", message: "재생성 한도를 초과했습니다." },
          },
          { status: 429 }
        );
      }
    } else {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "QUOTA_EXCEEDED", message: "재생성 한도를 초과했습니다." },
        },
        { status: 429 }
      );
    }
  }

  // ── 새 잡 생성 ──
  // createJob(diaryId: string) → Promise<string> (DB설계자 실제 시그니처)
  const newJobId = await createJob(diaryId);

  await updateDiaryStatus(diaryId, "generating");

  // streamUrl: jobId + (있으면) panelIndex 포함 — stream route가 정확히 라우팅
  const streamUrl = panelIndex
    ? `/api/diary/${diaryId}/stream?jobId=${newJobId}&panelIndex=${panelIndex}`
    : `/api/diary/${diaryId}/stream?jobId=${newJobId}`;

  return NextResponse.json(
    {
      ok: true,
      data: {
        jobId: newJobId,
        diaryId,
        streamUrl,
        message: panelIndex
          ? `${panelIndex}번 컷 재생성이 시작되었습니다.`
          : "전체 재생성이 시작되었습니다.",
      },
    },
    { status: 202 }
  );
}
