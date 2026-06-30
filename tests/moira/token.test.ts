/**
 * token.ts — 발급·검증·해시·Bearer 추출 (설계서 §2-1, §2-2).
 *
 * P0 보안 핵심. 서명 위조·만료·교차사용·malformed·timing-safe·hashToken 결정성+SHA-256 벡터.
 * 시간 결정성: issueToken(sub, mid, now)의 now를 명시 주입 + vi.setSystemTime으로 만료 유도.
 * 모듈 상단 SECRET이 env 로드시 1회 평가되므로 SECRET 의존 테스트는 별도 분리하지 않고
 * 기본 dev-secret(테스트 env엔 MOIRA_TOKEN_SECRET 미설정) 기준으로 검증한다.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  issueToken,
  verifyToken,
  hashToken,
  extractBearer,
} from "@/lib/moira/token";
import { UUID_V4_RE } from "./_helpers";

afterEach(() => {
  vi.useRealTimers();
});

// base64url helpers (테스트 측 — 라우트 코드와 독립 구현, 변조 토큰 합성용)
function b64urlEncode(s: string): string {
  return Buffer.from(s)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// ---------------------------------------------------------------------------
// §2-1 발급·검증
// ---------------------------------------------------------------------------
describe("token — issueToken / verifyToken (§2-1)", () => {
  it("TK-01: host 라운드트립 → ok, sub/mid 보존, uid=UUIDv4, exp-iat=72h", () => {
    const t = issueToken("host", "m1");
    const r = verifyToken(t, { meetupId: "m1" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.sub).toBe("host");
    expect(r.payload.mid).toBe("m1");
    expect(r.payload.uid).toMatch(UUID_V4_RE);
    expect(r.payload.exp - r.payload.iat).toBe(72 * 3600);
  });

  it("TK-02: invite 라운드트립 + requireSub 일치 → ok, sub=invite, exp-iat=48h", () => {
    const t = issueToken("invite", "m1");
    const r = verifyToken(t, { meetupId: "m1", requireSub: "invite" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.sub).toBe("invite");
    expect(r.payload.exp - r.payload.iat).toBe(48 * 3600);
  });

  it("TK-03: voter TTL = 72h", () => {
    const t = issueToken("voter", "m1");
    const r = verifyToken(t, { meetupId: "m1" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.exp - r.payload.iat).toBe(72 * 3600);
  });

  it("TK-04: 서명 sig 1글자 변조 → ok:false, reason=signature", () => {
    const t = issueToken("host", "m1");
    const [enc, sig] = t.split(".");
    // sig 마지막 글자를 다른 문자로 (base64url 안전 문자로 치환)
    const last = sig.slice(-1);
    const repl = last === "A" ? "B" : "A";
    const tampered = `${enc}.${sig.slice(0, -1)}${repl}`;
    const r = verifyToken(tampered, { meetupId: "m1" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("signature");
  });

  it("TK-05: payload 파트 교체(sig 그대로) → 재서명 불일치 → signature", () => {
    const t = issueToken("host", "m1");
    const [, sig] = t.split(".");
    // 다른 payload(공격자가 sub를 host로 위조 시도)를 같은 sig로 붙임
    const forgedPayload = b64urlEncode(
      JSON.stringify({ sub: "host", mid: "m1", uid: "x", iat: 0, exp: 9_999_999_999 })
    );
    const tampered = `${forgedPayload}.${sig}`;
    const r = verifyToken(tampered, { meetupId: "m1" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("signature");
  });

  it("TK-06: 만료 거부 — now=0 발급 후 시스템시간 (72h+10s)", () => {
    const t = issueToken("host", "m1", 0); // exp = 0 + 259200
    vi.setSystemTime(new Date((259200 + 10) * 1000));
    const r = verifyToken(t, { meetupId: "m1" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("expired");
  });

  it("TK-07: 만료 경계(미만료) — now=0 발급, 시스템시간 (iat+10)s → ok", () => {
    const t = issueToken("host", "m1", 0);
    vi.setSystemTime(new Date(10 * 1000)); // exp(259200) 한참 미래
    const r = verifyToken(t, { meetupId: "m1" });
    expect(r.ok).toBe(true);
  });

  it("TK-08: exp===now 경계 → ok (코드상 exp<now 일 때만 만료)", () => {
    const T = 1_000_000;
    const t = issueToken("host", "m1", T); // exp = T + 259200
    vi.setSystemTime(new Date((T + 259200) * 1000)); // 정각 = exp
    const r = verifyToken(t, { meetupId: "m1" });
    expect(r.ok).toBe(true); // exp < now 가 false → 통과
  });

  it("TK-09: 타 meetup 거부 → reason=wrong_meetup", () => {
    const t = issueToken("host", "m1");
    const r = verifyToken(t, { meetupId: "m2" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("wrong_meetup");
  });

  it("TK-10: requireSub 불일치 → reason=wrong_sub", () => {
    const t = issueToken("voter", "m1");
    const r = verifyToken(t, { meetupId: "m1", requireSub: "host" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("wrong_sub");
  });

  it("TK-11: requireSub 생략 → sub 무관 통과", () => {
    const t = issueToken("voter", "m1");
    const r = verifyToken(t, { meetupId: "m1" });
    expect(r.ok).toBe(true);
  });

  it("TK-12: malformed — 점 없음", () => {
    const r = verifyToken("noDotToken", { meetupId: "m1" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("malformed");
  });

  it("TK-13: malformed — 점 3개(parts.length!==2)", () => {
    const r = verifyToken("a.b.c", { meetupId: "m1" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("malformed");
  });

  it("TK-14: malformed — 빈 파트1 (.sig)", () => {
    const r = verifyToken(".sig", { meetupId: "m1" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("malformed");
  });

  it("TK-15: malformed — 빈 파트2 (payload.)", () => {
    const r = verifyToken("payload.", { meetupId: "m1" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("malformed");
  });

  it("TK-16: malformed — 빈 문자열", () => {
    const r = verifyToken("", { meetupId: "m1" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("malformed");
  });

  it("TK-17: 검증순서 — 만료+서명변조 동시면 signature가 먼저 (INV-4)", () => {
    const t = issueToken("host", "m1", 0); // 만료될 토큰
    vi.setSystemTime(new Date((259200 + 10) * 1000)); // 만료 시점
    const [enc, sig] = t.split(".");
    const last = sig.slice(-1);
    const repl = last === "A" ? "B" : "A";
    const tampered = `${enc}.${sig.slice(0, -1)}${repl}`;
    const r = verifyToken(tampered, { meetupId: "m1" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // 서명이 만료보다 먼저 평가 → DB/파서 보호
    expect(r.reason).toBe("signature");
  });

  it("TK-18: 서명 유효하나 payload가 비-JSON → malformed (JSON.parse catch)", () => {
    // 라우트의 sign()을 쓸 수 없으므로, 'not json'을 payload로 issueToken 우회 합성 불가.
    // 대신 정상 토큰의 payload를 'not json'의 base64url로 바꾸면 서명 불일치(signature)가 된다.
    // 진짜 'malformed(JSON.parse 실패)'를 보려면 서명이 유효해야 하므로,
    // 동일 SECRET으로 비-JSON payload를 직접 서명한다(crypto 직접 사용).
    const { createHmac } = require("crypto") as typeof import("crypto");
    const SECRET = "moira-dev-secret-do-not-use-in-production"; // 테스트 env엔 키 미설정 → dev secret
    const badPayload = b64urlEncode("not json at all");
    const sig = createHmac("sha256", SECRET)
      .update(badPayload)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
    const token = `${badPayload}.${sig}`;
    const r = verifyToken(token, { meetupId: "m1" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("malformed"); // 서명 통과 후 JSON.parse catch
  });

  it("TK-19: timing-safe — sig 길이 불일치(짧게/길게)도 throw 없이 signature", () => {
    const t = issueToken("host", "m1");
    const [enc, sig] = t.split(".");
    const shortSig = `${enc}.${sig.slice(0, 4)}`;
    const longSig = `${enc}.${sig}EXTRA`;
    const r1 = verifyToken(shortSig, { meetupId: "m1" });
    const r2 = verifyToken(longSig, { meetupId: "m1" });
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    if (!r1.ok) expect(r1.reason).toBe("signature");
    if (!r2.ok) expect(r2.reason).toBe("signature");
  });

  it("TK-20: 비ASCII meetupId 라운드트립(UTF-8 복원)", () => {
    const mid = "한글-약속-😀";
    const t = issueToken("host", mid);
    const r = verifyToken(t, { meetupId: mid });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.mid).toBe(mid);
  });
});

// ---------------------------------------------------------------------------
// §2-2 hashToken / extractBearer
// ---------------------------------------------------------------------------
describe("token — hashToken (§2-2, INV-8)", () => {
  it("TK-30: 결정성 — 동일 입력 동일 출력, 길이 64, hex만", () => {
    const a = hashToken("some-token-string");
    const b = hashToken("some-token-string");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('TK-31: SHA-256 벡터 — hashToken("")', () => {
    expect(hashToken("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  it('TK-32: SHA-256 벡터 — hashToken("abc")', () => {
    expect(hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("TK-33: raw 토큰 전체 해시(uid 아님) — raw 해시 ≠ uid 해시", () => {
    const raw = issueToken("host", "m1");
    const r = verifyToken(raw, { meetupId: "m1" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const rawHash = hashToken(raw);
    const uidHash = hashToken(r.payload.uid);
    expect(rawHash).not.toBe(uidHash);
    expect(rawHash).toMatch(/^[0-9a-f]{64}$/);
    // 정본 계약: 원문 토큰 전체를 해시한 것이 DB 대조 기준
    expect(rawHash).toBe(hashToken(raw));
  });

  it("TK-34: 서로 다른 토큰(uid 랜덤) → 해시 충돌 없음", () => {
    const a = hashToken(issueToken("host", "m1"));
    const b = hashToken(issueToken("host", "m1"));
    expect(a).not.toBe(b);
  });
});

describe("token — extractBearer (§2-2)", () => {
  it("TK-35: 정상 — 'Bearer abc.def' → 'abc.def'", () => {
    expect(extractBearer("Bearer abc.def")).toBe("abc.def");
  });

  it("TK-36: null 입력 → null", () => {
    expect(extractBearer(null)).toBeNull();
  });

  it("TK-37: 접두 대소문자 구분 — 'bearer abc' / 'Token abc' → null", () => {
    expect(extractBearer("bearer abc")).toBeNull();
    expect(extractBearer("Token abc")).toBeNull();
  });

  it("TK-38: 공백만 — 'Bearer    ' → null", () => {
    expect(extractBearer("Bearer    ")).toBeNull();
  });

  it("TK-39: 앞뒤 공백 trim — 'Bearer  abc.def  ' → 'abc.def'", () => {
    expect(extractBearer("Bearer  abc.def  ")).toBe("abc.def");
  });

  it("TK-40: 접두만 — 'Bearer ' → null", () => {
    expect(extractBearer("Bearer ")).toBeNull();
  });
});
