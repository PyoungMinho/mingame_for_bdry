/**
 * metric-explanations.ts
 * 비전문가용 메트릭 설명 사전
 * 각 메트릭의 의미, 높을수록/낮을수록 좋음 방향, 단위 풀어쓰기를 제공한다.
 */

export type MetricKey =
  | "input_price"
  | "output_price"
  | "context_window"
  | "mmlu"
  | "humaneval"
  | "gpqa"
  | "arena_elo"
  | "speed";

export type MetricExplanation = {
  shortLabel: { en: string; ko: string };
  oneLiner: { en: string; ko: string };
  betterWhen: "higher" | "lower";
  layUnit?: { en: string; ko: string };
};

export const metricExplanations: Record<MetricKey, MetricExplanation> = {
  input_price: {
    shortLabel: { en: "Input Price", ko: "입력 가격" },
    oneLiner: {
      en: "Cost to send 1 million words to the AI — lower is cheaper",
      ko: "AI에 100만 단어를 보낼 때 드는 비용 — 낮을수록 저렴",
    },
    betterWhen: "lower",
    layUnit: { en: "$ per 1M tokens", ko: "토큰 100만 개당 USD" },
  },
  output_price: {
    shortLabel: { en: "Output Price", ko: "출력 가격" },
    oneLiner: {
      en: "Cost when the AI replies with 1 million words — lower is cheaper",
      ko: "AI가 100만 단어를 답변할 때 드는 비용 — 낮을수록 저렴",
    },
    betterWhen: "lower",
    layUnit: { en: "$ per 1M tokens", ko: "토큰 100만 개당 USD" },
  },
  context_window: {
    shortLabel: { en: "Context Window", ko: "컨텍스트 창" },
    oneLiner: {
      en: "How much text the AI can read at once — longer means it handles bigger documents",
      ko: "한 번에 읽을 수 있는 글 길이 — 길수록 긴 문서나 대화도 기억",
    },
    betterWhen: "higher",
    layUnit: { en: "thousand tokens (K)", ko: "토큰 천 개 단위 (K)" },
  },
  mmlu: {
    shortLabel: { en: "MMLU", ko: "MMLU" },
    oneLiner: {
      en: "General knowledge exam across 57 subjects — measures how broadly 'smart' the AI is",
      ko: "57개 분야 종합 지식 시험 — AI가 얼마나 넓고 깊게 아는지 측정",
    },
    betterWhen: "higher",
    layUnit: { en: "% correct", ko: "정답률 %" },
  },
  humaneval: {
    shortLabel: { en: "HumanEval", ko: "HumanEval" },
    oneLiner: {
      en: "Coding test — measures how well the AI writes working Python code",
      ko: "코딩 시험 — 올바르게 동작하는 파이썬 코드를 얼마나 잘 짜는지",
    },
    betterWhen: "higher",
    layUnit: { en: "% passing tests", ko: "테스트 통과율 %" },
  },
  gpqa: {
    shortLabel: { en: "GPQA", ko: "GPQA" },
    oneLiner: {
      en: "Hard science questions that even PhD researchers struggle with — measures deep reasoning",
      ko: "박사 연구자도 헤맬 수준의 과학 추론 시험 — 깊은 논리력 측정",
    },
    betterWhen: "higher",
    layUnit: { en: "% correct", ko: "정답률 %" },
  },
  arena_elo: {
    shortLabel: { en: "Arena Elo", ko: "아레나 Elo" },
    oneLiner: {
      en: "Real users blind-compared two AI answers and voted — like Elo rating in chess, higher means more users preferred it",
      ko: "실제 사용자가 두 AI 답변을 블라인드로 비교해 투표한 점수 — 체스의 Elo처럼, 높을수록 더 많은 사람이 선호",
    },
    betterWhen: "higher",
    layUnit: { en: "Elo points", ko: "Elo 점수" },
  },
  speed: {
    shortLabel: { en: "Speed", ko: "속도" },
    oneLiner: {
      en: "How fast the AI generates text — higher means faster, more responsive replies",
      ko: "AI가 글을 얼마나 빨리 생성하는지 — 높을수록 답변이 빠르고 반응성이 좋음",
    },
    betterWhen: "higher",
    layUnit: { en: "tokens per second", ko: "초당 토큰 수" },
  },
};

/**
 * CompareTable의 row key(inputPrice, outputPrice 등)를
 * MetricKey로 매핑하는 유틸리티
 */
export const compareRowKeyToMetricKey: Record<string, MetricKey> = {
  inputPrice: "input_price",
  outputPrice: "output_price",
  contextWindow: "context_window",
  mmlu: "mmlu",
  humaneval: "humaneval",
  gpqa: "gpqa",
  arenaElo: "arena_elo",
  speed: "speed",
};
