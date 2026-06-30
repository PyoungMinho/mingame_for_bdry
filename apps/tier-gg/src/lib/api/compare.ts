/**
 * Repository — 모델 비교
 */
import { isMockMode, supabaseAdmin } from "@/lib/supabase/server";
import type {
  CompareResult,
  CompareModel,
  ModelDetail,
  Score,
  Benchmark,
} from "@/lib/types/model";
import { getMockDetailBySlug } from "./mock-adapter";

type EntityRow = {
  id: string;
  slug: string;
  name: string;
  status: "draft" | "review" | "published";
  released_at: string | null;
  summary: string | null;
  attrs: Record<string, unknown>;
  providers: ModelDetail["provider"];
};

type ScoreRow = {
  id: string;
  entity_id: string;
  value: number;
  measured_at: string | null;
  benchmarks: Benchmark | null;
  sources: Score["source"] | null;
};

/**
 * 2~4개 모델 슬러그 → 모델 상세 + 공통 벤치마크 + 점수 한 번에 조회
 */
export async function getCompareData(slugs: string[]): Promise<CompareResult | null> {
  if (slugs.length < 2 || slugs.length > 4) return null;

  // ─── mock 모드 fallback ─────────────────────────────────────
  if (isMockMode()) {
    const details = slugs
      .map((s) => getMockDetailBySlug(s))
      .filter((d): d is ModelDetail => d !== null);
    if (details.length < 2) return null;

    // 공유 벤치마크: 2개 이상 모델에 존재
    const bmCount = new Map<string, number>();
    const bmMap = new Map<string, Benchmark>();
    for (const d of details) {
      for (const s of d.scores) {
        bmCount.set(s.benchmark.id, (bmCount.get(s.benchmark.id) ?? 0) + 1);
        bmMap.set(s.benchmark.id, s.benchmark);
      }
    }
    const sharedBenchmarks: Benchmark[] = [];
    for (const [id, count] of bmCount.entries()) {
      if (count >= 2) {
        const bm = bmMap.get(id);
        if (bm) sharedBenchmarks.push(bm);
      }
    }

    const compareModels: CompareModel[] = details.map((model, order) => ({
      model,
      order,
    }));
    const { isReversed } = normalizePair(details[0].slug, details[1].slug);
    return { models: compareModels, benchmarks: sharedBenchmarks, isReversed };
  }
  // ─────────────────────────────────────────────────────────────

  // 1. 모델 조회
  const { data: entitiesData, error: eError } = await supabaseAdmin
    .from("entities")
    .select(
      `
      id, slug, name, status, released_at, summary, attrs,
      providers ( id, slug, name, country, website )
    `
    )
    .in("slug", slugs);

  if (eError || !entitiesData || entitiesData.length < 2) return null;
  const entities = entitiesData as unknown as EntityRow[];

  const entityIds = entities.map((e) => e.id);

  // 2. 점수 + 벤치마크 + 소스 일괄 조회
  const { data: scoreData, error: sError } = await supabaseAdmin
    .from("scores")
    .select(
      `
      id, entity_id, value, measured_at,
      benchmarks ( id, category_id, slug, name, scale, unit, description ),
      sources ( id, url, type, confidence, fetched_at, verified_at )
    `
    )
    .in("entity_id", entityIds);

  if (sError) throw new Error(sError.message);
  const scoreRows = (scoreData ?? []) as unknown as ScoreRow[];

  // 3. 벤치마크 중복 제거
  const benchmarkCount = new Map<string, number>();
  const benchmarkMap = new Map<string, Benchmark>();

  for (const row of scoreRows) {
    const bm = row.benchmarks;
    if (!bm) continue;
    benchmarkCount.set(bm.id, (benchmarkCount.get(bm.id) ?? 0) + 1);
    benchmarkMap.set(bm.id, bm);
  }

  const sharedBenchmarks: Benchmark[] = [];
  for (const [id, count] of benchmarkCount.entries()) {
    if (count >= 2) {
      const bm = benchmarkMap.get(id);
      if (bm) sharedBenchmarks.push(bm);
    }
  }

  // 4. 엔티티별 Score 그루핑
  const scoresByEntity = new Map<string, Score[]>();
  for (const row of scoreRows) {
    const bm = row.benchmarks;
    if (!bm) continue;
    if (!scoresByEntity.has(row.entity_id)) {
      scoresByEntity.set(row.entity_id, []);
    }
    scoresByEntity.get(row.entity_id)!.push({
      id: row.id,
      benchmark_id: bm.id,
      benchmark: bm,
      value: row.value,
      source: row.sources,
      measured_at: row.measured_at,
    });
  }

  // 5. 요청 순서 유지하여 CompareModel 배열 생성
  const compareModels: CompareModel[] = entities.map((entity, index) => {
    const attrs = (entity.attrs as Record<string, unknown>) ?? {};
    const model: ModelDetail = {
      id: entity.id,
      slug: entity.slug,
      name: entity.name,
      status: entity.status,
      released_at: entity.released_at,
      summary: entity.summary,
      provider: entity.providers,
      modality: (attrs.modality as string) ?? null,
      context_window: (attrs.context_window as number) ?? null,
      price_input_per_1m: (attrs.price_input_per_1m as number) ?? null,
      price_output_per_1m: (attrs.price_output_per_1m as number) ?? null,
      scores: scoresByEntity.get(entity.id) ?? [],
      attrs,
    };
    return { model, order: index };
  });

  const { isReversed } = normalizePair(entities[0].slug, entities[1].slug);

  return {
    models: compareModels,
    benchmarks: sharedBenchmarks,
    isReversed,
  };
}

/**
 * 두 슬러그를 알파벳 순으로 정렬
 */
export function normalizePair(
  a: string,
  b: string
): { sorted: [string, string]; isReversed: boolean } {
  const isReversed = a.localeCompare(b) > 0;
  return {
    sorted: isReversed ? [b, a] : [a, b],
    isReversed,
  };
}
