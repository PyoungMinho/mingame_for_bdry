// src/lib/cloudcheck/parse/integration.test.ts — 수집기(bash, 가짜 CLI shim) → recognize → buildInput → 불변식 · 의미 · 누출
// 수집기가 실제로 만든 파일을 파서가 그대로 먹는다는 것을 시나리오(AWS 16 · Azure 8)로 확인한다. 클라우드는 부르지 않는다.
import { describe, expect, it, vi } from "vitest";
import { AWS_SCENARIOS, AZURE_SCENARIOS, POISON_MARKERS, awsCase, azureCase } from "../collector/__scenarios__";
import { runCollector } from "../collector/testkit";
import type { RunResult } from "../collector/testkit";
import type { AwsIamUser, AwsNormalizedInput, AzureNormalizedInput, NormalizedInput, Slot } from "../contract/normalized";
import { checkInvariants } from "../contract/normalized-invariants";
import type { InputRecognition } from "../model/report";
import { scanForLeaks } from "./leak-scan";
import { maskedCopy } from "./mask";
import { buildInput } from "./normalize";
import { recognize } from "./recognize";

vi.setConfig({ testTimeout: 300_000, hookTimeout: 300_000 });

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const dump = (x: unknown): string => JSON.stringify(x, (_k, v) => (v instanceof Map ? [...v] : v));
const bare = (r: InputRecognition): InputRecognition => ({ ...r, handle: null });

const runs = new Map<string, RunResult>();
function runOf(cloud: "aws" | "azure", id: string): RunResult {
  const hit = runs.get(id);
  if (hit) return hit;
  const c = cloud === "aws" ? awsCase(id) : azureCase(id);
  const r = runCollector({ cloud, scenario: c.scenario, args: c.args, withoutTools: c.withoutTools });
  runs.set(id, r);
  return r;
}
interface Loaded { readonly run: RunResult; readonly rec: InputRecognition; readonly input: NormalizedInput }
const loaded = new Map<string, Loaded>();
function load(cloud: "aws" | "azure", id: string): Loaded {
  const hit = loaded.get(id);
  if (hit) return hit;
  const run = runOf(cloud, id);
  if (run.outputText === null || run.outputName === null) throw new Error(`${id}: 결과 파일이 없다 (status ${String(run.status)})`);
  const rec = recognize({ via: "file", name: run.outputName, bytes: enc(run.outputText), lastModified: null });
  const b = buildInput([rec]);
  if (!b.ok) throw new Error(`${id}: buildInput 실패 (${b.recognitions.map((r) => r.status).join(",")})`);
  const out = { run, rec, input: b.input };
  loaded.set(id, out);
  return out;
}
const aws = (id: string): AwsNormalizedInput => { const i = load("aws", id).input; if (i.cloud !== "aws") throw new Error("aws가 아니다"); return i; };
const az = (id: string): AzureNormalizedInput => { const i = load("azure", id).input; if (i.cloud !== "azure") throw new Error("azure가 아니다"); return i; };
const sel = <D,>(d: { state: string; data?: D }): D => { if (d.state !== "selected") throw new Error(`문이 선택되지 않았다: ${d.state}`); return d.data as D; };
const val = <T,>(s: Slot<T>): T => { if (s.k !== "value" && s.k !== "partial") throw new Error(`슬롯 ${s.k}`); return s.value; };
const users = (i: AwsNormalizedInput, door: "mfa" | "key" = "mfa"): readonly AwsIamUser[] => val(door === "mfa" ? sel(i.doors.mfa).users : sel(i.doors.key).users);
const covOf = (i: NormalizedInput, f: string): Json => (i.coverage as unknown as Record<string, Json>)[f];
const gapsOf = (i: NormalizedInput): Record<string, string[]> => Object.fromEntries(Object.entries(i.coverage).filter(([, c]) => !c.complete).map(([f, c]) => [f, [...c.gaps]]));

const AWS_WITH_OUTPUT = AWS_SCENARIOS.filter((c) => !["aws-11-no-jq", "aws-12-no-aws", "aws-14-no-yes"].includes(c.id)).map((c) => c.id);
const AZ_WITH_OUTPUT = AZURE_SCENARIOS.map((c) => c.id);

describe("모든 시나리오의 결과 파일을 파서가 읽는다", () => {
  for (const id of AWS_WITH_OUTPUT) {
    it(`${id}: 인식 ok · 정규화 ok · 불변식 0 · 영수증 전부 색인`, () => {
      const { run, rec, input } = load("aws", id);
      expect(rec.status).toBe("ok");
      expect(rec.kind).toBe("collector-json");
      expect(checkInvariants(input)).toEqual([]);
      expect(input.receipts.size).toBe((run.output as Json).receipts.length);
      expect(input.notices.sectionIssues).toEqual([]);          // 수집기가 계약대로 쓰므로 읽지 못한 섹션이 없다
      expect(input.inputs[0].schema).toEqual({ id: "cloudcheck.collect/1.0", support: "exact" });
      expect(input.inputs[0].collector?.knownRelease).toBe(true);   // 배포 장부(RELEASES.json)에 있는 해시
    });
  }
  for (const id of AZ_WITH_OUTPUT) {
    it(`${id}: 인식 ok · 정규화 ok · 불변식 0 · 영수증 전부 색인`, () => {
      const { run, rec, input } = load("azure", id);
      expect(rec.status).toBe("ok");
      expect(checkInvariants(input)).toEqual([]);
      expect(input.receipts.size).toBe((run.output as Json).receipts.length);
      expect(input.notices.sectionIssues).toEqual([]);
      expect(input.inputs[0].collector?.knownRelease).toBe(true);
    });
  }
  it("결과 파일이 없는 시나리오(jq 없음 · aws 없음 · --yes 없음)는 애초에 파서에 갈 것이 없다", () => {
    for (const id of ["aws-11-no-jq", "aws-12-no-aws", "aws-14-no-yes"]) expect(runOf("aws", id).outputText, id).toBeNull();
  });
});

describe("AWS 정상 시나리오 — 수집기 출력의 뜻이 그대로 사실이 된다", () => {
  const i = (): AwsNormalizedInput => aws("aws-01-normal");
  it("신원 · 수집 방식 · 13개 범위가 모두 완결", () => {
    expect(i().identity).toMatchObject({ accountId: "111122223333", principalType: "assumed-role", principalName: "SecurityAuditRole", confirmed: "flag-yes", source: "collector", alias: { k: "value", value: "example-corp" } });
    expect(i().mode).toEqual({ kind: "real" });
    expect(gapsOf(i())).toEqual({});
    expect(Object.keys(i().coverage)).toHaveLength(13);
    expect(i().inputs[0].scopeProven).toBe(true);
  });
  it("사용자 · 키 · MFA · 그룹 · 보고서 조인", () => {
    const u = users(i(), "key");
    expect(u.map((x) => x.name)).toEqual(["alice", "build-bot"]);
    const bot = u[1];
    expect(bot.passwordEnabled).toMatchObject({ k: "value", value: false });
    expect(bot.mfaDevices).toBe(0);
    expect(val(bot.keys)[0]).toMatchObject({ slot: 1, idSuffix: "MPLE", status: "Active", lastUsedRegion: "ap-northeast-2", lastUsedService: "s3", active: { k: "value", value: true }, lastUsed: { k: "value", value: { iso: "2026-10-17T12:00:00Z" } } });
    expect(val(bot.attachedPolicyArns)).toEqual(["arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess"]);
    expect(users(i())[0].mfaDevices).toBe(1);
    expect(val(u[0].groupNames)).toEqual(["devs"]);
    expect(sel(i().doors.key).groups.map((g) => [g.name, val(g.attachedPolicyArns)])).toEqual([["devs", ["arn:aws:iam::aws:policy/ReadOnlyAccess"]]]);
  });
  it("루트: MFA 켜짐 · 루트 키 칸은 보고서만으론 확정 못 함(partial) · 루트 키 개수는 계정 요약이 권위", () => {
    const m = sel(i().doors.mfa);
    const root = val(m.root);
    expect(root.mfaActive).toMatchObject({ k: "value", value: true });
    expect(root.keys).toMatchObject({ k: "partial", why: "field-missing" });
    expect(val(m.accountSummary).accountAccessKeysPresent).toBe(0);
  });
  it("역할 신뢰 정책: 외부 계정 주체 · 외부 ID 조건 키 이름 · 서비스 연결 역할 경로", () => {
    const roles = val(sel(i().doors.key).roles);
    const partner = roles.find((r) => r.name === "partner-readonly");
    expect(val(partner!.trust)[0]).toMatchObject({ effect: "Allow", principal: { aws: ["arn:aws:iam::444455556666:root"], wildcard: false }, conditionKeys: ["StringEquals:sts:ExternalId"] });
    expect(roles.find((r) => r.name === "AWSServiceRoleForSupport")?.path).toBe("/aws-service-role/support.amazonaws.com/");
  });
  it("창문: 열린 22번 포트 · 공인 IP가 붙은 NIC · 리전별 목록", () => {
    const net = sel(i().doors.net);
    expect(val(net.regions)).toEqual(["ap-northeast-2", "us-east-1"]);
    const sg = val(net.securityGroups[0].items).find((s) => s.name === "bastion-ssh");
    expect(sg?.ingress[0]).toMatchObject({ protocol: "tcp", fromPort: 22, toPort: 22, cidrs: ["0.0.0.0/0"], ipv6Cidrs: [], prefixListIds: [] });
    const eni = val(net.networkInterfaces[0].items)[0];
    expect(eni).toMatchObject({ hasPublicIp: true, groupIds: [sg!.id], requesterManaged: false });
    expect(covOf(i(), "aws.net.security-groups")).toMatchObject({ complete: true, population: 3, unit: { kind: "regions", covered: 2, total: 2 } });
  });
  it("창고: 계정 공개 차단 설정 없음(none) · 버킷 리전은 목록 값 또는 위치 호출 · 공개 ACL · 정적 웹사이트", () => {
    const sto = sel(i().doors.sto);
    expect(sto.accountPublicAccessBlock.k).toBe("none");
    const b = val(sto.buckets);
    const assets = b.find((x) => x.name === "amzn-s3-demo-assets")!;
    const logs = b.find((x) => x.name === "amzn-s3-demo-logs")!;
    expect(assets.region).toMatchObject({ k: "value", value: "us-east-1" });           // 목록에 리전이 없어 get-bucket-location(null = us-east-1)
    expect(logs.region).toMatchObject({ k: "value", value: "ap-northeast-2" });
    expect(val(assets.acl).publicGrants).toEqual([{ grantee: "AllUsers", permission: "READ" }]);
    expect(val(assets.website)).toEqual({ enabled: true });
    expect(logs.website.k).toBe("none");
    expect(logs.policyStatus.k).toBe("none");
  });
  it("CCTV: 추적 기록 켜짐 · 이벤트 선택기", () => {
    const t = val(sel(i().doors.log).trails)[0];
    expect(t).toMatchObject({ name: "main-trail", isMultiRegion: true, homeRegion: "ap-northeast-2" });
    expect(val(t.status)).toMatchObject({ isLogging: true });
    expect(val(t.selectors).basic[0]).toMatchObject({ readWriteType: "All", includeManagementEvents: true });
  });
});

describe("AWS 실패·부분 시나리오 — 모르는 것은 모른다고 적힌다", () => {
  it("02 신원 외 전부 거부: 신원은 있고 나머지는 denied, 범위는 증명 못 함", () => {
    const x = aws("aws-02-denied-all");
    expect(x.identity.accountId).toBe("111122223333");
    expect(x.inputs[0].scopeProven).toBe(false);
    expect(Object.values(gapsOf(x)).flat().every((g) => g === "denied" || g === "scope-unproven")).toBe(true);
    expect(Object.keys(gapsOf(x))).toHaveLength(13);
    expect(sel(x.doors.sto).buckets).toMatchObject({ k: "missing", why: "denied" });
    expect(covOf(x, "aws.sto.buckets").expected).toBeNull();                   // 목록을 못 받았으면 기대 개수도 모른다(0건이 아니다)
    expect(sel(x.doors.mfa).users).toMatchObject({ k: "missing", why: "denied" });
  });
  it("03 리전 하나 거부: 그 리전만 failed, 나머지 리전의 양성은 유지", () => {
    const x = aws("aws-03-region-denied");
    expect(gapsOf(x)).toEqual({ "aws.net.security-groups": ["region-missing"] });
    expect(covOf(x, "aws.net.security-groups").units.map((u: Json) => [u.unit, u.state, u.why])).toEqual([["ap-northeast-2", "ok", null], ["us-east-1", "failed", "denied"]]);
    expect(val(sel(x.doors.net).securityGroups[0].items).some((s) => s.name === "bastion-ssh")).toBe(true);
  });
  it("04 버킷 목록 잘림: partial(truncated)", () => {
    const x = aws("aws-04-buckets-truncated");
    expect(gapsOf(x)).toEqual({ "aws.sto.buckets": ["truncated"] });
    expect(sel(x.doors.sto).buckets).toMatchObject({ k: "partial", why: "truncated" });
  });
  it("05 제한(throttled): 그 칸만 missing(throttled), 범위는 그대로 완결", () => {
    const x = aws("aws-05-throttled");
    expect(gapsOf(x)).toEqual({});
    const logs = val(sel(x.doors.sto).buckets).find((b) => b.name === "amzn-s3-demo-logs")!;
    expect(logs.acl).toMatchObject({ k: "missing", why: "throttled" });
    expect(logs.website).toMatchObject({ k: "missing", why: "throttled" });
    expect(logs.publicAccessBlock.k).toBe("value");
  });
  it("06 옛 CLI(종료 코드 252): missing(unsupported)", () => {
    const x = aws("aws-06-old-cli-252");
    const logs = val(sel(x.doors.sto).buckets).find((b) => b.name === "amzn-s3-demo-logs")!;
    expect(logs.ownership).toMatchObject({ k: "missing", why: "unsupported" });
  });
  it("07 list-users 출력이 JSON이 아님: 사용자는 보고서 행에서, 키는 보고서만으로 확정 못 함", () => {
    const x = aws("aws-07-not-json");
    expect(users(x).map((u) => u.name)).toEqual(["alice", "build-bot"]);
    expect(users(x)[0].mfaDevices).toBeNull();
    expect(users(x)[0].mfaActive).toMatchObject({ k: "value", value: true, src: { csv: { kind: "csv-credential-report", column: "mfa_active" } } });
    expect(users(x)[1].keys).toMatchObject({ k: "partial", why: "field-missing" });
    expect(users(x)[1].attachedPolicyArns).toMatchObject({ k: "missing", why: "not-collected" });
    expect(gapsOf(x)).toEqual({ "aws.key.access-keys": ["field-missing"] });
    expect(covOf(x, "aws.mfa.users")).toMatchObject({ complete: true, population: 2, expected: 2 });      // 사용자 수는 보고서 행 수 = 계정 요약으로 증명
  });
  it("08 버킷 하나만 거부(INV-7 패턴): 그 칸만 missing(denied), 목록은 완결", () => {
    const x = aws("aws-08-isolated-denial");
    expect(gapsOf(x)).toEqual({});
    const data = val(sel(x.doors.sto).buckets).find((b) => b.name === "amzn-s3-demo-data")!;
    expect(data.acl).toMatchObject({ k: "missing", why: "denied" });
    expect(data.policyStatus).toMatchObject({ k: "missing", why: "denied" });
    expect(data.publicAccessBlock.k).toBe("value");
    expect(covOf(x, "aws.sto.buckets")).toMatchObject({ complete: true, population: 3 });
  });
  it("09 보고서 생성 시간 초과: 보고서 칸은 missing(error), 실시간 사용자 목록은 그대로", () => {
    const x = aws("aws-09-report-timeout");
    expect(gapsOf(x)).toEqual({ "aws.mfa.credential-report": ["error"], "aws.mfa.root": ["error"], "aws.key.credential-report": ["error"] });
    expect(sel(x.doors.mfa).root).toMatchObject({ k: "missing", why: "error" });
    const u = users(x);
    expect(u.map((y) => y.name)).toEqual(["alice", "build-bot"]);
    expect(u[0].passwordEnabled).toMatchObject({ k: "missing", why: "error" });
    expect(u[0].mfaActive).toMatchObject({ k: "value", value: true });                  // 실시간 list-mfa-devices
    expect(val(u[1].keys)[0].lastUsed).toMatchObject({ k: "missing", why: "error" });       // 마지막 사용은 보고서가 있어야 안다 — 이유는 보고서 실패
    expect(covOf(x, "aws.mfa.credential-report")).toMatchObject({ present: 0, expected: 3 });
  });
  it("13 --doors net: 다른 문은 건너뜀, 그 범위는 not-collected(입력 번호 없음)", () => {
    const x = aws("aws-13-doors-net");
    expect(x.inputs[0].doors).toEqual({ mfa: "skipped", key: "skipped", net: "used", sto: "skipped", log: "skipped" });
    expect(x.doors.mfa).toEqual({ state: "skipped", inputs: [0] });
    expect(Object.entries(gapsOf(x)).every(([f, g]) => !f.startsWith("aws.net.") && g.length === 1 && g[0] === "not-collected")).toBe(true);
    expect(covOf(x, "aws.sto.buckets").input).toBeNull();
  });
  it("15 셸 주입 이름: 이름은 글자 그대로 데이터가 되고, 보고서의 따옴표 행과 조인된다", () => {
    const x = aws("aws-15-injection-names");
    expect(users(x).map((u) => u.name).sort()).toEqual(["$(touch PWNED)", "`touch PWNED`", "a b;touch PWNED"]);
    for (const u of users(x)) expect(u.passwordEnabled, u.name).toMatchObject({ k: "value", value: false });
    expect(val(sel(x.doors.sto).buckets)[0].name).toBe("$(touch PWNED)");
    expect(sel(x.doors.mfa).root).toMatchObject({ k: "missing", why: "field-missing" });       // 시나리오의 보고서에는 루트 행이 없다
    expect(covOf(x, "aws.mfa.users")).toMatchObject({ complete: false, gaps: ["population-mismatch"], present: 3, expected: 2 });   // 계정 요약은 2명, 목록은 3명
    expect(dump(maskedCopy(x))).not.toContain("PWNED");
  });
  it("16 사용자 200명(예산 150): 목록은 partial(budget-exceeded), 예산 밖 사용자의 세부 칸은 missing(budget-exceeded)", () => {
    const x = aws("aws-16-users-200");
    const m = sel(x.doors.mfa);
    expect(m.users).toMatchObject({ k: "partial", why: "budget-exceeded" });
    const u = val(m.users);
    expect(u).toHaveLength(200);
    expect(u[149].mfaDevices).toBe(0);                                         // 150번째까지는 실시간 호출
    expect(u[149].mfaActive).toMatchObject({ k: "value", value: false });
    expect(u[150].mfaDevices).toBeNull();
    expect(u[150].mfaActive).toMatchObject({ k: "missing", why: "budget-exceeded" });   // 예산 밖 + 보고서에도 없음 → 이유는 조회 한도
    expect(u[199].groupNames).toMatchObject({ k: "missing", why: "budget-exceeded" });
    expect(covOf(x, "aws.mfa.users")).toMatchObject({ complete: false, gaps: ["budget-exceeded"], present: 200 });
    expect(x.inputs[0].doors).toEqual({ mfa: "used", key: "skipped", net: "skipped", sto: "skipped", log: "skipped" });
  });
});

describe("AWS 독이 든 응답(10) — 읽으면 안 되는 필드는 어디에도 나오지 않는다", () => {
  const all = (): string[] => {
    const { rec, input } = load("aws", "aws-10-poison");
    return [dump(bare(rec)), dump(input), maskedCopy(input)];
  };
  it("독 표식이 정규화 결과·인식 결과·마스킹 사본에 0건", () => {
    for (const text of all()) for (const marker of POISON_MARKERS) expect(text, marker).not.toContain(marker);
  });
  it("읽어도 되는 사실은 정상으로 읽는다(보안 그룹 · ENI · 선택기)", () => {
    const x = aws("aws-10-poison");
    const sg = val(sel(x.doors.net).securityGroups[0].items).find((s) => s.name === "bastion-ssh")!;
    expect(sg.ingress[0]).toMatchObject({ cidrs: ["0.0.0.0/0"], sgRefCount: 1 });
    expect(val(sel(x.doors.net).networkInterfaces[0].items)[0].hasPublicIp).toBe(true);
    expect(covOf(x, "aws.key.roles")).toMatchObject({ complete: false, gaps: ["population-mismatch"], present: 1, expected: 2 });   // 시나리오가 역할을 1개만 돌려준다(계정 요약은 2)
  });
});

describe("Azure 시나리오", () => {
  it("01 정상: 신원 · 구독 3개 중 조회 대상 1개 · 모두 완결(mfa는 이 수집기에 없음)", () => {
    const x = az("az-01-normal");
    expect(x.identity).toMatchObject({ tenantId: "00000000-0000-0000-0000-000000000001", currentSubscription: "00000000-0000-0000-0000-000000000011", cloudName: "AzureCloud", principalType: "entra-user", confirmed: "flag-yes" });
    expect(x.inputs[0].doors).toEqual({ mfa: "absent", key: "used", net: "used", sto: "used", log: "used" });
    expect(gapsOf(x)).toEqual({ "azure.mfa.entra-users": ["not-collected"] });
    const subs = val(sel(x.doors.key).subscriptions);
    expect(subs.map((s) => [s.id.slice(-2), s.inScope, s.outOfScopeReason])).toEqual([["11", true, null], ["12", false, "not-enabled"], ["13", false, "other-tenant"]]);
    expect(covOf(x, "azure.key.storage-accounts")).toMatchObject({ complete: true, population: 2, unit: { kind: "subscriptions", covered: 1, total: 1 } });
  });
  it("01 저장소 · 네트워크 · 로그 사실", () => {
    const x = az("az-01-normal");
    const accts = val(sel(x.doors.sto).storageAccounts[0].items);
    const web = accts.find((a) => a.name === "stwebfiles01")!;
    expect(web).toMatchObject({ allowBlobPublicAccess: { k: "value", value: true }, allowSharedKeyAccess: { k: "value", value: true }, publicNetworkAccess: { k: "value", value: "Enabled" } });
    expect(web.key1CreatedAt).toMatchObject({ k: "value", value: { iso: "2025-01-10T00:00:00Z" } });
    expect(web.key2CreatedAt).toMatchObject({ k: "value", value: null });
    expect(val(web.containers).map((c) => [c.name, c.publicAccess])).toEqual([["$web", "None"], ["assets", "Blob"]]);
    expect(val(web.blobDiagnostics)).toEqual([]);
    const logs = accts.find((a) => a.name === "stlogsarchive02")!;
    expect(logs).toMatchObject({ allowBlobPublicAccess: { k: "value", value: false }, networkDefaultAction: { k: "value", value: "Deny" }, keyExpirationPeriodInDays: { k: "value", value: 90 } });
    expect(val(logs.blobDiagnostics)[0].logs.filter((l) => l.enabled).map((l) => l.category)).toEqual(["StorageRead", "StorageWrite"]);
    const net = sel(x.doors.net);
    const nsg = val(net.nsgs[0].items)[0];
    expect(nsg.rules.map((r) => val(r).name)).toEqual(["allow-rdp", "allow-https"]);
    expect(val(nsg.rules[1]).sourcePrefixes).toEqual(["Internet", "203.0.113.0/24"]);
    expect(val(nsg.nicIds)).toEqual([val(net.nics[0].items)[0].id]);
    expect(val(net.nics[0].items)[0].ipConfigs[0].publicIpId).toBe(val(net.publicIps[0].items)[0].id);
    expect(val(sel(x.doors.log).activityLogExports[0].items)[0]).toMatchObject({ name: "activity-to-law", destinations: { workspace: true, storage: false } });
  });
  it("02 구독 하나만 거부: 그 구독은 failed, 다른 구독의 양성은 유지", () => {
    const x = az("az-02-one-sub-denied");
    expect(covOf(x, "azure.key.storage-accounts")).toMatchObject({ complete: false, gaps: ["subscription-missing"], present: 2 });
    expect(covOf(x, "azure.key.storage-accounts").units.map((u: Json) => [u.unit.slice(-2), u.state, u.why])).toEqual([["11", "ok", null], ["14", "failed", "denied"]]);
    expect(covOf(x, "azure.log.subscriptions")).toMatchObject({ complete: true, population: 2 });
  });
  it("03 리소스 공급자 미등록: 공인 IP 목록만 missing(unsupported)", () => {
    const x = az("az-03-missing-registration");
    expect(sel(x.doors.net).publicIps[0].items).toMatchObject({ k: "missing", why: "unsupported" });
    expect(Object.keys(gapsOf(x)).filter((f) => f !== "azure.mfa.entra-users")).toEqual(["azure.net.public-ips"]);
  });
  it("04 컨테이너 목록 하나만 거부(INV-7 패턴): 그 계정의 containers만 missing(denied), 계정 목록은 완결", () => {
    const x = az("az-04-container-isolated");
    const logs = val(sel(x.doors.sto).storageAccounts[0].items).find((a) => a.name === "stlogsarchive02")!;
    expect(logs.containers).toMatchObject({ k: "missing", why: "denied" });
    expect(covOf(x, "azure.sto.storage-accounts").complete).toBe(true);
    expect(covOf(x, "azure.sto.containers")).toMatchObject({ complete: false, gaps: ["denied"], present: 2 });
  });
  it("05 429: NSG 목록 missing(throttled)", () => {
    const x = az("az-05-throttled-429");
    expect(sel(x.doors.net).nsgs[0].items).toMatchObject({ k: "missing", why: "throttled" });
    expect(covOf(x, "azure.net.nsgs")).toMatchObject({ complete: false, gaps: ["subscription-missing"] });
  });
  it("06 진단 설정 출력 두 형태({value: […]} · […])를 모두 읽는다", () => {
    const x = az("az-06-diag-forms");
    expect(gapsOf(x)).toEqual({ "azure.mfa.entra-users": ["not-collected"] });
    const accts = val(sel(x.doors.log).storageAccounts[0].items);
    expect(accts.every((a) => a.blobDiagnostics.k === "value")).toBe(true);
  });
  it("07 종료 코드 2: 저장소 계정 목록 missing(unsupported) → key·sto·log 세 범위 미완결", () => {
    const x = az("az-07-exit-2");
    for (const f of ["azure.key.storage-accounts", "azure.sto.storage-accounts", "azure.log.storage-accounts"]) expect(covOf(x, f), f).toMatchObject({ complete: false, gaps: ["subscription-missing"] });
  });
  it("08 다른 테넌트 · 사용 불가 구독은 범위 밖으로만 기록되고 모수에서 빠진다", () => {
    const x = az("az-08-foreign-tenant");
    expect(val(sel(x.doors.key).subscriptions).filter((s) => !s.inScope).map((s) => s.outOfScopeReason).sort()).toEqual(["not-enabled", "other-tenant"]);
    expect(covOf(x, "azure.net.nsgs").unit).toEqual({ kind: "subscriptions", covered: 1, total: 1 });
  });
});

describe("체험 모드 · 다중 입력 · 마스킹 사본", () => {
  it("같은 파일을 체험 입력(via: demo)으로 넣어도 같은 길로 정규화된다", () => {
    const { run } = load("aws", "aws-01-normal");
    const r = recognize({ via: "demo", name: "cloudcheck-demo-A.aws.json", bytes: enc(run.outputText as string), lastModified: null });
    const b = buildInput([r]);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.input.mode).toEqual({ kind: "demo", setId: "A" });
    expect(checkInvariants(b.input)).toEqual([]);
    expect(gapsOf(b.input)).toEqual({});
  });
  it("--doors로 나눠 돌린 두 결과(net / mfa)는 문 단위로 합쳐진다", () => {
    const net = load("aws", "aws-13-doors-net");
    const later = runCollector({ cloud: "aws", scenario: awsCase("aws-01-normal").scenario, args: ["--yes", "--doors", "mfa"], fakeNow: "2026-10-19T04:00:00Z" });
    const mfa = recognize({ via: "file", name: later.outputName as string, bytes: enc(later.outputText as string), lastModified: null });
    const b = buildInput([net.rec, mfa]);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    const x = b.input;
    expect(checkInvariants(x)).toEqual([]);
    expect(x.doors.net).toMatchObject({ state: "selected", input: 0 });
    expect(x.doors.mfa).toMatchObject({ state: "selected", input: 1 });
    expect(x.doors.sto).toEqual({ state: "skipped", inputs: [0, 1] });
    expect(x.identity.input).toBe(1);                                           // 신원은 더 늦게 돌린 실행에서
    expect(b.recognitions.map((r) => r.doors)).toEqual([["net"], ["mfa"]]);
  });
  it("같은 수집 실행(같은 시각)을 두 번 넣으면 하나만 쓰고 나머지는 superseded — 어느 쪽인지는 입력 순서가 아니라 내용으로 정해진다(N1)", () => {
    const a = load("aws", "aws-13-doors-net");
    const c = load("aws", "aws-16-users-200");
    const ab = buildInput([a.rec, c.rec]);                                    // shim은 시각이 고정이라 두 실행의 runKey가 같다
    const ba = buildInput([c.rec, a.rec]);
    expect(ab.ok && ba.ok).toBe(true);
    const sAb = ab.recognitions.map((r) => r.status), sBa = ba.recognitions.map((r) => r.status);
    expect([...sAb].sort()).toEqual(["ok", "superseded"]);
    expect(sBa).toEqual([...sAb].reverse());                                  // 같은 파일이 쓰이고 같은 파일이 밀려난다
  });
  it("Azure 결과 + AWS 결과는 합치지 않는다", () => {
    const b = buildInput([load("aws", "aws-01-normal").rec, load("azure", "az-01-normal").rec]);
    expect(b.ok).toBe(false);
    expect(b.recognitions.map((r) => r.status)).toEqual(["ok", "cloud-mismatch"]);
  });
  it("모든 시나리오의 마스킹 사본에는 진짜처럼 보이는 값이 없고, 원본 이름은 남지 않는다", () => {
    const originals = ["alice", "build-bot", "example-corp", "SecurityAuditRole", "amzn-s3-demo-assets", "main-trail", "bastion-ssh", "stwebfiles01", "stlogsarchive02", "예시상회", "kim@example.com"];
    for (const id of [...AWS_WITH_OUTPUT, ...AZ_WITH_OUTPUT]) {
      const cloud = id.startsWith("aws") ? "aws" : "azure";
      const text = maskedCopy(load(cloud, id).input);
      expect(scanForLeaks(text), id).toEqual([]);
      for (const o of originals) expect(text, `${id}: ${o}`).not.toContain(o);
    }
  });
  it("마스킹 사본을 만들어도 정규화 결과는 바뀌지 않는다", () => {
    const x = load("aws", "aws-08-isolated-denial").input;
    const before = dump(x);
    maskedCopy(x);
    expect(dump(x)).toBe(before);
  });
});
