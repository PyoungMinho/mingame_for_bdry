// 사용자 문자열 정리·마스킹 (R-12 · R-13). 이 파일에는 유니코드 이스케이프를 쓰지 않는다: 코드 포인트로 조립한다.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { REDACTED_PREFIX } from "../contract/normalized";
import { MAX_FULL_LENGTH, REPLACEMENT, createDisplay, hasLoneSurrogate, last4Of, sanitize } from "./display";

const ch = (...codes: number[]): string => String.fromCodePoint(...codes);
const RLO = ch(0x202e);          // 오른쪽에서 왼쪽 덮어쓰기
const ZWSP = ch(0x200b);         // 폭 없는 공백
const BOM = ch(0xfeff);
const LONE_HIGH = String.fromCharCode(0xd83d);
const NUL = ch(0);
const ESC = ch(0x1b);

describe("sanitize", () => {
  it("평범한 문자열은 그대로", () => {
    expect(sanitize("amzn-s3-demo-bucket")).toEqual({ text: "amzn-s3-demo-bucket", flags: [] });
    expect(sanitize("한글 이름 🪣").flags).toEqual([]);
  });
  it("제어 문자와 보이지 않는 서식 문자는 대체 문자로 바꾸고 표시한다", () => {
    for (const c of [NUL, ESC, ch(0x7f), ch(0x85), ZWSP, BOM, ch(0x2028)]) {
      const r = sanitize(`a${c}b`);
      expect(r.text).toBe(`a${REPLACEMENT}b`);
      expect(r.flags).toEqual(["control-chars-replaced"]);
    }
  });
  it("줄바꿈 · 탭도 제어 문자다 (한 줄 표시 보장)", () => {
    expect(sanitize("a\nb\tc").text).toBe(`a${REPLACEMENT}b${REPLACEMENT}c`);
  });
  it("양방향 제어 문자(트로이 소스)는 바꾸고 표시한다", () => {
    for (const c of [RLO, ch(0x202a), ch(0x2066), ch(0x2069), ch(0x200e), ch(0x061c)]) {
      const r = sanitize(`gpj${c}fdp.exe`);
      expect(r.text).toBe(`gpj${REPLACEMENT}fdp.exe`);
      expect(r.flags).toContain("bidi-replaced");
    }
  });
  it("256자(코드 포인트) 상한을 넘으면 자르고 표시한다. 이모지를 반으로 가르지 않는다", () => {
    const long = "가".repeat(300);
    const r = sanitize(long);
    expect(Array.from(r.text)).toHaveLength(MAX_FULL_LENGTH);
    expect(r.flags).toEqual(["truncated"]);
    const emoji = "🪣".repeat(300);
    const e = sanitize(emoji);
    expect(Array.from(e.text)).toHaveLength(MAX_FULL_LENGTH);
    expect(hasLoneSurrogate(e.text)).toBe(false);
    expect(sanitize("x".repeat(MAX_FULL_LENGTH)).flags).toEqual([]);
  });
  it("표시가 여러 개면 정해진 순서(자름 → 제어 → 양방향)로 나온다", () => {
    const r = sanitize(`${NUL}${RLO}${"x".repeat(300)}`);
    expect(r.flags).toEqual(["truncated", "control-chars-replaced", "bidi-replaced"]);
  });
  it("속성: 결과에는 제어 · 양방향 문자가 남지 않고 길이 상한을 지키며 두 번 적용해도 같다", () => {
    fc.assert(fc.property(fc.string({ unit: "binary", maxLength: 400 }), (s) => {
      if (hasLoneSurrogate(s)) return;
      const r = sanitize(s);
      expect(Array.from(r.text).length).toBeLessThanOrEqual(MAX_FULL_LENGTH);
      expect(sanitize(r.text).text).toBe(r.text);
      for (const c of Array.from(r.text)) {
        const code = c.codePointAt(0) as number;
        expect(code < 0x20 || (code >= 0x7f && code <= 0x9f) || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069)).toBe(false);
      }
    }), { numRuns: 300, seed: 20261019 });
  });
});

describe("hasLoneSurrogate", () => {
  it("짝이 없는 서로게이트만 잡는다", () => {
    expect(hasLoneSurrogate("a" + LONE_HIGH)).toBe(true);
    expect(hasLoneSurrogate(String.fromCharCode(0xdc00) + "a")).toBe(true);
    expect(hasLoneSurrogate("🪣")).toBe(false);
    expect(hasLoneSurrogate("")).toBe(false);
  });
});

describe("Display.sens (마스킹 기본안 v1)", () => {
  it("*Id 계열은 끝 4자리만 보인다", () => {
    const d = createDisplay();
    expect(d.sens({ type: "accountId", value: "111122223333" })).toEqual({ kind: "sensitive", type: "accountId", full: "111122223333", masked: "••••3333", flags: [] });
    expect(d.sens({ type: "tenantId", value: "00000000-0000-0000-0000-000000000000" })).toMatchObject({ masked: "••••0000" });
    expect(d.sens({ type: "subscriptionId", value: "ab" })).toMatchObject({ masked: "••••ab" });
  });
  it("이름 계열은 '<유형>-<3자리 순번>'이고 같은 원값은 같은 가명, 다른 원값은 다른 가명이다 (리포트 안에서 결정적)", () => {
    const d = createDisplay();
    const a = d.sens({ type: "resourceName", value: "alpha" }, "s3-bucket");
    const b = d.sens({ type: "resourceName", value: "beta" }, "s3-bucket");
    const a2 = d.sens({ type: "resourceName", value: "alpha" }, "s3-bucket");
    expect(a).toMatchObject({ masked: "bucket-001" });
    expect(b).toMatchObject({ masked: "bucket-002" });
    expect(a2).toEqual(a);
    expect(d.sens({ type: "resourceName", value: "alpha" }, "security-group")).toMatchObject({ masked: "sg-001" });
    expect(d.sens({ type: "userName", value: "alice" })).toMatchObject({ masked: "user-001" });
    expect(d.sens({ type: "upn", value: "a@example.com" })).toMatchObject({ masked: "upn-001" });
    expect(d.sens({ type: "fileName", value: "x.json" })).toMatchObject({ masked: "file-001" });
    expect(d.sens({ type: "freeText", value: "아무 말" })).toMatchObject({ masked: "•••" });
    expect(d.pseudonymCount()).toBe(6);
  });
  it("정리 후 같은 모양이 되는 서로 다른 원값은 가명이 합쳐지지 않는다", () => {
    const d = createDisplay();
    const a = d.sens({ type: "userName", value: `bob${ZWSP}` });
    const b = d.sens({ type: "userName", value: "bob" });
    expect(a).toMatchObject({ full: `bob${REPLACEMENT}`, masked: "user-001" });
    expect(b).toMatchObject({ full: "bob", masked: "user-002" });
  });
  it("전체 값(full)은 정리되어 담기고 표시 플래그가 따라온다", () => {
    const v = createDisplay().sens({ type: "fileName", value: `gpj${RLO}fdp.exe` });
    expect(v).toMatchObject({ kind: "sensitive", flags: ["bidi-replaced"] });
    expect((v as { full: string }).full).not.toContain(RLO);
  });
  it("접두 지정(prefix)이 있으면 그것을 쓴다", () => {
    expect(createDisplay().sens({ type: "resourceName", value: "x", prefix: "nsg" })).toMatchObject({ masked: "nsg-001" });
  });
  it("짝 없는 서로게이트는 값을 싣지 않는다 (redacted: invalid-encoding)", () => {
    const d = createDisplay();
    expect(d.sens({ type: "userName", value: "a" + LONE_HIGH })).toEqual({ kind: "redacted", why: "invalid-encoding" });
    expect(d.plain("a" + LONE_HIGH)).toEqual({ kind: "redacted", why: "invalid-encoding" });
  });
  it("parse가 비밀 패턴으로 지운 값(REDACTED 접두)은 정리보다 먼저 가려진다", () => {
    const d = createDisplay();
    expect(d.sens({ type: "userName", value: `${REDACTED_PREFIX}abc` })).toEqual({ kind: "redacted", why: "secret-pattern" });
    expect(d.plain(`${REDACTED_PREFIX}abc`)).toEqual({ kind: "redacted", why: "secret-pattern" });
    expect(d.constant(`${REDACTED_PREFIX}abc`)).toBe("•••");
  });
});

describe("Display.plain · constant", () => {
  it("비식별 상수는 정리만 한다", () => {
    const d = createDisplay();
    expect(d.plain("ap-northeast-2")).toEqual({ kind: "plain", text: "ap-northeast-2" });
    expect(d.plain(`a${NUL}b`)).toEqual({ kind: "plain", text: `a${REPLACEMENT}b` });
    expect(d.constant("0.0.0.0/0")).toBe("0.0.0.0/0");
    expect(d.constant("a" + LONE_HIGH + "b")).toBe(`a${REPLACEMENT}b`);
    expect(d.constant(`x${RLO}y`)).toBe(`x${REPLACEMENT}y`);
  });
});

describe("last4Of", () => {
  it("끝 4자리 (코드 포인트 기준), 짧으면 그대로", () => {
    expect(last4Of("111122223333")).toBe("3333");
    expect(last4Of("ab")).toBe("ab");
    expect(last4Of("가나다라마")).toBe("나다라마");
  });
});
