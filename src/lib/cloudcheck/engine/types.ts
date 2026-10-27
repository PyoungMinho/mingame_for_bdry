// src/lib/cloudcheck/engine/types.ts — 엔진 ↔ 룰 경계 타입
// 원칙
//  1) 룰의 판정 함수(evaluate)는 '구성원마다 결과 하나'(위험·주의·이상 없음·확인 불가·제외)와 범위 증명(또는 구멍)만 돌려준다.
//     룰 상태(5상태)는 core(aggregate.ts)가 계산한다 — 룰은 상태를 직접 반환할 수 없다(INV-1).
//  2) 사용자 데이터 문자열은 Raw로만 싣는다. DisplayValue(정리·마스킹) 변환은 display.ts 한 곳이 한다(R-12, R-13).
//  3) 문장은 없다. 코드(MsgRef)와 파라미터뿐이다(rules/i18n/ko.ts가 문장을 가진다).
import type {
  Cloud, DoorId, FactCode, FindingReason, IsoDate, IsoUtc, Label, MessageCode, MsgParam, ResourceType, RuleCatalogEntry,
  RuleId, RuleReason, SensitiveType, UnknownReason,
} from "../model/report";
import type { AsOfFact, FamilyId, NormalizedInput, ReceiptFact, ReceiptKey, Src } from "../contract/normalized";
import type { AwsCall, AzureCall } from "../contract/calls";
import type {
  AwsKeyData, AwsLogData, AwsMfaData, AwsNetData, AwsStoData, AzureKeyData, AzureLogData, AzureMfaData, AzureNetData, AzureStoData,
} from "../contract/normalized";

/* ───────── 사용자 데이터·메시지(룰 쪽 표현) ───────── */
/** 사용자 데이터 원값. type이 마스킹 형식을 정한다. prefix는 이름 계열 가명의 접두(생략하면 type·ResourceType에서 유도) */
export interface Raw { readonly type: SensitiveType; readonly value: string; readonly prefix?: string }
export type RParam =
  | { readonly n: number }
  | { readonly t: IsoUtc }
  | { readonly d: IsoDate }
  | { readonly c: string }          // 비식별 상수. core가 제어·양방향 문자를 치환한다
  | { readonly raw: Raw };          // 사용자 데이터 → MsgParam.v(DisplayValue)
export type RParams = Readonly<Record<string, RParam>>;
export interface RMsg<C extends MessageCode = MessageCode> { readonly code: C; readonly params?: RParams }

export type CallId = AwsCall | AzureCall;

/* ───────── 구성원(대상) 결과 ───────── */
export interface ResourceDesc {
  readonly type: ResourceType;
  /** 화면 이름. 사용자 데이터면 Raw, 상수면 { plain } */
  readonly name: Raw | { readonly plain: string };
  /** 위치(리전·구독). value는 사용자 데이터(구독 ID 등)일 수 있어 core가 정리한다 */
  readonly where: { readonly kind: "global" | "region" | "subscription"; readonly value: string } | null;
  /**
   * MatchKey의 위치 마디. 생략하면 where를 쓴다. 이름이 전역에서 유일한 대상(S3 버킷)은 global로 두어,
   * 리전 조회가 성공하든 실패하든 같은 키가 되게 한다(예외 표시 · 전후 비교가 끊기지 않는다 — CC-QA-16). 화면의 위치 표시는 where를 그대로 쓴다.
   */
  readonly keyWhere?: { readonly kind: "global" | "region" | "subscription"; readonly value: string } | null;
  /** MatchKey의 마지막 마디(고유 ID). 같은 (type, 키 위치) 안에서 유일해야 한다 */
  readonly id: string;
  /**
   * 범위 표(FamilyCoverage.memberKeys)가 이 구성원을 부르는 신원. 생략하면 id다. 리전 단위 ID처럼 MatchKey 위치 마디에 이미 리전이 있어 id에는 ID만 두는 대상(보안 그룹)이
   * 범위 표의 "<리전>/<ID>"와 맞추는 데 쓴다. MatchKey에는 영향이 없다. 엔진은 룰이 평가한 구성원의 신원 집합을 이 값으로 증명된 신원 집합과 대조한다(CC-QA-02 · 15).
   */
  readonly familyKey?: string;
}
/** 증거 한 건. src가 가리키는 영수증·CSV 칸을 core가 EvidenceRef로 바꾼다. observed = allowlist 필드만 */
export interface Ev {
  readonly src: Src;
  readonly observed?: readonly { readonly field: string; readonly value: string | Raw }[];
}
export type RuleLabel = Exclude<Label, { kind: "exception" }>;
interface MemberCommon {
  readonly res: ResourceDesc;
  readonly ev: readonly Ev[];
  readonly facts?: readonly RMsg<FactCode>[];
  readonly labels?: readonly RuleLabel[];
}
/**
 * 구성원 하나의 결과. 'excluded'(제외)는 증거(ev ≥ 1)가 있어야 하며 Report에는 나오지 않는다 — 적용 대상 판단(콘솔 사용자인가, 활성 키인가 …)은 룰이 하고,
 * core가 모수 − 제외 = 적용 대상 수로 해당 없음을 판정한다(NORMALIZED.md §4).
 */
export type Member =
  | (MemberCommon & { readonly s: "risk" | "caution"; readonly why: RMsg<FindingReason> })
  | (MemberCommon & { readonly s: "clear"; readonly why: RMsg<RuleReason> })
  | (MemberCommon & { readonly s: "unknown"; readonly why: RMsg<UnknownReason> })
  | (MemberCommon & { readonly s: "excluded"; readonly why: RMsg<RuleReason> });

/* ───────── 범위 증명 ───────── */
declare const proofBrand: unique symbol;
export interface Gap { readonly gaps: readonly UnknownReason[] }
/** '없음'(이상 없음·해당 없음)을 말할 자격. proof.ts의 proveScope()만 만든다(봉인된 coverage가 모두 완결일 때) */
export interface ScopeProof {
  readonly [proofBrand]: true;
  readonly itemFamily: FamilyId;
  readonly families: readonly FamilyId[];
  /** 열거된 구성원 수(제외 전). 봉인된 값 그대로 */
  readonly population: number;
  /** 아이템 패밀리가 증명한 구성원 신원 집합(정렬 · 중복 없음 · 개수 = population). 신원을 싣지 않은 입력이면 null — 그때는 개수만 대조한다 */
  readonly memberKeys: readonly string[] | null;
  readonly input: number;
  readonly receipts: readonly ReceiptKey[];
  readonly unit: { readonly kind: "account-global" | "regions" | "subscriptions" | "csv-rows" | "none"; readonly covered: number; readonly total: number };
}

/* ───────── 룰 컨텍스트와 모듈 ───────── */
export interface AwsDoorData { readonly mfa: AwsMfaData; readonly key: AwsKeyData; readonly net: AwsNetData; readonly sto: AwsStoData; readonly log: AwsLogData }
export interface AzureDoorData { readonly mfa: AzureMfaData; readonly key: AzureKeyData; readonly net: AzureNetData; readonly sto: AzureStoData; readonly log: AzureLogData }
export type DoorData<C extends Cloud, D extends DoorId> = (C extends "aws" ? AwsDoorData : AzureDoorData)[D];

export interface RuleCtx<D = unknown> {
  readonly cloud: Cloud;
  readonly input: NormalizedInput;
  readonly data: D;
  /** 룰이 읽는 문(door)의 선택 입력 번호 */
  readonly inputIndex: number;
  /** 룰의 기준 시각. 보고서 기반 룰은 보고서 생성 시각, 그 밖에는 문의 기준 시각. null이면 나이·경과를 계산할 수 없다 */
  readonly asOf: AsOfFact | null;
  /** 선언한 패밀리가 모두 완결일 때만 ScopeProof. 그 밖에는 구멍 목록 */
  readonly scope: ScopeProof | Gap;
  /** 계정(AWS) 또는 테넌트(Azure) 전체 ID. MatchKey와 외부 계정 판단에 쓴다 */
  readonly accountId: string;
  readonly receipt: (key: ReceiptKey | null | undefined) => ReceiptFact | undefined;
  /** 보고서 신선도 검사 결과(보고서 기반 룰): false면 보고서가 허용보다 오래돼 음성(이상 없음·제외) 결론을 내리면 안 된다 */
  readonly reportFresh: boolean;
}
export interface RuleOutcome {
  readonly members: readonly Member[];
  /** ctx.scope를 그대로 돌려주거나 룰 자신의 구멍(Gap)을 돌려준다. ScopeProof는 룰이 만들 수 없다 */
  readonly coverage: ScopeProof | Gap;
}
/** core가 상태를 정한 뒤 룰에게 '사유 문장 코드'만 묻는다(상태는 바꿀 수 없다) */
export interface ExplainInput {
  readonly status: "risk" | "caution" | "clear" | "na";
  /** 이 상태인 대상들(위험·주의는 isolated-denial을 뺀 것, 이상 없음은 clear 전체, 해당 없음은 제외 목록) */
  readonly members: readonly Member[];
  /** 증명된 모수(제외 전)와 적용 대상 수(모수 − 제외). 증명이 없으면 null */
  readonly population: number | null;
  readonly applicable: number | null;
  readonly excluded: number;
  /** 활성 리전 수 등 범위 크기(증명이 있을 때) */
  readonly unitTotal: number | null;
}
export interface Explained { readonly msg: RMsg<RuleReason> }

export interface IsolationSpec { readonly calls: readonly CallId[] }
export interface FixtureCaseSpec {
  readonly pass: string | { readonly na: string };
  readonly violate: readonly string[] | { readonly na: string };
  readonly denied: { readonly call: CallId; readonly resource?: string; readonly region?: string; readonly expect: "unknown" | "caution" | "risk" } | { readonly na: string };
  readonly truncated: { readonly call: CallId; readonly expect: "unknown" | "caution" | "risk" } | { readonly na: string };
  readonly missingField: { readonly path: string; readonly expect: "unknown" | "caution" | "risk" } | { readonly na: string };
  readonly versionMismatch: "auto";
}

/** 룰 정적 데이터 = RuleCatalogEntry(화면용 공개 데이터) + 엔진·테스트용 선언 */
export interface RuleSpec extends RuleCatalogEntry {
  /** 기준 시각을 어디서 가져오나: 문의 선택 입력 시각, 또는 자격증명 보고서 생성 시각(보고서 기반 룰, 없으면 문 시각) */
  readonly asOfBasis: "door" | "credential-report";
  /** 아이템 패밀리 1개 + 필요한 패밀리(같은 문). 가이드 룰은 null */
  readonly families: { readonly item: FamilyId; readonly needs: readonly FamilyId[] } | null;
  /** 이 룰이 데이터를 읽는 호출(권한 해제 힌트·권한 패널의 ruleIds, 권한 이름 = 호출 카탈로그의 permission) */
  readonly calls: readonly CallId[];
  /** INV-7: 이 호출이 일부 대상에서만 거부되면 그 대상은 주의(isolated-denial)로 올린다 */
  readonly isolatedDenial: IsolationSpec | null;
  /** 닫힌 사유 목록: slug → 파라미터 이름들. 코드는 `<RuleId>:<slug>`(룰 수준·대상 수준 모두) */
  readonly reasons: Readonly<Record<string, readonly string[]>>;
  /** 이 룰이 내는 fact 목록: slug → 파라미터 이름들. 코드는 `fact:<slug>` */
  readonly facts: Readonly<Record<string, readonly string[]>>;
  /** 직접 볼 목록(확인 불가 대상·점검)의 '어떻게' 문구 키 */
  readonly manualHowKey: `cc.${string}` | null;
  /** 해당 없음일 때 직접 볼 목록에 자동으로 넣는 안내(AWS-MFA-2의 IdP MFA) */
  readonly autoNotice: { readonly what: FactCode; readonly howKey: `cc.${string}` } | null;
  readonly fixtures: FixtureCaseSpec;
}

export interface RuleModule {
  readonly id: RuleId;
  readonly spec: RuleSpec;
  /** 가이드 룰(evaluate 없음)은 undefined. 문(door) 데이터 타입이 룰마다 달라 모듈 배열에서는 지운다 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly evaluate?: (ctx: RuleCtx<any>) => RuleOutcome;
  readonly explain?: (x: ExplainInput) => Explained;
}

/** MsgParam으로 바꾼 뒤의 메시지 파라미터 모양(테스트 편의) */
export type { MsgParam };
