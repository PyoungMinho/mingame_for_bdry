// src/app/cloudcheck/_client/components/rule-keys.ts — 점검 ID → 카탈로그 키·문 변환(컴포넌트가 RULE_CATALOG 없이도 제목·문을 알 수 있게).
// 규칙: UX §9 키 규칙 cc.rule.<id 소문자>.<필드>. 카탈로그 항목(RuleCatalogEntry.titleKey)이 있으면 그것이 우선이고, 이 함수는 폴백이다.
import { DOORS, type CatalogKey, type DoorId, type RuleId } from "../../../../lib/cloudcheck/model/report";

export function ruleTitleKey(id: RuleId): CatalogKey {
  return `cc.rule.${id.toLowerCase()}.title`;
}

/** "AWS-MFA-1" → "mfa" (점검 ID의 가운데 마디가 문 ID와 같다. 못 읽으면 null) */
export function doorOfRuleId(id: RuleId): DoorId | null {
  const mid = (id.split("-")[1] ?? "").toLowerCase();
  return (DOORS as readonly string[]).includes(mid) ? (mid as DoorId) : null;
}
