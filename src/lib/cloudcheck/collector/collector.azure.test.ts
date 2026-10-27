// src/lib/cloudcheck/collector/collector.azure.test.ts — Azure 수집기 shim 실행 테스트 (G4: 가짜 CLI shim 실행, 시나리오 8종 + 옵션)
// 실제 bash로 cloudcheck-azure.sh를 PATH 맨 앞의 가짜 az/date/sleep 위에서 돌린다. 데이터 평면 명령(storage container list, storage blob …)은 카탈로그에 없으므로
// 한 번이라도 부르면 '카탈로그 밖 명령'으로 잡힌다(관리 평면 container-rm만 허용).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { AZURE_CALLS } from "../contract/calls";
import {
  AZ_NIC, AZ_NSG, AZ_PIP, AZ_ST_LOGS, AZ_ST_WEB, AZ_SUB, AZ_SUB_DISABLED, AZ_SUB_FOREIGN, AZ_SUB_SECOND, AZ_TENANT, azureBase, azureCase,
} from "./__scenarios__";
import { azFail, out, withScenario } from "./__scenarios__/types";
import { commonProblems, realCalls } from "./testcommon";
import { SCRIPT_PATH, commandOf, runCollector } from "./testkit";
import type { RunResult, Scenario, ShimEntry } from "./testkit";

vi.setConfig({ testTimeout: 180_000 });
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const cache = new Map<string, RunResult>();
const run = (id: string): RunResult => {
  let r = cache.get(id);
  if (!r) { const c = azureCase(id); r = runCollector({ cloud: "azure", scenario: c.scenario, args: c.args, withoutTools: c.withoutTools }); cache.set(id, r); }
  return r;
};
const data = (r: RunResult): Json => (r.output as Json).data as Json;
const rcpts = (r: RunResult): Json[] => (r.output as Json).receipts as Json[];
const rcOf = (r: RunResult, id: string): Json => rcpts(r).find((x) => x.id === id) as Json;
const calls = (r: RunResult, cli: string): ReturnType<typeof realCalls> => realCalls(r).filter((c) => commandOf(c) === cli);
const subOf = (c: { args: readonly string[] }): string | undefined => { const i = c.args.indexOf("--subscription"); return i < 0 ? undefined : c.args[i + 1]; };
const byAccount = (items: Json[], name: string): Json => items.find((x) => x.name === name) as Json;

describe("Azure 수집기 — 시나리오 공통 검사(계약 스키마·카탈로그·영수증)", () => {
  for (const id of ["az-01-normal", "az-02-one-sub-denied", "az-03-missing-registration", "az-04-container-isolated", "az-05-throttled-429", "az-06-diag-forms", "az-07-exit-2", "az-08-foreign-tenant"]) {
    it(`${id}: 공통 위반 0`, () => {
      const r = run(id);
      expect(r.status, r.stderr).toBe(0);
      expect(commonProblems(r, "azure")).toEqual([]);
    });
  }
});

describe("① 정상", () => {
  const r = (): RunResult => run("az-01-normal");
  it("결과 파일 1개(이름은 테넌트 끝 4자리 + UTC 시각), 문 4개 수집 · mfa는 수집기 대상이 아니라 skipped", () => {
    expect(r().outputName).toBe("cloudcheck-azure-0001-20261019T031200Z.json");
    expect(r().files).toEqual([r().outputName]);
    expect(r().stdout).toBe("");
    const o = r().output as Json;
    expect(o.run).toEqual({ finishedAt: "2026-10-19T03:12:00Z", confirmed: "flag-yes", doors: { mfa: "skipped", key: "collected", net: "collected", sto: "collected", log: "collected" } });
    expect(o.collector).toMatchObject({ name: "cloudcheck-azure", version: "1.0.0", tools: { cli: "azure-cli/2.60.0" } });
    expect(o.collector.sha256).toBe(createHash("sha256").update(readFileSync(SCRIPT_PATH.azure)).digest("hex"));
  });
  it("신원: 테넌트·현재 구독·클라우드·주체 유형. UPN(이메일)은 어디에도 없다", () => {
    expect((r().output as Json).identity).toEqual({ receipt: "r-0001", tenantId: AZ_TENANT, currentSubscription: AZ_SUB, cloudName: "AzureCloud", principalType: "user" });
    expect(r().outputText).not.toContain("kim@example.com");
  });
  it("범위: 구독 3개 중 1개만 조회 대상 — 사용 불가·다른 테넌트는 사유와 함께 기록만 하고 호출하지 않는다", () => {
    const subs = (r().output as Json).scope.subscriptions.value as Json[];
    expect(subs.map((s) => [s.id, s.inScope, s.outOfScopeReason])).toEqual([[AZ_SUB, true, null], [AZ_SUB_DISABLED, false, "not-enabled"], [AZ_SUB_FOREIGN, false, "other-tenant"]]);
    expect((r().output as Json).scope.subscriptionsRequested).toBeNull();
    const used = new Set(realCalls(r()).map(subOf).filter(Boolean));
    expect([...used]).toEqual([AZ_SUB]);
    expect(r().stderr).toContain("구독 3개 중 1개를 조회합니다");
  });
  it("호출 9종이 모두 쓰였다(관리 평면 container-rm만, 데이터 평면 0)", () => {
    const used = new Set(realCalls(r()).map(commandOf));
    expect([...used].sort()).toEqual(Object.values(AZURE_CALLS).map((m) => m.cli).sort());
    expect([...used].some((c) => /storage (container list|blob)/.test(c))).toBe(false);
  });
  it("스토리지 계정: false 값을 null로 잃지 않는다 · 키 값·엔드포인트·태그는 없다", () => {
    const accts = data(r()).storageAccounts[0].items as Json[];
    const web = byAccount(accts, "stwebfiles01"), logs = byAccount(accts, "stlogsarchive02");
    expect(web).toMatchObject({ id: AZ_ST_WEB, kind: "StorageV2", location: "koreacentral", allowBlobPublicAccess: true, allowSharedKeyAccess: true, publicNetworkAccess: "Enabled", networkDefaultAction: "Allow", keyExpirationPeriodInDays: null, sasExpirationPeriod: null });
    expect(logs).toMatchObject({ allowBlobPublicAccess: false, allowSharedKeyAccess: false, publicNetworkAccess: "Disabled", networkDefaultAction: "Deny", keyExpirationPeriodInDays: 90, sasExpirationPeriod: "1.00:00:00" });
    expect(web.keyCreationTime).toEqual({ key1: "2025-01-10T00:00:00.1234567+00:00", key2: null });
    expect(data(r()).storageAccounts[0].budget).toEqual({ limit: 100, total: 2, collected: 2 });
    for (const bad of ["POISON", "blob.core.windows.net", "primaryEndpoints", "203.0.113.5"]) expect(r().outputText, bad).not.toContain(bad);
  });
  it("컨테이너와 Blob 진단 설정(value 래퍼/배열 두 형태)", () => {
    const accts = data(r()).storageAccounts[0].items as Json[];
    expect(byAccount(accts, "stwebfiles01").containers.value).toEqual([{ name: "$web", publicAccess: "None" }, { name: "assets", publicAccess: "Blob" }]);
    expect(byAccount(accts, "stwebfiles01").blobDiagnostics.value).toEqual([]);
    const d = byAccount(accts, "stlogsarchive02").blobDiagnostics.value as Json[];
    expect(d).toEqual([{ name: "blob-to-law", logs: [{ category: "StorageRead", categoryGroup: null, enabled: true }, { category: "StorageWrite", categoryGroup: null, enabled: true }, { category: "StorageDelete", categoryGroup: null, enabled: false }], destinations: { workspace: true, storage: false, eventHub: false, partner: false } }]);
  });
  it("NSG 규칙: 출발지·포트·허용 여부만(기본 규칙·목적지 주소·설명 없음), NIC·공인 IP는 연결 관계만", () => {
    const nsg = data(r()).nsgs[0].items[0];
    expect(nsg).toMatchObject({ id: AZ_NSG, name: "nsg-web", nicIds: [AZ_NIC] });
    expect(nsg.rules[0]).toEqual({ name: "allow-rdp", direction: "Inbound", access: "Allow", priority: 100, protocol: "Tcp", sourcePrefixes: ["*"], sourceAsgCount: 0, destPortRanges: ["3389"] });
    expect(nsg.rules[1]).toMatchObject({ sourcePrefixes: ["Internet", "203.0.113.0/24"], sourceAsgCount: 1, destPortRanges: ["443", "8443-8444"] });
    expect(r().outputText).not.toContain("AllowVnetInBound");
    expect(data(r()).nics[0].items[0]).toMatchObject({ id: AZ_NIC, nsgId: AZ_NSG, ipConfigs: [{ publicIpId: AZ_PIP }] });
    expect(data(r()).publicIps[0].items[0]).toEqual({ id: AZ_PIP, hasAddress: true, allocationMethod: "Static", attachedTo: `${AZ_NIC}/ipConfigurations/ipconfig1` });
    expect(r().outputText).not.toContain("203.0.113.20");
    expect(r().outputText).not.toContain("10.0.1.4");
  });
  it("활동 로그 내보내기: 범주·보내는 곳 종류만", () => {
    expect(data(r()).activityLogExports[0].items).toEqual([{ name: "activity-to-law", logs: [{ category: "Administrative", categoryGroup: null, enabled: true }, { category: "Security", categoryGroup: null, enabled: true }, { category: "Policy", categoryGroup: null, enabled: false }], destinations: { workspace: true, storage: false, eventHub: false, partner: false } }]);
  });
  it("영수증: 구독 호출에는 subscription, 계정 호출에는 resource(리소스 ID)", () => {
    const cr = rcpts(r()).filter((x) => x.call === "azure:storage.container-rm.list");
    expect(cr.map((x) => [x.resource, x.subscription])).toEqual([[AZ_ST_LOGS, AZ_SUB], [AZ_ST_WEB, AZ_SUB]]);
    expect(rcpts(r())[0]).not.toHaveProperty("subscription");
    expect(rcpts(r()).every((x) => x.at === "2026-10-19T03:12:00Z")).toBe(true);
  });
});

describe("② 구독 하나만 AuthorizationFailed", () => {
  it("그 구독의 모든 목록이 denied + items null이고 다른 구독은 정상", () => {
    const r = run("az-02-one-sub-denied");
    const storage = data(r).storageAccounts as Json[];
    expect(storage.map((s) => s.subscription)).toEqual([AZ_SUB, AZ_SUB_SECOND]);
    expect(storage[0].items).toHaveLength(2);
    expect(storage[1].items).toBeNull();
    expect(storage[1].budget).toEqual({ limit: 100, total: 0, collected: 0 });
    expect(rcOf(r, storage[1].receipt)).toMatchObject({ result: "denied", errorCode: "AuthorizationFailed", subscription: AZ_SUB_SECOND, count: null });
    for (const key of ["nsgs", "nics", "publicIps", "activityLogExports"]) expect((data(r)[key] as Json[]).find((x) => x.subscription === AZ_SUB_SECOND)?.items, key).toBeNull();
    expect((data(r).nsgs as Json[]).find((x) => x.subscription === AZ_SUB)?.items).toHaveLength(1);
    expect(r.outputText).not.toContain("does not have authorization");
  });
});

describe("③ 리소스 공급자 미등록 · ④ 특정 계정만 container-rm 거부 · ⑤ 429", () => {
  it("MissingSubscriptionRegistration → unsupported", () => {
    const r = run("az-03-missing-registration");
    const pip = data(r).publicIps[0];
    expect(pip.items).toBeNull();
    expect(rcOf(r, pip.receipt)).toMatchObject({ call: "azure:network.public-ip.list", result: "unsupported", errorCode: "MissingSubscriptionRegistration" });
  });
  it("한 계정만 container-rm이 거부돼도 다른 계정은 성공한다(INV-7 재료: resource 단위 영수증)", () => {
    const r = run("az-04-container-isolated");
    const accts = data(r).storageAccounts[0].items as Json[];
    const logs = byAccount(accts, "stlogsarchive02"), web = byAccount(accts, "stwebfiles01");
    expect(logs.containers.value).toBeNull();
    expect(rcOf(r, logs.containers.receipt)).toMatchObject({ result: "denied", errorCode: "AuthorizationFailed", resource: AZ_ST_LOGS });
    expect(web.containers.value).toHaveLength(2);
    expect(rcOf(r, web.containers.receipt)).toMatchObject({ result: "ok", resource: AZ_ST_WEB });
  });
  it("429(TooManyRequests) → throttled, 값 null", () => {
    const r = run("az-05-throttled-429");
    const nsgs = data(r).nsgs[0];
    expect(nsgs.items).toBeNull();
    expect(rcOf(r, nsgs.receipt)).toMatchObject({ result: "throttled", errorCode: "TooManyRequests", count: null });
  });
});

describe("⑥ 진단 설정 두 형태 · ⑦ 종료 코드 2", () => {
  it("{value: […]}와 […]를 모두 받는다(구독 수준은 배열, Blob 수준은 래퍼 · 빈 배열)", () => {
    const r = run("az-06-diag-forms");
    const accts = data(r).storageAccounts[0].items as Json[];
    expect(byAccount(accts, "stwebfiles01").blobDiagnostics.value).toEqual([{ name: "wrapped", logs: [{ category: "StorageRead", categoryGroup: null, enabled: true }], destinations: { workspace: false, storage: true, eventHub: false, partner: false } }]);
    const logs = byAccount(accts, "stlogsarchive02").blobDiagnostics;
    expect(logs.value).toEqual([]);
    expect(rcOf(r, logs.receipt)).toMatchObject({ result: "empty", count: 0 });
    expect(data(r).activityLogExports[0].items).toEqual([{ name: "plain-array", logs: [{ category: null, categoryGroup: "allLogs", enabled: true }], destinations: { workspace: false, storage: false, eventHub: true, partner: false } }]);
    expect(r.outputText).not.toContain("POISON");
  });
  it("종료 코드 2(파서 오류 · Code 줄 없음) → unsupported / cli-exit-2, 계정이 없으니 계정별 호출은 0", () => {
    const r = run("az-07-exit-2");
    const sa = data(r).storageAccounts[0];
    expect(sa.items).toBeNull();
    expect(rcOf(r, sa.receipt)).toMatchObject({ result: "unsupported", errorCode: "cli-exit-2" });
    expect(calls(r, "az storage container-rm list")).toHaveLength(0);
    expect(calls(r, "az monitor diagnostic-settings list")).toHaveLength(0);
  });
});

describe("⑧ 다른 테넌트 구독", () => {
  it("다른 테넌트·사용 불가 구독에는 어떤 호출도 나가지 않는다", () => {
    const r = run("az-08-foreign-tenant");
    const text = JSON.stringify(realCalls(r).map((c) => c.args));
    expect(text).not.toContain(AZ_SUB_FOREIGN);
    expect(text).not.toContain(AZ_SUB_DISABLED);
  });
  it("--subscriptions로 제한하면 나머지 구독은 not-requested로 기록하고 호출하지 않는다", () => {
    const sc = withScenario(azureBase(), { "account list": azureCase("az-02-one-sub-denied").scenario["account list"] as ShimEntry });
    const r = runCollector({ cloud: "azure", scenario: sc, args: ["--yes", "--doors", "key", "--subscriptions", AZ_SUB.toUpperCase()] });
    expect(r.status, r.stderr).toBe(0);
    const scope = (r.output as Json).scope;
    expect(scope.subscriptionsRequested).toEqual([AZ_SUB]);
    expect(scope.subscriptions.value.find((s: Json) => s.id === AZ_SUB_SECOND)).toMatchObject({ inScope: false, outOfScopeReason: "not-requested" });
    expect(scope.subscriptions.value.find((s: Json) => s.id === AZ_SUB)).toMatchObject({ inScope: true, outOfScopeReason: null });
    expect(new Set(realCalls(r).map(subOf).filter(Boolean))).toEqual(new Set([AZ_SUB]));
  });
});

describe("도구 · 확인 · 옵션", () => {
  it("jq 없음 / az 없음 → 클라우드 호출 0건으로 종료(종료 코드 4)", () => {
    const base = azureBase();
    const noJq = runCollector({ cloud: "azure", scenario: base, args: ["--yes"], withoutTools: ["jq"] });
    const noAz = runCollector({ cloud: "azure", scenario: base, args: ["--yes"], withoutTools: ["az"] });
    for (const r of [noJq, noAz]) { expect(r.status).toBe(4); expect(r.calls).toHaveLength(0); expect(r.outputName).toBeNull(); }
    expect(noJq.stderr).toContain("jq");
    expect(noAz.stderr).toContain("az");
  });
  it("비대화형인데 --yes가 없으면 신원·구독 목록 호출 2건 뒤 종료 코드 3, 파일 없음", () => {
    const r = runCollector({ cloud: "azure", scenario: azureBase(), args: [] });
    expect(r.status).toBe(3);
    expect(realCalls(r).map(commandOf)).toEqual(["az account show", "az account list"]);
    expect(r.files).toEqual([]);
    expect(r.stderr).toContain("--yes");
    expect(r.stderr).toContain(AZ_TENANT);
  });
  it("--doors net: 신원·구독 목록 + 구독별 NSG·NIC·공인 IP만", () => {
    const r = runCollector({ cloud: "azure", scenario: azureBase(), args: ["--yes", "--doors", "net"] });
    expect(r.status, r.stderr).toBe(0);
    expect(realCalls(r).map(commandOf)).toEqual(["az account show", "az account list", "az network nsg list", "az network nic list", "az network public-ip list"]);
    expect(Object.keys(data(r)).sort()).toEqual(["nics", "nsgs", "publicIps"]);
    expect((r.output as Json).run.doors).toMatchObject({ mfa: "skipped", key: "skipped", net: "collected", sto: "skipped", log: "skipped" });
    expect(commonProblems(r, "azure")).toEqual([]);
  });
  it("--doors key: 스토리지 계정 목록만 부르고 컨테이너·진단 칸은 빈 칸(목록 영수증을 가리킨다)", () => {
    const r = runCollector({ cloud: "azure", scenario: azureBase(), args: ["--yes", "--doors", "key"] });
    expect(commonProblems(r, "azure")).toEqual([]);
    expect(realCalls(r).map(commandOf)).toEqual(["az account show", "az account list", "az storage account list"]);
    const sa = data(r).storageAccounts[0];
    expect(sa.items[0].containers).toEqual({ receipt: sa.receipt, value: null });
    expect(sa.items[0].blobDiagnostics).toEqual({ receipt: sa.receipt, value: null });
  });
  it("--doors log: 스토리지 계정 + Blob 진단 + 구독 활동 로그 내보내기 (컨테이너는 부르지 않는다)", () => {
    const r = runCollector({ cloud: "azure", scenario: azureBase(), args: ["--yes", "--doors", "log"] });
    expect(commonProblems(r, "azure")).toEqual([]);
    const used = new Set(realCalls(r).map(commandOf));
    expect(used.has("az monitor diagnostic-settings list")).toBe(true);
    expect(used.has("az monitor diagnostic-settings subscription list")).toBe(true);
    expect(used.has("az storage container-rm list")).toBe(false);
    expect(used.has("az network nsg list")).toBe(false);
  });
  it("계정 120개 → 구독당 예산 100: 처음 100개만 세부 조회하고 나머지는 빈 칸", () => {
    const names = Array.from({ length: 120 }, (_, i) => `stbulk${String(i).padStart(3, "0")}`);
    const accounts = names.map((name) => ({ id: `/subscriptions/${AZ_SUB}/resourceGroups/rg-bulk/providers/Microsoft.Storage/storageAccounts/${name}`, name, kind: "StorageV2", location: "koreacentral", allowBlobPublicAccess: false }));
    const detail: Record<string, ShimEntry> = {};
    for (const a of accounts.slice(0, 100)) detail[`storage container-rm list#${a.id}@${AZ_SUB}`] = out([]);   // 101번째부터는 키가 없다 → 부르면 UNEXPECTED
    const sc = withScenario(azureBase(), { [`storage account list@${AZ_SUB}`]: out(accounts), ...detail });
    const r = runCollector({ cloud: "azure", scenario: sc, args: ["--yes", "--doors", "sto"] });
    expect(r.status, r.stderr).toBe(0);
    expect(commonProblems(r, "azure")).toEqual([]);
    const sa = data(r).storageAccounts[0];
    expect(sa.budget).toEqual({ limit: 100, total: 120, collected: 100 });
    expect(sa.items).toHaveLength(120);
    expect(calls(r, "az storage container-rm list")).toHaveLength(100);
    expect(sa.items[99].containers.receipt).not.toBe(sa.receipt);
    expect(sa.items[100].containers).toEqual({ receipt: sa.receipt, value: null });
    expect(sa.items[100].blobDiagnostics).toEqual({ receipt: sa.receipt, value: null });
    expect(r.stderr).toContain("호출 100건째");
  });
  it("구독 25개 → 예산 20: 앞의 20개만 조회하고 나머지는 not-requested로 기록", () => {
    const ids = Array.from({ length: 25 }, (_, i) => `00000000-0000-0000-0000-0000000001${String(i).padStart(2, "0")}`);
    const list = ids.map((id, i) => ({ id, name: `구독 ${i}`, state: "Enabled", tenantId: AZ_TENANT }));
    const sc: Record<string, ShimEntry | readonly ShimEntry[]> = { "account show": azureBase()["account show"], "account list": out(list) };
    for (const id of ids.slice(0, 20)) sc[`storage account list@${id}`] = out([]);
    const r = runCollector({ cloud: "azure", scenario: sc as Scenario, args: ["--yes", "--doors", "key"] });
    expect(r.status, r.stderr).toBe(0);
    expect(commonProblems(r, "azure")).toEqual([]);
    const subs = (r.output as Json).scope.subscriptions.value as Json[];
    expect(subs.filter((s) => s.inScope)).toHaveLength(20);
    expect(subs.filter((s) => s.outOfScopeReason === "not-requested").map((s) => s.id)).toEqual(ids.slice(20));
    expect(calls(r, "az storage account list")).toHaveLength(20);
  });
  it("신원 실패(로그인 안 됨) → 아무것도 수집하지 않는다(종료 코드 4)", () => {
    const r = runCollector({ cloud: "azure", scenario: withScenario(azureBase(), { "account show": { stderr: "ERROR: Please run 'az login' to setup account.\n", rc: 1 } }), args: ["--yes"] });
    expect(r.status).toBe(4);
    expect(realCalls(r)).toHaveLength(1);
    expect(r.stderr).toContain("not-logged-in");
    expect(r.outputName).toBeNull();
  });
  it("--version · --help · 알 수 없는 인자·잘못된 값(mfa는 수집기 대상이 아님)은 호출 없이 끝난다", () => {
    const base = azureBase();
    const v = runCollector({ cloud: "azure", scenario: base, args: ["--version"] });
    expect([v.status, v.stdout.trim(), v.calls.length]).toEqual([0, "cloudcheck-azure 1.0.0", 0]);
    expect(runCollector({ cloud: "azure", scenario: base, args: ["--help"] }).stdout).toContain("--subscriptions");
    for (const bad of [["--nope"], ["--doors", "mfa"], ["--doors"], ["--subscriptions", "not-a-guid"]]) {
      const r = runCollector({ cloud: "azure", scenario: base, args: ["--yes", ...bad] });
      expect(r.status, bad.join(" ")).toBe(2);
      expect(r.calls.length, bad.join(" ")).toBe(0);
    }
  });
  it("도구 버전은 로컬 조회(az version)로만 읽는다 — az --version(최신 버전을 인터넷에서 조회)은 부르지 않는다(백엔드팀장 STEP 4)", () => {
    const r = run("az-01-normal");
    expect(r.calls.filter((c) => c.tool === "az" && c.args[0] === "--version")).toEqual([]);
    expect(r.calls.filter((c) => c.tool === "az" && c.args[0] === "version").map((c) => c.args.join(" "))).toEqual(["version -o json --only-show-errors"]);
  });
  it("az 오류 코드 추출 순서: Code 줄 → ERROR: (코드) → AADSTS → az login 문구 → cli-exit-N", () => {
    const sc = (stderr: string, rc = 1): Scenario => withScenario(azureBase(), { [`network public-ip list@${AZ_SUB}`]: { stderr, rc } });
    const code = (s: Scenario): string => {
      const r = runCollector({ cloud: "azure", scenario: s, args: ["--yes", "--doors", "net"] });
      return String((rcpts(r).find((x) => x.call === "azure:network.public-ip.list") as Json).errorCode);
    };
    expect(code(sc("ERROR: (AuthorizationFailed) msg\nCode: LinkedAuthorizationFailed\nMessage: x\n"))).toBe("LinkedAuthorizationFailed");
    expect(code(sc("ERROR: (Forbidden) msg\n"))).toBe("Forbidden");
    expect(code(sc("ERROR: AADSTS70043: The refresh token has expired\n"))).toBe("AADSTS70043");
    expect(code(sc("ERROR: Please run 'az login' to setup account.\n"))).toBe("not-logged-in");
    expect(code(sc("something unexpected\n", 3))).toBe("cli-exit-3");
    expect(code(sc("ERROR: (SubscriptionRequestsThrottled) slow down\n"))).toBe("SubscriptionRequestsThrottled");
  });
});

describe("수집기가 실제로 남기는 발자국", () => {
  it("정상 시나리오: 호출 수 = 영수증 수 = 11, 문 단위 호출은 카탈로그 phases에 속한다", () => {
    const r = run("az-01-normal");
    expect(realCalls(r)).toHaveLength(11);
    expect(rcpts(r)).toHaveLength(11);
    const phasesOf = (cli: string): readonly string[] => Object.values(AZURE_CALLS).find((m) => m.cli === cli)?.phases ?? [];
    const net = [...new Set(realCalls(r).map(commandOf))].filter((c) => phasesOf(c).includes("net")).sort();
    expect(net).toEqual(["az network nic list", "az network nsg list", "az network public-ip list"]);
  });
});
