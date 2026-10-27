// 화면에 나갈 문장의 린트: 모든 micro 픽스처 · 증거를 줄인 변이 · (parse가 있으면) 가짜 회사 8곳의 리포트에서
// 사유 · 사실 메시지를 한국어 카탈로그로 채워 보고, 내부 표기가 새어 나오지 않는지 본다 (디자인 검수 K-4 · K-5류: slot1, none, 원시 열거값, 채워지지 않은 {이름}).
// parse 모듈(API설계자)이 없으면 회사 부분만 건너뛴다(describe.skipIf). micro 부분은 항상 돈다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { demoInputName } from "../contract/normalized";
import type { NormalizedInput } from "../contract/normalized";
import { judge } from "../engine/judge";
import type { InputRecognition } from "../model/report";
import { SET_IDS } from "./companies";
import { RULES } from "../rules/registry";
import { MICRO, resolveFixture } from "./micro";
import { evidenceRemovingMutations } from "./mutate";
import { collectMsgs, keyOf, renderMsg, templateOf } from "./render";

interface ParseApi {
  recognize(src: { readonly via: "file" | "paste" | "demo"; readonly name: string; readonly bytes: Uint8Array; readonly lastModified: number | null }): InputRecognition;
  buildInput(recs: readonly InputRecognition[]): { ok: true; input: NormalizedInput } | { ok: false };
}
async function loadParse(): Promise<ParseApi | null> {
  try {
    const base = "../parse/";
    const r = (await import(/* @vite-ignore */ `${base}recognize`)) as { recognize?: unknown };
    const n = (await import(/* @vite-ignore */ `${base}normalize`)) as { buildInput?: unknown };
    if (typeof r.recognize !== "function" || typeof n.buildInput !== "function") return null;
    return { recognize: r.recognize as ParseApi["recognize"], buildInput: n.buildInput as ParseApi["buildInput"] };
  } catch {
    return null;
  }
}
const api = await loadParse();

/** 글자로 나온 메시지에 있으면 안 되는 것 */
const FORBIDDEN: readonly (readonly [RegExp, string])[] = [
  [/\{[A-Za-z][A-Za-z0-9]*\}/, "채워지지 않은 자리"],
  [/⟦/, "카탈로그에 없는 키"],
  [/\bslot\d|\bslot\b/i, "보고서 슬롯 내부 표기"],
  [/\bundefined\b|\bnull\b|\bNaN\b|\[object/, "프로그램 값이 그대로"],
  [/\bnone\b/, "원시 값 none"],
  [/\b(?:workspace|storage|blob|container)\b/, "원시 열거값(소문자)"],
  [/\?\s*$|:\s*$/, "문장이 비어 끝남"],
];

/** 룰이 선언한 닫힌 목록: 코드 → 파라미터 이름들 (registry 테스트는 선언 ↔ 문구만 맞춘다. 실제로 내보낸 코드가 선언 안에 있는지는 여기서 본다) */
const DECLARED = new Map<string, string>();
for (const m of RULES) {
  for (const [slug, ps] of Object.entries(m.spec.reasons)) DECLARED.set(`${m.spec.ruleId}:${slug}`, JSON.stringify([...ps].sort()));
  for (const [slug, ps] of Object.entries(m.spec.facts)) DECLARED.set(`fact:${slug}`, JSON.stringify([...ps].sort()));
}
/** 엔진이 직접 내는 사실(직접 볼 목록) */
const ENGINE_FACTS = new Set(["fact:manual-check", "fact:manual-rest", "fact:out-of-scope", "fact:guide-card", "fact:idp-mfa"]);

/**
 * 문 단위 수집 사유(DoorResult.collection.reason)는 파라미터 없이 짧은 이름(cc.reason.short.*)으로 그린다. 긴 문구의 {권한}·{리전} 자리는 비어 있어도 된다.
 */
const SHORT_ONLY = /\.collection\.reason$/;

function lint(report: unknown, label: string, bad: Set<string>): number {
  let n = 0;
  for (const { path, msg } of collectMsgs(report)) {
    if (SHORT_ONLY.test(path)) continue;
    n++;
    if (templateOf(msg.code) === undefined) { bad.add(`${label} ${path}: 키 없음 ${keyOf(msg.code)}`); continue; }
    // 룰 사유 · 사실은 룰이 선언한 닫힌 목록 안에 있고 파라미터 이름이 선언과 같다
    const ruleOrFact = msg.code.startsWith("fact:") ? !ENGINE_FACTS.has(msg.code) : msg.code.indexOf(":") > 0;
    if (ruleOrFact) {
      const decl = DECLARED.get(msg.code);
      if (decl === undefined) bad.add(`선언되지 않은 코드: ${msg.code}`);
      else if (decl !== JSON.stringify(Object.keys(msg.params ?? {}).sort())) bad.add(`파라미터가 선언과 다름: ${msg.code} 선언 ${decl} / 실제 ${JSON.stringify(Object.keys(msg.params ?? {}).sort())}`);
    }
    const text = renderMsg(msg);
    for (const [re, why] of FORBIDDEN) if (re.test(text)) bad.add(`${why}: "${text}" (${msg.code})`);
    // 비식별 상수(c) 파라미터가 내부 열거값 그대로인지
    for (const [name, p] of Object.entries(msg.params ?? {})) {
      if ("c" in p && /^(?:none|null|undefined|slot\d+|\?)$/i.test(p.c)) bad.add(`상수 파라미터 ${name}="${p.c}" (${msg.code})`);
    }
  }
  return n;
}

describe("문장 린트 자체", () => {
  const run = (msgs: unknown[]): string[] => { const bad = new Set<string>(); lint({ items: msgs }, "synthetic", bad); return [...bad]; };

  it("내부 표기가 새어 나온 문장을 잡는다 (디자인 검수 K-4 · K-5가 막은 모양)", () => {
    expect(run([{ code: "fact:key-slot", params: { slot: { c: "?" } } }]).join("|")).toContain('상수 파라미터 slot="?"');
    expect(run([{ code: "fact:pab-on", params: { name: { c: "none" } } }]).join("|")).toMatch(/원시 값 none/);
    expect(run([{ code: "fact:pab-on", params: { name: { c: "storage" } } }]).join("|")).toMatch(/원시 열거값/);
    expect(run([{ code: "fact:pab-on" }]).join("|")).toMatch(/채워지지 않은 자리/);
    expect(run([{ code: "fact:no-such-fact" }]).join("|")).toMatch(/키 없음/);
  });
  it("선언되지 않은 코드와 선언과 다른 파라미터를 잡는다", () => {
    expect(run([{ code: "fact:trust-canonical-user" }, { code: "AWS-NET-1:open-review" }, { code: "fact:no-such-fact" }]).join("|")).toMatch(/키 없음|선언되지 않은/);
    expect(run([{ code: "AWS-NET-1:open-review", params: { n: { n: 3 }, extra: { n: 1 } } }]).join("|")).toMatch(/파라미터가 선언과 다름/);
    expect(run([{ code: "AWS-NET-1:open-review", params: { n: { n: 3 } } }, { code: "fact:key-slot", params: { slot: { c: "1" } } }])).toEqual([]);
  });
  it("정상 문장과 문 단위 수집 사유(짧은 이름으로만 그림)는 잡지 않는다", () => {
    expect(run([{ code: "fact:key-slot", params: { slot: { c: "1" } } }, { code: "fact:unused-key-none" }])).toEqual([]);
    const bad = new Set<string>();
    lint({ doors: [{ collection: { reason: { code: "denied" } } }] }, "door", bad);
    expect([...bad]).toEqual([]);
  });
});

describe("문장 린트: micro 픽스처 전체", () => {
  const refs = Object.entries(MICRO).flatMap(([rule, table]) => Object.keys(table).map((name) => `micro/${rule}/${name}`));

  it("모든 사유 · 사실 메시지가 카탈로그로 채워지고 내부 표기가 없다", () => {
    const bad = new Set<string>();
    let msgs = 0;
    for (const ref of refs) msgs += lint(judge(resolveFixture(ref)), ref, bad);
    expect(msgs).toBeGreaterThan(500);
    expect([...bad]).toEqual([]);
  });

  it("증거를 줄인 변이(거부 · 잘림 · 필드 부재 · 버전 불일치 …)에서 나온 확인 불가 문장도 같다", () => {
    const bad = new Set<string>();
    let reports = 0;
    for (const ref of refs) {
      const input = resolveFixture(ref);
      for (const m of evidenceRemovingMutations(input)) {
        let mutated: NormalizedInput;
        try { mutated = m.apply(input); } catch { continue; }
        reports++;
        lint(judge(mutated), `${ref}~${m.name}`, bad);
      }
    }
    expect(reports).toBeGreaterThan(1000);
    expect([...bad]).toEqual([]);
  });
});

describe.skipIf(api === null)("문장 린트: 가짜 회사 8곳 (변이 포함)", () => {
  const COMPANIES = join(__dirname, "companies");
  const inputOf = (set: (typeof SET_IDS)[number], cloud: "aws" | "azure"): NormalizedInput => {
    const p = api as ParseApi;
    const bytes = new TextEncoder().encode(readFileSync(join(COMPANIES, `${cloud}-${set}.json`), "utf8"));
    const rec = p.recognize({ via: "demo", name: demoInputName(set, cloud), bytes, lastModified: null });
    const built = p.buildInput([rec]);
    if (!built.ok) throw new Error(`buildInput 실패: ${set} ${cloud}`);
    return built.input;
  };

  it.each(SET_IDS.flatMap((s) => (["aws", "azure"] as const).map((c) => [s, c] as const)))("세트 %s · %s", (set, cloud) => {
    const input = inputOf(set, cloud);
    const bad = new Set<string>();
    const n = lint(judge(input), `${set} ${cloud}`, bad);
    for (const m of evidenceRemovingMutations(input)) {
      let mutated: NormalizedInput;
      try { mutated = m.apply(input); } catch { continue; }
      lint(judge(mutated), `${set} ${cloud}~${m.name}`, bad);
    }
    expect(n).toBeGreaterThan(10);
    expect([...bad]).toEqual([]);
  });
});
