// src/lib/cloudcheck/collector/__scenarios__/azure.ts — Azure shim 시나리오 8종 (백엔드팀장 검토 §3-3 매트릭스)
import type { Scenario, ShimEntry } from "../testkit";
import { AZ_NIC, AZ_NSG, AZ_OTHER_TENANT, AZ_PIP, AZ_ST_LOGS, AZ_ST_WEB, AZ_SUB, AZ_SUB_DISABLED, AZ_SUB_FOREIGN, AZ_TENANT, azureBase } from "./azure-base";
import { azFail, out, type ScenarioCase, withScenario } from "./types";

/** 같은 테넌트의 둘째 사용 가능 구독 — '구독 하나만 거부' 시나리오용 */
export const AZ_SUB_SECOND = "00000000-0000-0000-0000-000000000014";
const secondSubKeys = (denied: boolean): Record<string, ShimEntry> => {
  const o: Record<string, ShimEntry> = {};
  for (const k of ["storage account list", "network nsg list", "network nic list", "network public-ip list", "monitor diagnostic-settings subscription list"]) {
    o[`${k}@${AZ_SUB_SECOND}`] = denied ? azFail("AuthorizationFailed") : out(k.startsWith("monitor") ? { value: [] } : []);
  }
  return o;
};
const accountListWithSecond = (): ShimEntry => out([
  { id: AZ_SUB, name: "예시상회 운영", state: "Enabled", tenantId: AZ_TENANT, user: { name: "kim@example.com", type: "user" } },
  { id: AZ_SUB_SECOND, name: "예시상회 개발", state: "Enabled", tenantId: AZ_TENANT, user: { name: "kim@example.com", type: "user" } },
  { id: AZ_SUB_DISABLED, name: "예시상회 보관", state: "Disabled", tenantId: AZ_TENANT },
  { id: AZ_SUB_FOREIGN, name: "협력사 구독", state: "Enabled", tenantId: AZ_OTHER_TENANT },
]);

export const AZURE_SCENARIOS: readonly ScenarioCase[] = [
  { id: "az-01-normal", title: "정상(가짜 회사): 구독 3개 중 1개가 조회 대상", scenario: azureBase(), args: ["--yes"] },
  { id: "az-02-one-sub-denied", title: "구독 둘 중 하나만 AuthorizationFailed", scenario: withScenario(azureBase(), { "account list": accountListWithSecond(), ...secondSubKeys(true) }), args: ["--yes"] },
  { id: "az-03-missing-registration", title: "리소스 공급자 미등록(MissingSubscriptionRegistration)", scenario: withScenario(azureBase(), {
    [`network public-ip list@${AZ_SUB}`]: azFail("MissingSubscriptionRegistration", "The subscription is not registered to use namespace 'Microsoft.Network'."),
  }), args: ["--yes"] },
  { id: "az-04-container-isolated", title: "특정 스토리지 계정만 container-rm 거부(INV-7 패턴)", scenario: withScenario(azureBase(), {
    [`storage container-rm list#${AZ_ST_LOGS}@${AZ_SUB}`]: azFail("AuthorizationFailed"),
  }), args: ["--yes"] },
  { id: "az-05-throttled-429", title: "429(TooManyRequests)", scenario: withScenario(azureBase(), {
    [`network nsg list@${AZ_SUB}`]: azFail("TooManyRequests", "Too many requests. Please retry after 30 seconds."),
  }), args: ["--yes"] },
  { id: "az-06-diag-forms", title: "진단 설정 출력 두 형태: {value: […]}와 […]", scenario: withScenario(azureBase(), {
    [`monitor diagnostic-settings list#${AZ_ST_WEB}/blobServices/default@${AZ_SUB}`]: out({ value: [{ name: "wrapped", logs: [{ category: "StorageRead", enabled: true }], storageAccountId: `/subscriptions/${AZ_SUB}/resourceGroups/rg-ops/providers/Microsoft.Storage/storageAccounts/POISON`, workspaceId: null }] }),
    [`monitor diagnostic-settings list#${AZ_ST_LOGS}/blobServices/default@${AZ_SUB}`]: out([]),
    [`monitor diagnostic-settings subscription list@${AZ_SUB}`]: out([{ name: "plain-array", logs: [{ categoryGroup: "allLogs", enabled: true }], eventHubAuthorizationRuleId: "POISON" }]),
  }), args: ["--yes"] },
  { id: "az-07-exit-2", title: "az 종료 코드 2(파서 오류 · Code 줄 없음)", scenario: withScenario(azureBase(), {
    [`storage account list@${AZ_SUB}`]: { stderr: "usage: az storage account list [-h] [--verbose] [--debug]\naz storage account list: error: unrecognized arguments\n", rc: 2 },
  }), args: ["--yes"] },
  { id: "az-08-foreign-tenant", title: "다른 테넌트·사용 불가 구독은 호출하지 않고 범위 밖으로 기록", scenario: azureBase(), args: ["--yes"] },
];
export const azureCase = (id: string): ScenarioCase => {
  const c = AZURE_SCENARIOS.find((x) => x.id === id);
  if (!c) throw new Error(`없는 시나리오: ${id}`);
  return c;
};
export const AZURE_REFS = { AZ_NIC, AZ_NSG, AZ_PIP, AZ_TENANT } as const;
export type { Scenario };
