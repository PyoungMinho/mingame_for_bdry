// src/lib/cloudcheck/contract/clean-text.test.ts — 사용자 문자열 정리의 정본(STEP 5 CC-QA-09). 이 파일에는 유니코드 이스케이프를 쓰지 않는다: 코드 포인트로 조립한다.
import { describe, expect, it } from "vitest";
import { BIDI_RANGES, INVISIBLE_RANGES, MAX_FULL_LENGTH, REPLACEMENT, cleanText, hasLoneSurrogate, isBidiCodePoint, isInvisibleCodePoint, stripLoneSurrogates } from "./clean-text";

const ch = (...cps: number[]): string => String.fromCodePoint(...cps);
const DI = /\p{Default_Ignorable_Code_Point}/u;
const CF = /\p{Cf}/u;
const isSurrogate = (cp: number): boolean => cp >= 0xd800 && cp <= 0xdfff;

describe("치환 대상 — 전수(U+0000~U+10FFFF, 서로게이트 제외)", () => {
  const all: number[] = [];
  const required: number[] = [];
  for (let cp = 0; cp <= 0x10ffff; cp++) {
    if (isSurrogate(cp)) continue;
    const c = ch(cp);
    const must = cp < 0x20 || (cp >= 0x7f && cp <= 0x9f) || cp === 0x2028 || cp === 0x2029 || DI.test(c) || CF.test(c);
    if (must) required.push(cp);
    if (isInvisibleCodePoint(cp) || isBidiCodePoint(cp)) all.push(cp);
  }
  it("Default_Ignorable_Code_Point · Cf · C0 · C1 · 줄/문단 구분은 하나도 빠짐없이 치환한다", () => {
    expect(required.length).toBeGreaterThan(4000);
    expect(required.filter((cp) => !(isInvisibleCodePoint(cp) || isBidiCodePoint(cp))).map((cp) => cp.toString(16))).toEqual([]);
  });
  it("치환하는 모든 문자에 대해 cleanText가 U+FFFD로 바꾸고 플래그를 남긴다", () => {
    const bad = all.filter((cp) => { const r = cleanText(`a${ch(cp)}b`); return r.text !== `a${REPLACEMENT}b` || r.flags.length !== 1; });
    expect(bad.map((cp) => cp.toString(16))).toEqual([]);
  });
  it("지나치게 치환하지 않는다: 위 대상 밖에서 더 바꾸는 문자는 미배정 예약 구간뿐(200개 미만)", () => {
    const extra = all.filter((cp) => !required.includes(cp));
    expect(extra.length).toBeLessThan(200);
    for (const cp of extra) expect(cp === 0x2065 || (cp >= 0xfff0 && cp <= 0xfff8) || (cp >= 0xe0000 && cp <= 0xe0fff) || (cp >= 0x13430 && cp <= 0x1343f), cp.toString(16)).toBe(true);
  });
  it("글자는 그대로: 한글 · 한자 · 라틴 · 숫자 · 이모지 · 치환 문자(U+FFFD) · 일반 공백", () => {
    for (const s of ["김철수", "管理者", "admin-01", "a b", "🪣🔑", REPLACEMENT, ch(0xa0), ch(0x3000), ch(0x1f469, 0x1f3fd)]) expect(cleanText(s), s).toEqual({ text: s, flags: [] });
  });
  it("위쪽 경계: 바로 옆 코드 포인트는 건드리지 않는다", () => {
    for (const cp of [0x20, 0x7e, 0xa0, 0xa1, 0xac, 0xae, 0x34e, 0x350, 0x1160 + 1, 0x3163, 0x3165, 0xff9f, 0xffa1, 0xfffc, 0xfffd, 0xfffe, 0xe1000, 0x1d172, 0x1d17b]) expect(cleanText(`a${ch(cp)}b`).flags, cp.toString(16)).toEqual([]);
  });
});

describe("플래그 — 양방향은 bidi-replaced, 나머지는 control-chars-replaced", () => {
  it("종류별 플래그", () => {
    expect(cleanText(`a${ch(0x202e)}b`).flags).toEqual(["bidi-replaced"]);
    expect(cleanText(`a${ch(0x3164)}b`).flags).toEqual(["control-chars-replaced"]);
    expect(cleanText(`a${ch(0xe0041)}b`).flags).toEqual(["control-chars-replaced"]);
    expect(cleanText(`a${ch(0x00ad)}b`).flags).toEqual(["control-chars-replaced"]);
    expect(cleanText(`a${ch(0x200b)}${ch(0x202a)}b`).flags).toEqual(["control-chars-replaced", "bidi-replaced"]);
  });
  it("정해진 순서(자름 → 제어 → 양방향)이고 표시되는 글자만 본다: 잘려 나간 뒤쪽의 문자는 플래그를 켜지 않는다", () => {
    expect(cleanText(`${ch(0)}${ch(0x202e)}${"x".repeat(300)}`).flags).toEqual(["truncated", "control-chars-replaced", "bidi-replaced"]);
    const tail = cleanText(`${"x".repeat(MAX_FULL_LENGTH)}${ch(0x202e)}`);
    expect(tail.flags).toEqual(["truncated"]);
    expect(tail.text).toBe("x".repeat(MAX_FULL_LENGTH));
  });
  it("정확히 상한 길이면 자르지 않는다 · 이모지를 반으로 가르지 않는다", () => {
    expect(cleanText("x".repeat(MAX_FULL_LENGTH)).flags).toEqual([]);
    const e = cleanText("🪣".repeat(300));
    expect(Array.from(e.text)).toHaveLength(MAX_FULL_LENGTH);
    expect(hasLoneSurrogate(e.text)).toBe(false);
  });
  it("max 인자: 더 짧게 자를 수 있다", () => {
    expect(cleanText("abcdef", 3)).toEqual({ text: "abc", flags: ["truncated"] });
  });
});

describe("성질", () => {
  it("두 번 적용해도 같고, 결과에는 치환 대상이 남지 않는다", () => {
    const samples = [`a${ch(0x3164)}b${ch(0x202e)}c${ch(0xe0041)}${ch(0xfe0f)}d`, "plain", `${ch(1)}${ch(0x7f)}${ch(0x85)}`, "x".repeat(400), `${ch(0xad)}${"가".repeat(300)}`];
    for (const s of samples) {
      const once = cleanText(s);
      expect(cleanText(once.text).text).toBe(once.text);
      for (const c of Array.from(once.text)) expect(isInvisibleCodePoint(c.codePointAt(0) as number) || isBidiCodePoint(c.codePointAt(0) as number)).toBe(false);
    }
  });
  it("구간 표는 오름차순·겹침 없음", () => {
    for (const table of [BIDI_RANGES, INVISIBLE_RANGES]) {
      table.forEach(([lo, hi], i) => { expect(lo).toBeLessThanOrEqual(hi); if (i > 0) expect(lo).toBeGreaterThan(table[i - 1][1]); });
    }
  });
});

describe("짝 없는 서로게이트", () => {
  const HI = String.fromCharCode(0xd83d), LO = String.fromCharCode(0xdc00);
  it("hasLoneSurrogate: 짝이 없는 것만 잡는다", () => {
    expect(hasLoneSurrogate(`a${HI}`)).toBe(true);
    expect(hasLoneSurrogate(`${LO}a`)).toBe(true);
    expect(hasLoneSurrogate(`${HI}${HI}`)).toBe(true);
    expect(hasLoneSurrogate("🪣")).toBe(false);
    expect(hasLoneSurrogate("")).toBe(false);
  });
  it("stripLoneSurrogates: 짝 없는 것만 U+FFFD로, 짝이 맞는 이모지는 그대로", () => {
    expect(stripLoneSurrogates(`a${HI}b🪣${LO}`)).toBe(`a${REPLACEMENT}b🪣${REPLACEMENT}`);
  });
});
