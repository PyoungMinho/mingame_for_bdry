/**
 * Upstash Redis 기반 레이트리밋
 * 유저별 분당 60 req (일반), AI 호출 분당 5
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { Errors } from "./errors";

// ---------------------------------------------------------------------------
// Redis 클라이언트 (싱글톤)
// ---------------------------------------------------------------------------

let redis: Redis | null = null;

function getRedis(): Redis {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error("UPSTASH_REDIS_REST_URL 또는 UPSTASH_REDIS_REST_TOKEN 환경변수가 없습니다");
  }

  redis = new Redis({ url, token });
  return redis;
}

// ---------------------------------------------------------------------------
// 레이트리밋 인스턴스
// ---------------------------------------------------------------------------

/** 일반 API: 유저당 분당 60 요청 */
let generalLimiter: Ratelimit | null = null;

function getGeneralLimiter(): Ratelimit {
  if (generalLimiter) return generalLimiter;
  generalLimiter = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "rl:general",
  });
  return generalLimiter;
}

/** AI 호출: 유저당 분당 5 요청 */
let aiLimiter: Ratelimit | null = null;

function getAiLimiter(): Ratelimit {
  if (aiLimiter) return aiLimiter;
  aiLimiter = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    prefix: "rl:ai",
  });
  return aiLimiter;
}

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------

/**
 * 일반 API 레이트리밋 검사.
 * 초과 시 E_RATE_LIMIT throw.
 */
export async function checkGeneralRateLimit(userId: string): Promise<void> {
  const { success, limit, remaining, reset } = await getGeneralLimiter().limit(userId);

  if (!success) {
    throw Object.assign(Errors.rateLimit(), {
      headers: {
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": String(remaining),
        "X-RateLimit-Reset": String(reset),
      },
    });
  }
}

/**
 * AI 호출 레이트리밋 검사.
 * 초과 시 E_RATE_LIMIT throw.
 */
export async function checkAiRateLimit(userId: string): Promise<void> {
  const { success } = await getAiLimiter().limit(userId);

  if (!success) {
    throw Errors.rateLimit();
  }
}

// ---------------------------------------------------------------------------
// 레이트리밋 헤더 설정 헬퍼
// ---------------------------------------------------------------------------

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

export function applyRateLimitHeaders(
  headers: Headers,
  info: RateLimitInfo
): void {
  headers.set("X-RateLimit-Limit", String(info.limit));
  headers.set("X-RateLimit-Remaining", String(info.remaining));
  headers.set("X-RateLimit-Reset", String(info.reset));
}
