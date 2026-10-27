// micro/AWS-LOG-1 — CloudTrail trail 구성
import type { AwsLogData, AwsNormalizedInput, AwsTrail } from "../../contract/normalized";
import { MicroAws, byReceipt, val } from "./kit";

export interface TrailSpec {
  readonly name: string;
  readonly multiRegion?: boolean;
  readonly logging?: boolean;
  readonly validation?: boolean;
  /** 관리 이벤트 쓰기 포함 여부(기본 true). false면 읽기 전용 선택기 */
  readonly writes?: boolean;
  /** 상태 조회에 로그 전달 오류 기록(LatestDeliveryError)이 있는가(기본 false) — 결정 D-2 */
  readonly deliveryError?: boolean;
  /** 선택기를 그대로 지정한다(모르는 ReadWriteType · 빈 readOnly 조건 같은 경계 사례). 주면 사용자 지정 선택기가 있는 trail이다 */
  readonly selectors?: {
    readonly basic: readonly { readonly readWriteType: string; readonly includeManagementEvents: boolean }[];
    readonly advanced: readonly { readonly fields: readonly { readonly field: string; readonly equals: readonly string[] }[] }[];
  };
}

export function logWorld(trails: readonly TrailSpec[]): { readonly m: MicroAws; build: () => AwsNormalizedInput } {
  const m = new MicroAws();
  const dt = m.rc("cloudtrail:DescribeTrails", trails.length === 0 ? "empty" : "ok", { count: trails.length });
  const list: AwsTrail[] = trails.map((t) => {
    const ks = m.rc("cloudtrail:GetTrailStatus", "ok", { resource: t.name });
    const ke = m.rc("cloudtrail:GetEventSelectors", "ok", { resource: t.name });
    return {
      src: byReceipt(dt), name: t.name, arn: `arn:aws:cloudtrail:ap-northeast-2:111122223333:trail/${t.name}`, homeRegion: "ap-northeast-2",
      isMultiRegion: t.multiRegion ?? true, isOrganizationTrail: false, logFileValidationEnabled: t.validation ?? true,
      hasCloudWatchLogs: false, hasCustomEventSelectors: t.writes === false || t.selectors !== undefined,
      status: val({ isLogging: t.logging ?? true, hasDeliveryError: t.deliveryError ?? false }, byReceipt(ks)),
      selectors: val(t.selectors ?? { basic: [{ readWriteType: t.writes === false ? "ReadOnly" : "All", includeManagementEvents: true }], advanced: [] }, byReceipt(ke)),
    };
  });
  const data: AwsLogData = { trails: val(list, byReceipt(dt)) };
  m.log(data);
  m.prove("aws.log.account", { present: 1, receipts: [dt] });
  m.prove("aws.log.trails", { present: trails.length, receipts: [dt] });
  return { m, build: () => m.build() };
}

export const log1 = {
  pass: (): AwsNormalizedInput => logWorld([{ name: "org-trail" }]).build(),
  noTrail: (): AwsNormalizedInput => logWorld([]).build(),
  stopped: (): AwsNormalizedInput => logWorld([{ name: "main", logging: false }]).build(),
  singleRegion: (): AwsNormalizedInput => logWorld([{ name: "main", multiRegion: false }]).build(),
  noValidation: (): AwsNormalizedInput => logWorld([{ name: "main", validation: false }]).build(),
  readOnly: (): AwsNormalizedInput => logWorld([{ name: "main", writes: false }]).build(),
  // ── 선택기의 모르는 값(CC-QA-07, P3): 관리 이벤트 쓰기 기록 여부를 알 수 없으면 이상 없음이 아니다 ──
  unknownReadWriteType: (): AwsNormalizedInput => logWorld([{ name: "main", selectors: { basic: [{ readWriteType: "zzz", includeManagementEvents: true }], advanced: [] } }]).build(),
  readWriteTypeEmpty: (): AwsNormalizedInput => logWorld([{ name: "main", selectors: { basic: [{ readWriteType: "", includeManagementEvents: true }], advanced: [] } }]).build(),
  writeOnly: (): AwsNormalizedInput => logWorld([{ name: "main", selectors: { basic: [{ readWriteType: "writeonly", includeManagementEvents: true }], advanced: [] } }]).build(),
  /** 모르는 선택기가 있어도 쓰기를 기록하는 선택기가 하나 확인되면 갖춘 것이다 */
  unknownPlusAll: (): AwsNormalizedInput => logWorld([{ name: "main", selectors: { basic: [{ readWriteType: "zzz", includeManagementEvents: true }, { readWriteType: "All", includeManagementEvents: true }], advanced: [] } }]).build(),
  managementOff: (): AwsNormalizedInput => logWorld([{ name: "main", selectors: { basic: [{ readWriteType: "All", includeManagementEvents: false }], advanced: [] } }]).build(),
  advancedReadOnlyEmpty: (): AwsNormalizedInput => logWorld([{ name: "main", selectors: { basic: [], advanced: [{ fields: [{ field: "eventCategory", equals: ["Management"] }, { field: "readOnly", equals: [] }] }] } }]).build(),
  advancedReadOnlyOdd: (): AwsNormalizedInput => logWorld([{ name: "main", selectors: { basic: [], advanced: [{ fields: [{ field: "eventCategory", equals: ["Management"] }, { field: "readOnly", equals: ["maybe"] }] }] } }]).build(),
  advancedReadOnlyTrue: (): AwsNormalizedInput => logWorld([{ name: "main", selectors: { basic: [], advanced: [{ fields: [{ field: "eventCategory", equals: ["Management"] }, { field: "readOnly", equals: ["true"] }] }] } }]).build(),
  advancedReadOnlyFalse: (): AwsNormalizedInput => logWorld([{ name: "main", selectors: { basic: [], advanced: [{ fields: [{ field: "eventCategory", equals: ["Management"] }, { field: "readOnly", equals: ["false"] }] }] } }]).build(),
  advancedNoReadOnly: (): AwsNormalizedInput => logWorld([{ name: "main", selectors: { basic: [], advanced: [{ fields: [{ field: "eventCategory", equals: ["Management"] }] }] } }]).build(),
  // ── 로그 전달 오류 기록(CC-QA-08, 결정 D-2): 기록 중이어도 오류 기록이 있으면 갖춘 trail이 아니다 ──
  deliveryError: (): AwsNormalizedInput => logWorld([{ name: "main", deliveryError: true }]).build(),
  /** 오류 기록이 있는 trail이 있어도 오류 없이 조건을 다 갖춘 다른 trail이 있으면 이상 없음 */
  deliveryErrorPlusGood: (): AwsNormalizedInput => logWorld([{ name: "old", deliveryError: true }, { name: "good" }]).build(),
  /** 빈틈 순서: 기록 중지가 전달 오류보다 앞선다 */
  deliveryErrorAndStopped: (): AwsNormalizedInput => logWorld([{ name: "main", logging: false, deliveryError: true }]).build(),
  /** 빈틈 순서: 전달 오류가 다중 리전 아님보다 앞선다 */
  deliveryErrorAndSingleRegion: (): AwsNormalizedInput => logWorld([{ name: "main", multiRegion: false, deliveryError: true }]).build(),
  /** 한 trail은 중지, 다른 trail은 갖춤 → 이상 없음 */
  oneGood: (): AwsNormalizedInput => logWorld([{ name: "old", logging: false }, { name: "good" }]).build(),
};
