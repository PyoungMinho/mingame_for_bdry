/**
 * Zod 스키마 — 모든 외부 입력 검증
 */
import { z } from "zod";

// ─── 위저드 입력 ───────────────────────────────────────────────

export const WizardInputSchema = z.object({
  /** 직무/역할 */
  role: z
    .enum([
      "developer",
      "marketer",
      "student",
      "researcher",
      "designer",
      "pm",
      "other",
    ])
    .describe("사용자 직무"),
  /** 주요 작업 */
  task: z
    .enum([
      "coding",
      "writing",
      "summarization",
      "translation",
      "image_generation",
      "data_analysis",
      "customer_support",
      "research",
      "other",
    ])
    .describe("주요 작업 유형"),
  /** 예산 티어 */
  budget: z
    .enum(["free", "low", "mid", "high"])
    .describe(
      "예산 티어 — free: $0, low: $1~10/월, mid: $10~50/월, high: $50+/월"
    ),
});

export type WizardInput = z.infer<typeof WizardInputSchema>;

// ─── 관리자 — 모델 등록 ───────────────────────────────────────

export const AdminCreateModelSchema = z.object({
  // BIGSERIAL이므로 string으로 받고 숫자형 검증
  category_id: z.string().regex(/^\d+$/, "category_id must be numeric"),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "slug는 소문자 영숫자와 하이픈만 허용"),
  name: z.string().min(1).max(200),
  provider_id: z
    .string()
    .regex(/^\d+$/, "provider_id must be numeric")
    .nullable()
    .optional(),
  status: z
    .enum(["draft", "review", "published"])
    .default("draft"),
  released_at: z.string().nullable().optional(),
  summary: z.string().max(500).nullable().optional(),
  attrs: z.record(z.unknown()).default({}),
});

export type AdminCreateModelInput = z.infer<typeof AdminCreateModelSchema>;

// ─── 관리자 — 모델 수정 ───────────────────────────────────────

export const AdminUpdateModelSchema = AdminCreateModelSchema.partial().omit({
  slug: true,
  category_id: true,
});

export type AdminUpdateModelInput = z.infer<typeof AdminUpdateModelSchema>;

// ─── 목록 필터 ────────────────────────────────────────────────

export const ListModelsQuerySchema = z.object({
  provider: z.string().optional(),
  modality: z.string().optional(),
  status: z.enum(["draft", "review", "published"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListModelsQuery = z.infer<typeof ListModelsQuerySchema>;

// ─── 검색 ─────────────────────────────────────────────────────

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

// ─── 비교 ─────────────────────────────────────────────────────

export const CompareQuerySchema = z.object({
  ids: z
    .string()
    .min(1)
    .transform((v) => v.split(",").map((s) => s.trim()))
    .pipe(
      z
        .array(z.string().min(1))
        .min(2, "최소 2개 모델 슬러그 필요")
        .max(4, "최대 4개까지 비교 가능")
    ),
});

export type CompareQuery = z.infer<typeof CompareQuerySchema>;

// ─── 리더보드 ─────────────────────────────────────────────────

export const LeaderboardMetricSchema = z.enum([
  "price",
  "coding",
  "speed",
  "quality",
]);

export type LeaderboardMetric = z.infer<typeof LeaderboardMetricSchema>;
