/**
 * 모더레이션 2단계.
 * 방향서 아키텍처 #6: 입력 텍스트 + 출력 이미지 모더레이션.
 * 키 없으면 통과 stub (차단 사유 enum은 contract.GenerationErrorCode).
 */
import type { GenerationErrorCode } from "@/lib/contract";

export interface ModerationResult {
  passed: boolean;
  /** 차단된 경우 contract.GenerationErrorCode */
  blockedCode?: GenerationErrorCode;
  /** 차단 이유 (로깅용, 사용자에게 미노출) */
  reason?: string;
}

/* ─── 텍스트 모더레이션 ─── */

/**
 * 입력 일기 텍스트 모더레이션.
 * 미성년/자해/선정/NSFW 키워드 필터링.
 * 키 없으면 통과 stub.
 */
export async function moderateInput(text: string): Promise<ModerationResult> {
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  const hasVertexKey = !!process.env.GCP_PROJECT_ID;

  if (!hasOpenAIKey && !hasVertexKey) {
    console.warn("[Moderation] API 키 없음 → 텍스트 모더레이션 stub (통과)");
    return { passed: true };
  }

  try {
    if (hasOpenAIKey) {
      return await moderateTextOpenAI(text);
    }
    // TODO(W7): Vertex Safety 필터 연동
    return { passed: true };
  } catch (err) {
    console.error("[Moderation] 텍스트 모더레이션 실패, stub 통과", err);
    return { passed: true };
  }
}

/* ─── 이미지 모더레이션 ─── */

/**
 * 출력 이미지 URL 모더레이션.
 * NSFW/얼굴 유사 검사.
 * 키 없으면 통과 stub.
 */
export async function moderateImage(imageUrl: string): Promise<ModerationResult> {
  const hasKey = !!process.env.OPENAI_API_KEY || !!process.env.GCP_PROJECT_ID;

  if (!hasKey) {
    console.warn("[Moderation] API 키 없음 → 이미지 모더레이션 stub (통과)");
    return { passed: true };
  }

  try {
    // TODO(W7): 이미지 URL로 NSFW 분류 API 호출
    // 예: OpenAI Vision API 또는 Google Vision SafeSearch
    return { passed: true };
  } catch (err) {
    console.error("[Moderation] 이미지 모더레이션 실패, stub 통과", err);
    return { passed: true };
  }
}

/* ─── OpenAI Moderation API ─── */

async function moderateTextOpenAI(text: string): Promise<ModerationResult> {
  const res = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ input: text }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI moderation API error: ${res.status}`);
  }

  const data = await res.json();
  const result = data.results?.[0];

  if (!result) return { passed: true };

  if (result.flagged) {
    const categories: string[] = Object.entries(result.categories as Record<string, boolean>)
      .filter(([, v]) => v)
      .map(([k]) => k);

    return {
      passed: false,
      blockedCode: "MODERATION_BLOCKED_INPUT",
      reason: `flagged categories: ${categories.join(", ")}`,
    };
  }

  return { passed: true };
}
