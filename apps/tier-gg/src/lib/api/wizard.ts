/**
 * Repository — 위저드 모델 추천
 * 가중치: 벤치마크 40% + 가격효율 40% + 기타 20%
 * 가중치는 공개 원칙 (투명성) — 응답에 weights 객체 포함
 */
import { isMockMode, supabaseAdmin } from "@/lib/supabase/server";
import type { WizardRecommendation, ModelSummary } from "@/lib/types/model";
import type { WizardInput } from "./schemas";
import { mockModels } from "@/lib/data/mock-models";
import { adaptModelToSummary } from "./mock-adapter";

// 태스크 → 관련 벤치마크 slug 매핑 (SQL seed의 snake_case와 일치)
const TASK_BENCHMARK_MAP: Record<string, string[]> = {
  coding: ["humaneval"],
  writing: ["mmlu"],
  summarization: ["mmlu"],
  translation: ["mmlu"],
  image_generation: ["mmlu"],
  data_analysis: ["mmlu", "gpqa"],
  customer_support: ["mmlu"],
  research: ["mmlu", "gpqa"],
  other: ["mmlu"],
};

// 예산 티어 → 입력 가격 상한 ($/M tokens)
const BUDGET_PRICE_CEILING: Record<string, number> = {
  free: 0,
  low: 2,
  mid: 15,
  high: 999,
};

const WEIGHTS = {
  benchmark: 0.4 as const,
  priceEfficiency: 0.4 as const,
  other: 0.2 as const,
};

type EntityForWizard = {
  id: string;
  slug: string;
  name: string;
  status: "draft" | "review" | "published";
  released_at: string | null;
  summary: string | null;
  attrs: Record<string, unknown>;
  providers: ModelSummary["provider"];
};

/**
 * 위저드 추천 — Top3 반환
 */
export async function recommendModels(
  input: WizardInput
): Promise<WizardRecommendation[]> {
  const relevantBenchmarks = TASK_BENCHMARK_MAP[input.task] ?? ["mmlu"];
  const priceCeiling = BUDGET_PRICE_CEILING[input.budget];

  // ─── mock 모드 fallback ─────────────────────────────────────
  if (isMockMode()) {
    const published = mockModels.filter((m) => m.status === "published");
    const priceFiltered = published.filter((m) => {
      const p = m.attrs.priceInput;
      if (input.budget === "free") return p === 0 || p === null;
      if (p === null) return true;
      return p <= priceCeiling;
    });
    if (priceFiltered.length === 0) return [];

    let globalMaxBenchmark = 0;
    let globalMaxInversePrice = 0;
    const raw = priceFiltered.map((m) => {
      const scoresArr: number[] = [];
      for (const bmSlug of relevantBenchmarks) {
        const key = bmSlug === "humaneval" ? "humaneval"
          : bmSlug === "gpqa" ? "gpqa"
          : "mmlu";
        const v = (m.scores as Record<string, number | undefined>)[key];
        if (v != null) scoresArr.push(v);
      }
      const avgBenchmark = scoresArr.length
        ? scoresArr.reduce((a, b) => a + b, 0) / scoresArr.length
        : 0;
      const p = m.attrs.priceInput;
      const inversePrice = p === null || p === 0 ? 100 : 1 / p;
      globalMaxBenchmark = Math.max(globalMaxBenchmark, avgBenchmark);
      globalMaxInversePrice = Math.max(globalMaxInversePrice, inversePrice);
      return { m, avgBenchmark, inversePrice };
    });

    const scored = raw.map(({ m, avgBenchmark, inversePrice }) => {
      const nb = globalMaxBenchmark > 0 ? avgBenchmark / globalMaxBenchmark : 0;
      const np = globalMaxInversePrice > 0 ? inversePrice / globalMaxInversePrice : 0;
      // contextWindow는 K tokens 단위. 1000K(=1M) 기준으로 정규화 (Supabase 분기와 동일 비율).
      const cwRaw = m.attrs.contextWindow;
      const cwK = typeof cwRaw === "number" && Number.isFinite(cwRaw) ? cwRaw : 4;
      const no = Math.min(cwK / 1000, 1);
      const total = nb * WEIGHTS.benchmark + np * WEIGHTS.priceEfficiency + no * WEIGHTS.other;
      return { m, total, nb, np, no };
    });

    const top3 = scored.sort((a, b) => b.total - a.total).slice(0, 3);
    return top3.map((item, i) => ({
      rank: (i + 1) as 1 | 2 | 3,
      model: adaptModelToSummary(item.m),
      totalScore: Math.round(item.total * 100) / 100,
      scoreBreakdown: {
        benchmark: Math.round(item.nb * WEIGHTS.benchmark * 100) / 100,
        priceEfficiency: Math.round(item.np * WEIGHTS.priceEfficiency * 100) / 100,
        other: Math.round(item.no * WEIGHTS.other * 100) / 100,
      },
      weights: WEIGHTS,
    }));
  }
  // ─────────────────────────────────────────────────────────────

  // 1. 활성 모델 + 가격 필터
  const { data: entitiesData, error: eError } = await supabaseAdmin
    .from("entities")
    .select(
      `
      id, slug, name, status, released_at, summary, attrs,
      providers ( id, slug, name, country, website )
    `
    )
    .eq("status", "published");

  if (eError || !entitiesData) return [];
  const entities = entitiesData as unknown as EntityForWizard[];

  const priceFiltered = entities.filter((e) => {
    const attrs = (e.attrs as Record<string, unknown>) ?? {};
    const inputPrice = (attrs.price_input_per_1m as number) ?? null;
    if (input.budget === "free") {
      return inputPrice === 0 || inputPrice === null;
    }
    if (inputPrice === null) return true;
    return inputPrice <= priceCeiling;
  });

  if (priceFiltered.length === 0) return [];

  const entityIds = priceFiltered.map((e) => e.id);

  // 2. 관련 벤치마크 조회
  const { data: benchmarkData } = await supabaseAdmin
    .from("benchmarks")
    .select("id, slug, name, scale")
    .in("slug", relevantBenchmarks);

  const benchmarkRows = (benchmarkData ?? []) as unknown as { id: string; slug: string }[];
  const benchmarkIds = benchmarkRows.map((b) => b.id);

  // 3. 점수 조회
  const { data: scoreData } = await supabaseAdmin
    .from("scores")
    .select("entity_id, benchmark_id, value")
    .in("entity_id", entityIds)
    .in("benchmark_id", benchmarkIds.length > 0 ? benchmarkIds : ["__none__"]);

  const scoreRows = (scoreData ?? []) as unknown as {
    entity_id: string;
    benchmark_id: string;
    value: number;
  }[];

  const scoreMap = new Map<string, number[]>();
  for (const row of scoreRows) {
    if (!scoreMap.has(row.entity_id)) scoreMap.set(row.entity_id, []);
    scoreMap.get(row.entity_id)!.push(row.value);
  }

  // 4. 정규화 준비
  let globalMaxScore = 0;
  let globalMaxInversePrice = 0;

  const rawScores: {
    entity: EntityForWizard;
    avgBenchmark: number;
    inversePrice: number;
  }[] = [];

  for (const entity of priceFiltered) {
    const scores = scoreMap.get(entity.id) ?? [];
    const avgBenchmark =
      scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    const attrs = (entity.attrs as Record<string, unknown>) ?? {};
    const inputPrice = (attrs.price_input_per_1m as number) ?? null;
    const inversePrice =
      inputPrice === null || inputPrice === 0 ? 100 : 1 / inputPrice;

    globalMaxScore = Math.max(globalMaxScore, avgBenchmark);
    globalMaxInversePrice = Math.max(globalMaxInversePrice, inversePrice);

    rawScores.push({ entity, avgBenchmark, inversePrice });
  }

  // 5. 정규화 + 총점
  const scored = rawScores.map(({ entity, avgBenchmark, inversePrice }) => {
    const normalizedBenchmark =
      globalMaxScore > 0 ? avgBenchmark / globalMaxScore : 0;
    const normalizedPrice =
      globalMaxInversePrice > 0 ? inversePrice / globalMaxInversePrice : 0;

    const attrs = (entity.attrs as Record<string, unknown>) ?? {};
    // Supabase: attrs.context_window는 raw tokens 단위. 1M(=1_000_000) 기준 정규화.
    const cwRaw = Number(attrs.context_window);
    const contextWindow = Number.isFinite(cwRaw) ? cwRaw : 4096;
    const normalizedOther = Math.min(contextWindow / 1_000_000, 1);

    const totalScore =
      normalizedBenchmark * WEIGHTS.benchmark +
      normalizedPrice * WEIGHTS.priceEfficiency +
      normalizedOther * WEIGHTS.other;

    const modelSummary: ModelSummary = {
      id: entity.id,
      slug: entity.slug,
      name: entity.name,
      status: entity.status,
      released_at: entity.released_at,
      summary: entity.summary,
      provider: entity.providers,
      modality: (attrs.modality as string) ?? null,
      context_window: contextWindow,
      price_input_per_1m: (attrs.price_input_per_1m as number) ?? null,
      price_output_per_1m: (attrs.price_output_per_1m as number) ?? null,
    };

    return {
      model: modelSummary,
      totalScore,
      benchmarkScore: normalizedBenchmark,
      priceScore: normalizedPrice,
      otherScore: normalizedOther,
    };
  });

  const top3 = scored.sort((a, b) => b.totalScore - a.totalScore).slice(0, 3);

  return top3.map((item, index) => ({
    rank: (index + 1) as 1 | 2 | 3,
    model: item.model,
    totalScore: Math.round(item.totalScore * 100) / 100,
    scoreBreakdown: {
      benchmark: Math.round(item.benchmarkScore * WEIGHTS.benchmark * 100) / 100,
      priceEfficiency:
        Math.round(item.priceScore * WEIGHTS.priceEfficiency * 100) / 100,
      other: Math.round(item.otherScore * WEIGHTS.other * 100) / 100,
    },
    weights: WEIGHTS,
  }));
}
