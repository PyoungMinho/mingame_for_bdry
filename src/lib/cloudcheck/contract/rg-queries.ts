// src/lib/cloudcheck/contract/rg-queries.ts — Azure Resource Graph 조회(KQL) 원문 + 열 계약 (방향서 §4-7, 디자인 X11)
// 소유: API설계자. UI(_client)는 이 모듈에서 KQL 원문을 이름 지정 import로만 가져온다(복사 버튼은 없다: 방향서 §1-1 #7).
// 규칙
//  1) 모든 쿼리는 첫 열에 상수 열 ccQuery='<쿼리 ID>'를 둔다. 파서는 이 열로 쿼리 버전을 확인한다(INV-10). 열 구성이 바뀌면 ID의 숫자를 올린다.
//  2) tenantId 열이 있어야 신원(테넌트)·다중 입력 병합의 기준이 생긴다(방향서 §1-2 L).
//  3) 아래 열 구성은 [미확인]이다 → PM이 Resource Graph Explorer에서 실제 CSV 열을 확인한다(V1). 확인 전까지 파서는 열 이름으로만 매핑한다.
//  4) 이 파일은 순수 상수만 담는다(import는 타입뿐).
import type { DoorId, InputKind } from "../model/report";

export type RgQueryKind = Extract<InputKind, "csv-rg-storage" | "csv-rg-nsg">;
export interface RgQuery {
  readonly id: string;                  // ccQuery 상수 열의 값
  readonly kind: RgQueryKind;
  readonly doors: readonly DoorId[];    // 이 쿼리 결과가 판정에 쓰이는 문
  readonly columns: readonly string[];  // project 열 순서 그대로
  readonly kql: string;
}

/** ccQuery 값의 형식. 숫자는 쿼리 버전이다 */
export const RG_QUERY_ID_RE = /^cc-rg-(storage|nsg)\/(\d+)$/;
export const RG_STORAGE_ID = "cc-rg-storage/1" as const;
export const RG_NSG_ID = "cc-rg-nsg/1" as const;

export const RG_STORAGE_COLUMNS = [
  "ccQuery", "tenantId", "id", "subscriptionId", "resourceGroup", "name", "kind", "location",
  "allowBlobPublicAccess", "allowSharedKeyAccess", "key1CreationTime", "key2CreationTime",
  "keyExpirationPeriodInDays", "sasExpirationPeriod",
] as const;

export const RG_NSG_COLUMNS = [
  "ccQuery", "tenantId", "nsgId", "subscriptionId", "nsgName", "location",
  "ruleName", "direction", "access", "priority", "protocol",
  "sourcePrefix", "sourcePrefixes", "destPortRange", "destPortRanges", "nicCount", "subnetCount",
] as const;

export const RG_STORAGE_KQL = [
  "// cc-rg-storage/1",
  "resources",
  "| where type =~ 'microsoft.storage/storageaccounts'",
  "| project ccQuery='cc-rg-storage/1', tenantId, id, subscriptionId, resourceGroup, name, kind, location,",
  "  allowBlobPublicAccess=tostring(properties.allowBlobPublicAccess),",
  "  allowSharedKeyAccess=tostring(properties.allowSharedKeyAccess),",
  "  key1CreationTime=tostring(properties.keyCreationTime.key1),",
  "  key2CreationTime=tostring(properties.keyCreationTime.key2),",
  "  keyExpirationPeriodInDays=tostring(properties.keyPolicy.keyExpirationPeriodInDays),",
  "  sasExpirationPeriod=tostring(properties.sasPolicy.sasExpirationPeriod)",
  "| order by id asc",
].join("\n");

export const RG_NSG_KQL = [
  "// cc-rg-nsg/1  (규칙을 펼침)",
  "resources",
  "| where type =~ 'microsoft.network/networksecuritygroups'",
  "| mv-expand rule = properties.securityRules",
  "| project ccQuery='cc-rg-nsg/1', tenantId, nsgId=id, subscriptionId, nsgName=name, location,",
  "  ruleName=tostring(rule.name), direction=tostring(rule.properties.direction),",
  "  access=tostring(rule.properties.access), priority=toint(rule.properties.priority),",
  "  protocol=tostring(rule.properties.protocol),",
  "  sourcePrefix=tostring(rule.properties.sourceAddressPrefix), sourcePrefixes=tostring(rule.properties.sourceAddressPrefixes),",
  "  destPortRange=tostring(rule.properties.destinationPortRange), destPortRanges=tostring(rule.properties.destinationPortRanges),",
  "  nicCount=array_length(properties.networkInterfaces), subnetCount=array_length(properties.subnets)",
].join("\n");

/** 화면 순서: 스토리지 → NSG */
export const RG_QUERIES: readonly RgQuery[] = [
  { id: RG_STORAGE_ID, kind: "csv-rg-storage", doors: ["key", "sto"], columns: RG_STORAGE_COLUMNS, kql: RG_STORAGE_KQL },
  { id: RG_NSG_ID, kind: "csv-rg-nsg", doors: ["net"], columns: RG_NSG_COLUMNS, kql: RG_NSG_KQL },
];
