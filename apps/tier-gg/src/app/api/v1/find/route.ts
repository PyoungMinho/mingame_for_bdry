/**
 * POST /api/v1/find
 * 위저드 — 역할/작업/예산 기반 모델 추천 (Top3)
 * 캐시 없음 (POST이므로 CDN 캐시 불가)
 *
 * Body (JSON):
 *   role   — developer | marketer | student | researcher | designer | pm | other
 *   task   — coding | writing | summarization | translation | image_generation | data_analysis | customer_support | research | other
 *   budget — free | low | mid | high
 */
import { NextRequest } from "next/server";
import { recommendModels } from "@/lib/api/wizard";
import { WizardInputSchema } from "@/lib/api/schemas";
import { okNoCache, Errors } from "@/lib/api/response";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest("Invalid JSON body");
  }

  const parsed = WizardInputSchema.safeParse(body);
  if (!parsed.success) {
    return Errors.validationError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
    );
  }

  try {
    const recommendations = await recommendModels(parsed.data);
    return okNoCache(
      {
        recommendations,
        weights: {
          benchmark: 0.4,
          priceEfficiency: 0.4,
          other: 0.2,
        },
        input: parsed.data,
      },
      { total: recommendations.length }
    );
  } catch {
    return Errors.internalError();
  }
}
