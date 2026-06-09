// REDLINE: 타인 비교/외모 점수 UI 금지
/**
 * 인메모리 슬라이딩 윈도우 레이트리밋 — 라이브 Claude API 비용/남용 방어 1차선.
 *
 * 왜 필요한가:
 *   /api/exam/generate 는 ANTHROPIC_API_KEY가 있으면 실제 Claude를 호출해 토큰
 *   비용이 발생한다. 인증·결제가 붙기 전까지 이 엔드포인트는 공개라, 한 IP가
 *   반복 호출하면 API 요금이 폭증할 수 있다. IP별 분당/일일 호출 횟수를 제한한다.
 *
 * 한계(반드시 인지):
 *   인메모리 카운터라 "단일 프로세스" 기준이다. Vercel 등 서버리스/멀티인스턴스
 *   환경에서는 인스턴스마다 카운터가 따로라 전역적으로 정확하지 않다. 그래도 단순
 *   봇·실수로 인한 무한 루프·단일 공격자 대부분을 막는 실질적 1차 방어다. 정밀·
 *   전역 제한이 필요해지면(=유료화/규모 확장 시) Upstash Redis(@upstash/ratelimit)
 *   같은 분산 저장소로 교체한다. 본 모듈은 순수 함수로 분리돼 그 교체가 쉽다.
 */

export type RateLimitResult = {
  ok: boolean;
  /** 윈도우 내 허용 최대 횟수 */
  limit: number;
  /** 남은 허용 횟수(허용 시) */
  remaining: number;
  /** 차단 시 다음 허용까지 남은 밀리초. 허용 시 윈도우 길이 */
  retryAfterMs: number;
};

type Store = Map<string, number[]>;

// 모듈 전역 저장소 — 프로세스 수명 동안 유지
const globalStore: Store = new Map();
let lastSweep = 0;

// 활동 없는 키 정리 기준 — 사용하는 최대 윈도우(일일=24h)보다 길게 잡아야
// 일일 카운터가 조기 삭제되지 않는다.
const SWEEP_TTL_MS = 25 * 60 * 60 * 1000; // 25h
const SWEEP_INTERVAL_MS = 60 * 1000; // 최대 1분에 한 번만 스윕

/**
 * 오래 비활동인 키만 제거해 메모리 누수를 막는다. 타임스탬프 배열 자체는
 * 건드리지 않으므로(=윈도우 계산은 rateLimit가 키별로 처리) 카운터가 오염되지 않는다.
 */
function sweep(store: Store, now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, hits] of store) {
    const last = hits[hits.length - 1];
    if (last === undefined || now - last > SWEEP_TTL_MS) store.delete(key);
  }
}

/**
 * 슬라이딩 윈도우 로그 방식. key별로 windowMs 안의 호출 timestamp를 보관하고
 * limit 이상이면 차단한다. 테스트를 위해 now/store를 주입할 수 있다(주입 시 전역
 * 스윕을 건너뛰어 모듈 상태를 건드리지 않는다).
 */
export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number; now?: number; store?: Store }
): RateLimitResult {
  const { limit, windowMs } = opts;
  const now = opts.now ?? Date.now();
  const store = opts.store ?? globalStore;

  const prev = store.get(key) ?? [];
  // 윈도우 밖(오래된) 타임스탬프 제거
  const hits = prev.filter((t) => now - t < windowMs);

  if (hits.length >= limit) {
    store.set(key, hits);
    const oldest = hits[0];
    const retryAfterMs = Math.max(0, windowMs - (now - oldest));
    return { ok: false, limit, remaining: 0, retryAfterMs };
  }

  hits.push(now);
  store.set(key, hits);
  if (opts.store === undefined) sweep(store, now);
  return { ok: true, limit, remaining: Math.max(0, limit - hits.length), retryAfterMs: windowMs };
}

/** 테스트용 — 전역 저장소 초기화 */
export function __resetRateLimit(): void {
  globalStore.clear();
  lastSweep = 0;
}
