/**
 * LLM 일기 분절기.
 * 일기 텍스트 → 4컷 장면 프롬프트 + 캡션 + 말풍선 제안(BalloonMeta).
 * Vertex Gemini 호출 + 키 없을 때 결정적 mock 반환.
 */
import type { ArtStyleKey, AvatarConfig, BalloonMeta, PanelIndex } from "@/lib/contract";

export interface SceneScript {
  panelIndex: PanelIndex;
  /** 영문 장면 설명 — ImageProvider에 전달 */
  sceneDescription: string;
  /** LLM 생성 캡션 (영문, alt 텍스트/접근성용) */
  caption: string;
  /** 말풍선 제안 — 좌표+타입+꼬리+suggested_text(한글 허용, 프론트 오버레이용) */
  balloons: BalloonMeta[];
}

export interface SplitInput {
  diaryText: string;
  artStyle: ArtStyleKey;
  avatar: AvatarConfig;
}

export interface SplitResult {
  scenes: SceneScript[];
}

/* ─── 시스템 프롬프트 ─── */

const SYSTEM_PROMPT = `You are a webtoon storyboard artist. Convert a diary entry into a 4-panel comic script.

Rules:
1. Output MUST be valid JSON only (no markdown fences).
2. scene_description: English only, vivid, under 100 words per panel.
3. caption: English, accessibility alt text, under 15 words.
4. balloons: suggest 1-2 per panel. x/y/w/h are normalized 0-1 coordinates.
5. suggested_text: Korean is OK here (frontend overlay). Keep under 50 chars for speech/thought, 20 for shout.
6. NEVER put Korean in scene_description or caption.
7. tail directions: N|NE|E|SE|S|SW|W|NW

Output schema:
{
  "scenes": [
    {
      "panelIndex": 1,
      "sceneDescription": "...",
      "caption": "...",
      "balloons": [
        {
          "id": "b1",
          "type": "speech|thought|shout|whisper",
          "tail": "SW",
          "x": 0.6, "y": 0.1, "w": 0.35, "h": 0.18,
          "suggested_text": "..."
        }
      ]
    }
  ]
}`;

/* ─── LLM 호출 ─── */

export async function splitDiaryToScenes(input: SplitInput): Promise<SplitResult> {
  const hasKey =
    !!process.env.GCP_PROJECT_ID && !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!hasKey) {
    console.warn("[LLM Splitter] Vertex 키 없음 → mock 분절 반환");
    return mockSplit(input);
  }

  const userMessage = `
Diary entry (Korean): """${input.diaryText}"""
Art style: ${input.artStyle}
Character: hair=${input.avatar.hairColor}, top=${input.avatar.topStyle}, accessory=${input.avatar.accessory}

Create a 4-panel webtoon storyboard from this diary.`;

  // Vertex AI Gemini 호출
  // TODO(W4): 실제 SDK 통합
  try {
    const body = {
      contents: [
        { role: "user", parts: [{ text: userMessage }] },
      ],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    };

    const endpoint = `https://${process.env.GCP_LOCATION ?? "asia-northeast3"}-aiplatform.googleapis.com/v1/projects/${process.env.GCP_PROJECT_ID}/locations/${process.env.GCP_LOCATION ?? "asia-northeast3"}/publishers/google/models/${process.env.LLM_MODEL ?? "gemini-2.5-flash"}:generateContent`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // ADC 토큰은 실제 환경에서 google-auth-library로 취득
        Authorization: `Bearer ${process.env.GOOGLE_ACCESS_TOKEN ?? ""}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.warn(`[LLM Splitter] Vertex 호출 실패 ${res.status} → mock fallback`);
      return mockSplit(input);
    }

    const data = await res.json();
    const rawJson: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    const parsed: SplitResult = JSON.parse(rawJson);
    return parsed;
  } catch (err) {
    console.warn("[LLM Splitter] 파싱 실패 → mock fallback", err);
    return mockSplit(input);
  }
}

/* ─── Mock 분절 (키 없을 때 결정적 반환) ─── */

function mockSplit(input: SplitInput): SplitResult {
  const preview = input.diaryText.slice(0, 20);

  return {
    scenes: [
      {
        panelIndex: 1,
        sceneDescription: `Character wakes up and starts the day. Morning scene inspired by: "${preview}"`,
        caption: "The day begins with a fresh start",
        balloons: [
          {
            id: "b1-p1",
            type: "speech",
            tail: "SW",
            x: 0.55,
            y: 0.1,
            w: 0.4,
            h: 0.2,
            suggested_text: "오늘도 화이팅!",
          },
        ],
      },
      {
        panelIndex: 2,
        sceneDescription: "Character encounters the main event of the day, looking surprised and engaged",
        caption: "Something unexpected happens",
        balloons: [
          {
            id: "b1-p2",
            type: "shout",
            tail: "S",
            x: 0.3,
            y: 0.05,
            w: 0.4,
            h: 0.18,
            suggested_text: "헉!",
          },
        ],
      },
      {
        panelIndex: 3,
        sceneDescription: "Character reflects on the day's events, sitting quietly with a thoughtful expression",
        caption: "A moment of quiet reflection",
        balloons: [
          {
            id: "b1-p3",
            type: "thought",
            tail: "S",
            x: 0.5,
            y: 0.08,
            w: 0.45,
            h: 0.22,
            suggested_text: "그래도 좋은 하루였어.",
          },
        ],
      },
      {
        panelIndex: 4,
        sceneDescription: "Character ends the day with a peaceful smile, ready for tomorrow",
        caption: "The day ends with a smile",
        balloons: [
          {
            id: "b1-p4",
            type: "whisper",
            tail: "SW",
            x: 0.52,
            y: 0.12,
            w: 0.38,
            h: 0.16,
            suggested_text: "내일도 잘 부탁해.",
          },
        ],
      },
    ],
  };
}
