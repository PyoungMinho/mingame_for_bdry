/**
 * GET /api/diary/[id]/stream
 * SSE 스트리밍 엔드포인트.
 * ToonlogSSEEvent를 `event:`/`data:` 라인으로 직렬화.
 * MockProvider 사용 시: status→panel×4(지연)→done 순으로 데모 동작.
 * 방향서 아키텍처 #4: 1컷부터 즉시 push.
 */
import { NextRequest } from "next/server";
import { requireAuth, isAuthError } from "@/server/auth/session";
import {
  runGenerationPipeline,
  runRegeneratePipeline,
} from "@/server/pipeline/generator";
import type { ToonlogSSEEvent, PanelIndex } from "@/lib/contract";

/** DB설계자 의존 — @/lib/db */
import { getDiary, getLatestJobByDiary, refundQuota, failJob } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: diaryId } = await params;

  // ── 인증 ──
  const auth = await requireAuth(req);
  if (isAuthError(auth)) {
    // SSE 연결 실패는 JSON으로 반환
    return auth;
  }
  const { user } = auth;

  // ── 소유권 검사 ──
  // getDiary returns Diary | null (DB설계자 실제 시그니처)
  const diary = await getDiary(diaryId).catch(() => null);

  if (!diary) {
    return new Response(
      formatSSEError("UNKNOWN", "일기를 찾을 수 없습니다.", false),
      { status: 404, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  if (diary.userId !== user.id) {
    return new Response(
      formatSSEError("UNKNOWN", "접근 권한이 없습니다.", false),
      { status: 403, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  // ── SSE ReadableStream 생성 ──
  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController | null = null;
  let streamClosed = false;

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller;
    },
    cancel() {
      streamClosed = true;
    },
  });

  // ── SSE emit 함수 ──
  function emit(event: ToonlogSSEEvent) {
    if (streamClosed || !controllerRef) return;
    try {
      const serialized = serializeSSEEvent(event);
      controllerRef.enqueue(encoder.encode(serialized));
    } catch {
      // 클라이언트 연결 끊김 — 무시
    }
  }

  // ── 파이프라인 비동기 실행 ──
  // jobId 해석: 쿼리 우선 → 없으면 diaryId 로 최신 잡 추론(프론트 SSE 훅이 jobId 미전달).
  // 그래도 없으면 placeholder(개발/데모 mock 경로용).
  const jobIdParam = req.nextUrl.searchParams.get("jobId");
  const latestJob = jobIdParam ? null : await getLatestJobByDiary(diaryId).catch(() => null);
  const jobId = jobIdParam ?? latestJob?.jobId ?? `job-${diaryId}`;

  // 특정 컷 재생성 여부 (regenerate route 가 panelIndex 쿼리 전달)
  const panelIndexParam = req.nextUrl.searchParams.get("panelIndex");
  const regenPanelIndex =
    panelIndexParam && /^[1-4]$/.test(panelIndexParam)
      ? (Number(panelIndexParam) as PanelIndex)
      : undefined;

  setImmediate(async () => {
    let isSystemFailure = false;
    let lastErrorCode = "UNKNOWN";
    const onEvent = (event: ToonlogSSEEvent) => {
      emit(event);
      // 시스템 실패 감지 (error + retryable=true는 시스템 실패)
      if (
        event.type === "error" &&
        event.retryable &&
        event.code !== "MODERATION_BLOCKED_OUTPUT"
      ) {
        isSystemFailure = true;
        lastErrorCode = event.code;
      }
    };
    try {
      const pipelineInput = {
        jobId,
        diaryId,
        userId: user.id,
        diaryText: diary.text,
        artStyle: diary.artStyle,
        avatar: diary.avatar,
      };
      if (regenPanelIndex) {
        await runRegeneratePipeline({ ...pipelineInput, panelIndex: regenPanelIndex }, onEvent);
      } else {
        await runGenerationPipeline(pipelineInput, onEvent);
      }
    } catch (err) {
      console.error("[SSE] 파이프라인 예외", err);
      isSystemFailure = true;
      lastErrorCode = "UNKNOWN";
      emit({
        type: "error",
        jobId,
        code: "UNKNOWN",
        message: "생성 중 오류가 발생했습니다.",
        retryable: true,
      });
    } finally {
      // 시스템 실패 시: 잡 실패 기록 + quota 환불 (design-final §10 충돌해소 #6)
      if (isSystemFailure) {
        await failJob(jobId, lastErrorCode).catch((e) =>
          console.error("[SSE] failJob 기록 실패", e)
        );
        await refundQuota(user.id).catch((e) =>
          console.error("[SSE] quota 환불 실패", e)
        );
      }
      if (!streamClosed && controllerRef) {
        try {
          controllerRef.close();
        } catch {
          // 이미 닫힘
        }
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // nginx 버퍼링 비활성
    },
  });
}

/* ─── SSE 직렬화 헬퍼 ─── */

/**
 * ToonlogSSEEvent → `event:`/`data:` 라인 형식.
 * 프론트는 EventSource.addEventListener(event.type, ...) 패턴으로 수신.
 */
function serializeSSEEvent(event: ToonlogSSEEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

function formatSSEError(
  code: string,
  message: string,
  retryable: boolean
): string {
  const event: ToonlogSSEEvent = {
    type: "error",
    jobId: "unknown",
    code: code as import("@/lib/contract").GenerationErrorCode,
    message,
    retryable,
  };
  return serializeSSEEvent(event);
}
