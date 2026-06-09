/**
 * 문제팩토리 변형 생성 엔진 (서버 전용)
 * 원본 문항(텍스트/이미지)을 받아 Claude로 같은 개념의 변형 문항 + 해설을 생성한다.
 * ANTHROPIC_API_KEY 존재 시 실제 Claude, 없으면 데모 샘플로 폴백한다.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  Difficulty,
  GenerateRequestBody,
  GenerateResult,
  QuestionType,
  Subject,
  Tier,
  Variant,
} from "@/lib/exam/types";
import { findUnit } from "@/lib/exam/curriculum";

export type ExamMode = "live" | "demo";

/** API 키 유무로 실행 모드 판별 (placeholder 키는 데모로 취급) */
export function detectMode(): ExamMode {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key || key.startsWith("sk-ant-your") || key === "demo") return "demo";
  return "live";
}

/**
 * 요금제별 모델 라우팅.
 * - free(학생 자습 /study): 광고 기반 무과금 → 저비용 Haiku로 문항당 단가를 낮춘다.
 * - pro(강사용 /exam): 품질 우선 → Sonnet.
 * 환경변수(STUDY_MODEL / EXAM_MODEL / TEAM_MODEL_*)로 언제든 override 가능.
 */
function modelForExam(tier: Tier = "pro"): string {
  if (tier === "free") {
    return process.env.STUDY_MODEL || process.env.TEAM_MODEL_HAIKU || "claude-haiku-4-5";
  }
  return process.env.EXAM_MODEL || process.env.TEAM_MODEL_SONNET || "claude-sonnet-4-6";
}

const SUBJECT_LABEL: Record<Subject, string> = {
  english: "영어",
  math: "수학",
  korean: "국어",
  science: "과학",
  social: "사회",
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "하 (기본 개념 확인)",
  medium: "중 (응용)",
  hard: "상 (심화·함정 포함)",
};

const TYPE_LABEL: Record<QuestionType, string> = {
  multiple_choice: "5지선다 객관식",
  short_answer: "단답형",
};

/** 과목별 수능 출제 아키타입 — LLM이 실제 수능 문항 유형으로 출제하도록 정밀 가이드 */
const SUNEUNG_ARCHETYPES: Record<Subject, string> = {
  korean:
    "수능 국어. 독서(비문학: 인문·사회·과학기술·예술 지문)는 [세부정보 일치/불일치], [추론], [구체적 사례·상황에 적용(〈보기〉 활용)], [문맥적 어휘 의미] 유형으로. 문학(현대시·고전시가·현대소설·고전소설·수필)은 [표현상 특징], [화자·서술자의 태도·정서], [〈보기〉를 바탕으로 한 감상], [시어·구절의 의미] 유형으로 출제한다. 지문이 필요한 유형은 passage에 완결된 지문을 싣는다. 발문은 '윗글에 대한 이해로 적절하지 않은 것은?', '〈보기〉를 바탕으로 윗글을 감상한 내용으로 가장 적절한 것은?' 같은 수능 어투로 쓴다.",
  english:
    "수능 영어. [글의 목적], [심경·분위기], [필자 주장], [요지], [주제], [제목], [빈칸 추론], [무관한 문장 찾기], [글의 순서 배열], [주어진 문장의 위치], [어법], [문맥상 어휘] 중 적절한 유형으로 출제한다. 지문(passage)은 영어로 쓰되 수능 수준의 추상적·논설적 어휘를 사용한다. 발문은 한국어로('다음 글의 주제로 가장 적절한 것은?'). 빈칸 추론은 지문 속 빈칸(__________)을 두고 들어갈 말을 고르게 한다. 주제·제목 유형의 선택지는 영어구로, 순서·삽입 유형은 기호로 제시한다.",
  math:
    "수능 수학. 공통(수학Ⅰ: 지수·로그, 삼각함수, 수열 / 수학Ⅱ: 함수의 극한·연속, 미분, 적분)과 선택(미적분·확률과 통계·기하) 개념으로 출제한다. 객관식은 5지선다, 단답형은 답이 1000 이하 자연수가 되도록 설계한다. 발문은 '...의 값은?', '...을 만족시키는 모든 ...의 합을 구하시오.' 어투. 수식은 일반 텍스트로 표기한다(x^2, √2, ∫, lim, ≤, π). 한 줄로 끝나지 않게 2~3단계 사고를 요구하되 정답은 명확히 떨어지게 한다.",
  science:
    "수능 과학탐구(물리학·화학·생명과학·지구과학). 자료·그래프·실험 결과를 제시하고 해석하게 한다. 핵심은 〈보기〉 합답형: ㄱ·ㄴ·ㄷ 세 진술을 passage(또는 stem)의 〈보기〉 박스에 두고, 5개 선택지의 text를 'ㄱ' / 'ㄴ' / 'ㄱ, ㄴ' / 'ㄴ, ㄷ' / 'ㄱ, ㄴ, ㄷ' 같은 조합으로 구성한다. 발문은 '이에 대한 설명으로 옳은 것만을 〈보기〉에서 있는 대로 고른 것은?' 어투. 오개념을 자극하는 함정을 ㄴ 또는 ㄷ에 배치한다.",
  social:
    "수능 사회탐구(생활과 윤리·사회문화·한국지리·세계지리·정치와 법·경제·역사 등). 표·그래프·지도·사상가의 글 같은 자료를 제시하고 분석하게 한다. 〈보기〉 합답형(ㄱㄴㄷ 조합 선택지)과 입장·관점 비교 유형을 적극 활용한다. 발문은 '자료에 대한 분석으로 옳은 것은?', '갑, 을의 입장에 대한 설명으로 가장 적절한 것은?' 어투로 쓴다.",
};

/** 난이도별 수능 체감 보정 */
const DIFFICULTY_SUNEUNG: Record<Difficulty, string> = {
  easy: "하 — 2~3점 수준. 개념을 직접 적용하면 풀리는 평이한 문항. 함정은 최소화한다.",
  medium: "중 — 3점 수준. 둘 이상의 개념을 연결하거나 자료를 해석해야 풀리는 문항.",
  hard: "상 — 4점 킬러급. 복합 개념·고난도 추론·매력적 함정을 포함하되 정답 근거는 논리적으로 명확해야 한다(복수정답·오류 절대 금지).",
};

/** 5개 과목 아키타입 전체 텍스트 — 프롬프트 캐시 prefix에 한 번만 싣는다(모든 요청 공통) */
const ALL_ARCHETYPES_TEXT = (Object.keys(SUBJECT_LABEL) as Subject[])
  .map((s) => `● ${SUBJECT_LABEL[s]}\n${SUNEUNG_ARCHETYPES[s]}`)
  .join("\n\n");

/**
 * 캐시 가능한 '불변' 시스템 프롬프트.
 * 과목·난이도 같은 요청별 변수를 일절 넣지 않아 모든 요청이 동일한 prefix를 공유한다.
 * → cache_control(ephemeral)로 한 번 캐시되면 이후 요청은 캐시 입력 단가(최대 90%↓)로 처리된다.
 * 5개 과목 아키타입을 모두 실어 Haiku 캐시 최소치(2048토큰)도 안정적으로 넘긴다.
 */
function staticSystemText(): string {
  return `당신은 대학수학능력시험(수능)·내신 출제 경험이 풍부한 한국의 출제위원입니다.
학생이 문제집 없이도 스스로 공부할 수 있도록, 실제 수능 출제 유형과 똑같은 결의 문항과 해설을 만드는 것이 임무입니다.

[과목별 수능 출제 유형]
${ALL_ARCHETYPES_TEXT}

[공통 출제 원칙]
- 평가하려는 개념·사고 과정을 분명히 하고, 정답이 유일하도록 설계한다(복수정답·오류·애매한 발문 금지).
- 객관식은 ①②③④⑤ 5지선다. 매력적인 오답(흔한 실수·오개념)을 배치하되 정답 근거는 명확히 한다.
- 〈보기〉 합답형을 쓸 때는 ㄱ·ㄴ·ㄷ 진술을 passage(또는 stem)에 제시하고, 선택지 text를 'ㄱ', 'ㄱ, ㄴ', 'ㄴ, ㄷ', 'ㄱ, ㄴ, ㄷ' 형태로 둔다.
- 지문이 필요한 유형(독서·문학·영어 독해)은 passage에 완결된 지문을 싣고, stem에는 그 지문에 대한 발문만 담는다.
- 단답형은 답을 짧고 명확하게 쓴다(수학은 1000 이하 자연수 권장).
- 해설은 학생 혼자 이해하도록 '정답 근거 + 오답이 틀린 이유 + 핵심 개념'을 2~4문장으로 친절히 쓴다.
- 각 문항에는 배점(points)을 부여한다: 단순 개념 확인 2점, 표준 응용 3점, 복합·고난도(킬러) 4점.
- 영어 지문 외의 모든 텍스트는 한국어로 작성한다.

[출력 형식 — 매우 중요]
반드시 아래 JSON '하나만' 출력한다. 마크다운 코드펜스나 설명 문장을 절대 덧붙이지 않는다.
{
  "sourceSummary": "이 문제 묶음이 평가하는 핵심 개념·단원을 한 줄로",
  "variants": [
    {
      "passage": "지문·자료·〈보기〉가 필요한 경우만. 없으면 이 키 생략",
      "stem": "발문/문제 본문",
      "type": "multiple_choice" 또는 "short_answer",
      "choices": [ { "label": "①", "text": "보기 내용" }, ... ],  // 단답형이면 생략
      "answer": "객관식이면 정답 기호(예: ③), 단답형이면 정답 텍스트",
      "points": 3,
      "explanation": "해설"
    }
  ]
}`;
}

/**
 * 요청별 '가변' 지시(과목·난이도). 캐시 prefix 뒤에 짧게 붙는다.
 * 이 블록만 요청마다 달라지므로 캐시 적중률을 최대로 유지한다.
 */
function dynamicSystemText(body: GenerateRequestBody): string {
  const label = SUBJECT_LABEL[body.subject];
  const lines = [
    `[이번 출제 지시]`,
    `- 적용 과목: ${label} — 위 [과목별 수능 출제 유형]에서 '${label}' 항목만 적용한다.`,
    `- 난이도 보정: ${DIFFICULTY_SUNEUNG[body.difficulty]}`,
  ];
  // 단원이 지정되면 교육과정 정합성 강화: 해당 단원 개념·빈출유형·배점으로 한정 출제
  const found = body.unitId ? findUnit(body.unitId) : undefined;
  if (found) {
    const { course, unit } = found;
    lines.push(
      `- 출제 단원: ${course.name} · ${unit.name} — 반드시 이 단원의 개념 범위 안에서만 출제하고, 다른 단원 개념으로 새지 않는다.`,
      `- 단원 핵심 키워드: ${unit.topics.join(", ")}`,
      `- 단원 빈출 출제 포커스: ${unit.focus}`,
      `- 이 단원 권장 배점: ${unit.points.join("·")}점 (난이도에 맞춰 문항별 배점을 정한다)`,
    );
  }
  return lines.join("\n");
}

function buildUserText(body: GenerateRequestBody): string {
  const hasImage = !!body.imageBase64;
  const src = body.source.trim();
  const sourcePart = src
    ? `[학습 대상] 학생이 공부하려는 원본 문항·개념·단원입니다. 같은 개념을 평가하는 수능형 문항으로 출제하세요.\n${src}`
    : hasImage
      ? "[학습 대상] 첨부된 이미지의 문제를 읽고, 같은 개념을 평가하는 수능형 문항으로 출제하세요."
      : "[학습 대상] (미제공) 아래 과목·난이도에 맞는 대표 수능 유형 문항을 새로 출제하세요.";

  return `${sourcePart}

[요청]
- 과목: ${SUBJECT_LABEL[body.subject]}
- 유형: ${TYPE_LABEL[body.type]}
- 난이도: ${DIFFICULTY_LABEL[body.difficulty]}
- 문항 수: ${body.count}개

학생이 워크북처럼 풀 수 있도록, 위 조건의 수능형 문항 ${body.count}개와 해설을 지정된 JSON 형식으로만 출력하세요.`;
}

type RawVariant = {
  passage?: string;
  stem?: string;
  type?: string;
  choices?: { label?: string; text?: string }[];
  answer?: string;
  points?: number | string;
  explanation?: string;
};

type ParsedExam = { sourceSummary?: string; variants?: RawVariant[] };

/** JSON.parse 결과가 '순수 객체'일 때만 통과 — 배열·null·원시값 거부(하류 null.variants 크래시 차단) */
function asExamObject(value: unknown): ParsedExam | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as ParsedExam)
    : null;
}

/** 첫 '{'부터 문자열·이스케이프를 고려해 균형 잡힌 첫 완결 객체만 추출(꼬리텍스트·추가 객체 내성) */
function firstBalancedObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export function extractJson(text: string): ParsedExam {
  const trimmed = text.trim();
  try {
    const direct = asExamObject(JSON.parse(trimmed));
    if (direct) return direct;
  } catch {
    /* fall through */
  }
  // 코드펜스·머리말·꼬리텍스트·추가 객체가 섞여도 첫 완결 객체만 복구
  const candidate = firstBalancedObject(trimmed);
  if (candidate) {
    try {
      const sliced = asExamObject(JSON.parse(candidate));
      if (sliced) return sliced;
    } catch {
      /* fall through */
    }
  }
  throw new Error("AI 응답을 해석하지 못했습니다. 다시 시도해 주세요.");
}

let _vid = 0;
function vid(): string {
  _vid += 1;
  return `v_${Date.now().toString(36)}_${_vid}`;
}

/** 배점 정규화 — LLM 값 우선, 없으면 난이도 기반 기본값. 항상 2~4로 클램프 */
function normPoints(raw: unknown, difficulty: Difficulty): number {
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  if (Number.isFinite(n)) return Math.min(4, Math.max(2, Math.round(n)));
  return difficulty === "easy" ? 2 : difficulty === "hard" ? 4 : 3;
}

export function normalizeVariant(
  raw: RawVariant,
  body: GenerateRequestBody
): Variant | null {
  const stem = (raw.stem || "").trim();
  if (!stem) return null;
  const type: QuestionType =
    raw.type === "short_answer" ? "short_answer" : "multiple_choice";
  const choices =
    type === "multiple_choice"
      ? (raw.choices || [])
          .map((c) => ({ label: (c.label || "").trim(), text: (c.text || "").trim() }))
          .filter((c) => c.text)
      : undefined;
  return {
    id: vid(),
    passage: raw.passage?.trim() || undefined,
    stem,
    type,
    choices: choices && choices.length ? choices : type === "multiple_choice" ? [] : undefined,
    answer: (raw.answer || "").trim() || "(정답 미상)",
    explanation: (raw.explanation || "").trim() || "(해설 없음)",
    difficulty: body.difficulty,
    subject: body.subject,
    points: normPoints(raw.points, body.difficulty),
    unitId: body.unitId,
  };
}

export async function generateVariants(
  body: GenerateRequestBody
): Promise<GenerateResult> {
  const rounded = Math.round(body.count);
  const count = Number.isFinite(rounded) ? Math.max(1, Math.min(10, rounded)) : 3;
  const normBody = { ...body, count };

  if (detectMode() === "demo") {
    return { mode: "demo", ...demoResult(normBody) };
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const maxTokens = Math.min(8000, 1500 + count * 700);

  const userBlocks: Anthropic.MessageParam["content"] = [];
  if (normBody.imageBase64 && normBody.imageMediaType) {
    userBlocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: normBody.imageMediaType,
        data: normBody.imageBase64,
      },
    });
  }
  userBlocks.push({ type: "text", text: buildUserText(normBody) });

  const msg = await client.messages.create({
    model: modelForExam(normBody.tier),
    max_tokens: maxTokens,
    // 불변 prefix만 캐시(ephemeral) → 반복 요청 시 입력 토큰 단가 최대 90%↓.
    // 가변 지시(과목·난이도)는 캐시 밖 짧은 블록으로 분리해 적중률을 유지한다.
    system: [
      { type: "text", text: staticSystemText(), cache_control: { type: "ephemeral" } },
      { type: "text", text: dynamicSystemText(normBody) },
    ],
    messages: [
      { role: "user", content: userBlocks },
      { role: "assistant", content: "{" }, // JSON 프리필 → 형식 안정화
    ],
  });

  const first = msg.content.find((b) => b.type === "text");
  const raw = "{" + (first && first.type === "text" ? first.text : "");
  const parsed = extractJson(raw);

  const variants = (parsed.variants || [])
    .map((r) => normalizeVariant(r, normBody))
    .filter((v): v is Variant => v !== null)
    .slice(0, count);

  if (!variants.length) {
    throw new Error("변형 문항을 만들지 못했습니다. 원본 문항을 더 명확히 입력해 주세요.");
  }

  return {
    mode: "live",
    sourceSummary: (parsed.sourceSummary || "원본 문항 기반 변형").trim(),
    variants,
  };
}

// ---------------------------------------------------------------------------
// 데모 폴백 — API 키 없이도 전체 플로우를 검증할 수 있는 현실적 샘플
// ---------------------------------------------------------------------------

function demoResult(body: GenerateRequestBody): Omit<GenerateResult, "mode"> {
  const builders: Record<Subject, (i: number) => Omit<Variant, "id" | "difficulty" | "subject">> = {
    math: (i) => {
      const a = 2 + i;
      const b = 3 + i * 2;
      const sum = a + b;
      return {
        stem: `다음 식의 값을 구하시오.\n\n( ${a}x + ${b} ) 에서 x = ${i + 1} 일 때의 값은?`,
        type: body.type,
        choices:
          body.type === "multiple_choice"
            ? [
                { label: "①", text: `${a * (i + 1) + b - 2}` },
                { label: "②", text: `${a * (i + 1) + b - 1}` },
                { label: "③", text: `${a * (i + 1) + b}` },
                { label: "④", text: `${a * (i + 1) + b + 1}` },
                { label: "⑤", text: `${a * (i + 1) + b + 2}` },
              ]
            : undefined,
        answer: body.type === "multiple_choice" ? "③" : `${a * (i + 1) + b}`,
        explanation: `일차식 ${a}x + ${b}에 x = ${i + 1}을 대입하면 ${a}×${i + 1} + ${b} = ${a * (i + 1)} + ${b} = ${a * (i + 1) + b}. 대입 순서와 곱셈을 먼저 처리하는 것이 핵심이다. (참고 합 ${sum})`,
      };
    },
    english: (i) => ({
      passage: `Many students believe that talent decides everything, but research(${i + 1}) suggests that consistent effort matters far more than natural ability.`,
      stem:
        body.type === "short_answer"
          ? "윗글의 밑줄 친 'decides'는 어법상 틀렸다. 올바른 형태를 한 단어로 쓰시오. (데모 샘플)"
          : "윗글의 밑줄 친 부분 중, 어법상 틀린 것은? (데모 샘플)",
      type: body.type,
      choices:
        body.type === "multiple_choice"
          ? [
              { label: "①", text: "believe" },
              { label: "②", text: "decides" },
              { label: "③", text: "suggests" },
              { label: "④", text: "matters" },
              { label: "⑤", text: "ability" },
            ]
          : undefined,
      answer: body.type === "multiple_choice" ? "②" : "decide",
      explanation:
        "주어 'Many students'가 복수이므로 동사는 원형/복수형이어야 한다는 개념을 평가한다. 데모 모드에서는 예시 보기를 보여줄 뿐이며, 실제 키 연결 시 원문 어법 포인트를 그대로 변형한다.",
    }),
    korean: (i) => ({
      passage: `생태계의 균형은 한 종(種)이 사라지면 연쇄적으로 무너질 수 있다. (${i + 1}문단 변형 지문)`,
      stem:
        body.type === "short_answer"
          ? "윗글에서 한 종의 소멸이 생태계 전체로 번지는 과정을 '○○적 붕괴'라 한다. ○○에 들어갈 두 글자를 쓰시오. (데모 샘플)"
          : "윗글의 중심 내용으로 가장 적절한 것은?",
      type: body.type,
      choices:
        body.type === "multiple_choice"
          ? [
              { label: "①", text: "생태계는 외부 충격에 영향을 받지 않는다." },
              { label: "②", text: "한 종의 멸종이 생태계 전체에 영향을 줄 수 있다." },
              { label: "③", text: "종의 수가 많을수록 항상 안정적이다." },
              { label: "④", text: "인간은 생태계와 무관하게 존재한다." },
              { label: "⑤", text: "생태계 균형은 인위적으로만 유지된다." },
            ]
          : undefined,
      answer: body.type === "multiple_choice" ? "②" : "연쇄",
      explanation:
        "글의 핵심은 '연쇄적 붕괴'로, 한 종의 소멸이 전체에 파급된다는 점이다. ①③④⑤는 본문과 반대이거나 비약이라 오답이다.",
    }),
    science: (i) => ({
      stem: `질량이 ${2 + i}kg인 물체에 ${3 + i}N의 힘이 작용할 때 가속도(m/s²)는? (F = ma)`,
      type: body.type,
      choices:
        body.type === "multiple_choice"
          ? [
              { label: "①", text: `${((3 + i) / (2 + i)).toFixed(2)}` },
              { label: "②", text: `${(3 + i).toFixed(2)}` },
              { label: "③", text: `${(2 + i).toFixed(2)}` },
              { label: "④", text: `${((2 + i) / (3 + i)).toFixed(2)}` },
              { label: "⑤", text: `${(2 * (3 + i)).toFixed(2)}` },
            ]
          : undefined,
      answer: body.type === "multiple_choice" ? "①" : `${((3 + i) / (2 + i)).toFixed(2)}`,
      explanation: `뉴턴 제2법칙 a = F/m = ${3 + i}/${2 + i} = ${((3 + i) / (2 + i)).toFixed(2)} m/s². 힘과 질량의 관계를 동일 개념으로 유지하고 수치만 바꾼 변형이다.`,
    }),
    social: (i) => ({
      stem:
        body.type === "short_answer"
          ? "어떤 것을 선택함으로써 포기하게 되는 차선책의 가치를 뜻하는 경제 용어를 쓰시오. (데모 샘플)"
          : `다음 중 '기회비용'의 사례로 가장 적절한 것은? (사례 변형 ${i + 1})`,
      type: body.type,
      choices:
        body.type === "multiple_choice"
          ? [
              { label: "①", text: "용돈을 모두 저금했다." },
              { label: "②", text: "영화를 보느라 포기한 아르바이트 수입" },
              { label: "③", text: "물건을 정가에 구매했다." },
              { label: "④", text: "세금을 납부했다." },
              { label: "⑤", text: "은행에서 환전했다." },
            ]
          : undefined,
      answer: body.type === "multiple_choice" ? "②" : "기회비용",
      explanation:
        "기회비용은 '어떤 선택으로 포기한 차선의 가치'다. ②는 영화 관람을 위해 포기한 아르바이트 수입이므로 정답. 나머지는 단순 지출·거래라 개념과 무관하다.",
    }),
  };

  const make = builders[body.subject];
  const demoPoints = body.difficulty === "easy" ? 2 : body.difficulty === "hard" ? 4 : 3;
  const variants: Variant[] = Array.from({ length: body.count }, (_, i) => ({
    id: vid(),
    difficulty: body.difficulty,
    subject: body.subject,
    ...make(i),
    points: demoPoints,
    unitId: body.unitId,
  }));

  return {
    sourceSummary:
      `[데모] '${SUBJECT_LABEL[body.subject]}' ${TYPE_LABEL[body.type]} 변형 ${body.count}문항 예시입니다. ` +
      "ANTHROPIC_API_KEY를 설정하면 실제 원본 문항을 분석해 변형합니다.",
    variants,
  };
}
