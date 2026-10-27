// QA FO-02 — 모르는·비정상 값은 '해석 불가'(P3): 열거형·숫자·시각 필드를 망가뜨려도 '없음 결론'이 새로 생기지 않아야 한다 (설계서 §4-1)
// 방법: 회사 8곳 수집 JSON + AWS 보고서 CSV 4개의 '열거형 필드 목록'(설계서 FO-02 목록) 값마다 변조 값을 넣고 전체 경로를 돌린다.
// 오라클: kit.monotoneViolations(룰: 없음 결론 아님 → 없음 결론 금지 / 대상: 이상 없음 아님 → 이상 없음 금지) + checkReport 위반 0.
// 위반은 필드 → 버그 ID로 분류한다. 수정 전에는 100건(CC-QA-05 36 · 03 30 · 01 18 · 17 12 · 04 4)이었고, 2026-10-20 수정 뒤 모두 0이다(아래는 회귀 시험).
import { describe, expect, it } from "vitest";
import type { Report } from "../model/report";
import { companyJson, label, nameText, okReport, ruleOf, runJson } from "./kit";
import type { Json } from "./kit";
import { csvViolations, jsonViolations } from "./fo02-cases";
import type { Viol } from "./fo02-cases";

let cache: { json: ReturnType<typeof jsonViolations>; csv: ReturnType<typeof csvViolations> } | null = null;
const all = (): NonNullable<typeof cache> => (cache ??= { json: jsonViolations(), csv: csvViolations() });
const viols = (): Viol[] => [...all().json.viols, ...all().csv.viols];
const show = (vs: readonly Viol[]): string[] => vs.map((v) => `${v.where} → ${v.msg.trim()}`);

/** 필드 → 버그 ID(버그 리포트 docs/qa/cloudcheck-bug-report.md) */
const BUG_OF: Readonly<Record<string, string>> = {
  "sg.ingress.protocol": "CC-QA-03", "sg.ingress.fromPort": "CC-QA-03", "sg.ingress.toPort": "CC-QA-03", "sg.ingress.cidrs": "CC-QA-03", "sg.ingress.ipv6Cidrs": "CC-QA-03",
  "role.trust.effect": "CC-QA-05", "role.trust.actions": "CC-QA-05", "role.trust.principal.aws": "CC-QA-05",
  "time.accessKey.createDate": "CC-QA-01", "time.user.createDate": "CC-QA-01", "time.user.passwordLastUsed": "CC-QA-01", "time.storage.keyCreation": "CC-QA-01", "time.csv": "CC-QA-01",
  "nsg.rule.direction": "CC-QA-17", "nsg.rule.access": "CC-QA-17", "nsg.rule.protocol": "CC-QA-17", "nsg.rule.destPortRanges": "CC-QA-17",
  "nsg.rule.sourcePrefixes": "CC-QA-04",
};
const of = (bug: string): Viol[] => viols().filter((v) => BUG_OF[v.field] === bug);

describe("FO-02 모르는·비정상 값 변이 — 회사 8곳 JSON + 보고서 CSV 4개", () => {
  it("변이 표본이 충분하고 상당수가 받아들여진다(받아들인 파일만 판정 비교)", () => {
    const { json, csv } = all();
    expect(json.runs).toBeGreaterThan(400);
    expect(json.accepted).toBeGreaterThan(300);
    expect(csv.runs).toBeGreaterThan(200);
    expect(csv.accepted).toBeGreaterThan(150);
  });
  it("버그로 분류되지 않은 필드에서는 위반이 0이다(새 fail-open이 생기면 이 시험이 실패한다)", () => {
    expect(show(viols().filter((v) => BUG_OF[v.field] === undefined))).toEqual([]);
  });
  it("[CC-QA-03] AWS-NET-1: 프로토콜 공백·빈 값·모르는 토큰, 포트 -1·65536·거꾸로, CIDR 공백이면 위험·주의가 이상 없음이 되지 않아야 한다", () => {
    expect(show(of("CC-QA-03"))).toEqual([]);
  });
  it("[CC-QA-05] AWS-KEY-4: 모르는 Effect('Allow '·''·'zzz'·'Allowed')·형식 밖 Action·Principal 값이면 위험·주의가 이상 없음이 되지 않아야 한다", () => {
    expect(show(of("CC-QA-05"))).toEqual([]);
  });
  it("[CC-QA-01] 시각 필드가 기준 시각보다 늦으면(수집 시각 + 2년) 이상 없음이 되지 않아야 한다(키 생성·마지막 사용·보고서 날짜 칸)", () => {
    expect(show(of("CC-QA-01"))).toEqual([]);
  });
  it("[CC-QA-17] AZ-NET-1: 규칙의 방향·허용·프로토콜이 모르는 값이거나 포트 칸이 비면 위험이 이상 없음이 되지 않아야 한다", () => {
    expect(show(of("CC-QA-17"))).toEqual([]);
  });
  it("[CC-QA-04] AZ-NET-1: 출발지가 모르는 값('zzz' 등 서비스 태그 모양)이면 위험이 이상 없음이 되지 않아야 한다", () => {
    expect(show(of("CC-QA-04"))).toEqual([]);
  });
  it("FO-02 전수 위반 0(수정 전 100건) — 분류표의 필드가 실제로 변이되었는지도 확인한다(분류가 헛돌지 않는다)", () => {
    expect(show(viols())).toEqual([]);
    const fields = new Set([...all().json.fields, ...all().csv.fields]);
    // 회사 8곳 픽스처에 IPv6 출발지 값이 없어 sg.ingress.ipv6Cidrs만 변이 대상이 없다(IPv6 출발지는 FO-06 오라클 · qa/net-sources.test.ts가 덮는다)
    expect(Object.keys(BUG_OF).filter((f) => !fields.has(f))).toEqual(["sg.ingress.ipv6Cidrs"]);
  });
});

/* ───────── P3 표적 사례: 원래 이상 없음인 대상에 모르는 값을 넣으면 '확인 불가'여야 한다(단조성 오라클로는 안 잡히는 쪽) ───────── */
const sgOf = (f: Json, id: string): Json => (f.data.securityGroups as Json[]).flatMap((p) => p.items ?? []).find((s: Json) => s.groupId === id);
const itemStatus = (r: Report, ruleId: "AWS-NET-1" | "AZ-NET-1" | "AWS-KEY-4" | "AWS-LOG-1", name: string): string[] => ruleOf(r, ruleId).items.filter((i) => nameText(i) === name).map((i) => i.status);

describe("FO-02 P3 표적: 원래 위험인 대상(E-07~E-09) — 위험 → 이상 없음 금지", () => {
  const cases: readonly [string, (r: Json) => void][] = [
    ["tcp 3389→22(거꾸로)", (r) => { r.fromPort = 3389; r.toPort = 22; }],
    ["tcp -1..-1", (r) => { r.fromPort = -1; r.toPort = -1; }],
    ["protocol 'TCP '", (r) => { r.protocol = "TCP "; }],
  ];
  for (const [title, edit] of cases) {
    it(`[CC-QA-03] C bastion-ssh(위험) 규칙을 ${title}로 바꾸면 그 SG는 이상 없음이 아니어야 한다`, () => {
      const f = companyJson("aws", "C");
      edit(sgOf(f, "sg-0c0ffee1").ingress[0]);
      expect(itemStatus(okReport(runJson(f)), "AWS-NET-1", "sg-0c0ffee1")).not.toContain("clear");
    });
  }
  it("대조: 범위 밖 상한(0~70000)은 0~65535로 잘라 위험을 유지한다(안전한 방향 — P3로는 해석 불가가 더 정직하다는 의견만 남김)", () => {
    const f = companyJson("aws", "C");
    const r = sgOf(f, "sg-0c0ffee1").ingress[0];
    r.fromPort = 0; r.toPort = 70000;
    expect(itemStatus(okReport(runJson(f)), "AWS-NET-1", "sg-0c0ffee1")).toEqual(["risk"]);
  });
  it("대조: 프로토콜 'tcp'·'6'·'-1'은 위험 그대로다", () => {
    for (const p of ["tcp", "6", "-1"]) {
      const f = companyJson("aws", "C");
      sgOf(f, "sg-0c0ffee1").ingress[0].protocol = p;
      expect(itemStatus(okReport(runJson(f)), "AWS-NET-1", "sg-0c0ffee1"), p).toEqual(["risk"]);
    }
  });
});

describe("FO-02 P3 표적: 원래 이상 없음인 대상에 모르는 값 — 확인 불가여야 한다", () => {
  it("[CC-QA-03] A web SG(80·443 공개)의 프로토콜이 'zzz'면 그 SG는 확인 불가여야 한다(이상 없음 아님)", () => {
    const f = companyJson("aws", "A");
    sgOf(f, "sg-0a1b2c3d").ingress[0].protocol = "zzz";
    expect(itemStatus(okReport(runJson(f)), "AWS-NET-1", "sg-0a1b2c3d")).toEqual(["unknown"]);
  });
  it("[CC-QA-07] A main-trail의 basic readWriteType이 모르는 값('zzz')이면 AWS-LOG-1은 이상 없음이 아니어야 한다", () => {
    const f = companyJson("aws", "A");
    f.data.trails.value[0].selectors.value.basic[0].readWriteType = "zzz";
    expect(label(ruleOf(okReport(runJson(f)), "AWS-LOG-1"))).not.toBe("clear");
  });
  it("대조: readWriteType 'ReadOnly'만 있으면 관리 이벤트 쓰기 미포함 → 주의", () => {
    const f = companyJson("aws", "A");
    f.data.trails.value[0].selectors.value.basic[0].readWriteType = "ReadOnly";
    expect(ruleOf(okReport(runJson(f)), "AWS-LOG-1").status).toBe("caution");
  });
  it("[CC-QA-17] A nsg-banjeut-web 규칙 방향이 'zzz'면(모르는 값) 그 NSG는 확인 불가여야 한다", () => {
    const f = companyJson("azure", "A");
    const nsg = (f.data.nsgs as Json[]).flatMap((p) => p.items ?? []).find((n: Json) => n.name === "nsg-banjeut-web");
    for (const r of nsg.rules) r.direction = "zzz";
    expect(itemStatus(okReport(runJson(f)), "AZ-NET-1", "nsg-banjeut-web")).toEqual(["unknown"]);
  });
});

describe("FO-02 P3 표적: AWS-KEY-4 신뢰 문장(E-12~E-15)", () => {
  const role = (f: Json, name: string): Json => (f.data.iamRoles.value as Json[]).find((r) => r.roleName === name);
  for (const eff of ["Allow ", "", "Permit", "Allowed"]) {
    it(`[CC-QA-05] Principal '*' 문장의 Effect가 ${JSON.stringify(eff)}면 cross-acct-admin은 이상 없음이 아니어야 한다`, () => {
      const f = companyJson("aws", "C");
      role(f, "cross-acct-admin").trust[0].effect = eff;
      expect(itemStatus(okReport(runJson(f)), "AWS-KEY-4", "cross-acct-admin")).not.toContain("clear");
    });
  }
  it("대조: Effect 'allow'(소문자)·'Deny'는 의도대로(위험 · 문장 무시)", () => {
    const f = companyJson("aws", "C");
    role(f, "cross-acct-admin").trust[0].effect = "allow";
    expect(itemStatus(okReport(runJson(f)), "AWS-KEY-4", "cross-acct-admin")).toEqual(["risk"]);
  });
  it("[CC-QA-05] aws: ['*']인데 wildcard: false면(수집기 투영 밖 모양) 위험이어야 한다(E-13)", () => {
    const f = companyJson("aws", "C");
    const p = role(f, "cross-acct-admin").trust[0].principal;
    p.wildcard = false;
    p.aws = ["*"];
    expect(itemStatus(okReport(runJson(f)), "AWS-KEY-4", "cross-acct-admin")).toEqual(["risk"]);
  });
  for (const ck of ["Null:sts:ExternalId", "StringNotEquals:sts:ExternalId", "ForAllValues:StringNotLike:sts:ExternalId"]) {
    it(`[CC-QA-05] 외부 계정 신뢰 + 조건 ${ck}는 ExternalId 보호가 아니므로 vendor-access는 주의여야 한다(E-14)`, () => {
      const f = companyJson("aws", "C");
      role(f, "vendor-access").trust[0].conditionKeys = [ck];
      expect(itemStatus(okReport(runJson(f)), "AWS-KEY-4", "vendor-access")).toEqual(["caution"]);
    });
  }
  it("대조: StringEquals:sts:ExternalId · StringLike:sts:ExternalId(값 일치 계열)는 보호로 본다 → 이상 없음", () => {
    for (const ck of ["StringEquals:sts:ExternalId", "StringLike:sts:ExternalId"]) {
      const f = companyJson("aws", "C");
      role(f, "vendor-access").trust[0].conditionKeys = [ck];
      expect(itemStatus(okReport(runJson(f)), "AWS-KEY-4", "vendor-access"), ck).toEqual(["clear"]);
    }
  });
  it("[CC-QA-05] 신뢰 정책 문장이 0개면(AWS가 만들 수 없는 모양) 그 역할은 확인 불가여야 한다(E-15)", () => {
    const f = companyJson("aws", "C");
    role(f, "cross-acct-admin").trust = [];
    expect(itemStatus(okReport(runJson(f)), "AWS-KEY-4", "cross-acct-admin")).toEqual(["unknown"]);
  });
});

describe("FO-02 P3 표적: AWS-LOG-1 고급 선택기 readOnly(E-16)", () => {
  it("[CC-QA-07] eventCategory=Management + readOnly Equals 빈 배열(NotEquals를 수집기가 버린 모양)이면 이상 없음이 아니어야 한다", () => {
    const f = companyJson("aws", "A");
    const t = f.data.trails.value[0];
    t.hasCustomEventSelectors = true;
    t.selectors.value = { basic: [], advanced: [{ fields: [{ field: "eventCategory", equals: ["Management"] }, { field: "readOnly", equals: [] }] }] };
    expect(ruleOf(okReport(runJson(f)), "AWS-LOG-1").status).not.toBe("clear");
  });
  it("대조: readOnly 필드가 없으면(관리 이벤트 전체) 이상 없음, readOnly=true면 주의", () => {
    const mk = (fields: Json[]): string => {
      const f = companyJson("aws", "A");
      const t = f.data.trails.value[0];
      t.hasCustomEventSelectors = true;
      t.selectors.value = { basic: [], advanced: [{ fields }] };
      return ruleOf(okReport(runJson(f)), "AWS-LOG-1").status;
    };
    expect(mk([{ field: "eventCategory", equals: ["Management"] }])).toBe("clear");
    expect(mk([{ field: "eventCategory", equals: ["Management"] }, { field: "readOnly", equals: ["true"] }])).toBe("caution");
  });
});
