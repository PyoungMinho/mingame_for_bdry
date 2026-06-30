/**
 * Moira 무가입 토큰 유틸 — HMAC-SHA256 서명, Node.js crypto 전용
 *
 * 종류: "host" | "invite" | "voter"
 * 구조: <base64url(payload)>.<base64url(sig)>
 *
 * JWT 라이브러리 의존성 없음. MOIRA_TOKEN_SECRET 환경변수 필요.
 * 비밀키 없으면 demo 모드용 dev secret 사용 (프로덕션 경고 출력).
 */

import { createHmac, createHash, timingSafeEqual, randomUUID } from "crypto";

export type TokenSub = "host" | "invite" | "voter";

export interface TokenPayload {
  sub: TokenSub;
  mid: string;  // meetupId
  uid: string;  // uuid v4, 128비트 엔트로피
  iat: number;  // 발급 Unix timestamp (초)
  exp: number;  // 만료 Unix timestamp (초)
}

// 프로덕션에서 환경변수 미설정 시 경고
const SECRET = (() => {
  const s = process.env.MOIRA_TOKEN_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      console.error("[moira/token] MOIRA_TOKEN_SECRET is not set — this is a security risk!");
    }
    return "moira-dev-secret-do-not-use-in-production";
  }
  return s;
})();

// TTL 기본값 (초)
const TTL: Record<TokenSub, number> = {
  host:   72 * 3600,
  invite: 48 * 3600,
  voter:  72 * 3600,
};

function base64urlEncode(buf: Buffer | string): string {
  const b64 = (typeof buf === "string" ? Buffer.from(buf) : buf).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64urlDecode(s: string): Buffer {
  // 패딩 복원
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + "=".repeat(pad), "base64");
}

function sign(payloadEncoded: string): string {
  return base64urlEncode(
    createHmac("sha256", SECRET).update(payloadEncoded).digest()
  );
}

/** 토큰 발급 */
export function issueToken(
  sub: TokenSub,
  meetupId: string,
  now = Math.floor(Date.now() / 1000)
): string {
  const payload: TokenPayload = {
    sub,
    mid: meetupId,
    uid: randomUUID(),
    iat: now,
    exp: now + TTL[sub],
  };
  const encoded = base64urlEncode(JSON.stringify(payload));
  const sig = sign(encoded);
  return `${encoded}.${sig}`;
}

export type VerifyResult =
  | { ok: true; payload: TokenPayload }
  | { ok: false; reason: "malformed" | "signature" | "expired" | "wrong_meetup" | "wrong_sub" };

/** 토큰 검증 */
export function verifyToken(
  token: string,
  opts: { meetupId: string; requireSub?: TokenSub }
): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, reason: "malformed" };
  }
  const [encoded, providedSig] = parts as [string, string];

  // 서명 검증 (timing-safe)
  const expectedSig = sign(encoded);
  try {
    const a = Buffer.from(providedSig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "signature" };
    }
  } catch {
    return { ok: false, reason: "signature" };
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(base64urlDecode(encoded).toString("utf8")) as TokenPayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  // 만료 확인
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) return { ok: false, reason: "expired" };

  // meetupId 불일치 → 타 약속 토큰 재사용 차단
  if (payload.mid !== opts.meetupId) return { ok: false, reason: "wrong_meetup" };

  // sub 타입 확인
  if (opts.requireSub && payload.sub !== opts.requireSub) {
    return { ok: false, reason: "wrong_sub" };
  }

  return { ok: true, payload };
}

/** Bearer 헤더에서 토큰 추출 */
export function extractBearer(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

/**
 * DB 조회용 토큰 해시 — SHA-256(raw_token) hex 64자.
 *
 * API↔DB 정합성 표준(백엔드팀장 확정):
 *   1) verifyToken() 으로 서명·만료·meetup 일치를 먼저 검증한다(앱 레벨 인증).
 *   2) 통과한 *원문 토큰 문자열 전체*를 이 함수로 해시해 DB의
 *      host_token_hash / invite_token_hash / voter_token_hash 컬럼과 대조한다(행 식별·1인1표).
 *
 * 반드시 Postgres `moira_hash_token(raw)` (= encode(digest(raw,'sha256'),'hex')) 와
 * 동일한 입력(=원문 토큰 전체 문자열)·동일한 알고리즘을 사용해야 한다.
 * payload.uid 가 아니라 *토큰 원문 전체* 를 해시한다.
 */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
