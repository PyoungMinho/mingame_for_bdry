/**
 * token.ts — 속성 기반(fast-check) (설계서 §2-3).
 *
 * 라운드트립·서명 위조 불가·교차 meetup 거부·해시 결정성을 사실상 전수에 가깝게.
 * 시드 고정하지 않음(설계서 §5) — 실패 시 vitest 로그의 seed/counterexample로 재현.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { issueToken, verifyToken, hashToken, extractBearer } from "@/lib/moira/token";

const subArb = fc.constantFrom("host" as const, "invite" as const, "voter" as const);
// meetupId: 1~64자 임의 유니코드(공백·이모지 포함 가능). 점(.) 포함도 허용 — mid는 payload 안이라 안전.
const midArb = fc.string({ minLength: 1, maxLength: 64 });

describe("token.property — 라운드트립/위조/교차 (§2-3)", () => {
  it("TKP-01: ∀ sub, mid : issue→verify 항상 ok 且 sub/mid 일치", () => {
    fc.assert(
      fc.property(subArb, midArb, (sub, mid) => {
        const t = issueToken(sub, mid);
        const r = verifyToken(t, { meetupId: mid });
        return r.ok === true && r.payload.sub === sub && r.payload.mid === mid;
      })
    );
  });

  it("TKP-02: ∀ raw, ∀ 변조 sig 인덱스 i : ok:true 절대 없음", () => {
    fc.assert(
      fc.property(
        subArb,
        midArb,
        fc.nat(),
        fc.integer({ min: 1, max: 61 }),
        (sub, mid, idxSeed, shift) => {
          const raw = issueToken(sub, mid);
          const dot = raw.indexOf(".");
          const enc = raw.slice(0, dot);
          const sig = raw.slice(dot + 1);
          if (sig.length === 0) return true;
          const i = idxSeed % sig.length;
          const orig = sig[i];
          // base64url 알파벳에서 다른 문자로 치환
          const alphabet =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
          let replacement = alphabet[(alphabet.indexOf(orig) + shift) % alphabet.length];
          if (replacement === orig) {
            replacement = alphabet[(alphabet.indexOf(orig) + 1) % alphabet.length];
          }
          const tamperedSig = sig.slice(0, i) + replacement + sig.slice(i + 1);
          if (tamperedSig === sig) return true; // 변조 실패 케이스는 스킵
          const tampered = `${enc}.${tamperedSig}`;
          const r = verifyToken(tampered, { meetupId: mid });
          // 변조된 토큰은 절대 통과하면 안 됨 (signature 또는 malformed)
          return r.ok === false && (r.reason === "signature" || r.reason === "malformed");
        }
      )
    );
  });

  it("TKP-03: ∀ mid1≠mid2 : 교차 meetup → wrong_meetup", () => {
    fc.assert(
      fc.property(subArb, midArb, midArb, (sub, mid1, mid2) => {
        fc.pre(mid1 !== mid2);
        const t = issueToken(sub, mid1);
        const r = verifyToken(t, { meetupId: mid2 });
        return r.ok === false && r.reason === "wrong_meetup";
      })
    );
  });

  it("TKP-04: ∀ s : hashToken 길이 64·hex·결정적", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const h1 = hashToken(s);
        const h2 = hashToken(s);
        return h1 === h2 && h1.length === 64 && /^[0-9a-f]{64}$/.test(h1);
      })
    );
  });

  it("TKP-05: ∀ a≠b (표본) : hashToken 충돌 없음", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        fc.pre(a !== b);
        return hashToken(a) !== hashToken(b);
      })
    );
  });

  it("TKP-06: ∀ token(점 포함) : extractBearer('Bearer '+token) === token.trim() (비지 않으면)", () => {
    fc.assert(
      fc.property(fc.string(), (token) => {
        const trimmed = token.trim();
        const out = extractBearer(`Bearer ${token}`);
        if (trimmed === "") return out === null;
        return out === trimmed;
      })
    );
  });
});
