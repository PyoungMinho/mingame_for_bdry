/**
 * Repository — 모델(entity) 조회
 * RSC에서 직접 import하거나 Route Handler에서 호출 가능
 * Supabase 미연결 시 mock-models.ts fallback (USE_MOCK_DATA=true 또는 키 누락)
 */
import { isMockMode, supabaseAdmin } from "@/lib/supabase/server";
import type { ModelSummary, ModelDetail, Score } from "@/lib/types/model";
import type { ListModelsQuery } from "./schemas";
import {
  adaptModelToSummary,
  getAllMockSummaries,
  getMockDetailBySlug,
  getMockBenchmarksAdapted,
} from "./mock-adapter";
import { mockModels } from "@/lib/data/mock-models";

type EntityRow = {
  id: string;
  slug: string;
  name: string;
  status: "draft" | "review" | "published";
  released_at: string | null;
  summary: string | null;
  attrs: Record<string, unknown>;
  providers:
    | {
        id: string;
        slug: string;
        name: string;
        country: string | null;
        website: string | null;
      }
    | null;
};

/** entities row → ModelSummary 변환 */
function toModelSummary(row: EntityRow): ModelSummary {
  const attrs = (row.attrs as Record<string, unknown>) ?? {};
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    released_at: row.released_at,
    summary: row.summary,
    provider: row.providers ?? null,
    modality: (attrs.modality as string) ?? null,
    context_window: (attrs.context_window as number) ?? null,
    price_input_per_1m: (attrs.price_input_per_1m as number) ?? null,
    price_output_per_1m: (attrs.price_output_per_1m as number) ?? null,
  };
}

/**
 * 모델 목록 조회 (cursor 기반 페이지네이션)
 */
export async function listModels(filter?: ListModelsQuery): Promise<{
  data: ModelSummary[];
  cursor: string | null;
  hasMore: boolean;
}> {
  const limit = filter?.limit ?? 20;

  // ─── mock 모드 fallback ─────────────────────────────────────
  if (isMockMode()) {
    let all = getAllMockSummaries();
    if (filter?.status) {
      all = all.filter((m) => m.status === filter.status);
    }
    if (filter?.provider) {
      all = all.filter((m) => m.provider?.slug === filter.provider);
    }
    if (filter?.modality) {
      all = all.filter((m) => m.modality === filter.modality);
    }
    all.sort((a, b) => a.name.localeCompare(b.name));
    if (filter?.cursor) {
      all = all.filter((m) => m.name > (filter.cursor as string));
    }
    const hasMore = all.length > limit;
    const rows = hasMore ? all.slice(0, limit) : all;
    const lastRow = rows[rows.length - 1];
    return {
      data: rows,
      cursor: hasMore && lastRow ? lastRow.name : null,
      hasMore,
    };
  }
  // ─────────────────────────────────────────────────────────────

  let query = supabaseAdmin
    .from("entities")
    .select(
      `
      id, slug, name, status, released_at, summary, attrs,
      providers ( id, slug, name, country, website )
    `
    )
    .order("name", { ascending: true })
    .limit(limit + 1);

  if (filter?.status) {
    query = query.eq("status", filter.status);
  }

  if (filter?.cursor) {
    query = query.gt("name", filter.cursor);
  }

  if (filter?.provider) {
    const { data: providerRow } = await supabaseAdmin
      .from("providers")
      .select("id")
      .eq("slug", filter.provider)
      .single();

    if (providerRow) {
      query = query.eq("provider_id", providerRow.id);
    } else {
      return { data: [], cursor: null, hasMore: false };
    }
  }

  if (filter?.modality) {
    query = query.eq("attrs->>modality", filter.modality);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  const rawRows = (data ?? []) as unknown as EntityRow[];
  const hasMore = rawRows.length > limit;
  const rows = hasMore ? rawRows.slice(0, limit) : rawRows;
  const lastRow = rows[rows.length - 1];

  return {
    data: rows.map(toModelSummary),
    cursor: hasMore && lastRow ? lastRow.name : null,
    hasMore,
  };
}

/**
 * 슬러그로 모델 상세 조회 (점수 포함)
 */
export async function getModelBySlug(slug: string): Promise<ModelDetail | null> {
  if (isMockMode()) {
    return getMockDetailBySlug(slug);
  }

  const { data: entity, error: entityError } = await supabaseAdmin
    .from("entities")
    .select(
      `
      id, slug, name, status, released_at, summary, attrs,
      providers ( id, slug, name, country, website )
    `
    )
    .eq("slug", slug)
    .single();

  if (entityError || !entity) return null;
  const entityRow = entity as unknown as EntityRow;

  const { data: scoreRows, error: scoreError } = await supabaseAdmin
    .from("scores")
    .select(
      `
      id, value, measured_at,
      benchmarks ( id, category_id, slug, name, scale, unit, description ),
      sources ( id, url, type, confidence, fetched_at, verified_at )
    `
    )
    .eq("entity_id", entityRow.id);

  if (scoreError) throw new Error(scoreError.message);

  type ScoreRow = {
    id: string;
    value: number;
    measured_at: string | null;
    benchmarks: Score["benchmark"] | null;
    sources: Score["source"] | null;
  };

  const scores: Score[] = ((scoreRows ?? []) as unknown as ScoreRow[]).map(
    (s) => ({
      id: s.id,
      benchmark_id: s.benchmarks?.id ?? "",
      benchmark: s.benchmarks as Score["benchmark"],
      value: s.value,
      source: s.sources,
      measured_at: s.measured_at,
    })
  );

  const summary = toModelSummary(entityRow);

  return {
    ...summary,
    scores,
    attrs: (entityRow.attrs as Record<string, unknown>) ?? {},
  };
}

/**
 * 인기 비교 쌍 조회 (홈 화면용 — changelog 활동 기준 fallback)
 * MVP: 하드코딩된 인기 쌍, v1.1에서 조회수 기반으로 교체
 */
export async function getPopularPairs(
  limit = 6
): Promise<{ slugA: string; slugB: string; nameA: string; nameB: string }[]> {
  if (isMockMode()) {
    const arr = mockModels.filter((m) => m.status === "published").slice(0, limit * 2);
    const pairs: { slugA: string; slugB: string; nameA: string; nameB: string }[] =
      [];
    for (let i = 0; i + 1 < arr.length && pairs.length < limit; i += 2) {
      pairs.push({
        slugA: arr[i].slug,
        slugB: arr[i + 1].slug,
        nameA: arr[i].name,
        nameB: arr[i + 1].name,
      });
    }
    return pairs;
  }

  const { data, error } = await supabaseAdmin
    .from("entities")
    .select("slug, name")
    .eq("status", "published")
    .order("name", { ascending: true })
    .limit(limit * 2);

  if (error || !data || data.length < 2) return [];

  const rows = data as unknown as { slug: string; name: string }[];
  const pairs: { slugA: string; slugB: string; nameA: string; nameB: string }[] =
    [];

  for (let i = 0; i < Math.min(rows.length - 1, limit * 2); i += 2) {
    if (rows[i] && rows[i + 1]) {
      pairs.push({
        slugA: rows[i].slug,
        slugB: rows[i + 1].slug,
        nameA: rows[i].name,
        nameB: rows[i + 1].name,
      });
      if (pairs.length >= limit) break;
    }
  }

  return pairs;
}

/**
 * 리더보드 — 메트릭별 상위 모델 목록
 * metric: 'price' | 'coding' | 'speed' | 'quality'
 */
export async function getLeaderboard(
  metric: "price" | "coding" | "speed" | "quality",
  limit = 20
): Promise<
  { rank: number; model: ModelSummary; score: number; benchmarkName: string }[]
> {
  // 메트릭 → 벤치마크 slug 매핑 (SQL seed와 일치: snake_case)
  const metricToBenchmarkSlug: Record<string, string> = {
    price: "price_input",
    coding: "humaneval",
    speed: "speed_tps",
    quality: "mmlu",
  };
  const benchmarkSlug = metricToBenchmarkSlug[metric];

  if (isMockMode()) {
    const bm = getMockBenchmarksAdapted().find((b) => b.slug === benchmarkSlug);
    if (!bm) return [];
    const ascending = metric === "price";
    const scored = mockModels
      .filter((m) => m.status === "published")
      .map((m) => {
        const key = benchmarkSlug === "speed_tps"
          ? "speedTps"
          : benchmarkSlug === "price_input"
          ? "priceInput"
          : benchmarkSlug === "humaneval"
          ? "humaneval"
          : "mmlu";
        const value = (m.scores as Record<string, number | undefined>)[key];
        return value == null ? null : { m, value };
      })
      .filter((x): x is { m: (typeof mockModels)[number]; value: number } => x !== null)
      .sort((a, b) => (ascending ? a.value - b.value : b.value - a.value))
      .slice(0, limit);

    return scored.map((s, i) => ({
      rank: i + 1,
      model: adaptModelToSummary(s.m),
      score: s.value,
      benchmarkName: bm.name,
    }));
  }

  const { data: benchmark, error: bError } = await supabaseAdmin
    .from("benchmarks")
    .select("id, name, scale")
    .eq("slug", benchmarkSlug)
    .single();

  if (bError || !benchmark) return [];
  const bmRow = benchmark as unknown as { id: string; name: string; scale: number | null };

  const { data: scoreRows, error: sError } = await supabaseAdmin
    .from("scores")
    .select(
      `
      value,
      entities (
        id, slug, name, status, released_at, summary, attrs,
        providers ( id, slug, name, country, website )
      )
    `
    )
    .eq("benchmark_id", bmRow.id)
    .order("value", { ascending: metric === "price" })
    .limit(limit);

  if (sError || !scoreRows) return [];

  type LeaderboardRow = { value: number; entities: EntityRow | null };

  return (scoreRows as unknown as LeaderboardRow[])
    .filter((row) => row.entities !== null)
    .map((row, index) => ({
      rank: index + 1,
      model: toModelSummary(row.entities as EntityRow),
      score: row.value,
      benchmarkName: bmRow.name,
    }));
}
