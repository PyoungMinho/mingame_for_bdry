// src/lib/cloudcheck/rules/catalog.ts — RULE_CATALOG: 룰 18장의 정적 공개 데이터 (V7 '판정 규칙' · V3 · V4가 ruleId로 조인한다)
// RuleCatalogEntry의 필드만 담는다(엔진용 선언 — families·calls·reasons·fixtures 등 — 은 UI 번들로 새지 않게 뺀다).
// released = false인 룰(AZ-MFA-1)은 목록에는 있지만 리포트·분포에는 넣지 않는다(엔진이 건너뛴다).
import type { RuleCatalogEntry } from "../model/report";
import type { RuleSpec } from "../engine/types";
import { RULES } from "./registry";

export function toCatalogEntry(s: RuleSpec): RuleCatalogEntry {
  return {
    ruleId: s.ruleId, cloud: s.cloud, door: s.door, kind: s.kind, released: s.released,
    titleKey: s.titleKey, summaryKey: s.summaryKey, maxStatus: s.maxStatus, allowsClear: s.allowsClear, priority: s.priority,
    conditionKeys: s.conditionKeys, impactKey: s.impactKey, questionKey: s.questionKey, paths: s.paths, permissions: s.permissions,
    params: s.params, cannotSee: s.cannotSee, falsePositiveKeys: s.falsePositiveKeys, fix: s.fix, guide: s.guide, basis: s.basis,
    incident: s.incident, lastVerified: s.lastVerified,
  };
}

export const RULE_CATALOG: readonly RuleCatalogEntry[] = RULES.map((m) => toCatalogEntry(m.spec));
