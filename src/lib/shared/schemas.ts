/**
 * 오름(Oreum) 공유 스키마 정의
 * 클라이언트·서버 모두 import 가능 (서버 전용 로직 없음)
 * Zod v3 기반
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// 공통 래퍼
// ---------------------------------------------------------------------------

export const SuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z
      .object({
        requestId: z.string().optional(),
        ts: z.string().datetime(),
      })
      .optional(),
  });

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  meta: z
    .object({
      requestId: z.string().optional(),
      ts: z.string().datetime(),
    })
    .optional(),
});

// ---------------------------------------------------------------------------
// 4축 공통
// ---------------------------------------------------------------------------

/** 0~100 정수 슬라이더 값 */
export const AxisScoreSchema = z.number().int().min(0).max(100);

export const FourAxisSchema = z.object({
  health: AxisScoreSchema,
  learning: AxisScoreSchema,
  relation: AxisScoreSchema,
  achievement: AxisScoreSchema,
});
export type FourAxis = z.infer<typeof FourAxisSchema>;

/** 점수 스냅샷 (결정론 산식 결과) */
export const ScoreSnapshotSchema = z.object({
  health: z.number(),
  learning: z.number(),
  relation: z.number(),
  achievement: z.number(),
  total: z.number(),
  ts: z.string().datetime(),
  /** 점수 산식 버전 (G 항목 부분 공개 대응) */
  version: z.string(),
});
export type ScoreSnapshot = z.infer<typeof ScoreSnapshotSchema>;

/** 변화량 (오늘 - 어제) */
export const ScoreDeltaSchema = z.object({
  health: z.number(),
  learning: z.number(),
  relation: z.number(),
  achievement: z.number(),
  total: z.number(),
});
export type ScoreDelta = z.infer<typeof ScoreDeltaSchema>;

// ---------------------------------------------------------------------------
// POST /api/checkin
// ---------------------------------------------------------------------------

export const CheckinRequestSchema = z.object({
  health: AxisScoreSchema,
  learning: AxisScoreSchema,
  relation: AxisScoreSchema,
  achievement: AxisScoreSchema,
  /** 선택: 한 줄 메모 (500자 이하) */
  memo: z.string().max(500).optional(),
});
export type CheckinRequest = z.infer<typeof CheckinRequestSchema>;

export const MissionSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().optional(),
  axis: z.enum(["health", "learning", "relation", "achievement"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
});
export type Mission = z.infer<typeof MissionSchema>;

export const CheckinResponseSchema = z.object({
  checkinId: z.string().uuid(),
  score: ScoreSnapshotSchema,
  delta: ScoreDeltaSchema,
  /** 오늘의 미션 1개 (체크인과 동시에 1 RTT로 반환) */
  todayMission: MissionSchema,
  /** 스트릭 정보 */
  streak: z.object({
    current: z.number().int().min(0),
    isNewRecord: z.boolean(),
    graceUntil: z.string().datetime().nullable(),
  }),
});
export type CheckinResponse = z.infer<typeof CheckinResponseSchema>;

// ---------------------------------------------------------------------------
// GET /api/score/today
// ---------------------------------------------------------------------------

export const ScoreTodayResponseSchema = z.object({
  score: ScoreSnapshotSchema,
  hasCheckedInToday: z.boolean(),
  delta: ScoreDeltaSchema.nullable(),
});
export type ScoreTodayResponse = z.infer<typeof ScoreTodayResponseSchema>;

// ---------------------------------------------------------------------------
// GET /api/score/history
// ---------------------------------------------------------------------------

export const HistoryPeriodSchema = z.enum(["7", "30", "90"]);
export type HistoryPeriod = z.infer<typeof HistoryPeriodSchema>;

export const ScoreHistoryPointSchema = z.object({
  date: z.string().date(), // YYYY-MM-DD
  score: ScoreSnapshotSchema,
});

export const ScoreHistoryResponseSchema = z.object({
  period: HistoryPeriodSchema,
  points: z.array(ScoreHistoryPointSchema),
  /** cursor 기반 페이지네이션 */
  nextCursor: z.string().nullable(),
});
export type ScoreHistoryResponse = z.infer<typeof ScoreHistoryResponseSchema>;

// ---------------------------------------------------------------------------
// POST /api/coach/chat  (SSE 스트리밍 — 청크 단위 스키마)
// ---------------------------------------------------------------------------

export const CoachChatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  /** 페르소나 선택 */
  persona: z.enum(["mentor", "spartan", "friend"]).default("mentor"),
  /** 대화 컨텍스트 (최근 N턴) */
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .max(20)
    .optional(),
});
export type CoachChatRequest = z.infer<typeof CoachChatRequestSchema>;

/** SSE 스트림 청크 타입 */
export const CoachChatChunkSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("delta"), content: z.string() }),
  z.object({
    type: z.literal("done"),
    usage: z.object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      estimatedKrw: z.number(),
    }),
  }),
  z.object({ type: z.literal("error"), code: z.string(), message: z.string() }),
]);
export type CoachChatChunk = z.infer<typeof CoachChatChunkSchema>;

// ---------------------------------------------------------------------------
// GET /api/mission/today
// ---------------------------------------------------------------------------

export const MissionTodayResponseSchema = z.object({
  mission: MissionSchema.nullable(),
  completedAt: z.string().datetime().nullable(),
});
export type MissionTodayResponse = z.infer<typeof MissionTodayResponseSchema>;

// ---------------------------------------------------------------------------
// POST /api/goal
// ---------------------------------------------------------------------------

export const GoalRequestSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().max(1000).optional(),
  targetDate: z.string().date().optional(),
  axis: z.enum(["health", "learning", "relation", "achievement"]).optional(),
});
export type GoalRequest = z.infer<typeof GoalRequestSchema>;

export const MilestoneSchema = z.object({
  id: z.string().uuid(),
  week: z.number().int().min(1).max(13),
  title: z.string(),
  description: z.string().optional(),
  targetScore: z.number().nullable(),
});
export type Milestone = z.infer<typeof MilestoneSchema>;

export const GoalResponseSchema = z.object({
  goalId: z.string().uuid(),
  title: z.string(),
  /** AI가 분해한 주차별 마일스톤 (90일 = 13주) */
  milestones: z.array(MilestoneSchema),
  createdAt: z.string().datetime(),
});
export type GoalResponse = z.infer<typeof GoalResponseSchema>;

// ---------------------------------------------------------------------------
// POST /api/onboarding/age-verify
// ---------------------------------------------------------------------------

export const AgeVerifyRequestSchema = z.object({
  birthDate: z.string().date(), // YYYY-MM-DD
});
export type AgeVerifyRequest = z.infer<typeof AgeVerifyRequestSchema>;

export const AgeVerifyResponseSchema = z.object({
  allowed: z.boolean(),
  /** 허용된 경우 true, 차단된 경우 false + E_AGE_BLOCKED 에러 반환 */
  age: z.number().int().min(0),
});
export type AgeVerifyResponse = z.infer<typeof AgeVerifyResponseSchema>;

// ---------------------------------------------------------------------------
// GET /api/me
// ---------------------------------------------------------------------------

export const PersonaSchema = z.enum(["mentor", "spartan", "friend"]);
export type Persona = z.infer<typeof PersonaSchema>;

export const SubscriptionTierSchema = z.enum(["free", "basic", "pro"]);
export type SubscriptionTier = z.infer<typeof SubscriptionTierSchema>;

export const MeResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  nickname: z.string().nullable(),
  /** 가입일 */
  createdAt: z.string().datetime(),
  persona: PersonaSchema,
  subscription: z.object({
    tier: SubscriptionTierSchema,
    expiresAt: z.string().datetime().nullable(),
    /** 코치챗 3일 무료 체험 만료 시각 (Q5=B) */
    coachFreeUntil: z.string().datetime().nullable(),
    isCoachFreeActive: z.boolean(),
  }),
  /** 이번 달 AI 예산 사용률 (0~1) */
  aiBudgetUsageRatio: z.number().min(0).max(1),
  /** 북극성 다짐 */
  northStarStatement: z.string().nullable(),
  /** 만16세 미만 차단 플래그 */
  isAgeBlocked: z.boolean(),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;
