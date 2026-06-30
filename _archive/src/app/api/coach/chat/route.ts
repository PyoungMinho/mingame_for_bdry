/**
 * POST /api/coach/chat  — SSE 스트리밍
 * Q5=B: 가입 후 3일 무료 → Pro 게이트
 * Claude Sonnet 4.5 메인, 예산 초과 시 gpt-4o-mini → claude-haiku 자동 다운그레이드
 */

import { type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { requireAuth, assertNotAgeBlocked } from "@/lib/server/auth";
import { runRedlineGuard, sanitizeAiResponse } from "@/lib/server/redline";
import { checkGeneralRateLimit, checkAiRateLimit } from "@/lib/server/rate-limit";
import { resolveAiModel, recordAiUsage } from "@/lib/server/ai-budget";
import { assertCoachChatAccess } from "@/lib/server/paywall";
import { buildSystemPromptWithContext } from "@/lib/server/coach-prompts";
import { toErrorResponse, Errors } from "@/lib/server/errors";
import { CoachChatRequestSchema } from "@/lib/shared/schemas";
import type { CoachChatChunk } from "@/lib/shared/schemas";

export const runtime = "edge"; // SSE를 위해 Edge Runtime 사용

export async function POST(req: NextRequest) {
  try {
    // 1. 인증 + 페이월 검사
    const user = await requireAuth(req);
    assertNotAgeBlocked(user);
    assertCoachChatAccess(user);
    await checkGeneralRateLimit(user.id);
    await checkAiRateLimit(user.id);

    // 2. Body 파싱 + 레드라인 검사
    const rawBody = await req.json() as Record<string, unknown>;
    runRedlineGuard(rawBody, {
      checkFields: true,
      messageText: typeof rawBody.message === "string" ? rawBody.message : undefined,
    });

    // 3. Zod 검증
    const parsed = CoachChatRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw Errors.validation(parsed.error.flatten());
    }
    const body = parsed.data;

    // 4. 사용할 AI 모델 결정 (예산 기반 자동 다운그레이드)
    const model = await resolveAiModel(user.id);

    // 5. 오늘 점수 + 북극성 다짐 조회 → 시스템 프롬프트 구성
    // TODO(DB): score_snapshots + users 테이블에서 컨텍스트 조회
    // const todayScore = await db.scoreSnapshots.findFirst({...});
    // const northStar = await db.users.select("north_star_statement").where({id: user.id});
    const todayScore = null;
    const northStar = null;

    const systemPrompt = buildSystemPromptWithContext(body.persona, todayScore, northStar);

    // 6. SSE 스트림 생성
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        function sendChunk(chunk: CoachChatChunk) {
          const data = `data: ${JSON.stringify(chunk)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }

        try {
          if (model === "claude-sonnet-4-5" || model === "claude-haiku") {
            // Anthropic SDK
            const anthropic = new Anthropic({
              apiKey: process.env.ANTHROPIC_API_KEY,
            });

            const anthropicModel =
              model === "claude-sonnet-4-5"
                ? "claude-sonnet-4-5"
                : "claude-haiku-4-5";

            // TODO(실제 LLM 호출): W7~8 활성화
            // const response = await anthropic.messages.stream({
            //   model: anthropicModel,
            //   max_tokens: 1024,
            //   system: systemPrompt,
            //   messages: [
            //     ...(body.history ?? []),
            //     { role: "user", content: body.message },
            //   ],
            // });
            // for await (const event of response) {
            //   if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            //     const sanitized = sanitizeAiResponse(event.delta.text);
            //     sendChunk({ type: "delta", content: sanitized });
            //   }
            // }
            // const finalMsg = await response.finalMessage();
            // await recordAiUsage(user.id, model, finalMsg.usage.input_tokens, finalMsg.usage.output_tokens);

            // --- Stub 응답 (W1~W2) ---
            void anthropic; void anthropicModel; void systemPrompt; void sanitizeAiResponse;
            const stubReply = `안녕하세요! 오늘도 성장을 위해 노력하시는 모습이 멋집니다. [${model} stub 응답]`;
            sendChunk({ type: "delta", content: stubReply });
            await recordAiUsage(user.id, model, 100, 50);
            sendChunk({ type: "done", usage: { promptTokens: 100, completionTokens: 50, estimatedKrw: 0.5 } });

          } else {
            // OpenAI (gpt-4o-mini)
            const openai = new OpenAI({
              apiKey: process.env.OPENAI_API_KEY,
            });

            // TODO(실제 LLM 호출): W7~8 활성화
            // const stream = await openai.chat.completions.create({
            //   model: "gpt-4o-mini",
            //   stream: true,
            //   messages: [
            //     { role: "system", content: systemPrompt },
            //     ...(body.history ?? []),
            //     { role: "user", content: body.message },
            //   ],
            // });
            // for await (const chunk of stream) {
            //   const content = chunk.choices[0]?.delta?.content ?? "";
            //   if (content) {
            //     const sanitized = sanitizeAiResponse(content);
            //     sendChunk({ type: "delta", content: sanitized });
            //   }
            // }

            // --- Stub 응답 (W1~W2) ---
            void openai; void systemPrompt; void sanitizeAiResponse;
            const stubReply = `안녕하세요! [gpt-4o-mini stub 응답]`;
            sendChunk({ type: "delta", content: stubReply });
            await recordAiUsage(user.id, model, 80, 40);
            sendChunk({ type: "done", usage: { promptTokens: 80, completionTokens: 40, estimatedKrw: 0.05 } });
          }
        } catch (err) {
          sendChunk({
            type: "error",
            code: "E_INTERNAL",
            message: err instanceof Error ? err.message : "알 수 없는 오류",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
