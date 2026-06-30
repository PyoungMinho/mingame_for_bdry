/**
 * /api/diary
 * - GET:  일기 목록 (아카이브/홈, offset 커서 무한스크롤)
 * - POST: 일기 생성 요청 → quota 검사 → 잡 생성 → 큐 enqueue → SSE URL 반환.
 * 인증 필수 (Supabase 세션).
 */
import { NextRequest, NextResponse } from "next/server";
import {
  createDiaryBodySchema,
  listDiaryQuerySchema,
} from "@/lib/validation/schemas";
import { requireAuth, isAuthError } from "@/server/auth/session";
import { enqueueJob } from "@/server/queue/jobQueue";
import { moderateInput } from "@/server/moderation/moderator";
import type { CreateDiaryResponse } from "@/lib/contract";

/** DB설계자 의존 — @/lib/db */
import {
  createDiary,
  createJob,
  getQuota,
  tryConsumeQuota,
  consumeCredits,
  listDiaries,
} from "@/lib/db";

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 60;

/**
 * GET /api/diary?cursor={offset}&limit={n}&month={YYYY-MM}
 * 프론트 useArchive 계약: { items: Diary[]; nextCursor: string | null; total: number }
 * cursor 는 offset 기반(다음 페이지 시작 인덱스). 더 없으면 nextCursor=null.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const { user } = auth;

  const parsed = listDiaryQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams)
  );
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

  const offset = parsed.data.cursor ? Number(parsed.data.cursor) : 0;
  const limit = Math.min(
    parsed.data.limit ? Number(parsed.data.limit) : DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE
  );

  try {
    // limit+1 조회로 다음 페이지 존재 여부 판단 (offset 커서)
    const rows = await listDiaries(user.id, {
      offset,
      limit: limit + 1,
      month: parsed.data.month,
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? String(offset + limit) : null;

    return NextResponse.json({
      ok: true,
      data: { items, nextCursor, total: items.length },
    });
  } catch (err) {
    console.error("[Diary] listDiaries 실패", err);
    return NextResponse.json(
      {
        ok: false,
        error: { code: "INTERNAL_ERROR", message: "일기 목록을 불러올 수 없습니다." },
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
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

  const parsed = createDiaryBodySchema.safeParse(body);
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

  const { text, artStyle, avatar } = parsed.data;

  // ── 입력 텍스트 사전 모더레이션 ──
  const modResult = await moderateInput(text);
  if (!modResult.passed) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "MODERATION_BLOCKED_INPUT",
          message: "일기 내용이 가이드라인에 맞지 않습니다. 다시 작성해 주세요.",
        },
      },
      { status: 422 }
    );
  }

  // ── Quota 검사 ──
  const quota = await getQuota(user.id);
  // remaining: QuotaInfo.remaining, credits: QuotaInfo.credits
  if (quota.remaining <= 0 && quota.credits <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "QUOTA_EXCEEDED",
          message: "이번 주기 생성 한도를 모두 사용했습니다. 내일 다시 이용하거나 요금제를 업그레이드하세요.",
        },
      },
      { status: 429 }
    );
  }

  // ── Quota 차감 (tryConsumeQuota: { ok, remaining, usedCredits } 반환) ──
  // 한도 내면 tier quota 차감, 한도 초과면 크레딧으로 폴백 (design §4 플로우B).
  const consumed = await tryConsumeQuota(user.id, 1);
  if (!consumed.ok) {
    if (quota.credits > 0) {
      // tier 한도 소진 → 크레딧 1 차감 (잔액 부족 시 throw → QUOTA_EXCEEDED)
      try {
        await consumeCredits(user.id, 1);
      } catch {
        return NextResponse.json(
          {
            ok: false,
            error: { code: "QUOTA_EXCEEDED", message: "생성 한도를 초과했습니다." },
          },
          { status: 429 }
        );
      }
    } else {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "QUOTA_EXCEEDED",
            message: "생성 한도를 초과했습니다.",
          },
        },
        { status: 429 }
      );
    }
  }

  // ── Diary + Job 생성 ──
  // createDiary(userId: string, input: CreateDiaryRequest) — DB설계자 실제 시그니처
  const diary = await createDiary(user.id, { text, artStyle, avatar });

  // createJob(diaryId: string) → Promise<string> (DB설계자 실제 시그니처)
  const jobId = await createJob(diary.id);

  // ── 큐 enqueue ──
  await enqueueJob({
    jobId,
    diaryId: diary.id,
    userId: user.id,
    tier: quota.tier,
    batchable: false,
    createdAt: Date.now(),
  });

  const response: CreateDiaryResponse = {
    diaryId: diary.id,
    jobId,
    // 계약 확정: 반드시 jobId 쿼리 포함 — stream route가 정확한 잡을 추적 (gap #2)
    streamUrl: `/api/diary/${diary.id}/stream?jobId=${jobId}`,
  };

  return NextResponse.json({ ok: true, data: response }, { status: 202 });
}
