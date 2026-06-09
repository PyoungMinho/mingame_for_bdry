/**
 * POST /api/exam/generate — 원본 문항(텍스트/이미지)으로 변형 문항 생성
 * GET  /api/exam/generate — 실행 모드(live/demo) 조회
 *
 * ANTHROPIC_API_KEY가 있으면 실제 Claude, 없으면 데모 샘플로 동작.
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { detectMode, generateVariants } from "@/lib/server/exam-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z
  .object({
    source: z.string().max(8000).optional().default(""),
    imageBase64: z.string().max(8_000_000).optional(), // base64 기준 약 6MB 이미지
    imageMediaType: z.enum(["image/png", "image/jpeg", "image/webp"]).optional(),
    subject: z.enum(["english", "math", "korean", "science", "social"]),
    difficulty: z.enum(["easy", "medium", "hard"]),
    count: z.coerce.number().int().min(1).max(10),
    type: z.enum(["multiple_choice", "short_answer"]),
    tier: z.enum(["free", "pro"]).optional().default("pro"),
    unitId: z.string().max(64).optional(),
  })
  .refine((d) => d.source.trim().length > 0 || !!d.imageBase64, {
    message: "원본 문항 텍스트나 이미지를 입력하세요",
    path: ["source"],
  })
  .refine((d) => !d.imageBase64 || !!d.imageMediaType, {
    message: "이미지 형식(imageMediaType)이 필요합니다",
    path: ["imageMediaType"],
  });

export async function GET() {
  return Response.json({ mode: detectMode() });
}

export async function POST(req: NextRequest) {
  let parsed: z.infer<typeof BodySchema>;
  try {
    const raw = await req.json();
    const result = BodySchema.safeParse(raw);
    if (!result.success) {
      return Response.json(
        { error: result.error.flatten().fieldErrors, code: "E_VALIDATION" },
        { status: 400 }
      );
    }
    parsed = result.data;
  } catch {
    return Response.json(
      { error: "잘못된 요청 본문입니다", code: "E_BAD_JSON" },
      { status: 400 }
    );
  }

  try {
    const result = await generateVariants(parsed);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "생성 중 오류가 발생했습니다";
    return Response.json({ error: message, code: "E_GENERATE" }, { status: 502 });
  }
}
