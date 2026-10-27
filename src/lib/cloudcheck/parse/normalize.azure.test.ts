// src/lib/cloudcheck/parse/normalize.azure.test.ts — buildInput(Azure): 구독 범위 · 구독별 목록 · Resource Graph/Entra CSV · 병합 · 비밀 제거 · 불변식
import { describe, expect, it } from "vitest";
import { checkInvariants } from "../contract/normalized-invariants";
import type { AzureNormalizedInput, AzureStorageAccount, PerSubscription, Slot } from "../contract/normalized";
import type { InputRecognition } from "../model/report";
import { buildInput } from "./normalize";
import { AZ_NIC, AZ_NSG, AZ_PIP, AZ_ST, OTHER_TENANT, SUB, SUB2, SUB3, TENANT, awsFile, azureFile, rec, recCsv, rgNsgCsv, rgStorageCsv } from "./testdata";
import type { AzOpts, Json } from "./testdata";

const ok = (b: ReturnType<typeof buildInput>): AzureNormalizedInput => {
  if (!b.ok || b.input.cloud !== "azure") throw new Error(`buildInput 실패: ${JSON.stringify(b.recognitions.map((r) => r.status))}`);
  expect(checkInvariants(b.input), "불변식").toEqual([]);
  return b.input;
};
const one = (o: AzOpts = {}): AzureNormalizedInput => ok(buildInput([rec(azureFile(o).file)]));
const sel = <D,>(d: { state: string; data?: D }): D => { if (d.state !== "selected") throw new Error(`문이 선택되지 않았다: ${d.state}`); return d.data as D; };
const cov = (i: AzureNormalizedInput, f: keyof AzureNormalizedInput["coverage"]) => i.coverage[f];
const fails = (rs: readonly InputRecognition[]): string[] => rs.map((r) => r.status);
const items = <T,>(s: Slot<readonly T[]>): readonly T[] => { if (s.k !== "value" && s.k !== "partial") throw new Error(`슬롯: ${s.k}`); return s.value; };
const accts = (per: readonly PerSubscription<AzureStorageAccount>[], sub = SUB): readonly AzureStorageAccount[] => items((per.find((p) => p.subscription === sub) as PerSubscription<AzureStorageAccount>).items);
const ENTRA = "userPrincipalName,isAdmin,isMfaCapable,isMfaRegistered\nkim@contoso.com,true,true,true\nlee@contoso.com,false,true,false\n";

describe("정상 파일", () => {
  const i = one();
  it("최상위 모양: 모델 · 클라우드 · 실제 모드 · 입력 요약 · 신원", () => {
    expect([i.model, i.cloud, i.mode]).toEqual(["cloudcheck.normalized/1", "azure", { kind: "real" }]);
    expect(i.inputs).toHaveLength(1);
    expect(i.inputs[0]).toMatchObject({ kind: "collector-json", via: "file", scopeProven: true, collector: { name: "cloudcheck-azure", version: "1.0.0", knownRelease: null }, schema: { id: "cloudcheck.collect/1.0", support: "exact" } });
    expect(i.inputs[0].doors).toEqual({ mfa: "absent", key: "used", net: "used", sto: "used", log: "used" });   // Azure 수집기는 mfa를 수집하지 않는다 = '건너뜀'이 아니라 '이 입력에 없음'
    expect(i.identity).toEqual({ input: 0, principalType: "entra-user", confirmed: "flag-yes", receipt: "0:r-0001", source: "collector", tenantId: TENANT, currentSubscription: SUB, cloudName: "AzureCloud" });
    expect(i.notices).toEqual({ redactions: 0, sectionIssues: [] });
  });
  it("문 선택: mfa는 absent, 나머지 넷은 이 입력에서 선택되고 기준 시각은 수집 시각", () => {
    expect(i.doors.mfa).toEqual({ state: "absent" });
    for (const d of ["key", "net", "sto", "log"] as const) expect(i.doors[d]).toMatchObject({ state: "selected", input: 0, asOf: { source: "collected-at", at: { iso: "2026-10-19T03:12:00Z" } } });
  });
  it("범위: 9개 패밀리 — mfa만 not-collected, 나머지는 완결(구독 단위)", () => {
    expect(cov(i, "azure.mfa.entra-users")).toMatchObject({ complete: false, input: null, gaps: ["not-collected"] });
    const want: Record<string, number> = {
      "azure.key.storage-accounts": 1, "azure.net.nsgs": 1, "azure.net.nics": 1, "azure.net.public-ips": 1, "azure.sto.storage-accounts": 1, "azure.sto.containers": 1, "azure.log.subscriptions": 1, "azure.log.storage-accounts": 1,
    };
    for (const [f, pop] of Object.entries(want)) {
      const c = i.coverage[f as keyof typeof i.coverage];
      expect([f, c.complete, c.population, c.present, c.gaps]).toEqual([f, true, pop, pop, []]);
    }
    expect(cov(i, "azure.key.storage-accounts").unit).toEqual({ kind: "subscriptions", covered: 1, total: 1 });   // 사용 불가 구독(not-enabled)은 모수에서 빠진다
    expect(cov(i, "azure.net.nsgs").units.map((u) => [u.unit, u.state])).toEqual([[SUB, "ok"]]);
  });
  it("구독 슬롯과 구독별 목록 — 구독 ID·리소스 ID는 소문자로 정규화한다", () => {
    const key = sel(i.doors.key);
    expect(items(key.subscriptions).map((s) => [s.id, s.inScope, s.outOfScopeReason])).toEqual([[SUB, true, null], [SUB2, false, "not-enabled"]]);
    expect(key.subscriptionsRequested).toBeNull();
    const a = accts(key.storageAccounts)[0];
    expect(a.id).toBe(AZ_ST.toLowerCase());
    expect(a.id).not.toBe(AZ_ST);
    expect(a).toMatchObject({ name: "stwebfiles01", subscription: SUB, kind: "StorageV2", location: "koreacentral" });
  });
  it("저장소 계정 사실: 공개 허용 · 공유 키 · 키 생성 시각(소수초는 버린다) · 컨테이너 · 진단 설정", () => {
    const a = accts(sel(i.doors.sto).storageAccounts)[0];
    expect(a.allowBlobPublicAccess).toMatchObject({ k: "value", value: true });
    expect(a.allowSharedKeyAccess).toMatchObject({ k: "value", value: true });
    expect(a.key1CreatedAt).toMatchObject({ k: "value", value: { iso: "2025-01-10T00:00:00Z" } });
    expect(a.key2CreatedAt).toMatchObject({ k: "value", value: null });
    expect(a.keyExpirationPeriodInDays).toMatchObject({ k: "value", value: null });
    expect(a.publicNetworkAccess).toMatchObject({ k: "value", value: "Enabled" });
    expect(a.containers).toMatchObject({ k: "value", value: [{ name: "assets", publicAccess: "Blob" }] });
    expect(a.blobDiagnostics).toMatchObject({ k: "value", value: [] });          // empty + [] = 설정 없음이 증명된 값
    expect(a.src).toMatchObject({ input: 0, receipt: "0:r-0003", csv: null });
  });
  it("네트워크: 규칙 · NIC · 공인 IP 연결 — ID는 소문자", () => {
    const net = sel(i.doors.net);
    const nsg = items(net.nsgs[0].items)[0];
    expect(nsg).toMatchObject({ id: AZ_NSG.toLowerCase(), name: "nsg-web", nicCount: 1, subnetCount: 0, nicIds: { k: "value", value: [AZ_NIC.toLowerCase()] } });
    expect(nsg.rules[0]).toMatchObject({ k: "value", value: { name: "allow-rdp", direction: "Inbound", access: "Allow", priority: 100, protocol: "Tcp", sourcePrefixes: ["*"], sourceAsgCount: 0, destPortRanges: ["3389"] } });
    const nic = items(net.nics[0].items)[0];
    expect(nic).toMatchObject({ id: AZ_NIC.toLowerCase(), nsgId: AZ_NSG.toLowerCase(), ipConfigs: [{ subnetId: null, publicIpId: AZ_PIP.toLowerCase() }] });
    const pip = items(net.publicIps[0].items)[0];
    expect(pip).toMatchObject({ id: AZ_PIP.toLowerCase(), hasAddress: true, allocationMethod: "Static", attachedTo: `${AZ_NIC}/ipConfigurations/ipconfig1`.toLowerCase() });
  });
  it("활동 로그 내보내기와 영수증 색인(구독은 소문자 · 리소스는 원문 그대로)", () => {
    const log = sel(i.doors.log);
    expect(items(log.activityLogExports[0].items)[0]).toMatchObject({ name: "activity-to-law", destinations: { workspace: true, storage: false } });
    const container = [...i.receipts.values()].find((r) => r.call === "azure:storage.container-rm.list");
    expect(container).toMatchObject({ subscription: SUB, resource: AZ_ST, result: "ok", count: 1, used: true });
    expect([...i.receipts.values()].every((r) => r.used)).toBe(true);
    expect(i.receipts.size).toBe(azureFile().file.receipts.length);
  });
  it("깊게 freeze되고 결정적이다", () => {
    expect(Object.isFrozen(i) && Object.isFrozen(i.doors) && Object.isFrozen(i.identity) && Object.isFrozen(i.coverage["azure.net.nsgs"])).toBe(true);
    const dump = (x: AzureNormalizedInput): string => JSON.stringify({ ...x, receipts: [...x.receipts] });
    expect(dump(one())).toBe(dump(i));
  });
});

describe("슬롯: 영수증 결과 → 값의 뜻", () => {
  it("컨테이너 목록 거부 → containers = missing(denied), 계정 목록은 그대로 · sto.containers 범위만 미완결", () => {
    const i = one({ mutate: (f, r) => {
      const id = r.add("azure:storage.container-rm.list", "denied", { subscription: SUB, resource: AZ_ST });
      f.data.storageAccounts[0].items[0].containers = { receipt: id, value: null };
    } });
    const a = accts(sel(i.doors.sto).storageAccounts)[0];
    expect(a.containers).toMatchObject({ k: "missing", why: "denied" });
    expect(a.allowBlobPublicAccess.k).toBe("value");
    expect(cov(i, "azure.sto.storage-accounts").complete).toBe(true);
    expect(cov(i, "azure.sto.containers")).toMatchObject({ complete: false, population: null, present: 0, gaps: ["denied"] });
  });
  it("컨테이너가 하나도 없으면(empty) value [] — 없음이 증명된 값", () => {
    const i = one({ mutate: (f, r) => {
      const id = r.add("azure:storage.container-rm.list", "empty", { subscription: SUB, resource: AZ_ST });
      f.data.storageAccounts[0].items[0].containers = { receipt: id, value: [] };
    } });
    expect(accts(sel(i.doors.sto).storageAccounts)[0].containers).toMatchObject({ k: "value", value: [] });
    expect(cov(i, "azure.sto.containers")).toMatchObject({ complete: true, present: 0, population: 0 });
  });
  it("컨테이너 목록이 잘리면 partial(truncated)", () => {
    const i = one({ mutate: (f, r) => {
      const id = r.add("azure:storage.container-rm.list", "truncated", { subscription: SUB, resource: AZ_ST, count: 1 });
      f.data.storageAccounts[0].items[0].containers = { receipt: id, value: [{ name: "assets", publicAccess: "Blob" }] };
    } });
    expect(accts(sel(i.doors.sto).storageAccounts)[0].containers).toMatchObject({ k: "partial", why: "truncated" });
    expect(cov(i, "azure.sto.containers")).toMatchObject({ complete: false, gaps: ["truncated"], present: 1 });
  });
  it("계정 목록이 거부되면 그 구독은 failed(subscription-missing) — key·sto·log 세 패밀리가 함께 미완결", () => {
    const i = one({ mutate: (f, r) => {
      const id = r.add("azure:storage.account.list", "denied", { subscription: SUB });
      f.data.storageAccounts[0] = { subscription: SUB, receipt: id, budget: { limit: 100, total: 0, collected: 0 }, items: null };
    } });
    expect(sel(i.doors.sto).storageAccounts[0].items).toMatchObject({ k: "missing", why: "denied" });
    for (const f of ["azure.key.storage-accounts", "azure.sto.storage-accounts", "azure.log.storage-accounts"] as const) {
      expect(cov(i, f), f).toMatchObject({ complete: false, population: null, gaps: ["subscription-missing"], present: 0 });
      expect(cov(i, f).units[0], f).toMatchObject({ unit: SUB, state: "failed", why: "denied" });
    }
  });
  it("계정 목록이 잘리면 partial(truncated), 예산을 넘으면 partial(budget-exceeded) + 목록 밖 계정의 세부 칸은 확인 불가", () => {
    const t = one({ mutate: (f, r) => { f.data.storageAccounts[0].receipt = r.add("azure:storage.account.list", "truncated", { subscription: SUB, count: 1 }); } });
    expect(sel(t.doors.key).storageAccounts[0].items).toMatchObject({ k: "partial", why: "truncated" });
    expect(cov(t, "azure.key.storage-accounts")).toMatchObject({ complete: false, gaps: ["truncated"], units: [{ unit: SUB, state: "partial" }] });
    const b = one({ mutate: (f, r) => {
      const e = f.data.storageAccounts[0];
      e.receipt = r.add("azure:storage.account.list", "ok", { subscription: SUB, count: 2 });
      const second = { ...e.items[0], id: e.items[0].id.replace("stwebfiles01", "stwebfiles02"), name: "stwebfiles02", containers: { receipt: e.receipt, value: null }, blobDiagnostics: { receipt: e.receipt, value: null } };
      e.items = [e.items[0], second];
      e.budget = { limit: 1, total: 2, collected: 1 };
    } });
    const list = accts(sel(b.doors.sto).storageAccounts);
    expect(sel(b.doors.sto).storageAccounts[0].items).toMatchObject({ k: "partial", why: "budget-exceeded" });
    expect(list[1].containers).toMatchObject({ k: "missing", why: "budget-exceeded" });
    expect(list[1].blobDiagnostics).toMatchObject({ k: "missing", why: "budget-exceeded" });
    expect(list[0].containers.k).toBe("value");
    expect(cov(b, "azure.sto.storage-accounts")).toMatchObject({ complete: false, gaps: ["budget-exceeded"], present: 2 });
    expect(cov(b, "azure.sto.containers").complete).toBe(false);
  });
  it("모순(실패 영수증 아래의 데이터)은 그 섹션 전체를 비우고 이슈를 남기며, 해당 범위는 구독 누락으로 미완결", () => {
    const i = one({ mutate: (f, r) => { f.data.nsgs[0].receipt = r.add("azure:network.nsg.list", "denied", { subscription: SUB }); } });
    expect(sel(i.doors.net).nsgs).toEqual([]);
    expect(i.notices.sectionIssues).toEqual([{ input: 0, door: "net", section: "nsgs", reason: "schema-section" }]);
    expect(cov(i, "azure.net.nsgs")).toMatchObject({ complete: false, gaps: ["subscription-missing"], units: [{ unit: SUB, state: "not-queried" }] });
    expect(cov(i, "azure.net.nics").complete).toBe(true);
  });
  it("영수증 참조가 끊기거나 호출·리소스·구독이 어긋나면 섹션 무효", () => {
    const bad: Array<[string, (f: Json) => void]> = [
      ["없는 영수증", (f) => { f.data.nics[0].receipt = "r-9999"; }],
      ["다른 호출", (f) => { f.data.publicIps[0].receipt = f.data.nics[0].receipt; }],
      ["다른 구독", (f) => { f.receipts.find((r: Json) => r.id === f.data.nsgs[0].receipt).subscription = SUB2; }],
      ["다른 리소스", (f) => { f.data.storageAccounts[0].items[0].containers.receipt = f.data.storageAccounts[0].items[0].blobDiagnostics.receipt; }],
      ["count 불일치", (f) => { f.receipts.find((r: Json) => r.id === f.data.nsgs[0].receipt).count = 4; }],
    ];
    for (const [name, m] of bad) {
      const i = one({ mutate: (f) => m(f) });
      expect(i.notices.sectionIssues.length, name).toBeGreaterThan(0);
      expect(i.notices.sectionIssues.every((x) => x.reason === "schema-section"), name).toBe(true);
    }
  });
  it("같은 구독·같은 계정이 두 번 나오면 섹션 무효", () => {
    const dupSub = one({ mutate: (f) => { f.data.nsgs.push({ ...f.data.nsgs[0] }); } });
    expect(dupSub.notices.sectionIssues).toEqual([{ input: 0, door: "net", section: "nsgs", reason: "schema-section" }]);
    const dupAcct = one({ mutate: (f, r) => {
      const e = f.data.storageAccounts[0];
      e.receipt = r.add("azure:storage.account.list", "ok", { subscription: SUB, count: 2 });
      e.items = [e.items[0], { ...e.items[0] }];
      e.budget = { limit: 100, total: 2, collected: 2 };
    } });
    expect(dupAcct.notices.sectionIssues.map((x) => x.section)).toContain("storageAccounts");
  });
  it("키 생성 시각이 해석되지 않으면 그 칸만 value-unrecognized · keyCreationTime 자체가 null이면 둘 다 기록 없음", () => {
    const bad = one({ mutate: (f) => { f.data.storageAccounts[0].items[0].keyCreationTime = { key1: "2025-02-30T00:00:00Z", key2: null }; } });   // 형식은 맞지만 달력에 없는 날
    const a = accts(sel(bad.doors.key).storageAccounts)[0];
    expect(a.key1CreatedAt).toMatchObject({ k: "missing", why: "value-unrecognized" });
    expect(a.key2CreatedAt).toMatchObject({ k: "value", value: null });
    const none = one({ mutate: (f) => { f.data.storageAccounts[0].items[0].keyCreationTime = null; } });
    expect(accts(sel(none.doors.key).storageAccounts)[0]).toMatchObject({ key1CreatedAt: { k: "value", value: null }, key2CreatedAt: { k: "value", value: null } });
  });
  it("요청하지 않은 문의 세부 칸은 호출되지 않았으므로 not-collected", () => {
    const i = one({ doors: { sto: "skipped", log: "skipped" } });
    expect(i.doors.sto).toEqual({ state: "skipped", inputs: [0] });
    const a = accts(sel(i.doors.key).storageAccounts)[0];
    expect(a.containers).toMatchObject({ k: "missing", why: "not-collected" });
    expect(a.blobDiagnostics).toMatchObject({ k: "missing", why: "not-collected" });
    expect(cov(i, "azure.sto.storage-accounts")).toMatchObject({ complete: false, input: null, gaps: ["not-collected"] });
    expect(cov(i, "azure.key.storage-accounts").complete).toBe(true);
    expect(i.inputs[0].doors).toEqual({ mfa: "absent", key: "used", net: "used", sto: "skipped", log: "skipped" });
  });
});

describe("구독 범위", () => {
  const scope = (f: Json, mut: (subs: Json[]) => void): void => { mut(f.scope.subscriptions.value); };
  it("요청하지 않은 구독은 not-queried(subscription-missing) — 조회한 구독의 양성은 유지", () => {
    const i = one({ mutate: (f) => {
      scope(f, (s) => { s[1] = { ...s[1], state: "Enabled", inScope: false, outOfScopeReason: "not-requested" }; });
      f.scope.subscriptionsRequested = [SUB.toUpperCase()];
    } });
    const net = sel(i.doors.net);
    expect(net.subscriptionsRequested).toEqual([SUB]);                       // 소문자로 정규화
    const c = cov(i, "azure.net.nsgs");
    expect(c).toMatchObject({ complete: false, population: null, present: 1, gaps: ["subscription-missing"], unit: { kind: "subscriptions", covered: 1, total: 2 } });
    expect(c.units.map((u) => [u.unit, u.state, u.why])).toEqual([[SUB, "ok", null], [SUB2, "not-queried", "subscription-missing"]]);
    expect(cov(i, "azure.log.subscriptions")).toMatchObject({ complete: false, gaps: ["subscription-missing"], present: 1, unit: { covered: 1, total: 2 } });
  });
  it("조회 대상인 구독의 데이터가 파일에 없으면 not-queried", () => {
    const i = one({ mutate: (f) => { scope(f, (s) => { s[1] = { ...s[1], state: "Enabled", inScope: true, outOfScopeReason: null }; }); } });
    expect(cov(i, "azure.net.nsgs")).toMatchObject({ complete: false, gaps: ["subscription-missing"], unit: { covered: 1, total: 2 } });
    // 활동 로그 패밀리도 개수가 아니라 구독 신원으로 봉인한다: 범위 안 구독의 내보내기 목록이 없으면 완결이 아니다(CC-QA-02)
    expect(cov(i, "azure.log.subscriptions")).toMatchObject({ complete: false, gaps: ["subscription-missing"], present: 1, unit: { covered: 1, total: 2 } });
    expect(cov(i, "azure.log.subscriptions").units.map((u) => [u.unit, u.state])).toEqual([[SUB, "ok"], [SUB2, "not-queried"]]);
  });
  it("다른 테넌트 · 사용 불가 구독은 모수에서 제외한다", () => {
    const i = one({ mutate: (f) => {
      scope(f, (s) => { s.push({ id: SUB3, name: "다른 회사 구독", state: "Enabled", tenantId: OTHER_TENANT, inScope: false, outOfScopeReason: "other-tenant" }); });
      f.receipts.find((r: Json) => r.id === f.scope.subscriptions.receipt).count = 3;
    } });
    expect(cov(i, "azure.net.nsgs")).toMatchObject({ complete: true, unit: { covered: 1, total: 1 } });
    expect(items(sel(i.doors.net).subscriptions)).toHaveLength(3);
  });
  it("구독 목록을 못 받으면 범위를 증명할 수 없다(scope-unproven) — 받은 목록의 양성은 유지", () => {
    const i = one({ mutate: (f, r) => { f.scope.subscriptions = { receipt: r.add("azure:account.list", "denied"), value: null }; } });
    expect(sel(i.doors.net).subscriptions).toMatchObject({ k: "missing", why: "denied" });
    expect(i.inputs[0].scopeProven).toBe(false);
    expect(cov(i, "azure.net.nsgs")).toMatchObject({ complete: false, population: null, present: 1, gaps: ["scope-unproven"], unit: { total: null } });
    expect(cov(i, "azure.log.subscriptions")).toMatchObject({ complete: false, gaps: ["denied"] });
  });
  it("구독 ID가 두 번 나오면 구독 슬롯 전체를 무효로 한다", () => {
    const i = one({ mutate: (f) => { scope(f, (s) => { s.push({ ...s[0] }); }); } });
    expect(sel(i.doors.net).subscriptions).toMatchObject({ k: "missing", why: "schema-unsupported" });
    expect(i.notices.sectionIssues.map((x) => x.section)).toContain("scope.subscriptions");
    expect(cov(i, "azure.net.nsgs").complete).toBe(false);
  });
});

describe("네트워크 세부", () => {
  it("NIC 목록이 거부되면 nics 패밀리만 미완결(nsgs·public-ips는 유지)", () => {
    const i = one({ mutate: (f, r) => { f.data.nics[0] = { subscription: SUB, receipt: r.add("azure:network.nic.list", "denied", { subscription: SUB }), items: null }; } });
    expect(sel(i.doors.net).nics[0].items).toMatchObject({ k: "missing", why: "denied" });
    expect(cov(i, "azure.net.nics")).toMatchObject({ complete: false, gaps: ["subscription-missing"] });
    expect(cov(i, "azure.net.nsgs").complete && cov(i, "azure.net.public-ips").complete).toBe(true);
  });
  it("NSG가 하나도 없으면(empty) 완결 · 모수 0", () => {
    const i = one({ mutate: (f, r) => { f.data.nsgs[0] = { subscription: SUB, receipt: r.add("azure:network.nsg.list", "empty", { subscription: SUB }), items: [] }; } });
    expect(cov(i, "azure.net.nsgs")).toMatchObject({ complete: true, population: 0, present: 0 });
    expect(items(sel(i.doors.net).nsgs[0].items)).toEqual([]);
  });
  it("활동 로그 내보내기 목록이 비어 있어도 완결(설정 없음의 증명) — 구독마다 따로", () => {
    const i = one({ mutate: (f, r) => { f.data.activityLogExports[0] = { subscription: SUB, receipt: r.add("azure:monitor.diagnostic-settings.subscription.list", "empty", { subscription: SUB }), items: [] }; } });
    expect(items(sel(i.doors.log).activityLogExports[0].items)).toEqual([]);
    expect(cov(i, "azure.log.subscriptions").complete).toBe(true);
  });
});

describe("Resource Graph CSV · Entra CSV", () => {
  it("저장소 CSV만: 테넌트는 CSV에서, 범위는 증명되지 않는다(partial · csv-scope-unproven)", () => {
    const i = ok(buildInput([recCsv(rgStorageCsv(), "arg-storage.csv", 1_792_300_000_000)]));
    expect(i.identity).toEqual({ input: 0, principalType: "unknown", confirmed: null, receipt: null, source: "csv-tenant", tenantId: TENANT, currentSubscription: null, cloudName: null });
    expect(i.inputs[0]).toMatchObject({ kind: "csv-rg-storage", scopeProven: false, collector: null, schema: null, runKey: null });
    expect(i.inputs[0].doors).toEqual({ mfa: "absent", key: "used", net: "absent", sto: "used", log: "absent" });
    const per = sel(i.doors.sto).storageAccounts;
    expect(per).toHaveLength(1);
    expect(per[0].items).toMatchObject({ k: "partial", why: "csv-scope-unproven" });
    const a = accts(per)[0];
    expect(a.allowBlobPublicAccess).toMatchObject({ k: "value", value: null, src: { csv: { kind: "csv-rg-storage", row: 2, column: "allowBlobPublicAccess" } } });   // 빈 칸 = 미설정(null)
    expect(a.allowSharedKeyAccess).toMatchObject({ k: "value", value: true });
    expect(a.key1CreatedAt).toMatchObject({ k: "value", value: { iso: "2025-01-10T00:00:00Z" } });
    expect(a.key2CreatedAt).toMatchObject({ k: "value", value: null });
    expect(a.id).toBe(AZ_ST.toLowerCase());
    for (const f of ["publicNetworkAccess", "networkDefaultAction", "containers", "blobDiagnostics"] as const) expect(a[f], f).toMatchObject({ k: "missing", why: "not-collected" });
    expect(cov(i, "azure.key.storage-accounts")).toMatchObject({ complete: false, population: null, present: 1, gaps: ["csv-scope-unproven"], unit: { kind: "csv-rows", covered: 1, total: 1 } });
    expect(cov(i, "azure.sto.containers")).toMatchObject({ complete: false, input: 0, gaps: ["not-collected"] });
    expect(cov(i, "azure.net.nsgs")).toMatchObject({ complete: false, input: null, gaps: ["not-collected"] });
    expect(i.inputs[0].asOf).toMatchObject({ source: "file-time" });
  });
  it("저장소 CSV의 칸 해석: 불리언 · 만료 일수 · 값이 이상하면 그 칸만 확인 불가", () => {
    const row = `cc-rg-storage/1,${TENANT},${AZ_ST},${SUB},rg-web,stwebfiles01,StorageV2,koreacentral,False,maybe,not-a-time,,x7,P1D`;
    const a = accts(sel(ok(buildInput([recCsv(rgStorageCsv([row]))])).doors.sto).storageAccounts)[0];
    expect(a.allowBlobPublicAccess).toMatchObject({ k: "value", value: false });
    expect(a.allowSharedKeyAccess).toMatchObject({ k: "missing", why: "value-unrecognized" });
    expect(a.key1CreatedAt).toMatchObject({ k: "missing", why: "value-unrecognized" });
    expect(a.keyExpirationPeriodInDays).toMatchObject({ k: "missing", why: "value-unrecognized" });
    expect(a.sasExpirationPeriod).toMatchObject({ k: "value", value: "P1D" });
  });
  it("저장소 CSV의 필수 열이 빠지면 읽은 계정이 없고(0건), 범위는 증명되지 않는다 — 없음으로 읽지 않는다", () => {
    const text = rgStorageCsv().split("\n").map((l) => l.split(",").filter((_, n) => n !== 8).join(",")).join("\n");   // allowBlobPublicAccess 열 제거
    const i = ok(buildInput([recCsv(text)]));
    expect(sel(i.doors.sto).storageAccounts).toEqual([]);
    expect(cov(i, "azure.sto.storage-accounts")).toMatchObject({ complete: false, present: 0, gaps: ["csv-scope-unproven"], unit: { kind: "csv-rows", covered: 0, total: 1 } });
  });
  it("모호한 행(필드 수가 다름)은 계정으로 읽지 않고 total에만 세어 covered < total", () => {
    const i = ok(buildInput([recCsv(rgStorageCsv([`cc-rg-storage/1,${TENANT},${AZ_ST},${SUB},rg-web,stwebfiles01,StorageV2,koreacentral,,true,2025-01-10T00:00:00Z,,,`, "cc-rg-storage/1,broken"]))]));
    expect(cov(i, "azure.sto.storage-accounts")).toMatchObject({ present: 1, unit: { covered: 1, total: 2 } });
  });
  it("NSG CSV만: 규칙은 행마다 · 읽지 못한 규칙 행은 missing(value-unrecognized) · NIC·공인 IP는 not-collected", () => {
    const rows = [
      `cc-rg-nsg/1,${TENANT},${AZ_NSG},${SUB},nsg-web,koreacentral,allow-rdp,Inbound,Allow,100,Tcp,*,[],3389,[],1,0`,
      `cc-rg-nsg/1,${TENANT},${AZ_NSG},${SUB},nsg-web,koreacentral,allow-web,Inbound,Allow,110,Tcp,,"[""10.0.0.0/8"",""203.0.113.0/24""]",,"[""80"",""443""]",1,0`,
      `cc-rg-nsg/1,${TENANT},${AZ_NSG},${SUB},nsg-web,koreacentral,weird,Inbound,Allow,not-a-number,Tcp,*,[],22,[],1,0`,
    ];
    const i = ok(buildInput([recCsv(rgNsgCsv(rows))]));
    expect(i.inputs[0]).toMatchObject({ kind: "csv-rg-nsg", scopeProven: false });
    expect(i.inputs[0].doors).toEqual({ mfa: "absent", key: "absent", net: "used", sto: "absent", log: "absent" });
    const net = sel(i.doors.net);
    expect(net.nics).toEqual([]);
    expect(net.publicIps).toEqual([]);
    expect(net.subscriptions).toMatchObject({ k: "missing", why: "not-collected" });
    expect(net.nsgs[0].items).toMatchObject({ k: "partial", why: "csv-scope-unproven" });
    const nsg = items(net.nsgs[0].items)[0];
    expect(nsg).toMatchObject({ id: AZ_NSG.toLowerCase(), name: "nsg-web", nicCount: 1, subnetCount: 0, nicIds: { k: "missing", why: "not-collected" } });
    expect(nsg.rules).toHaveLength(3);
    expect(nsg.rules[0]).toMatchObject({ k: "value", value: { name: "allow-rdp", priority: 100, sourcePrefixes: ["*"], destPortRanges: ["3389"], sourceAsgCount: null } });
    expect(nsg.rules[1]).toMatchObject({ k: "value", value: { name: "allow-web", sourcePrefixes: ["10.0.0.0/8", "203.0.113.0/24"], destPortRanges: ["80", "443"] } });
    expect(nsg.rules[2]).toMatchObject({ k: "missing", why: "value-unrecognized", src: { csv: { kind: "csv-rg-nsg", row: 4 } } });
    expect(cov(i, "azure.net.nsgs")).toMatchObject({ complete: false, gaps: ["csv-scope-unproven"], present: 1, unit: { kind: "csv-rows", covered: 3, total: 3 } });
    expect(cov(i, "azure.net.nics")).toMatchObject({ complete: false, input: 0, gaps: ["not-collected"] });
    expect(cov(i, "azure.net.public-ips")).toMatchObject({ complete: false, input: 0, gaps: ["not-collected"] });
  });
  it("저장소 CSV + NSG CSV는 같은 테넌트라 한 리포트(key·sto / net)", () => {
    const i = ok(buildInput([recCsv(rgStorageCsv(), "s.csv"), recCsv(rgNsgCsv(), "n.csv")]));
    expect(i.inputs.map((x) => x.doors)).toEqual([
      { mfa: "absent", key: "used", net: "absent", sto: "used", log: "absent" },
      { mfa: "absent", key: "absent", net: "used", sto: "absent", log: "absent" },
    ]);
    expect([i.doors.key, i.doors.sto, i.doors.net].map((d) => (d as { input: number }).input)).toEqual([0, 0, 1]);
  });
  it("Entra 등록 CSV: 수집기 JSON과 함께 있어야 한다 — mfa 문이 CSV에서 채워지고, 모수는 증명되지 않는다", () => {
    const i = ok(buildInput([rec(azureFile().file), recCsv(ENTRA, "registration.csv", 1_792_300_000_000)]));
    expect(i.doors.mfa).toMatchObject({ state: "selected", input: 1 });
    expect(i.inputs[1]).toMatchObject({ kind: "csv-entra-registration", scopeProven: false });
    expect(i.inputs.map((x) => x.doors.mfa)).toEqual(["absent", "used"]);
    const users = items(sel(i.doors.mfa).entraUsers);
    expect(sel(i.doors.mfa).entraUsers).toMatchObject({ k: "partial", why: "csv-scope-unproven" });
    expect(users.map((u) => [u.user, u.isAdmin, u.mfaRegistered].map((x) => (typeof x === "string" ? x : (x as { value: boolean }).value)))).toEqual([["kim@contoso.com", true, true], ["lee@contoso.com", false, false]]);
    expect(users[0].src.csv).toMatchObject({ kind: "csv-entra-registration", row: 2, column: "isMfaRegistered" });
    expect(cov(i, "azure.mfa.entra-users")).toMatchObject({ complete: false, input: 1, present: 2, gaps: ["csv-scope-unproven"], unit: { kind: "csv-rows", covered: 2, total: 2 } });
    expect(i.identity.input).toBe(0);                       // 신원은 테넌트를 아는 입력에서
  });
  it("Entra 등록 CSV만으로는 리포트를 만들 수 없다(테넌트를 모른다)", () => {
    const b = buildInput([recCsv(ENTRA, "registration.csv")]);
    expect(b.ok).toBe(false);
    expect(fails(b.recognitions)).toEqual(["not-cloudcheck"]);
  });
});

describe("다중 입력 병합", () => {
  it("수집기 JSON > Resource Graph CSV: 같은 문은 CSV가 superseded", () => {
    const b = buildInput([rec(azureFile().file), recCsv(rgStorageCsv(), "arg.csv")]);
    const i = ok(b);
    expect(i.inputs[1].doors).toEqual({ mfa: "absent", key: "superseded", net: "absent", sto: "superseded", log: "absent" });
    expect(b.recognitions[1].doors).toEqual([]);
    expect(accts(sel(i.doors.sto).storageAccounts)[0].containers.k).toBe("value");
  });
  it("수집기가 sto를 건너뛰면 CSV가 sto를 채운다(문 단위 선택) — 같은 계정이 두 출처에서 와도 섞지 않는다", () => {
    const i = ok(buildInput([rec(azureFile({ doors: { sto: "skipped" } }).file), recCsv(rgStorageCsv(), "arg.csv")]));
    expect(i.doors.key).toMatchObject({ state: "selected", input: 0 });
    expect(i.doors.sto).toMatchObject({ state: "selected", input: 1 });
    expect(i.inputs.map((x) => x.doors.sto)).toEqual(["skipped", "used"]);
    expect(i.inputs.map((x) => x.doors.key)).toEqual(["used", "superseded"]);
    expect(cov(i, "azure.sto.storage-accounts")).toMatchObject({ input: 1, complete: false, gaps: ["csv-scope-unproven"] });
    expect(cov(i, "azure.key.storage-accounts")).toMatchObject({ input: 0, complete: true });
  });
  it("--doors로 나눠 실행한 두 수집기 파일은 문 단위로 합쳐지고, 신원은 가장 최신 실행에서", () => {
    const a = azureFile({ doors: { net: "skipped", log: "skipped" }, mutate: (f) => { f.collectedAt = "2026-10-19T03:00:00Z"; } }).file;
    const b = azureFile({ doors: { key: "skipped", sto: "skipped" }, mutate: (f) => { f.collectedAt = "2026-10-19T03:05:00Z"; } }).file;
    const i = ok(buildInput([rec(a), rec(b)]));
    expect(["key", "net", "sto", "log"].map((d) => (i.doors[d as "key"] as { input: number }).input)).toEqual([0, 1, 0, 1]);
    expect(i.identity.input).toBe(1);
    expect(i.receipts.size).toBe(a.receipts.length + b.receipts.length);
  });
  it("테넌트가 다르면 합치지 않고, 대소문자만 다르면 같은 테넌트다 · 클라우드가 다르면 cloud-mismatch", () => {
    const other = azureFile({ mutate: (f) => { f.identity.tenantId = OTHER_TENANT; } }).file;
    const b = buildInput([rec(azureFile().file), rec(other, { name: "other.json" })]);
    expect([b.ok, fails(b.recognitions)]).toEqual([false, ["ok", "account-mismatch"]]);
    expect(b.recognitions[1].identityPreview).toMatchObject({ cloud: "azure", accountLast4: OTHER_TENANT.slice(-4) });
    const upper = azureFile({ mutate: (f) => { f.identity.tenantId = TENANT.toUpperCase(); f.collectedAt = "2026-10-19T03:20:00Z"; f.run.finishedAt = "2026-10-19T03:20:01Z"; } }).file;
    const c = ok(buildInput([rec(azureFile().file), rec(upper, { name: "upper.json" })]));
    expect(c.identity.tenantId).toBe(TENANT);
    const csvOther = recCsv(rgStorageCsv().replace(new RegExp(TENANT, "g"), OTHER_TENANT), "arg.csv");
    expect(fails(buildInput([rec(azureFile().file), csvOther]).recognitions)).toEqual(["ok", "account-mismatch"]);
    expect(fails(buildInput([rec(azureFile().file), rec(awsFile().file)]).recognitions)).toEqual(["ok", "cloud-mismatch"]);
    expect(fails(buildInput([rec(azureFile().file), recCsv("user,arn\nx,y\n")]).recognitions)).toEqual(["ok", "wrong-type"]);
  });
  it("같은 수집 실행이 두 번이면 뒤의 것은 superseded", () => {
    const f = azureFile().file;
    const b = buildInput([rec(f), rec(f, { name: "again.json" })]);
    const i = ok(b);
    expect(fails(b.recognitions)).toEqual(["ok", "superseded"]);
    expect(i.inputs[1].doors).toEqual({ mfa: "absent", key: "superseded", net: "superseded", sto: "superseded", log: "superseded" });
    expect([...i.receipts.values()].filter((r) => r.input === 1).every((r) => !r.used)).toBe(true);
  });
  it("체험 입력(via: demo)도 같은 길이고 실제 입력과 섞이지 않는다", () => {
    const demo = rec(azureFile().file, { via: "demo", name: "cloudcheck-demo-C.azure.json" });
    const i = ok(buildInput([demo]));
    expect(i.mode).toEqual({ kind: "demo", setId: "C" });
    expect(i.inputs[0]).toMatchObject({ via: "demo", name: "cloudcheck-demo.azure.json" });
    expect(fails(buildInput([demo, rec(azureFile().file)]).recognitions)).toEqual(["ok", "account-mismatch"]);
  });
});

describe("비밀 패턴 제거(R-12)", () => {
  const bad = "AKIAIOSFODNN7EXAMPLE";
  const REDACTED = /^\u0000cc-redacted:\d+$/;
  it("이름에 키 ID 모양이 있으면 지운 토큰으로 바뀌고 개수가 notices에 남는다(같은 원문은 1개)", () => {
    const i = one({ mutate: (f) => {
      f.data.storageAccounts[0].items[0].containers.value = [{ name: bad, publicAccess: "Blob" }];
      f.data.nsgs[0].items[0].rules[0].name = bad;
      f.scope.subscriptions.value[0].name = `${bad}-prod`;
    } });
    const dump = JSON.stringify([i.doors, [...i.receipts.values()], i.coverage]);
    expect(dump).not.toContain(bad);
    expect(items(accts(sel(i.doors.sto).storageAccounts)[0].containers)[0].name).toMatch(REDACTED);
    expect(items(sel(i.doors.net).subscriptions)[0].name).toMatch(REDACTED);
    expect(i.notices.redactions).toBe(1);               // 비밀 값은 1개: 컨테이너·규칙 이름과 구독 이름 안의 같은 키 ID
  });
  it("저장소 계정 이름 · 리소스 그룹 이름(= 리소스 ID 안)에 있어도 같다 — 영수증 resource와 항목이 같은 토큰으로 이어진다", () => {
    const id = `/subscriptions/${SUB}/resourceGroups/${bad}/providers/Microsoft.Storage/storageAccounts/stwebfiles01`;
    const i = one({ mutate: (f) => {
      for (const r of f.receipts) if (r.resource === AZ_ST) r.resource = id;
      f.data.storageAccounts[0].items[0].id = id;
      f.data.storageAccounts[0].items[0].name = bad;
    } });
    expect(JSON.stringify([i.doors, [...i.receipts.values()]])).not.toContain(bad);
    const a = accts(sel(i.doors.sto).storageAccounts)[0];
    expect(a.id).toMatch(REDACTED);
    expect(a.name).toMatch(REDACTED);
    expect(a.containers.k).toBe("value");               // 영수증 참조(resource)가 같은 토큰으로 이어져 섹션이 무효가 되지 않았다
    expect(i.notices.sectionIssues).toEqual([]);
    expect(i.notices.redactions).toBe(1);               // ID 안의 키 ID와 이름의 키 ID는 같은 값
  });
  it("같은 비밀이 두 입력에 있으면 같은 토큰(조인 유지) · 입력을 여러 번 만들어도 개수가 같다", () => {
    const mk = (collectedAt: string) => azureFile({ mutate: (f) => { f.collectedAt = collectedAt; f.data.nsgs[0].items[0].rules[0].name = bad; } }).file;
    const a = rec(mk("2026-10-19T03:00:00Z"), { name: "a.json" });
    const b = rec(mk("2026-10-19T03:05:00Z"), { name: "b.json" });
    const first = ok(buildInput([a, b]));
    const second = ok(buildInput([a, b]));
    expect(first.notices.redactions).toBe(1);
    expect(second.notices.redactions).toBe(1);
    const rule = (i: AzureNormalizedInput): string => (items(sel(i.doors.net).nsgs[0].items)[0].rules[0] as { k: "value"; value: { name: string } }).value.name;
    expect(rule(first)).toMatch(REDACTED);
    expect(rule(second)).toBe(rule(first));
  });
});

describe("시나리오 변형이 불변식을 깨지 않는다", () => {
  const variants: Array<[string, AzOpts]> = [
    ["문 일부만", { doors: { net: "skipped", log: "skipped" } }], ["sto·log 없음", { doors: { sto: "skipped", log: "skipped" } }], ["key만", { doors: { net: "skipped", sto: "skipped", log: "skipped" } }],
    ["모든 문 건너뜀", { doors: { key: "skipped", net: "skipped", sto: "skipped", log: "skipped" } }],
  ];
  for (const [name, o] of variants) it(name, () => { expect(() => ok(buildInput([rec(azureFile(o).file)]))).not.toThrow(); });
});
