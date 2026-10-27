// src/lib/cloudcheck/parse/display.test.ts — 입력 인식(V2)과 리포트(V3)의 정리기가 하나다(STEP 5 CC-QA-09). 이 파일에는 유니코드 이스케이프를 쓰지 않는다.
import { describe, expect, it } from "vitest";
import { INVISIBLE_RANGES, BIDI_RANGES } from "../contract/clean-text";
import { createDisplay, sanitize } from "../engine/display";
import { plain, sensitive } from "./display";
import { awsFile, rec } from "./testdata";

const ch = (cp: number): string => String.fromCodePoint(cp);
const HI = String.fromCharCode(0xd83d);

describe("V2(parse/display) = V3(engine/display) — 같은 문자를 같은 방식으로 치환한다", () => {
  const cps: number[] = [];
  for (const [lo, hi] of [...INVISIBLE_RANGES, ...BIDI_RANGES]) for (let cp = lo; cp <= Math.min(hi, lo + 600); cp++) cps.push(cp);   // 큰 구간(E0000~)은 앞 600개로 충분하다
  it("치환 대상 구간 표본(수백 개): 두 층의 full · 플래그가 똑같다", () => {
    const d = createDisplay();
    const diff = cps.filter((cp) => {
      const v2 = sensitive("userName", `ad${ch(cp)}min`);
      const v3 = d.sens({ type: "userName", value: `ad${ch(cp)}min` });
      return v2.kind !== "sensitive" || v3.kind !== "sensitive" || v2.full !== v3.full || JSON.stringify(v2.flags) !== JSON.stringify(v3.flags) || v2.flags.length === 0;
    });
    expect(cps.length).toBeGreaterThan(500);
    expect(diff.map((cp) => cp.toString(16))).toEqual([]);
  });
  it("대표 문자: 한글 채움(U+3164) · 소프트 하이픈 · 몽골 모음 구분자 · 단어 결합자 · 태그 문자 · 이형 선택자", () => {
    for (const cp of [0x3164, 0xad, 0x180e, 0x2061, 0xe0041, 0xfe0f, 0x115f, 0xffa0]) {
      const v = sensitive("userName", `admin${ch(cp)}`);
      expect(v, cp.toString(16)).toMatchObject({ kind: "sensitive", full: "admin�", flags: ["control-chars-replaced"] });
      expect(sanitize(`admin${ch(cp)}`), cp.toString(16)).toEqual({ text: "admin�", flags: ["control-chars-replaced"] });
    }
  });
  it("길이 상한 · 플래그 순서도 같다", () => {
    const raw = `${ch(0)}${ch(0x202e)}${"x".repeat(300)}`;
    const v2 = sensitive("freeText", raw);
    const v3 = createDisplay().sens({ type: "freeText", value: raw });
    expect(v2.kind === "sensitive" && v3.kind === "sensitive" && v2.full === v3.full && JSON.stringify(v2.flags) === JSON.stringify(v3.flags)).toBe(true);
  });
});

describe("짝 없는 서로게이트 — V2도 V3처럼 값을 싣지 않는다", () => {
  it("sensitive · plain 모두 redacted(invalid-encoding)", () => {
    expect(sensitive("alias", `acme${HI}prod`)).toEqual({ kind: "redacted", why: "invalid-encoding" });
    expect(plain(`acme${HI}prod`)).toEqual({ kind: "redacted", why: "invalid-encoding" });
    expect(createDisplay().sens({ type: "alias", value: `acme${HI}prod` })).toEqual({ kind: "redacted", why: "invalid-encoding" });
  });
  it("짝이 맞는 이모지는 그대로", () => {
    expect(sensitive("alias", "acme🪣")).toMatchObject({ kind: "sensitive", full: "acme🪣", flags: [] });
  });
  it("입력 인식: 별칭에 짝 없는 서로게이트가 있으면 미리보기가 redacted(invalid-encoding)", () => {
    const f = awsFile({ mutate: (x) => { x.identity.alias.value = `acme${HI}prod`; } }).file;
    const r = rec(f);
    expect(r.status).toBe("ok");
    expect(r.identityPreview?.alias).toEqual({ kind: "redacted", why: "invalid-encoding" });
  });
});
