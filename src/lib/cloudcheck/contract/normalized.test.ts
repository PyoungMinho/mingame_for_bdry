// src/lib/cloudcheck/contract/normalized.test.ts — 정규화 입력 계약 v1의 형태 고정
// ① AWS 리터럴(수집기 JSON + 대체된 자격증명 CSV, log 문은 --doors로 건너뜀)과 Azure 리터럴(Resource Graph CSV 2개, 하나는 붙여넣기)이
//    같은 모양으로 컴파일되고 불변식 검사기를 통과한다 ② 검사기가 변조를 실제로 잡는다 ③ sealCoverage는 모순 초안을 미완결로 봉인한다(fail-closed)
// ④ engine/·rules/는 범위를 만들지 못한다(소스 가드) ⑤ 컴파일 단계 회귀(@ts-expect-error — npm run type-check가 검사)
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DOORS } from "../model/report";
import type { IsoUtc, ReceiptResult } from "../model/report";
import type { AwsCall, AzureCall } from "./calls";
import {
  AWS_FAMILIES, AZURE_FAMILIES, DEMO_NAME_RE, NORMALIZED_MODEL, REDACTED_PREFIX,
  demoInputName, familyDoor, isRedacted, notCollectedCoverage, sealCoverage,
} from "./normalized";
import { checkInvariants } from "./normalized-invariants";
import type {
  AwsAccountSummary, AwsBucket, AwsCredentialReport, AwsEni, AwsIamUser, AwsKeyData, AwsMfaData, AwsNetData,
  AwsNormalizedInput, AwsRoot, AwsSecurityGroup, AwsStoData, AzureNormalizedInput, AzureNsg, AzureStorageAccount,
  CoverageDraft, CsvKind, DoorFamilies, DoorSelection, FamilyCoverage, FamilyId, Instant, MissingReason,
  NormalizedInput, PartialReason, ReceiptFact, ReceiptKey, Slot, Src,
} from "./normalized";

/* ───────── 작은 생성기(테스트 전용) ───────── */
const CANON = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;
const inst = (iso: string): Instant => {
  const m = CANON.exec(iso);
  if (!m) throw new Error(`정규형 시각이 아님: ${iso}`);
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  return { iso: iso as IsoUtc, ms: Date.UTC(y, mo - 1, d, h, mi, s) };
};
const rk = (input: number, n: number): ReceiptKey => `${input}:r-${String(n).padStart(4, "0")}`;
const byReceipt = (input: number, n: number): Src => ({ input, receipt: rk(input, n), csv: null });
const byCell = (input: number, kind: CsvKind, row: number | null, column: string | null = null, receipt: ReceiptKey | null = null): Src =>
  ({ input, receipt, csv: { kind, row, column } });
const val = <T>(value: T, src: Src): Slot<T> => ({ k: "value", value, src });
const part = <T>(value: T, why: PartialReason, src: Src): Slot<T> => ({ k: "partial", value, why, src });
const none = <T>(src: Src): Slot<T> => ({ k: "none", src });
const miss = <T>(why: MissingReason, src: Src | null = null): Slot<T> => ({ k: "missing", why, src });
const ACCOUNT_WIDE = { kind: "account-global", covered: 1, total: 1 } as const;
const proven = <F extends FamilyId>(family: F, input: number, n: number, receipts: ReceiptKey[], expected: number | null = null): FamilyCoverage<F> =>
  sealCoverage({ family, input, complete: true, population: n, present: n, expected, gaps: [], receipts, unit: ACCOUNT_WIDE, units: [] });

/* ───────── AWS: 수집기 JSON(0번) + 자격증명 CSV(1번, mfa·key를 수집기에 내줌) ───────── */
const AT = inst("2026-10-19T03:00:00Z");
const BUCKET = "amzn-s3-demo-bucket-logs";
const rc = (n: number, call: AwsCall | AzureCall, result: ReceiptResult, o: { region?: string; resource?: string; count?: number; errorCode?: string } = {}): ReceiptFact => ({
  key: rk(0, n), input: 0, call, region: o.region ?? "global", subscription: null, resource: o.resource ?? null,
  result, count: o.count ?? null, errorCode: o.errorCode ?? null, at: AT, used: true,
});
const AWS_RECEIPTS: readonly ReceiptFact[] = [
  rc(1, "sts:GetCallerIdentity", "ok"),
  rc(2, "iam:ListAccountAliases", "ok", { count: 1 }),
  rc(3, "ec2:DescribeRegions", "ok", { count: 2 }),
  rc(4, "iam:GenerateCredentialReport", "ok"),
  rc(5, "iam:GetCredentialReport", "ok"),
  rc(6, "iam:GetAccountSummary", "ok"),
  rc(7, "iam:ListUsers", "ok", { count: 2 }),
  rc(8, "iam:ListMFADevices", "ok", { resource: "alice", count: 1 }),
  rc(9, "iam:ListMFADevices", "empty", { resource: "build-bot", count: 0 }),
  rc(10, "iam:ListAccessKeys", "empty", { resource: "alice", count: 0 }),
  rc(11, "iam:ListAccessKeys", "ok", { resource: "build-bot", count: 1 }),
  rc(12, "iam:ListAttachedUserPolicies", "ok", { resource: "alice", count: 1 }),
  rc(13, "iam:ListAttachedUserPolicies", "empty", { resource: "build-bot", count: 0 }),
  rc(14, "iam:ListGroupsForUser", "empty", { resource: "alice", count: 0 }),
  rc(15, "iam:ListGroupsForUser", "empty", { resource: "build-bot", count: 0 }),
  rc(16, "iam:ListRoles", "ok", { count: 1 }),
  rc(17, "ec2:DescribeSecurityGroups", "ok", { region: "ap-northeast-2", count: 1 }),
  rc(18, "ec2:DescribeSecurityGroups", "denied", { region: "us-east-1", errorCode: "UnauthorizedOperation" }),
  rc(19, "ec2:DescribeNetworkInterfaces", "ok", { region: "ap-northeast-2", count: 1 }),
  rc(20, "ec2:DescribeNetworkInterfaces", "empty", { region: "us-east-1", count: 0 }),
  rc(21, "s3:GetAccountPublicAccessBlock", "notconfigured", { errorCode: "NoSuchPublicAccessBlockConfiguration" }),
  rc(22, "s3:ListAllMyBuckets", "ok", { count: 1 }),
  rc(23, "s3:GetBucketPublicAccessBlock", "ok", { region: "ap-northeast-2", resource: BUCKET }),
  rc(24, "s3:GetBucketPolicyStatus", "notconfigured", { region: "ap-northeast-2", resource: BUCKET, errorCode: "NoSuchBucketPolicy" }),
  rc(25, "s3:GetBucketAcl", "ok", { region: "ap-northeast-2", resource: BUCKET }),
  rc(26, "s3:GetBucketOwnershipControls", "ok", { region: "ap-northeast-2", resource: BUCKET }),
  rc(27, "s3:GetBucketWebsite", "notconfigured", { region: "ap-northeast-2", resource: BUCKET, errorCode: "NoSuchWebsiteConfiguration" }),
];
/** 수집기 JSON 안 자격증명 보고서의 칸: 영수증(get-credential-report) + CSV 행·열을 둘 다 단다 */
const cell = (row: number | null, column: string | null = null): Src => byCell(0, "csv-credential-report", row, column, rk(0, 5));

const report: Slot<AwsCredentialReport> = val<AwsCredentialReport>({
  generatedAt: inst("2026-10-19T02:58:30Z"), generatedAtSource: "api", rows: 3, ambiguousRows: [], rootRow: 2, hasAdditionalCredentialsColumn: true,
}, cell(null));
const summary: Slot<AwsAccountSummary> = val<AwsAccountSummary>({
  users: 2, groups: 0, roles: 1, accountMfaEnabled: 1, accountAccessKeysPresent: 0, accountSigningCertificatesPresent: 0, mfaDevicesInUse: 2,
}, byReceipt(0, 6));
const root: AwsRoot = {
  src: cell(2),
  passwordEnabled: val(true, cell(2, "password_enabled")),
  passwordLastUsed: val<Instant | null>(inst("2026-07-01T00:10:00Z"), cell(2, "password_last_used")),
  mfaActive: val(true, cell(2, "mfa_active")),
  keys: val([], cell(2)),
};
const alice: AwsIamUser = {
  src: byReceipt(0, 7), name: "alice",
  createdAt: val(inst("2025-03-02T01:00:00Z"), byReceipt(0, 7)),
  passwordEnabled: val(true, cell(3, "password_enabled")),                       // 보고서에서만 온다
  passwordLastUsed: val<Instant | null>(inst("2026-10-18T09:00:00Z"), byReceipt(0, 7)),   // list-users가 보고서보다 우선
  mfaActive: val(true, byReceipt(0, 8)), mfaDevices: 1,
  keys: val([], byReceipt(0, 10)),
  attachedPolicyArns: val(["arn:aws:iam::aws:policy/ReadOnlyAccess"], byReceipt(0, 12)),
  groupNames: val([], byReceipt(0, 14)),
};
const buildBot: AwsIamUser = {
  src: byReceipt(0, 7), name: "build-bot",
  createdAt: val(inst("2024-11-20T05:30:00Z"), byReceipt(0, 7)),
  passwordEnabled: val(false, cell(4, "password_enabled")),
  passwordLastUsed: val<Instant | null>(null, byReceipt(0, 7)),                 // 수집기 null = 사용 기록 없음
  mfaActive: val(false, byReceipt(0, 9)), mfaDevices: 0,
  keys: val([{
    src: byReceipt(0, 11), slot: 1, idSuffix: "7QXZ", status: "Active",
    active: val(true, byReceipt(0, 11)),
    createdAt: val(inst("2026-01-05T00:00:00Z"), byReceipt(0, 11)),
    lastUsed: val<Instant | null>(inst("2026-10-17T12:00:00Z"), cell(4, "access_key_1_last_used_date")),   // 마지막 사용은 보고서 슬롯 조인
    lastUsedRegion: "ap-northeast-2", lastUsedService: "s3",
  }], byReceipt(0, 11)),
  attachedPolicyArns: val([], byReceipt(0, 13)),
  groupNames: val([], byReceipt(0, 15)),
};
const users = val([alice, buildBot], byReceipt(0, 7));
const mfa: AwsMfaData = { credentialReport: report, accountSummary: summary, root: val(root, cell(2)), users };
const key: AwsKeyData = {
  credentialReport: report, accountSummary: summary, users, groups: [],
  roles: val([{
    src: byReceipt(0, 16), name: "AWSServiceRoleForSupport", path: "/aws-service-role/support.amazonaws.com/", createdAt: inst("2024-11-01T00:00:00Z"),
    trust: val([{
      effect: "Allow", actions: ["sts:AssumeRole"], notPrincipal: false,
      principal: { wildcard: false, aws: [], service: ["support.amazonaws.com"], federated: [], canonicalUserCount: 0 }, conditionKeys: [],
    }], byReceipt(0, 16)),
  }], byReceipt(0, 16)),
};
const sg: AwsSecurityGroup = {
  src: byReceipt(0, 17), id: "sg-0a1b2c3d", name: "bastion-ssh", vpcId: "vpc-0123", region: "ap-northeast-2",
  ingress: [{ protocol: "tcp", fromPort: 22, toPort: 22, cidrs: ["0.0.0.0/0"], ipv6Cidrs: [], prefixListIds: [], sgRefCount: 0 }],
};
const eni: AwsEni = {
  src: byReceipt(0, 19), id: "eni-0f00", region: "ap-northeast-2", groupIds: ["sg-0a1b2c3d"],
  hasPublicIp: true, hasIpv6: false, interfaceType: "interface", status: "in-use", requesterManaged: false,
};
const net: AwsNetData = {
  regions: val(["ap-northeast-2", "us-east-1"], byReceipt(0, 3)), regionsRequested: null,
  securityGroups: [
    { region: "ap-northeast-2", items: val([sg], byReceipt(0, 17)) },
    { region: "us-east-1", items: miss("denied", byReceipt(0, 18)) },      // 이 리전만 거부 → 패밀리 미완결(region-missing), 찾은 위험은 유지
  ],
  networkInterfaces: [
    { region: "ap-northeast-2", items: val([eni], byReceipt(0, 19)) },
    { region: "us-east-1", items: val([], byReceipt(0, 20)) },
  ],
};
const bucket: AwsBucket = {
  src: byReceipt(0, 22), name: BUCKET, createdAt: inst("2022-05-01T00:00:00Z"),
  region: val("ap-northeast-2", byReceipt(0, 22)),
  publicAccessBlock: val({ blockPublicAcls: true, ignorePublicAcls: true, blockPublicPolicy: true, restrictPublicBuckets: true }, byReceipt(0, 23)),
  policyStatus: none(byReceipt(0, 24)),                                    // NoSuchBucketPolicy = 정책 없음(유효한 답)
  acl: val({ publicGrants: [] }, byReceipt(0, 25)),
  ownership: val({ objectOwnership: "BucketOwnerEnforced" }, byReceipt(0, 26)),
  website: none(byReceipt(0, 27)),
};
const sto: AwsStoData = { accountPublicAccessBlock: none(byReceipt(0, 21)), buckets: val([bucket], byReceipt(0, 22)) };
const RUN_AS_OF = { at: AT, source: "collected-at" } as const;

const awsInput: AwsNormalizedInput = {
  model: NORMALIZED_MODEL, cloud: "aws", mode: { kind: "real" },
  inputs: [
    {
      index: 0, kind: "collector-json", via: "file", name: "cloudcheck-aws-result.json", bytes: 48_213, asOf: RUN_AS_OF,
      runKey: "aws|111122223333|2026-10-19T03:00:00Z",
      collector: { name: "cloudcheck-aws", version: "1.0.0", sha256: null, knownRelease: null },
      schema: { id: "cloudcheck.collect/1.0", support: "exact" },
      doors: { mfa: "used", key: "used", net: "used", sto: "used", log: "skipped" }, scopeProven: true,
    },
    {
      index: 1, kind: "csv-credential-report", via: "file", name: "status_reports_2026-10-18T22_15_00Z.csv", bytes: 912,
      asOf: { at: inst("2026-10-18T22:15:00Z"), source: "filename" }, runKey: null, collector: null, schema: null,
      doors: { mfa: "superseded", key: "superseded", net: "absent", sto: "absent", log: "absent" }, scopeProven: true,
    },
  ],
  identity: {
    input: 0, source: "collector", accountId: "111122223333", alias: val("example-corp", byReceipt(0, 2)),
    principalType: "assumed-role", principalName: "SecurityAuditRole", confirmed: "interactive", receipt: rk(0, 1),
  },
  doors: {
    mfa: { state: "selected", input: 0, asOf: RUN_AS_OF, data: mfa },
    key: { state: "selected", input: 0, asOf: RUN_AS_OF, data: key },
    net: { state: "selected", input: 0, asOf: RUN_AS_OF, data: net },
    sto: { state: "selected", input: 0, asOf: RUN_AS_OF, data: sto },
    log: { state: "skipped", inputs: [0] },
  },
  receipts: new Map(AWS_RECEIPTS.map((r): [ReceiptKey, ReceiptFact] => [r.key, r])),
  coverage: {
    "aws.mfa.credential-report": proven("aws.mfa.credential-report", 0, 3, [rk(0, 5)], 3),
    "aws.mfa.root": proven("aws.mfa.root", 0, 1, [rk(0, 5)], 1),
    "aws.mfa.users": proven("aws.mfa.users", 0, 2, [rk(0, 7)], 2),
    "aws.key.credential-report": proven("aws.key.credential-report", 0, 3, [rk(0, 5)], 3),
    "aws.key.users": proven("aws.key.users", 0, 2, [rk(0, 7)], 2),
    "aws.key.access-keys": proven("aws.key.access-keys", 0, 1, [rk(0, 10), rk(0, 11)]),   // 모수 = 키 전체(상태 무관). 활성만 고르는 것은 룰
    "aws.key.roles": proven("aws.key.roles", 0, 1, [rk(0, 16)]),                           // 서비스 연결 역할도 모수에 든다(제외는 룰)
    "aws.net.security-groups": sealCoverage({
      family: "aws.net.security-groups", input: 0, complete: false, population: null, present: 1, expected: null, gaps: ["region-missing"],
      receipts: [rk(0, 17), rk(0, 18)], unit: { kind: "regions", covered: 1, total: 2 },
      units: [
        { unit: "ap-northeast-2", state: "ok", why: null, receipt: rk(0, 17) },
        { unit: "us-east-1", state: "failed", why: "denied", receipt: rk(0, 18) },
      ],
    }),
    "aws.net.enis": sealCoverage({
      family: "aws.net.enis", input: 0, complete: true, population: 1, present: 1, expected: null, gaps: [],
      receipts: [rk(0, 19), rk(0, 20)], unit: { kind: "regions", covered: 2, total: 2 },
      units: [
        { unit: "ap-northeast-2", state: "ok", why: null, receipt: rk(0, 19) },
        { unit: "us-east-1", state: "ok", why: null, receipt: rk(0, 20) },
      ],
    }),
    "aws.sto.account": proven("aws.sto.account", 0, 1, [rk(0, 21)]),   // notconfigured도 유효한 답이라 완결
    "aws.sto.buckets": proven("aws.sto.buckets", 0, 1, [rk(0, 22)]),
    "aws.log.account": notCollectedCoverage("aws.log.account"),
    "aws.log.trails": notCollectedCoverage("aws.log.trails"),
  },
  notices: { redactions: 0, sectionIssues: [] },
};

/* ───────── Azure: Resource Graph CSV 2개(0번 파일 = 스토리지 → key·sto, 1번 붙여넣기 = NSG → net) ───────── */
const SUB = "00000000-0000-0000-0000-000000000011";
const st = (row: number | null, column: string | null = null): Src => byCell(0, "csv-rg-storage", row, column);
const ns = (row: number | null, column: string | null = null): Src => byCell(1, "csv-rg-nsg", row, column);
const RG_AS_OF = { at: inst("2026-10-19T04:10:00Z"), source: "file-time" } as const;
const account: AzureStorageAccount = {
  src: st(2), id: `/subscriptions/${SUB}/resourcegroups/rg-web/providers/microsoft.storage/storageaccounts/stwebfiles01`,
  name: "stwebfiles01", subscription: SUB, kind: "StorageV2", location: "koreacentral",
  allowBlobPublicAccess: val<boolean | null>(null, st(2, "allowBlobPublicAccess")),   // 빈 칸 = 미설정(차단 아님) — 값으로서의 null
  allowSharedKeyAccess: val<boolean | null>(true, st(2, "allowSharedKeyAccess")),
  key1CreatedAt: val<Instant | null>(inst("2025-01-10T00:00:00Z"), st(2, "key1CreationTime")),
  key2CreatedAt: miss("value-unrecognized", st(2, "key2CreationTime")),             // 스프레드시트가 바꾼 날짜 형식 등 → 이 대상만 확인 불가
  keyExpirationPeriodInDays: val<number | null>(null, st(2, "keyExpirationPeriodInDays")),
  sasExpirationPeriod: val<string | null>(null, st(2, "sasExpirationPeriod")),
  publicNetworkAccess: miss("not-collected"), networkDefaultAction: miss("not-collected"),
  containers: miss("not-collected"), blobDiagnostics: miss("not-collected"),
};
const nsg: AzureNsg = {
  src: ns(2), id: `/subscriptions/${SUB}/resourcegroups/rg-web/providers/microsoft.network/networksecuritygroups/nsg-web`,
  name: "nsg-web", location: "koreacentral", subscription: SUB,
  rules: [
    val({ name: "allow-rdp", direction: "Inbound", access: "Allow", priority: 100, protocol: "Tcp", sourcePrefixes: ["*"], sourceAsgCount: null, destPortRanges: ["3389"] }, ns(2)),
    miss("value-unrecognized", ns(3, "priority")),
  ],
  nicIds: miss("not-collected"), subnetIds: miss("not-collected"), nicCount: 1, subnetCount: 0,
};
const storageAccounts = [{ subscription: SUB, items: part([account], "csv-scope-unproven", st(null)) }];
const rgOnly = <F extends FamilyId>(family: F, input: number, present: number, rows: { covered: number; total: number }): FamilyCoverage<F> =>
  sealCoverage({ family, input, complete: false, population: null, present, expected: null, gaps: ["csv-scope-unproven"], receipts: [], unit: { kind: "csv-rows", ...rows }, units: [] });

const azureInput: AzureNormalizedInput = {
  model: NORMALIZED_MODEL, cloud: "azure", mode: { kind: "real" },
  inputs: [
    {
      index: 0, kind: "csv-rg-storage", via: "file", name: "cc-rg-storage.csv", bytes: 1_834, asOf: RG_AS_OF,
      runKey: null, collector: null, schema: null,
      doors: { mfa: "absent", key: "used", net: "absent", sto: "used", log: "absent" }, scopeProven: false,
    },
    {
      index: 1, kind: "csv-rg-nsg", via: "paste", name: "붙여넣기 1", bytes: 640, asOf: null,      // 붙여넣기 = 파일 시각 없음 → 기준 시각 null
      runKey: null, collector: null, schema: null,
      doors: { mfa: "absent", key: "absent", net: "used", sto: "absent", log: "absent" }, scopeProven: false,
    },
  ],
  identity: {
    input: 0, source: "csv-tenant", tenantId: "00000000-0000-0000-0000-000000000001", currentSubscription: null, cloudName: null,
    principalType: "unknown", confirmed: null, receipt: null,
  },
  doors: {
    mfa: { state: "absent" },
    key: { state: "selected", input: 0, asOf: RG_AS_OF, data: { subscriptions: miss("not-collected"), subscriptionsRequested: null, storageAccounts } },
    net: {
      state: "selected", input: 1, asOf: null,
      data: {
        subscriptions: miss("not-collected"), subscriptionsRequested: null,
        nsgs: [{ subscription: SUB, items: part([nsg], "csv-scope-unproven", ns(null)) }], nics: [], publicIps: [],
      },
    },
    sto: { state: "selected", input: 0, asOf: RG_AS_OF, data: { subscriptions: miss("not-collected"), subscriptionsRequested: null, storageAccounts } },
    log: { state: "absent" },
  },
  receipts: new Map(),
  coverage: {
    "azure.mfa.entra-users": notCollectedCoverage("azure.mfa.entra-users"),
    "azure.key.storage-accounts": rgOnly("azure.key.storage-accounts", 0, 1, { covered: 1, total: 1 }),
    "azure.net.nsgs": rgOnly("azure.net.nsgs", 1, 1, { covered: 1, total: 2 }),
    "azure.net.nics": notCollectedCoverage("azure.net.nics", 1),               // 문은 선택됐지만 이 출처에 NIC가 없다
    "azure.net.public-ips": notCollectedCoverage("azure.net.public-ips", 1),
    "azure.sto.storage-accounts": rgOnly("azure.sto.storage-accounts", 0, 1, { covered: 1, total: 1 }),
    "azure.sto.containers": notCollectedCoverage("azure.sto.containers", 0),
    "azure.log.subscriptions": notCollectedCoverage("azure.log.subscriptions"),
    "azure.log.storage-accounts": notCollectedCoverage("azure.log.storage-accounts"),
  },
  notices: { redactions: 0, sectionIssues: [] },
};

describe("NormalizedInput — 두 리터럴이 계약을 지킨다", () => {
  it("AWS(수집기 JSON + 대체된 자격증명 CSV, log 건너뜀): 불변식 위반 0", () => {
    expect(checkInvariants(awsInput)).toEqual([]);
  });

  it("Azure(Resource Graph CSV 2개, 붙여넣기 포함): 불변식 위반 0", () => {
    expect(checkInvariants(azureInput)).toEqual([]);
  });

  it("출처가 달라도 최상위 모양이 같다", () => {
    expect(Object.keys(awsInput).sort()).toEqual(Object.keys(azureInput).sort());
    expect(awsInput.model).toBe("cloudcheck.normalized/1");
  });

  it("슬롯이 null의 뜻을 미리 푼다: 설정 없음(none) · 거부(missing) · 값으로서의 null(value)", () => {
    const awsSto = awsInput.doors.sto;
    const awsNet = awsInput.doors.net;
    const azSto = azureInput.doors.sto;
    if (awsSto.state !== "selected" || awsNet.state !== "selected" || azSto.state !== "selected") throw new Error("선택된 문이어야 함");
    expect(awsSto.data.accountPublicAccessBlock.k).toBe("none");                  // NoSuchPublicAccessBlockConfiguration = 유효한 답(INV-6)
    expect(awsNet.data.securityGroups[1]?.items).toMatchObject({ k: "missing", why: "denied" });
    const items = azSto.data.storageAccounts[0]?.items;
    expect(items?.k).toBe("partial");                                             // RG CSV = '없음'을 증명하지 못함(INV-4)
    if (items?.k !== "partial") return;
    expect(items.value[0]?.allowBlobPublicAccess).toMatchObject({ k: "value", value: null });   // 미설정(차단 아님)
  });

  it("검사기가 변조를 실제로 잡는다", () => {
    const [in0, in1] = awsInput.inputs;
    const wrongUse: AwsNormalizedInput = { ...awsInput, inputs: [{ ...in0, doors: { ...in0.doors, sto: "superseded" } }, in1] };
    expect(checkInvariants(wrongUse).some((m) => m.startsWith("doors.sto"))).toBe(true);

    const lostReceipt: AwsNormalizedInput = { ...awsInput, receipts: new Map([...awsInput.receipts].filter(([k]) => k !== rk(0, 8))) };
    expect(checkInvariants(lostReceipt).some((m) => m.includes(rk(0, 8)))).toBe(true);

    const foreign: AwsNormalizedInput = {
      ...awsInput,
      doors: { ...awsInput.doors, sto: { state: "selected", input: 0, asOf: RUN_AS_OF, data: { ...sto, accountPublicAccessBlock: none(byCell(1, "csv-credential-report", 2)) } } },
    };
    expect(checkInvariants(foreign).some((m) => m.includes("다른 입력"))).toBe(true);

    const badTime: AwsNormalizedInput = {
      ...awsInput,
      inputs: [{ ...in0, asOf: { at: { iso: "2026-10-19T03:00:00.123Z" as IsoUtc, ms: AT.ms }, source: "collected-at" } }, in1],
    };
    expect(checkInvariants(badTime).some((m) => m.includes("정규형"))).toBe(true);
  });
});

describe("패밀리 목록·체험 이름·지운 값", () => {
  it("패밀리 ID = <cloud>.<문>.<이름>, 중복 없음, 문마다 1개 이상", () => {
    for (const [cloud, list] of [["aws", AWS_FAMILIES], ["azure", AZURE_FAMILIES]] as const) {
      expect(new Set<string>(list).size).toBe(list.length);
      for (const f of list) {
        const [c, d, name] = f.split(".");
        expect(c).toBe(cloud);
        expect(DOORS as readonly string[]).toContain(d);
        expect(name).toMatch(/^[a-z]+(-[a-z]+)*$/);
        expect(familyDoor(f)).toBe(d);
      }
      for (const door of DOORS) expect(list.some((f) => familyDoor(f) === door)).toBe(true);
    }
  });

  it("체험 이름 규약은 세트·클라우드를 왕복하고, 표시용 이름(세트 글자 없음)은 규약 밖이다", () => {
    for (const set of ["A", "B", "C", "D"] as const) {
      for (const cloud of ["aws", "azure"] as const) {
        const m = DEMO_NAME_RE.exec(demoInputName(set, cloud));
        expect([m?.[1], m?.[2]]).toEqual([set, cloud]);
      }
    }
    expect(DEMO_NAME_RE.test("cloudcheck-demo.aws.json")).toBe(false);
    expect(DEMO_NAME_RE.test("cloudcheck-demo-E.aws.json")).toBe(false);
  });

  it("지운 값(REDACTED)은 실제 문자열과 구별된다", () => {
    expect(isRedacted(`${REDACTED_PREFIX}1`)).toBe(true);
    expect(isRedacted("alice")).toBe(false);
    expect(isRedacted("cc-redacted:1")).toBe(false);
  });
});

describe("sealCoverage — 봉인과 fail-closed", () => {
  const base: CoverageDraft<"aws.sto.buckets"> = {
    family: "aws.sto.buckets", input: 0, complete: true, population: 2, present: 2, expected: 2, gaps: [],
    receipts: [rk(0, 22)], unit: ACCOUNT_WIDE, units: [],
  };

  it("정상 초안은 완결로 봉인되고 깊게 freeze된다(engine이 바꾸면 TypeError)", () => {
    const c = sealCoverage(base);
    expect([c.complete, c.population, c.gaps]).toEqual([true, 2, []]);
    expect([c, c.gaps, c.receipts, c.unit, c.units].every((x) => Object.isFrozen(x))).toBe(true);
    expect(() => { (c as { population: number | null }).population = 9; }).toThrow(TypeError);
  });

  it.each<[string, Partial<CoverageDraft<"aws.sto.buckets">>, string]>([
    ["완결이라면서 모수 ≠ 들어 있는 수", { population: 3 }, "population-mismatch"],
    ["완결이라면서 출처의 전체 수 ≠ 들어 있는 수", { expected: 5 }, "population-mismatch"],
    ["완결이라면서 모수 없음", { population: null }, "population-mismatch"],
    ["미완결인데 사유 없음", { complete: false, population: null }, "scope-unproven"],
    ["완결이라면서 입력 없음", { input: null }, "scope-unproven"],
    ["완결이라면서 리전 하나를 못 봄", { unit: { kind: "regions", covered: 1, total: 2 } }, "scope-unproven"],
    ["완결이라면서 범위 단위 하나가 실패", { units: [{ unit: "us-east-1", state: "failed", why: "denied", receipt: rk(0, 18) }] }, "scope-unproven"],
    ["음수 개수", { present: -1, population: -1 }, "population-mismatch"],
    ["완결이라면서 빈틈 사유가 있음", { gaps: ["denied"] }, "denied"],
  ])("모순 초안은 미완결로 봉인한다: %s", (_name, patch, gap) => {
    const c = sealCoverage({ ...base, ...patch });
    expect(c.complete).toBe(false);
    expect(c.population).toBeNull();
    expect(c.gaps).toContain(gap);
  });

  it("notCollectedCoverage = 미완결(not-collected), 모수 없음", () => {
    const c = notCollectedCoverage("azure.sto.containers", 0);
    expect([c.complete, c.population, c.present, c.input, c.gaps]).toEqual([false, null, 0, 0, ["not-collected"]]);
  });
});

/* ───────── 가드: engine/·rules/는 범위를 만들지 못한다(봉인 함수 사용·캐스팅 금지, 테스트 파일 제외) ───────── */
const LIB = resolve(__dirname, "..");   // src/lib/cloudcheck
const MINT_PATTERNS: readonly RegExp[] = [
  /\bsealCoverage\b/,
  /\bnotCollectedCoverage\b/,
  /\bas\s+(?:unknown\s+as\s+)?(?:FamilyCoverage|CoverageTable)\b/,
];
const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const mintViolations = (source: string): string[] => {
  const code = stripComments(source);
  return MINT_PATTERNS.filter((re) => re.test(code)).map(String);
};
const listSources = (dir: string): string[] =>
  !existsSync(dir) ? [] : readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return listSources(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });

describe("가드 — engine·rules는 범위를 만들지 못한다", () => {
  it("검사기 자체가 위반을 잡고 정상 코드는 통과시킨다", () => {
    expect(mintViolations(`import { sealCoverage } from "../contract/normalized";`)).not.toEqual([]);
    expect(mintViolations(`import { notCollectedCoverage as nc } from "../contract/normalized";`)).not.toEqual([]);
    expect(mintViolations(`const c = raw as unknown as FamilyCoverage<"aws.sto.buckets">;`)).not.toEqual([]);
    expect(mintViolations(`const t = {} as CoverageTable<AwsFamilyId>;`)).not.toEqual([]);
    expect(mintViolations(`// sealCoverage는 parse 전용\nconst c = input.coverage["aws.sto.buckets"];`)).toEqual([]);
    expect(mintViolations(`const doc = "https://docs.aws.amazon.com/x"; const c: FamilyCoverage = input.coverage["aws.sto.buckets"];`)).toEqual([]);
  });

  it("engine/·rules/ 소스(테스트 제외)에 위반 0", () => {
    const files = [...listSources(join(LIB, "engine")), ...listSources(join(LIB, "rules"))];
    const hits = files.flatMap((f) => mintViolations(readFileSync(f, "utf8")).map((v) => `${f.slice(LIB.length + 1)}: ${v}`));
    expect(hits).toEqual([]);
  });
});

/* ───────── 컴파일 단계 회귀(npm run type-check가 검사. 각 줄은 '컴파일 오류가 나야 정상', 실행하지 않는다) ───────── */
function typeLevelChecks(stoData: AwsStoData, cov: FamilyCoverage): unknown[] {
  // @ts-expect-error 봉인 없이는 FamilyCoverage를 만들 수 없다(sealCoverage만)
  const t1: FamilyCoverage<"aws.sto.account"> = { family: "aws.sto.account", input: 0, complete: true, population: 1, present: 1, expected: null, gaps: [], receipts: [], unit: ACCOUNT_WIDE, units: [] };
  // @ts-expect-error engine은 모수를 바꿀 수 없다(readonly)
  cov.population = 3;
  // @ts-expect-error 선택되지 않은 문에는 data가 없다
  const t3: DoorSelection<AwsStoData> = { state: "absent", data: stoData };
  // @ts-expect-error 값 슬롯에는 출처가 있어야 한다
  const t4: Slot<boolean> = { k: "value", value: true };
  // @ts-expect-error missing 사유는 MissingReason만(판정 사유 no-clear-rule은 engine 몫)
  const t5: Slot<boolean> = { k: "missing", why: "no-clear-rule", src: null };
  // @ts-expect-error 영수증 키에는 입력 번호가 붙는다
  const t6: ReceiptKey = "r-0012";
  // @ts-expect-error 룰은 자기 문 밖 패밀리를 선언할 수 없다
  const t7: DoorFamilies<"aws", "mfa"> = "aws.key.users";
  // @ts-expect-error AWS 입력의 coverage에는 Azure 패밀리가 없다
  const t8 = awsInput.coverage["azure.net.nsgs"];
  // @ts-expect-error 문 data는 그 문의 타입만(sto 자리에 net data 불가)
  const t9: DoorSelection<AwsStoData> = { state: "selected", input: 0, asOf: null, data: net };
  return [t1, t3, t4, t5, t6, t7, t8, t9];
}

describe("컴파일 단계 회귀", () => {
  it("@ts-expect-error 묶음은 type-check가 본다(실행하지 않음)", () => {
    expect(typeof typeLevelChecks).toBe("function");
  });
});
