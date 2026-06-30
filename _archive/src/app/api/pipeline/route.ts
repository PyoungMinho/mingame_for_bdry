/**
 * POST /api/pipeline — 팀메이크 AI 팀 파이프라인 SSE 스트림
 * 주제를 받아 16명 에이전트를 단계별로 구동하고, 각 이벤트를 SSE로 흘려보낸다.
 * GET /api/pipeline — 실행 모드(live/demo) + 단계 메타 조회
 *
 * ANTHROPIC_API_KEY가 있으면 실제 Claude, 없으면 데모 시뮬레이션으로 동작.
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { runPipeline, detectMode, type EngineEvent } from "@/lib/server/team-engine";
import { PIPELINE } from "@/lib/server/team-agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STAGE_IDS = PIPELINE.map((s) => s.id);

const BodySchema = z.object({
  topic: z
    .string()
    .trim()
    .min(1, "주제를 입력하세요")
    .max(500, "주제는 500자 이하여야 합니다"),
  stageIds: z
    .array(z.string())
    .optional()
    .refine(
      (ids) => !ids || ids.every((id) => VALID_STAGE_IDS.includes(id)),
      { message: "유효하지 않은 단계 ID가 포함되어 있습니다" }
    ),
});

export async function GET() {
  return Response.json({
    mode: detectMode(),
    stages: PIPELINE.map((s) => ({ id: s.id, label: s.label, sub: s.sub })),
  });
}

export async function POST(req: NextRequest) {
  let body: z.infer<typeof BodySchema>;
  try {
    const raw = await req.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.flatten().fieldErrors, code: "E_VALIDATION" },
        { status: 400 }
      );
    }
    body = parsed.data;
  } catch {
    return Response.json(
      { error: "잘못된 요청 본문입니다", code: "E_BAD_JSON" },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (ev: EngineEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
      };
      const onAbort = () => {
        closed = true;
      };
      req.signal.addEventListener("abort", onAbort);

      try {
        for await (const ev of runPipeline({
          topic: body.topic,
          stageIds: body.stageIds,
        })) {
          if (req.signal.aborted) break;
          send(ev);
        }
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "알 수 없는 오류",
        });
      } finally {
        req.signal.removeEventListener("abort", onAbort);
        if (!closed) {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
