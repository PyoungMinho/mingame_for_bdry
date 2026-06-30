/**
 * AI 비용 예산 가드 — A-401 ~ A-411
 * CR-1 (ratio>=1.05 하드 차단) 미구현 검증 — FAIL 예상 = BUG-001
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Upstash Redis mock — 모듈 단위 모킹
const redisStore = new Map<string, number>();

vi.mock("@upstash/redis", () => {
  return {
    Redis: class {
      async get<T = unknown>(key: string): Promise<T | null> {
        const v = redisStore.get(key);
        return (v === undefined ? null : (String(v) as unknown as T));
      }
      async incrbyfloat(key: string, delta: number): Promise<number> {
        const cur = redisStore.get(key) ?? 0;
        const next = cur + delta;
        redisStore.set(key, next);
        return next;
      }
      async expire(_key: string, _seconds: number): Promise<number> {
        return 1;
      }
    },
  };
});

// 모킹 적용 후 import
import {
  resolveAiModel,
  getMonthlyUsageKrw,
  recordAiUsage,
  getBudgetRatio,
  PRIMARY_MODEL,
  FALLBACK_MODEL_1,
  FALLBACK_MODEL_2,
} from "@/lib/server/ai-budget";
import { AppError } from "@/lib/server/errors";

const USER = "user-test-ai-budget";

function seedUsage(userId: string, krw: number) {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  redisStore.set(`ai_budget:${userId}:${ym}`, krw);
}

describe("ai-budget — 모델 폴백 7구간 (A-401~A-407)", () => {
  beforeEach(() => {
    redisStore.clear();
    process.env.AI_BUDGET_KRW_MONTHLY = "200";
  });

  it("A-401: ratio=0 일 때 PRIMARY 모델", async () => {
    seedUsage(USER, 0);
    expect(await resolveAiModel(USER)).toBe(PRIMARY_MODEL);
  });

  it("A-402: ratio=0.49 (₩98/₩200) 일 때 PRIMARY", async () => {
    seedUsage(USER, 98);
    expect(await resolveAiModel(USER)).toBe(PRIMARY_MODEL);
  });

  it("A-403: ratio=0.5 경계값 FALLBACK_1 로 다운그레이드", async () => {
    seedUsage(USER, 100);
    expect(await resolveAiModel(USER)).toBe(FALLBACK_MODEL_1);
  });

  it("A-404: ratio=0.89 (₩178/₩200) 일 때 FALLBACK_1", async () => {
    seedUsage(USER, 178);
    expect(await resolveAiModel(USER)).toBe(FALLBACK_MODEL_1);
  });

  it("A-405: ratio=0.9 경계값 FALLBACK_2 (Haiku) 다운그레이드", async () => {
    seedUsage(USER, 180);
    expect(await resolveAiModel(USER)).toBe(FALLBACK_MODEL_2);
  });

  it("A-406: ratio=0.99 (₩198/₩200) 일 때 FALLBACK_2", async () => {
    seedUsage(USER, 198);
    expect(await resolveAiModel(USER)).toBe(FALLBACK_MODEL_2);
  });

  it("A-407: ratio=1.0 (₩200/₩200) 일 때 FALLBACK_2 유지", async () => {
    seedUsage(USER, 200);
    expect(await resolveAiModel(USER)).toBe(FALLBACK_MODEL_2);
  });
});

describe("ai-budget — 105% 하드 차단 (A-408) [CR-1]", () => {
  beforeEach(() => {
    redisStore.clear();
    process.env.AI_BUDGET_KRW_MONTHLY = "200";
  });

  it("A-408: ratio=1.05 (₩210/₩200) 일 때 E_AI_QUOTA_EXCEEDED throw 필수", async () => {
    seedUsage(USER, 210);
    // 현재 코드: throw 안 함 → 이 케이스는 FAIL 예상 = BUG-001
    await expect(resolveAiModel(USER)).rejects.toBeInstanceOf(AppError);
  });

  it("A-408b: ratio=2.0 (₩400) 폭주 케이스 — 반드시 throw", async () => {
    seedUsage(USER, 400);
    await expect(resolveAiModel(USER)).rejects.toThrow(/한도|QUOTA/i);
  });
});

describe("ai-budget — 사용량 기록 + Redis 키 (A-409~A-411)", () => {
  beforeEach(() => {
    redisStore.clear();
    process.env.AI_BUDGET_KRW_MONTHLY = "200";
  });

  it("A-409: recordAiUsage 후 getMonthlyUsageKrw 가 증가", async () => {
    await recordAiUsage(USER, "claude-haiku", 1000, 500);
    const usage = await getMonthlyUsageKrw(USER);
    expect(usage).toBeGreaterThan(0);
  });

  it("A-410: getBudgetRatio 상한 1.0 클램프", async () => {
    seedUsage(USER, 1000); // 5배 초과
    const ratio = await getBudgetRatio(USER);
    expect(ratio).toBe(1);
  });

  it("A-411 [HI-1]: KST 5/31 23:00 ↔ 6/1 00:30 월 키 분리 (현재 UTC라 같은 키 — 실패 예상)", async () => {
    // KST 6/1 00:30 = UTC 5/31 15:30 → 현재 getMonth() 는 UTC 기준 → 의도와 다름
    // 이 케이스는 HI-1 회귀 가드. 현재는 fail 예상.
    vi.useFakeTimers();

    vi.setSystemTime(new Date("2026-05-31T14:00:00Z")); // KST 5/31 23:00
    const usage1 = await recordAiUsage(USER, "claude-haiku", 1000, 500);

    vi.setSystemTime(new Date("2026-05-31T15:30:00Z")); // KST 6/1 00:30
    const usage2 = await getMonthlyUsageKrw(USER);

    // 의도: KST 새 달이므로 usage2=0
    // 현재 UTC 구현: usage2 = usage1.totalUsedKrw (같은 5월 키)
    expect(usage2).toBe(0);
  });
});
