// QA IN-02 — 보이지 않는 문자 (설계서 §4-4, CR-08)
// 기대: V2(입력 인식, parse/display.sensitive)와 V3(리포트, engine/display createDisplay().sens)가 같은 문자를 치환(U+FFFD)·플래그하고,
//       리포트 대상 이름에 그런 문자가 있으면 '특이 문자'(unusual-characters) 라벨이 붙는다.
// 대상 문자: \p{Default_Ignorable_Code_Point} 전부(양방향 제어 · 태그 문자 U+E0000~E007F · 이형 선택자 포함) + C0 · C1 제어 문자.
// CC-QA-09(수정·검증됨 2026-10-20): 수정 전에는 두 정리기의 문자 집합이 달랐다(리포트 쪽이 U+3164·U+00AD·U+180E·U+2061 등을 통과) + 둘 다 태그 문자·이형 선택자를 놓쳤다.
// 지금은 모두 회귀 시험이다.
import { describe, expect, it } from "vitest";
import { createDisplay } from "../engine/display";
import type { DisplayValue } from "../model/report";
import { sensitive } from "../parse/display";
import { companyJson, nameText, okReport, ruleOf, runJson } from "./kit";
import type { Json } from "./kit";

const DI = /\p{Default_Ignorable_Code_Point}/u;
const ALL: number[] = [];
for (let cp = 0; cp <= 0x10ffff; cp++) {
  if (cp >= 0xd800 && cp <= 0xdfff) continue;
  const ch = String.fromCodePoint(cp);
  if (DI.test(ch) || cp < 0x20 || (cp >= 0x7f && cp <= 0x9f)) ALL.push(cp);
}
const hex = (cp: number): string => `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
/** 정리 결과가 원래 문자를 지웠는가(치환됨) + 플래그가 있는가 */
const handled = (v: DisplayValue, cp: number): boolean => v.kind === "sensitive" && !v.full.includes(String.fromCodePoint(cp)) && v.flags.length > 0;
const v2 = (cp: number): boolean => handled(sensitive("userName", `ad${String.fromCodePoint(cp)}min`), cp);
const v3 = (cp: number): boolean => handled(createDisplay().sens({ type: "userName", value: `ad${String.fromCodePoint(cp)}min` }), cp);

const BOTH = ALL.filter((cp) => v2(cp) && v3(cp));
const V2_ONLY = ALL.filter((cp) => v2(cp) && !v3(cp));
const V3_ONLY = ALL.filter((cp) => !v2(cp) && v3(cp));
const NEITHER = ALL.filter((cp) => !v2(cp) && !v3(cp));

describe("IN-02 보이지 않는 문자 — 정리기 V2(입력 인식) ↔ V3(리포트)", () => {
  it("대상 문자 수(Default_Ignorable + C0·C1)가 충분하다", () => {
    expect(ALL.length).toBeGreaterThan(4000);
    expect(BOTH.length + V2_ONLY.length + V3_ONLY.length + NEITHER.length).toBe(ALL.length);
  });
  it("C0 · C1 제어 문자, 양방향 제어(U+061C·U+200E·U+200F·U+202A~202E·U+2066~2069), 폭 없는 공백(U+200B~200D), BOM은 V2 · V3 모두 치환·플래그", () => {
    const must = [...Array.from({ length: 0x20 }, (_, i) => i), ...Array.from({ length: 0x21 }, (_, i) => 0x7f + i), 0x061c, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0xfeff];
    expect(must.filter((cp) => !(v2(cp) && v3(cp))).map(hex)).toEqual([]);
  });
  it("[CC-QA-09] 두 정리기는 같은 문자를 치환한다 — V2만 치환하는 문자(U+00AD·U+115F·U+1160·U+180E·U+2061~2064·U+3164·U+FFA0)가 없어야 한다", () => {
    expect(V2_ONLY.map(hex)).toEqual([]);
  });
  it("V3만 치환하는 문자는 없다", () => {
    expect(V3_ONLY.map(hex)).toEqual([]);
  });
  it("[CC-QA-09] 태그 문자(U+E0000~E007F)·이형 선택자(U+FE00~FE0F·U+E0100~)·그 밖의 Default_Ignorable도 V2 · V3 모두 치환·플래그해야 한다", () => {
    expect(NEITHER.length).toBe(0);
  });
  it("기록: 둘 다 놓치는 문자 0개(수정 전 4,147개 — U+034F · U+17B4~17B5 · U+180B~180F · U+FE00~FE0F · U+E0000~E0FFF 등)", () => {
    // 수정 전에는 연속 구간으로 묶어 버그 리포트에 적었다. 지금은 V2 · V3가 같은 정리기(contract/clean-text)를 쓰므로 빈 목록이어야 한다
    const ranges: string[] = [];
    for (let i = 0; i < NEITHER.length; i++) {
      const s = NEITHER[i];
      let e = s;
      while (i + 1 < NEITHER.length && NEITHER[i + 1] === e + 1) e = NEITHER[++i];
      ranges.push(s === e ? hex(s) : `${hex(s)}~${hex(e)}`);
    }
    expect(ranges).toEqual([]);
  });
});

describe("IN-02 리포트 대상 이름(실엔진, E-22)", () => {
  const withUser = (suffix: string): ReturnType<typeof okReport> => {
    const f = companyJson("aws", "C");
    const u = (f.data.iamUsers.items as Json[]).find((x) => x.userName === "admin-lee");
    u.userName = `admin${suffix}`;
    // 보고서 CSV 안의 같은 사용자 이름도 바꾼다(조인 유지)
    f.data.credentialReport.value.csv = (f.data.credentialReport.value.csv as string).split("admin-lee,").join(`admin${suffix},`).split("user/admin-lee").join(`user/admin${suffix}`);
    for (const r of f.receipts as Json[]) if (r.resource === "admin-lee") r.resource = `admin${suffix}`;
    return okReport(runJson(f));
  };
  const labelsOf = (r: ReturnType<typeof okReport>, name: string): string[] => ruleOf(r, "AWS-MFA-2").items.filter((i) => nameText(i).startsWith(name)).flatMap((i) => i.labels.map((l) => l.kind));
  it("대조: 'admin' + U+202E(RLO)이면 이름이 치환되고 '특이 문자' 라벨이 붙는다", () => {
    expect(labelsOf(withUser("‮"), "admin")).toContain("unusual-characters");
  });
  it("[CC-QA-09] 'admin' + U+3164(한글 채움)이면 '특이 문자' 라벨이 붙어야 한다(수정 전: 'admin'과 똑같이 보였다)", () => {
    expect(labelsOf(withUser("ㅤ"), "admin")).toContain("unusual-characters");
  });
  it("[CC-QA-09] 'admin' + 태그 문자(U+E0041)이면 '특이 문자' 라벨이 붙어야 한다", () => {
    expect(labelsOf(withUser("\u{E0041}"), "admin")).toContain("unusual-characters");
  });
});
