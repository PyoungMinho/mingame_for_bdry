/**
 * ImageProvider 인터페이스 + 팩토리.
 * 방향서 §1.1, 아키텍처 #2(reference multi-turn 일관성).
 * 키 없으면 MockImageProvider 자동 fallback.
 */
import type { AvatarConfig, ArtStyleKey, BalloonMeta, PanelIndex } from "@/lib/contract";

/* ─── 타입 ─── */

export interface PanelPrompt {
  panelIndex: PanelIndex;
  /** LLM이 생성한 장면 설명 (영문, 한글 미포함) */
  sceneDescription: string;
  artStyle: ArtStyleKey;
  avatar: AvatarConfig;
  /** 이전 컷 이미지 URL — reference multi-turn (1컷 이후 필수) */
  referenceImageUrl?: string;
  /** 말풍선 위치 힌트 (이미지에 텍스트 미생성, 공간만 확보용) */
  balloonHints?: Pick<BalloonMeta, "x" | "y" | "w" | "h">[];
}

export interface GeneratedImage {
  /** 생성된 이미지 URL (Storage에 저장된 경로) */
  imageUrl: string;
  /** 무료 티어 512px 다운스케일 URL */
  previewUrl?: string;
  /** 실제 생성에 사용된 시드 (일관성 추적용) */
  usedSeed: number;
  /** 장당 원가 USD */
  costUsd: number;
}

export interface ImageProvider {
  readonly name: string;
  /**
   * 단일 컷 이미지 생성.
   * 반드시 한글 없는 순수 이미지 반환 (방향서 아키텍처 #1).
   */
  generatePanel(prompt: PanelPrompt): Promise<GeneratedImage>;
}

/* ─── VertexGeminiProvider ─── */

export class VertexGeminiProvider implements ImageProvider {
  readonly name = "vertex-gemini";

  async generatePanel(prompt: PanelPrompt): Promise<GeneratedImage> {
    // Vertex AI Gemini 멀티턴 이미지 생성
    // reference_image를 포함해 캐릭터 일관성 유지 (방향서 아키텍처 #2)
    // TODO(W5): @google-cloud/vertexai SDK로 실제 구현
    // 현재는 팩토리에서 키 있을 때만 이 클래스를 인스턴스화하므로
    // 실제 연동 전까지 mock fallback이 먼저 동작함

    const projectId = process.env.GCP_PROJECT_ID!;
    const location = process.env.GCP_LOCATION ?? "asia-northeast3";
    const model = process.env.VERTEX_IMAGE_MODEL ?? "gemini-2.5-flash-image";
    const englishPrompt = buildEnglishPrompt(prompt);

    // Vertex AI REST API 호출 (ADC 토큰 기반)
    // W5 캘리브레이션 단계에서 멀티턴 reference image 파라미터 추가
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GOOGLE_ACCESS_TOKEN ?? ""}`,
      },
      body: JSON.stringify({
        instances: [{ prompt: englishPrompt, seed: prompt.avatar.seed }],
        parameters: { sampleCount: 1 },
      }),
    });

    if (!res.ok) {
      throw new Error(`Vertex image API error: ${res.status}`);
    }

    const data = await res.json();
    // Vertex Image Generation API 응답 파싱
    const base64Image: string = data?.predictions?.[0]?.bytesBase64Encoded ?? "";
    if (!base64Image) throw new Error("Vertex: empty image response");

    // TODO(W5): base64 → Supabase Storage 업로드 후 URL 반환
    const imageUrl = `data:image/png;base64,${base64Image}`;

    return {
      imageUrl,
      previewUrl: undefined,
      usedSeed: prompt.avatar.seed,
      costUsd: 0.039,
    };
  }
}

/* ─── OpenAIProvider ─── */

export class OpenAIProvider implements ImageProvider {
  readonly name = "openai";

  async generatePanel(prompt: PanelPrompt): Promise<GeneratedImage> {
    const englishPrompt = buildEnglishPrompt(prompt);

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: englishPrompt,
        n: 1,
        size: "1024x1024",
        quality: "medium",
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI image generation failed: ${res.status}`);
    }

    const data = await res.json();
    const imageUrl: string = data.data?.[0]?.url ?? "";

    return {
      imageUrl,
      previewUrl: undefined, // 실제 구현: Supabase Storage 다운스케일 저장
      usedSeed: prompt.avatar.seed,
      costUsd: 0.04, // gpt-image-1 medium 실측 단가
    };
  }
}

/* ─── MockImageProvider (개발/데모 필수) ─── */

/**
 * API 키 없이도 SSE 데모가 끝까지 동작하도록 결정적 더미 이미지 반환.
 * 프론트팀 S4/S5 검증용. 컷 번호별 고정 placeholder URL 사용.
 */
export class MockImageProvider implements ImageProvider {
  readonly name = "mock";

  private static readonly PLACEHOLDER_URLS: Record<number, string> = {
    1: "https://placehold.co/1024x1024/FAF7F2/1A1A1A?text=Panel+1",
    2: "https://placehold.co/1024x1024/FAF7F2/1A1A1A?text=Panel+2",
    3: "https://placehold.co/1024x1024/FAF7F2/1A1A1A?text=Panel+3",
    4: "https://placehold.co/1024x1024/FAF7F2/1A1A1A?text=Panel+4",
  };

  async generatePanel(prompt: PanelPrompt): Promise<GeneratedImage> {
    // 결정적 지연: 개발 시 SSE 스트리밍 체감 테스트 (컷당 800ms)
    await new Promise((resolve) => setTimeout(resolve, 800));

    const idx = prompt.panelIndex as number;
    const imageUrl =
      MockImageProvider.PLACEHOLDER_URLS[idx] ??
      `https://placehold.co/1024x1024/FAF7F2/1A1A1A?text=Panel+${idx}`;

    return {
      imageUrl,
      previewUrl: imageUrl.replace("1024x1024", "512x512"),
      usedSeed: prompt.avatar.seed,
      costUsd: 0, // mock은 비용 없음
    };
  }
}

/* ─── 팩토리 ─── */

/**
 * env IMAGE_PROVIDER 값으로 프로바이더 선택.
 * 키 없거나 "mock" 지정 시 MockImageProvider 반환.
 */
export function getImageProvider(): ImageProvider {
  const providerEnv = process.env.IMAGE_PROVIDER ?? "mock";

  if (providerEnv === "vertex") {
    const hasKey =
      !!process.env.GCP_PROJECT_ID && !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!hasKey) {
      console.warn("[ImageProvider] GCP 키 없음 → MockImageProvider 사용");
      return new MockImageProvider();
    }
    return new VertexGeminiProvider();
  }

  if (providerEnv === "openai") {
    const hasKey = !!process.env.OPENAI_API_KEY;
    if (!hasKey) {
      console.warn("[ImageProvider] OpenAI 키 없음 → MockImageProvider 사용");
      return new MockImageProvider();
    }
    return new OpenAIProvider();
  }

  return new MockImageProvider();
}

/* ─── 내부 헬퍼 ─── */

function buildEnglishPrompt(prompt: PanelPrompt): string {
  const artStyleMap: Record<string, string> = {
    emotional_line: "delicate line art, pastel colors, emotional manga style",
    bold_pen: "bold pen strokes, high contrast black and white with color accents, expressive manga",
    pop_cartoon: "vibrant pop colors, thick outlines, playful cartoon style",
    watercolor_touch: "soft watercolor textures, warm palette, loose brushstrokes",
  };

  const avatarDesc = [
    `${prompt.avatar.hairColor} hair`,
    `wearing ${prompt.avatar.topStyle.replace("-", " ")}`,
    prompt.avatar.accessory !== "none" ? `with ${prompt.avatar.accessory}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  const artDesc = artStyleMap[prompt.artStyle] ?? "manga style";

  // 한글 절대 미생성 — 영문 프롬프트만 전달 (방향서 아키텍처 #1)
  return [
    `${artDesc}, 2-head chibi character, ${avatarDesc},`,
    `scene: ${prompt.sceneDescription},`,
    `NO text, NO Korean, NO Chinese characters, NO Japanese text, speech bubbles are empty white spaces only,`,
    `comic panel, clean composition`,
  ].join(" ");
}
