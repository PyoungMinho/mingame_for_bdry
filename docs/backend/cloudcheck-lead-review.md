<!-- STEP 2 팀장회의 검토 원문 (2026-10-19). 종합 결정은 docs/planning/project-direction-cloudcheck.md 가 우선한다. -->

# 백엔드팀장 검토: 「문단속 5」(cloudcheck) STEP 2 팀장회의

> 범위: 수집기(bash), 수집 계약 v1, 룰 엔진·룰 데이터, 픽스처·정답지, 해시·릴리스, 보안. 판정 결과 모델(T2)은 초안만 냅니다(프론트팀장과 합의할 것).
> 표기: [확인] 1차 문서나 로컬 실행으로 확인 / [확인: 로컬] 스크래치패드에서 직접 실행해 확인(macOS bash 3.2.57, jq 1.7.1, zod 3.25.76, tsc 5.9.3) / [일반 지식] 널리 알려진 사양이지만 원문을 다시 열지 않음 / [미확인] 확인 못 함
> 레포는 수정하지 않았습니다. 프로토타입은 스크래치패드(레포 밖)에서만 돌렸습니다.

---

## 0. 결론

1. **수집 계약 v1.0을 아래 §1의 zod 스키마로 확정하자고 제안합니다.** 스키마는 컴파일됐고, 실행해 보니 정상 파일은 통과시키고 다음 경우는 거부했습니다 [확인: 로컬]: 영수증 모순(ok인데 errorCode가 있음, denied인데 코드가 없음, empty인데 count가 0이 아님), 카탈로그 밖 호출(`secretsmanager:GetSecretValue`), 다른 클라우드의 호출, 모르는 섹션, 예산 모순, 계정 ID 형식 오류.
2. **증거 슬롯 규약:** 모든 데이터는 `{receipt, value}` 꼴입니다. 호출이 실패해도 슬롯은 남기고 value를 null로 둡니다. null이 무슨 뜻인지는 영수증 result가 정합니다(notconfigured는 "설정 없음"이라는 유효한 답이고, denied는 답이 아님). 이 규약으로 INV-6과 INV-7을 데이터 구조로 표현합니다.
3. **파일에는 사실(영수증과 데이터)만 담고, 집계는 판정기가 합니다.** 초안의 `regionsSucceeded/regionsFailed`는 영수증에서 계산되는 중복값이라 파일에서 뺍니다. 중복값끼리 서로 어긋나면 그것 자체가 fail-open 경로가 되기 때문입니다.
4. **수집기 호출:** AWS 26종, Azure 9종을 명령 단위 허용 목록 하나(카탈로그)에서 관리합니다. 이 카탈로그 하나가 린터, 예상 발자국 표, 권한 패널, 영수증 `call` enum을 모두 만듭니다. AWS 26개 액션은 전부 관리형 SecurityAudit(v94, 2026-09-30 편집)에 들어 있습니다 [확인: 정책 문서와 문자열 대조].
5. **"오류 삼키기 금지" bash 패턴을 검증했습니다** [확인: 로컬]. `set -euo pipefail` 아래에서 `"$@" <빈파일 >out 2>err || rc=$?`로 종료 코드를 잡고, 오류 메시지에서는 코드 토큰만 BASH_REMATCH로 뽑습니다. 메시지 원문에는 ARN과 SSO 이메일이 들어 있으므로 저장하지 않습니다. jq 투영도 호출 래퍼 안에서 함께 처리하고, 투영이 실패하면 `error/transform-failed` 영수증을 남긴 뒤 다음 호출로 진행합니다.
6. **프로토타입에서 실제 결함을 찾아 설계에 반영했습니다.**
   - ① 린터가 `x=$(aws secretsmanager …)`처럼 `$(` 바로 뒤의 aws를 놓쳐 비밀 명령이 통과했습니다. 보정한 뒤에는 위반 샘플 11종을 모두 잡습니다.
   - ② 단건 조회의 count가 0으로 계산돼 `empty`로 오분류됐습니다. 그래서 래퍼가 목록 경로를 명시적으로 받게 했습니다.
   - ③ 루프 안의 CLI가 루프의 stdin을 먹을 위험이 있습니다. CLI의 stdin은 빈 파일로 돌립니다.
   - ④ 엔진 집계에 위조된 증명 객체가 들어오면 확인 불가로 떨어지지 않고 크래시했습니다.
   - ⑤ jq 1.7.1은 `else` 없는 `if`를 허용합니다. 그래서 로컬 테스트만으로는 CloudShell의 jq 1.6 비호환을 잡을 수 없고, 린터로 막아야 합니다.
7. **수집기는 실계정 없이, 새 패키지 없이 시험할 수 있습니다.** PATH 맨 앞에 가짜 `aws`/`az`/`date`/`sleep`을 두고 실제 bash 수집기를 Node `spawnSync`로 돌리는 방식이 동작했습니다 [확인: 로컬]. 이 맥에는 aws/az CLI가 아예 없어 [확인] 실수로 실제 계정을 부를 위험도 없습니다. moto는 패키지 설치 금지라 쓸 수 없으므로 G4의 "moto 실행"은 "shim 실행 + PM V1 실측"으로 바꿔야 합니다.
8. **macOS bash 3.2를 기준선으로 씁니다.** 빈 배열에 `set -u`면 치명 오류이고 `declare -A`, `mapfile`, `${x,,}`가 없습니다 [확인: 로컬]. 로컬 사용자 환경과 테스트 환경이 같아지므로 3.2 부분집합으로 작성하고 린터로 강제합니다.
9. **INV-1~10은 타입과 집계 core로 강제합니다.** 판정 함수는 룰 상태를 직접 반환하지 못합니다. '없음'(이상 없음·해당 없음)은 `proveScope()`만 발급하는 증명 객체가 있어야 나오고, 이 객체는 WeakSet 등록으로 위조를 막습니다. 예외와 본인 응답은 `evaluate()`의 인자에 아예 없습니다. 9가지 시나리오에서 의도대로 동작했습니다 [확인: 로컬].
10. **T6 수정 제안:** 미사용 자격증명 기준을 90일에서 **45일**로 바꿉니다. 근거는 Security Hub IAM.22, CIS AWS v5.0.0/1.11, v3.0.0/1.12입니다 [확인]. 키 나이 90일은 IAM.3과 일치해 유지합니다 [확인]. 위험 포트는 Security Hub EC2.19 목록 24개 [확인]을 바탕으로 한 2단계안을 냅니다(§6-3).
11. **보안 리뷰에서 새로 찾은 위험:**
    - CLI의 `--endpoint-url`, `--debug`, `--no-verify-ssl`과 프록시·엔드포인트 환경변수는 세션 토큰을 유출할 수 있는 경로입니다. 린터로 금지합니다.
    - Azure 데이터 평면 명령(`az storage container list` 등)은 자격 정보를 주지 않으면 계정 키를 암묵적으로 조회할 수 있습니다. 관리 평면의 `container-rm`만 허용합니다.
    - 숨은 유니코드(bidi·zero-width), 즉 Trojan Source를 바이트 검사로 막습니다.
    - IAM 사용자명에 `__proto__`를 쓸 수 있습니다(밑줄 허용). Map으로만 조회하고 적대 픽스처에 넣습니다.
    - CSP `connect-src 'none'`은 최상위 이동, WebRTC, DNS 프리페치를 통한 유출을 막지 못합니다 [일반 지식]. 그래서 "전송을 막도록 설정" 문구의 범위를 정확히 해야 합니다(프론트팀장과 기획팀장 확인 사항).
12. **T7:** `npm run test:redline`은 지금 실행하면 "No test files found, exiting with code 1"로 실패합니다 [확인: 실행]. cloudcheck 테스트는 전부 `src/lib/cloudcheck/**/*.test.ts`에 두어 `npm run test`에 자동으로 들어가게 합니다 [확인: vitest include]. 레포에 `.github/workflows`가 없으므로 [확인] C-10에서 말하는 "CI"는 실제로는 배포 게이트의 로컬 `npm run test`입니다.

---

## 1. T1 수집 계약 v1.0 확정안

### 1-1. 설계 원칙
- **P1 사실만 담는다:** 영수증과 데이터만 담고, 범위 달성률·성공 리전 같은 집계값은 담지 않는다.
- **P2 슬롯 보존:** 실패해도 `{receipt, value:null}` 슬롯을 남긴다. 영수증 없는 데이터, 데이터 없는 ok 영수증, 실패 영수증 아래의 데이터는 모두 그 섹션을 무효(확인 불가)로 만든다.
- **P3 외부 열거형은 문자열로 받는다:** 예를 들어 IAM 키 상태 `Active|Inactive|Expired`는 문자열로 받고, 판정 함수가 아는 값만 해석한다. 모르는 값이 오면 그 항목만 확인 불가로 둔다. 새 enum 값 하나가 섹션 전체를 회색으로 만들지 않게 하기 위해서다.
- **P4 비밀·식별자 최소화:** 액세스 키 ID는 끝 4자리만, IP 주소는 불리언으로만, 정책은 Principal 값과 Condition 키 이름만 담는다. 오류 메시지 원문, 태그, 설명, UPN은 담지 않는다.
- **P5 `accountId`는 전체를 보존한다:** KEY-4의 자기 계정 판별과 Before/After 비교에 필요하다. 마스킹은 표시·내보내기 단계에서 한다.
- **P6 시각은 엄격 파서로:** 시각은 `Date.parse`가 아니라 자체 엄격 파서로 읽는다. Azure는 소수 초가 7자리이고, AWS CLI v2는 `+00:00`을 붙인다 [일반 지식].

### 1-2. TypeScript 타입 + zod 스키마 (`src/lib/cloudcheck/contract/collect-schema.ts`)
아래 코드는 컴파일과 실행 검증을 마친 그대로입니다 [확인: 로컬]. 구현할 때는 `AWS_CALLS`/`AZURE_CALLS`를 `contract/calls.ts`(메타데이터 포함 카탈로그)로 옮깁니다.

```ts
import { z } from 'zod';

/* ---------- 버전 ---------- */
export const SCHEMA_RE = /^cloudcheck\.collect\/(\d+)\.(\d+)$/;
export const SUPPORTED = { major: 1, maxMinor: 0 } as const;

/* ---------- 호출 카탈로그(린터·발자국 표·권한 패널의 단일 원천) ---------- */
export const AWS_CALLS = [
  'sts:GetCallerIdentity', 'iam:ListAccountAliases', 'ec2:DescribeRegions',
  'iam:GenerateCredentialReport', 'iam:GetCredentialReport', 'iam:GetAccountSummary',
  'iam:ListUsers', 'iam:ListAccessKeys', 'iam:ListMFADevices', 'iam:ListAttachedUserPolicies',
  'iam:ListGroupsForUser', 'iam:ListAttachedGroupPolicies', 'iam:ListRoles',
  'ec2:DescribeSecurityGroups', 'ec2:DescribeNetworkInterfaces',
  's3:GetAccountPublicAccessBlock', 's3:ListAllMyBuckets', 's3:GetBucketLocation',
  's3:GetBucketPublicAccessBlock', 's3:GetBucketPolicyStatus', 's3:GetBucketAcl',
  's3:GetBucketOwnershipControls', 's3:GetBucketWebsite',
  'cloudtrail:DescribeTrails', 'cloudtrail:GetTrailStatus', 'cloudtrail:GetEventSelectors',
] as const;
export const AZURE_CALLS = [
  'azure:account.show', 'azure:account.list', 'azure:storage.account.list',
  'azure:storage.container-rm.list', 'azure:monitor.diagnostic-settings.list',
  'azure:monitor.diagnostic-settings.subscription.list',
  'azure:network.nsg.list', 'azure:network.nic.list', 'azure:network.public-ip.list',
] as const;

/* ---------- 원자 ---------- */
export const RESULTS = ['ok', 'empty', 'notconfigured', 'denied', 'error', 'throttled', 'truncated', 'unsupported'] as const;
export const ReceiptResult = z.enum(RESULTS);
export const ReceiptId = z.string().regex(/^r-\d{4,6}$/);
/** API가 주는 UTC 시각. 소수 초 0~9자리, Z 또는 +00:00. 파싱은 Date.parse가 아닌 자체 엄격 파서로 */
export const IsoUtc = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]00:00)$/);
const Uuid = z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);
const AwsRegion = z.string().regex(/^[a-z]{2}(-[a-z]+)+-\d{1,2}$/);
const AzId = z.string().max(2048).regex(/^\/subscriptions\/[0-9a-fA-F-]{36}\/resourceGroups\/[^/]+\/providers\/.+$/);
const Str = (max: number) => z.string().max(max);
const Door = z.enum(['mfa', 'key', 'net', 'sto', 'log']);
export type Door = z.infer<typeof Door>;

/** 증거 슬롯: 실패해도 슬롯은 남긴다. value=null의 뜻은 영수증 result가 정한다(notconfigured=설정 없음이라는 유효한 답) */
const Ev = <T extends z.ZodTypeAny>(v: T) => z.object({ receipt: ReceiptId, value: v.nullable() }).strict();
const Budget = z.object({ limit: z.number().int().positive(), total: z.number().int().nonnegative(), collected: z.number().int().nonnegative() }).strict()
  .refine((b) => b.collected <= b.total && b.collected <= b.limit, 'budget 모순');

/* ---------- 영수증 ---------- */
const receiptBase = {
  id: ReceiptId,
  region: z.union([z.literal('global'), AwsRegion]).optional(),
  subscription: Uuid.optional(),
  resource: Str(2048).nullable().optional(),
  result: ReceiptResult,
  count: z.number().int().nonnegative().nullable(),
  /** 코드 토큰만. 오류 메시지 원문(ARN·UPN 포함)은 저장하지 않는다 */
  errorCode: z.string().regex(/^[A-Za-z0-9._:-]{1,80}$/).nullable(),
  at: IsoUtc,
};
type R = { result: (typeof RESULTS)[number]; count: number | null; errorCode: string | null };
const receiptRules = (r: R, ctx: z.RefinementCtx) => {
  const bad = (m: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message: m });
  switch (r.result) {
    case 'ok': if (r.errorCode !== null || (r.count !== null && r.count < 1)) bad('ok: errorCode=null, count=null|>=1'); break;
    case 'empty': if (r.errorCode !== null || r.count !== 0) bad('empty: count=0'); break;
    case 'truncated': if (r.count === null) bad('truncated: 받은 만큼 count'); break;
    default: if (r.errorCode === null || r.count !== null) bad(`${r.result}: errorCode 필수, count=null`);
  }
};
export const AwsReceipt = z.object({ ...receiptBase, call: z.enum(AWS_CALLS) }).strict().superRefine(receiptRules);
export const AzureReceipt = z.object({ ...receiptBase, call: z.enum(AZURE_CALLS) }).strict().superRefine(receiptRules);

/* ---------- 공통 봉투 ---------- */
const Collector = z.object({
  name: z.enum(['cloudcheck-aws', 'cloudcheck-azure']),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  sha256: z.string().regex(/^[0-9a-f]{64}$/).nullable(), // 버전 확인용. 보안 증거 아님(INV-10)
  tools: z.object({ cli: Str(64).nullable(), jq: Str(32).nullable(), bash: Str(32).nullable() }).strict(),
}).strict();
const DoorStatus = z.enum(['collected', 'skipped']);
const Run = z.object({
  finishedAt: IsoUtc,
  confirmed: z.enum(['interactive', 'flag-yes']),
  doors: z.object({ mfa: DoorStatus, key: DoorStatus, net: DoorStatus, sto: DoorStatus, log: DoorStatus }).strict(),
}).strict();

/* ---------- AWS data ---------- */
const Pab = z.object({ blockPublicAcls: z.boolean(), ignorePublicAcls: z.boolean(), blockPublicPolicy: z.boolean(), restrictPublicBuckets: z.boolean() }).strict();
const PolicyArn = z.string().max(2048).regex(/^arn:aws[a-z-]*:iam::(aws|\d{12}):policy\//);
const AwsData = z.object({
  credentialReport: z.object({
    generateReceipt: ReceiptId,
    receipt: ReceiptId,
    value: z.object({ generatedTime: IsoUtc, format: z.literal('text/csv'), csv: z.string().max(20_000_000) }).strict().nullable(),
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
      conditionKeys: z.array(Str(256)), // "StringEquals:sts:ExternalId" — 값은 수집하지 않음
    }).strict()).nullable(), // null = 신뢰 정책 형태를 해석하지 못함 → 그 역할만 확인 불가
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
      eniId: z.string().regex(/^eni-[0-9a-f]+$/), groupIds: z.array(Str(64)), hasPublicIp: z.boolean(), hasIpv6: z.boolean(),
      interfaceType: Str(64).nullable(), status: Str(32).nullable(), requesterManaged: z.boolean(),
    }).strict()).nullable(),
  }).strict()),
  accountPublicAccessBlock: Ev(Pab),
  buckets: z.object({
    receipt: ReceiptId, budget: Budget,
    items: z.array(z.object({
      name: z.string().min(3).max(63), createDate: IsoUtc.nullable(),
      region: z.object({ value: AwsRegion.nullable(), source: z.enum(['list', 'location']), receipt: ReceiptId.nullable() }).strict(),
      publicAccessBlock: Ev(Pab),
      policyStatus: Ev(z.object({ isPublic: z.boolean() }).strict()),
      acl: Ev(z.object({ publicGrants: z.array(z.object({ grantee: z.enum(['AllUsers', 'AuthenticatedUsers']), permission: Str(32) }).strict()) }).strict()),
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
}).partial().strict(); // 실행하지 않은 문의 섹션은 없다(= 미수집)

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
      allowBlobPublicAccess: z.boolean().nullable(),   // null = 미설정(차단 아님)
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
const envelope = { schema: z.string().regex(SCHEMA_RE), collector: Collector, collectedAt: IsoUtc, run: Run };
export const AwsCollectFile = z.object({
  ...envelope, cloud: z.literal('aws'),
  identity: z.object({
    receipt: ReceiptId,
    accountId: z.string().regex(/^\d{12}$/), // 전체 보존(KEY-4 외부 계정 판정, Before/After). 마스킹은 표시·내보내기에서
    partition: z.literal('aws'),             // MVP는 상용 파티션만
    principalType: z.enum(['user', 'assumed-role', 'root', 'federated-user', 'unknown']),
    principalName: Str(128).nullable(),      // 사용자명 또는 역할명. 세션명(대개 이메일)은 버린다
    alias: Ev(Str(63)),
  }).strict(),
  scope: z.object({ regions: Ev(z.array(AwsRegion)), regionsRequested: z.array(AwsRegion).nullable() }).strict(),
  receipts: z.array(AwsReceipt).max(100_000),
  data: AwsData,
}).strict();
export const AzureCollectFile = z.object({
  ...envelope, cloud: z.literal('azure'),
  identity: z.object({
    receipt: ReceiptId, tenantId: Uuid, currentSubscription: Uuid, cloudName: Str(32),
    principalType: z.enum(['user', 'servicePrincipal', 'managedIdentity', 'unknown']), // UPN은 수집하지 않음
  }).strict(),
  scope: z.object({
    subscriptions: Ev(z.array(z.object({
      id: Uuid, name: Str(256), state: Str(32), tenantId: Uuid, inScope: z.boolean(),
      outOfScopeReason: z.enum(['other-tenant', 'not-enabled', 'not-requested']).nullable(),
    }).strict())),
    subscriptionsRequested: z.array(Uuid).nullable(),
  }).strict(),
  receipts: z.array(AzureReceipt).max(100_000),
  data: AzureData,
}).strict();
export const CollectFile = z.discriminatedUnion('cloud', [AwsCollectFile, AzureCollectFile]);
export type CollectFile = z.infer<typeof CollectFile>;
```

### 1-3. 영수증 결과 코드 정의

| result | 의미 | count | errorCode | 판정에서의 뜻 |
|---|---|---|---|---|
| ok | 종료 0, JSON 객체, 투영 성공, 목록 1건 이상(단건 조회는 count=null) | null 또는 1 이상 | null | 증거 |
| empty | 위와 같지만 목록 경로 길이가 0 | 0 | null | 완결된 '없음' → 모수 0 증명 재료 |
| notconfigured | "설정 없음" 오류 응답 | null | 필수 | **유효한 답**(INV-6) |
| denied | 권한 거부 | null | 필수 | 답 아님. 같은 계열 다른 리소스가 성공했으면 INV-7(주의) |
| throttled | CLI 재시도 후에도 한도 초과 | null | 필수 | 답 아님 |
| truncated | 받은 응답에 다음 페이지 토큰이 남음 | 받은 수 | null | 양성은 유효, '없음'은 불가 |
| unsupported | 지역·CLI 버전·리소스 종류상 불가 | null | 필수 | 답 아님 |
| error | 그 밖의 전부(합성 코드 포함) | null | 필수 | 답 아님 |

예산 초과(리소스가 너무 많아 일부만 조회)는 영수증이 아니라 섹션의 `budget{limit,total,collected}`로 표기합니다. 조회하지 못한 리소스에는 항목별 영수증이 없으므로 그 항목은 확인 불가가 되고, 룰 수준의 '없음'은 불가합니다.

### 1-4. CLI 오류 → 결과 코드 매핑

**AWS** (stderr의 `An error occurred (CODE)`에서 CODE만 추출 [확인: 로컬]. 종료 코드: 252 문법·미지 파라미터, 253 설정·자격증명, 254 서비스 오류, 255 일반 [확인: AWS CLI 반환 코드 문서])

| result | 코드 |
|---|---|
| denied | AccessDenied, AccessDeniedException, UnauthorizedOperation(EC2), UnauthorizedAccess, AuthFailure(EC2 리전 자격증명 거부), AllAccessDisabled(S3) |
| notconfigured | NoSuchPublicAccessBlockConfiguration(계정·버킷 공개 차단), NoSuchBucketPolicy(get-bucket-policy-status: 정책 없음 = 정책 경유 공개 아님), NoSuchWebsiteConfiguration, OwnershipControlsNotFoundError [첫 항목은 기획서 인용 확인, 나머지 셋은 일반 지식 → PM V1에서 실측] |
| throttled | Throttling, ThrottlingException, ThrottledException, RequestLimitExceeded(EC2), RequestThrottled(Exception), SlowDown(S3), TooManyRequestsException |
| unsupported | OptInRequired, InvalidAction, UnsupportedOperation, UnknownOperationException, NotImplemented, 종료 코드 252·2(CLI가 옛 버전) |
| error | ExpiredToken, InvalidClientTokenId, SignatureDoesNotMatch, RequestExpired, ServiceFailure, InternalError, ServiceUnavailable, NoSuchBucket(목록 이후 삭제), PermanentRedirect·AuthorizationHeaderMalformed(리전 불일치), 폴링 이후의 ReportExpired·ReportInProgress·ReportNotPresent [확인: GetCredentialReport 오류 목록], LimitExceeded [확인: GenerateCredentialReport], 종료 코드 253·255, 합성 코드 `output-not-json`·`transform-failed`·`report-timeout`·`cli-exit-N` |
| truncated | 합성: 응답 어디에든 NextToken, ContinuationToken, Marker가 남거나 IsTruncated=true. CLI v2의 자동 페이지네이션이 정상이면 생기지 않는다 [일반 지식] |

**Azure** (추출 순서: `Code: X` → `ERROR: (X)` → `AADSTS\d+` → "az login" 문구 → `cli-exit-N`. 4가지 형식 모두 bash 3.2에서 추출 확인 [확인: 로컬]. 문구 형식 자체는 [일반 지식]이라 PM V1에서 실측. 종료 코드는 0 성공, 1 일반, 2 파서 오류, 3 리소스 없음(show 계열) [확인: azure-cli README 표]. 3번은 명령마다 일관되지 않다는 보고가 있으나 [2차] 우리는 show로 존재 여부를 판단하지 않으므로 무관)

| result | 코드 |
|---|---|
| denied | AuthorizationFailed, LinkedAuthorizationFailed, AuthorizationPermissionMismatch, Forbidden, InvalidAuthenticationTokenTenant(다른 테넌트 토큰) |
| throttled | TooManyRequests, SubscriptionRequestsThrottled, ResourceRequestsThrottled, TenantRequestsThrottled |
| unsupported | MissingSubscriptionRegistration(리소스 공급자 미등록), FeatureNotSupportedForAccount, NoRegisteredProviderFound, InvalidResourceType, 종료 코드 2 |
| notconfigured | MVP에서는 쓰지 않음. Azure 목록 호출은 '없음'을 빈 배열로 주므로 empty |
| error | ExpiredAuthenticationToken, InvalidAuthenticationToken, AADSTS*, `not-logged-in`, SubscriptionNotFound, ResourceNotFound·ResourceGroupNotFound(경합), 종료 코드 1·3, 합성 코드 |
| truncated | 예산 초과만 해당. az list는 nextLink를 끝까지 따른다 [일반 지식] |

### 1-5. data 섹션 허용 필드(allowlist)와 쓰는 룰

**AWS**

| 섹션 | 담는 필드 | 버리는 것 | 룰 |
|---|---|---|---|
| identity | accountId, partition, principalType, principalName(사용자명·역할명), alias | ARN 세션명(대개 이메일), UserId | 전체, KEY-4 |
| scope.regions | 활성 리전 이름 | — | NET-1 |
| credentialReport | generatedTime, format, **csv 원문(23열)** | — | MFA-1·2, KEY-1·2 |
| accountSummary | Users, Groups, Roles, AccountMFAEnabled, AccountAccessKeysPresent, AccountSigningCertificatesPresent, MFADevicesInUse | 쿼터 키 | MFA-1 교차 확인, 리포트 완결성(사용자 수 대조) |
| iamUsers | userName, createDate, passwordLastUsed, accessKeys[{status, createDate, idSuffix}], mfaDevices.count, attachedPolicyArns, groupNames | 키 ID 전체, MFA 일련번호, Path, Tags | KEY-1·2(실시간, 3번째 키 이상), MFA-2 교차 확인, KEY-3 |
| iamGroups | groupName, attachedPolicyArns | 인라인 정책 | KEY-3 |
| iamRoles | roleName, path, createDate, trust[{effect, actions, notPrincipal, principal{wildcard, aws, service, federated, canonicalUserCount}, conditionKeys}] | 정책 전문, 조건 값, 권한 정책 | KEY-4(나중에 OIDC 룰을 수집기 변경 없이 추가 가능) |
| securityGroups | groupId, groupName, vpcId, ingress[protocol, fromPort, toPort, cidrs, ipv6Cidrs, prefixListIds, sgRefCount] | egress, 규칙 설명, 태그 | NET-1 |
| networkInterfaces | eniId, groupIds, hasPublicIp, hasIpv6, interfaceType, status, requesterManaged | IP·MAC·설명 | NET-1 |
| accountPublicAccessBlock | 불리언 4개 | — | STO-1·2 |
| buckets | name, createDate, region, 버킷 공개 차단 4개, policyStatus.isPublic, acl.publicGrants(AllUsers·AuthenticatedUsers만), ownership.objectOwnership, website.enabled | 정책 전문, canonical ID, 표시명, 웹사이트 문서명 | STO-2(+이름 힌트 라벨) |
| trails | name, trailArn, homeRegion, isMultiRegion, isOrganizationTrail, logFileValidationEnabled, hasCloudWatchLogs, hasCustomEventSelectors, status{isLogging, hasDeliveryError}, selectors{basic, advanced(equals는 eventCategory·readOnly 필드만)} | 버킷명·KMS·데이터 이벤트 대상 ARN | LOG-1 |

**자격증명 리포트 CSV를 원문 그대로 담는 것은 C-07의 명시적 예외로 제안합니다.**
- ① 경로①에서 사용자가 올리는 파일과 완전히 같은 산출물이다.
- ② 비밀 열이 없다(23개 열 목록 [확인: AWS IAM 문서]).
- ③ 따옴표·쉼표 처리를 jq로 하는 것보다 TS 파서 하나(경로 ①·② 공용)로 하는 편이 훨씬 안전하다. IAM 사용자명에는 쉼표가 허용된다 [일반 지식].
- ④ C-11에 따라 나중에 룰이 늘어도 수집기 해시를 바꿀 필요가 없다.
- 열 allowlist는 정규화 단계에서 적용하고, 마스킹 사본과 내보내기에는 정규화된 필드만 씁니다.

**Azure**

| 섹션 | 담는 필드 | 버리는 것 | 룰 |
|---|---|---|---|
| identity | tenantId, currentSubscription, cloudName, principalType | UPN, 표시명, object id | 전체 |
| scope.subscriptions | id, name, state, tenantId, inScope, outOfScopeReason | — | 범위 패널 |
| storageAccounts | id, name, kind, location, allowBlobPublicAccess, allowSharedKeyAccess, keyCreationTime{key1,key2}, keyExpirationPeriodInDays, sasExpirationPeriod, publicNetworkAccess, networkDefaultAction, containers[{name, publicAccess}], blobDiagnostics | 키 값(애초에 읽지 않음), 엔드포인트, 태그 | KEY-1, STO-1·2, LOG-2 |
| activityLogExports | {name, logs[{category, categoryGroup, enabled}], destinations(불리언 4개)} | 대상 리소스 ID | LOG-1 |
| nsgs | id, name, location, rules[name, direction, access, priority, protocol, sourcePrefixes, sourceAsgCount, destPortRanges], nicIds, subnetIds | 기본 규칙(엔진이 고정값을 앎), 목적지 주소 | NET-1 |
| nics | id, nsgId, ipConfigs[{subnetId, publicIpId}] | 사설 IP | NET-1 |
| publicIps | id, hasAddress, allocationMethod, attachedTo | IP 자체, DNS | NET-1 |

`categoryGroup`(audit, allLogs)도 수집합니다. 새 진단 설정 방식에서는 범주 대신 범주 그룹을 쓰기 때문이며, 그룹과 범주의 매핑은 [미확인]이라 DB설계자가 문서로 확인해야 합니다.

### 1-6. CSV 정규화 규칙

**자격증명 리포트 → `IamCredentialRow[]`** (경로 ①·② 공용 파서 `contract/csv/credential-report.ts`)
- **파싱:** RFC 4180(따옴표, 이스케이프된 따옴표, CRLF·LF), BOM 제거, 열은 위치가 아니라 **헤더 이름**으로 매핑(열이 늘어나도 견딤), 크기 상한 20MB.
- **행의 필드 수가 헤더와 다르면:** 그 행은 `GAP_CSV_ROW_AMBIGUOUS`로 확인 불가가 되고, 그 출처의 `scopeProven`은 false가 된다. 추측해서 맞추지 않는다. `additional_credentials_info`가 자유 텍스트라 오른쪽부터 고정 열을 떼어 맞추는 방식도 쓸 수 없다.
- **열 매핑:**

| CSV 열 | 내부 필드 | 규칙 |
|---|---|---|
| user | user, isRoot(= `<root_account>`) | — |
| arn | accountId(ARN에서 12자리 추출) | CSV 경로에서 신원 대체, Before/After 계정 일치 |
| user_creation_time | createdAt: Stamp | KEY-2의 7일 유예 |
| password_enabled | passwordEnabled: true / false / unknown | TRUE·FALSE 외의 값(not_supported 포함)은 unknown. 루트에도 TRUE/FALSE가 나오고, 신규 Organizations 멤버는 FALSE다 [확인: AWS IAM 문서] |
| password_last_used | Stamp | `no_information`은 미사용 또는 2014-10-20 이전. `N/A`는 비밀번호 없음 [확인] |
| mfa_active | true / false / unknown | — |
| access_key_{1,2}_active / _last_rotated / _last_used_date / _last_used_region / _last_used_service | keys[slot] | last_used의 `N/A`는 키 없음·미사용·2015-04-22 이전 [확인]. 리전과 서비스는 고치는 법의 '먼저 확인' 단계 표시에 쓴다 |
| additional_credentials_info | hasAdditional: boolean, 열이 없으면 unknown | 값이 있으면 3번째 키부터는 확인 불가 [확인: 열 존재]. 열이 없을 때 CSV만으로 초록을 줄지는 [미확인] → PM V1에서 실제 CSV 열 구성을 보고 결정(기본은 fail-closed) |
| password_last_changed, password_next_rotation, cert_* | 사용 안 함 | — |

- **필수 열:** user, arn, user_creation_time, password_enabled, password_last_used, mfa_active, access_key_1·2의 active/last_rotated/last_used_date. 하나라도 없으면 그 출처 전체를 `GAP_FIELD_MISSING`으로 확인 불가.
- **scopeProven = true 조건:** 헤더가 유효하고, 모든 행이 파싱되고, 루트 행이 있을 것(리포트에는 항상 루트 행이 있음). 스크립트 경로에서는 추가로 IAM 사용자 행 수가 `accountSummary.Users`와 같아야 한다. 다르면 리포트 생성 이후 사용자가 바뀐 것이므로 false.
- **스크립트 경로에서의 우선순위:**

| 사실 | 1순위 | 2순위 |
|---|---|---|
| MFA 유무 | list-mfa-devices | 리포트 |
| 키 상태·생성일 | list-access-keys(3번째 키 이상 포함) | 리포트 |
| 키 마지막 사용 | 리포트(키 슬롯을 last_rotated와 CreateDate로 조인) | — |
| 비밀번호 마지막 사용 | list-users의 PasswordLastUsed | 리포트 |
| 루트 MFA·키 | 리포트 루트 행 | get-account-summary로 교차 확인. 불일치하면 확인 불가 |

  리포트는 최대 4시간 캐시이고, 4시간 안에 다시 요청하면 기존 리포트를 준다 [확인].
- **asOf(판정 기준 시각):**
  - 수집기: `collectedAt`(신원 확인 직후의 시작 시각). 리포트 신선도 조건 ④는 `collectedAt - generatedTime ≤ 4시간 + 5분`.
  - CSV 경로: 파일명에 시각이 있으면 그 시각, 없으면 `File.lastModified`. 선택한 값과 출처를 NormalizedInput에 고정해 재현성(INV-9)을 지킨다. 콘솔 CSV에 생성 시각이 들어 있는지는 [미확인]이며 PM V1(§16-2 AWS #2)에서 확인한다.

**Resource Graph CSV → 같은 내부 모델, `scopeProven=false` 고정** (권한 없는 리소스를 표시 없이 빼기 때문 [확인: 기획서 R2])

열 이름을 우리가 정하는 공개 쿼리 2개입니다. 아래 열 구성은 [미확인]이며 PM이 Explorer에서 확인합니다.

```kusto
// cc-rg-storage/1
resources
| where type =~ 'microsoft.storage/storageaccounts'
| project ccQuery='cc-rg-storage/1', id, subscriptionId, resourceGroup, name, kind, location,
  allowBlobPublicAccess=tostring(properties.allowBlobPublicAccess),
  allowSharedKeyAccess=tostring(properties.allowSharedKeyAccess),
  key1CreationTime=tostring(properties.keyCreationTime.key1),
  key2CreationTime=tostring(properties.keyCreationTime.key2),
  keyExpirationPeriodInDays=tostring(properties.keyPolicy.keyExpirationPeriodInDays),
  sasExpirationPeriod=tostring(properties.sasPolicy.sasExpirationPeriod)
| order by id asc

// cc-rg-nsg/1  (규칙을 펼침)
resources
| where type =~ 'microsoft.network/networksecuritygroups'
| mv-expand rule = properties.securityRules
| project ccQuery='cc-rg-nsg/1', nsgId=id, subscriptionId, nsgName=name, location,
  ruleName=tostring(rule.name), direction=tostring(rule.properties.direction),
  access=tostring(rule.properties.access), priority=toint(rule.properties.priority),
  protocol=tostring(rule.properties.protocol),
  sourcePrefix=tostring(rule.properties.sourceAddressPrefix), sourcePrefixes=tostring(rule.properties.sourceAddressPrefixes),
  destPortRange=tostring(rule.properties.destinationPortRange), destPortRanges=tostring(rule.properties.destinationPortRanges),
  nicCount=array_length(properties.networkInterfaces), subnetCount=array_length(properties.subnets)
```
- `ccQuery` 상수 열로 우리 쿼리의 버전을 확인한다. 열이 없거나 버전이 다르면 INV-10에 따라 확인 불가.
- 불리언은 대소문자 무시, 빈 칸은 null(allowBlobPublicAccess의 null은 "미설정 = 차단 아님" → 주의). 행 수가 CSV 한도에 닿으면 잘림 배너를 띄운다(한도 값은 [미확인] 파라미터).
- **CSV 경로에서 AZ-NET-1의 최고 상태는 주의로 제안합니다.** 공인 IP 연결을 확인할 수 없기 때문입니다. 조인 쿼리는 v1.1에서 PM 검증을 거친 뒤 검토합니다.

### 1-7. 파싱 절차와 무결성 연결
1. 크기 상한(25MB) → `JSON.parse`(try) → 최상위가 객체인지.
2. `schema`의 메이저가 1이 아니면 **파일 전체를 확인 불가로 하고 배너**(INV-10).
3. 봉투(identity, scope, receipts, run)를 검증한다. 실패하면 파일 전체가 확인 불가. 영수증 id가 중복돼도 같다.
4. data 섹션은 **섹션마다 따로 `safeParse`**한다. 실패한 섹션만 `GAP_SCHEMA`이고 나머지는 계속 쓴다.
5. 연결 검사: ① 모든 `receipt` 참조가 존재하고 call·region·resource가 그 섹션의 기대와 맞아야 한다. ② 실패 영수증 아래에 데이터가 있으면 모순이므로 섹션 무효. ③ ok·empty 영수증에 대응하는 데이터가 없으면 `GAP_FIELD_MISSING`.
6. 비밀 패턴 검사(R-12): 우리 수집기는 `AKIA…` 전체를 절대 출력하지 않는다. 그래서 감지되면 "수정되었거나 다른 도구로 만든 파일" 배너를 띄운다.

### 1-8. 스키마 버전 정책
- `schema: "cloudcheck.collect/<major>.<minor>"`. 수집기 버전(`collector.version`, semver)과는 별개다.
- **patch:** 주석만 바뀌고 출력은 그대로(해시는 바뀜). **minor:** 필드·섹션 추가만. **major:** 이름 변경·삭제·의미 변경.
- 판정기가 지원하는 범위는 `{major:1, maxMinor:N}`이다.
  - 파일의 minor가 N보다 크면: 알려진 필드만 쓰고 모르는 키는 제거(strip 모드)하며 "새 수집기 파일 — 일부 무시" 배너를 띄운다.
  - minor가 작으면: 없는 섹션은 미수집으로 처리한다.
  - 구현: 스키마를 `makeSchemas('strict' | 'strip')` 팩토리로 만든다.
- 판정 로직(룰)을 바꿔도 스키마는 바뀌지 않는다. 룰은 페이지 릴리스로 관리한다.

---

## 2. 수집기 설계

### 2-1. 파일 구조 (`cloudcheck-aws.sh`, 섹션은 문 단위)
```
0 머리: shebang · set -euo pipefail · umask 077 · LC_ALL=C · AWS_PAGER="" · AWS_RETRY_MODE=standard · AWS_MAX_ATTEMPTS=6 · 버전 상수
1 공용 함수: classify / call / confirm / progress(stderr에 개수만 출력)
2 준비: 인자(--doors --regions --yes --print --help --version), command -v jq·aws, 도구 버전 기록, 자기 해시(sha256sum 또는 shasum -a 256, 없으면 null)
3 신원(C-05): sts get-caller-identity → iam list-account-aliases → 화면 표시 → confirm. 실패하면 중단. 파티션이 aws가 아니면 중단(MVP), 루트면 경고 후 진행
4 범위: ec2 describe-regions(기본값 = 활성 리전). 거부되면 --regions를 쓰거나 현재 리전만 보고, 범위 미증명으로 표시
5 현관+열쇠(mfa|key): 리포트 생성 폴링 → 리포트 → 계정 요약 → 사용자 루프(키·MFA·정책·그룹) → 그룹 루프 → (key) 역할
6 창문(net): 리전 루프(보안 그룹, ENI)
7 창고(sto): 계정 공개 차단 → 버킷 목록 → 버킷 루프(5~6회 호출)
8 CCTV(log): trail 목록(shadow 포함) → trail 루프(상태, 이벤트 선택기, 홈 리전으로)
9 조립: jq -n --slurpfile … > 임시파일 → mv → 경로 출력 → (선택) --print → (대화형) "내려받았으면 Enter: 이 파일 삭제"(C-12)
main "$@"   ← 마지막 줄. 파일이 중간에 잘리면 아무 것도 실행되지 않는다 [확인: 로컬 — 잘린 파일은 문법 오류, 호출 0건]
```
- 분량: AWS 약 220~250줄, Azure 약 170줄로 예상합니다. 린터의 하드 상한은 260줄로 제안합니다(C-01 "약 200줄" 완화).

### 2-2. AWS 호출 26종 (공통: `--output json`. `get-caller-identity`를 뺀 전부가 SecurityAudit에 포함 [확인])

| # | 문 | 명령 | 영수증 call | 횟수 |
|---|---|---|---|---|
| 1 | 신원 | sts get-caller-identity | sts:GetCallerIdentity | 1 |
| 2 | 신원 | iam list-account-aliases | iam:ListAccountAliases | 1 |
| 3 | 범위 | ec2 describe-regions | ec2:DescribeRegions | 1 |
| 4 | mfa·key | iam generate-credential-report (STARTED/INPROGRESS/COMPLETE 폴링, 최대 10회, 2초 간격 [State 값 확인]) | iam:GenerateCredentialReport | 1~10, **유일한 비조회 호출** |
| 5 | mfa·key | iam get-credential-report (`Content`는 Base64 [확인] → jq `@base64d`로 디코드) | iam:GetCredentialReport | 1 |
| 6 | mfa·key | iam get-account-summary | iam:GetAccountSummary | 1 |
| 7 | mfa·key | iam list-users | iam:ListUsers | 1 |
| 8~11 | mfa·key | iam list-access-keys / list-mfa-devices / list-attached-user-policies / list-groups-for-user `--user-name U` | 각각 | 사용자 수 × 4 |
| 12 | key | iam list-attached-group-policies `--group-name G` | — | 그룹 수 |
| 13 | key | iam list-roles | iam:ListRoles | 1 |
| 14·15 | net | ec2 describe-security-groups / describe-network-interfaces `--region R` | 각각 | 리전 수 × 2 |
| 16 | sto | s3control get-public-access-block `--account-id A` | s3:GetAccountPublicAccessBlock | 1 |
| 17 | sto | s3api list-buckets (페이지 옵션 없이 호출하고 응답의 ContinuationToken으로 잘림 판정) | s3:ListAllMyBuckets | 1 |
| 18 | sto | s3api get-bucket-location (응답에 BucketRegion이 없을 때만) | s3:GetBucketLocation | 0~버킷 수 |
| 19~23 | sto | s3api get-public-access-block / get-bucket-policy-status / get-bucket-acl / get-bucket-ownership-controls / get-bucket-website `--bucket B --region BR` | 각각 | 버킷 수 × 5 |
| 24 | log | cloudtrail describe-trails | cloudtrail:DescribeTrails | 1 |
| 25·26 | log | cloudtrail get-trail-status `--name ARN` / get-event-selectors `--trail-name ARN` (`--region HomeRegion`) | 각각 | trail 수 × 2 |

- **실시간 사용자별 호출을 추가한 이유:** 리포트에는 처음 2개 키만 들어가고, AWS가 "완전한 가시성을 원하면 ListAccessKeys를 쓰라"고 명시합니다 [확인]. 리포트의 4시간 캐시에 대한 교차 확인도 겸합니다(기획서가 API설계자에게 맡긴 방식 결정).
- **키 ID 처리:** 키 ID는 수집기 프로세스 안에서만 쓰고 끝 4자리만 남깁니다. `get-access-key-last-used`는 전체 키 ID가 필요하므로 쓰지 않습니다.
- **ListBuckets:** 페이지네이션된 요청은 BucketRegion을 돌려주고, 버킷 한도가 10,000을 넘는 계정에서는 페이지 없는 요청이 거부됩니다 [확인: 2024-10 공지]. CLI 버전에 따라 동작이 달라지므로 BucketRegion이 없으면 get-bucket-location으로 대체합니다. 위치 값 null은 us-east-1, "EU"는 eu-west-1로 jq에서 변환합니다.
- **예상 소요:** 사용자 20, 리전 17, 버킷 30, trail 2 기준 약 310회 호출. CLI를 한 번 띄울 때의 지연은 [미확인]이라 PM V1에서 실측합니다.
- **예산(도구 기준, PM V1 실측 후 조정):** 사용자 150, 버킷 300.

### 2-3. Azure 호출 9종 (공통: `--only-show-errors -o json`, `--subscription S`를 명시. `az account set`은 로컬 기본값을 바꾸는 쓰기라 쓰지 않음)

| # | 문 | 명령 | 횟수 | RBAC 액션(모두 */read → Reader에 포함은 [미확인], PM V1에서 확인) |
|---|---|---|---|---|
| 1 | 신원 | az account show | 1 | 로컬 |
| 2 | 범위 | az account list --all (`--refresh`를 쓸지는 [미확인]) | 1 | subscriptions/read |
| 3 | key·sto·log | az storage account list | 구독 수 | Microsoft.Storage/storageAccounts/read |
| 4 | sto | az storage container-rm list `--storage-account <리소스ID>` (관리 평면, Microsoft.Storage 리소스 공급자, 이름 또는 ID 허용 [확인]) | 계정 수 | …/blobServices/containers/read |
| 5 | log | az monitor diagnostic-settings list `--resource <ID>/blobServices/default` | 계정 수 | Microsoft.Insights/diagnosticSettings/read |
| 6 | log | az monitor diagnostic-settings subscription list (Core GA [확인]. 출력은 `value` 래퍼일 수 있어 `(.value? // .)`로 정규화 [미확인]) | 구독 수 | 같음 |
| 7~9 | net | az network nsg list / nic list / public-ip list | 구독 수 × 3 | 각 */read |

- **범위 처리:** 현재 테넌트에 속하고 Enabled인 구독만 조회합니다. 나머지는 `outOfScopeReason`(other-tenant, not-enabled, not-requested)과 함께 기록만 합니다.
- **예산:** 구독 20개, 구독당 스토리지 계정 100개.
- 세션 한정으로 `AZURE_CORE_COLLECT_TELEMETRY=false`를 설정하자고 제안합니다(환경변수 이름은 [미확인]).

### 2-4. 순회·페이지네이션·잘림
- AWS CLI v2는 페이지네이션이 있는 명령을 끝까지 자동으로 따라갑니다 [일반 지식]. 그래도 응답에 토큰이 남으면 `truncated`로 둡니다(옛 CLI 대비).
- `--max-items`는 쓰지 않습니다. 시간 상한은 우리 예산으로 관리합니다.
- 리전·구독·리소스 루프는 결정적으로(이름순) 돌고, 매번 영수증을 남깁니다. 중간에 실패해도 다음으로 넘어갑니다.
- **중단 처리:** 수집기 내부 버그나 Ctrl+C로 중단되면 결과 파일을 만들지 않고 임시 디렉터리만 지웁니다. 개별 호출의 실패는 중단 사유가 아니므로 이런 경우는 드뭅니다.

### 2-5. 오류를 삼키지 않는 bash 패턴 (검증본)
아래 래퍼는 bash 3.2.57, jq 1.7.1, 가짜 aws 조합에서 실행 검증한 구조와 같고 [확인: 로컬], 오류 코드 목록만 §1-4 표대로 늘리면 됩니다.

```bash
# call <영수증 call> <리전> <리소스|-> <목록 경로|-> <jq 투영> -- <명령...>
# 결과: 영수증 1줄 추가, $TMP/val = {receipt, value}(실패·설정 없음이면 value=null)
call() {
  local label=$1 region=$2 res=$3 cpath=$4 proj=$5 rc=0 count=null; shift 6
  N=$((N + 1)); LAST_ID=$(printf 'r-%04d' "$N"); CODE=""
  "$@" <"$TMP/empty" >"$TMP/out" 2>"$TMP/err" || rc=$?
  printf 'null' >"$TMP/v"
  if [ "$rc" != 0 ]; then
    classify "$rc"
  elif jq -c --arg cp "$cpath" "{n: (if \$cp == \"-\" then null else (getpath(\$cp | ltrimstr(\".\") | split(\".\")) // [] | length) end),
        t: ([.. | objects | select(has(\"NextToken\") or has(\"ContinuationToken\") or .IsTruncated == true)] | length > 0),
        v: ($proj)}" "$TMP/out" >"$TMP/meta" 2>"$TMP/jqerr"; then
    count=$(jq '.n' "$TMP/meta"); jq -c '.v' "$TMP/meta" >"$TMP/v"
    RESULT=ok
    if [ "$count" = 0 ]; then RESULT=empty; fi
    if [ "$(jq '.t' "$TMP/meta")" = true ]; then RESULT=truncated; fi
  else
    RESULT=error; CODE=transform-failed
  fi
  jq -nc --arg id "$LAST_ID" --arg call "$label" --arg region "$region" --arg res "$res" --arg result "$RESULT" \
    --arg code "$CODE" --argjson count "$count" --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{id:$id, call:$call, region:$region, resource:(if $res == "-" then null else $res end), result:$result,
      count:(if $result == "ok" or $result == "empty" or $result == "truncated" then $count else null end),
      errorCode:(if $code == "" then null else $code end), at:$at}' >>"$TMP/receipts.jsonl"
  jq -c --arg r "$LAST_ID" '{receipt:$r, value:.}' "$TMP/v" >"$TMP/val"
}
classify() {   # 코드 토큰만 추출(메시지 원문은 버림)
  local rc=$1 msg re='An error occurred \(([A-Za-z0-9._]+)\)'
  msg=$(head -c 4000 "$TMP/err"); CODE="cli-exit-$rc"
  if [[ $msg =~ $re ]]; then CODE=${BASH_REMATCH[1]}; fi
  case "$CODE" in
    AccessDenied|AccessDeniedException|UnauthorizedOperation|AuthFailure) RESULT=denied ;;
    NoSuchPublicAccessBlockConfiguration|NoSuchBucketPolicy|NoSuchWebsiteConfiguration|OwnershipControlsNotFoundError) RESULT=notconfigured ;;
    Throttling|ThrottlingException|RequestLimitExceeded|SlowDown|TooManyRequestsException) RESULT=throttled ;;
    OptInRequired|InvalidAction|UnsupportedOperation|cli-exit-252|cli-exit-2) RESULT=unsupported ;;
    *) RESULT=error ;;
  esac
}
confirm() {    # C-05: 대화형이면 Enter, 아니면 --yes가 있어야 진행
  if [ "$YES" = 1 ]; then return 0; fi
  if [ -t 0 ]; then read -r -p "이 계정이 맞습니까? [Enter=계속 / Ctrl+C=중단] " _; return 0; fi
  echo "대화형 터미널이 아니면 --yes가 필요합니다. 아무 것도 수집하지 않고 끝냅니다." >&2; exit 3
}
# 사용 예: call s3:GetBucketAcl "$r" "$b" - '{publicGrants:[.Grants[]? | select(.Grantee.URI? // "" | test("/global/(AllUsers|AuthenticatedUsers)$")) | {grantee:(.Grantee.URI|split("/")|last), permission:.Permission}]}' -- aws s3api get-bucket-acl --bucket "$b" --region "$r" --output json
```

`set -e`와의 관계는 다음과 같습니다.
- `set -euo pipefail`은 유지해 미정의 변수나 파이프 실패 같은 프로그래밍 오류는 즉시 멈추게 합니다.
- 호출 실패는 정상 흐름이므로 `|| rc=$?`로 받습니다. 이 형태 말고는 `||`를 쓰지 않는다는 스타일 규칙을 둡니다(린터가 강제).
- 투영을 래퍼 밖의 `x=$(jq …)` 대입문에서 하면, 실패할 때 `set -e` 때문에 전체가 중단됩니다. 조건문 안의 명령 치환에서 실패하면 빈 출력이 오분류됩니다. 그래서 투영은 반드시 래퍼 안에서 하고, 종료 코드를 검사합니다 [확인: 로컬 — 잘못된 Base64는 `error/transform-failed`가 되고 다음 호출로 진행].
- **검증된 동작** [확인: 로컬]:
  - 버킷별로 notconfigured, throttled, denied가 각각 별도 영수증으로 남았다.
  - 리포트 폴링이 STARTED → INPROGRESS → COMPLETE로 끝났다.
  - SSO 세션 이메일, canonical owner ID, 태그, 규칙 설명의 XSS 문자열이 출력에 없었다.
  - 비대화형인데 `--yes`가 없으면 신원 호출 1건 뒤 exit 3으로 끝나고 파일이 생기지 않았다.

### 2-6. 신원·플래그·출력
- **확인 화면:** 계정 ID 전체, 별칭, 실행 주체 유형·이름, 활성 리전 수를 보여 줍니다(Azure는 테넌트, 현재 구독, 조회할 구독 수). Azure 구독 이름 같은 자유 텍스트는 jq로 JSON 이스케이프해서 출력합니다(터미널 이스케이프 주입 방지).
- **플래그:**
  - `--doors mfa,key,net,sto,log`: 신원과 범위 확인은 항상 실행합니다. mfa나 key 중 하나라도 있으면 리포트 섹션을 실행합니다.
  - `--regions`(AWS), `--subscriptions`(Azure): 일부만 조회하면 범위 미증명이 됩니다.
  - `--yes`, `--print`(경로 ③용으로 결과 JSON을 표준출력에도), `--help`, `--version`.
- **출력:** `cloudcheck-aws-<ID 끝4>-<YYYYMMDDTHHMMSSZ>.json`(Azure는 테넌트 끝 4자리), 권한 600. 임시파일을 만든 뒤 mv합니다.
- **CLI 버전:** AWS CLI v1이면 경고하고 진행합니다(분류가 stderr 문구 기준이라 동작함). 버전은 `tools.cli`에 기록합니다.

### 2-7. 명령 린터 (C-03/C-04) — `collector/lint.ts`(순수 함수) + `lint.test.ts`
TS로 구현해 보고 골격과 위반 샘플에 돌려 보았습니다 [확인: 로컬]. 보정 후 위반 샘플 11종(aws-outside-call, bash4-only, endpoint, exec, invisible-char, jq16-if-else, net-tool, not-allowlisted, secret-cmd, swallow, `||` 규칙)을 모두 잡았습니다.

| 규칙 | 내용 |
|---|---|
| L-01 머리·꼬리 | 1행 `#!/usr/bin/env bash`, 앞 8줄 안에 `set -euo pipefail`·`umask 077`, 마지막 비어 있지 않은 줄은 `main "$@"`, 260줄 이하, CR 없음 |
| L-02 바이트 | UTF-8, BOM 없음, LF만, bidi·zero-width 문자(U+200B–200F, U+202A–202E, U+2066–2069, U+FEFF) 금지(Trojan Source) |
| L-03 주석 | 주석은 줄 전체로만(행 끝 주석 금지). 모든 `call` 바로 위 1~2줄 안에 "무엇을 왜" 주석(C-01) |
| L-04 클라우드 호출 추출 | `(^|[\s;|&(\`"'])aws\s+svc\s+op` 패턴으로 추출한다. **`$(aws` 우회는 프로토타입에서 실제로 뚫렸던 경로**라 반드시 이 패턴이어야 한다. 줄마다 `aws` 단어 수가 `-- aws` 수와 같아야 한다(즉 모든 호출이 call 래퍼를 거침). az는 `-`, `$`, `"`가 나오기 전까지의 토큰 경로로 추출 |
| L-05 허용 목록 | 추출한 명령 집합 = 카탈로그 집합(**완전 일치**. 미사용 카탈로그 항목도 실패). call 라벨 = 카탈로그 액션. 모든 호출에 `--output json`(az는 `-o json --only-show-errors`). 동사는 get, list, describe, show만 허용하고, 예외는 `iam generate-credential-report` 1건 |
| L-06 비밀 반환 금지 목록 | AWS: secretsmanager get-secret-value, ssm get-parameter(s)/-by-path, lambda get-function(-configuration), ec2 describe-instance-attribute·get-password-data·get-console-output, sts assume-role·get-session-token·get-federation-token, configure export-credentials, ecr get-login-password, codeartifact get-authorization-token, rds generate-db-auth-token, eks get-token. Azure: storage account keys·show-connection-string·generate-sas, storage container generate-sas·**list(데이터 평면)**, storage blob(전체), keyvault secret, account get-access-token, webapp deployment list-publishing-profiles, functionapp keys, cosmosdb keys, redis list-keys, acr credential, aks get-credentials, rest, graph. 테스트로 허용 목록과의 교집합이 0임을 검사(두 곳을 함께 고쳐야만 추가 가능) |
| L-07 외부 명령 화이트리스트 | 명령 위치에 올 수 있는 것은 aws·az(call 경유), jq, date, mktemp, head, cat, mv, rm(임시 디렉터리 정리와 결과 삭제 확인 2곳), sleep, sha256sum·shasum, 그리고 bash 내장 명령만 |
| L-08 송신·실행·인코딩 금지 | curl, wget, nc, ncat, socat, ssh, scp, sftp, rsync, ftp, telnet, openssl, dig, nslookup, host, ping, `/dev/tcp`·`/dev/udp`. python, perl, ruby, node, php, pwsh, **awk·sed**(gawk의 `/inet`, GNU sed의 `e` 명령), xargs. eval, source, `.`, exec, `bash -c`, alias, builtin, sudo, nohup, 백그라운드 `&`. base64, xxd, od, gzip, zcat(디코드는 jq `@base64d` 1곳만 허용) |
| L-09 오류 삼키기 금지 | `/dev/null`(아예 금지), `|| true`·`|| :`·줄 끝 `||`, `set +e`·`set +o`, `2>&-`. `||`는 `|| rc=$?` 형태만 허용 |
| L-10 덤프·우회 금지 | env, printenv, 단독 `set`, `declare -p`, `export -p`, compgen, history. `PATH=` 대입, `${!`(간접 참조), 백틱, `aws()`/`az()`/`jq()` 재정의 |
| L-11 **엔드포인트 변조 금지(신규)** | `--endpoint-url`, `--debug`, `--no-verify-ssl`, `--ca-bundle`, `AWS_ENDPOINT_URL*`, `HTTP(S)_PROXY`, `REQUESTS_CA_BUNDLE`, `AZURE_CLI_DISABLE_CONNECTION_VERIFICATION`, `az cloud register/set`. 서명된 요청이 세션 토큰 헤더와 함께 다른 곳으로 나갈 수 있는 경로다 [일반 지식] |
| L-12 bash 3.2 호환 | `declare/local -A·-n`, mapfile, readarray, `${x,,}`·`${x^^}`, `[[ -v`, coproc, `;;&`, `|&`, `&>>`, `wait -n`, `EPOCH*`, `printf '%(`. 배열은 `"$@"` 외에는 쓰지 않음 |
| L-13 jq 1.6 호환 | 작은따옴표 안의 jq 프로그램만 따로 뽑아 검사한다(같은 줄의 bash `if` 오탐을 프로토타입에서 확인했음). 모든 `if`에 `else`가 있어야 하고, 1.7+ 내장 함수(pick, abs, toarray, trim·ltrim·rtrim, have_decnum, `$__loc__`, @base32d, 2인자 splits·scan) 금지 |
| L-14 출력 규율 | 리다이렉트 대상은 `"$TMP/…"`, `"$OUT_TMP"`, `&2`만. 최종 `mv` 1회 |

- **vitest에서 돌리는 방법:**
  - `lint.test.ts`가 `fs.readFileSync`로 두 수집기를 읽어 `lintCollector()`의 findings가 비었는지 검사합니다.
  - **"린터의 린터":** 규칙마다 위반 샘플을 하나 이상 두고 반드시 잡히는지 검사합니다.
  - **발자국 표:** `footprint.ts`가 카탈로그(cli, IAM/RBAC 액션, CloudTrail 이벤트명, 문, 호출 단위)에서 표를 만들고, 스냅샷 테스트로 표와 스크립트가 어긋나지 않게 합니다.
- **정적 린트의 한계:** 셸 난독화를 정적으로 다 잡을 수는 없습니다. 그래서 2차 방어로 **shim 실행 테스트가 실제로 호출된 모든 명령을 기록하고, 그것이 카탈로그에 속하는지** 검사합니다(§3).

---

## 3. 수집기 테스트 전략 (실계정 없이, 새 패키지 없이)

### 3-1. 로컬 환경 사실 [확인]
bash 3.2.57(`/bin/bash`, brew bash 없음), jq 1.7.1-apple(`/usr/bin/jq`), node v22.10.0(.nvmrc 22), aws·az CLI 없음, `timeout` 명령 없음(spawnSync의 timeout 옵션을 쓴다), `/sbin/sha256sum` 있음, esbuild·vite 바이너리 있음, vitest 환경은 node이고 setup이 jest-dom을 불러온다(무해).

### 3-2. 가짜 CLI shim 방식 [확인: 로컬에서 동작]
- **테스트 도우미 `collector/__tests__/run.ts`:**
  - `mkdtemp`로 임시 디렉터리를 만들고 `bin/`에 `aws`·`az`·`date`(고정 시각)·`sleep`(즉시 반환)을 쓴 뒤 chmod 755. 레포의 실행 비트에 기대지 않는다.
  - `spawnSync('/bin/bash', [script, '--yes'], {env: {PATH: tmp/bin:/usr/bin:/bin, HOME: tmp/home, AWS_CONFIG_FILE: '/nonexistent', AWS_SHARED_CREDENTIALS_FILE: '/nonexistent', CC_SCENARIO, CC_SHIM_LOG}, timeout: 30000})`. 환경을 최소화해 실제 자격증명이 섞일 여지를 없앤다.
  - vitest 테스트의 timeout도 30초로 설정한다.
- **시나리오:** TS 빌더로 만든 JSON 하나에 `"svc op[#리소스][@리전]": {stdout, stderr, rc}` 또는 순차 응답 배열(폴링용)을 담습니다. shim은 bash와 jq로 키를 찾습니다. **시나리오에 없는 호출은 rc 99와 `UNEXPECTED CALL`로 응답하고, 테스트가 이를 실패로 잡습니다.** shim 로그에는 모든 argv를 남깁니다.
- `date` shim 덕분에 출력이 결정적이 되어 **골든 스냅샷을 정확히 비교**할 수 있습니다. 수집기 안에 테스트용 훅을 넣지 않습니다.

### 3-3. 테스트 매트릭스
- **AWS:** ① 정상(가짜 회사 A) → zod strict 통과 + 스냅샷. ② 신원 외 전부 거부. ③ 리전 하나만 UnauthorizedOperation. ④ list-buckets에 ContinuationToken. ⑤ ThrottlingException. ⑥ rc 252(옛 CLI). ⑦ stdout이 JSON 아님. ⑧ 버킷 3개 중 1개만 ACL·정책 상태 거부(INV-7 패턴). ⑨ 리포트 폴링 순서와 시간 초과. ⑩ **독이 든 응답**: Tags, PolicyDocument, 전체 AccessKeyId, SecretAccessKey 형태 문자열, IP, Description XSS, Owner ID를 넣고 출력에 하나도 없는지, `AKIA[0-9A-Z]{16}`이 없는지 확인. ⑪ jq 없음 → 클라우드 호출 0건으로 종료. ⑫ aws 없음. ⑬ `--doors net`이면 신원·범위·net만 호출. ⑭ 비대화형인데 `--yes` 없음 → 신원 1건 뒤 종료, 파일 없음. ⑮ `$(touch PWNED)` 같은 리소스명 → PWNED 파일이 생기지 않음. ⑯ 사용자 200명 → 예산 150, 나머지 항목은 영수증 없음. 추가로 모든 호출 argv에 `--output json`이 있고 금지 플래그가 없는지 확인.
- **Azure:** 정상, 구독 하나만 AuthorizationFailed, MissingSubscriptionRegistration, 특정 계정만 container-rm 거부(INV-7), 429, 진단 설정의 `{"value":[]}`와 `[]` 두 형태, az 종료 코드 2, 다른 테넌트 구독(호출하지 않고 범위 밖으로 기록).
- **통합(D7):** 셤 시나리오로 수집기를 돌린 출력이 DB설계자의 가짜 회사 픽스처와 같은지 비교합니다(시각 정규화 후). 픽스처가 "수집기가 실제로 만들 수 있는 파일"인지 보증하는 장치입니다.

### 3-4. bash 3.2 / CloudShell / jq 제약
| 항목 | 사실 | 대응 |
|---|---|---|
| macOS bash 3.2 | 빈 배열 + `set -u`는 치명 오류(rc 127), `declare -A`·`mapfile`·`${x,,}` 없음 [확인: 로컬]. 정규식은 변수에 담아 `[[ =~ $re ]]`로 쓰면 3.2에서 동작 [확인: 로컬] | L-12. 로컬 테스트가 곧 3.2 테스트 |
| AWS CloudShell | Amazon Linux 2023, bash가 기본 셸, jq 사전 설치, 버전은 문서화하지 않음, 홈 1GB 영구 [확인: AWS 문서]. wget·ssh도 깔려 있음 [확인] | 송신 도구 금지 린트(L-08)가 필요한 이유. 결과 파일 삭제 안내(C-12) |
| CloudShell jq 버전 | 1.6일 가능성 [미확인] | L-13 + PM V1에서 `jq --version` 기록(§16-2 AWS #1과 동일). `@base64d`는 jq 1.6에서 추가 [일반 지식]. 실패하면 `transform-failed` → MFA·KEY 룰은 확인 불가로 떨어지고 경로① CSV를 안내(fail-closed) |
| BSD와 GNU 차이 | date -d, sed -i, grep -P, readlink -f, stat, xargs -r, timeout이 서로 다름 | 아예 쓰지 않음. `date -u +%Y-%m-%dT%H:%M:%SZ`만 사용 |
| moto | 새 패키지 금지라 사용 불가 | **G4의 "moto 실행"을 "shim 실행 + PM V1"로 수정** |

---

## 4. 룰 엔진·룰 데이터 아키텍처

### 4-1. 엔진 타입과 ScopeProof (`engine/types.ts`, `proof.ts`, `aggregate.ts`) — 컴파일·실행 검증 [확인: 로컬]
```ts
export type State = 'risk' | 'warn' | 'clear' | 'unknown' | 'na'; // 위험·주의·이상 없음·확인 불가·해당 없음
declare const proofBrand: unique symbol;
/** '없음'(이상 없음·해당 없음)을 말할 자격. engine/proof.ts만 만들 수 있다 */
export interface ScopeProof { readonly [proofBrand]: true; readonly family: string; readonly population: number; readonly receipts: readonly ReceiptId[] }
export interface Gap { readonly gaps: readonly GapReason[] }
export type ItemFinding =
  | { state: 'risk' | 'warn'; resource: ResourceRef; reasons: string[]; evidence: ReceiptId[]; labels?: string[] }
  | { state: 'clear'; resource: ResourceRef; reasons: string[]; evidence: [ReceiptId, ...ReceiptId[]] }
  | { state: 'unknown'; resource: ResourceRef; reasons: GapReason[]; evidence: ReceiptId[] };
/** 판정 함수는 항목과 범위 증명(또는 구멍)만 돌려준다. 룰 상태는 core가 계산한다 */
export interface RuleOutcome { items: ItemFinding[]; coverage: ScopeProof | Gap }

const minted = new WeakSet<object>();
export function proveScope(cov: FamilyCoverage | undefined): ScopeProof | Gap {
  if (!cov) return { gaps: ['GAP_NOT_COLLECTED'] };
  if (!cov.complete || cov.population === null || cov.gaps.length > 0) return { gaps: cov.gaps.length ? cov.gaps : ['GAP_SOURCE_SCOPE_UNPROVEN'] };
  const p = Object.freeze({ family: cov.family, population: cov.population, receipts: Object.freeze([...cov.receipts]) });
  minted.add(p);
  return p as unknown as ScopeProof;
}
export const isGenuineProof = (x: unknown): x is ScopeProof => typeof x === 'object' && x !== null && minted.has(x);

export function aggregate(def: RuleDefLite, out: RuleOutcome, okReceipts: ReadonlySet<ReceiptId>): RuleResult {
  // 1) 증거 없는 '이상 없음' 항목은 확인 불가로 강등(판정 함수 버그 방어)
  const items: ItemFinding[] = out.items.map((i) =>
    i.state === 'clear' && !i.evidence.every((r) => okReceipts.has(r))
      ? { state: 'unknown', resource: i.resource, reasons: ['GAP_CLEAR_WITHOUT_EVIDENCE'], evidence: i.evidence } : i);
  const base = { ruleId: def.id, items };
  // 2) 양성은 부분 데이터에서도 유지(INV-4). maxState로 상한
  const pos = items.filter((i) => i.state === 'risk' || i.state === 'warn');
  if (pos.length) {
    const worst = pos.some((i) => i.state === 'risk') ? 'risk' : 'warn';
    const state: State = RANK[worst] > RANK[def.maxState] ? def.maxState : worst;
    return { ...base, state, reasons: [...new Set(pos.flatMap((i) => i.reasons))], proven: isGenuineProof(out.coverage), population: null };
  }
  // 3) 그 외에는 확인 불가에서 시작(INV-1). 진짜 증명이 있어야만 승격
  const unknown = (gaps: GapReason[]): RuleResult => ({ ...base, state: 'unknown', reasons: gaps, proven: false, population: null });
  if (def.maxState === 'unknown') return unknown(['GAP_GUIDE_CARD']);
  if (!isGenuineProof(out.coverage)) {
    const g = (out.coverage as Partial<Gap> | null)?.gaps; // 위조·손상된 증명도 크래시 없이 확인 불가로
    return unknown(Array.isArray(g) && g.length ? [...g] : ['GAP_SOURCE_SCOPE_UNPROVEN']);
  }
  const proof = out.coverage;
  if (proof.population === 0) return { ...base, state: 'na', reasons: [], proven: true, population: 0 }; // INV-5
  if (items.some((i) => i.state === 'unknown')) return unknown(['GAP_FIELD_MISSING']);
  if (items.filter((i) => i.state === 'clear').length !== proof.population) return unknown(['GAP_POPULATION_MISMATCH']);
  if (!def.allowsGreen) return unknown(['GAP_NO_GREEN_RULE']);
  return { ...base, state: 'clear', reasons: [], proven: true, population: proof.population };
}
```
- **검증 결과:** 위조 증명 → unknown, 진짜 증명 → clear, 증거 없는 clear → unknown, 모수 0 → na, 부분 데이터 + 위험 → risk, 부분 데이터 + 양성 없음 → unknown, KEY-1(위험 항목) → warn으로 상한, 초록 없는 룰 → unknown, 가이드 카드 → unknown [확인: 로컬].
- 위조 증명이 크래시를 일으키던 결함을 이 과정에서 찾아 고쳤습니다.
- **population의 출처:** population은 정규화 단계(API설계자 영역)가 목록 영수증에서 계산합니다. 판정 함수는 이 값을 바꿀 수 없습니다.

### 4-2. INV-1~10을 구조로 강제하는 방법

| INV | 구조적 장치 | 테스트 |
|---|---|---|
| 1 fail-closed | 판정 함수는 상태를 직접 반환할 수 없다. core가 unknown에서 시작해 증명이 있을 때만 승격 | 단위 테스트 + 속성 테스트 |
| 2 빈 입력 | 파싱이 실패하면 모든 룰이 unknown으로 고정되는 단일 경로 | fast-check: 임의 문자열·JSON → clear 0개 |
| 3 증거 삭제 변이 | `fixtures/mutate.ts`의 변이 집합(거부·잘림·필드 삭제·리전 제거·구독 제거·스키마 변경) | fast-check 단조성: 변이 후 clear인 항목은 변이 전에도 clear였어야 함 |
| 4 비대칭 | 양성 우선 처리. Resource Graph 출처는 정규화 단계에서 `complete=false`로 고정 | 속성: 양성 항목 자신의 증거를 건드리지 않는 변이에서는 양성 유지 |
| 5 모수 0 | `population===0`은 na만 가능. 증명이 없으면 unknown | 단위 테스트 |
| 6 notconfigured | 영수증 분류 표와 Ev 규약 | 분류 표 테이블 테스트 |
| 7 고립 거부 | 룰 데이터의 `isolatedDenialFamilies`를 core 공용 패스가 읽어 warn 항목을 추가(룰마다 구현하지 않음) | 단위 테스트 |
| 8 본인 응답·예외 | `evaluate(input, rules, params)` 시그니처에 예외·응답 인자가 없다. UI가 라벨만 덧씌운다 | 타입 + 테스트 |
| 9 순수성 | asOf는 입력에서만 온다. `engine/`, `rules/`, `contract/`에서 `Date.now`, 인자 없는 `new Date()`, `Math.random`, `performance.now`, window, document, localStorage, fetch를 금지하는 소스 스캔 테스트 | 같은 입력 2회 → 같은 결과, `vi.setSystemTime`과 무관 |
| 10 버전 | 메이저 검사 + 섹션별 safeParse(§1-7) | 단위 테스트 |

### 4-3. 룰 데이터 zod (`rules/rule-schema.ts`) — 컴파일·실행 검증 [확인: 로컬: 정상 통과, 유사 도메인 근거 링크·가이드 카드 비고정·케이스 누락 거부]
```ts
const I18nKey = z.string().regex(/^cc\.[a-z0-9.-]+$/);
const DOC_HOSTS = ['docs.aws.amazon.com', 'aws.amazon.com', 'learn.microsoft.com', 'azure.microsoft.com'];
const DocUrl = z.string().url().refine((u) => { const x = new URL(u); return x.protocol === 'https:' && DOC_HOSTS.includes(x.hostname); }, '근거 링크 도메인 허용 목록 밖');
const AnyUrl = z.string().url().refine((u) => u.startsWith('https://'), 'https만');
const FixtureRef = z.string().regex(/^[a-z0-9-]+\/[A-Za-z0-9-]+\/[a-z0-9-]+$/);
const Na = z.object({ na: z.string().min(8) }).strict();       // 해당 케이스가 성립하지 않는 이유를 반드시 적는다
export const RuleDefSchema = z.object({
  id: z.string().regex(/^(AWS|AZ)-(MFA|KEY|NET|STO|LOG)-(\d+|G)$/),
  cloud: z.enum(['aws', 'azure']), door: z.enum(['mfa', 'key', 'net', 'sto', 'log']),
  titleKey: I18nKey, summaryKey: I18nKey,
  maxState: z.enum(['risk', 'warn', 'unknown']), allowsGreen: z.boolean(),
  priority: z.number().int().min(1).max(999),
  params: z.record(z.unknown()),                  // 판정 함수별 zod로 2차 검증
  families: z.array(z.string()).min(1),           // 읽는 증거 묶음(미수집·권한 안내의 원천)
  isolatedDenialFamilies: z.array(z.string()),    // INV-7
  permissions: z.array(z.string()).min(1),
  cannotSee: z.array(I18nKey).min(1), falsePositiveScenarios: z.array(I18nKey).min(1),
  fixtures: z.object({
    pass: z.union([FixtureRef, Na]), violate: z.union([z.array(FixtureRef).min(1), Na]),
    denied: z.union([z.object({ call: z.string() }).strict(), Na]),
    truncated: z.union([z.object({ call: z.string() }).strict(), Na]),
    missingField: z.union([z.object({ path: z.string() }).strict(), Na]),
    versionMismatch: z.literal('auto'),
  }).strict(),
  fix: z.object({
    observeKey: I18nKey,
    change: z.object({ docUrl: DocUrl, property: z.string().min(1), cliExampleKey: I18nKey }).strict(),
    revertKey: I18nKey, impact: z.enum(['low', 'medium', 'high']), prodImpact: z.boolean(),
  }).strict(),
  basis: z.array(z.object({ url: AnyUrl, titleKey: I18nKey, kind: z.enum(['doc', 'benchmark', 'incident', 'advisory']) }).strict()).min(1),
  lastVerified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  incidentRef: z.string().optional(),
}).strict().superRefine((r, ctx) => {
  const bad = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  if ((r.cloud === 'aws') !== r.id.startsWith('AWS-')) bad('id 접두와 cloud 불일치');
  if (r.id.endsWith('-G') && (r.maxState !== 'unknown' || r.allowsGreen)) bad('가이드 카드는 확인 불가 고정');
  if (!r.id.endsWith('-G') && typeof r.fixtures.pass !== 'string') bad('자동 룰은 통과 픽스처 필수');
});
```
- **파일 구성:** 룰 하나에 파일 하나(`rules/aws/AWS-MFA-1.ts`)를 두고 `{ def, evaluate }`를 export합니다. 데이터는 직렬화 가능하게 두고(룰 목록 보기용), 판정 함수는 같은 파일에 함께 둡니다. 문자열로 함수를 참조하는 방식은 쓰지 않습니다.
- **`registry.test.ts`가 검사하는 것:** 18개, id·priority 고유, 모든 def가 스키마 통과, 모든 i18n 키가 `rules/i18n/ko.json`에 존재, 모든 `cliExample` 문구에 `<자리표시자>`가 있음(R-11), 금지어 린트 통과(R-04).

### 4-4. 6케이스 픽스처 (변이로 파생)
- 사람이 쓰는 것은 **pass와 violate(1개 이상)**뿐입니다. denied, truncated, missingField, versionMismatch는 `mutate.ts`의 `deny(call, {resource?, region?})`, `truncate(call)`, `dropField(path)`, `bumpSchema()`로 pass에서 기계적으로 만듭니다. 18룰 × 6케이스를 JSON 108개로 손관리하지 않고, 같은 변이 함수를 INV-3 속성 테스트에서도 재사용합니다.
- 성립하지 않는 케이스는 생략할 수 없고 `{na: "이유"}`를 적어야 합니다(예: 단건 조회라 잘림이 없음, 가이드 카드).

### 4-5. 가짜 회사 4세트 × 2클라우드와 정답지
- **만드는 방법:** `fixtures/companies/build-aws.ts`, `build-azure.ts`(TS DSL)로 A~D 세트를 만들고 `companies/*.json`으로 커밋합니다(체험 모드 번들용). 빌더 출력과 커밋된 파일이 같은지 테스트합니다. 수집기 JSON과 짝이 맞는 자격증명 CSV도 같은 빌더가 만듭니다.
- **이름:** 버킷 이름은 AWS 문서용 접두 `amzn-s3-demo-…`를 씁니다(실존 버킷과 충돌 방지 [일반 지식]). 계정 ID는 문서용 표본 값, GUID는 0으로 채운 값을 씁니다.
- **D 세트(구멍 난 수집)에 추가할 적대 사례:** IAM 사용자명 `__proto__`·`constructor`, 255자 이름, RTL 문자, `</script>`, 사용자 200명(예산 초과), 리포트 사용자 수와 계정 요약 불일치.
- **정답지 형식** (`fixtures/answers/<세트>.<cloud>.json`). **사람이 룰 명세를 보고 먼저 쓰고 QA가 리뷰합니다. 엔진 출력으로 자동 생성하면 동어반복이 되므로 금지하고, 스냅샷 갱신 경로도 두지 않습니다.**
```json
{
  "answerKey": "cloudcheck.answers/1",
  "fixture": "companies/c-incident.aws.json",
  "set": "C", "cloud": "aws", "rulesetVersion": "1.0.0",
  "rules": {
    "AWS-MFA-1": { "state": "risk", "reasons": ["ROOT_ACCESS_KEY_ACTIVE"],
                   "items": [{ "resource": "iam-root", "state": "risk", "reasons": ["ROOT_ACCESS_KEY_ACTIVE"] }] },
    "AWS-NET-1": { "state": "risk", "reasons": ["SG_WORLD_RISKY_PORT_PUBLIC_ENI"],
                   "items": [{ "resource": "ap-northeast-2/sg-0000000000000001", "state": "risk", "reasons": ["SG_WORLD_RISKY_PORT_PUBLIC_ENI"] }] }
  },
  "doors": { "mfa": "risk", "key": "risk", "net": "risk", "sto": "risk", "log": "warn" },
  "distribution": { "risk": 6, "warn": 2, "clear": 1, "unknown": 1, "na": 0 },
  "notes": { "AWS-NET-1": "공인 IP ENI + 0.0.0.0/0:22" }
}
```
- **비교 규칙:** 상태는 완전 일치, 사유 코드는 순서 무관 집합 일치, 항목은 리소스 키로 매칭. G3 기준은 100%.

### 4-6. 판정 결과 모델 (T2 초안, 컴파일 확인 [확인: 로컬]. 프론트팀장과 확정)
```ts
export interface Report {
  model: 'cloudcheck.report/1';
  input: { source: 'collector' | 'csv-credential-report' | 'csv-resource-graph' | 'demo'; cloud: 'aws' | 'azure';
    asOf: string; asOfSource: 'collector' | 'filename' | 'file-mtime' | 'demo';
    schema: string | null; schemaNewerMinor: boolean;
    collector: { version: string | null; sha256: string | null; knownRelease: boolean | null } };
  identity: { accountOrTenant: string; display: string; alias: string | null; principalType: string; principalName: string | null };
  scope: { aws?: { regionsEnabled: string[]; byDoor: Partial<Record<Door, { checked: string[]; missing: string[] }>> };
           azure?: { subscriptionsVisible: number; byDoor: Partial<Record<Door, { checked: string[]; missing: string[] }>>; outOfScope: Array<{ id: string; reason: string }> } };
  collection: { receiptsByResult: Record<'ok'|'empty'|'notconfigured'|'denied'|'error'|'throttled'|'truncated'|'unsupported', number>;
    denied: Array<{ call: string; permission: string; unlocksRules: string[] }>;
    credentialReportGeneratedAt: string | null; doors: Record<Door, 'collected' | 'skipped' | 'not-in-source'> };
  distribution: Record<State, number>;   // 룰(카드) 단위. 리포트 전체를 한 상태로 합치지 않는다
  doors: Array<{ door: Door; state: State; rules: RuleCard[] }>;
  firstToSee: string[];                  // 정렬 규칙 + priority
  manualChecklist: Array<{ kind: 'unknown' | 'guide' | 'out-of-scope'; ruleId: string | null; reasons: string[]; howToKey: string }>;
  cannotSeeKeys: string[];
  banners: Array<{ code: string; params?: Record<string, string | number> }>;
}
export interface RuleCard { ruleId: string; state: State; reasons: string[];
  coverage: { proven: boolean; population: number | null; gaps: GapReason[] };
  items: Array<{ resource: { kind: string; id: string; display: string; region?: string; subscription?: string }; state: State; reasons: string[]; evidence: string[]; labels: string[] }>;
  evidence: string[] }
// '오래된 사진'(24h·7d) 배너는 UI가 now와 asOf를 비교해 띄운다(INV-9). 예외·본인 응답은 UI 라벨 오버레이(INV-8)
```
- 합의할 점: 분포의 단위(룰 카드인지 리소스 항목인지)는 기획서 §5-3의 "항목"이라는 표현이 모호합니다. 저는 카드 단위를 제안하며, 디자인·프론트팀과 확정해야 합니다.

---

## 5. 해시·릴리스(C-10)와 골든 파일 마스킹(T10)

### 5-1. 3중 일치 강제 (`collector/release.test.ts`)
- **파일:** `src/lib/cloudcheck/collector/`에 `cloudcheck-aws.sh`, `cloudcheck-azure.sh`, `SHA256SUMS`(GNU 형식 `<64hex>␠␠<파일명>`, `sha256sum -c`로 검증 가능), `RELEASES.json`(추가만 하는 이력: version, file, sha256, date, schema), 그리고 디렉터리 단위 `.gitattributes`(`*.sh text eol=lf`, `SHA256SUMS text eol=lf`)를 둡니다. 루트 공유 파일은 건드리지 않습니다.
- **테스트 항목:**
  - ① Node crypto로 계산한 sha256(파일 바이트) = SHA256SUMS 줄.
  - ② 그 해시가 RELEASES.json에 있고, 스크립트의 `CC_VERSION` = 최신 릴리스 버전. 의도적인 릴리스 절차 없이 수집기를 고치면 테스트가 실패합니다.
  - ③ 바이트 규칙(L-02).
  - ④ 번들 생성물: 프론트의 생성기가 `<script type="application/json" id="cc-collectors">` 안에 JSON 이스케이프(`<` → `<`)로 원문을 넣으면, 테스트가 생성된 HTML에서 이를 꺼내 파일 원문과 문자열이 같은지, sha256이 같은지 비교합니다.
  - ⑤ `TextEncoder`로 다시 인코딩한 바이트의 해시 = 파일 해시. 이것으로 Blob 다운로드 바이트가 같음을 보증합니다.
- **CI:** 레포에 CI가 없으므로 [확인] 배포 게이트의 `npm run test`가 이 검사를 합니다. 수집기 전용 저장소를 쓰기로 하면(Q7) 그쪽에 GitHub Action을 두는 것을 나중에 검토합니다.
- **해시 수명(C-11):**
  - 수집기 주석은 한국어로 쓰고 마커 ID(`# @cc:sto.acl`)를 붙입니다. **일본어 설명은 페이지가 마커를 기준으로 오버레이해 보여 주므로**, v1.1에서 일본어를 추가해도 수집기 해시가 바뀌지 않습니다.
  - PDF 인쇄(G9)는 수집기 v1.x를 동결한 뒤에 합니다.
- **태그·릴리스 게시**(`cloudcheck-collector-v1.0.0` + SHA256SUMS)는 외부로 나가는 조치이므로 배포 단계에서 PM 승인을 받습니다.

### 5-2. 마스킹 규칙 (R-13 기능 = `contract/mask.ts`, 결정적 가명화)
| 대상 | 규칙 |
|---|---|
| AWS 계정 ID | 자기 계정은 `111122223333`, 외부 계정은 `444455556666`, `777788889999`, 이후 순번. **자기 계정과 외부 계정의 관계를 보존**(KEY-4 회귀 테스트가 가능하도록) |
| ARN | 계정과 리소스명을 바꿔 재조립. 서비스 주체(`*.amazonaws.com`), `aws` 소유 정책, `/aws-service-role/` 경로, `AWSReservedSSO_` 접두는 보존 |
| 이름(사용자, 역할, 그룹, 버킷, SG, NSG, 계정, 컨테이너, RG, 별칭, 구독명) | 유형 접두 + 순번(`user-003`). 이름 힌트 키워드(public, static, assets, cdn)와 `$web`은 접미로 보존 |
| ID | sg-·eni-·vpc-·subnet-은 순번 16진수. GUID는 `00000000-0000-0000-0000-0000000000NN` |
| IP·CIDR | `0.0.0.0/0`·`::/0`은 보존. 공인 대역은 TEST-NET(192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24)으로 바꾸되 접두 길이 보존. IPv6는 2001:db8::/32 |
| 시각 | 모든 시각을 같은 일수만큼 이동(상대 나이 보존, 선택) |
| 자격증명 CSV | TS 파서로 읽고 다시 써서 적용 |

### 5-3. 리뷰와 누출 스캔
- **기본값은 "형태 스냅샷"만 커밋하는 것으로 제안합니다.** 실계정 출력에서 키 경로와 타입만 뽑아 커밋하고 값은 커밋하지 않습니다. 값이 필요한 회귀(버그 재현)일 때만 마스킹본을 커밋합니다.
- **커밋 전 3단계:** ① `leak-scan.test.ts` 통과 → ② QA설계자와 백엔드팀장 2인 승인 → ③ PM 최종 확인(실명을 아는 사람).
- **누출 스캔 규칙**(`src/lib/cloudcheck/**/fixtures/**`, `__scenarios__/**`에 적용): 표본 집합 밖의 12자리 숫자, `(AKIA|ASIA|AIDA|AROA|AGPA|ANPA|ANVA|APKA)[A-Z0-9]{16}`(문서 예시 `AKIAIOSFODNN7EXAMPLE`만 허용), 0으로 채우지 않은 GUID, example.com·contoso.com 밖의 이메일, TEST-NET·RFC1918 밖의 공인 IP, 자리표시자가 아닌 `*.blob.core.windows.net`·`*.s3.amazonaws.com`, `eyJ` JWT, `-----BEGIN`.
- **PM 실명 차단 목록:** 레포 밖 경로를 환경변수 `CC_LEAK_DENYLIST`로 지정하면 테스트가 그 파일까지 대조합니다. 파일이 없으면 이 단계만 건너뜁니다.

---

## 6. 보안 리뷰

### 6-1. 위협 모델
| 위협 | 수집기 위험 | 판정기 위험 | 대응(설계 반영) | 잔여 |
|---|---|---|---|---|
| 사칭 페이지 | 유출형 수집기 배포 | 결과 파일 탈취 | PDF에 전체 해시, 저장소 릴리스(독립 채널), 사용자가 직접 `sha256sum` 입력, ClickFix 카드, "페이지에 적힌 해시만 믿지 말라" 안내 | 해시를 대조하지 않는 사용자 |
| 배포 계정 탈취 | 수집기·SHA256SUMS·페이지를 커밋 하나로 바꾸면 레포 안 3중 일치 테스트는 그대로 통과 | 같음 | RELEASES.json 추가 전용 + diff가 눈에 띄게, 2FA(R-15), 브랜치 보호, Vercel 배포 알림, **PDF 인쇄 해시와 라이브 해시를 주기적으로 수동 대조** | 레포 권한을 가진 공격자는 막지 못함. 서명(minisign)은 "설치 0" 원칙과 충돌해 나중으로 |
| 부분 복붙 | 잘린 스크립트가 일부만 실행 | 잘린 JSON | `main "$@"` 마지막 줄 [확인: 로컬], 스크립트 원문에 복사 버튼 없음, 해시 불일치. JSON은 파싱 실패 → 배너 | — |
| 과수집 | 정책 전문, 태그, 메시지 원문 | 민감 정보 노출 | jq 투영 allowlist, stderr 원문 미저장 [확인: 로컬], 키 끝 4자리만, umask 077, 터미널에는 개수만, 독이 든 응답 테스트, zod strict | — |
| 과권한 | 관리자 본인 권한으로 실행 | — | 정확한 허용 목록(L-05), 비밀 반환 금지(L-06), 엔드포인트 변조 금지(L-11), 쓰기는 리포트 생성 1건뿐, SecurityAudit·Reader 권장 | "현실 모드"는 사용자 책임(읽고 실행) |
| 공급망 | 사전 설치된 aws·az·jq에 의존(클라우드 사업자 신뢰) | 번들 의존성 | 수집기는 설치 0. 판정기는 의존성 최소화, lockfile, 런타임 외부 코드 0 | **CSP의 한계**(아래 ⑤) |
| 습관 학습 | 웹에서 받은 스크립트를 관리자 권한으로 실행하는 습관 | — | 셸 붙여넣기 블록 없음, 파일 + 해시, 발자국 표, 교육 카드 | — |

### 6-2. 이번 검토에서 새로 찾은 위험과 대응
1. **엔드포인트 변조로 토큰 유출:** `--endpoint-url`이나 `AWS_ENDPOINT_URL*`을 쓰면 서명된 요청이 세션 토큰 헤더와 함께 임의의 곳으로 갑니다. `--debug`는 요청 헤더를 로그로 찍습니다 [일반 지식]. 둘 다 L-11로 금지합니다. 로컬 실행에서 사용자 환경에 이 변수들이 있으면 경고를 출력하자고 제안합니다(`env` 덤프 없이 변수 하나씩 검사).
2. **Azure 데이터 평면의 암묵적 키 조회:** 데이터 평면 명령은 `--auth-mode login`이나 키를 주지 않으면 계정 키를 쓰는 방식이 있습니다 [확인: MS 문서에 두 인증 방식 명시. 키 자동 조회 경고 문구는 일반 지식]. 그래서 `container-rm`(관리 평면)만 허용하고, `storage container list`와 `storage blob`은 금지 목록에 넣습니다. Reader라면 listKeys가 실패하겠지만 관리자로 실행하면 성공하므로, 린트 금지가 필수입니다.
3. **린터 우회 `$(aws …)`:** 프로토타입에서 실제로 뚫렸습니다. L-04 패턴, aws 단어 수 불변식, shim 실행 기록 검사의 3중으로 막습니다.
4. **Trojan Source:** 수집기 원문에 bidi나 zero-width 문자가 있으면 사람이 읽는 내용과 실행되는 내용이 달라질 수 있습니다. L-02 바이트 검사로 막습니다.
5. **CSP 문구의 범위:** `connect-src 'none'`은 fetch, XHR, beacon, WebSocket만 막습니다. 악성 코드가 들어오면 최상위 이동(`location=…?d=`), WebRTC(STUN), DNS 프리페치로 내보낼 수 있습니다 [일반 지식]. 대응은 의존성 최소화와 `X-DNS-Prefetch-Control: off`입니다. **"브라우저가 전송을 막도록 설정돼 있습니다"라는 문구가 이 범위를 넘어서 들리지 않게** 해야 합니다(최종 증명 수단은 오프라인 HTML). 프론트팀장과 기획팀장의 확인이 필요합니다.
6. **프로토타입 오염:** IAM 사용자명에는 밑줄이 허용되므로 `__proto__`가 유효한 이름입니다 [일반 지식]. 외부 문자열을 키로 쓰는 조회는 전부 `Map`으로 하고, 적대 픽스처를 둡니다.
7. **터미널 이스케이프 주입:** 구독 이름 같은 자유 텍스트를 터미널에 그대로 출력하지 않고 jq 이스케이프를 거칩니다.
8. **결과 파일이 남는 문제:** CloudShell 홈은 영구 저장소입니다 [확인]. 대화형 실행이면 끝에 "내려받았으면 Enter: 삭제" 프롬프트를 띄웁니다.
9. **위조 증명 객체로 엔진 크래시:** 고쳤습니다(§4-1).

### 6-3. T6 룰 파라미터 검토
| 파라미터 | 기획서 | 제안 | 근거 |
|---|---|---|---|
| 키 나이(AWS-KEY-1) | 90일 | **90일 유지** | Security Hub IAM.3 "90 days or less", 파라미터 고정 [확인] |
| 미사용(AWS-KEY-2) | 90일 | **45일** | Security Hub IAM.22 "unused for 45 days", CIS AWS v5.0.0/1.11·v3.0.0/1.12·v1.4.0/1.12 [확인]. 90일은 공개 근거가 없다. 주의 수가 늘어나는 것이 부담이면 90일로 둘 수 있지만, 그때는 "도구 기준"으로 표기 |
| 미사용 유예(신규 키) | 7일 | 7일 유지 | 도구 기준(공개 근거 없음, 화면에 표기) |
| 루트 최근 로그인 | 90일 | 90일 유지 | 도구 기준. CIS는 "일상 사용 금지"만 요구하고 일수를 정하지 않음 [일반 지식] |
| Azure 키 회전 | 90일 | 90일 유지 | [미확인]. MS·CIS Azure 권고 일수는 DB설계자가 원문 확인 |
| 리포트 신선도 | — | 4시간 + 5분 | 4시간 캐시 [확인] |
| 오래된 사진 배너 | 24시간 / 7일 | 유지 | 기획서 |
| 예외 최대 기간 | 파라미터 | 90일 | 도구 기준 |

**위험 포트 2단계안**(0.0.0.0/0 또는 ::/0에서 들어오는 인바운드 기준. 포트 범위가 겹치면 해당. 모든 프로토콜(-1)이나 전체 범위는 위험):
- **위험 단계:** EC2.19의 24개 [확인: 20,21,22,23,25,110,135,143,445,1433,1434,3000,3306,3389,4333,5000,5432,5500,5601,8080,8088,8888,9200,9300]에서 메일 포트 25·110·143을 빼고 다음을 더한 집합:
  - 1521(Oracle), 6379(Redis), 27017(MongoDB). 기획서에 있는 포트입니다.
  - 2375·2376(Docker API), 2379·2380(etcd), 10250(kubelet), 11211(Memcached), 5900(VNC), 5985·5986(WinRM). 인증 없는 기본 설정이 흔한 서비스라 도구 기준으로 추가합니다.
- **주의 단계:** 80·443을 뺀 그 밖의 모든 TCP·UDP 포트, 그리고 메일 포트 25·110·143("메일 서버라면 의도된 공개일 수 있음"). 근거는 EC2.18의 기본 허용 포트가 80·443이라는 점입니다 [확인].
- EC2.19 목록을 그대로 쓰면 근거를 [확인]으로 댈 수 있는 장점이 있습니다. 메일 포트를 내릴지는 디자인팀장과 기획팀장이 결정합니다. Azure NSG에도 같은 목록을 씁니다(출발지 `*`, `Internet`, `0.0.0.0/0`, `Any`).

**관리자급 정책(AWS-KEY-3):** ARN 접미 `:iam::aws:policy/<이름>`으로 파티션 무관하게 비교합니다.
- 핵심 4개: AdministratorAccess, PowerUserAccess, IAMFullAccess(스스로 관리자 권한을 줄 수 있어 사실상 같음), AWSOrganizationsFullAccess.
- 검토 후보: AdministratorAccess-Amplify, AdministratorAccess-AWSElasticBeanstalk, job-function/SystemAdministrator. 권한 범위는 [미확인]이라 DB설계자가 정책 문서를 대조합니다.

**KEY-4 보완:** 주체에서 서비스 주체, 자기 계정, 서비스 연결 역할은 제외합니다. `aws:PrincipalOrgID`·`aws:SourceAccount` 조건이 있으면 주의는 유지하되 사유 코드를 완화형으로 바꿉니다. Federated 주체와 조건 키도 수집하므로, 나중에 GitHub OIDC `sub` 조건 누락 룰을 수집기 변경 없이 추가할 수 있습니다.

### 6-4. T9 역할 재정의와 병렬 작업 디렉터리 분리
- **@API설계자:** 수집기 2종, 수집 계약(zod), 호출 카탈로그, 영수증 분류, 명령 린터, shim 테스트, 해시·릴리스, **CSV 파서·정규화(NormalizedInput과 coverage 계산)**, 마스킹.
- **@DB설계자:** 룰 데이터 스키마, 판정 함수 18개, **엔진 core(proof·aggregate·evaluate. 백엔드팀장 코드 리뷰 필수)**, 판정 결과 모델 구현(T2), 변이 픽스처, 가짜 회사 4×2, 정답지, 룰 문구 i18n(ko).
- **@백엔드팀장:** 계약 동결과 변경 승인, 위협 모델 기준의 수집기 보안 리뷰, 엔진 불변식 책임(QA 속성 테스트와 함께), 통합.

| 경로 | 소유 | 상대방 |
|---|---|---|
| `src/lib/cloudcheck/contract/**` | API설계자 | DB설계자는 import만 |
| `src/lib/cloudcheck/collector/**` (.sh, SHA256SUMS, RELEASES.json, .gitattributes, lint, 테스트, `__shims__`, `__scenarios__`) | API설계자 | — |
| `src/lib/cloudcheck/engine/**` | DB설계자 | 프론트는 import만 |
| `src/lib/cloudcheck/rules/**` (+ `rules/i18n/ko.json`) | DB설계자 | — |
| `src/lib/cloudcheck/fixtures/**` (companies, micro, answers, mutate.ts) | DB설계자(정답지는 QA 리뷰) | API설계자는 통합 테스트에서 읽기만 |
| `src/lib/cloudcheck/qa/**` (속성 테스트, 누출 스캔, 금지어 린트 함수) | QA | 읽기 전용 |
| `src/app/cloudcheck/**` | 프론트 | engine·contract import |

- **인터페이스 동결 시점:** D1에 `contract/collect-schema.ts`와 `contract/normalized.ts`(타입)는 API설계자가, `engine/report-types.ts`는 DB설계자와 프론트가 합의해 먼저 머지합니다. 공용 배럴 `index.ts`는 두지 않고 경로로 직접 import합니다(같은 파일 동시 편집 방지).
- **공유 파일 수정은 0건입니다**(package.json과 루트 설정 무수정. `.gitattributes`도 디렉터리 단위로만).

---

## 7. 일정·리스크

### 7-1. 일정 (G0 계약 동결 기준, 사람-일)
| 시점 | API설계자 | DB설계자 | 팀장·QA |
|---|---|---|---|
| D0 | — | — | 계약 v1.0 동결 회의(백엔드·프론트팀장, QA설계자) |
| D1 | 카탈로그, 스키마, normalized 타입 머지 | 룰 스키마, params, registry, 엔진 core 골격 | — |
| D2~D3 | AWS 수집기 + shim 도구 | 변이 함수 + 회사 빌더 | QA: 속성 테스트 착수 |
| D3 | 린터, 발자국 표, 해시 테스트 | AWS 판정 함수 (~D5) | 팀장: 수집기 1차 보안 리뷰 |
| D4 | Azure 수집기 | — | — |
| D5 | 자격증명 CSV 파서, 정규화 | — | — |
| D6 | Resource Graph 쿼리·파서, 마스킹 | Azure 판정 함수 8개 (~D7) | 팀장 + QA: 불변식 리뷰 |
| D7 | 적대 시나리오, 통합 테스트(셤 출력 = 회사 픽스처) | 회사 4×2 + 정답지 (~D8) | — |
| D8~D9 | 여유 | 수정 | 팀장: 통합, G2·G3·G4 사전 점검 |

- 합계: API설계자 약 8~9일, DB설계자 약 9~10일. 병목은 계약 동결(D0)입니다.
- **제안(PM 결정 사항):** 수집기, 계약, 엔진에는 디자인 산출물이 필요 없습니다(문구 키만 나중에 연결). STEP 3(디자인)과 병행해 백엔드가 먼저 착수하면 전체 기간이 줄어듭니다. 다만 오케스트레이션 규칙 1("이전 STEP 산출물이 없으면 실행 거부")의 예외가 되므로 PM 승인이 필요합니다.

### 7-2. 리스크
| # | 리스크 | 확률·영향 | 대응 |
|---|---|---|---|
| 1 | Azure 출력 형태(진단 설정의 `value` 래퍼, keyCreationTime 유무, Reader 권한으로 container-rm 가능 여부) [미확인] | 높음·중 | 두 형태를 모두 받는 정규화, PM V1, Azure 베타를 나중에 |
| 2 | CloudShell jq가 1.6 이하 [미확인] | 중·중 | L-13, `transform-failed`로 fail-closed, PM V1에서 버전 기록 |
| 3 | 호출 수·시간(CLI 실행 지연) [미확인] | 중·중 | 예산, 진행 표시, `--doors`. V1 실측 후 예산 조정 |
| 4 | 자격증명 CSV 열·시각 정보(additional_credentials_info, 생성 시각) [미확인] | 중·중 | 열 부재 시 fail-closed 기본값, V1 후 결정 |
| 5 | 계약 변경으로 인한 재작업 | 중·높음 | 동결 후에는 minor 추가만, 변경은 팀장 승인 |
| 6 | 정답지가 엔진 출력의 동어반복이 됨 | 중·높음 | 사람이 먼저 작성, 자동 갱신 금지 |
| 7 | 공개 저장소로 실명 유출 | 낮음·매우 높음 | 형태 스냅샷 기본, 누출 스캔, 2인 승인 + PM 확인 |
| 8 | 수집기 해시가 자주 바뀌어 PDF 인쇄본과 어긋남 | 중·중 | 주석 언어 고정, 일본어 오버레이, 수집기 동결 후 G9 |
| 9 | ListBuckets 등 CLI 버전 차이 [확인: 2024-10 변경] | 낮음·낮음 | get-bucket-location 대체, 토큰 잔존 시 truncated |
| 10 | moto를 쓸 수 없음 | 확정·낮음 | shim + PM V1로 G4 문구 수정 |

### 7-3. T3·T7 의견
- **T3:** 백엔드 관점에서 ①(현 프로젝트 Route Handler)로 베타를 내는 데 동의합니다. 다만 같은 origin에 다른 앱의 `/api/*`가 있고, 앞으로 Service Worker가 생길 위험도 있습니다. 그래서 **PDF 공개(G9) 전에는 ②(origin 분리)를 권고**합니다. HTML이 같으므로 옮기는 비용이 작습니다.
- **T7:**
  - `test:redline`은 지금 상태로는 모든 배포 게이트를 실패시킵니다 [확인: 실행 결과 exit 1].
  - 스크립트를 고치려면 package.json을 수정해야 해 PM 승인이 필요합니다. 게다가 `_archive`는 vitest include 밖이라 경로만 바꿔서는 테스트를 찾지 못합니다.
  - 배포엔지니어와 PM이 "redline은 아카이브됨 — 게이트에서 제외"를 deploy.yaml에 명시할지 정해야 합니다.
  - cloudcheck 게이트는 `npm run test` 하나로 충분하게 설계했습니다.
  - `serviceWorker.register` 부재 검사를 게이트에 넣자는 기획서 제안에 동의합니다.

---

## 8. 기획서 대비 변경 요청 (방향서 반영용)
1. §7-4 계약: 스키마 id를 `cloudcheck.collect/1.0`(메이저.마이너)으로, `scope.regionsSucceeded/Failed`는 삭제(영수증에서 계산), 모든 데이터에 `{receipt, value}` 슬롯, `run`(doors, confirmed, finishedAt), `collector.tools`, `budget` 추가.
2. C-07 예외: 자격증명 리포트는 CSV 원문을 담는다(근거는 §1-5).
3. C-04 예외: jq `@base64d` 1곳(리포트 디코드). base64 실행 파일은 계속 금지.
4. 수집 호출 추가: `iam get-account-summary`, `list-users`, `list-access-keys`, `list-mfa-devices`, `list-account-aliases`(실시간 교차 확인, 3번째 키 이상, 리포트 완결성). 모두 SecurityAudit에 포함 [확인].
5. T6: 미사용 기준 90일 → 45일, 위험 포트 2단계, 관리자급 정책 목록(§6-3).
6. G4: "moto 실행"을 "shim 실행 테스트 + PM V1 실측"으로. C-10의 "CI"는 "배포 게이트의 `npm run test`"로 표기.
7. C-01: 하드 상한 260줄. 스타일 규칙(`||`는 `|| rc=$?`만, 행 끝 주석 금지, 배열 금지).
8. C-11: 수집기 주석은 한국어 + 마커 ID, 일본어는 페이지 오버레이(해시 고정).
9. CSV 경로에서 AZ-NET-1의 최고 상태는 주의. CSV 경로의 asOf는 파일명이나 `lastModified`이며 그 사실을 표기.
10. MVP 수집기는 AWS 상용 파티션만 지원(aws-cn, aws-us-gov는 중단 안내).
11. R-07·R-08과 §9-1 문구: "전송을 막도록 설정"의 범위를 정확히(§6-2 ⑤).
12. 판정 결과 모델에서 분포는 카드 단위(디자인·프론트와 합의).

## 9. PM 확인 필요 (백엔드 관점 추가분)
- **V1 체크리스트에 추가할 항목:**
  - `bash --version`, `jq --version`, `aws --version` 기록(AWS·Azure 모두).
  - 수집기 1회 실행에 걸린 시간과 호출 수.
  - 자격증명 CSV의 열 목록(특히 `additional_credentials_info`)과 파일명의 시각 포함 여부.
  - Azure에서 `az account list --refresh`가 동작하는지, Reader 권한으로 `container-rm list`가 되는지, 진단 설정 출력 형태.
  - 오류 문구 실측: Azure의 거부 1건, AWS의 거부 1건.
- 백엔드 선행 착수(STEP 3과 병행)를 허용할지(§7-1).
- `test:redline`을 게이트에서 어떻게 처리할지(§7-3).

---

### 참고: 스크래치패드 프로토타입 (레포 밖, 세션이 끝나면 사라질 수 있음)
- 계약 스키마: `/private/tmp/claude-501/-Users-pyoungminho-Desktop-------team-makes/a8432358-e439-4607-8633-d54f9c3d981b/scratchpad/contract/collect-schema.ts` (검증 스크립트 `check.ts`)
- 엔진·룰·결과 모델 초안: 같은 폴더의 `engine-types.ts`, `rule-schema.ts`, `report-types.ts`, `agg-check.ts`, `rule-check.ts`
- 린터 프로토타입: 같은 폴더의 `lint.ts`, `lint-run.ts`
- 수집기 골격과 shim: `/private/tmp/claude-501/-Users-pyoungminho-Desktop-------team-makes/a8432358-e439-4607-8633-d54f9c3d981b/scratchpad/proto2/skeleton3.sh`, `proto2/bin/aws`, `proto2/scn.json`

### Sources
- [AWS IAM 자격증명 보고서](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_getting-report.html)
- [GetCredentialReport API](https://docs.aws.amazon.com/IAM/latest/APIReference/API_GetCredentialReport.html) · [GenerateCredentialReport API](https://docs.aws.amazon.com/IAM/latest/APIReference/API_GenerateCredentialReport.html)
- [AWS CLI 반환 코드](https://docs.aws.amazon.com/cli/latest/userguide/cli-usage-returncodes.md)
- [Security Hub IAM 컨트롤(IAM.3, IAM.22)](https://docs.aws.amazon.com/securityhub/latest/userguide/iam-controls.html) · [Security Hub EC2 컨트롤(EC2.18, EC2.19)](https://docs.aws.amazon.com/securityhub/latest/userguide/ec2-controls.html)
- [S3 ListBuckets 리전·이름 필터와 페이지네이션(2024-10)](https://aws.amazon.com/about-aws/whats-new/2024/10/amazon-s3-new-region-bucket-name-filtering-listbuckets-api)
- [AWS CloudShell 컴퓨팅 환경·사전 설치 소프트웨어](https://docs.aws.amazon.com/cloudshell/latest/userguide/vm-specs.html)
- [SecurityAudit 관리형 정책](https://docs.aws.amazon.com/aws-managed-policy/latest/reference/SecurityAudit.html)
- [az storage container-rm](https://learn.microsoft.com/en-us/cli/azure/storage/container-rm?view=azure-cli-latest) · [az monitor diagnostic-settings subscription](https://learn.microsoft.com/en-us/cli/azure/monitor/diagnostic-settings/subscription?view=azure-cli-latest)
- [Azure CLI README(종료 코드 표)](https://cdn.jsdelivr.net/gh/azure/azure-cli@dev/README.md) · [az show 종료 코드 비일관성 이슈](https://lightrun.com/answers/azure-azure-cli-az-resource-show-has-inconsistent-exit-status)
- [Azure CLI로 Blob 컨테이너 관리(--auth-mode)](https://learn.microsoft.com/azure/storage/blobs/blob-containers-cli)
