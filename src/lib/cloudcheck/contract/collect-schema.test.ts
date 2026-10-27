// src/lib/cloudcheck/contract/collect-schema.test.ts — G0 계약 스모크(방향서 §4-9)
// 받아야 함(정상 AWS·Azure·스키마 2.0의 '모양'·정상 예외 파일은 exceptions-schema.test.ts) / 거부해야 함 / 값 검사.
// 이 테스트는 '모양'만 본다. 영수증 참조 연결·섹션별 safeParse·비밀 패턴은 parse/ 단계의 일이다(§4-5).
import { describe, expect, it } from "vitest";
import { DOORS, RULE_IDS } from "../model/report";
import { AWS_CALLS, AWS_CALL_IDS, AZURE_CALLS, AZURE_CALL_IDS } from "./calls";
import {
  AwsCollectFile, AzureCollectFile, CollectFile, LIMITS, RESULTS, SCHEMA_RE, SUPPORTED, runKey,
} from "./collect-schema";

type Json = Record<string, unknown>;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/* ───────── 정상 파일(문서 표본 값만) ───────── */
const T = "2026-10-19T03:12:00Z";
const SUB = "00000000-0000-0000-0000-000000000011";
const TENANT = "00000000-0000-0000-0000-00000000000A";   // 대문자 16진수도 받는다(runKey가 소문자로 만든다)
const rc = (id: number, call: string, result: string, o: Json = {}): Json => ({
  id: `r-${String(id).padStart(4, "0")}`, call, region: "global", resource: null, result,
  count: null, errorCode: null, at: T, ...o,
});
const rid = (n: number): string => `r-${String(n).padStart(4, "0")}`;
const PAB = { blockPublicAcls: true, ignorePublicAcls: true, blockPublicPolicy: true, restrictPublicBuckets: true };
const CSV = "user,arn,user_creation_time,password_enabled,password_last_used,mfa_active\n<root_account>,arn:aws:iam::111122223333:root,2020-01-01T00:00:00+00:00,not_supported,no_information,TRUE\n";

/** ok · empty · denied · notconfigured · truncated를 모두 섞은 AWS 파일. IAM 사용자명이 __proto__ */
const awsFile = (): Json => ({
  schema: "cloudcheck.collect/1.0",
  collector: { name: "cloudcheck-aws", version: "1.0.0", sha256: null, tools: { cli: "aws-cli/2.17.0", jq: "jq-1.6", bash: "5.2.15" } },
  collectedAt: T,
  run: { finishedAt: T, confirmed: "interactive", doors: { mfa: "collected", key: "collected", net: "skipped", sto: "collected", log: "skipped" } },
  cloud: "aws",
  identity: { receipt: rid(1), accountId: "111122223333", partition: "aws", principalType: "assumed-role", principalName: "SecurityAuditRole", alias: { receipt: rid(2), value: "example-corp" } },
  scope: { regions: { receipt: rid(3), value: ["ap-northeast-2", "us-east-1"] }, regionsRequested: null },
  receipts: [
    rc(1, "sts:GetCallerIdentity", "ok"),
    rc(2, "iam:ListAccountAliases", "ok", { count: 1 }),
    rc(3, "ec2:DescribeRegions", "ok", { count: 2 }),
    rc(4, "iam:GenerateCredentialReport", "ok"),
    rc(5, "iam:GetCredentialReport", "ok"),
    rc(6, "iam:GetAccountSummary", "ok"),
    rc(7, "iam:ListUsers", "ok", { count: 1 }),
    rc(8, "iam:ListMFADevices", "empty", { resource: "__proto__", count: 0 }),
    rc(9, "iam:ListAccessKeys", "denied", { resource: "__proto__", errorCode: "AccessDenied" }),
    rc(10, "iam:ListAttachedUserPolicies", "ok", { resource: "__proto__", count: 1 }),
    rc(11, "iam:ListGroupsForUser", "empty", { resource: "__proto__", count: 0 }),
    rc(12, "s3:GetAccountPublicAccessBlock", "notconfigured", { errorCode: "NoSuchPublicAccessBlockConfiguration" }),
    rc(13, "s3:ListAllMyBuckets", "truncated", { count: 1 }),
    rc(14, "s3:GetBucketPublicAccessBlock", "ok", { region: "ap-northeast-2", resource: "amzn-s3-demo-bucket" }),
    rc(15, "s3:GetBucketPolicyStatus", "notconfigured", { region: "ap-northeast-2", resource: "amzn-s3-demo-bucket", errorCode: "NoSuchBucketPolicy" }),
    rc(16, "s3:GetBucketAcl", "ok", { region: "ap-northeast-2", resource: "amzn-s3-demo-bucket" }),
    rc(17, "s3:GetBucketOwnershipControls", "ok", { region: "ap-northeast-2", resource: "amzn-s3-demo-bucket" }),
    rc(18, "s3:GetBucketWebsite", "notconfigured", { region: "ap-northeast-2", resource: "amzn-s3-demo-bucket", errorCode: "NoSuchWebsiteConfiguration" }),
  ],
  data: {
    credentialReport: { generateReceipt: rid(4), receipt: rid(5), value: { generatedTime: "2026-10-19T03:11:58+00:00", format: "text/csv", csv: CSV } },
    accountSummary: { receipt: rid(6), value: { Users: 1, Groups: 0, Roles: 3, AccountMFAEnabled: 1, AccountAccessKeysPresent: 0, AccountSigningCertificatesPresent: 0, MFADevicesInUse: 1 } },
    iamUsers: {
      receipt: rid(7), budget: { limit: 150, total: 1, collected: 1 },
      items: [{
        userName: "__proto__", createDate: "2025-03-02T01:00:00+00:00", passwordLastUsed: null,
        accessKeys: { receipt: rid(9), value: null },
        mfaDevices: { receipt: rid(8), value: { count: 0 } },
        attachedPolicyArns: { receipt: rid(10), value: ["arn:aws:iam::aws:policy/ReadOnlyAccess"] },
        groupNames: { receipt: rid(11), value: [] },
      }],
    },
    accountPublicAccessBlock: { receipt: rid(12), value: null },
    buckets: {
      receipt: rid(13), budget: { limit: 300, total: 1, collected: 1 },
      items: [{
        name: "amzn-s3-demo-bucket", createDate: "2022-05-01T00:00:00.000Z",
        region: { value: "ap-northeast-2", source: "list", receipt: null },
        publicAccessBlock: { receipt: rid(14), value: PAB },
        policyStatus: { receipt: rid(15), value: null },
        acl: { receipt: rid(16), value: { publicGrants: [{ grantee: "AllUsers", permission: "READ" }] } },
        ownership: { receipt: rid(17), value: { objectOwnership: "BucketOwnerEnforced" } },
        website: { receipt: rid(18), value: null },
      }],
    },
  },
});

/** 리소스 ID 경로가 소문자 resourcegroups인 Azure 파일 */
const azId = (rest: string): string => `/subscriptions/${SUB}/resourcegroups/rg-web/providers/${rest}`;
const azFile = (): Json => ({
  schema: "cloudcheck.collect/1.0",
  collector: { name: "cloudcheck-azure", version: "1.0.0", sha256: null, tools: { cli: "azure-cli 2.60.0", jq: "jq-1.6", bash: "5.2.15" } },
  collectedAt: T,
  run: { finishedAt: T, confirmed: "flag-yes", doors: { mfa: "skipped", key: "collected", net: "collected", sto: "collected", log: "skipped" } },
  cloud: "azure",
  identity: { receipt: rid(1), tenantId: TENANT, currentSubscription: SUB, cloudName: "AzureCloud", principalType: "user" },
  scope: {
    subscriptions: { receipt: rid(2), value: [{ id: SUB, name: "구독 예시", state: "Enabled", tenantId: TENANT, inScope: true, outOfScopeReason: null }] },
    subscriptionsRequested: null,
  },
  receipts: [
    { id: rid(1), call: "azure:account.show", result: "ok", count: null, errorCode: null, at: T },
    { id: rid(2), call: "azure:account.list", result: "ok", count: 1, errorCode: null, at: T },
    { id: rid(3), call: "azure:storage.account.list", subscription: SUB, result: "ok", count: 1, errorCode: null, at: T },
    { id: rid(4), call: "azure:storage.container-rm.list", subscription: SUB, resource: azId("microsoft.storage/storageaccounts/stwebfiles01"), result: "denied", count: null, errorCode: "AuthorizationFailed", at: T },
    { id: rid(5), call: "azure:network.nsg.list", subscription: SUB, result: "ok", count: 1, errorCode: null, at: T },
  ],
  data: {
    storageAccounts: [{
      subscription: SUB, receipt: rid(3), budget: { limit: 100, total: 1, collected: 1 },
      items: [{
        id: azId("microsoft.storage/storageaccounts/stwebfiles01"), name: "stwebfiles01", kind: "StorageV2", location: "koreacentral",
        allowBlobPublicAccess: null, allowSharedKeyAccess: true,
        keyCreationTime: { key1: "2025-01-10T00:00:00.1234567Z", key2: null },
        keyExpirationPeriodInDays: null, sasExpirationPeriod: null, publicNetworkAccess: "Enabled", networkDefaultAction: "Allow",
        containers: { receipt: rid(4), value: null },
        blobDiagnostics: { receipt: rid(3), value: null },
      }],
    }],
    nsgs: [{
      subscription: SUB, receipt: rid(5),
      items: [{
        id: azId("microsoft.network/networksecuritygroups/nsg-web"), name: "nsg-web", location: "koreacentral",
        rules: [{ name: "allow-rdp", direction: "Inbound", access: "Allow", priority: 100, protocol: "Tcp", sourcePrefixes: ["*"], sourceAsgCount: 0, destPortRanges: ["3389"] }],
        nicIds: [], subnetIds: [],
      }],
    }],
  },
});

/** 객체 안의 경로(점 표기, 배열 인덱스 포함)에 값을 써서 변형한 사본을 돌려준다 */
function mutate(base: Json, path: string, value: unknown): Json {
  const out = clone(base);
  const parts = path.split(".");
  let cur: Record<string, unknown> = out;
  for (const p of parts.slice(0, -1)) cur = (Array.isArray(cur) ? (cur as unknown as Record<string, unknown>)[p] : cur[p]) as Record<string, unknown>;
  const last = parts[parts.length - 1];
  if (value === undefined) delete cur[last]; else cur[last] = value;
  return out;
}

describe("수집 계약 v1.0 — 받아야 함", () => {
  it("정상 AWS 파일(__proto__ 사용자, ok·empty·denied·notconfigured·truncated 혼합)", () => {
    const r = AwsCollectFile.safeParse(awsFile());
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
    expect(CollectFile.safeParse(awsFile()).success).toBe(true);
    // 영수증 결과 5종이 실제로 섞여 있는지(테스트 자체의 검증)
    const results = new Set((awsFile().receipts as Json[]).map((x) => x.result));
    expect([...results].sort()).toEqual(["denied", "empty", "notconfigured", "ok", "truncated"]);
  });

  it("정상 Azure 파일(리소스 ID 경로가 resourcegroups 소문자)", () => {
    const r = AzureCollectFile.safeParse(azFile());
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
    expect(CollectFile.safeParse(azFile()).success).toBe(true);
  });

  it("스키마 2.0 파일도 '모양'은 통과한다(메이저 거부는 파싱 단계의 일)", () => {
    const f = mutate(awsFile(), "schema", "cloudcheck.collect/2.0");
    expect(AwsCollectFile.safeParse(f).success).toBe(true);
  });

  it("수집하지 않은 문의 data 섹션은 없어도 된다(.partial)", () => {
    const f = mutate(awsFile(), "data", {});
    expect(AwsCollectFile.safeParse(f).success).toBe(true);
  });
});

describe("수집 계약 v1.0 — 거부해야 함", () => {
  /** [이름, 변형 파일, 클라우드, 첫 이슈가 가리켜야 하는 경로(접두)] — 엉뚱한 이유로 거부되는 것을 막는다 */
  const cases: ReadonlyArray<readonly [string, () => Json, "aws" | "azure", string]> = [
    ["collectedAt이 +00:00", () => mutate(awsFile(), "collectedAt", "2026-10-19T03:12:00+00:00"), "aws", "collectedAt"],
    ["영수증 at에 소수 초", () => mutate(awsFile(), "receipts.0.at", "2026-10-19T03:12:00.123Z"), "aws", "receipts.0.at"],
    ["ok인데 errorCode가 있음", () => mutate(awsFile(), "receipts.0.errorCode", "AccessDenied"), "aws", "receipts.0"],
    ["denied인데 코드가 없음", () => mutate(awsFile(), "receipts.8.errorCode", null), "aws", "receipts.8"],
    ["empty인데 count 3", () => mutate(awsFile(), "receipts.7.count", 3), "aws", "receipts.7"],
    ["truncated인데 errorCode가 있음", () => mutate(awsFile(), "receipts.12.errorCode", "Throttling"), "aws", "receipts.12"],
    ["카탈로그 밖 호출(secretsmanager:GetSecretValue)", () => mutate(awsFile(), "receipts.0.call", "secretsmanager:GetSecretValue"), "aws", "receipts.0.call"],
    ["AWS 파일 안의 Azure 호출", () => mutate(awsFile(), "receipts.0.call", "azure:account.show"), "aws", "receipts.0.call"],
    ["data 항목의 추가 필드(Tags)", () => mutate(awsFile(), "data.iamUsers.items.0.Tags", [{ Key: "k", Value: "v" }]), "aws", "data.iamUsers.items.0"],
    ["모르는 data 섹션", () => mutate(awsFile(), "data.secrets", { receipt: rid(1), value: null }), "aws", "data"],
    ["budget 모순(collected > total)", () => mutate(awsFile(), "data.iamUsers.budget", { limit: 150, total: 1, collected: 2 }), "aws", "data.iamUsers.budget"],
    ["12자리가 아닌 계정 ID", () => mutate(awsFile(), "identity.accountId", "1111222233"), "aws", "identity.accountId"],
    ["키 ID 전체를 끝 4자리 자리에 넣음", () => mutate(awsFile(), "data.iamUsers.items.0.accessKeys", { receipt: rid(9), value: [{ status: "Active", createDate: "2025-03-02T01:00:00+00:00", idSuffix: "AKIAIOSFODNN7EXAMPLE" }] }), "aws", "data.iamUsers.items.0.accessKeys.value.0.idSuffix"],
    ["run.doors에서 문 하나가 빠짐", () => mutate(awsFile(), "run.doors", { mfa: "collected", key: "collected", net: "skipped", sto: "collected" }), "aws", "run.doors.log"],
    ["파티션 aws-cn", () => mutate(awsFile(), "identity.partition", "aws-cn"), "aws", "identity.partition"],
    ["Azure 잘못된 리소스 ID", () => mutate(azFile(), "data.storageAccounts.0.items.0.id", "/subscriptions/not-a-guid/providers/x"), "azure", "data.storageAccounts.0.items.0.id"],
  ];
  it.each(cases)("%s", (_name, make, cloud, path) => {
    const schema = cloud === "aws" ? AwsCollectFile : AzureCollectFile;
    const r = schema.safeParse(make());
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.issues.map((i) => i.path.join(".")).some((p) => p.startsWith(path)), JSON.stringify(r.error.issues)).toBe(true);
    expect(CollectFile.safeParse(make()).success).toBe(false);
  });

  it("거부 케이스의 기준 파일은 통과한다(바꾼 한 곳 때문에만 거부된다)", () => {
    expect(AwsCollectFile.safeParse(awsFile()).success).toBe(true);
    expect(AzureCollectFile.safeParse(azFile()).success).toBe(true);
  });

  it("기본 구조 위반: 알 수 없는 최상위 키, 잘못된 cloud 값, 영수증 ID 형식", () => {
    expect(AwsCollectFile.safeParse({ ...awsFile(), extra: 1 }).success).toBe(false);
    expect(CollectFile.safeParse({ ...awsFile(), cloud: "gcp" }).success).toBe(false);
    expect(AwsCollectFile.safeParse(mutate(awsFile(), "receipts.0.id", "r-1")).success).toBe(false);
    expect(AwsCollectFile.safeParse(mutate(awsFile(), "collector.name", "cloudcheck-azure")).success).toBe(true);   // 이름 enum은 모양만 본다(교차 검사는 parse)
  });
});

describe("수집 계약 v1.0 — 값 검사", () => {
  it("runKey 형식: <cloud>|<계정 ID 또는 소문자 테넌트>|<collectedAt>", () => {
    const aws = AwsCollectFile.parse(awsFile());
    const az = AzureCollectFile.parse(azFile());
    expect(runKey(aws)).toBe(`aws|111122223333|${T}`);
    expect(runKey(az)).toBe(`azure|${TENANT.toLowerCase()}|${T}`);
  });

  it("호출 카탈로그: AWS 26종, Azure 9종, 키가 서로 겹치지 않음", () => {
    expect(AWS_CALL_IDS).toHaveLength(26);
    expect(AZURE_CALL_IDS).toHaveLength(9);
    expect(new Set([...AWS_CALL_IDS, ...AZURE_CALL_IDS]).size).toBe(35);
    for (const id of AWS_CALL_IDS) expect(AWS_CALLS[id].cli.startsWith("aws ")).toBe(true);
    for (const id of AZURE_CALL_IDS) expect(AZURE_CALLS[id].cli.startsWith("az ") && id.startsWith("azure:")).toBe(true);
  });

  it("비조회 호출은 iam:GenerateCredentialReport 1건뿐", () => {
    const writes = [...Object.entries(AWS_CALLS), ...Object.entries(AZURE_CALLS)].filter(([, m]) => !m.readOnly).map(([k]) => k);
    expect(writes).toEqual(["iam:GenerateCredentialReport"]);
  });

  it("룰 ID는 18개이고 중복이 없다", () => {
    expect(RULE_IDS).toHaveLength(18);
    expect(new Set(RULE_IDS).size).toBe(18);
  });

  it("SUPPORTED는 메이저 2를 거부하고 1.0을 받는다", () => {
    const major = (id: string): number => Number(SCHEMA_RE.exec(id)?.[1]);
    expect(SUPPORTED).toEqual({ major: 1, maxMinor: 0 });
    expect(major("cloudcheck.collect/1.0")).toBe(SUPPORTED.major);
    expect(major("cloudcheck.collect/2.0")).not.toBe(SUPPORTED.major);
    expect(SCHEMA_RE.test("cloudcheck.collect/1")).toBe(false);
    expect(SCHEMA_RE.test("cloudcheck.collect/1.0.1")).toBe(false);
  });

  it("영수증 결과 8종 · 문 5종 · 크기 상한(JSON 25MB, CSV 20MB, 깊이 32)", () => {
    expect([...RESULTS]).toEqual(["ok", "empty", "notconfigured", "denied", "error", "throttled", "truncated", "unsupported"]);
    expect([...DOORS]).toEqual(["mfa", "key", "net", "sto", "log"]);
    expect(LIMITS.jsonBytes).toBe(25 * 1024 * 1024);
    expect(LIMITS.csvBytes).toBe(20 * 1024 * 1024);
    expect(LIMITS.jsonDepth).toBe(32);
  });

  it("카탈로그의 권한 이름과 phases: 신원·범위 호출을 빼면 모두 문에 속한다", () => {
    for (const [id, m] of [...Object.entries(AWS_CALLS), ...Object.entries(AZURE_CALLS)]) {
      expect(m.phases.length, id).toBeGreaterThan(0);
      if (m.permission === null) expect(m.phases, id).toEqual(["identity"]);
    }
  });
});
