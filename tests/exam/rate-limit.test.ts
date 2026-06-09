/**
 * rate-limit.ts 유닛 테스트 — 인메모리 슬라이딩 윈도우 레이트리밋
 * 대상: rateLimit() 순수 함수, __resetRateLimit()
 *
 * 결정성 규칙: now/store를 주입해 실시간·전역 상태에 의존하지 않는다.
 * (store 주입 시 모듈 전역 스윕을 건너뛰므로 테스트 간 간섭이 없다.)
 */
import { describe, it, expect } from "vitest";
import { rateLimit, __resetRateLimit } from "@/lib/server/rate-limit";

type Store = Map<string, number[]>;

describe("rateLimit() — 슬라이딩 윈도우", () => {
  it("RL-01: limit 까지는 허용한다", () => {
    const store: Store = new Map();
    const opts = { limit: 3, windowMs: 60_000, now: 1_000, store };
    expect(rateLimit("ip", opts).ok).toBe(true);
    expect(rateLimit("ip", opts).ok).toBe(true);
    expect(rateLimit("ip", opts).ok).toBe(true);
  });

  it("RL-02: limit+1 번째는 차단한다", () => {
    const store: Store = new Map();
    const opts = { limit: 2, windowMs: 60_000, now: 1_000, store };
    rateLimit("ip", opts);
    rateLimit("ip", opts);
    const blocked = rateLimit("ip", opts);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.limit).toBe(2);
  });

  it("RL-03: remaining 이 호출마다 정확히 감소한다", () => {
    const store: Store = new Map();
    const opts = { limit: 3, windowMs: 60_000, now: 1_000, store };
    expect(rateLimit("ip", opts).remaining).toBe(2);
    expect(rateLimit("ip", opts).remaining).toBe(1);
    expect(rateLimit("ip", opts).remaining).toBe(0);
  });

  it("RL-04: 윈도우가 완전히 지나면 다시 허용한다", () => {
    const store: Store = new Map();
    const limit = 2;
    const windowMs = 60_000;
    rateLimit("ip", { limit, windowMs, now: 1_000, store });
    rateLimit("ip", { limit, windowMs, now: 2_000, store });
    expect(rateLimit("ip", { limit, windowMs, now: 3_000, store }).ok).toBe(false);
    // 가장 오래된 히트(1_000)가 윈도우 밖으로 나가는 시점 이후
    expect(rateLimit("ip", { limit, windowMs, now: 61_001, store }).ok).toBe(true);
  });

  it("RL-05: 슬라이딩 — 일부만 만료되면 그만큼만 회복한다", () => {
    const store: Store = new Map();
    const limit = 2;
    const windowMs = 60_000;
    rateLimit("ip", { limit, windowMs, now: 1_000, store }); // hit @1s
    rateLimit("ip", { limit, windowMs, now: 30_000, store }); // hit @30s → 한도 도달
    // @61_001ms: 첫 히트(1s)만 만료, 30s 히트는 살아있음 → 1칸만 회복
    const r = rateLimit("ip", { limit, windowMs, now: 61_001, store });
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(0); // 30s 히트 + 방금 히트 = 2/2
    // 바로 다음 호출은 다시 차단 (30s, 61s 두 히트가 윈도우 안)
    expect(rateLimit("ip", { limit, windowMs, now: 61_002, store }).ok).toBe(false);
  });

  it("RL-06: 키가 다르면 카운터가 독립적이다", () => {
    const store: Store = new Map();
    const opts = { limit: 1, windowMs: 60_000, now: 1_000, store };
    expect(rateLimit("ip-a", opts).ok).toBe(true);
    expect(rateLimit("ip-b", opts).ok).toBe(true); // 다른 키는 영향 없음
    expect(rateLimit("ip-a", opts).ok).toBe(false); // 같은 키는 차단
  });

  it("RL-07: 차단 시 retryAfterMs 는 가장 오래된 히트 기준으로 계산된다", () => {
    const store: Store = new Map();
    const limit = 1;
    const windowMs = 60_000;
    rateLimit("ip", { limit, windowMs, now: 10_000, store }); // 유일 히트 @10s
    const blocked = rateLimit("ip", { limit, windowMs, now: 40_000, store });
    expect(blocked.ok).toBe(false);
    // 가장 오래된 히트(10s)가 만료되기까지: 60_000 - (40_000 - 10_000) = 30_000
    expect(blocked.retryAfterMs).toBe(30_000);
  });

  it("RL-08: 허용 시 retryAfterMs 는 윈도우 길이를 반환한다", () => {
    const store: Store = new Map();
    const r = rateLimit("ip", { limit: 5, windowMs: 60_000, now: 1_000, store });
    expect(r.ok).toBe(true);
    expect(r.retryAfterMs).toBe(60_000);
  });

  it("RL-09: 분/일 윈도우를 한 키 네임스페이스로 함께 써도 독립적이다", () => {
    const store: Store = new Map();
    const now = 1_000;
    // 분 한도 1, 일 한도 5 가정
    expect(rateLimit("ip:min", { limit: 1, windowMs: 60_000, now, store }).ok).toBe(true);
    expect(rateLimit("ip:min", { limit: 1, windowMs: 60_000, now: 2_000, store }).ok).toBe(false);
    // 일 카운터는 아직 여유
    expect(rateLimit("ip:day", { limit: 5, windowMs: 86_400_000, now, store }).ok).toBe(true);
  });

  it("RL-10: __resetRateLimit() 후 전역 카운터가 초기화된다", () => {
    // 전역 저장소(store 미주입) 경로를 직접 검증
    __resetRateLimit();
    const opts = { limit: 1, windowMs: 60_000, now: 1_000 };
    expect(rateLimit("global-ip", opts).ok).toBe(true);
    expect(rateLimit("global-ip", opts).ok).toBe(false);
    __resetRateLimit();
    expect(rateLimit("global-ip", opts).ok).toBe(true); // 리셋되어 다시 허용
    __resetRateLimit(); // 뒷정리
  });
});
