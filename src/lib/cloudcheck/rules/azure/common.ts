// src/lib/cloudcheck/rules/azure/common.ts — Azure 룰 공용 헬퍼
import type { AzureDiagSetting, AzureScope, AzureStorageAccount, Slot } from "../../contract/normalized";
import type { ResourceDesc } from "../../engine/types";
import type { UnknownReason } from "../../model/report";
import { gapOfSlot, inSubscription } from "../kit";

export const storageAccountRes = (sa: AzureStorageAccount): ResourceDesc =>
  ({ type: "storage-account", name: { type: "resourceName", value: sa.name }, where: inSubscription(sa.subscription), id: sa.id });

/** 값이 답이 아닐 때의 사유(없으면 value-unrecognized) */
export const why = (s: Slot<unknown>): UnknownReason => gapOfSlot(s) ?? "value-unrecognized";

/** 구독 리소스 설명: 이름을 알면 구독 이름, 모르면 ID */
export function subscriptionRes(data: AzureScope, id: string): ResourceDesc {
  const slot = data.subscriptions;
  const found = slot.k === "value" || slot.k === "partial" ? slot.value.find((s) => s.id === id) : undefined;
  return {
    type: "subscription",
    name: found === undefined ? { type: "subscriptionId", value: id } : { type: "subscriptionName", value: found.name },
    where: inSubscription(id),
    id,
  };
}

/** 진단 설정들이 켜 둔 로그 범주(소문자). 범주 그룹 allLogs는 '모든 범주', audit은 groupAudit이 정한 범주로 본다 */
export function enabledCategories(settings: readonly AzureDiagSetting[], filter: (s: AzureDiagSetting) => boolean, groupAudit: readonly string[] | null): { readonly cats: ReadonlySet<string>; readonly allLogs: boolean; readonly auditOnlyUnknown: boolean } {
  const cats = new Set<string>();
  let allLogs = false;
  let auditUnknown = false;
  for (const s of settings) {
    if (!filter(s)) continue;
    for (const l of s.logs) {
      if (!l.enabled) continue;
      if (l.category !== null) cats.add(l.category.toLowerCase());
      if (l.categoryGroup !== null) {
        const g = l.categoryGroup.toLowerCase();
        if (g === "alllogs") allLogs = true;
        else if (g === "audit") { if (groupAudit === null) auditUnknown = true; else for (const c of groupAudit) cats.add(c); }
      }
    }
  }
  return { cats, allLogs, auditOnlyUnknown: auditUnknown };
}

export const hasRetainedDestination = (s: AzureDiagSetting): boolean => s.destinations.workspace || s.destinations.storage;
export const hasAnyDestination = (s: AzureDiagSetting): boolean => s.destinations.workspace || s.destinations.storage || s.destinations.eventHub || s.destinations.partner;
