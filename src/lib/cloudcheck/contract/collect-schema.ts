// src/lib/cloudcheck/contract/collect-schema.ts — 수집 계약 v1.0 (수집기 → 페이지)
// G0 동결. 소유: API설계자(변경 승인: 백엔드팀장, 프론트팀장 통보).
// 버전: schema "cloudcheck.collect/<major>.<minor>". minor = 필드·섹션 추가만, major = 이름 변경·삭제·의미 변경.
// 원칙: P1 사실만(영수증 + 데이터, 집계값 없음) / P2 실패해도 {receipt, value:null} 슬롯 보존 / P3 외부 열거형은 문자열
//       / P4 비밀·식별자 최소화 / P5 accountId 전체 보존(마스킹은 표시 단계) / P6 시각은 엄격 파서로
// 이 파일은 '모양'만 검사한다. 영수증 참조 연결 검사·섹션별 safeParse·비밀 패턴 검사는 parse/ 단계(§4-5)가 한다.
import { z } from "zod";
import { DOORS } from "../model/report";
import { AWS_CALL_IDS, AZURE_CALL_IDS } from "./calls";

/* ---------- 버전·상한 ---------- */
export const SCHEMA_RE = /^cloudcheck\.collect\/(\d+)\.(\d+)$/;
export const SUPPORTED = { major: 1, maxMinor: 0 } as const;
/** 파싱 전에 거부하는 상한(UI·파서 공용) */
export const LIMITS = {
  jsonBytes: 25 * 1024 * 1024,   // 수집기 JSON(파일·붙여넣기)
  csvBytes: 20 * 1024 * 1024,    // CSV 파일
  jsonDepth: 32,                 // JSON 중첩 깊이(파싱 전 반복 스캔)
  receipts: 100_000,
  credentialCsvChars: 20_000_000,
} as const;

/* ---------- 원자 ---------- */
export const RESULTS = ["ok", "empty", "notconfigured", "denied", "error", "throttled", "truncated", "unsupported"] as const;
export const ReceiptResult = z.enum(RESULTS);
export const ReceiptId = z.string().regex(/^r-\d{4,6}$/);
/** 수집기가 직접 찍는 시각(date -u +%Y-%m-%dT%H:%M:%SZ): Z 고정, 소수 초 없음 */
export const StampZ = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
/** 클라우드 API가 주는 UTC 시각: 소수 초 0~9자리, Z 또는 +00:00. 해석은 Date.parse가 아니라 자체 엄격 파서로 */
export const IsoUtc = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]00:00)$/);
const Uuid = z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);
const AwsRegion = z.string().regex(/^[a-z]{2}(-[a-z]+)+-\d{1,2}$/);
/** Azure 리소스 ID. API가 경로 대소문자를 섞어 돌려주는 경우가 있어 대소문자를 무시한다 */
const AzId = z.string().max(2048).regex(/^\/subscriptions\/[0-9a-f-]{36}\/resourcegroups\/[^/]+\/providers\/.+$/i);
const Str = (max: number) => z.string().max(max);
const Door = z.enum(DOORS);

/** 증거 슬롯: 실패해도 슬롯은 남는다. value = null의 뜻은 영수증 result가 정한다(notconfigured = '설정 없음'이라는 유효한 답) */
const Ev = <T extends z.ZodTypeAny>(v: T) => z.object({ receipt: ReceiptId, value: v.nullable() }).strict();
/** 리소스가 많아 일부만 조회했을 때(예산 초과). 조회 못 한 리소스는 항목 영수증이 없으므로 확인 불가가 된다 */
const Budget = z.object({ limit: z.number().int().positive(), total: z.number().int().nonnegative(), collected: z.number().int().nonnegative() }).strict()
  .refine((b) => b.collected <= b.total && b.collected <= b.limit, "budget 모순");

/* ---------- 영수증 ---------- */
const receiptBase = {
  id: ReceiptId,
  region: z.union([z.literal("global"), AwsRegion]).optional(),
  subscription: Uuid.optional(),
  resource: Str(2048).nullable().optional(),
  result: ReceiptResult,
  count: z.number().int().nonnegative().nullable(),
  /** 코드 토큰만. 오류 메시지 원문(ARN·UPN·이메일 포함)은 저장하지 않는다 */
  errorCode: z.string().regex(/^[A-Za-z0-9._:-]{1,80}$/).nullable(),
  at: StampZ,
};
type R = { result: (typeof RESULTS)[number]; count: number | null; errorCode: string | null };
const receiptRules = (r: R, ctx: z.RefinementCtx) => {
  const bad = (m: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message: m });
  switch (r.result) {
    case "ok": if (r.errorCode !== null || (r.count !== null && r.count < 1)) bad("ok: errorCode=null, count=null|>=1"); break;
    case "empty": if (r.errorCode !== null || r.count !== 0) bad("empty: count=0"); break;
    case "truncated": if (r.errorCode !== null || r.count === null) bad("truncated: errorCode=null, 받은 만큼 count"); break;
    default: if (r.errorCode === null || r.count !== null) bad(`${r.result}: errorCode 필수, count=null`);
  }
};
export const AwsReceipt = z.object({ ...receiptBase, call: z.enum(AWS_CALL_IDS) }).strict().superRefine(receiptRules);
export const AzureReceipt = z.object({ ...receiptBase, call: z.enum(AZURE_CALL_IDS) }).strict().superRefine(receiptRules);

/* ---------- 공통 봉투 ---------- */
const Collector = z.object({
  name: z.enum(["cloudcheck-aws", "cloudcheck-azure"]),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  sha256: z.string().regex(/^[0-9a-f]{64}$/).nullable(),   // 버전 확인용. 보안 증거가 아니다(INV-10)
  tools: z.object({ cli: Str(64).nullable(), jq: Str(32).nullable(), bash: Str(32).nullable() }).strict(),
}).strict();
const DoorStatus = z.enum(["collected", "skipped"]);   // skipped = --doors로 요청하지 않음. 수집 실패는 영수증으로 표현
const Run = z.object({
  finishedAt: StampZ,
  confirmed: z.enum(["interactive", "flag-yes"]),      // C-05 계정 확인: Enter(대화형) 또는 --yes
  doors: z.object({ mfa: DoorStatus, key: DoorStatus, net: DoorStatus, sto: DoorStatus, log: DoorStatus }).strict(),
}).strict();

/* ---------- AWS data ---------- */
const Pab = z.object({ blockPublicAcls: z.boolean(), ignorePublicAcls: z.boolean(), blockPublicPolicy: z.boolean(), restrictPublicBuckets: z.boolean() }).strict();
const PolicyArn = z.string().max(2048).regex(/^arn:aws[a-z-]*:iam::(aws|\d{12}):policy\//);
const AwsData = z.object({
  credentialReport: z.object({
    generateReceipt: ReceiptId,
    receipt: ReceiptId,
    /** C-07 명시 예외: 자격증명 보고서 CSV 원문(23열, 비밀 열 없음). 열 allowlist는 정규화 단계에서 적용 */
    value: z.object({ generatedTime: IsoUtc, format: z.literal("text/csv"), csv: z.string().max(LIMITS.credentialCsvChars) }).strict().nullable(),
  }).strict(),
  accountSummary: Ev(z.object({
    Users: z.number().int().optional(), Groups: z.number().int().optional(), Roles: z.number().int().optional(),
    AccountMFAEnabled: z.number().int().optional(), AccountAccessKeysPresent: z.number().int().optional(),
    AccountSigningCertificatesPresent: z.number().int().optional(), MFADevicesInUse: z.number().int().optional(),
  }).strict()),
  iamUsers: z.object({
    receipt: ReceiptId, budget: Budget,
    items: z.array(z.object({
      userName: Str(128), createDate: IsoUtc, passwordLastUsed: IsoUtc.nullable(),
      /** 키 ID는 끝 4자리만(전체 ID는 수집기 프로세스 밖으로 나오지 않는다) */
      accessKeys: Ev(z.array(z.object({ status: Str(32), createDate: IsoUtc, idSuffix: z.string().regex(/^[A-Z0-9]{4}$/) }).strict())),
      mfaDevices: Ev(z.object({ count: z.number().int().nonnegative() }).strict()),
      attachedPolicyArns: Ev(z.array(PolicyArn)),
      groupNames: Ev(z.array(Str(128))),
    }).strict()).nullable(),
  }).strict(),
  iamGroups: z.array(z.object({ groupName: Str(128), attachedPolicyArns: Ev(z.array(PolicyArn)) }).strict()),
  iamRoles: Ev(z.array(z.object({
    roleName: Str(64), path: Str(512), createDate: IsoUtc,
    trust: z.array(z.object({
      effect: Str(16), actions: z.array(Str(128)), notPrincipal: z.boolean(),
      principal: z.object({ wildcard: z.boolean(), aws: z.array(Str(2048)), service: z.array(Str(256)), federated: z.array(Str(2048)), canonicalUserCount: z.number().int().nonnegative() }).strict(),
      conditionKeys: z.array(Str(256)),   // "StringEquals:sts:ExternalId" 형태. 조건 값은 수집하지 않는다
    }).strict()).nullable(),               // null = 신뢰 정책 형태를 해석하지 못함 → 그 역할만 확인 불가
  }).strict())),
  securityGroups: z.array(z.object({
    region: AwsRegion, receipt: ReceiptId,
    items: z.array(z.object({
      groupId: z.string().regex(/^sg-[0-9a-f]+$/), groupName: Str(255), vpcId: Str(64).nullable(),
      ingress: z.array(z.object({
        protocol: Str(16), fromPort: z.number().int().nullable(), toPort: z.number().int().nullable(),
        cidrs: z.array(Str(64)), ipv6Cidrs: z.array(Str(64)), prefixListIds: z.array(Str(64)), sgRefCount: z.number().int().nonnegative(),
      }).strict()),
    }).strict()).nullable(),
  }).strict()),
  networkInterfaces: z.array(z.object({
    region: AwsRegion, receipt: ReceiptId,
    items: z.array(z.object({
      eniId: z.string().regex(/^eni-[0-9a-f]+$/), groupIds: z.array(Str(64)),
      hasPublicIp: z.boolean(), hasIpv6: z.boolean(),   // IP 값 자체는 수집하지 않는다(있음/없음, 모름 = 영수증 실패)
      interfaceType: Str(64).nullable(), status: Str(32).nullable(), requesterManaged: z.boolean(),
    }).strict()).nullable(),
  }).strict()),
  accountPublicAccessBlock: Ev(Pab),
  buckets: z.object({
    receipt: ReceiptId, budget: Budget,
    items: z.array(z.object({
      name: z.string().min(3).max(63), createDate: IsoUtc.nullable(),
      region: z.object({ value: AwsRegion.nullable(), source: z.enum(["list", "location"]), receipt: ReceiptId.nullable() }).strict(),
      publicAccessBlock: Ev(Pab),
      policyStatus: Ev(z.object({ isPublic: z.boolean() }).strict()),
      acl: Ev(z.object({ publicGrants: z.array(z.object({ grantee: z.enum(["AllUsers", "AuthenticatedUsers"]), permission: Str(32) }).strict()) }).strict()),
      ownership: Ev(z.object({ objectOwnership: Str(64) }).strict()),
      website: Ev(z.object({ enabled: z.literal(true) }).strict()),
    }).strict()).nullable(),
  }).strict(),
  trails: Ev(z.array(z.object({
    name: Str(128), trailArn: Str(2048), homeRegion: AwsRegion,
    isMultiRegion: z.boolean(), isOrganizationTrail: z.boolean(), logFileValidationEnabled: z.boolean(),
    hasCloudWatchLogs: z.boolean(), hasCustomEventSelectors: z.boolean(),
    status: Ev(z.object({ isLogging: z.boolean(), hasDeliveryError: z.boolean() }).strict()),
    selectors: Ev(z.object({
      basic: z.array(z.object({ readWriteType: Str(16), includeManagementEvents: z.boolean() }).strict()),
      advanced: z.array(z.object({ fields: z.array(z.object({ field: Str(64), equals: z.array(Str(64)) }).strict()) }).strict()),
    }).strict()),
  }).strict())),
}).partial().strict();   // 실행하지 않은 문의 섹션은 없다(= 미수집)

/* ---------- Azure data ---------- */
const DiagSetting = z.object({
  name: Str(260),
  logs: z.array(z.object({ category: Str(64).nullable(), categoryGroup: Str(64).nullable(), enabled: z.boolean() }).strict()),
  destinations: z.object({ workspace: z.boolean(), storage: z.boolean(), eventHub: z.boolean(), partner: z.boolean() }).strict(),
}).strict();
const BySub = <T extends z.ZodTypeAny>(item: T) => z.object({ subscription: Uuid, receipt: ReceiptId, items: z.array(item).nullable() }).strict();
const AzureData = z.object({
  storageAccounts: z.array(z.object({
    subscription: Uuid, receipt: ReceiptId, budget: Budget,
    items: z.array(z.object({
      id: AzId, name: z.string().min(3).max(24), kind: Str(32).nullable(), location: Str(64),
      allowBlobPublicAccess: z.boolean().nullable(),   // null = 미설정(차단 아님 → 주의)
      allowSharedKeyAccess: z.boolean().nullable(),
      keyCreationTime: z.object({ key1: IsoUtc.nullable(), key2: IsoUtc.nullable() }).strict().nullable(),
      keyExpirationPeriodInDays: z.number().int().positive().nullable(),
      sasExpirationPeriod: Str(32).nullable(),
      publicNetworkAccess: Str(32).nullable(), networkDefaultAction: Str(16).nullable(),
      containers: Ev(z.array(z.object({ name: Str(63), publicAccess: Str(16).nullable() }).strict())),
      blobDiagnostics: Ev(z.array(DiagSetting)),
    }).strict()).nullable(),
  }).strict()),
  activityLogExports: z.array(BySub(DiagSetting)),
  nsgs: z.array(BySub(z.object({
    id: AzId, name: Str(80), location: Str(64),
    rules: z.array(z.object({
      name: Str(80), direction: Str(16), access: Str(16), priority: z.number().int(), protocol: Str(8),
      sourcePrefixes: z.array(Str(128)), sourceAsgCount: z.number().int().nonnegative(), destPortRanges: z.array(Str(32)),
    }).strict()),
    nicIds: z.array(AzId), subnetIds: z.array(AzId),
  }).strict())),
  nics: z.array(BySub(z.object({ id: AzId, nsgId: AzId.nullable(), ipConfigs: z.array(z.object({ subnetId: AzId.nullable(), publicIpId: AzId.nullable() }).strict()) }).strict())),
  publicIps: z.array(BySub(z.object({ id: AzId, hasAddress: z.boolean(), allocationMethod: Str(16).nullable(), attachedTo: Str(2048).nullable() }).strict())),
}).partial().strict();

/* ---------- 파일 ---------- */
const envelope = { schema: z.string().regex(SCHEMA_RE), collector: Collector, collectedAt: StampZ, run: Run };
export const AwsCollectFile = z.object({
  ...envelope, cloud: z.literal("aws"),
  identity: z.object({
    receipt: ReceiptId,
    accountId: z.string().regex(/^\d{12}$/),   // 전체 보존(KEY-4 외부 계정 판정, Before/After, 실행 식별). 마스킹은 표시·내보내기에서
    partition: z.literal("aws"),               // MVP는 상용 파티션만(aws-cn·aws-us-gov는 수집기가 중단 안내)
    principalType: z.enum(["user", "assumed-role", "root", "federated-user", "unknown"]),
    principalName: Str(128).nullable(),        // 사용자명 또는 역할명. 세션명(대개 이메일)은 버린다
    alias: Ev(Str(63)),
  }).strict(),
  scope: z.object({ regions: Ev(z.array(AwsRegion)), regionsRequested: z.array(AwsRegion).nullable() }).strict(),
  receipts: z.array(AwsReceipt).max(LIMITS.receipts),
  data: AwsData,
}).strict();
export const AzureCollectFile = z.object({
  ...envelope, cloud: z.literal("azure"),
  identity: z.object({
    receipt: ReceiptId, tenantId: Uuid, currentSubscription: Uuid, cloudName: Str(32),
    principalType: z.enum(["user", "servicePrincipal", "managedIdentity", "unknown"]),   // UPN은 수집하지 않는다
  }).strict(),
  scope: z.object({
    subscriptions: Ev(z.array(z.object({
      id: Uuid, name: Str(256), state: Str(32), tenantId: Uuid, inScope: z.boolean(),
      outOfScopeReason: z.enum(["other-tenant", "not-enabled", "not-requested"]).nullable(),
    }).strict())),
    subscriptionsRequested: z.array(Uuid).nullable(),
  }).strict(),
  receipts: z.array(AzureReceipt).max(LIMITS.receipts),
  data: AzureData,
}).strict();
export const CollectFile = z.discriminatedUnion("cloud", [AwsCollectFile, AzureCollectFile]);
export type CollectFile = z.infer<typeof CollectFile>;
export type AwsCollect = z.infer<typeof AwsCollectFile>;
export type AzureCollect = z.infer<typeof AzureCollectFile>;
export type CollectDoor = z.infer<typeof Door>;
/** 실행 식별 키(분할 수집 병합·중복 제거용). run.id 필드를 두지 않고 (cloud, 계정·테넌트, collectedAt)으로 식별한다 */
export const runKey = (f: CollectFile): string =>
  `${f.cloud}|${f.cloud === "aws" ? f.identity.accountId : f.identity.tenantId.toLowerCase()}|${f.collectedAt}`;
