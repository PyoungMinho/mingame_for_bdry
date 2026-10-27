// src/lib/cloudcheck/contract/normalized.ts — 정규화 입력 계약 v1 (parse → engine)
// D1 확정(2026-10-19, 백엔드팀장 중재). 생산 = @API설계자 parse/normalize.ts buildInput(), 소비 = @DB설계자 engine/judge.ts judge().
// 소유: API설계자(방향서 §3). 변경: 선택 필드 추가 = 두 담당 합의 + 백엔드팀장 승인 / 이름·의미 변경·삭제 = 백엔드팀장 승인 + NORMALIZED_MODEL 메이저 증가.
// 경계 메모: ./NORMALIZED.md
// 원칙
//  1) 사실만 담는다. 상태(5상태)·사유 판정·배너·문장은 없다. 판단은 engine이 한다.
//  2) 모수·범위(FamilyCoverage)는 parse가 영수증(또는 CSV)에서 계산해 sealCoverage()로 봉인한다. engine은 읽기만 하고 만들거나 바꾸지 못한다
//     (봉인 브랜드는 이 파일 밖에서 이름을 댈 수 없고, engine/·rules/의 sealCoverage 사용·캐스팅은 normalized.test.ts 가드가 막는다).
//  3) 출처(수집기 JSON·자격증명 보고서 CSV·Resource Graph CSV·Entra CSV·체험)와 무관하게 같은 모양이다. 출처 차이는 Slot 상태와 coverage가 말한다.
//  4) 다중 입력 병합(§4-8)이 끝난 결과다. 문마다 입력 하나(DoorSelection). 룰은 자기 문의 data만 읽는다.
//  5) 시각은 parse가 엄격 파서로 한 번만 해석한다(Instant). engine은 시각 문자열을 다시 파싱하지 않는다(Date.parse 금지).
//  6) 사용자 데이터 문자열은 원값이다(정리·마스킹 전). 정리·마스킹·DisplayValue 변환은 engine/display. 비밀 패턴(R-12)은 parse가 이미 지웠다(REDACTED_PREFIX).
//  7) 핸들 관계: recognize() → ParsedHandle(입력 1개, parse 전용 내부 객체) → buildInput(핸들들) → NormalizedInput(리포트 1개분) → judge()·maskedCopy().
//     UI는 ParsedHandle·NormalizedInput의 내용을 읽지 않고 그대로 넘긴다.
import type {
  AsOfSource, Cloud, CoverageKind, DemoSetId, DoorId, InputKind, InputSummary, InputVia,
  IsoUtc, PrincipalType, ReceiptResult, Report, UnknownReason,
} from "../model/report";
import type { AwsCall, AzureCall } from "./calls";

export const NORMALIZED_MODEL = "cloudcheck.normalized/1" as const;

/* ───────── 원자 ───────── */
/** parse 엄격 파서를 통과한 UTC 순간. iso = 초 단위 정규형 "YYYY-MM-DDTHH:MM:SSZ"(소수 초는 버림), ms = 같은 순간의 epoch 밀리초(1000의 배수).
 *  나이·경과는 ms 차이로 계산하고, Report에는 iso를 싣는다 */
export interface Instant { readonly iso: IsoUtc; readonly ms: number }
/** 기준 시각 + 출처. Report AsOf = { at: at.iso, source } */
export interface AsOfFact { readonly at: Instant; readonly source: AsOfSource }
/** 기준 시각 후보를 버린 기록(InputFacts.asOfRejected) */
export interface AsOfRejected { readonly candidate: AsOfFact; readonly why: "early-implausible" }
/** 입력 번호를 붙인 영수증 키 = Report ReceiptRef.id(예: "0:r-0012") */
export type ReceiptKey = `${number}:r-${string}`;
export type CsvKind = Exclude<InputKind, "collector-json">;
/**
 * 사실의 출처(Report EvidenceRef의 재료). receipt·csv 중 하나 이상은 non-null. 수집기 JSON 안의 자격증명 보고서 CSV는 둘 다 채운다.
 * csv.row = 스프레드시트 행 번호(머리글 = 1, 첫 데이터 행 = 2), null = 파일 전체 / csv.column = 읽은 열 이름, null = 행 전체
 */
export interface Src {
  readonly input: number;
  readonly receipt: ReceiptKey | null;
  readonly csv: { readonly kind: CsvKind; readonly row: number | null; readonly column: string | null } | null;
}

/* ───────── 사실 슬롯 ───────── */
/** 슬롯 수준 '답이 아님' 사유(UnknownReason의 부분집합). 영수증 실패 4종은 result 그대로 */
export type MissingReason = Extract<UnknownReason,
  | "denied" | "error" | "throttled" | "unsupported"
  | "budget-exceeded" | "field-missing" | "value-unrecognized" | "schema-unsupported"
  | "csv-row-ambiguous" | "stale-evidence" | "not-collected">;
/** 받은 목록이 전부라고 증명할 수 없는 사유 */
export type PartialReason = Extract<UnknownReason,
  "truncated" | "budget-exceeded" | "field-missing" | "csv-row-ambiguous" | "csv-scope-unproven">;
/**
 * 사실 슬롯. 수집기 Ev{receipt, value} + 영수증 result와 CSV 칸을 같은 모양으로 담고, null의 뜻을 parse가 미리 푼다(P2·INV-6).
 *  value   : 답이 있음. 목록이면 완결된 목록(빈 배열 = 완결된 '없음'). 도메인 null(예: allowBlobPublicAccess 미설정)은 value 안의 null
 *  partial : 받은 목록이 전부라는 증명이 없음(잘림·예산 초과·보고서의 추가 키·RG CSV). 받은 부분의 양성은 유효, '없음'은 불가(INV-4)
 *  none    : '설정·대상 없음'이라는 유효한 답(notconfigured, 단일 값 조회의 empty). 예: 계정 공개 차단 설정 없음, 별칭 없음
 *  missing : 답이 아님(영수증 실패·필드 부재·값 해석 불가·섹션 스키마 실패·이 출처에 없음)
 * 영수증 → 슬롯: ok + 값 = value / empty + 값([]) = value / empty + null(단일 값) = none / truncated + 값 = partial / notconfigured + null = none
 *  / denied·error·throttled·unsupported + null = missing(result) / ok + null = missing(field-missing)
 *  / 실패·notconfigured인데 값이 있음 = 모순 → 그 섹션 전체 missing(schema-unsupported) + notices.sectionIssues
 */
export type Slot<T> =
  | { readonly k: "value"; readonly value: T; readonly src: Src }
  | { readonly k: "partial"; readonly value: T; readonly why: PartialReason; readonly src: Src }
  | { readonly k: "none"; readonly src: Src }
  | { readonly k: "missing"; readonly why: MissingReason; readonly src: Src | null };

/** 비밀 패턴(R-12)이 감지돼 parse가 지운 문자열 값 = REDACTED_PREFIX + 입력 안 순번. 실제 값·다른 지운 값과 같아지지 않는다
 *  (parse는 입력 문자열의 U+0000을 먼저 U+FFFD로 바꾼다). 조인·비교에서는 불투명 문자열로 두고, engine/display는 정리보다 먼저 확인해 redacted로 그린다 */
export const REDACTED_PREFIX = "\u0000cc-redacted:";
export const isRedacted = (s: string): boolean => s.startsWith(REDACTED_PREFIX);

/* ───────── 영수증 색인 ───────── */
export interface ReceiptFact {
  readonly key: ReceiptKey;
  readonly input: number;
  readonly call: AwsCall | AzureCall;
  readonly region: string | null;        // "global" 또는 AWS 리전
  readonly subscription: string | null;  // Azure 구독 ID(소문자)
  readonly resource: string | null;      // 항목 단위 호출의 대상(사용자명·버킷 이름·리소스 ID, 사용자 데이터). 항목 단위 호출에는 반드시 있다(INV-7 재료)
  readonly result: ReceiptResult;
  readonly count: number | null;
  readonly errorCode: string | null;
  readonly at: Instant;
  /** 판정에 쓰인 영수증인가: 호출의 phases(calls.ts) 중 문이 이 입력에서 선택됐거나, identity 단계이고 이 입력이 신원 출처이거나,
   *  scope 단계이고 이 입력에서 선택된 문이 하나라도 있으면 true. 권한 패널·호출 집계는 used만 센다 */
  readonly used: boolean;
}

/* ───────── 패밀리(열거 단위)와 범위 ───────── */
/**
 * 패밀리 = 같은 종류 대상의 열거. ID = <cloud>.<문>.<이름>(문마다 입력이 다를 수 있어 문별로 둔다).
 * 모수(population) = 열거된 구성원 수다. 적용 대상 여부(콘솔 사용자·활성 키·관리자 정책·서비스 연결 역할·루트 자격증명 유무)는 거르지 않는다 —
 * 그것은 룰의 판단이고 engine core가 구성원별 '제외'(증거 필요)로 처리한다(NORMALIZED.md §4).
 * complete(5조건 ①②③) 공통: 열거 호출 ok·empty(잘림·예산 초과 없음) + 범위 단위(리전·구독) 전부 ok + 출처 scopeProven. 패밀리별 조건은 각 줄 주석.
 */
export const AWS_FAMILIES = [
  "aws.mfa.credential-report", // 보고서 행(루트 포함). 보고서 ok + 필수 열 + 모든 행 파싱 + 루트 행 + (수집기) IAM 사용자 행 수 = accountSummary.Users
  "aws.mfa.root",              // 루트 1. 보고서 ok + 필수 열 + 루트 행 파싱
  "aws.mfa.users",             // IAM 사용자(루트 제외). 수집기 = list-users ok·empty(예산 안), 답이 없으면 보고서 행 / CSV = 보고서 행(credential-report 완결과 같음)
  "aws.key.credential-report", // mfa와 같은 조건(key 문의 입력 기준)
  "aws.key.users",             // mfa와 같은 조건(key 문의 입력 기준)
  "aws.key.access-keys",       // IAM 사용자의 액세스 키(상태 무관). key.users 완결 + 모든 사용자의 keys 슬롯이 value
  "aws.key.roles",             // IAM 역할(서비스 연결 역할 포함). list-roles ok·empty
  "aws.net.security-groups",   // 활성 리전의 보안 그룹. regions value + 요청 리전이 활성 리전 전부 + 리전마다 describe-security-groups ok·empty
  "aws.net.enis",              // 같은 조건, describe-network-interfaces
  "aws.sto.account",           // 계정 1. s3:GetAccountPublicAccessBlock ok 또는 notconfigured
  "aws.sto.buckets",           // 버킷. list-buckets ok·empty + 예산 안
  "aws.log.account",           // 계정 1(trail 구성 전체를 한 대상으로 판정하는 룰용). describe-trails ok·empty
  "aws.log.trails",            // trail. describe-trails ok·empty
] as const;
export const AZURE_FAMILIES = [
  "azure.mfa.entra-users",      // Entra 사용자(포털 CSV, AZ-MFA-1 조건부). 항상 미완결(csv-scope-unproven: 비활성 사용자 제외·지연)
  "azure.key.storage-accounts", // 범위 안 구독의 스토리지 계정. subscriptions value + 범위 안 구독마다 storage account list ok·empty + 예산 안. RG CSV = 미완결(csv-scope-unproven)
  "azure.net.nsgs",             // NSG. subscriptions value + 범위 안 구독마다 nsg list ok·empty. RG CSV = 미완결(csv-scope-unproven)
  "azure.net.nics",             // NIC. 같은 조건(nic list). RG CSV = not-collected
  "azure.net.public-ips",       // 공인 IP. 같은 조건(public-ip list). RG CSV = not-collected
  "azure.sto.storage-accounts", // key와 같은 조건(sto 문의 입력 기준)
  "azure.sto.containers",       // 컨테이너. sto.storage-accounts 완결 + 계정마다 containers 슬롯 value. RG CSV = not-collected
  "azure.log.subscriptions",    // 범위 안 구독(활동 로그 내보내기 판정 대상). subscriptions value
  "azure.log.storage-accounts", // key와 같은 조건(log 문의 입력 기준)
] as const;
export type AwsFamilyId = (typeof AWS_FAMILIES)[number];
export type AzureFamilyId = (typeof AZURE_FAMILIES)[number];
export type FamilyId = AwsFamilyId | AzureFamilyId;
export type CloudFamilies<C extends Cloud> = C extends "aws" ? AwsFamilyId : AzureFamilyId;
/** 한 문의 패밀리만(룰 데이터가 자기 문 밖 패밀리를 선언하지 못하게) */
export type DoorFamilies<C extends Cloud, D extends DoorId> = Extract<CloudFamilies<C>, `${string}.${D}.${string}`>;
/** 패밀리가 속한 문(ID의 두 번째 마디) */
export const familyDoor = (f: FamilyId): DoorId => f.split(".")[1] as DoorId;

/** 리전·구독 단위 조회 결과(Report ScopeBlock의 missing·subscriptions 재료) */
export interface UnitCoverage {
  readonly unit: string;                                   // AWS 리전 이름 또는 Azure 구독 ID(소문자)
  readonly state: "ok" | "partial" | "failed" | "not-queried";
  readonly why: UnknownReason | null;                      // ok면 null. 예: denied, truncated, region-missing(요청 리전에서 빠짐)
  readonly receipt: ReceiptKey | null;
}
declare const sealed: unique symbol;
/**
 * 패밀리 하나의 열거 완결·모수(parse 계산, 봉인). engine core는 complete인 것으로만 ScopeProof를 발급한다.
 * 불변식(sealCoverage가 강제): complete ⇔ gaps 빈 배열 ⇔ population non-null / complete ⇒ population = present, input non-null,
 *  unit.covered = unit.total(non-null), units 전부 ok, expected는 null이거나 = present
 */
export interface FamilyCoverage<F extends FamilyId = FamilyId> {
  readonly [sealed]: true;
  readonly family: F;
  readonly input: number | null;            // 이 패밀리가 속한 문의 선택 입력(문이 선택되지 않았으면 null)
  readonly complete: boolean;
  readonly population: number | null;       // 증명된 구성원 수(complete일 때만)
  readonly present: number;                 // 문 data에 들어 있는 구성원 수
  readonly expected: number | null;         // 출처가 말한 전체 수(budget.total, accountSummary.Users 등). 모르면 null
  readonly gaps: readonly UnknownReason[];  // 완결이 아닌 이유(미완결이면 1개 이상)
  readonly receipts: readonly ReceiptKey[]; // 열거를 증명한 영수증(CSV 출처면 빈 배열)
  readonly unit: { readonly kind: CoverageKind; readonly covered: number | null; readonly total: number | null };  // Report Coverage의 kind·covered·total
  readonly units: readonly UnitCoverage[];  // 리전·구독 단위 패밀리만. 그 밖은 빈 배열
  /**
   * [추가 · STEP 5 CC-QA-02·15] 증명된 모수의 구성원 신원 집합. complete일 때만 채우고(미완결·신원 없음이면 생략), 정렬된 중복 없는 문자열이며 개수 = population이다
   * (sealCoverage가 강제: 중복이 있거나 개수가 present와 다르면 미완결로 봉인한다). 엔진은 '구성원 수'가 아니라 이 집합으로 룰의 구성원을 대조해
   * 개수만 맞는 바꿔치기(다른 구독·같은 대상 복제)를 막는다. 신원 문자열은 룰이 구성원 ResourceDesc.id로 쓰는 값과 같은 규칙이다:
   *   aws.mfa.users · aws.key.users = IAM 사용자 이름 / aws.key.access-keys = "<사용자>/<키 끝 4자리 또는 slotN>"(룰의 keyLabel) / aws.key.roles = 역할 이름
   *   aws.net.security-groups · aws.net.enis = "<리전>/<ID>"(리전 단위 ID라 리전을 앞에 붙인다) / aws.sto.buckets = 버킷 이름 / aws.log.trails = trail ARN
   *   aws.mfa.root = "root" / aws.sto.account · aws.log.account = 계정 ID / aws.*.credential-report = 보고서 user 열 값(루트는 "<root_account>")
   *   azure.*.storage-accounts · azure.net.nsgs · nics · public-ips = 소문자 리소스 ID / azure.sto.containers = "<소문자 계정 리소스 ID>/<컨테이너 이름>"
   *   azure.log.subscriptions = 범위 안 구독 ID(소문자). 비밀 모양으로 지운 이름은 지운 토큰 그대로.
   */
  readonly memberKeys?: readonly string[];
}
export type CoverageDraft<F extends FamilyId = FamilyId> = Omit<FamilyCoverage<F>, typeof sealed>;
export type CoverageTable<F extends FamilyId> = { readonly [K in F]: FamilyCoverage<K> };

const isCount = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;

/**
 * 봉인. parse(buildInput)와 fixtures(micro·회사 빌더)만 부른다 — engine/·rules/는 import 금지(가드 테스트).
 * 예외를 던지지 않는다. 불변식이 깨진 초안은 미완결로 봉인한다(fail-closed): gaps가 비었으면 population-mismatch 또는 scope-unproven을 넣는다.
 * 결과는 깊게 freeze된다.
 */
export function sealCoverage<F extends FamilyId>(d: CoverageDraft<F>): FamilyCoverage<F> {
  const gaps: UnknownReason[] = [...new Set(d.gaps)];
  const present = isCount(d.present) ? d.present : 0;
  const expected = isCount(d.expected) ? d.expected : null;
  const input = isCount(d.input) ? d.input : null;
  let flaw: UnknownReason | null = null;
  if (!d.complete) flaw = "scope-unproven";
  else if (!isCount(d.population) || d.population !== present || (expected !== null && expected !== present)) flaw = "population-mismatch";
  else if (input === null || !isCount(d.present) || d.unit.covered === null || d.unit.covered !== d.unit.total
    || d.units.some((u) => u.state !== "ok")) flaw = "scope-unproven";
  // 구성원 신원 집합: 완결일 때만 의미가 있다. 중복이 있거나 개수가 모수와 다르면 개수만 맞는 열거이므로 미완결로 봉인한다
  let keys: string[] | null = null;
  if (flaw === null && d.memberKeys !== undefined) {
    const list = Array.isArray(d.memberKeys) ? [...d.memberKeys] : [];
    if (!list.every((k) => typeof k === "string") || new Set(list).size !== list.length || list.length !== present) flaw = "population-mismatch";
    else keys = list.sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
  }
  const proven = flaw === null && gaps.length === 0;
  const out = {
    family: d.family,
    input,
    complete: proven,
    population: proven ? present : null,
    present,
    expected,
    gaps: Object.freeze(proven ? [] : gaps.length > 0 ? gaps : [flaw ?? "scope-unproven"]),
    receipts: Object.freeze([...d.receipts]),
    unit: Object.freeze({ kind: d.unit.kind, covered: d.unit.covered, total: d.unit.total }),
    units: Object.freeze(d.units.map((u) => Object.freeze({ unit: u.unit, state: u.state, why: u.why, receipt: u.receipt }))),
    ...(proven && keys !== null ? { memberKeys: Object.freeze(keys) } : {}),
  };
  return Object.freeze(out) as unknown as FamilyCoverage<F>;
}
/** 이 패밀리의 사실이 없음(문 미선택이면 input = null, 선택된 출처에 이 패밀리가 없으면 그 입력 번호). parse·fixtures 전용 */
export function notCollectedCoverage<F extends FamilyId>(family: F, input: number | null = null): FamilyCoverage<F> {
  return sealCoverage({
    family, input, complete: false, population: null, present: 0, expected: null, gaps: ["not-collected"],
    receipts: [], unit: { kind: "none", covered: null, total: null }, units: [],
  });
}

/* ───────── 신원·입력·문 선택 ───────── */
interface IdentityBase {
  readonly input: number;                  // 신원 출처: 수집기 JSON 중 기준 시각이 가장 최신인 것, 없으면 CSV 중 가장 최신인 것. 기준 시각이 같으면(둘 다 없음 포함) 내용(원본 바이트 SHA-256)이 작은 것 — 입력 위치로 고르지 않는다(N1)
  readonly principalType: PrincipalType;   // 수집기 값을 모델 어휘로(user → iam-user·entra-user, servicePrincipal → service-principal …). CSV = unknown
  readonly confirmed: "interactive" | "flag-yes" | null;  // 수집기 run.confirmed(C-05). CSV = null
  readonly receipt: ReceiptKey | null;     // 신원 호출 영수증(sts:GetCallerIdentity, az account show). CSV = null
}
export interface AwsIdentity extends IdentityBase {
  readonly source: "collector" | "csv-arn";
  readonly accountId: string;              // 12자리 전체(P5). CSV 경로 = 보고서 arn 열
  readonly alias: Slot<string>;            // none = 별칭 없음. CSV 경로 = missing(not-collected)
  readonly principalName: string | null;   // 사용자명·역할명(세션명 없음)
}
export interface AzureIdentity extends IdentityBase {
  readonly source: "collector" | "csv-tenant";
  readonly tenantId: string;               // 소문자. CSV 경로 = tenantId 열
  readonly currentSubscription: string | null;   // 소문자. CSV 경로 = null
  readonly cloudName: string | null;
}

/** 받아들인 입력 1개(계정·클라우드 불일치로 뺀 것은 없음, 문이 하나도 안 쓰인 입력은 있음). Report InputSummary의 재료 */
export interface InputFacts {
  readonly index: number;                  // = inputs 배열 위치 = ReceiptKey 접두
  readonly kind: InputKind;
  readonly via: InputVia;
  readonly name: string;                   // 파일 이름 원값(engine이 fileName으로 표시). 체험 입력은 세트 글자 없는 "cloudcheck-demo.<cloud>.json"
  readonly bytes: number;
  readonly asOf: AsOfFact | null;          // 수집기 = collectedAt(collected-at) / CSV = 파일 이름 시각(filename) 또는 lastModified(file-time) / 둘 다 없거나 믿을 수 없으면 null
  /**
   * [추가 · STEP 5 CC-QA-01] 기준 시각 후보가 있었지만 믿을 수 없어 버려서 asOf가 null이 된 입력의 기록(그 밖은 생략).
   * why "early-implausible" = 후보가 2000-01-01보다 이르다(파일 시각 0 = 1970, FAT·ZIP의 1980 같은 '시각 없음' 값). 나이를 쓰는 룰이 field-missing 대신 이 사실을 설명에 쓸 수 있다
   */
  readonly asOfRejected?: AsOfRejected;
  /**
   * [추가 · STEP 5 CC-QA-01] 이 입력의 데이터 안에서 읽은 가장 늦은 증거 시각(자격증명 보고서 CSV의 생성·회전·마지막 사용 시각 — 미래 날짜인 password_next_rotation은 뺀다 /
   * Resource Graph 저장소 CSV·Azure 수집기의 키 생성 시각). 없거나 계산하지 않으면 null·생략(AWS 수집기 JSON은 서버 시각인 보고서 생성 시각이 기준이라 계산하지 않는다).
   * latestEvidence.ms > asOf.at.ms + 5분이면 기준 시각이 증거보다 이른 것이다(PC·CLI 시계가 늦거나 파일 시각·이름이 틀림) — 룰은 스스로 시각 역전을 찾지만(rules/kit reversedIn),
   * 리포트 알림·설명은 이 값을 쓰면 데이터를 다시 훑지 않아도 된다. asOf를 이 값으로 끌어올리지는 않는다(끌어올리면 '방금 사용'으로 보여 역전이 가려진다)
   */
  readonly latestEvidence?: Instant | null;
  readonly runKey: string | null;          // 수집기 JSON만(collect-schema.ts runKey)
  readonly collector: {
    readonly name: "cloudcheck-aws" | "cloudcheck-azure";
    readonly version: string;
    readonly sha256: string | null;
    readonly knownRelease: boolean | null; // RELEASES.json과 (version, sha256) 일치 = true, 불일치 = false, sha256 null = null
  } | null;
  readonly schema: InputSummary["schema"];
  readonly doors: InputSummary["doors"];   // used = 이 입력에서 선택 / superseded = 다른 입력이 선택됨 / skipped = --doors로 건너뜀 / absent = 이 입력에 없는 문
  readonly scopeProven: boolean;           // 수집기 = 범위 목록(리전·구독) value / 자격증명 CSV = §4-7 조건 / Resource Graph·Entra CSV = 항상 false
}

/** 문 하나의 입력 선택(§4-8). data는 선택된 문에만 있다 */
export type DoorSelection<D> =
  | { readonly state: "selected"; readonly input: number; readonly asOf: AsOfFact | null; readonly data: D }
  | { readonly state: "skipped"; readonly inputs: readonly number[] }   // 이 문을 담을 수집기 실행이 모두 --doors로 건너뜀, 대신할 입력 없음
  | { readonly state: "absent" };                                        // 이 문을 담은 입력이 없음(예: 자격증명 CSV만 → net·sto·log)

export interface SectionIssue { readonly input: number; readonly door: DoorId; readonly section: string; readonly reason: "schema-section" | "field-missing" }
/** engine이 배너를 만들 재료 중 다른 필드에서 다시 계산할 수 없는 것(나머지 배너 재료는 inputs·doors·identity에 있다) */
export interface ParseNotices {
  readonly redactions: number;                      // 비밀 패턴으로 지운 값 수(R-12) → secrets-detected
  readonly sectionIssues: readonly SectionIssue[];  // 선택된 (입력, 문)에서 읽지 못한 섹션 → areas-not-judged
}

/* ───────── AWS 사실 ───────── */
/** 자격증명 보고서 자체에 대한 사실(행 내용은 root·users로 풀어 둔다). 필수 열이 없으면 슬롯이 missing(field-missing) */
export interface AwsCredentialReport {
  readonly generatedAt: Instant | null;
  readonly generatedAtSource: "api" | "filename" | "file-time" | "unknown";   // api = 수집기 generatedTime
  readonly rows: number;                       // 데이터 행 수(루트·해석 불가 행 포함)
  readonly ambiguousRows: readonly number[];   // 필드 수가 머리글과 다른 행. 사용자로 만들지 않는다(§4-7)
  readonly rootRow: number | null;
  readonly hasAdditionalCredentialsColumn: boolean;
}
export interface AwsAccountSummary {           // get-account-summary 7개 키(없는 키 = null)
  readonly users: number | null;
  readonly groups: number | null;
  readonly roles: number | null;
  readonly accountMfaEnabled: number | null;
  readonly accountAccessKeysPresent: number | null;
  readonly accountSigningCertificatesPresent: number | null;
  readonly mfaDevicesInUse: number | null;
}
export interface AwsAccessKey {
  readonly src: Src;                       // 열거 출처: 수집기 list-access-keys 영수증 또는 보고서 행
  readonly slot: 1 | 2 | null;             // 보고서 슬롯(조인됐을 때). 3번째 키부터·조인 실패면 null
  readonly idSuffix: string | null;        // 키 ID 끝 4자리(수집기만)
  readonly status: string | null;          // 수집기 Status 원문(표시용)
  readonly active: Slot<boolean>;          // 수집기 Status(Active → true, Inactive·Expired → false, 그 밖 → missing(value-unrecognized)) > 보고서 access_key_N_active
  readonly createdAt: Slot<Instant>;       // 수집기 CreateDate > 보고서 access_key_N_last_rotated
  readonly lastUsed: Slot<Instant | null>; // 보고서 access_key_N_last_used_date. null = N/A(미사용·2015-04-22 이전). 3번째 키부터·조인 실패 = missing(not-collected)
  readonly lastUsedRegion: string | null;  // 보고서(N/A면 null)
  readonly lastUsedService: string | null;
}
/** 자격증명 사실(루트·IAM 사용자 공통). 수집기 실시간 출처가 있으면 우선하고, 없거나 실패하면 보고서로 대체한다(§4-7 우선순위) */
export interface AwsCredentialFacts {
  readonly passwordEnabled: Slot<boolean>;           // 보고서 password_enabled만(TRUE·FALSE 외 = missing(value-unrecognized)). 보고서에 없는 사용자 = missing(stale-evidence)
  readonly passwordLastUsed: Slot<Instant | null>;   // 수집기 list-users PasswordLastUsed > 보고서 password_last_used. null = 사용 기록 없음(수집기 null·no_information·N/A)
  readonly mfaActive: Slot<boolean>;                 // 수집기 list-mfa-devices(장치 1개 이상 = true) > 보고서 mfa_active
  readonly keys: Slot<readonly AwsAccessKey[]>;      // 수집기 list-access-keys(3번째 키 포함) > 보고서 슬롯 1·2(있는 키만). 보고서만이고 additional_credentials_info에 값이 있거나 그 열이 없으면 partial
}
export interface AwsRoot extends AwsCredentialFacts {
  readonly src: Src;                                 // 보고서 루트 행(<root_account>). 루트 사실은 보고서에서만 온다
}
export interface AwsIamUser extends AwsCredentialFacts {
  readonly src: Src;                                 // 열거 출처(list-users 영수증 또는 보고서 행)
  readonly name: string;
  readonly createdAt: Slot<Instant>;                 // list-users CreateDate > 보고서 user_creation_time
  readonly mfaDevices: number | null;                // 실시간 MFA 장치 수(수집기만)
  readonly attachedPolicyArns: Slot<readonly string[]>;   // 수집기만(CSV 경로 = missing(not-collected), 예산 밖 사용자 = missing(budget-exceeded))
  readonly groupNames: Slot<readonly string[]>;
}
export interface AwsIamGroup { readonly name: string; readonly attachedPolicyArns: Slot<readonly string[]> }
export interface AwsTrustStatement {
  readonly effect: string;
  readonly actions: readonly string[];
  readonly notPrincipal: boolean;
  readonly principal: {
    readonly wildcard: boolean; readonly aws: readonly string[]; readonly service: readonly string[];
    readonly federated: readonly string[]; readonly canonicalUserCount: number;
  };
  readonly conditionKeys: readonly string[];        // "StringEquals:sts:ExternalId" 형태. 조건 값 없음
}
export interface AwsIamRole {
  readonly src: Src;
  readonly name: string;
  readonly path: string;
  readonly createdAt: Instant | null;
  readonly trust: Slot<readonly AwsTrustStatement[]>;   // 수집기 trust null(형태 해석 실패) = missing(value-unrecognized)
}
export interface AwsMfaData {
  readonly credentialReport: Slot<AwsCredentialReport>;
  readonly accountSummary: Slot<AwsAccountSummary>;       // CSV 경로 = missing(not-collected)
  readonly root: Slot<AwsRoot>;                           // 보고서 없음 = 그 사유 / 루트 행 없음 = missing(field-missing) / 루트 행 해석 불가 = missing(csv-row-ambiguous)
  readonly users: Slot<readonly AwsIamUser[]>;
}
export interface AwsKeyData {
  readonly credentialReport: Slot<AwsCredentialReport>;
  readonly accountSummary: Slot<AwsAccountSummary>;
  readonly users: Slot<readonly AwsIamUser[]>;
  readonly groups: readonly AwsIamGroup[];                 // 사용자 groupNames로 찾은 그룹(수집기만, 이름순)
  readonly roles: Slot<readonly AwsIamRole[]>;            // CSV 경로 = missing(not-collected)
}
export interface AwsIngressRule {
  readonly protocol: string; readonly fromPort: number | null; readonly toPort: number | null;
  readonly cidrs: readonly string[]; readonly ipv6Cidrs: readonly string[]; readonly prefixListIds: readonly string[]; readonly sgRefCount: number;
}
export interface AwsSecurityGroup {
  readonly src: Src; readonly id: string; readonly name: string; readonly vpcId: string | null; readonly region: string;
  readonly ingress: readonly AwsIngressRule[];
}
export interface AwsEni {
  readonly src: Src; readonly id: string; readonly region: string; readonly groupIds: readonly string[];
  readonly hasPublicIp: boolean; readonly hasIpv6: boolean;   // IP 값 자체는 없다(모름 = 영수증 실패 → 리전 목록 슬롯이 missing)
  readonly interfaceType: string | null; readonly status: string | null; readonly requesterManaged: boolean;
}
export interface PerRegion<T> { readonly region: string; readonly items: Slot<readonly T[]> }
export interface AwsNetData {
  readonly regions: Slot<readonly string[]>;              // 활성 리전(ec2:DescribeRegions)
  readonly regionsRequested: readonly string[] | null;     // 수집기가 리전을 제한했으면 그 목록
  readonly securityGroups: readonly PerRegion<AwsSecurityGroup>[];   // 조회한 리전만, 리전 이름순(빠진 리전은 coverage.units)
  readonly networkInterfaces: readonly PerRegion<AwsEni>[];
}
export interface AwsPab {
  readonly blockPublicAcls: boolean; readonly ignorePublicAcls: boolean;
  readonly blockPublicPolicy: boolean; readonly restrictPublicBuckets: boolean;
}
export interface AwsBucket {
  readonly src: Src;
  readonly name: string;
  readonly createdAt: Instant | null;
  readonly region: Slot<string>;                                  // list-buckets BucketRegion 또는 get-bucket-location
  readonly publicAccessBlock: Slot<AwsPab>;                       // none = 버킷 공개 차단 설정 없음
  readonly policyStatus: Slot<{ readonly isPublic: boolean }>;    // none = 버킷 정책 없음(NoSuchBucketPolicy)
  readonly acl: Slot<{ readonly publicGrants: readonly { readonly grantee: "AllUsers" | "AuthenticatedUsers"; readonly permission: string }[] }>;
  readonly ownership: Slot<{ readonly objectOwnership: string }>; // none = 소유권 설정 없음
  readonly website: Slot<{ readonly enabled: true }>;             // none = 정적 웹사이트 아님
}
export interface AwsStoData {
  readonly accountPublicAccessBlock: Slot<AwsPab>;        // none = NoSuchPublicAccessBlockConfiguration(INV-6)
  readonly buckets: Slot<readonly AwsBucket[]>;           // partial = 예산 초과·잘림
}
export interface AwsTrail {
  readonly src: Src;
  readonly name: string; readonly arn: string; readonly homeRegion: string;
  readonly isMultiRegion: boolean; readonly isOrganizationTrail: boolean; readonly logFileValidationEnabled: boolean;
  readonly hasCloudWatchLogs: boolean; readonly hasCustomEventSelectors: boolean;
  readonly status: Slot<{ readonly isLogging: boolean; readonly hasDeliveryError: boolean }>;
  readonly selectors: Slot<{
    readonly basic: readonly { readonly readWriteType: string; readonly includeManagementEvents: boolean }[];
    readonly advanced: readonly { readonly fields: readonly { readonly field: string; readonly equals: readonly string[] }[] }[];
  }>;
}
export interface AwsLogData { readonly trails: Slot<readonly AwsTrail[]> }
export interface AwsDoors {
  readonly mfa: DoorSelection<AwsMfaData>;
  readonly key: DoorSelection<AwsKeyData>;
  readonly net: DoorSelection<AwsNetData>;
  readonly sto: DoorSelection<AwsStoData>;
  readonly log: DoorSelection<AwsLogData>;
}

/* ───────── Azure 사실(리소스 ID·GUID는 parse가 소문자로 정규화: 조인·MatchKey용) ───────── */
export interface AzureSubscription {
  readonly id: string; readonly name: string; readonly state: string; readonly tenantId: string;
  readonly inScope: boolean; readonly outOfScopeReason: "other-tenant" | "not-enabled" | "not-requested" | null;
}
export interface AzureScope {
  readonly subscriptions: Slot<readonly AzureSubscription[]>;   // 수집기 az account list. CSV 경로 = missing(not-collected)
  readonly subscriptionsRequested: readonly string[] | null;
}
/** 구독별 목록. 수집기 = 구독마다 영수증 / RG CSV = subscriptionId 열로 묶고 items는 partial(csv-scope-unproven) */
export interface PerSubscription<T> { readonly subscription: string; readonly items: Slot<readonly T[]> }
export interface AzureDiagSetting {
  readonly name: string;
  readonly logs: readonly { readonly category: string | null; readonly categoryGroup: string | null; readonly enabled: boolean }[];
  readonly destinations: { readonly workspace: boolean; readonly storage: boolean; readonly eventHub: boolean; readonly partner: boolean };
}
export interface AzureContainer { readonly name: string; readonly publicAccess: string | null }
export interface AzureStorageAccount {
  readonly src: Src;
  readonly id: string;
  readonly name: string;
  readonly subscription: string;
  readonly kind: string | null;
  readonly location: string;
  readonly allowBlobPublicAccess: Slot<boolean | null>;    // null = 미설정(차단 아님). RG CSV 빈 칸 = null
  readonly allowSharedKeyAccess: Slot<boolean | null>;     // null = 미설정
  readonly key1CreatedAt: Slot<Instant | null>;            // keyCreationTime.key1. null = 기록 없음
  readonly key2CreatedAt: Slot<Instant | null>;
  readonly keyExpirationPeriodInDays: Slot<number | null>;
  readonly sasExpirationPeriod: Slot<string | null>;
  readonly publicNetworkAccess: Slot<string | null>;       // RG CSV = missing(not-collected)
  readonly networkDefaultAction: Slot<string | null>;      // RG CSV = missing(not-collected)
  readonly containers: Slot<readonly AzureContainer[]>;    // 수집기 container-rm. RG CSV = missing(not-collected)
  readonly blobDiagnostics: Slot<readonly AzureDiagSetting[]>;   // RG CSV = missing(not-collected)
}
export interface AzureNsgRule {
  readonly name: string; readonly direction: string; readonly access: string; readonly priority: number; readonly protocol: string;
  readonly sourcePrefixes: readonly string[];    // sourceAddressPrefix(es)를 합친 목록
  readonly sourceAsgCount: number | null;        // RG CSV = null(모름)
  readonly destPortRanges: readonly string[];    // destinationPortRange(s)를 합친 목록
}
export interface AzureNsg {
  readonly src: Src;
  readonly id: string; readonly name: string; readonly location: string; readonly subscription: string;
  readonly rules: readonly Slot<AzureNsgRule>[]; // 읽지 못한 규칙 행 = missing(value-unrecognized)
  readonly nicIds: Slot<readonly string[]>;      // RG CSV = missing(not-collected)
  readonly subnetIds: Slot<readonly string[]>;   // RG CSV = missing(not-collected)
  readonly nicCount: number | null;
  readonly subnetCount: number | null;
}
export interface AzureNic {
  readonly src: Src; readonly id: string; readonly subscription: string; readonly nsgId: string | null;
  readonly ipConfigs: readonly { readonly subnetId: string | null; readonly publicIpId: string | null }[];
}
export interface AzurePublicIp {
  readonly src: Src; readonly id: string; readonly subscription: string;
  readonly hasAddress: boolean; readonly allocationMethod: string | null; readonly attachedTo: string | null;
}
/** AZ-MFA-1(released: false) 자리. 포털 CSV 열 구성 [미확인] → 편입 때 minor로 확정 */
export interface EntraUserRegistration {
  readonly src: Src;
  readonly user: string;                         // UPN 또는 표시 이름(사용자 데이터, upn)
  readonly isAdmin: Slot<boolean>;
  readonly mfaCapable: Slot<boolean>;
  readonly mfaRegistered: Slot<boolean>;
}
export interface AzureMfaData { readonly entraUsers: Slot<readonly EntraUserRegistration[]> }   // 수집기 = missing(not-collected)
export interface AzureKeyData extends AzureScope { readonly storageAccounts: readonly PerSubscription<AzureStorageAccount>[] }
export interface AzureNetData extends AzureScope {
  readonly nsgs: readonly PerSubscription<AzureNsg>[];
  readonly nics: readonly PerSubscription<AzureNic>[];           // RG CSV = []
  readonly publicIps: readonly PerSubscription<AzurePublicIp>[]; // RG CSV = []
}
export interface AzureStoData extends AzureScope { readonly storageAccounts: readonly PerSubscription<AzureStorageAccount>[] }
export interface AzureLogData extends AzureScope {
  readonly activityLogExports: readonly PerSubscription<AzureDiagSetting>[];   // 빈 배열 value = 내보내기 설정 없음(완결)
  readonly storageAccounts: readonly PerSubscription<AzureStorageAccount>[];   // blobDiagnostics 판정용
}
export interface AzureDoors {
  readonly mfa: DoorSelection<AzureMfaData>;
  readonly key: DoorSelection<AzureKeyData>;
  readonly net: DoorSelection<AzureNetData>;
  readonly sto: DoorSelection<AzureStoData>;
  readonly log: DoorSelection<AzureLogData>;
}

/* ───────── 체험 입력 이름 규약(UI ↔ parse) ───────── */
/** UI는 recognize({ via: "demo", name: demoInputName(set, cloud), … })로 넘긴다. parse는 이름에서 세트를 읽어 mode를 정하고,
 *  InputFacts.name은 세트 글자 없는 "cloudcheck-demo.<cloud>.json"으로 바꾼다(세트 글자 비표시, 디자인 Q14).
 *  via = "demo"인데 이름이 규약과 다르면 not-cloudcheck. demo 입력과 다른 입력은 한 리포트에 섞지 않는다 */
export const DEMO_NAME_RE = /^cloudcheck-demo-([ABCD])\.(aws|azure)\.json$/;
export const demoInputName = (setId: DemoSetId, cloud: Cloud): string => `cloudcheck-demo-${setId}.${cloud}.json`;

/* ───────── 정규화 입력 ───────── */
interface NormalizedBase {
  readonly model: typeof NORMALIZED_MODEL;
  readonly mode: Report["mode"];                             // 모든 입력이 via = demo(같은 세트)일 때만 demo
  readonly inputs: readonly InputFacts[];
  readonly receipts: ReadonlyMap<ReceiptKey, ReceiptFact>;   // 받아들인 입력 전부의 영수증(판정에 쓰였는지는 used)
  readonly notices: ParseNotices;
}
export interface AwsNormalizedInput extends NormalizedBase {
  readonly cloud: "aws";
  readonly identity: AwsIdentity;
  readonly doors: AwsDoors;
  readonly coverage: CoverageTable<AwsFamilyId>;
}
export interface AzureNormalizedInput extends NormalizedBase {
  readonly cloud: "azure";
  readonly identity: AzureIdentity;
  readonly doors: AzureDoors;
  readonly coverage: CoverageTable<AzureFamilyId>;
}
/** buildInput()이 만들고 judge()·maskedCopy()가 먹는다. buildInput은 깊게 freeze해서 돌려준다(receipts Map은 ReadonlyMap 타입으로 막는다) */
export type NormalizedInput = AwsNormalizedInput | AzureNormalizedInput;
