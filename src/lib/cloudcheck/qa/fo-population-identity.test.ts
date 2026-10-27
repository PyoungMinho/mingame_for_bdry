// QA FO-04 — 모수 신원: 개수만 같으면 통과하는 구멍 (설계서 §4-1, CR-02)
// ① 대상 집합을 바꿔치기하되 개수를 유지한다(구독 ID를 범위 밖으로 · 리전을 비활성 리전으로 · 같은 대상을 두 번 넣고 하나를 뺀다).
// ② 일반 속성: 이상 없음·해당 없음 룰의 대상 MatchKey 집합 = QA가 원시 파일에서 따로 센 열거 집합(제외가 없는 룰), 그리고 MatchKey 중복 0.
// 열거 집합은 엔진 코드를 쓰지 않고 원시 JSON에서 직접 만든다(MatchKey 형식: <cloud>|<계정·테넌트>|<유형>|<리전·구독 또는 ->|<고유 ID>).
import { describe, expect, it } from "vitest";
import type { Report, RuleId } from "../model/report";
import { clone, companyJson, itemsOf, label, okReport, receiptById, ruleOf, rulesOf, runJson, SETS } from "./kit";
import type { CloudId, Json, SetId } from "./kit";

const esc = (s: string): string => s.replace(/%/g, "%25").replace(/\|/g, "%7C");
const key = (cloud: CloudId, acct: string, type: string, loc: string, id: string): string => `${cloud}|${esc(acct)}|${type}|${esc(loc)}|${esc(id)}`;
const lower = (s: string): string => s.toLowerCase();

/** 원시 JSON에서 룰별 '대상 전체' MatchKey 집합(제외가 없는 룰만). 범위 밖 구독의 항목은 세지 않는다 */
function rawEnumeration(cloud: CloudId, f: Json): Partial<Record<RuleId, string[]>> {
  if (cloud === "aws") {
    const acct = f.identity.accountId as string;
    const out: Partial<Record<RuleId, string[]>> = {};
    if (f.data.securityGroups) out["AWS-NET-1"] = (f.data.securityGroups as Json[]).flatMap((p) => (p.items ?? []).map((s: Json) => key("aws", acct, "security-group", p.region, s.groupId)));
    // S3 버킷 이름은 전역에서 유일하므로 MatchKey의 위치 마디는 리전과 무관하게 "-"다(CC-QA-16 수정 뒤 명세 — 리전 조회 실패에도 같은 키)
    if (f.data.buckets?.items) out["AWS-STO-2"] = (f.data.buckets.items as Json[]).map((b) => key("aws", acct, "s3-bucket", "-", b.name));
    if (f.data.accountPublicAccessBlock) out["AWS-STO-1"] = [key("aws", acct, "aws-account", "-", acct)];
    if (f.data.trails) out["AWS-LOG-1"] = [key("aws", acct, "aws-account", "-", acct)];
    return out;
  }
  const tenant = lower(f.identity.tenantId as string);
  const inScope = new Set(((f.scope.subscriptions.value ?? []) as Json[]).filter((s) => s.inScope).map((s) => lower(s.id)));
  const per = (sec: string): Json[] => ((f.data[sec] ?? []) as Json[]).filter((p) => inScope.has(lower(p.subscription)));
  const out: Partial<Record<RuleId, string[]>> = {};
  const accounts = per("storageAccounts").flatMap((p) => (p.items ?? []).map((a: Json) => ({ sub: lower(p.subscription), a })));
  const acctKeys = accounts.map(({ sub, a }) => key("azure", tenant, "storage-account", sub, lower(a.id)));
  if (f.data.storageAccounts) { out["AZ-KEY-1"] = acctKeys; out["AZ-STO-1"] = acctKeys; out["AZ-LOG-2"] = acctKeys; }
  if (f.data.storageAccounts) out["AZ-STO-2"] = accounts.flatMap(({ sub, a }) => (a.containers?.value ?? []).map((c: Json) => key("azure", tenant, "blob-container", sub, `${lower(a.id)}/${c.name}`)));
  if (f.data.nsgs) out["AZ-NET-1"] = per("nsgs").flatMap((p) => (p.items ?? []).map((n: Json) => key("azure", tenant, "nsg", lower(p.subscription), lower(n.id))));
  if (f.data.activityLogExports) out["AZ-LOG-1"] = [...inScope].map((s) => key("azure", tenant, "subscription", s, s));
  return out;
}

/** 일반 속성 위반: 없음 결론 룰의 대상 집합 ≠ 원시 열거 집합, 또는 MatchKey 중복 */
function identityViolations(cloud: CloudId, f: Json, r: Report): string[] {
  const out: string[] = [];
  const raw = rawEnumeration(cloud, f);
  for (const x of rulesOf(r)) {
    const keys = x.items.map((i) => i.resource.key as string);
    if (new Set(keys).size !== keys.length && (x.status === "clear" || x.status === "na")) out.push(`${x.ruleId}: ${x.status}인데 같은 대상(MatchKey)이 두 번 이상 — ${keys.length - new Set(keys).size}건`);
    const want = raw[x.ruleId];
    if (want === undefined || !(x.status === "clear" || x.status === "na")) continue;
    const a = [...new Set(keys)].sort().join("\n");
    const b = [...new Set(want)].sort().join("\n");
    if (a !== b) out.push(`${x.ruleId}: ${x.status}인데 대상 집합이 원시 열거와 다름 — 리포트 [${[...new Set(keys)].filter((k) => !want.includes(k)).join(", ")}] / 원시만 [${want.filter((k) => !keys.includes(k)).join(", ")}]`);
  }
  return out;
}

describe("FO-04 ② 일반 속성 — 회사 8곳 원본은 없음 결론 룰의 대상 집합이 원시 열거와 같고 중복이 없다", () => {
  for (const cloud of ["aws", "azure"] as const) for (const set of SETS) {
    it(`${cloud}-${set}: 위반 0`, () => {
      const f = companyJson(cloud, set);
      expect(identityViolations(cloud, f, okReport(runJson(f)))).toEqual([]);
    });
  }
  it("검사기 자체 점검: 원시 열거가 비어 있지 않다(AWS-NET-1·STO-2·AZ-NET-1·AZ-STO-1·AZ-LOG-1)", () => {
    expect(rawEnumeration("aws", companyJson("aws", "A"))["AWS-NET-1"]?.length).toBe(4);
    expect(rawEnumeration("aws", companyJson("aws", "A"))["AWS-STO-2"]?.length).toBe(3);
    expect(rawEnumeration("azure", companyJson("azure", "A"))["AZ-NET-1"]?.length).toBe(2);
    expect(rawEnumeration("azure", companyJson("azure", "A"))["AZ-STO-1"]?.length).toBe(3);
    expect(rawEnumeration("azure", companyJson("azure", "A"))["AZ-LOG-1"]?.length).toBe(2);
  });
});

const B3 = "00000000-0000-0000-0000-0000000000b3";
/** Azure 구독별 섹션의 b2 항목을 범위 밖 구독 b3로(영수증 · 리소스 ID 안의 구독도 같이) — 개수는 그대로 */
function swapSub(set: SetId, sections: readonly string[]): Json {
  const f = companyJson("azure", set);
  for (const sec of sections) {
    const e = (f.data[sec] as Json[]).find((p) => p.subscription.endsWith("b2"));
    if (e === undefined) throw new Error(`b2 항목 없음: ${sec}`);
    e.subscription = B3;
    receiptById(f, e.receipt).subscription = B3;
  }
  return JSON.parse(JSON.stringify(f).split("/subscriptions/00000000-0000-0000-0000-0000000000b2/").join(`/subscriptions/${B3}/`));
}

describe("FO-04 ① 구독 바꿔치기(Azure A: 전부 이상 없음인 회사)", () => {
  it("전제: A는 AZ-LOG-1·AZ-NET-1·AZ-KEY-1·AZ-STO-1·AZ-STO-2가 이상 없음이다", () => {
    const r = okReport(runJson(companyJson("azure", "A")));
    for (const id of ["AZ-LOG-1", "AZ-NET-1", "AZ-KEY-1", "AZ-STO-1", "AZ-STO-2"] as const) expect(label(ruleOf(r, id)), id).toBe("clear");
  });
  it("[CC-QA-02] activityLogExports의 b2 항목을 범위 밖 b3로 바꾸면(개수 같음) AZ-LOG-1은 이상 없음이 아니어야 한다(E-05)", () => {
    const r = okReport(runJson(swapSub("A", ["activityLogExports"])));
    expect(ruleOf(r, "AZ-LOG-1").status).not.toBe("clear");
  });
  it("[CC-QA-02] 같은 바꿔치기는 일반 속성(대상 집합 = 원시 열거)도 어긴다", () => {
    const f = swapSub("A", ["activityLogExports"]);
    expect(identityViolations("azure", f, okReport(runJson(f)))).toEqual([]);
  });
  it("대조(E-06): storageAccounts를 같은 방식으로 바꾸면 스토리지 룰은 확인 불가(subscription-missing)다", () => {
    const r = okReport(runJson(swapSub("A", ["storageAccounts"])));
    for (const id of ["AZ-KEY-1", "AZ-STO-1", "AZ-STO-2", "AZ-LOG-2"] as const) expect(label(ruleOf(r, id)), id).toBe("unknown(subscription-missing)");
  });
  it("대조: nsgs·nics·publicIps를 함께 바꾸면 AZ-NET-1은 확인 불가다", () => {
    const r = okReport(runJson(swapSub("A", ["nsgs", "nics", "publicIps"])));
    expect(ruleOf(r, "AZ-NET-1").status).toBe("unknown");
  });
  it("대조: nics 하나만 바꿔도 AZ-NET-1은 이상 없음이 아니다", () => {
    for (const sec of ["nics", "publicIps", "nsgs"]) {
      const r = okReport(runJson(swapSub("A", [sec])));
      expect(NEG(ruleOf(r, "AZ-NET-1").status), sec).toBe(false);
    }
  });
});
const NEG = (s: string): boolean => s === "clear" || s === "na";

describe("FO-04 ① 리전 바꿔치기(AWS A)", () => {
  it("us-east-1 항목(보안 그룹·ENI)을 비활성 리전 eu-west-3으로 바꾸면(영수증 리전도) AWS-NET-1은 확인 불가다", () => {
    const f = companyJson("aws", "A");
    for (const sec of ["securityGroups", "networkInterfaces"]) {
      const us = (f.data[sec] as Json[]).find((p) => p.region === "us-east-1");
      us.region = "eu-west-3";
      receiptById(f, us.receipt).region = "eu-west-3";
    }
    const r = okReport(runJson(f));
    expect(label(ruleOf(r, "AWS-NET-1"))).toBe("unknown(region-missing)");
  });
});

/* ───────── 같은 대상을 두 번 넣고 하나를 뺀다(개수 · 영수증 count · 계정 요약 수 그대로) ───────── */
describe("FO-04 ① 중복 바꿔치기 — 열거 목록이 같은 대상을 두 번 담으면 그 열거는 무효여야 한다", () => {
  it("[CC-QA-15] IAM 사용자: C의 dev-kim·ex-employee(MFA 없음, 위험) 자리에 admin-lee를 복제하면 AWS-MFA-2는 이상 없음이 아니어야 한다", () => {
    const f = companyJson("aws", "C");
    const items = f.data.iamUsers.items as Json[];
    const admin = items.find((u) => u.userName === "admin-lee");
    for (const n of ["dev-kim", "ex-employee"]) items[items.findIndex((u) => u.userName === n)] = clone(admin);
    const r = okReport(runJson(f));
    expect(itemsOf(ruleOf(r, "AWS-MFA-2"))).not.toEqual(["clear:admin-lee:user-has-mfa", "clear:admin-lee:user-has-mfa", "clear:admin-lee:user-has-mfa"]);
    expect(NEG(ruleOf(r, "AWS-MFA-2").status)).toBe(false);
  });
  it("[CC-QA-15] 보안 그룹: C의 KR 보안 그룹 3개를 default 복제 3개로 바꾸면(리전 count 3 그대로) AWS-NET-1은 이상 없음이 아니어야 한다", () => {
    const f = companyJson("aws", "C");
    const kr = (f.data.securityGroups as Json[]).find((p) => p.region === "ap-northeast-2");
    const dflt = kr.items.find((s: Json) => s.groupId === "sg-0c0ffee3");
    kr.items = [clone(dflt), clone(dflt), clone(dflt)];
    expect(NEG(ruleOf(okReport(runJson(f)), "AWS-NET-1").status)).toBe(false);
  });
  it("[CC-QA-15] IAM 역할: C의 역할 3개를 서비스 연결 역할 복제 3개로 바꾸면 AWS-KEY-4는 해당 없음이 아니어야 한다", () => {
    const f = companyJson("aws", "C");
    const roles = f.data.iamRoles.value as Json[];
    f.data.iamRoles.value = [clone(roles[0]), clone(roles[0]), clone(roles[0])];
    expect(NEG(ruleOf(okReport(runJson(f)), "AWS-KEY-4").status)).toBe(false);
  });
  it("[CC-QA-15] NSG: Azure C prod의 NSG 2개(위험)를 dev NSG 복제 2개로 바꾸면 AZ-NET-1은 이상 없음이 아니어야 한다", () => {
    const f = companyJson("azure", "C");
    const prod = (f.data.nsgs as Json[]).find((p) => p.items?.some((n: Json) => n.name === "nsg-acme-jump"));
    const dev = (f.data.nsgs as Json[]).find((p) => p.items?.some((n: Json) => n.name === "nsg-acme-dev"));
    prod.items = [clone(dev.items[0]), clone(dev.items[0])];
    expect(NEG(ruleOf(okReport(runJson(f)), "AZ-NET-1").status)).toBe(false);
  });
  it("[CC-QA-15] 컨테이너: Azure C stacmeexports01의 공개 컨테이너 2개를 private-data 복제로 바꾸면 AZ-STO-2는 이상 없음이 아니어야 한다(복제 목록 = 확인 불가)", () => {
    const f = companyJson("azure", "C");
    const sa = (f.data.storageAccounts as Json[]).flatMap((p) => p.items ?? []).find((a: Json) => a.name === "stacmeexports01");
    const priv = sa.containers.value.find((c: Json) => c.name === "private-data");
    sa.containers.value = [clone(priv), clone(priv), clone(priv)];
    const r = okReport(runJson(f));
    expect(NEG(ruleOf(r, "AZ-STO-2").status)).toBe(false);
    // 그 계정의 컨테이너는 이상 없음으로 하나도 남지 않는다(복제된 private-data 3개가 '모두 봤다'를 증명하지 않는다)
    expect(ruleOf(r, "AZ-STO-2").items.filter((i) => i.status === "clear" && (i.resource.key as string).includes("stacmeexports01"))).toEqual([]);
  });
  it("대조: 버킷·스토리지 계정·구독 항목의 중복은 이미 섹션 무효(확인 불가)로 막힌다", () => {
    const a = companyJson("aws", "C");
    const b = a.data.buckets.items as Json[];
    b[0] = clone(b[2]);
    expect(ruleOf(okReport(runJson(a)), "AWS-STO-2").status).toBe("unknown");
    const z = companyJson("azure", "A");
    const prod = (z.data.storageAccounts as Json[]).find((p) => p.items?.length >= 2);
    prod.items[1] = clone(prod.items[0]);
    expect(ruleOf(okReport(runJson(z)), "AZ-STO-1").status).toBe("unknown");
  });
});

/* ───────── E-21 · CL-06: 요청했는데 보이지 않는 구독 ───────── */
describe("FO-04 · CL-06 요청 범위 밖(E-21, CR-10)", () => {
  it("[CC-QA-11] --subscriptions로 요청한 구독 b9가 목록에 없으면 범위는 증명되지 않아야 한다(빠진 구독 1)", () => {
    const f = companyJson("azure", "A");
    f.scope.subscriptionsRequested = [f.scope.subscriptions.value[0].id, f.scope.subscriptions.value[1].id, "00000000-0000-0000-0000-0000000000b9"];
    const r = okReport(runJson(f));
    expect(r.scope.proven).toBe(false);
    expect(r.scope.missing.length).toBeGreaterThan(0);
  });
  it("[CC-QA-11] 같은 경우 구독 단위 룰(AZ-LOG-1)은 이상 없음이 아니어야 한다", () => {
    const f = companyJson("azure", "A");
    f.scope.subscriptionsRequested = [f.scope.subscriptions.value[0].id, f.scope.subscriptions.value[1].id, "00000000-0000-0000-0000-0000000000b9"];
    expect(ruleOf(okReport(runJson(f)), "AZ-LOG-1").status).not.toBe("clear");
  });
  it("대조(E-24): AWS --regions로 일부 리전만 수집하면 AWS-NET-1은 확인 불가(region-missing)다", () => {
    const f = companyJson("aws", "A");
    f.scope.regionsRequested = ["ap-northeast-2"];
    f.data.securityGroups = (f.data.securityGroups as Json[]).filter((x) => x.region === "ap-northeast-2");
    f.data.networkInterfaces = (f.data.networkInterfaces as Json[]).filter((x) => x.region === "ap-northeast-2");
    expect(label(ruleOf(okReport(runJson(f)), "AWS-NET-1"))).toBe("unknown(region-missing)");
  });
});
