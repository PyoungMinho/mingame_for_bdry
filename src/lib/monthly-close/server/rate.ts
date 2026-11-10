/**
 * 남용 제한 (소유: API설계자). 전부 함수 인스턴스 메모리 안에서만 센다(최선 노력).
 * IP는 저장하지 않는다 — 이 파일의 맵은 프로세스가 끝나면 사라지고 DB·로그에 가지 않는다(방향서 B8).
 * 한 인스턴스만 보는 제한이므로 최종 방어선은 활성 방 상한(ACTIVE_ROOMS_CAP, pipeline)이다.
 */

export interface RateRule {
  readonly limit: number;
  readonly windowMs: number;
}

/** 백엔드 검토 §7 */
export const RATE_RULES = {
  /** 비밀키당 방 만들기 10분 5회 */
  createByKey: { limit: 5, windowMs: 10 * 60_000 },
  /** IP당 방 만들기 시간당 30회(메모리) */
  createByIp: { limit: 30, windowMs: 60 * 60_000 },
  /** 비밀키당 입장 실패 10분 20회 */
  joinFailByKey: { limit: 20, windowMs: 10 * 60_000 },
  /** 비밀키당 액션 초당 10회 */
  actionByKey: { limit: 10, windowMs: 1_000 },
  /** 비밀키당 sync 초당 8회(정상 클라는 초당 1~2회) */
  syncByKey: { limit: 8, windowMs: 1_000 },
  /** 비밀키당 feedback 분당 30회 */
  feedbackByKey: { limit: 30, windowMs: 60_000 },
  /**
   * [D3] 비밀키당 입장·재입장 요청 분당 20회. 재입장은 성공해도 load 2회 + touch를 쓰므로 연타를 막는다.
   */
  joinByKey: { limit: 20, windowMs: 60_000 },
  /**
   * [D3] IP당 방 접근 실패(ROOM_NOT_FOUND·ROOM_FULL·NOT_JOINED, join·sync·action 합산) 10분 60회(메모리).
   * 비밀키는 브라우저가 공짜로 새로 만들 수 있어 키당 제한만으로는 방 번호 무차별 대입을 못 막는다.
   * 회사 NAT 뒤 여러 명이 한 IP를 써도 정상 실패(오타·만료 방, 클라는 실패 후 폴링을 멈춤)는 이보다 훨씬 적다.
   */
  accessFailByIp: { limit: 60, windowMs: 10 * 60_000 },
  /** [D3] IP당 feedback 분당 120회(메모리). transport는 참가자 확인 없이 기록되므로 키를 바꿔 가며 mc_events를 채우는 것을 늦춘다 */
  feedbackByIp: { limit: 120, windowMs: 60_000 },
} as const satisfies Record<string, RateRule>;

/** IP를 모르면(헤더 없음) IP 단위 제한을 건너뛴다 — 모두가 한 버킷에 묶여 서로를 막지 않게 */
export const UNKNOWN_IP = 'unknown';

export type RateResult = { ok: true } | { ok: false; retryAfterMs: number };

const MAX_KEYS = 20_000;

export class RateLimiter {
  private hits = new Map<string, number[]>();

  /** 기록하면서 검사한다. */
  hit(bucket: string, id: string, rule: RateRule, now: number): RateResult {
    const k = `${bucket}:${id}`;
    const arr = (this.hits.get(k) ?? []).filter((t) => now - t < rule.windowMs);
    if (arr.length >= rule.limit) {
      this.hits.set(k, arr);
      return { ok: false, retryAfterMs: Math.max(1, rule.windowMs - (now - arr[0])) };
    }
    arr.push(now);
    this.hits.set(k, arr);
    if (this.hits.size > MAX_KEYS) this.prune(now, rule.windowMs);
    return { ok: true };
  }

  /** 검사만(기록 안 함). 입장 실패 같은 "실패했을 때만 센다"에 쓴다. */
  peek(bucket: string, id: string, rule: RateRule, now: number): RateResult {
    const arr = (this.hits.get(`${bucket}:${id}`) ?? []).filter((t) => now - t < rule.windowMs);
    return arr.length >= rule.limit ? { ok: false, retryAfterMs: Math.max(1, rule.windowMs - (now - arr[0])) } : { ok: true };
  }

  record(bucket: string, id: string, rule: RateRule, now: number): void {
    const k = `${bucket}:${id}`;
    const arr = (this.hits.get(k) ?? []).filter((t) => now - t < rule.windowMs);
    arr.push(now);
    this.hits.set(k, arr);
  }

  private prune(now: number, windowMs: number): void {
    for (const [k, arr] of this.hits) {
      if (arr.length === 0 || now - arr[arr.length - 1] >= windowMs) this.hits.delete(k);
    }
    // 그래도 크면 가장 오래된 절반을 버린다(메모리 상한)
    if (this.hits.size > MAX_KEYS) {
      let i = 0;
      for (const k of this.hits.keys()) {
        this.hits.delete(k);
        if (++i > MAX_KEYS / 2) break;
      }
    }
  }

  reset(): void {
    this.hits.clear();
  }
}

const GLOBAL_KEY = Symbol.for('mc.rateLimiter');
type G = typeof globalThis & { [GLOBAL_KEY]?: RateLimiter };

/** 프로세스 안 싱글톤(dev에서 라우트마다 모듈이 따로 로드돼도 하나) */
export function sharedLimiter(): RateLimiter {
  const g = globalThis as G;
  g[GLOBAL_KEY] ??= new RateLimiter();
  return g[GLOBAL_KEY];
}
