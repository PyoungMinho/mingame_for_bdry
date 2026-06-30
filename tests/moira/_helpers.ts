/**
 * 모이라 테스트 공용 헬퍼 — 설계서 §1-3 / §6 규약 구현.
 *
 * - env 격리: set/restore (다른 테스트 오염 금지). `tests/exam/_helpers.ts`의 withExamKey 패턴 모방.
 * - 모드 토글: ODSAY_API_KEY + KAKAO_REST_KEY 동시 set → live, 둘 다 삭제 → demo.
 * - 라우트 호출: postReq / getReq (exam/route.test.ts 패턴 그대로).
 * - valid body 팩토리.
 *
 * 주의: tests/setup.ts가 매 테스트마다 일부 env를 세팅하지만 *모이라* 키
 * (ODSAY/KAKAO/MOIRA_*)는 건드리지 않으므로 충돌 없음.
 */
import type { NextRequest } from "next/server";

// ── env 격리 ────────────────────────────────────────────────────────────────

/**
 * 여러 env 키를 일시적으로 set(value)하거나 delete(value===undefined)한 뒤 fn 실행,
 * finally에서 원래 상태로 정확히 복원한다(존재 여부까지 보존).
 */
export async function withEnv<T>(
  vars: Record<string, string | undefined>,
  fn: () => T | Promise<T>
): Promise<T> {
  const keys = Object.keys(vars);
  const had: Record<string, boolean> = {};
  const prev: Record<string, string | undefined> = {};

  for (const k of keys) {
    had[k] = Object.prototype.hasOwnProperty.call(process.env, k);
    prev[k] = process.env[k];
    const v = vars[k];
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }

  try {
    return await fn();
  } finally {
    for (const k of keys) {
      if (had[k]) {
        process.env[k] = prev[k];
      } else {
        delete process.env[k];
      }
    }
  }
}

/** demo 모드 보장(모이라 외부 키 제거) 후 fn 실행. */
export function withDemo<T>(fn: () => T | Promise<T>): Promise<T> {
  return withEnv({ ODSAY_API_KEY: undefined, KAKAO_REST_KEY: undefined }, fn);
}

/** live 모드 보장(가짜 키 주입) 후 fn 실행. 실제 호출은 모킹/실패 가정. */
export function withLive<T>(fn: () => T | Promise<T>): Promise<T> {
  return withEnv(
    { ODSAY_API_KEY: "fake-odsay-key", KAKAO_REST_KEY: "fake-kakao-key" },
    fn
  );
}

// ── 라우트 호출 헬퍼 ──────────────────────────────────────────────────────────

/** POST /api/moira/meetups Request 생성. rawOverride로 깨진/빈 본문 주입 가능. */
export function postReq(
  body: unknown,
  rawOverride?: string,
  headers: Record<string, string> = {}
): NextRequest {
  const init: RequestInit = {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: rawOverride !== undefined ? rawOverride : JSON.stringify(body),
  };
  return new Request("http://x/api/moira/meetups", init) as unknown as NextRequest;
}

/** GET Request 생성(동적 라우트는 두 번째 인자로 params 직접 전달). */
export function getReq(
  url = "http://x/api/moira/meetups/x/result",
  headers: Record<string, string> = {}
): NextRequest {
  return new Request(url, { method: "GET", headers }) as unknown as NextRequest;
}

// ── 본문 팩토리 ──────────────────────────────────────────────────────────────

export interface CreateBody {
  hostName?: unknown;
  hostOrigin?: unknown;
  ttlHours?: unknown;
}

/** 유효한 기본 생성 본문. overrides로 일부 필드 교체. */
export function makeCreateBody(overrides: Partial<CreateBody> = {}): CreateBody {
  return {
    hostName: "민호",
    hostOrigin: "강남구 역삼동",
    ...overrides,
  };
}

/** UUID v4 정규식(8-4-4-4-12, 버전 nibble=4, variant nibble∈[89ab]). */
export const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
