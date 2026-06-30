/**
 * mock-adapter.ts
 * mock-models.ts의 정적 데이터를 도메인 타입(ModelSummary/Detail/Score 등)으로 변환.
 * Supabase 미연결 환경(USE_MOCK_DATA=true 또는 키 누락)에서 Repository fallback.
 *
 * 가드레일: mock-models.ts(프론트 소비용)는 수정 금지 — 여기서 어댑팅만.
 */
import {
  mockBenchmarks,
  mockChangelog,
  mockModels,
  mockProviders,
  type Model as MockModel,
  type Provider as MockProvider,
  type Benchmark as MockBenchmark,
} from "@/lib/data/mock-models";
import type {
  Benchmark,
  ChangelogEntry,
  ModelDetail,
  ModelSummary,
  Provider,
  Score,
} from "@/lib/types/model";

function adaptProvider(p: MockProvider | undefined): Provider | null {
  if (!p) return null;
  return {
    id: String(p.id),
    slug: p.slug,
    name: p.name,
    country: p.country ?? null,
    website: p.website ?? null,
    logo_color: p.logoColor ?? null,
  };
}

function adaptBenchmark(b: MockBenchmark): Benchmark {
  return {
    id: String(b.id),
    category_id: String(b.categoryId),
    slug: b.slug,
    name: b.name,
    scale: b.scale,
    unit: b.unit,
    description: b.description,
  };
}

function findProviderBySlug(slug: string): MockProvider | undefined {
  return mockProviders.find((p) => p.slug === slug);
}

function findBenchmarkBySlug(slug: string): MockBenchmark | undefined {
  return mockBenchmarks.find((b) => b.slug === slug);
}

/** mock Model.scores(키-값) → Score[] */
function adaptScores(m: MockModel): Score[] {
  const entries: { slug: string; value: number }[] = [];
  if (m.scores.mmlu != null) entries.push({ slug: "mmlu", value: m.scores.mmlu });
  if (m.scores.humaneval != null)
    entries.push({ slug: "humaneval", value: m.scores.humaneval });
  if (m.scores.gpqa != null) entries.push({ slug: "gpqa", value: m.scores.gpqa });
  if (m.scores.arenaElo != null)
    entries.push({ slug: "arena_elo", value: m.scores.arenaElo });
  if (m.scores.priceInput != null)
    entries.push({ slug: "price_input", value: m.scores.priceInput });
  if (m.scores.priceOutput != null)
    entries.push({ slug: "price_output", value: m.scores.priceOutput });
  if (m.scores.contextWindow != null)
    entries.push({ slug: "context_window", value: m.scores.contextWindow });
  if (m.scores.speedTps != null)
    entries.push({ slug: "speed_tps", value: m.scores.speedTps });

  const result: Score[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const bm = findBenchmarkBySlug(e.slug);
    if (!bm) continue;
    result.push({
      id: `${m.id}-${bm.id}`,
      benchmark_id: String(bm.id),
      benchmark: adaptBenchmark(bm),
      value: e.value,
      source: {
        id: `${m.id}-src`,
        url: m.source.url,
        type: m.source.type,
        confidence: m.source.confidence,
        fetched_at: m.source.verifiedAt,
        verified_at: m.source.verifiedAt,
      },
      measured_at: m.source.verifiedAt,
    });
  }
  return result;
}

export function adaptModelToSummary(m: MockModel): ModelSummary {
  const provider = adaptProvider(findProviderBySlug(m.providerSlug));
  const firstModality = m.attrs.modality?.[0] ?? null;
  return {
    id: String(m.id),
    slug: m.slug,
    name: m.name,
    status: m.status,
    released_at: m.releasedAt,
    summary: m.summary,
    provider,
    modality: firstModality,
    context_window: m.attrs.contextWindow,
    price_input_per_1m: m.attrs.priceInput,
    price_output_per_1m: m.attrs.priceOutput,
  };
}

export function adaptModelToDetail(m: MockModel): ModelDetail {
  return {
    ...adaptModelToSummary(m),
    scores: adaptScores(m),
    attrs: {
      modality: m.attrs.modality,
      context_window: m.attrs.contextWindow,
      price_input_per_1m: m.attrs.priceInput,
      price_output_per_1m: m.attrs.priceOutput,
      open_source: m.attrs.openSource,
      api_available: m.attrs.apiAvailable,
    },
  };
}

/** 모든 published 모델 (목록 기본) */
export function getAllMockSummaries(): ModelSummary[] {
  return mockModels
    .filter((m) => m.status === "published")
    .map(adaptModelToSummary);
}

export function getAllMockDetails(): ModelDetail[] {
  return mockModels
    .filter((m) => m.status === "published")
    .map(adaptModelToDetail);
}

export function getMockDetailBySlug(slug: string): ModelDetail | null {
  const m = mockModels.find((x) => x.slug === slug);
  if (!m) return null;
  return adaptModelToDetail(m);
}

export function getMockBenchmarksAdapted(): Benchmark[] {
  return mockBenchmarks.map(adaptBenchmark);
}

export function getMockChangelogAdapted(): ChangelogEntry[] {
  return mockChangelog.map((c) => {
    const m = mockModels.find((mm) => mm.slug === c.entitySlug);
    return {
      id: String(c.id),
      entity_id: m ? String(m.id) : null,
      field: c.field,
      old_value: c.oldValue,
      new_value: c.newValue,
      changed_at: c.changedAt,
      changed_by: c.changedBy,
      entity_name: m?.name,
      entity_slug: c.entitySlug,
    };
  });
}
