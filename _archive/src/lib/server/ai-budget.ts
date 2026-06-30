/**
 * AI 비용 예산 카운터 (Upstash Redis)
 * 유저당 월 ₩200 상한 (Q4 사장 확정)
 * 초과 시 폴백 모델(GPT-4o-mini / Claude Haiku)로 자동 다운그레이드
 */

import { Redis } from "@upstash/redis";
import { Errors } from "./errors";

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------

/** 월 상한 (원) — AI_BUDGET_KRW_MONTHLY 환경변수로 오버라이드 가능 */
const DEFAULT_MONTHLY_BUDGET_KRW = 200;

/** 환율 기준 (고정값, 실제 환경에서는 외부 API 또는 주기적 업데이트) */
const USD_TO_KRW = 1_350;

// ---------------------------------------------------------------------------
// 토큰 단가 (2026-05 기준 추정치, 실제는 ENV로 조정)
// ---------------------------------------------------------------------------

const TOKEN_COST_KRW: Record<AiModel, { input: number; output: number }> = {
  "claude-sonnet-4-5": {
    input: (3.0 / 1_000_000) * USD_TO_KRW,   // $3.00 / 1M tokens
    output: (15.0 / 1_000_000) * USD_TO_KRW,  // $15.00 / 1M tokens
  },
  "gpt-4o-mini": {
    input: (0.15 / 1_000_000) * USD_TO_KRW,   // $0.15 / 1M tokens
    output: (0.6 / 1_000_000) * USD_TO_KRW,   // $0.60 / 1M tokens
  },
  "claude-haiku": {
    input: (0.25 / 1_000_000) * USD_TO_KRW,   // $0.25 / 1M tokens
    output: (1.25 / 1_000_000) * USD_TO_KRW,  // $1.25 / 1M tokens
  },
};

// ---------------------------------------------------------------------------
// 모델 타입
// ---------------------------------------------------------------------------

export type AiModel = "claude-sonnet-4-5" | "gpt-4o-mini" | "claude-haiku";

export const PRIMARY_MODEL: AiModel = "claude-sonnet-4-5";
export const FALLBACK_MODEL_1: AiModel = "gpt-4o-mini";
export const FALLBACK_MODEL_2: AiModel = "claude-haiku";

// ---------------------------------------------------------------------------
// Redis 키 헬퍼
// ---------------------------------------------------------------------------

function budgetKey(userId: string, yearMonth: string): string {
  return `ai_budget:${userId}:${yearMonth}`;
}

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Redis 클라이언트
// ---------------------------------------------------------------------------

function getRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("Upstash Redis 환경변수 누락");
  }
  return new Redis({ url, token });
}

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------

/** 현재 사용량 조회 (원) */
export async function getMonthlyUsageKrw(userId: string): Promise<number> {
  const redis = getRedis();
  const key = budgetKey(userId, currentYearMonth());
  const value = await redis.get<string>(key);
  return value ? parseFloat(value) : 0;
}

/**
 * 예산 내에서 사용할 모델을 결정.
 * - 예산 50% 미만: PRIMARY (claude-sonnet-4-5)
 * - 예산 50~90%: FALLBACK_1 (gpt-4o-mini)
 * - 예산 90%+: FALLBACK_2 (claude-haiku)
 * - 예산 초과: E_AI_QUOTA_EXCEEDED throw (하드 차단은 안 함, 폴백 유지)
 *
 * 설계 의도: 유저 경험 최우선 — 완전 차단보다 저품질 폴백 우선
 */
export async function resolveAiModel(userId: string): Promise<AiModel> {
  const usedKrw = await getMonthlyUsageKrw(userId);
  const budget = parseInt(process.env.AI_BUDGET_KRW_MONTHLY ?? String(DEFAULT_MONTHLY_BUDGET_KRW));
  const ratio = usedKrw / budget;

  if (ratio < 0.5) return PRIMARY_MODEL;
  if (ratio < 0.9) return FALLBACK_MODEL_1;
  if (ratio < 1.0) return FALLBACK_MODEL_2;

  // 100% 초과: 에러를 throw하지 않고 가장 저렴한 모델 유지 (UX 우선)
  // 백엔드팀장 결정 필요: 하드 차단 vs 폴백 유지 (BT-DECISION-01 참조)
  return FALLBACK_MODEL_2;
}

/**
 * AI 호출 후 비용 기록.
 * @param promptTokens - 입력 토큰 수
 * @param completionTokens - 출력 토큰 수
 * @param model - 사용된 모델
 */
export async function recordAiUsage(
  userId: string,
  model: AiModel,
  promptTokens: number,
  completionTokens: number
): Promise<{ usedKrw: number; totalUsedKrw: number }> {
  const costs = TOKEN_COST_KRW[model];
  const usedKrw =
    promptTokens * costs.input + completionTokens * costs.output;

  const redis = getRedis();
  const key = budgetKey(userId, currentYearMonth());

  // INCRBYFLOAT + TTL 설정 (월말 자동 만료를 위해 32일)
  const newTotal = await redis.incrbyfloat(key, usedKrw);
  await redis.expire(key, 60 * 60 * 24 * 32);

  // 예산 90% 초과 시 경고 (E_AI_QUOTA_EXCEEDED는 throw 하지 않고 로그만)
  const budget = parseInt(process.env.AI_BUDGET_KRW_MONTHLY ?? String(DEFAULT_MONTHLY_BUDGET_KRW));
  if (newTotal > budget * 0.9) {
    console.warn(`[AiBudget] 유저 ${userId} 예산 90% 초과: ₩${newTotal.toFixed(1)} / ₩${budget}`);
  }

  return { usedKrw, totalUsedKrw: newTotal };
}

/** 예산 사용률 (0~1) */
export async function getBudgetRatio(userId: string): Promise<number> {
  const usedKrw = await getMonthlyUsageKrw(userId);
  const budget = parseInt(process.env.AI_BUDGET_KRW_MONTHLY ?? String(DEFAULT_MONTHLY_BUDGET_KRW));
  return Math.min(usedKrw / budget, 1);
}
