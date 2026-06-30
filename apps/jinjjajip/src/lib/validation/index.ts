import { z } from "zod";

// ──────────────────────────────────────────────
// 검색 쿼리
// ──────────────────────────────────────────────

export const listingSearchQuerySchema = z.object({
  region: z.enum(["gwanak", "mapo"]).optional(),
  buildingType: z.enum(["oneroom", "officetel"]).optional(),
  minGrade: z.enum(["gold", "silver", "unverified"]).optional(),
  depositMax: z.coerce.number().int().nonnegative().optional(),
  rentMax: z.coerce.number().int().nonnegative().optional(),
  sort: z.enum(["trust", "recent", "price_low"]).optional().default("trust"),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export type ListingSearchQueryInput = z.input<typeof listingSearchQuerySchema>;
export type ListingSearchQueryParsed = z.infer<typeof listingSearchQuerySchema>;

// ──────────────────────────────────────────────
// 신고 페이로드
// ──────────────────────────────────────────────

export const reportPayloadSchema = z.object({
  listingId: z.string().uuid("listingId는 UUID여야 합니다."),
  reason: z.enum([
    "fake_listing",
    "wrong_photo",
    "wrong_price",
    "already_taken",
    "duplicate",
    "other",
  ]),
  detail: z
    .string()
    .max(200, "detail은 200자 이하여야 합니다.")
    .optional(),
  evidencePhotoId: z.string().uuid().optional(),
});

export type ReportPayloadInput = z.infer<typeof reportPayloadSchema>;

// ──────────────────────────────────────────────
// 업로드 초기화
// ──────────────────────────────────────────────

export const uploadInitSchema = z.object({
  listingId: z.string().uuid("listingId는 UUID여야 합니다."),
  fileCount: z
    .number()
    .int()
    .min(1, "파일이 최소 1개 이상이어야 합니다.")
    .max(10, "한 번에 최대 10개까지 업로드 가능합니다."),
  fileMetas: z
    .array(
      z.object({
        name: z.string().min(1),
        size: z.number().int().positive().max(20 * 1024 * 1024, "파일 크기는 20MB 이하여야 합니다."),
        mimeType: z.enum(["image/jpeg", "image/png", "image/heic", "image/heif"]),
      })
    )
    .min(1)
    .max(10),
});

export type UploadInitInput = z.infer<typeof uploadInitSchema>;
