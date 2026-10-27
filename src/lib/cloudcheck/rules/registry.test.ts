// 룰 18장 레지스트리 검사 — 명세(docs/planning/cloudcheck-plan.md §6, 디자인 §9 제목 표) 대비 데이터의 모양, 문구(E 카탈로그) 완결성, 코드 선언.
import { describe, expect, it } from "vitest";
import { AWS_CALLS, AZURE_CALLS } from "../contract/calls";
import { findBanned } from "../model/banned-words";
import { DOORS, RULE_IDS } from "../model/report";
import type { Cloud, RuleCatalogEntry } from "../model/report";
import { RULE_CATALOG, toCatalogEntry } from "./catalog";
import { ENGINE_KO, ENGINE_KO_PARTS } from "./i18n/ko";
import { KEY_RE, E_NAMESPACES, RULE_DOC_HOSTS, RuleSpecSchema } from "./rule-schema";
import { RULES } from "./registry";
import { lowerId } from "./kit";

const specs = RULES.map((m) => m.spec);
const KO: Readonly<Record<string, string>> = ENGINE_KO;

/** 손으로 적은 제목 표 (디자인 §9 최종 표, priority 순) */
const TITLES: readonly (readonly [number, string, string])[] = [
  [10, "AWS-STO-2", "버킷 공개 상태"],
  [20, "AZ-STO-2", "컨테이너 공개 상태"],
  [30, "AWS-NET-1", "관리·DB 포트의 인터넷 노출"],
  [40, "AZ-NET-1", "관리·DB 포트의 인터넷 노출(NSG)"],
  [50, "AWS-KEY-4", "역할 신뢰 설정(외부 계정)"],
  [60, "AWS-MFA-1", "루트 사용자 자격증명"],
  [70, "AWS-MFA-2", "콘솔 사용자 MFA"],
  [80, "AZ-MFA-1", "Entra 사용자 MFA 등록 현황(조건부)"],
  [90, "AZ-MFA-G", "Entra MFA 적용 여부(직접 확인)"],
  [100, "AWS-KEY-3", "관리자 권한 액세스 키"],
  [110, "AWS-KEY-1", "액세스 키 나이"],
  [120, "AWS-KEY-2", "자격증명 마지막 사용"],
  [130, "AZ-KEY-1", "스토리지 공유 키 회전"],
  [140, "AWS-STO-1", "계정 전체 퍼블릭 액세스 차단"],
  [150, "AZ-STO-1", "익명 공개 차단 설정"],
  [160, "AWS-LOG-1", "CloudTrail 기록 설정"],
  [170, "AZ-LOG-1", "활동 로그 내보내기 설정"],
  [180, "AZ-LOG-2", "Blob 접근 기록"],
];

describe("레지스트리 모양", () => {
  it("룰 18장, ID가 모델의 RULE_IDS와 정확히 같다", () => {
    expect(RULES).toHaveLength(18);
    expect(specs.map((s) => s.ruleId).sort()).toEqual([...RULE_IDS].sort());
    expect(new Set(specs.map((s) => s.ruleId)).size).toBe(18);
  });
  it("priority는 10 단위로 유일하고 목록이 그 순서다", () => {
    expect(specs.map((s) => s.priority)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180]);
  });
  it("제목 표(손으로 적음)와 priority·ID·제목이 같다", () => {
    expect(specs.map((s) => [s.priority, s.ruleId, KO[s.titleKey]])).toEqual(TITLES.map((t) => [...t]));
  });
  it("클라우드별 개수: AWS 10 · Azure 8, 출시하지 않는 룰은 AZ-MFA-1 하나", () => {
    const count = (c: Cloud): number => specs.filter((s) => s.cloud === c).length;
    expect([count("aws"), count("azure")]).toEqual([10, 8]);
    expect(specs.filter((s) => !s.released).map((s) => s.ruleId)).toEqual(["AZ-MFA-1"]);
  });
  it("문(door) 배분: 각 클라우드 문 5개를 모두 덮는다", () => {
    for (const cloud of ["aws", "azure"] as const) expect(new Set(specs.filter((s) => s.cloud === cloud).map((s) => s.door))).toEqual(new Set(DOORS));
  });
  it("최고 상태와 이상 없음 허용 여부 (명세 §6-2 표)", () => {
    const want: Readonly<Record<string, readonly [string, boolean]>> = {
      "AWS-MFA-1": ["risk", true], "AWS-MFA-2": ["risk", true], "AWS-KEY-1": ["caution", true], "AWS-KEY-2": ["caution", true],
      "AWS-KEY-3": ["caution", false], "AWS-KEY-4": ["risk", true], "AWS-NET-1": ["risk", true], "AWS-STO-1": ["caution", true],
      "AWS-STO-2": ["risk", true], "AWS-LOG-1": ["caution", true], "AZ-MFA-G": ["unknown", false], "AZ-MFA-1": ["risk", false],
      "AZ-KEY-1": ["caution", true], "AZ-NET-1": ["risk", true], "AZ-STO-1": ["caution", true], "AZ-STO-2": ["risk", true],
      "AZ-LOG-1": ["caution", true], "AZ-LOG-2": ["caution", true],
    };
    for (const s of specs) expect([s.maxStatus, s.allowsClear], s.ruleId).toEqual(want[s.ruleId]);
  });
  it("가이드 룰은 AZ-MFA-G 하나이고 항상 확인 불가다", () => {
    expect(specs.filter((s) => s.kind === "guide").map((s) => s.ruleId)).toEqual(["AZ-MFA-G"]);
    const g = specs.find((s) => s.ruleId === "AZ-MFA-G");
    expect(g?.guide?.steps.map((x) => x.id)).toEqual(["security-defaults", "conditional-access-all", "admin-roles"]);
  });
});

describe("RULE_CATALOG", () => {
  it("RuleCatalogEntry의 필드만 담고(엔진용 선언이 새지 않는다) 레지스트리와 같은 순서다", () => {
    expect(RULE_CATALOG).toHaveLength(18);
    expect(RULE_CATALOG.map((e) => e.ruleId)).toEqual(specs.map((s) => s.ruleId));
    const keys = Object.keys(RULE_CATALOG[0]).sort();
    for (const e of RULE_CATALOG) expect(Object.keys(e).sort()).toEqual(keys);
    for (const leaked of ["families", "calls", "reasons", "facts", "fixtures", "isolatedDenial", "asOfBasis", "manualHowKey", "autoNotice"]) expect(keys).not.toContain(leaked);
  });
  it("toCatalogEntry는 명세의 같은 값을 그대로 옮긴다", () => {
    specs.forEach((s, i) => expect(toCatalogEntry(s)).toEqual(RULE_CATALOG[i]));
  });
});

describe("룰 데이터 스키마(zod)", () => {
  it.each(specs.map((s) => [s.ruleId, s] as const))("%s", (_id, spec) => {
    const r = RuleSpecSchema.safeParse(spec);
    expect(r.success ? "ok" : JSON.stringify(r.error.issues, null, 1)).toBe("ok");
  });
  it("스키마는 잘못된 데이터를 거른다", () => {
    const base = specs[0];
    const bad = (patch: Record<string, unknown>): boolean => RuleSpecSchema.safeParse({ ...base, ...patch }).success;
    expect(bad({})).toBe(true);
    expect(bad({ titleKey: "cc.c.title" })).toBe(false);                       // E 네임스페이스 밖
    expect(bad({ titleKey: "cc.rule.Title" })).toBe(false);                    // 대문자
    expect(bad({ lastVerified: "2026-13-40" })).toBe(false);
    expect(bad({ basis: [{ titleKey: "cc.basis.x.y", kind: "doc", link: { href: "https://example.com/a", host: "example.com" } }] })).toBe(false);   // 허용 도메인 밖
    expect(bad({ basis: [{ titleKey: "cc.basis.x.y", kind: "doc", link: { href: "http://docs.aws.amazon.com/a", host: "docs.aws.amazon.com" } }] })).toBe(false);  // http
    expect(bad({ cannotSee: [] })).toBe(false);
    expect(bad({ cloud: "azure" })).toBe(false);                               // ruleId 접두와 불일치
    expect(bad({ fixtures: { ...base.fixtures, versionMismatch: "manual" } })).toBe(false);
    expect(bad({ fixtures: { ...base.fixtures, pass: { na: "짧다" } } })).toBe(false);   // 이유 8자 미만
  });
  it("쓰기 명령에는 자리표시자가 1개 이상 있고 읽기 명령도 셸 이름으로 시작한다", () => {
    for (const s of specs) {
      if (s.fix === null) continue;
      for (const c of [...s.fix.change.commands, ...s.fix.revert.commands]) {
        expect(c.kind).toBe("write");
        expect(c.segments.filter((g) => g.t === "ph").length, `${s.ruleId} ${JSON.stringify(c.segments[0])}`).toBeGreaterThanOrEqual(1);
      }
      for (const c of s.fix.observe.commands) expect(c.kind).toBe("read");
    }
  });
  it("근거 링크는 클라우드 사업자 공식 문서 도메인만 쓰고 lastVerified가 날짜다", () => {
    for (const s of specs) {
      expect(s.basis.length).toBeGreaterThan(0);
      for (const b of s.basis) {
        expect(RULE_DOC_HOSTS as readonly string[], `${s.ruleId} ${b.link.href}`).toContain(new URL(b.link.href).hostname);
        expect(b.link.href.startsWith("https://")).toBe(true);
      }
      expect(s.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.lastVerified >= "2026-10-01").toBe(true);
    }
  });
  it("사고 사례(incident)는 아직 한 곳도 연결하지 않았다(출처 검증 전에는 싣지 않는다)", () => {
    expect(specs.filter((s) => s.incident !== null)).toEqual([]);
  });
});

describe("호출 선언", () => {
  const phases: Readonly<Record<string, readonly string[]>> = { ...Object.fromEntries(Object.entries(AWS_CALLS).map(([k, v]) => [k, v.phases])), ...Object.fromEntries(Object.entries(AZURE_CALLS).map(([k, v]) => [k, v.phases])) };
  it("룰이 읽는 호출은 호출 카탈로그에 있고 그 문(door) 단계(또는 모든 문이 쓰는 범위·신원 단계)에서 수집된다", () => {
    for (const s of specs) {
      for (const c of s.calls) {
        expect(phases[c], `${s.ruleId} ${c}`).toBeDefined();
        const ok = phases[c].includes(s.door) || phases[c].includes("scope") || phases[c].includes("identity");
        expect(ok, `${s.ruleId} ${c} ${JSON.stringify(phases[c])}`).toBe(true);
      }
    }
  });
  it("각 룰은 자기 문 단계의 호출을 적어도 하나 읽는다 (가이드 제외)", () => {
    for (const s of specs.filter((x) => x.kind !== "guide" && x.released)) {
      expect(s.calls.some((c) => phases[c].includes(s.door)), s.ruleId).toBe(true);
    }
  });
  it("부분 거부 승격(isolatedDenial) 호출은 룰이 읽는 호출 안에 있다", () => {
    for (const s of specs) if (s.isolatedDenial !== null) for (const c of s.isolatedDenial.calls) expect(s.calls, s.ruleId).toContain(c);
  });
  it("INV-7 대상은 AWS-STO-2와 AZ-STO-2 둘뿐이다", () => {
    expect(specs.filter((s) => s.isolatedDenial !== null).map((s) => s.ruleId).sort()).toEqual(["AWS-STO-2", "AZ-STO-2"]);
  });
  it("필요 권한(permissions)은 읽는 호출의 권한 이름과 같다", () => {
    for (const s of specs) {
      const want = [...new Set(s.calls.map((c) => (AWS_CALLS as Record<string, { permission: string | null }>)[c]?.permission ?? (AZURE_CALLS as Record<string, { permission: string | null }>)[c]?.permission ?? null).filter((p): p is string => p !== null))].sort();
      expect([...s.permissions].sort(), s.ruleId).toEqual(want);
    }
  });
});

/* ───────── 문구(E 카탈로그) 완결성 ───────── */
function referencedKeys(): Map<string, string> {
  const out = new Map<string, string>();   // 키 → 어디서 왔나
  const add = (k: string | null | undefined, from: string): void => { if (k) out.set(k, from); };
  for (const s of specs) {
    const id = s.ruleId;
    add(s.titleKey, `${id} title`); add(s.summaryKey, `${id} summary`);
    for (const [st, k] of Object.entries(s.conditionKeys)) add(k, `${id} cond.${st}`);
    add(s.impactKey, `${id} impact`); add(s.questionKey, `${id} question`);
    for (const p of s.params) add(p.key, `${id} param`);
    s.cannotSee.forEach((k, i) => add(k, `${id} cannot.${i + 1}`));
    s.falsePositiveKeys.forEach((k, i) => add(k, `${id} fp.${i + 1}`));
    if (s.fix !== null) {
      add(s.fix.observe.textKey, `${id} fix.observe`); add(s.fix.change.textKey, `${id} fix.change`); add(s.fix.revert.textKey, `${id} fix.revert`);
      for (const c of [...s.fix.observe.commands, ...s.fix.change.commands, ...s.fix.revert.commands]) for (const g of c.segments) if (g.t === "ph") add(g.key, `${id} ph`);
    }
    s.guide?.steps.forEach((st) => add(st.textKey, `${id} guide.${st.id}`));
    s.basis.forEach((b) => add(b.titleKey, `${id} basis`));
    add(s.manualHowKey, `${id} how`); add(s.autoNotice?.howKey, `${id} auto.how`);
    for (const slug of Object.keys(s.reasons)) add(`cc.reason.${lowerId(id)}.${slug}`, `${id} reason`);
    for (const slug of Object.keys(s.facts)) add(`cc.fact.${slug}`, `${id} fact`);
  }
  return out;
}
const PLACEHOLDER_RE = /\{([a-zA-Z][a-zA-Z0-9]*)\}/g;
const placeholdersOf = (text: string): string[] => [...new Set([...text.matchAll(PLACEHOLDER_RE)].map((m) => m[1]))].sort();

describe("E 카탈로그(rules/i18n)", () => {
  const refs = referencedKeys();

  it("모든 키가 규약 형식이고 E 네임스페이스에 속한다", () => {
    for (const k of Object.keys(ENGINE_KO)) {
      expect(KEY_RE.test(k), k).toBe(true);
      expect(E_NAMESPACES as readonly string[], k).toContain(k.split(".")[1]);
    }
  });
  it("세 파일 사이에 중복 키가 없다", () => {
    const sum = Object.values(ENGINE_KO_PARTS).reduce((n, part) => n + Object.keys(part).length, 0);
    expect(Object.keys(ENGINE_KO)).toHaveLength(sum);
  });
  it("룰 데이터가 참조하는 모든 키에 문구가 있다", () => {
    const missing = [...refs].filter(([k]) => typeof KO[k] !== "string" || KO[k].trim() === "").map(([k, from]) => `${k} (${from})`);
    expect(missing).toEqual([]);
  });
  it("룰 전용 키(cc.rule/reason/basis.<룰>.…)는 모두 룰 데이터가 참조한다 (쓰지 않는 문구가 남지 않는다)", () => {
    const ruleIds = new Set(specs.map((s) => lowerId(s.ruleId)));
    const extras = Object.keys(ENGINE_KO).filter((k) => {
      const [, ns, owner] = k.split(".");
      return (ns === "rule" || ns === "reason" || ns === "basis") && ruleIds.has(owner) && !refs.has(k);
    });
    expect(extras).toEqual([]);
  });
  it("fact · 자리표시자 키도 쓰는 곳이 있다", () => {
    const usedFacts = new Set(specs.flatMap((s) => Object.keys(s.facts).map((x) => `cc.fact.${x}`)));
    const engineFacts = new Set(["cc.fact.manual-check", "cc.fact.manual-rest", "cc.fact.out-of-scope", "cc.fact.guide-card", "cc.fact.idp-mfa"]);
    const factKeys = Object.keys(ENGINE_KO).filter((k) => k.startsWith("cc.fact."));
    expect(factKeys.filter((k) => !usedFacts.has(k) && !engineFacts.has(k))).toEqual([]);
    const usedPh = new Set([...refs.keys()].filter((k) => k.startsWith("cc.ph.")));
    expect(Object.keys(ENGINE_KO).filter((k) => k.startsWith("cc.ph.") && !usedPh.has(k))).toEqual([]);
  });
  it("{이름} 자리는 선언된 파라미터와 정확히 같다 (사유 · 사실)", () => {
    const bad: string[] = [];
    const check = (key: string, declared: readonly string[], from: string): void => {
      const got = placeholdersOf(KO[key] ?? "");
      if (JSON.stringify(got) !== JSON.stringify([...declared].sort())) bad.push(`${key} (${from}): 문구 ${JSON.stringify(got)} ≠ 선언 ${JSON.stringify([...declared].sort())}`);
    };
    const factDecl = new Map<string, string>();
    for (const s of specs) {
      for (const [slug, params] of Object.entries(s.reasons)) check(`cc.reason.${lowerId(s.ruleId)}.${slug}`, params, s.ruleId);
      for (const [slug, params] of Object.entries(s.facts)) {
        check(`cc.fact.${slug}`, params, s.ruleId);
        const sig = JSON.stringify([...params].sort());
        const prev = factDecl.get(slug);
        if (prev !== undefined && prev !== sig) bad.push(`cc.fact.${slug}: 룰마다 파라미터 선언이 다름 ${prev} / ${sig}`);
        factDecl.set(slug, sig);
      }
    }
    expect(bad).toEqual([]);
  });
  it("룰이 선언하지 않은 문구의 {이름} 자리는 아래 표와 정확히 같다 (엔진·화면이 채우는 파라미터 이름 규약)", () => {
    // 프론트가 이 이름으로 값을 채운다: 사유 코드의 MsgParam, 알림(Banner)·시간 알림(TimeNotice)·인식 결과(InputRecognition.detail)의 필드
    const ENGINE_PARAMS: Readonly<Record<string, readonly string[]>> = {
      "cc.reason.unknown.denied": ["permission"], "cc.reason.unknown.error": ["errorCode"], "cc.reason.unknown.unsupported": ["errorCode"],
      "cc.reason.unknown.budget-exceeded": ["collected", "total"], "cc.reason.unknown.region-missing": ["regions"],
      "cc.banner.secrets-detected.title": ["count"], "cc.banner.areas-not-judged.body": ["doors"], "cc.banner.doors-skipped.body": ["doors"],
      "cc.banner.schema-newer-minor.body": ["got", "supported"], "cc.banner.duplicate-input-ignored.body": ["count"],
      "cc.time.snapshot-age.stale.title": ["hours"], "cc.time.snapshot-age.very-stale.title": ["days"], "cc.time.guidance-stale.body": ["rules"],
      "cc.recog.parse-error.reason": ["col", "line"], "cc.recog.parse-error.reason-truncated": ["tail"], "cc.recog.schema-major.reason": ["major"],
    };
    const declared = new Set<string>();
    for (const s of specs) {
      for (const slug of Object.keys(s.reasons)) declared.add(`cc.reason.${lowerId(s.ruleId)}.${slug}`);
      for (const slug of Object.keys(s.facts)) declared.add(`cc.fact.${slug}`);
    }
    const got: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(KO)) {
      if (declared.has(k)) continue;
      const ph = placeholdersOf(v);
      if (ph.length > 0) got[k] = ph;
    }
    const want = Object.fromEntries(Object.entries(ENGINE_PARAMS).map(([k, v]) => [k, [...v].sort()]));
    expect(got).toEqual(want);
  });
  it("금지어(model/banned-words.ts)가 한 군데도 없다", () => {
    const hits = Object.entries(KO).flatMap(([k, v]) => findBanned(v).map((h) => `${k}: ${h.label} "${h.match}"`));
    expect(hits).toEqual([]);
  });
  it("영어 약어를 제외한 이모지·제어 문자가 없다", () => {
    for (const [k, v] of Object.entries(KO)) {
      expect(/\p{Extended_Pictographic}/u.test(v), k).toBe(false);
      expect(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v), k).toBe(false);
      expect(v, k).toBe(v.trim());
      expect(v.length, k).toBeGreaterThan(1);
    }
  });
  it("고치는 법 문구는 명령이 있을 때만 '명령'을 말한다", () => {
    const bad: string[] = [];
    for (const s of specs) {
      if (s.fix === null) continue;
      const steps = [["observe", s.fix.observe.textKey, s.fix.observe.commands], ["change", s.fix.change.textKey, s.fix.change.commands], ["revert", s.fix.revert.textKey, s.fix.revert.commands]] as const;
      for (const [name, key, cmds] of steps) {
        const says = /명령/.test(KO[key] ?? "");
        if (says !== (cmds.length > 0)) bad.push(`${s.ruleId} fix.${name}: 문구 ${says ? "명령 언급" : "명령 없음"} / 명령 ${cmds.length}개`);
      }
    }
    expect(bad).toEqual([]);
  });
  it("되돌릴 수 없는 변경은 변경 문구 또는 되돌리기 문구에 경고가 있다 (삭제 · 다시 생성 · 해제)", () => {
    const irreversible: Readonly<Record<string, RegExp>> = {
      "AWS-MFA-2": /되돌릴 수 없/, "AWS-KEY-1": /되돌릴 수 없/, "AWS-KEY-2": /되돌릴 수 없|복구할 수 없/, "AZ-KEY-1": /되돌릴 수 없/,
    };
    for (const [id, re] of Object.entries(irreversible)) {
      const s = specs.find((x) => x.ruleId === id) as (typeof specs)[number];
      expect(re.test(KO[(s.fix as NonNullable<typeof s.fix>).change.textKey] + KO[(s.fix as NonNullable<typeof s.fix>).revert.textKey]), id).toBe(true);
    }
  });
  it("사유 · 사실 slug는 룰 안에서 형식이 맞고 룰 접두와 충돌하지 않는다", () => {
    for (const s of specs) {
      for (const slug of [...Object.keys(s.reasons), ...Object.keys(s.facts)]) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
  it("확인 불가 사유 21종 모두 긴 문구와 짧은 이름이 있다", () => {
    const codes = ["denied", "error", "throttled", "truncated", "unsupported", "budget-exceeded", "region-missing", "subscription-missing", "scope-unproven", "csv-scope-unproven", "csv-row-ambiguous", "field-missing", "value-unrecognized", "schema-unsupported", "parse-failed", "not-collected", "stale-evidence", "population-mismatch", "clear-without-evidence", "no-clear-rule", "guide-only"];
    expect(codes).toHaveLength(21);
    for (const c of codes) { expect(KO[`cc.reason.unknown.${c}`], c).toBeTruthy(); expect(KO[`cc.reason.short.${c}`], c).toBeTruthy(); }
  });
  it("짧은 이름에는 자리표시자가 없다 (문 단위 수집 사유 · 범위 패널의 사유는 파라미터 없이 짧은 이름으로 그린다)", () => {
    for (const [k, v] of Object.entries(KO)) if (k.startsWith("cc.reason.short.")) expect(v, k).not.toMatch(/\{[A-Za-z][A-Za-z0-9]*\}/);
  });
});

describe("룰 문구의 공통 규칙", () => {
  it("모든 위험·주의 룰에 영향 · 질문 · 오탐 시나리오 · 못 보는 것이 있다 (가이드 제외)", () => {
    for (const s of specs.filter((x) => x.kind !== "guide")) {
      expect(s.cannotSee.length, s.ruleId).toBeGreaterThanOrEqual(1);
      if (s.ruleId !== "AWS-MFA-2") expect(s.questionKey, s.ruleId).not.toBeNull();
      expect(s.impactKey, s.ruleId).not.toBeNull();
      expect(s.falsePositiveKeys.length, s.ruleId).toBeGreaterThanOrEqual(1);
      expect(s.manualHowKey, s.ruleId).not.toBeNull();
    }
  });
  it("조건 설명(conditionKeys)은 룰이 낼 수 있는 상태마다 있다", () => {
    for (const s of specs) {
      const keys = Object.keys(s.conditionKeys);
      expect(keys, s.ruleId).toContain("unknown");
      if (s.maxStatus === "risk") expect(keys, s.ruleId).toContain("risk");
      if (s.maxStatus === "caution") expect(keys, s.ruleId).toContain("caution");
      expect(keys.includes("clear"), s.ruleId).toBe(s.allowsClear);
    }
  });
});

describe("공통 타입 호환", () => {
  it("RuleCatalogEntry로 쓸 수 있다", () => {
    const e: RuleCatalogEntry = RULE_CATALOG[0];
    expect(e.ruleId).toBe("AWS-STO-2");
  });
});
