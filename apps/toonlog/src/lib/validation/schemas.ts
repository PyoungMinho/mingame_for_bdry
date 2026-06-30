/**
 * Zod 입력 검증 스키마.
 * contract.ts 타입과 1:1 대응하되 재정의 없이 import 확장만.
 * 변경 금지: contract.ts / constants.ts
 */
import { z } from "zod";
import { DIARY_TEXT_MIN, DIARY_TEXT_MAX } from "@/lib/constants";

/* ─── 공통 ─── */

const artStyleSchema = z.enum([
  "emotional_line",
  "bold_pen",
  "pop_cartoon",
  "watercolor_touch",
]);

const avatarHairColorSchema = z.enum([
  "black", "brown", "blonde", "red", "pink", "blue", "green", "white",
]);

const avatarTopStyleSchema = z.enum([
  "white-top", "stripe", "hoodie", "uniform", "casual", "formal", "sport", "vintage",
]);

const avatarAccessorySchema = z.enum(["glasses", "hat", "earphone", "none"]);

const avatarConfigSchema = z.object({
  preset: z.string().optional(),
  hairColor: avatarHairColorSchema,
  topStyle: avatarTopStyleSchema,
  accessory: avatarAccessorySchema,
  seed: z.number().int().min(0).max(2147483647),
});

const panelIndexSchema = z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(4),
]);

/* ─── POST /api/diary ─── */

export const createDiaryBodySchema = z.object({
  text: z
    .string()
    .min(DIARY_TEXT_MIN, `일기는 최소 ${DIARY_TEXT_MIN}자 이상이어야 합니다.`)
    .max(DIARY_TEXT_MAX, `일기는 최대 ${DIARY_TEXT_MAX}자까지 입력할 수 있습니다.`),
  artStyle: artStyleSchema,
  avatar: avatarConfigSchema,
});

export type CreateDiaryBody = z.infer<typeof createDiaryBodySchema>;

/* ─── GET /api/diary (아카이브/홈 목록) ─── */

export const listDiaryQuerySchema = z.object({
  /** offset 기반 커서 (문자열 정수). 무한스크롤 nextCursor 로 사용 */
  cursor: z
    .string()
    .regex(/^\d+$/, "cursor는 정수여야 합니다.")
    .optional(),
  /** 페이지 크기 (기본 30, 최대 60) */
  limit: z
    .string()
    .regex(/^\d+$/)
    .optional(),
  /** 캘린더 월 필터 YYYY-MM */
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "month는 YYYY-MM 형식이어야 합니다.")
    .optional(),
});

export type ListDiaryQuery = z.infer<typeof listDiaryQuerySchema>;

/* ─── PATCH /api/diary/[id]/balloons (말풍선 편집 저장) ─── */

const tailDirectionSchema = z.enum(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);
const balloonTypeSchema = z.enum(["speech", "thought", "shout", "whisper"]);

const balloonMetaSchema = z.object({
  id: z.string().min(1),
  type: balloonTypeSchema,
  tail: tailDirectionSchema,
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
  suggested_text: z.string().optional(),
});

export const updateBalloonsBodySchema = z.object({
  /** 컷별 말풍선 메타 갱신 목록 */
  panels: z
    .array(
      z.object({
        index: panelIndexSchema,
        balloons: z.array(balloonMetaSchema),
      })
    )
    .min(1)
    .max(4),
});

export type UpdateBalloonsBody = z.infer<typeof updateBalloonsBodySchema>;

/* ─── POST /api/diary/[id]/regenerate ─── */

export const regenerateBodySchema = z.object({
  diaryId: z.string().uuid(),
  panelIndex: panelIndexSchema.optional(),
});

export type RegenerateBody = z.infer<typeof regenerateBodySchema>;

/* ─── POST /api/payments/confirm ─── */

export const paymentConfirmBodySchema = z.object({
  paymentKey: z.string().min(1),
  orderId: z.string().min(1),
  amount: z.number().int().positive(),
});

export type PaymentConfirmBody = z.infer<typeof paymentConfirmBodySchema>;

/* ─── POST /api/payments/webhook ─── */

export const paymentWebhookBodySchema = z.object({
  eventType: z.string(),
  data: z.object({
    paymentKey: z.string().optional(),
    orderId: z.string().optional(),
    status: z.string().optional(),
  }).passthrough(),
});

export type PaymentWebhookBody = z.infer<typeof paymentWebhookBodySchema>;

/* ─── 공통 에러 응답 헬퍼 ─── */

export const errorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
