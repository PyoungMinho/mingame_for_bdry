// src/lib/cloudcheck/parse/identity.test.ts — 구성원 신원 집합(memberKeys) · 중복 대상 거부 · 활동 로그 패밀리 신원 봉인 · 요청했지만 보이지 않는 구독 · 다른 계정 행 · 같은 열 이름 두 번
// (STEP 5 CC-QA-02 · 10 · 11 · 15). 개수만 맞으면 통과하던 구멍을 파서 단계에서 막는다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkInvariants } from "../contract/normalized-invariants";
import type { AwsNormalizedInput, AzureNormalizedInput, Slot } from "../contract/normalized";
import { REDACTED_PREFIX } from "../contract/normalized";
import { buildInput } from "./normalize";
import { AZ_ST, EXTERNAL, OTHER_TENANT, REPORT_HEADER, SELF, SUB, SUB2, SUB3, TENANT, awsFile, azureFile, rec, recCsv, reportCsv, rgNsgCsv, rgStorageCsv } from "./testdata";
import type { Json, Rcpts } from "./testdata";

const aws = (mut?: (f: Json, r: Rcpts) => void, csv?: string): AwsNormalizedInput => {
  const b = buildInput([rec(awsFile({ mutate: mut, csv }).file)]);
  if (!b.ok || b.input.cloud !== "aws") throw new Error("buildInput 실패");
  expect(checkInvariants(b.input)).toEqual([]);
  return b.input;
};
const az = (mut?: (f: Json, r: Rcpts) => void): AzureNormalizedInput => {
  const b = buildInput([rec(azureFile({ mutate: mut }).file)]);
  if (!b.ok || b.input.cloud !== "azure") throw new Error("buildInput 실패");
  expect(checkInvariants(b.input)).toEqual([]);
  return b.input;
};
const sel = <D,>(d: { state: string; data?: D }): D => { if (d.state !== "selected") throw new Error(`문이 선택되지 않았다: ${d.state}`); return d.data as D; };
const val = <T,>(s: Slot<T>): T => { if (s.k !== "value" && s.k !== "partial") throw new Error(`슬롯 ${s.k}`); return s.value; };
const issues = (i: AwsNormalizedInput | AzureNormalizedInput): string[] => i.notices.sectionIssues.map((x) => `${x.door}/${x.section}/${x.reason}`).sort();
const keysOf = (i: AwsNormalizedInput | AzureNormalizedInput, family: string): readonly string[] | undefined => (i.coverage as unknown as Record<string, { memberKeys?: readonly string[] }>)[family].memberKeys;
const cov = (i: AwsNormalizedInput | AzureNormalizedInput, family: string) => (i.coverage as unknown as Record<string, { complete: boolean; gaps: string[]; present: number; population: number | null; units: { unit: string; state: string }[]; unit: { covered: number | null; total: number | null } }>)[family];

describe("memberKeys — AWS 정상 파일: 패밀리마다 룰의 구성원 ID와 같은 규칙의 신원 집합", () => {
  const i = aws();
  it("사용자 · 보고서 행 · 루트 · 키 · 역할", () => {
    expect(keysOf(i, "aws.mfa.users")).toEqual(["ci-deployer", "jane.doe"]);
    expect(keysOf(i, "aws.key.users")).toEqual(["ci-deployer", "jane.doe"]);
    expect(keysOf(i, "aws.mfa.credential-report")).toEqual(["<root_account>", "ci-deployer", "jane.doe"]);
    expect(keysOf(i, "aws.mfa.root")).toEqual(["root"]);
    expect(keysOf(i, "aws.key.access-keys")).toEqual(["ci-deployer/MPLE"]);
    expect(keysOf(i, "aws.key.roles")).toEqual(["AWSServiceRoleForSupport", "vendor-access"]);
  });
  it("보안 그룹 · ENI는 리전 단위 ID라 리전을 앞에 붙인다", () => {
    expect(keysOf(i, "aws.net.security-groups")).toEqual(["ap-northeast-2/sg-0a1b2c3d4e5f60718", "us-east-1/sg-0f0e0d0c0b0a09080"]);
    expect(keysOf(i, "aws.net.enis")).toEqual(["ap-northeast-2/eni-0aaaabbbbccccdddd"]);
  });
  it("버킷 · trail · 계정 단위 패밀리", () => {
    expect(keysOf(i, "aws.sto.buckets")).toEqual(["acme-prod-data", "acme-public-assets"]);
    expect(keysOf(i, "aws.log.trails")).toEqual([`arn:aws:cloudtrail:ap-northeast-2:${SELF}:trail/acme-org-trail`]);
    expect(keysOf(i, "aws.sto.account")).toEqual([SELF]);
    expect(keysOf(i, "aws.log.account")).toEqual([SELF]);
  });
  it("집합 크기 = 모수(population)", () => {
    for (const [f, c] of Object.entries(i.coverage)) if (c.complete) expect(c.memberKeys?.length, f).toBe(c.population);
  });
  it("미완결 패밀리에는 싣지 않는다", () => {
    const x = aws((f, r) => { f.data.securityGroups[1] = { region: "us-east-1", receipt: r.add("ec2:DescribeSecurityGroups", "denied", { region: "us-east-1" }), items: null }; });
    expect(cov(x, "aws.net.security-groups").complete).toBe(false);
    expect(keysOf(x, "aws.net.security-groups")).toBeUndefined();
    expect(keysOf(x, "aws.net.enis")).toBeDefined();
  });
  it("비밀 모양으로 지운 이름은 지운 토큰 그대로 키가 된다", () => {
    const x = aws((f) => { f.data.buckets.items[0].name = "AKIA" + "ZZZZZZZZZZZZZZZZ"; f.receipts.forEach((r: Json) => { if (r.resource === "acme-public-assets") r.resource = "AKIA" + "ZZZZZZZZZZZZZZZZ"; }); });
    expect(keysOf(x, "aws.sto.buckets")?.some((k) => k.startsWith(REDACTED_PREFIX))).toBe(true);
    expect(JSON.stringify(keysOf(x, "aws.sto.buckets"))).not.toContain("AKIA");
  });
});

describe("중복 대상 거부 — AWS (CC-QA-15)", () => {
  it("사용자: 실시간 목록에 같은 사용자가 두 번이면 그 섹션은 무효, 보고서 행으로 대신한다(개수·영수증 count는 그대로)", () => {
    const x = aws((f) => { const it = f.data.iamUsers.items; it[0] = JSON.parse(JSON.stringify(it[1])); });
    expect(issues(x)).toContain("mfa/iamUsers/schema-section");
    const users = val(sel(x.doors.mfa).users);
    expect(users.map((u) => u.name)).toEqual(["jane.doe", "ci-deployer"]);        // 보고서 행의 이름(보고서 순서) — 복제된 이름이 아니다
    expect(users[0].mfaDevices).toBeNull();                                       // 실시간 호출 값은 쓰지 않았다
    expect(cov(x, "aws.mfa.users")).toMatchObject({ complete: true, population: 2 });
  });
  it("보안 그룹 · ENI: 같은 리전 목록에 같은 ID가 두 번이면 섹션 전체가 무효(리전은 not-queried)", () => {
    const sg = aws((f) => { const items = f.data.securityGroups[0].items; items.push(JSON.parse(JSON.stringify(items[0]))); f.receipts.find((r: Json) => r.id === f.data.securityGroups[0].receipt).count = 2; });
    expect(sel(sg.doors.net).securityGroups).toEqual([]);
    expect(issues(sg)).toContain("net/securityGroups/schema-section");
    expect(cov(sg, "aws.net.security-groups")).toMatchObject({ complete: false, gaps: ["region-missing"] });
    const eni = aws((f) => { const items = f.data.networkInterfaces[0].items; items.push(JSON.parse(JSON.stringify(items[0]))); f.receipts.find((r: Json) => r.id === f.data.networkInterfaces[0].receipt).count = 2; });
    expect(cov(eni, "aws.net.enis").complete).toBe(false);
  });
  it("역할 · trail · 그룹", () => {
    const roles = aws((f) => { const v = f.data.iamRoles.value; v[1] = JSON.parse(JSON.stringify(v[0])); });
    expect(sel(roles.doors.key).roles).toMatchObject({ k: "missing", why: "schema-unsupported" });
    expect(cov(roles, "aws.key.roles")).toMatchObject({ complete: false, gaps: ["schema-unsupported"] });
    const trails = aws((f, r) => { const t = f.data.trails.value; t.push(JSON.parse(JSON.stringify(t[0]))); f.receipts.find((x: Json) => x.id === f.data.trails.receipt).count = 2; void r; });
    expect(sel(trails.doors.log).trails).toMatchObject({ k: "missing", why: "schema-unsupported" });
    const groups = aws((f) => { f.data.iamGroups.push(JSON.parse(JSON.stringify(f.data.iamGroups[0]))); });
    expect(sel(groups.doors.key).groups).toEqual([]);
    expect(issues(groups)).toContain("key/iamGroups/schema-section");
  });
  it("보고서 CSV: 같은 사용자 행이 두 번이면 뒤의 행은 쓰지 않고 모호한 행으로 센다", () => {
    const csv = reportCsv([reportCsv().split("\n")[2]]);        // jane.doe 행을 한 번 더
    const x = aws(undefined, csv);
    const rep = val(sel(x.doors.mfa).credentialReport);
    expect(rep.ambiguousRows).toEqual([5]);
    expect(cov(x, "aws.mfa.credential-report")).toMatchObject({ complete: false, gaps: ["csv-row-ambiguous"] });
  });
  it("정상 파일은 중복 검사에 걸리지 않는다", () => { expect(issues(aws())).toEqual([]); });
});

describe("중복 대상 거부 — Azure (CC-QA-15)", () => {
  it("NSG · NIC · 공인 IP: 같은 ID가 두 번이면 섹션 무효(그 구독은 not-queried)", () => {
    for (const [section, family] of [["nsgs", "azure.net.nsgs"], ["nics", "azure.net.nics"], ["publicIps", "azure.net.public-ips"]] as const) {
      const x = az((f, r) => { const items = f.data[section][0].items; items.push(JSON.parse(JSON.stringify(items[0]))); f.receipts.find((q: Json) => q.id === f.data[section][0].receipt).count = 2; void r; });
      expect(sel(x.doors.net)[section], section).toEqual([]);
      expect(issues(x), section).toContain(`net/${section}/schema-section`);
      expect(cov(x, family), section).toMatchObject({ complete: false, gaps: ["subscription-missing"] });
    }
  });
  it("컨테이너: 같은 내용의 컨테이너가 두 번이면(복제) 그 계정의 컨테이너 슬롯만 무효 — 다른 사실은 그대로", () => {
    const x = az((f) => { const c = f.data.storageAccounts[0].items[0].containers; c.value.push(JSON.parse(JSON.stringify(c.value[0]))); f.receipts.find((q: Json) => q.id === c.receipt).count = 2; });
    const acct = val(sel(x.doors.sto).storageAccounts[0].items)[0];
    expect(acct.containers).toMatchObject({ k: "missing", why: "schema-unsupported" });
    expect(acct.allowBlobPublicAccess).toMatchObject({ k: "value", value: true });
    expect(issues(x)).toContain("sto/storageAccounts/schema-section");
    expect(cov(x, "azure.sto.storage-accounts").complete).toBe(true);
    expect(cov(x, "azure.sto.containers")).toMatchObject({ complete: false, gaps: ["schema-unsupported"] });
  });
  it("이름만 같고 내용이 다른 컨테이너는 서로 다른 대상으로 받는다(키는 ~2 …)", () => {
    const x = az((f) => { const c = f.data.storageAccounts[0].items[0].containers; c.value.push({ name: "assets", publicAccess: "None" }); f.receipts.find((q: Json) => q.id === c.receipt).count = 2; });
    expect(cov(x, "azure.sto.containers")).toMatchObject({ complete: true, population: 2 });
    expect(keysOf(x, "azure.sto.containers")).toEqual([`${AZ_ST.toLowerCase()}/assets`, `${AZ_ST.toLowerCase()}/assets~2`]);
  });
  it("진단 설정이 같은 내용으로 두 번이면 그 계정의 슬롯만 무효", () => {
    const x = az((f, r) => {
      const d = f.data.storageAccounts[0].items[0].blobDiagnostics;
      const one = { name: "blob-to-law", logs: [{ category: "StorageRead", categoryGroup: null, enabled: true }], destinations: { workspace: true, storage: false, eventHub: false, partner: false } };
      d.receipt = r.add("azure:monitor.diagnostic-settings.list", "ok", { subscription: SUB, resource: AZ_ST, count: 2 });
      d.value = [one, JSON.parse(JSON.stringify(one))];
    });
    const acct = val(sel(x.doors.log).storageAccounts[0].items)[0];
    expect(acct.blobDiagnostics).toMatchObject({ k: "missing", why: "schema-unsupported" });
  });
});

/** 구독 둘이 모두 범위 안인 Azure 파일(활동 로그 내보내기 항목은 두 구독 모두) */
const twoSubs = (extra?: (f: Json, r: Rcpts) => void) => (f: Json, r: Rcpts): void => {
  f.scope.subscriptions.value[1] = { ...f.scope.subscriptions.value[1], state: "Enabled", inScope: true, outOfScopeReason: null };
  const mk = (sub: string): Json => ({ subscription: sub, receipt: r.add("azure:monitor.diagnostic-settings.subscription.list", "ok", { subscription: sub, count: 1 }), items: JSON.parse(JSON.stringify(f.data.activityLogExports[0].items)) });
  f.data.activityLogExports = [f.data.activityLogExports[0], mk(SUB2)];
  extra?.(f, r);
};

describe("활동 로그 패밀리 — 구독 신원으로 봉인한다 (CC-QA-02)", () => {
  it("범위 안 구독마다 내보내기 목록이 있으면 완결, 모수의 신원은 그 구독 ID 집합", () => {
    const x = az(twoSubs());
    expect(cov(x, "azure.log.subscriptions")).toMatchObject({ complete: true, population: 2, present: 2, unit: { covered: 2, total: 2 } });
    expect(keysOf(x, "azure.log.subscriptions")).toEqual([SUB, SUB2]);
  });
  it("한 구독의 항목을 범위 밖 구독으로 바꿔치면(개수 같음) 완결이 아니다 — 섹션 무효 + 빠진 구독", () => {
    const x = az(twoSubs((f) => { f.data.activityLogExports[1].subscription = SUB3; f.receipts.find((q: Json) => q.id === f.data.activityLogExports[1].receipt).subscription = SUB3; }));
    expect(sel(x.doors.log).activityLogExports).toEqual([]);
    expect(issues(x)).toContain("log/activityLogExports/schema-section");
    expect(cov(x, "azure.log.subscriptions")).toMatchObject({ complete: false, gaps: ["subscription-missing"] });
    expect(keysOf(x, "azure.log.subscriptions")).toBeUndefined();
  });
  it("범위 안 구독의 항목이 빠져도(다른 구독 항목만 있음) 완결이 아니다", () => {
    const x = az(twoSubs((f) => { f.data.activityLogExports.pop(); }));
    expect(cov(x, "azure.log.subscriptions")).toMatchObject({ complete: false, gaps: ["subscription-missing"], present: 1 });
    expect(cov(x, "azure.log.subscriptions").units.map((u) => [u.unit, u.state])).toEqual([[SUB, "ok"], [SUB2, "not-queried"]]);
  });
  it("INV-7: 한 구독의 내보내기 목록 조회만 거부되면 모수는 그대로 완결이고, 그 구독 목록만 확인 불가(missing)다", () => {
    const x = az(twoSubs((f, r) => { f.data.activityLogExports[1] = { subscription: SUB2, receipt: r.add("azure:monitor.diagnostic-settings.subscription.list", "denied", { subscription: SUB2 }), items: null }; }));
    expect(cov(x, "azure.log.subscriptions")).toMatchObject({ complete: true, population: 2 });
    expect(sel(x.doors.log).activityLogExports[1].items).toMatchObject({ k: "missing", why: "denied" });
  });
  it("범위 목록을 받지 못하면 완결이 아니다(사유는 그 목록의 사유)", () => {
    const x = az((f, r) => { f.scope.subscriptions = { receipt: r.add("azure:account.list", "denied"), value: null }; });
    expect(cov(x, "azure.log.subscriptions")).toMatchObject({ complete: false, gaps: ["denied"] });
  });
});

describe("범위 밖 구독의 항목이 섞이면 그 섹션은 무효 (CC-QA-02 일반화)", () => {
  it("스토리지 계정 · NSG에 범위 밖 구독 항목이 있으면 그 섹션 전체가 무효", () => {
    const x = az((f, r) => {
      f.data.nsgs.push({ subscription: SUB3, receipt: r.add("azure:network.nsg.list", "empty", { subscription: SUB3 }), items: [] });
      f.data.storageAccounts.push({ subscription: SUB3, receipt: r.add("azure:storage.account.list", "empty", { subscription: SUB3 }), budget: { limit: 100, total: 0, collected: 0 }, items: [] });
    });
    expect(sel(x.doors.net).nsgs).toEqual([]);
    expect(sel(x.doors.sto).storageAccounts).toEqual([]);
    expect(issues(x)).toEqual(expect.arrayContaining(["net/nsgs/schema-section", "sto/storageAccounts/schema-section", "key/storageAccounts/schema-section", "log/storageAccounts/schema-section"]));
    expect(cov(x, "azure.net.nsgs").complete).toBe(false);
  });
});

describe("요청했지만 보이지 않는 구독 — 범위 증명이 풀린다 (CC-QA-11)", () => {
  const req = (ids: string[]) => (f: Json): void => { f.scope.subscriptionsRequested = ids; };
  it("요청 목록에 보이지 않는 구독이 있으면 빠진 구독(subscription-missing)으로 센다", () => {
    const x = az(req([SUB, SUB3]));
    for (const family of ["azure.key.storage-accounts", "azure.net.nsgs", "azure.sto.storage-accounts", "azure.log.subscriptions"]) {
      expect(cov(x, family), family).toMatchObject({ complete: false, gaps: ["subscription-missing"] });
      expect(cov(x, family).units.find((u) => u.unit === SUB3), family).toMatchObject({ state: "not-queried" });
    }
  });
  it("요청 구독이 모두 목록에 보이면 영향이 없다 · 대소문자만 다른 요청도 같은 구독", () => {
    const x = az((f) => { f.scope.subscriptionsRequested = [SUB.toUpperCase()]; });
    expect(cov(x, "azure.net.nsgs").complete).toBe(true);
    expect(sel(x.doors.net).subscriptionsRequested).toEqual([SUB]);
  });
  it("요청 목록이 없으면(전부 조회) 영향이 없다", () => { expect(cov(az(), "azure.log.subscriptions").complete).toBe(true); });
});

describe("자격증명 보고서 CSV — 다른 계정 행 · 같은 열 이름 두 번 (CC-QA-10)", () => {
  const foreignRow = `intruder,arn:aws:iam::${EXTERNAL}:user/intruder,2025-01-01T00:00:00+00:00,true,N/A,N/A,N/A,false,false,N/A,N/A,N/A,N/A,false,N/A,N/A,N/A,N/A,false,N/A,false,N/A`;
  it("CSV 파일: 다른 계정의 행은 사용자로 읽지 않고 모호한 행으로 센다 → 범위 증명 false", () => {
    const b = buildInput([recCsv(reportCsv([foreignRow]), "r.csv", 1_792_400_000_000)]);
    if (!b.ok || b.input.cloud !== "aws") throw new Error("실패");
    const x = b.input;
    expect(x.inputs[0].scopeProven).toBe(false);
    expect(val(sel(x.doors.mfa).users).map((u) => u.name)).toEqual(["jane.doe", "ci-deployer"]);
    expect(val(sel(x.doors.mfa).credentialReport).ambiguousRows).toEqual([5]);
    expect(cov(x, "aws.mfa.users")).toMatchObject({ complete: false, gaps: ["csv-row-ambiguous"] });
    expect(keysOf(x, "aws.mfa.users")).toBeUndefined();
  });
  it("계정은 루트 행 ARN으로 정한다: 앞에 다른 계정 행이 있어도 루트 행의 계정이 이 보고서의 계정이다", () => {
    const lines = reportCsv([foreignRow]).split("\n");
    const reordered = [lines[0], lines[4], ...lines.slice(1, 4), ""].join("\n");
    const b = buildInput([recCsv(reordered, "r.csv", 1_792_400_000_000)]);
    if (!b.ok) throw new Error("실패");
    expect(b.input.identity).toMatchObject({ accountId: SELF });
  });
  it("수집기 JSON 안의 보고서: 신원(계정)과 다른 계정의 행은 모호한 행", () => {
    const x = aws(undefined, reportCsv([foreignRow]));
    expect(val(sel(x.doors.mfa).credentialReport).ambiguousRows).toEqual([5]);
    expect(val(sel(x.doors.mfa).users).map((u) => u.name)).toEqual(["ci-deployer", "jane.doe"]);        // 실시간 목록은 그대로
    expect(cov(x, "aws.mfa.credential-report")).toMatchObject({ complete: false, gaps: ["csv-row-ambiguous"] });
  });
  it("같은 열 이름이 두 번이면 출처가 모호하다: 보고서는 쓰지 않고(csv-row-ambiguous) 범위 증명도 false", () => {
    const lines = reportCsv().split("\n");
    const mi = REPORT_HEADER.split(",").indexOf("mfa_active");
    const dup = lines.map((l, n) => (l === "" ? l : `${l},${n === 0 ? "mfa_active" : l.split(",")[mi] === "true" ? "false" : l.split(",")[mi]}`)).join("\n");
    const b = buildInput([recCsv(dup, "r.csv", 1_792_400_000_000)]);
    if (!b.ok || b.input.cloud !== "aws") throw new Error("실패");
    expect(b.input.inputs[0].scopeProven).toBe(false);
    expect(sel(b.input.doors.mfa).credentialReport).toMatchObject({ k: "missing", why: "csv-row-ambiguous" });
    expect(issues(b.input)).toContain("mfa/credentialReport/schema-section");
    const x = aws(undefined, dup);
    expect(sel(x.doors.mfa).credentialReport).toMatchObject({ k: "missing", why: "csv-row-ambiguous" });
  });
  it("Resource Graph CSV: 다른 테넌트의 행은 읽지 않는다 · 같은 열 이름 두 번이면 목록을 비운다", () => {
    const other = `cc-rg-storage/1,${OTHER_TENANT},${AZ_ST.replace(SUB, SUB3)},${SUB3},rg-web,stother01,StorageV2,koreacentral,,true,2025-01-10T00:00:00Z,,,`;
    const b = buildInput([recCsv(rgStorageCsv([rgStorageCsv().split("\n")[1], other]), "s.csv", 1_792_400_000_000)]);
    if (!b.ok || b.input.cloud !== "azure") throw new Error("실패");
    expect(b.input.identity.tenantId).toBe(TENANT);
    expect(sel(b.input.doors.sto).storageAccounts.flatMap((p) => val(p.items)).map((a) => a.name)).toEqual(["stwebfiles01"]);
    expect(cov(b.input, "azure.sto.storage-accounts")).toMatchObject({ complete: false, unit: { covered: 1, total: 2 } });
    const header = rgStorageCsv().split("\n");
    const dupHeader = [`${header[0]},name`, `${header[1]},zzz`, ""].join("\n");
    const d = buildInput([recCsv(dupHeader, "s.csv", 1_792_400_000_000)]);
    if (!d.ok || d.input.cloud !== "azure") throw new Error("실패");
    expect(sel(d.input.doors.sto).storageAccounts).toEqual([]);
    const n = buildInput([recCsv(`${rgNsgCsv().split("\n")[0]},nsgName\n${rgNsgCsv().split("\n")[1]},x\n`, "n.csv", 1_792_400_000_000)]);
    if (!n.ok || n.input.cloud !== "azure") throw new Error("실패");
    expect(sel(n.input.doors.net).nsgs).toEqual([]);
  });
});

// 백엔드팀장 STEP 6: 엔진(aggregate populationHolds)은 증명에 신원 집합이 없으면 '개수'만 대조한다(예전 픽스처 호환).
// 실제 입력 경로에서 그 느슨한 길이 쓰이지 않도록, 회사 8곳 수집 JSON과 보고서 CSV 4개에서 parse가 만든 완결 패밀리는 모두 신원 집합을 싣는지 못 박는다.
describe("memberKeys — 실제 입력 경로의 완결 패밀리는 빠짐없이 신원 집합을 싣는다(회사 8곳 + 보고서 CSV 4개)", () => {
  const DIR = join(__dirname, "..", "fixtures", "companies");
  const cases: [string, () => ReturnType<typeof buildInput>][] = [];
  for (const set of ["A", "B", "C", "D"]) {
    cases.push([`aws-${set}.json`, () => buildInput([rec(JSON.parse(readFileSync(join(DIR, `aws-${set}.json`), "utf8")), { name: "cloudcheck-aws-3333-20261019T031500Z.json" })])]);
    cases.push([`aws-${set}.credential-report.csv`, () => buildInput([recCsv(readFileSync(join(DIR, `aws-${set}.credential-report.csv`), "utf8"), "credential-report.csv", Date.UTC(2026, 9, 19, 3, 15))])]);
    cases.push([`azure-${set}.json`, () => buildInput([rec(JSON.parse(readFileSync(join(DIR, `azure-${set}.json`), "utf8")), { name: "cloudcheck-azure-0001-20261019T031500Z.json" })])]);
  }
  it.each(cases)("%s", (_name, make) => {
    const b = make();
    if (!b.ok) throw new Error("buildInput 실패");
    const complete = Object.entries(b.input.coverage).filter(([, c]) => c.complete);
    expect(complete.length).toBeGreaterThan(0);
    for (const [family, c] of complete) {
      expect(c.memberKeys, family).toBeDefined();
      expect(c.memberKeys?.length, family).toBe(c.population);
    }
  });
});
