/**
 * 도메인 타입 정의
 * DB Row 타입을 가공하여 API 응답/RSC에서 사용하는 타입
 * SQL 마이그레이션(0001_init.sql) 및 mock-models.ts와 정합
 */
import type {
  EntityStatus,
  SourceType,
  ConfidenceLevel,
} from "@/lib/supabase/types";

export type { EntityStatus, SourceType, ConfidenceLevel };

export interface Provider {
  id: string;
  slug: string;
  name: string;
  country: string | null;
  website: string | null;
  logo_color?: string | null;
}

export interface Source {
  id: string;
  url: string;
  type: SourceType;
  confidence: ConfidenceLevel;
  fetched_at: string | null;
  verified_at?: string | null;
}

export interface Benchmark {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  /** 점수 척도 — 0~100 점수의 경우 100, 비율/단위 없음일 때는 null */
  scale: number | null;
  unit?: string | null;
  description?: string | null;
}

export interface Score {
  id: string;
  benchmark_id: string;
  benchmark: Benchmark;
  value: number;
  source: Source | null;
  measured_at: string | null;
}

export interface ChangelogEntry {
  id: string;
  entity_id: string | null;
  field: string;
  old_value: unknown;
  new_value: unknown;
  changed_at: string;
  changed_by?: string | null;
  /** JOIN 결과로 포함될 수 있는 모델명 */
  entity_name?: string;
  entity_slug?: string;
}

/**
 * 모델(entity) 목록용 경량 타입
 */
export interface ModelSummary {
  id: string;
  slug: string;
  name: string;
  status: EntityStatus;
  released_at: string | null;
  summary: string | null;
  provider: Provider | null;
  /** attrs JSONB에서 꺼낸 주요 필드 */
  modality: string | null;
  context_window: number | null;
  price_input_per_1m: number | null;
  price_output_per_1m: number | null;
}

/**
 * 모델 상세 — 점수 포함
 */
export interface ModelDetail extends ModelSummary {
  scores: Score[];
  /** attrs 전체 JSONB (추가 속성) */
  attrs: Record<string, unknown>;
}

/**
 * 비교 응답 단위
 */
export interface CompareModel {
  model: ModelDetail;
  /** 해당 비교에서 normalize된 정렬 순서 */
  order: number;
}

export interface CompareResult {
  models: CompareModel[];
  benchmarks: Benchmark[];
  /** normalizePair 결과: 알파벳 정렬 후 원래 순서 복원용 */
  isReversed: boolean;
}

/**
 * 위저드 추천 결과
 */
export interface WizardRecommendation {
  rank: 1 | 2 | 3;
  model: ModelSummary;
  totalScore: number;
  scoreBreakdown: {
    benchmark: number;
    priceEfficiency: number;
    other: number;
  };
  weights: {
    benchmark: 0.4;
    priceEfficiency: 0.4;
    other: 0.2;
  };
}

/**
 * 공통 API 응답 래퍼
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: null;
  meta?: ApiMeta;
}

export interface ApiErrorResponse {
  success: false;
  data: null;
  error: {
    code: string;
    message: string;
  };
  meta?: ApiMeta;
}

export interface ApiMeta {
  cursor?: string | null;
  hasMore?: boolean;
  total?: number;
  rateLimit?: {
    limit: number;
    remaining: number;
    reset: string;
  };
}
