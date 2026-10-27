// src/lib/cloudcheck/model/report.ts — 판정 결과 모델 v1 (엔진 → UI 계약)
// G0 동결: docs/planning/project-direction-cloudcheck.md §5-2. 소유: 프론트팀장 + 백엔드팀장 공동.
// 변경 규칙: 선택 필드 추가는 두 팀장 합의. 이름·의미 변경과 삭제는 기획팀장 확인 + REPORT_MODEL 메이저 증가.
// 원칙
//  1) 직렬화 가능한 순수 데이터. Report = judge(input). 현재 시각·예외 파일·본인 응답은 judge의 입력이 아니다(INV-8, INV-9).
//  2) 문장 없음. 화면 문구는 코드 + 파라미터로만 넘기고, 문장은 UI 카탈로그가 만든다(i18n, 금지어 린트).
//  3) 사용자 데이터에서 온 문자열은 전부 DisplayValue로만 넘긴다(R-12, R-13). 화면 렌더는 MaskedValue 관문 하나.
//  4) 상태별 필수 정보는 판별 유니온으로 컴파일 단계에서 강제한다(이상 없음 = 증명된 범위 + 기준 시각).
//  5) 이 파일은 아무것도 import하지 않는다. contract·engine·UI가 모두 이 파일을 import한다.

export const REPORT_MODEL = "cloudcheck.report/1" as const;

/* ───────── 어휘 ───────── */
export type Cloud = "aws" | "azure";
/** 현관(MFA)·열쇠·창문·창고·CCTV. 배열 순서 = 화면 고정 순서. 수집기 --doors 값과 같다 */
export const DOORS = ["mfa", "key", "net", "sto", "log"] as const;
export type DoorId = (typeof DOORS)[number];
/** 위험·주의·이상 없음·확인 불가·해당 없음 */
export type Status = "risk" | "caution" | "clear" | "unknown" | "na";
/** 정렬·분포 표기 순서(D3). 문 집계(§5-3)도 이 순서에서 가장 앞에 오는 상태를 고른다 */
export const STATUS_ORDER = ["risk", "caution", "unknown", "clear", "na"] as const satisfies readonly Status[];
/** 룰이 낼 수 있는 최고 상태 */
export type MaxStatus = "risk" | "caution" | "unknown";
export const RULE_IDS = [
  "AWS-MFA-1", "AWS-MFA-2", "AWS-KEY-1", "AWS-KEY-2", "AWS-KEY-3", "AWS-KEY-4",
  "AWS-NET-1", "AWS-STO-1", "AWS-STO-2", "AWS-LOG-1",
  "AZ-MFA-G", "AZ-MFA-1", "AZ-KEY-1", "AZ-NET-1", "AZ-STO-1", "AZ-STO-2", "AZ-LOG-1", "AZ-LOG-2",
] as const;
export type RuleId = (typeof RULE_IDS)[number];
export type RuleKind = "auto" | "guide" | "conditional";
/** C-06 영수증 결과 코드 */
export type ReceiptResult = "ok" | "empty" | "notconfigured" | "denied" | "error" | "throttled" | "truncated" | "unsupported";
export type InputKind = "collector-json" | "csv-credential-report" | "csv-rg-storage" | "csv-rg-nsg" | "csv-entra-registration";
export type InputVia = "file" | "paste" | "demo";
export type DemoSetId = "A" | "B" | "C" | "D";

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };
/** UTC 시각(ISO 8601). 엔진이 엄격 파서로 검증한 값만 */
export type IsoUtc = Brand<string, "IsoUtc">;
/** 날짜(YYYY-MM-DD) */
export type IsoDate = Brand<string, "IsoDate">;
/** 예외 매칭·Before/After용 안정 키. 형식 <cloud>|<계정 ID·테넌트 ID>|<ResourceType>|<리전·구독 또는 ->|<고유 ID>. 화면에 그리지 않는다 */
export type MatchKey = Brand<string, "MatchKey">;
/** UI 메시지 카탈로그 키. 형식 cc.<소문자·숫자·점·하이픈> */
export type CatalogKey = `cc.${string}`;
/** recognize()가 돌려주는 불투명 핸들. UI는 내용을 보지 않고 buildInput()에 그대로 넘긴다 */
export type ParsedHandle = Brand<object, "ParsedHandle">;

/* ───────── 사용자 데이터 단일 통로(R-12, R-13) ───────── */
export type SensitiveType =
  | "accountId" | "tenantId" | "subscriptionId" | "subscriptionName" | "alias"
  | "userName" | "upn" | "roleName" | "groupName" | "resourceName" | "arn" | "principal" | "fileName" | "freeText";
export type ValueFlag = "truncated" | "control-chars-replaced" | "bidi-replaced";
/**
 * plain: 비식별 상수(리전, 포트, CIDR, AWS 관리형 정책 이름 등).
 * sensitive: 화면에는 full, 인쇄·내보내기에는 masked가 기본. full은 엔진이 정리한 값(제어·양방향 문자 치환, 256자 상한).
 *   masked 형식 v1: *Id 계열 = "••••" + 끝 4자리 / 이름 계열 = "<유형>-<3자리 순번>"(예: user-003, bucket-012. 리포트 안에서 결정적)
 *   / fileName = "file-<순번>" / freeText = "•••".
 * redacted: 원값을 싣지 않는다(비밀 패턴, 잘못된 인코딩).
 */
export type DisplayValue =
  | { readonly kind: "plain"; readonly text: string }
  | { readonly kind: "sensitive"; readonly type: SensitiveType; readonly full: string; readonly masked: string; readonly flags: readonly ValueFlag[] }
  | { readonly kind: "redacted"; readonly why: "secret-pattern" | "invalid-encoding" };

/* ───────── 메시지(코드 + 파라미터) ───────── */
/** 확인 불가 사유(공통 21종). 카탈로그 키는 cc.reason.unknown.<코드> */
export type UnknownReason =
  | "denied" | "error" | "throttled" | "truncated" | "unsupported" | "budget-exceeded"
  | "region-missing" | "subscription-missing" | "scope-unproven" | "csv-scope-unproven" | "csv-row-ambiguous"
  | "field-missing" | "value-unrecognized" | "schema-unsupported" | "parse-failed" | "not-collected"
  | "stale-evidence" | "population-mismatch" | "clear-without-evidence" | "no-clear-rule" | "guide-only";
/** 룰별 사유. 형식 <RuleId>:<kebab-slug>(예: "AWS-MFA-1:root-key-active"). 닫힌 목록은 각 룰 데이터가 선언하고 registry 테스트가 강제 */
export type RuleReason = `${RuleId}:${string}`;
/** 위험·주의 사유 = 룰별 사유 + INV-7(다른 대상은 조회됐는데 이 대상만 점검 조회가 거부됨) */
export type FindingReason = RuleReason | "isolated-denial";
/** 대상 표의 사실 표기(키 끝 4자리, 나이, 포트 등). 형식 fact:<kebab-slug> */
export type FactCode = `fact:${string}`;
export type MessageCode = UnknownReason | FindingReason | "no-targets-proven" | FactCode;
export type MsgParam =
  | { readonly n: number }           // 개수·일수
  | { readonly t: IsoUtc }           // 시각
  | { readonly d: IsoDate }          // 날짜
  | { readonly c: string }           // 비식별 상수(리전, "22/tcp", CIDR, 권한 이름, 호출 이름). 사용자 데이터 금지
  | { readonly v: DisplayValue };    // 사용자 데이터
export interface MsgRef<C extends MessageCode = MessageCode> {
  readonly code: C;
  readonly params?: Readonly<Record<string, MsgParam>>;
}

/* ───────── 기준 시각·범위 ───────── */
export type AsOfSource = "collected-at" | "credential-report" | "filename" | "file-time";
export interface AsOf { readonly at: IsoUtc; readonly source: AsOfSource }
export type CoverageKind = "account-global" | "regions" | "subscriptions" | "csv-rows" | "none";
export interface Coverage {
  readonly kind: CoverageKind;
  readonly covered: number | null;    // 조회에 성공한 리전·구독 수(account-global은 1)
  readonly total: number | null;      // 활성 리전 수·보이는 구독 수
  readonly proven: boolean;           // 5조건 ①②③ 충족 = 엔진이 ScopeProof를 발급함
  readonly population: number | null; // 판정 대상 수(증명됐을 때만)
}
export interface ProvenCoverage extends Coverage {
  readonly proven: true;
  readonly covered: number;
  readonly total: number;
  readonly population: number;
}

/* ───────── 증거·대상·라벨 ───────── */
export interface ReceiptRef {
  readonly id: string;               // 입력 번호를 붙인 영수증 ID(예: "0:r-0012")
  readonly call: string;             // 호출 카탈로그 키(예: "s3:GetBucketAcl")
  readonly scope: DisplayValue;      // global, 리전(plain) 또는 구독(sensitive)
  readonly result: ReceiptResult;
  readonly count: number | null;
  readonly errorCode: string | null;
  readonly at: IsoUtc;
}
export interface EvidenceRef {
  readonly receipt: ReceiptRef | null;   // CSV 출처면 null
  readonly csv: { readonly kind: Exclude<InputKind, "collector-json">; readonly column: string; readonly row: number } | null;
  readonly observed: readonly { readonly field: string; readonly value: DisplayValue }[];  // allowlist 필드만
}
export type ResourceType =
  | "aws-account" | "root" | "iam-user" | "access-key" | "iam-role" | "region" | "security-group" | "eni" | "s3-bucket" | "trail"
  | "entra-tenant" | "entra-user" | "subscription" | "storage-account" | "blob-container" | "nsg" | "nic";
export interface ResourceRef {
  readonly type: ResourceType;
  readonly name: DisplayValue;
  readonly location: { readonly kind: "global" | "region" | "subscription"; readonly value: DisplayValue } | null;
  readonly key: MatchKey;
}
/** 라벨은 상태를 바꾸지 않는다(INV-8). exception 라벨은 overlayExceptions()만 만들고 Report 안에는 없다 */
export type Label =
  | { readonly kind: "intended-public-candidate"; readonly basis: "static-website" | "web-container" }
  | { readonly kind: "name-hint"; readonly hint: "public" | "static" | "assets" | "cdn" }
  | { readonly kind: "legacy-hint"; readonly basis: "created-before-2023-04" }
  | { readonly kind: "unusual-characters" }
  | { readonly kind: "exception"; readonly state: "active" | "expired"; readonly reason: DisplayValue; readonly until: IsoDate; readonly createdAt: IsoDate };

/* ───────── 해소법 ───────── */
export interface Resolution {
  readonly kind: "permission" | "path" | "portal" | "rerun" | "guide";
  readonly permissions: readonly string[];   // kind = permission일 때 요청할 권한 이름(호출 카탈로그의 permission)
}
export interface PermissionHint {
  readonly permission: string;
  readonly unlocks: readonly { readonly ruleId: RuleId; readonly items: number }[];
  readonly total: number;                    // 이 권한으로 풀리는 확인 불가 대상 수 합계
}

/* ───────── 대상(항목) 결과 ───────── */
export interface ItemBase {
  readonly id: string;                       // 리포트 안에서 유일. 렌더 키, 예외 오버레이 키
  readonly ruleId: RuleId;
  readonly resource: ResourceRef;
  readonly facts: readonly MsgRef<FactCode>[];
  readonly labels: readonly Label[];
}
export type ItemStatusDetail =
  | { readonly status: "risk" | "caution"; readonly why: MsgRef<FindingReason>; readonly evidence: readonly EvidenceRef[] }
  | { readonly status: "clear"; readonly why: MsgRef<RuleReason>; readonly evidence: readonly [EvidenceRef, ...EvidenceRef[]] }
  | { readonly status: "unknown"; readonly why: MsgRef<UnknownReason>; readonly evidence: readonly EvidenceRef[]; readonly resolution: Resolution };
/** 대상에는 '해당 없음'이 없다(해당 없음은 점검 단위의 '모수 0' 판정) */
export type ItemResult = ItemBase & ItemStatusDetail;

/* ───────── 점검(룰) 결과 ───────── */
export interface Distribution {
  readonly total: number; readonly risk: number; readonly caution: number;
  readonly unknown: number; readonly clear: number; readonly na: number;
}
export interface RuleBase {
  readonly ruleId: RuleId;
  readonly cloud: Cloud;
  readonly door: DoorId;
  readonly priority: number;                 // RULE_CATALOG와 같은 값(정렬 편의). 작을수록 먼저
  readonly items: readonly ItemResult[];     // 위험 → 주의 → 확인 불가 → 이상 없음, 같은 상태 안에서는 MatchKey 순
  readonly distribution: Distribution;       // 대상 단위 상태별 개수
  readonly labels: readonly Label[];
  readonly inputIndex: number | null;        // 판정에 쓴 입력(collection.inputs의 index)
}
export type RuleStatusDetail =
  | { readonly status: "risk" | "caution"; readonly why: MsgRef<FindingReason>; readonly asOf: AsOf | null; readonly coverage: Coverage }
  | { readonly status: "clear"; readonly why: MsgRef<RuleReason>; readonly asOf: AsOf; readonly coverage: ProvenCoverage }
  | { readonly status: "unknown"; readonly why: MsgRef<UnknownReason>; readonly gaps: readonly UnknownReason[]; readonly asOf: AsOf | null; readonly coverage: Coverage; readonly resolution: Resolution }
  | { readonly status: "na"; readonly why: MsgRef<"no-targets-proven">; readonly basis: MsgRef<RuleReason>; readonly asOf: AsOf; readonly coverage: ProvenCoverage & { readonly population: 0 } };
export type RuleResult = RuleBase & RuleStatusDetail;

/* ───────── 문 ───────── */
export interface DoorCollection {
  readonly status: "collected" | "partial" | "not-collected";
  /** findings-only = 찾은 위험·주의는 보여 주지만 '없음'은 확정하지 못함(INV-4, Resource Graph CSV 경로) */
  readonly judgeLevel: "full" | "findings-only" | "none";
  readonly reason: MsgRef<UnknownReason> | null;   // partial·not-collected의 사유(예: not-collected = --doors로 건너뜀)
  readonly asOf: AsOf | null;
  readonly inputIndex: number | null;
}
export interface DoorResult {
  readonly door: DoorId;
  /** §5-3 집계 결과. 정렬과 인쇄 요약에만 쓴다. 화면에 문 단위 상태 배지로 그리지 않는다(D2) */
  readonly worstStatus: Status;
  readonly collection: DoorCollection;
  readonly rules: readonly RuleResult[];     // 상태(STATUS_ORDER) → priority 순
  readonly distribution: Distribution;       // 이 문의 점검(룰) 단위 상태별 개수. 문 머리 칩
  readonly manualCount: number;              // 이 문에서 직접 볼 목록으로 간 항목 수
}

/* ───────── 리포트 머리(접을 수 없는 영역) ───────── */
export type PrincipalType =
  | "root" | "iam-user" | "assumed-role" | "federated-user"
  | "entra-user" | "service-principal" | "managed-identity" | "unknown";
export interface IdentityBlock {
  readonly cloud: Cloud;
  readonly account: DisplayValue;            // AWS 계정 ID 또는 Azure 테넌트 ID
  readonly accountLast4: string;
  readonly alias: DisplayValue | null;       // AWS 계정 별칭
  readonly currentSubscription: DisplayValue | null;   // Azure
  readonly principalType: PrincipalType;
  readonly principalName: DisplayValue | null;         // 사용자명·역할명(세션명·UPN은 수집하지 않음)
  readonly source: "collector" | "csv-arn" | "csv-tenant";
  readonly confirmed: "interactive" | "flag-yes" | null;  // 수집기 계정 확인(C-05). CSV면 null
}
export interface ScopeBlock {
  readonly unit: "region" | "subscription" | "none";
  readonly checked: number | null;
  readonly visible: number | null;
  readonly missing: readonly { readonly name: DisplayValue; readonly reason: UnknownReason; readonly receiptId: string | null }[];
  readonly outOfScope: readonly { readonly name: DisplayValue; readonly reason: "other-tenant" | "not-enabled" | "not-requested" }[];
  readonly subscriptions: readonly {
    readonly id: DisplayValue; readonly name: DisplayValue; readonly state: string;
    readonly queried: "ok" | "partial" | "failed" | "not-queried";
  }[];
  readonly proven: boolean;
}
export interface InputSummary {
  readonly index: number;
  readonly kind: InputKind;
  readonly via: InputVia;
  readonly name: DisplayValue;
  readonly bytes: number;
  readonly asOf: AsOf | null;
  readonly collector: { readonly name: string; readonly version: string; readonly knownRelease: boolean | null } | null;
  readonly schema: { readonly id: string; readonly support: "exact" | "newer-minor" | "older-minor" } | null;
  readonly doors: Readonly<Record<DoorId, "used" | "superseded" | "skipped" | "absent">>;
  readonly scopeProven: boolean;
}
export interface CollectionBlock {
  readonly asOf: AsOf | null;                // 대표 기준 시각 = 판정에 쓴 입력 중 가장 오래된 것
  readonly asOfRange: { readonly oldest: IsoUtc; readonly newest: IsoUtc } | null;
  readonly credentialReport: { readonly generatedAt: IsoUtc | null; readonly source: "api" | "filename" | "file-time" | "unknown" } | null;
  readonly receipts: Readonly<Record<ReceiptResult, number>> & { readonly total: number };
  readonly inputs: readonly InputSummary[];
}
export interface DeniedCall {
  readonly call: string;
  readonly permission: string | null;
  readonly scope: DisplayValue;
  readonly errorCode: string;
  readonly receiptIds: readonly string[];
  readonly times: number;
  readonly ruleIds: readonly RuleId[];
}
export interface PermissionsBlock {
  readonly denied: readonly DeniedCall[];           // 많이 거부된 순
  readonly unlockHints: readonly PermissionHint[];  // 많이 푸는 순
}
/** 첫 화면 고정 '이 도구가 보지 못하는 것' 7개 */
export type GlobalCannotSee =
  | "leaked-keys" | "issued-sas-oauth" | "other-accounts" | "abandoned-test-envs"
  | "app-vulnerabilities" | "idp-mfa" | "resource-policy-sharing";
/** 엔진이 만드는 배너(현재 시각과 무관). 표시 순서 = 배열 순서 */
export type Banner =
  | { readonly kind: "secrets-detected"; readonly count: number }
  | { readonly kind: "areas-not-judged"; readonly doors: readonly DoorId[]; readonly reason: "schema-section" | "field-missing" }
  | { readonly kind: "schema-newer-minor"; readonly got: string; readonly supported: string }
  | { readonly kind: "identity-unconfirmed" }
  | { readonly kind: "collector-unknown-release" }
  | { readonly kind: "csv-scope-unproven" }
  | { readonly kind: "collected-at-approximate" }
  /** [추가 · STEP 5 CC-QA-01, 메인 세션 승인] 입력 안의 기록(생성·회전·마지막 사용 시각)이 그 입력의 기준 시각보다 허용치(5분)를 넘게 늦다 — 기준 시각이 틀렸다는 뜻이다. 파라미터 없음 */
  | { readonly kind: "as-of-before-evidence" }
  | { readonly kind: "doors-skipped"; readonly doors: readonly DoorId[] }
  | { readonly kind: "duplicate-input-ignored"; readonly count: number };
export interface ManualCheckItem {
  readonly id: string;
  readonly origin: "unknown-item" | "unknown-rule" | "guide-card" | "out-of-scope" | "auto-notice";
  readonly door: DoorId | null;
  readonly ruleId: RuleId | null;
  readonly resource: ResourceRef | null;
  readonly what: MsgRef;
  readonly why: MsgRef<UnknownReason> | null;
  readonly howKey: CatalogKey | null;        // 콘솔 위치·속성 안내(룰 데이터의 문구 키)
  readonly resolution: Resolution | null;
}
export type FirstLook =
  /** 위험·주의를 (상태, priority) 순으로 최대 3개. 모자라면 확인 불가 점검을 priority 순으로 채운다 */
  | { readonly mode: "findings"; readonly ruleIds: readonly RuleId[] }
  /** 위험·주의 0개 + 확인 불가 1개 이상: 많이 푸는 해소법 순으로 최대 3묶음 */
  | { readonly mode: "unlock"; readonly groups: readonly { readonly resolution: Resolution; readonly ruleIds: readonly RuleId[] }[] }
  /** 전부 이상 없음·해당 없음 */
  | { readonly mode: "none-found" };

/* ───────── 리포트 ───────── */
export interface Report {
  readonly model: typeof REPORT_MODEL;
  readonly engine: { readonly version: string; readonly rulesetVersion: string };
  readonly mode: { readonly kind: "real" } | { readonly kind: "demo"; readonly setId: DemoSetId };
  readonly identity: IdentityBlock;
  readonly scope: ScopeBlock;
  readonly collection: CollectionBlock;
  readonly permissions: PermissionsBlock;
  readonly cannotSee: readonly GlobalCannotSee[];
  readonly distribution: { readonly rules: Distribution; readonly items: Distribution };  // 화면 = rules(D1)
  readonly banners: readonly Banner[];
  readonly doors: readonly DoorResult[];     // DOORS 순서 5개 고정(미수집 문 포함)
  readonly firstLook: FirstLook;
  readonly manualChecklist: readonly ManualCheckItem[];
}

/* ───────── 룰 카탈로그(정적 데이터, '판정 규칙' 화면과 고치는 법) ───────── */
/** 외부 링크 허용 호스트. 번들 URL 검사와 DocLink 관문이 같은 목록을 쓴다. 추가는 프론트팀장 확인 */
export const LINK_HOSTS = [
  "docs.aws.amazon.com", "aws.amazon.com", "learn.microsoft.com", "azure.microsoft.com",
  "byline.network", "rocket-boys.co.jp", "scan.netsecurity.ne.jp", "www.helpnetsecurity.com", "www.securityweek.com",
  "docs.prowler.com", "github.com",
] as const;
export type LinkHost = (typeof LINK_HOSTS)[number];
export interface ExternalLink { readonly href: `https://${string}`; readonly host: LinkHost }
/** 고치는 법 명령. 자리표시자는 구조로 표현해 그대로 붙여 넣어도 실행되지 않게 한다(R-11) */
export type CliSegment = { readonly t: "text"; readonly v: string } | { readonly t: "ph"; readonly key: CatalogKey };
export interface CliTemplate<K extends "read" | "write" = "read" | "write"> {
  readonly kind: K;
  readonly shell: "aws" | "az";
  readonly segments: readonly CliSegment[];  // write는 ph를 1개 이상 포함(registry 테스트)
}
export interface FixGuide {
  readonly impact: "low" | "medium" | "high";
  readonly prodImpact: boolean;
  readonly observe: { readonly textKey: CatalogKey; readonly doc: ExternalLink | null; readonly commands: readonly CliTemplate<"read">[] };
  readonly change: { readonly textKey: CatalogKey; readonly property: string; readonly doc: ExternalLink; readonly commands: readonly CliTemplate<"write">[] };
  readonly revert: { readonly textKey: CatalogKey; readonly commands: readonly CliTemplate<"write">[] };
  readonly runbook: ExternalLink | null;
}
export interface GuideCard { readonly steps: readonly { readonly id: string; readonly textKey: CatalogKey; readonly doc: ExternalLink | null }[] }
export interface BasisRef { readonly titleKey: CatalogKey; readonly link: ExternalLink; readonly kind: "doc" | "benchmark" | "regulator" | "incident" | "advisory" }
export interface IncidentRef { readonly titleKey: CatalogKey; readonly date: IsoDate; readonly link: ExternalLink; readonly sourceName: string }
export interface RuleParamView {
  readonly key: CatalogKey;
  readonly value: number | string | readonly (number | string)[];
  readonly basis: "public-standard" | "tool-default";   // 화면에 '공개 기준'/'도구 기준'으로 표기
}
export interface RuleCatalogEntry {
  readonly ruleId: RuleId;
  readonly cloud: Cloud;
  readonly door: DoorId;
  readonly kind: RuleKind;
  readonly released: boolean;                // false면 리포트·분포에 넣지 않는다(AZ-MFA-1은 PM Azure 검증 전 false)
  readonly titleKey: CatalogKey;
  readonly summaryKey: CatalogKey;
  readonly maxStatus: MaxStatus;
  readonly allowsClear: boolean;
  readonly priority: number;                 // 18장 전체에서 중복 없는 정수, 작을수록 먼저
  readonly conditionKeys: Readonly<Partial<Record<Status, CatalogKey>>>;
  readonly impactKey: CatalogKey | null;
  readonly questionKey: CatalogKey | null;
  readonly paths: readonly ("csv" | "collector" | "portal-csv" | "guide")[];
  readonly permissions: readonly string[];
  readonly params: readonly RuleParamView[];
  readonly cannotSee: readonly CatalogKey[];
  readonly falsePositiveKeys: readonly CatalogKey[];
  readonly fix: FixGuide | null;
  readonly guide: GuideCard | null;
  readonly basis: readonly BasisRef[];
  readonly incident: IncidentRef | null;
  readonly lastVerified: IsoDate;
}

/* ───────── 입력 인식(리포트 이전, V2 화면) ───────── */
export type RecognitionStatus =
  | "ok" | "empty" | "wrong-type" | "parse-error" | "not-cloudcheck" | "schema-major" | "credentials-file"
  | "too-large" | "too-deep" | "account-mismatch" | "cloud-mismatch" | "superseded";
export interface InputRecognition {
  readonly via: InputVia;
  readonly name: DisplayValue;
  readonly bytes: number;
  readonly status: RecognitionStatus;
  readonly kind: InputKind | null;
  readonly detail: Readonly<Record<string, MsgParam>> | null;   // 예: parse-error {line, col, maybeTruncated}
  readonly identityPreview: { readonly cloud: Cloud; readonly accountLast4: string; readonly alias: DisplayValue | null } | null;
  readonly asOf: AsOf | null;
  readonly doors: readonly DoorId[];
  readonly handle: ParsedHandle | null;      // status = "ok"일 때만 non-null
}

/* ───────── 현재 시각·예외·비교(judge 밖의 순수 함수 결과) ───────── */
/** timeNotices(report, now)의 결과. 체험 모드에서는 빈 배열 */
export type TimeNotice =
  | { readonly kind: "snapshot-age"; readonly level: "stale" | "very-stale"; readonly ageHours: number }
  | { readonly kind: "future-timestamp"; readonly aheadMinutes: number }
  | { readonly kind: "guidance-stale"; readonly ruleIds: readonly RuleId[] };
/** overlayExceptions(report, file, today)의 결과. 상태는 바꾸지 않고 라벨만 덧씌운다(INV-8) */
export interface ExceptionOverlay {
  readonly byItemId: ReadonlyMap<string, Extract<Label, { kind: "exception" }>>;
  readonly entries: readonly { readonly index: number; readonly state: "active" | "expired" | "unmatched" }[];
  readonly counts: { readonly active: number; readonly expired: number; readonly unmatched: number };
}
export interface CompareSide { readonly cloud: Cloud; readonly accountLast4: string; readonly alias: DisplayValue | null; readonly asOf: AsOf | null }
/** better·worse는 위험 > 주의 > (이상 없음 = 해당 없음) 순위로 비교. 확인 불가로 바뀌면 became-unknown, 확인 불가에서 벗어나면 became-known */
export type RuleChange = "better" | "worse" | "same" | "became-unknown" | "became-known";
export type Comparison =
  | { readonly ok: false; readonly reason: "different-account" | "different-cloud" | "same-snapshot"; readonly before: CompareSide; readonly after: CompareSide }
  | {
      readonly ok: true; readonly before: CompareSide; readonly after: CompareSide;
      readonly reordered: boolean;               // 수집 시각 순으로 자동 정렬했는지
      readonly sameCredentialReport: boolean;    // 두 파일의 자격증명 보고서 생성 시각이 같음 → 4시간 캐시 배너
      readonly rules: readonly {
        readonly ruleId: RuleId; readonly before: Status; readonly after: Status; readonly change: RuleChange;
        readonly items: { readonly before: Distribution; readonly after: Distribution };
      }[];
    };
