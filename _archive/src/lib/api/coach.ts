// REDLINE: 타인 비교/외모 점수 UI 금지
import { useAuthStore } from "@/lib/store/auth";
import { OreumApiError } from "@/lib/api/client";
import type { CoachChatRequest, CoachChatChunk } from "@/lib/shared/schemas";

// ---------------------------------------------------------------------------
// SSE 코치챗 클라이언트
// POST /api/coach/chat — 스트리밍 응답 (text/event-stream)
// ---------------------------------------------------------------------------

export interface StreamOptions {
  onDelta: (content: string) => void;
  onDone: (usage: { promptTokens: number; completionTokens: number; estimatedKrw: number }) => void;
  onError: (err: OreumApiError) => void;
  signal?: AbortSignal;
}

/**
 * 코치챗 SSE 스트리밍 요청
 * Q5=B: 3일 무료 체험 카운트 체크는 gate.ts에서 선행 처리 후 호출
 */
export async function streamCoachChat(
  body: CoachChatRequest,
  options: StreamOptions
): Promise<void> {
  const token = useAuthStore.getState().accessToken;

  const response = await fetch("/api/coach/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!response.ok) {
    let errBody: { error?: { code?: string; message?: string } } = {};
    try {
      errBody = await response.json();
    } catch {
      // 파싱 실패 시 빈 객체 유지
    }
    options.onError(
      new OreumApiError({
        code: errBody?.error?.code ?? "E_UNKNOWN",
        message: errBody?.error?.message ?? "코치챗 연결에 실패했습니다",
        httpStatus: response.status,
      })
    );
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    options.onError(
      new OreumApiError({
        code: "E_INTERNAL",
        message: "스트림을 읽을 수 없습니다",
        httpStatus: 500,
      })
    );
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const jsonStr = trimmed.slice(6);
        if (jsonStr === "[DONE]") return;

        try {
          const chunk = JSON.parse(jsonStr) as CoachChatChunk;
          if (chunk.type === "delta") {
            options.onDelta(chunk.content);
          } else if (chunk.type === "done") {
            options.onDone(chunk.usage);
          } else if (chunk.type === "error") {
            options.onError(
              new OreumApiError({
                code: chunk.code,
                message: chunk.message,
                httpStatus: 500,
              })
            );
          }
        } catch {
          // 파싱 실패한 청크 무시
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// AI 쿼터 초과 에러 코드 상수
// ---------------------------------------------------------------------------

export const COACH_ERROR_MESSAGES: Record<string, string> = {
  E_AI_QUOTA_EXCEEDED: "오늘 코치 대화 한도에 도달했습니다. 내일 다시 만나요.",
  E_PAYWALL_REQUIRED: "Pro 구독 후 코치챗을 이용할 수 있습니다.",
  E_REDLINE_REJECT: "오름은 외모가 아닌 성장에 집중합니다. 다른 이야기를 나눠봐요.",
};

export function getCoachErrorMessage(code: string): string {
  return COACH_ERROR_MESSAGES[code] ?? "연결이 불안정합니다. 다시 시도해주세요.";
}
